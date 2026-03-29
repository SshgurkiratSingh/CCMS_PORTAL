import json
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key

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
    except Exception as e:
        print(f"VAULT ACCESS FAULT: {str(e)}")
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


def lambda_handler(event, context):
    # 1. PARAMETER EXTRACTION
    method = event.get('httpMethod') or event.get(
        'requestContext', {}).get('http', {}).get('method')

    if method == 'OPTIONS':
        return build_response(200, '')

    headers = {k.lower(): v for k, v in (event.get('headers') or ) or {}).items()}
        query_params = event.get('queryStringParameters') or {}

        # 2. DUAL-KEY AUTHENTICATION BARRICADE
        dash_key, admin_key = get_vault_keys()
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
    body = json.loads(event.get('body', '{}'), parse_float=Decimal)
        except:
    body = {}

        panel_id = query_params.get('panel_id') or body.get('panel_id')

        try:
        # ==========================================
        # GET: READ / SYSTEM SNAPSHOT
        # ==========================================
    if method == 'GET':
            # ENQUIRY: Historical Telemetry
    if query_params.get('enquiry') == 'history':
    p_id = query_params.get('panel_id')
                if not p_id:
    return build_response(400, {'error': 'panel_id is required for history.'})

                try:
    start_ts = int(query_params.get('start', 0))
                    # Default far future
                    end_ts= int(query_params.get('end', 2147483647000))
                except ValueError:
    return build_response(400, {'error': 'start and end must be integer timestamps.'})

                logs= TABLE_TELEMETRY.query(
                    KeyConditionExpression =Key('meter_id').eq(p_id) & Key(
                        'timestamp').between(start_ts, end_ts),
                    ScanIndexForward = True
                ).get('Items', [])
                    return build_response(200, logs)

                # ENQUIRY: Global System Snapshot (All Panels + Logs)
                if query_params.get('enquiry') == 'snapshot':
                all_panels= TABLE_METADATA.scan().get('Items', [])
                snapshot= []

                for panel in all_panels:
                p_id = panel['panel_id']
                    # Pull latest 5 logs for each panel
                    logs= TABLE_TELEMETRY.query(
                        KeyConditionExpression = Key('meter_id').eq(p_id),
                        ScanIndexForward = False,
                        Limit = 5
                    ).get('Items', [])

                        snapshot.append({
                        'metadata': panel,
                        'recent_logs': logs
                    })
                    return build_response(200, snapshot)

                    # Standard Logic: Single Panel Metadata
                    res = TABLE_METADATA.get_item(Key={'panel_id': panel_id})
                    return build_response(200, res.get('Item', {}))

                    # ==========================================
                    # POST/PUT: PROVISIONING (Admin Only)
                    # ==========================================
                    elif method in ['POST', 'PUT']:
            TABLE_METADATA.put_item(Item=body)
                    return build_response(201, {'message': 'Command Executed: Panel Synchronized.'})

                    # ==========================================
                    # PATCH: SURGICAL UPDATE (Admin Only)
                    # ==========================================
                    elif method == 'PATCH':
            update_expr= []
                    attr_names = {}
                    attr_values = {}

                    for k, v in body.items():
                if k == 'panel_id':
                    continue
                    update_expr.append(f"#{k} = :{k}")
                    attr_names[f"#{k}"] = k
                    attr_values[f":{k}"] = v

                    TABLE_METADATA.update_item(
                Key = {'panel_id': panel_id},
                UpdateExpression = "SET " + ", ".join(update_expr),
                ExpressionAttributeNames = attr_names,
                ExpressionAttributeValues = attr_values
            )
                return build_response(200, {'message': 'Operational state patched.'})

            # ==========================================
            # DELETE: DECOMMISSION (Admin Only)
            # ==========================================
            elif method == 'DELETE':
            TABLE_METADATA.delete_item(Key={'panel_id': panel_id})
            return build_response(200, {'message': 'Panel decommissioned and purged.'})

            except Exception as e:
            return build_response(500, {'error': str(e)})

            return build_response(405, 'Method Not Allowed')
