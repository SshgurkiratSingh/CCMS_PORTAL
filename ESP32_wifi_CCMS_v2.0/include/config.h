#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// WiFi Credentials
extern const char *ssid;
extern const char *password;

// MQTT Configuration
extern const char *mqtt_server;
extern const int mqtt_port;
extern const char *mqtt_client_id;
extern const char *mqtt_topic;

// Pin Definitions
#define RX2_PIN 16
#define TX2_PIN 17

// New Sensors & I/O
#define RELAY_PIN 14
#define BAT_ADC_PIN 34
#define MAINS_ADC_PIN 35
#define TILT_SW_PIN 15
#define DHT_PIN 4
#define DHT_TYPE 11 // DHT11

// AWS Shadow Topics
extern const char *SHADOW_DELTA_TOPIC;
extern const char *SHADOW_UPDATE_TOPIC;

// GLOBAL STATE VECTORS
extern bool currentRelayState;
extern String currentDeviceState;
extern String autoOnTime;
extern String autoOffTime;
extern int currentFaultCode;

// NEW SENSOR STATES
extern float batteryVoltage;
extern float mainsRaw;
extern int tiltSwitchState;
extern float currentTemp;

// Modbus & MQTT Configuration
extern bool useByteSwap;

extern uint16_t mqttRegisters[];
extern const int numMqttRegs;
extern float mqttValues[];

extern unsigned long lastMqttPublish;
extern const unsigned long mqttPublishInterval;

#endif
