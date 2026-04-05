import json
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Service Initialization
ssm = boto3.client('ssm')
dynamodb = boto3.resource('dynamodb')
TABLE_TELEMETRY = dynamodb.Table('MeterTelemetry')
TABLE_METADATA = dynamodb.Table('PanelMetadata')


class DecimalEncoder(json.JSONEncoder):
    """Surgical cast of DynamoDB Decimals to JSON-compatible Floats."""

    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def get_vault_keys():
    """Retrieves both Dashboard and Admin clearances from SSM."""
    try:
        res = ssm.get_parameters(
            Names=['/api/dashboard_key', '/api/admin_key'],
            WithDecryption=True
        )
        keys = {p['Name']: p['Value'].strip() for p in res['Parameters']}
        return keys.get('/api/dashboard_key'), keys.get('/api/admin_key')
    except ClientError as e:
        logger.error(f"SSM parameter retrieval failed: {str(e)}")
        return None, None
    except Exception as e:
        logger.error(f"VAULT ACCESS FAULT: {str(e)}")
        return None, None


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,x-dashboard-key,x-admin-key,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,PATCH,DELETE'
}


def build_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': body if isinstance(body, str) else json.dumps(body, cls=DecimalEncoder)
    }


def validate_panel_id(panel_id, operation="operation"):
    """Validate panel_id is present and not empty."""
    if not panel_id or not panel_id.strip():
        return False, f'panel_id is required for {operation}.'
    return True, None


def validate_timestamps(start_param, end_param):
    """Validate and convert timestamp parameters to strings for DynamoDB."""
    try:
        start_ts = int(start_param) if start_param else 0
        end_ts = int(end_param) if end_param else 2147483647000

        if start_ts < 0 or end_ts < 0:
            return None, None, 'Timestamps must be non-negative integers.'

        if start_ts > end_ts:
            return None, None, 'Start timestamp cannot be greater than end timestamp.'

        # Convert to zero-padded strings for proper lexicographic sorting in DynamoDB
        # Using 13 digits to handle timestamps up to year 2286
        return str(start_ts).zfill(13), str(end_ts).zfill(13), None
    except (ValueError, TypeError):
        return None, None, 'start and end must be valid integer timestamps.'


def lambda_handler(event, context):
    try:
        # 1. PARAMETER EXTRACTION
        method = event.get('httpMethod') or event.get(
            'requestContext', {}).get('http', {}).get('method')

        if method == 'OPTIONS':
            return build_response(200, '')

        headers = {k.lower(): v for k, v in event.get('headers', {}).items()}
        query_params = event.get('queryStringParameters') or {}

        # 2. DUAL-KEY AUTHENTICATION BARRICADE
        dash_key, admin_key = get_vault_keys()

        if not dash_key or not admin_key:
            logger.error("Failed to retrieve authentication keys from SSM")
            return build_response(500, {'error': 'Authentication system unavailable.'})

        client_dash = headers.get('x-dashboard-key', '').strip()
        client_admin = headers.get('x-admin-key', '').strip()

        # Base Level: Dashboard clearance is required for EVERYTHING
        if client_dash != dash_key:
            return build_response(401, {'error': 'Unauthorized: Level 1 key required.'})

        # Elevated Level: Admin clearance required for MUTATIONS (POST, PUT, PATCH, DELETE)
        if method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            if client_admin != admin_key:
                return build_response(403, {'error': 'Forbidden: Level 2 Admin key required for mutations.'})

        # 3. GLOBAL PARSING
        try:
            body = json.loads(event.get('body', '{}'),
                              parse_float=Decimal) if event.get('body') else {}
        except json.JSONDecodeError as e:
            return build_response(400, {'error': f'Invalid JSON in request body: {str(e)}'})

        panel_id = query_params.get('panel_id') or body.get('panel_id')

        # ==========================================
        # GET: READ / SYSTEM SNAPSHOT
        # ==========================================
        if method == 'GET':
            # ENQUIRY: Historical Telemetry
            if query_params.get('enquiry') == 'history':
                p_id = query_params.get('panel_id')
                is_valid, error_msg = validate_panel_id(
                    p_id, 'history enquiry')
                if not is_valid:
                    return build_response(400, {'error': error_msg})

                start_ts, end_ts, ts_error = validate_timestamps(
                    query_params.get('start'),
                    query_params.get('end')
                )
                if ts_error:
                    return build_response(400, {'error': ts_error})

                try:
                    logger.info(
                        f"Querying telemetry for panel_id: {p_id}, start: {start_ts}, end: {end_ts}")

                    # Query with string timestamps to match DynamoDB table schema
                    logs = TABLE_TELEMETRY.query(
                        KeyConditionExpression=Key('meter_id').eq(p_id) & Key(
                            'timestamp').between(start_ts, end_ts),
                        ScanIndexForward=True
                    ).get('Items', [])

                    logger.info(f"Retrieved {len(logs)} telemetry records")
                    return build_response(200, logs)

                except ClientError as e:
                    error_code = e.response['Error']['Code']
                    error_message = e.response['Error']['Message']
                    logger.error(
                        f"DynamoDB query failed for history - Code: {error_code}, Message: {error_message}")

                    if error_code == 'ValidationException':
                        return build_response(400, {'error': f'Invalid query parameters: {error_message}'})
                    elif error_code == 'ResourceNotFoundException':
                        return build_response(404, {'error': 'Telemetry table not found.'})
                    else:
                        return build_response(500, {'error': 'Failed to retrieve telemetry history.'})
                except Exception as e:
                    logger.error(
                        f"Unexpected error during telemetry query: {str(e)}")
                    return build_response(500, {'error': 'Failed to retrieve telemetry history.'})

            # ENQUIRY: Global System Snapshot (All Panels + Logs)
            elif query_params.get('enquiry') == 'snapshot':
                try:
                    logger.info("Starting system snapshot retrieval")
                    all_panels = TABLE_METADATA.scan().get('Items', [])
                    snapshot = []

                    for panel in all_panels:
                        p_id = panel.get('panel_id')
                        if not p_id:
                            logger.warning(
                                f"Panel found without panel_id: {panel}")
                            continue

                        try:
                            # Pull latest 5 logs for each panel
                            logs = TABLE_TELEMETRY.query(
                                KeyConditionExpression=Key(
                                    'meter_id').eq(p_id),
                                ScanIndexForward=False,
                                Limit=5
                            ).get('Items', [])

                            snapshot.append({
                                'metadata': panel,
                                'recent_logs': logs
                            })
                        except ClientError as e:
                            logger.warning(
                                f"Failed to get logs for panel {p_id}: {str(e)}")
                            snapshot.append({
                                'metadata': panel,
                                'recent_logs': [],
                                'error': 'Failed to retrieve recent logs'
                            })

                    logger.info(
                        f"System snapshot completed with {len(snapshot)} panels")
                    return build_response(200, snapshot)

                except ClientError as e:
                    error_code = e.response['Error']['Code']
                    logger.error(
                        f"DynamoDB scan failed for snapshot - Code: {error_code}")
                    return build_response(500, {'error': 'Failed to retrieve system snapshot.'})
                except Exception as e:
                    logger.error(f"Unexpected error during snapshot: {str(e)}")
                    return build_response(500, {'error': 'Failed to retrieve system snapshot.'})

            # Standard Logic: Single Panel Metadata
            else:
                is_valid, error_msg = validate_panel_id(
                    panel_id, 'metadata retrieval')
                if not is_valid:
                    return build_response(400, {'error': error_msg})

                try:
                    logger.info(
                        f"Retrieving metadata for panel_id: {panel_id}")
                    res = TABLE_METADATA.get_item(Key={'panel_id': panel_id})
                    item = res.get('Item', {})
                    if not item:
                        return build_response(404, {'error': f'Panel {panel_id} not found.'})
                    return build_response(200, item)

                except ClientError as e:
                    error_code = e.response['Error']['Code']
                    logger.error(
                        f"DynamoDB get_item failed - Code: {error_code}")

                    if error_code == 'ResourceNotFoundException':
                        return build_response(404, {'error': 'Panel metadata table not found.'})
                    else:
                        return build_response(500, {'error': 'Failed to retrieve panel metadata.'})
                except Exception as e:
                    logger.error(
                        f"Unexpected error during metadata retrieval: {str(e)}")
                    return build_response(500, {'error': 'Failed to retrieve panel metadata.'})

        # ==========================================
        # POST/PUT: PROVISIONING (Admin Only)
        # ==========================================
        elif method in ['POST', 'PUT']:
            # Validate required fields
            if not body:
                return build_response(400, {'error': 'Request body is required.'})

            panel_id_from_body = body.get('panel_id')
            is_valid, error_msg = validate_panel_id(
                panel_id_from_body, 'panel creation/update')
            if not is_valid:
                return build_response(400, {'error': error_msg})

            try:
                logger.info(f"Creating/updating panel: {panel_id_from_body}")
                TABLE_METADATA.put_item(Item=body)
                return build_response(201, {'message': 'Command Executed: Panel Synchronized.'})

            except ClientError as e:
                error_code = e.response['Error']['Code']
                logger.error(f"DynamoDB put_item failed - Code: {error_code}")

                if error_code == 'ValidationException':
                    return build_response(400, {'error': 'Invalid panel data format.'})
                elif error_code == 'ResourceNotFoundException':
                    return build_response(404, {'error': 'Panel metadata table not found.'})
                else:
                    return build_response(500, {'error': 'Failed to create/update panel.'})
            except Exception as e:
                logger.error(
                    f"Unexpected error during panel creation/update: {str(e)}")
                return build_response(500, {'error': 'Failed to create/update panel.'})

        # ==========================================
        # PATCH: SURGICAL UPDATE (Admin Only)
        # ==========================================
        elif method == 'PATCH':
            is_valid, error_msg = validate_panel_id(panel_id, 'patch updates')
            if not is_valid:
                return build_response(400, {'error': error_msg})

            if not body:
                return build_response(400, {'error': 'Request body with update fields is required.'})

            update_expr = []
            attr_names = {}
            attr_values = {}

            i = 0
            for k, v in body.items():
                if k == 'panel_id':
                    continue

                name_token = f"#n{i}"
                value_token = f":v{i}"
                attr_names[name_token] = k
                attr_values[value_token] = v
                update_expr.append(f"{name_token} = {value_token}")
                i += 1

            if not update_expr:
                return build_response(400, {'error': 'No valid fields provided to update.'})

            try:
                logger.info(f"Patching panel: {panel_id}")
                TABLE_METADATA.update_item(
                    Key={'panel_id': panel_id},
                    UpdateExpression="SET " + ", ".join(update_expr),
                    ExpressionAttributeNames=attr_names,
                    ExpressionAttributeValues=attr_values
                )
                return build_response(200, {'message': 'Operational state patched.'})

            except ClientError as e:
                error_code = e.response['Error']['Code']
                logger.error(
                    f"DynamoDB update_item failed - Code: {error_code}")

                if error_code == 'ResourceNotFoundException':
                    return build_response(404, {'error': f'Panel {panel_id} not found.'})
                elif error_code == 'ValidationException':
                    return build_response(400, {'error': 'Invalid update data format.'})
                else:
                    return build_response(500, {'error': 'Failed to update panel.'})
            except Exception as e:
                logger.error(f"Unexpected error during panel patch: {str(e)}")
                return build_response(500, {'error': 'Failed to update panel.'})

        # ==========================================
        # DELETE: DECOMMISSION (Admin Only)
        # ==========================================
        elif method == 'DELETE':
            is_valid, error_msg = validate_panel_id(panel_id, 'deletion')
            if not is_valid:
                return build_response(400, {'error': error_msg})

            try:
                logger.info(
                    f"Checking existence of panel before deletion: {panel_id}")
                # Check if panel exists before deletion
                res = TABLE_METADATA.get_item(Key={'panel_id': panel_id})
                if not res.get('Item'):
                    return build_response(404, {'error': f'Panel {panel_id} not found.'})

                logger.info(f"Deleting panel: {panel_id}")
                TABLE_METADATA.delete_item(Key={'panel_id': panel_id})
                return build_response(200, {'message': 'Panel decommissioned and purged.'})

            except ClientError as e:
                error_code = e.response['Error']['Code']
                logger.error(
                    f"DynamoDB delete_item failed - Code: {error_code}")

                if error_code == 'ResourceNotFoundException':
                    return build_response(404, {'error': 'Panel metadata table not found.'})
                else:
                    return build_response(500, {'error': 'Failed to delete panel.'})
            except Exception as e:
                logger.error(
                    f"Unexpected error during panel deletion: {str(e)}")
                return build_response(500, {'error': 'Failed to delete panel.'})

        else:
            return build_response(405, {'error': 'Method Not Allowed'})

    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return build_response(500, {'error': 'Internal server error occurred.'})
