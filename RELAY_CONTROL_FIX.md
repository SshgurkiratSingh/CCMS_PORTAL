# CCMS Panel v2.0 WiFi Relay Control Fix

## Problem Summary

The CCMS Panel v2.0 WiFi panel was not executing relay state changes when commands were dispatched from the frontend. The Lambda function was only updating DynamoDB metadata but not sending commands to the actual device.

## Root Cause

The Lambda function (`lambdaAPI.py`) was missing the MQTT communication layer to push commands to AWS IoT. When the frontend sent a `SET_MANUAL_STATE` command:

1. ✅ Frontend sent `desired_state` to Lambda
2. ✅ Lambda stored `desired_state` in DynamoDB
3. ❌ **No MQTT message sent to device**
4. ❌ **Relay never actuated**

## Solution Implemented

### 1. Lambda Function Updates (`Lambda/lambdaAPI.py`)

Added three new functions:

#### `get_panel_device_id(panel_id)`
- Retrieves the device_id/MQTT client ID from DynamoDB
- Falls back to panel_id if device_id not found

#### `publish_mqtt_command(panel_id, command_type, state_value)`
- Publishes commands to AWS IoT MQTT topics
- Uses AWS IoT Device Shadow format
- Topic format: `$aws/things/{device_id}/shadow/update`
- Payload format:
```json
{
  "state": {
    "desired": {
      "relayState": "ON"
    }
  }
}
```

#### `update_panel_state_in_db(panel_id, state_updates)`
- Updates panel state in DynamoDB
- Returns success/failure status

#### Modified PATCH Handler
The PATCH endpoint now handles relay control commands:

```python
elif method == 'PATCH':
    # Check for relay control commands
    desired_state = body.get('desired_state')
    schedule = body.get('schedule')
    
    # Handle relay state control
    if desired_state is not None:
        state_value = str(desired_state).upper()
        
        # Update DynamoDB
        db_update_success = update_panel_state_in_db(panel_id, {
            'desired_state': state_value
        })
        
        # Publish to MQTT for actual device control
        mqtt_success = publish_mqtt_command(panel_id, 'relayState', state_value)
        
        return build_response(200, {
            'message': f'Relay {state_value} command dispatched',
            'panel_id': panel_id,
            'desired_state': state_value,
            'accepted': True,
            'requestId': f"CMD-{panel_id}-{id(body)}"
        })
```

### 2. Frontend API Updates (`ccms/lib/api/ccms-api.ts`)

Updated `postPanelCommand` to properly handle Lambda response:

```typescript
export async function postPanelCommand(
  panelId: string,
  payload: PanelCommandPayload
): Promise<PanelCommandResult> {
  let patchBody: any = { panel_id: panelId };
  
  if (payload.action === "SET_MANUAL_STATE") {
    patchBody.desired_state = payload.manualState;
  } else if (payload.action === "UPDATE_RTC_SCHEDULE") {
    patchBody.schedule = payload.schedule;
  }

  const response = await apiRequest<any>(`DashboardAPIHandler`, {
    method: "PATCH",
    body: patchBody,
  });

  return {
    requestId: response.requestId || Math.random().toString(36).slice(2),
    accepted: response.accepted ?? true,
    updatedDesiredAtUtc: new Date().toISOString(),
    message: response.message || "Command dispatched successfully",
  };
}
```

## How It Works Now

### Relay Control Flow

```
Frontend (panel/page.tsx)
    ↓ User clicks "Dispatch" button
    ↓ sendManualCommand() called
    ↓ postPanelCommand(panelId, { action: "SET_MANUAL_STATE", manualState: "ON" })
    ↓
Backend (Lambda)
    ↓ Lambda receives PATCH request with desired_state: "ON"
    ↓ update_panel_state_in_db() - Update DynamoDB
    ↓ publish_mqtt_command() - Publish to MQTT topic
    ↓ Return success response with requestId
    ↓
Device (WiFi Panel)
    ↓ MQTT message received
    ↓ Device Shadow parsed
    ↓ relayState = "ON" extracted
    ↓ GPIO pin set HIGH
    ↓ Relay actuates
    ↓ Device reports new state via telemetry
```

### MQTT Topic Structure

- **Command Topic**: `$aws/things/{device_id}/shadow/update`
- **Payload Format**:
```json
{
  "state": {
    "desired": {
      "relayState": "ON",
      "schedule": {
        "startLocalTime": "18:00",
        "endLocalTime": "06:00"
      }
    }
  }
}
```

## Required AWS IoT Configuration

For this to work, ensure:

1. **IoT Thing Created**: Each panel must have an IoT Thing with the same ID as `device_id` in DynamoDB

2. **Thing Shadow Schema**: Device shadows should accept `relayState` in desired/reported state

3. **MQTT Permissions**: Lambda execution role must have:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Publish"
      ],
      "Resource": "arn:aws:iot:REGION:ACCOUNT_ID:*"
    }
  ]
}
```

4. **Environment Variable**: Set `IOT_THING_NAME` in Lambda if device IDs differ from thing names

## Testing

### Manual Test Steps

1. Open panel page: `/panel?id=YOUR_PANEL_ID`
2. Click "ON" or "OFF" button
3. Click "Dispatch"
4. Check browser console for success message
5. Verify Lambda logs show MQTT publish success
6. Check device is actuating (listen for relay click)
7. Refresh page to see updated state

### Expected Response

```json
{
  "message": "Relay ON command dispatched",
  "panel_id": "METER-105",
  "desired_state": "ON",
  "accepted": true,
  "requestId": "CMD-METER-105-abc123"
}
```

## Files Modified

1. **Lambda/lambdaAPI.py** - Added MQTT publishing and relay control logic
2. **ccms/lib/api/ccms-api.ts** - Updated to handle Lambda response properly

## Deployment Checklist

- [ ] Update Lambda function code in AWS Console
- [ ] Add IoT permissions to Lambda execution role
- [ ] Set `IOT_THING_NAME` environment variable (if needed)
- [ ] Verify IoT Thing exists for each panel
- [ ] Test relay control from frontend
- [ ] Check CloudWatch logs for any errors

## Troubleshooting

### Lambda logs show MQTT publish failed

1. Check IoT permissions on Lambda role
2. Verify IoT Thing exists with matching name
3. Check MQTT topic format

### Device doesn't respond

1. Verify device is connected to MQTT
2. Check device shadow is being updated
3. Verify device code subscribes to shadow update topic
4. Check device logs for relay control code

### Frontend shows success but device doesn't change

1. Check Lambda logs for MQTT publish success
2. Verify device is subscribed to correct topic
3. Check network connectivity to AWS IoT
