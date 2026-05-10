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
#define I2C_SDA 21
#define I2C_SCL 22

// New Sensors & I/O
#define RELAY_PIN 14
#define BAT_ADC_PIN 34
#define MAINS_ADC_PIN 35
#define TILT_SW_PIN 15
#define DHT_PIN 4
#define DHT_TYPE 11 // DHT11

// OLED, Button, LEDs & Bridge UART
#define BUTTON_PIN 32
#define LED1_PIN 25
#define LED2_PIN 26
#define LED3_PIN 27
#define BRIDGE_TX 13
#define BRIDGE_RX 12

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

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

// Display helper
void displayStatusMessage(String msg);

#endif
