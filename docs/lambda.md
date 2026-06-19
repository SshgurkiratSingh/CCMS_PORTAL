# Lambda Backend

Python AWS Lambda functions deployed behind API Gateway that handle REST API endpoints, authentication, and SQS-based telemetry ingestion for the CCMS system.

---

## Lambda Inventory

| Function | File | Trigger | Purpose |
|----------|------|---------|---------|
| **API Lambda** | `Lambda/lambdaAPI.py` | API Gateway (HTTP) | REST API for dashboard snapshot, panel status, history, provisioning, and commands |
| **Ingestion Lambda** | `Lambda/saveDataFromSQStoDB,py` | SQS | Writes incoming telemetry from edge devices into DynamoDB |

---

## API Lambda (`lambdaAPI.py`)

### Initialization

On cold start, the Lambda creates:

- **SSM client** — for retrieving auth keys from Parameter Store
- **DynamoDB resource** — connected to `MeterTelemetry` and `PanelMetadata` tables
- **IoT Data client** — for publishing MQTT commands to AWS IoT Device Shadow

### Security Model

Two-level key-based authentication using AWS SSM Parameter Store:

| Level | Key | SSM Parameter | Required For |
|-------|-----|---------------|--------------|
| 1 — Dashboard | `x-dashboard-key` | `/api/dashboard_key` | All requests |
| 2 — Admin | `x-admin-key` | `/api/admin_key` | Mutations (POST, PUT, PATCH, DELETE) |

Keys are validated on every request. Invalid/missing keys return `401` (dashboard) or `403` (admin).

### CORS

Always returns permissive headers:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, x-dashboard-key, x-admin-key, Authorization
Access-Control-Allow-Methods: OPTIONS, GET, POST, PUT, PATCH, DELETE
```

`OPTIONS` preflight requests return `200`.

### API Endpoints

#### `GET` — Read Operations

| Query | Required Params | Description | Response |
|-------|----------------|-------------|----------|
| `?enquiry=snapshot` | None | Scans all `PanelMetadata` + latest 5 telemetry records per panel | `[{ metadata, recent_logs }]` |
| `?enquiry=history` | `panel_id`, `start`, `end` | Queries `MeterTelemetry` by meter ID and timestamp range | `[{ ...telemetry fields }]` |
| *(no enquiry)* | `panel_id` | Gets single panel metadata from `PanelMetadata` | `{ ...panel fields }` |

**Snapshot Endpoint** (`?enquiry=snapshot`):

1. Performs `scan()` on `PanelMetadata` table
2. For each panel, queries `MeterTelemetry` with `ScanIndexForward=False` and `Limit=5`
3. Returns combined array of `{ metadata, recent_logs }`

**History Endpoint** (`?enquiry=history`):

1. Validates panel_id (required, non-empty)
2. Validates timestamps (non-negative integers, start ≤ end)
3. Timestamps are zero-padded to 13 digits for lexicographic DynamoDB sort key matching
4. Queries `MeterTelemetry` by `meter_id` and `timestamp` range with `ScanIndexForward=True`

#### `POST` / `PUT` — Provisioning (Admin Only)

- Requires request body with `panel_id`
- Writes entire item to `PanelMetadata` via `put_item()`
- Returns `201` on success

#### `PATCH` — Surgical Updates (Admin Only)

Handles three command types:

| Command Type | Body Fields | Behavior |
|-------------|-------------|----------|
| **Relay Control** | `{ desired_state: true/false }` | Updates DynamoDB + publishes MQTT `relay_state` to shadow |
| **Schedule Update** | `{ schedule: { startLocalTime, endLocalTime } }` | Updates DynamoDB + publishes MQTT schedule to shadow |
| **Shadow Keys** | `{ relay_state, device_state, timeToAutoTurnOn, timeToAutoTurnOff }` | Updates DynamoDB + publishes all shadow keys via MQTT |

MQTT commands are published to `$aws/things/{device_id}/shadow/update` with the format:

```json
{
  "state": {
    "desired": {
      "relay_state": true
    }
  }
}
```

The function resolves `device_id` from the `PanelMetadata` table or falls back to the panel ID.

#### `DELETE` — Decommission (Admin Only)

- Validates panel exists (returns `404` if not found)
- Deletes item from `PanelMetadata` via `delete_item()`
- Returns `200` on success

### Error Handling

| Scenario | HTTP Status |
|----------|-------------|
| Malformed JSON body | `400` |
| Missing/invalid panel_id | `400` |
| Invalid timestamps | `400` |
| Panel not found | `404` |
| Missing dashboard key | `401` |
| Missing admin key (on mutation) | `403` |
| DynamoDB `ValidationException` | `400` |
| DynamoDB `ResourceNotFoundException` | `404` |
| General DynamoDB error | `500` |
| Catch-all exception | `500` |

### JSON Serialization

Uses a custom `DecimalEncoder` class to convert DynamoDB `Decimal` types to `float` for JSON-compatible output.

---

## Ingestion Lambda (`saveDataFromSQStoDB.py`)

### Trigger

- Event source: **SQS queue** (messages from AWS IoT Rules Engine)
- Batch processing: iterates all records in the SQS event

### Record Processing

For each SQS message:

1. **Parse JSON** — loads payload with `parse_float=Decimal` for DynamoDB compatibility
2. **Resolve partition key** — `meter_id = payload.client_id` (falls back to `UNKNOWN_METER`)
3. **Resolve sort key** — `timestamp = int(payload.server_time)` (falls back to `payload.timestamp` or `0`)
4. **Build item** — copies all remaining payload fields into the DynamoDB item
5. **Write** — `put_item()` into `MeterTelemetry` table

### Partial Batch Failure

- On any record-level exception, logs the error and appends `messageId` to `batchItemFailures`
- Failed messages remain in SQS for retry (up to the queue's configured max retries)
- Successful records are removed from the queue

### DynamoDB Schema

**`MeterTelemetry`** table:

| Attribute | Key Type | Source | Notes |
|-----------|----------|--------|-------|
| `meter_id` | Partition Key | `payload.client_id` | String |
| `timestamp` | Sort Key | `payload.server_time` | Integer (epoch ms) |
| *(all other fields)* | - | Copied from payload | Modbus registers, status fields, etc. |

**`PanelMetadata`** table:

| Attribute | Key Type | Source | Notes |
|-----------|----------|--------|-------|
| `panel_id` | Partition Key | Body/query parameter | String |
| *(all other fields)* | - | From API request | Location, status, config, etc. |

---

## IAM Permissions Required

Both Lambdas require:

- `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, `dynamodb:Query`, `dynamodb:Scan` on target tables
- `ssm:GetParameters` on `/api/dashboard_key` and `/api/admin_key` (API Lambda only)
- `iotdata:Publish` on IoT topics (API Lambda only, for MQTT commands)

---

## Local Testing

A Node.js test script is provided at `Lambda/TestEndpoints/getData.js`:

```bash
cd Lambda/TestEndpoints
npm install
node getData.js
```

This script demonstrates authenticated API calls to the deployed Lambda endpoints.