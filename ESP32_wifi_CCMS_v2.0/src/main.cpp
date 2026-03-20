#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "config.h"
#include "wifi_handler.h"
#include "mqtt_handler.h"
#include "meter_handler.h"

WiFiClientSecure espClient;

void setup() {
  Serial.begin(115200);
  delay(50);

  setupMeter();

  for (int i = 0; i < numMqttRegs; ++i)
    mqttValues[i] = 0.0f;

  setupWiFi();
  setupMQTT();

  Serial.println("\n--- Multifunction Meter MQTT Publisher Started ---");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  handleMQTTConnection();
  mqttClient.loop();

  readMqttRegisters();

  if (millis() - lastMqttPublish >= mqttPublishInterval) {
    publishMqttData();
    lastMqttPublish = millis();
  }
}
