#include "config.h"

// ─── WiFi ────────────────────────────────────────────────────────────────────
// Populated from v1.0 deployment (Airtel_Node hotspot)
const char *ssid     = "Airtel_Node";
const char *password = "air66343";

// ─── AWS IoT Core ─────────────────────────────────────────────────────────────
// These must match the AWS IoT Thing and the backend's meter_id partition key.
const char *mqtt_server    = "a3ia5opqzsvf3l-ats.iot.us-east-1.amazonaws.com";
const int   mqtt_port      = 8883;
const char *mqtt_client_id = "Meter_001";
const char *mqtt_topic     = "meter/telemetry/Meter_001";

// AWS IoT Device Shadow topics (derived from client_id above)
const char *SHADOW_DELTA_TOPIC  = "$aws/things/Meter_001/shadow/update/delta";
const char *SHADOW_UPDATE_TOPIC = "$aws/things/Meter_001/shadow/update";

// ─── Device State Vectors ─────────────────────────────────────────────────────
bool   currentRelayState  = false;      // relay OFF on boot
String currentDeviceState = "IDLE";
String autoOnTime         = "18:00";    // default auto-on (6 PM)
String autoOffTime        = "06:00";    // default auto-off (6 AM)
int    currentFaultCode   = 0;

// ─── Modbus / MQTT ────────────────────────────────────────────────────────────
// Register list carried forward from v1.0 (full set of 17 Schneider registers)
bool useByteSwap = false;

uint16_t mqttRegisters[] = {
    3009,  // Avg Current
    3011,
    3027,  // Phase 1 Voltage
    3035,  // Avg Voltage
    3053,  // Total Power Factor
    3055,
    3057,
    3059,  // PF Phase 1
    3061,
    3063,
    3083,  // Power Vector
    3085,
    3107,
    3109,  // Grid Frequency
    3059,  // (duplicate — kept for v1.0 compatibility)
    3059,
    3107
};
const int numMqttRegs = sizeof(mqttRegisters) / sizeof(mqttRegisters[0]); // 17
float     mqttValues[17] = {0};

// ─── Publish Timing ───────────────────────────────────────────────────────────
// v1.0 used 5 000 ms; v3.0 keeps the same rate
unsigned long       lastMqttPublish     = 0;
const unsigned long mqttPublishInterval = 5000;
