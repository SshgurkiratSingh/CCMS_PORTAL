#include "config.h"

const char* ssid = "Airtel_Node";
const char* password = "air66343";

const char* mqtt_server = "192.168.1.14";
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32_Meter";
const char* mqtt_topic = "meter/registers";

bool isScanning = false;
bool useByteSwap = false;
uint16_t startAddr = 0;
uint16_t endAddr = 0;

uint16_t mqttRegisters[] = {3009, 3011, 3027, 3035, 3055, 3059, 3061, 3085, 3109, 3053, 3057, 3063, 3083, 3107, 3059, 3059, 3107};
const int numMqttRegs = sizeof(mqttRegisters) / sizeof(mqttRegisters[0]);
float mqttValues[17]; // Size matching numMqttRegs

unsigned long lastMqttPublish = 0;
const unsigned long mqttPublishInterval = 5000;
