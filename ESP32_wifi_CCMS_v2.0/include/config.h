#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// WiFi Credentials
extern const char* ssid;
extern const char* password;

// MQTT Configuration
extern const char* mqtt_server;
extern const int mqtt_port;
extern const char* mqtt_client_id;
extern const char* mqtt_topic;

// Pin Definitions
#define RX2_PIN 16
#define TX2_PIN 17

// Modbus & MQTT Configuration
extern bool useByteSwap;

extern uint16_t mqttRegisters[];
extern const int numMqttRegs;
extern float mqttValues[];

extern unsigned long lastMqttPublish;
extern const unsigned long mqttPublishInterval;

#endif
