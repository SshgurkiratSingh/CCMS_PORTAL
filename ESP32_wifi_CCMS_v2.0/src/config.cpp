#include "config.h"

const char *ssid = "Airtel_Node";
const char *password = "air66343";

const char *mqtt_server = "a3ia5opqzsvf3l-ats.iot.us-east-1.amazonaws.com";
const int mqtt_port = 8883;
const char *mqtt_client_id = "Meter_001";
const char *mqtt_topic = "meter/telemetry/";

bool useByteSwap = false;

uint16_t mqttRegisters[] = {3003,3009, 3027, 3035, 3059, 3109, 3053, 3083, 3059, 3059};
const int numMqttRegs = sizeof(mqttRegisters) / sizeof(mqttRegisters[0]);
float mqttValues[17]; // Size matching numMqttRegs

unsigned long lastMqttPublish = 0;
const unsigned long mqttPublishInterval = 25000;
