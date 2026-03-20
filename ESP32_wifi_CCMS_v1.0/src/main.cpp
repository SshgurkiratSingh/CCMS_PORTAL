#include <Arduino.h>
#include <WiFi.h>
#include "config.h"
#include "wifi_handler.h"
#include "mqtt_handler.h"
#include "meter_handler.h"

WiFiClient espClient;

void setup() {
  Serial.begin(115200);
  delay(50);

  setupMeter();

  for (int i = 0; i < numMqttRegs; ++i)
    mqttValues[i] = 0.0f;

  setupWiFi();
  setupMQTT();

  Serial.println("\n--- Multifunction Meter Dashboard with MQTT ---");
  Serial.println("Commands: START [start] [end] | SWAP | STOP");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  handleMQTTConnection();
  mqttClient.loop();

  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();

    if (cmd.startsWith("START")) {
      int firstSpace = cmd.indexOf(' ');
      int lastSpace = cmd.lastIndexOf(' ');
      if (firstSpace != -1 && lastSpace != -1 && lastSpace > firstSpace) {
        startAddr = cmd.substring(firstSpace + 1, lastSpace).toInt();
        endAddr = cmd.substring(lastSpace + 1).toInt();
        isScanning = true;
        Serial.print("\033[2J\033[H");
      }
    } else if (cmd == "STOP") {
      isScanning = false;
      Serial.println("\n--- SCAN STOPPED ---");
    } else if (cmd == "SWAP") {
      useByteSwap = !useByteSwap;
      Serial.print("\033[H\033[K");
      Serial.print(">>> Word-swap toggled. Current Mode: ");
      Serial.println(useByteSwap ? "LOW-HIGH (swap ON)" : "HIGH-LOW (swap OFF)");
      delay(500);
    }
  }

  readMqttRegisters();

  if (millis() - lastMqttPublish >= mqttPublishInterval) {
    publishMqttData();
    lastMqttPublish = millis();
  }

  if (isScanning) {
    updateDashboard();
  }
}
