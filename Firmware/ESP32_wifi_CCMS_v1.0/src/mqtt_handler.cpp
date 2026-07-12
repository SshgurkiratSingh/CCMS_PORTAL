#include "mqtt_handler.h"
#include <WiFi.h>
#include <ArduinoJson.h>
#include "config.h"

extern WiFiClient espClient;
PubSubClient mqttClient(espClient);

void setupMQTT() {
  mqttClient.setServer(mqtt_server, mqtt_port);
}

void handleMQTTConnection() {
  if (!mqttClient.connected()) {
    if (mqttClient.connect(mqtt_client_id)) {
    } else {
      delay(500);
    }
  }
}

void publishMqttData() {
  StaticJsonDocument<384> doc;

  doc["timestamp"] = millis();
  doc["swap_mode"] = useByteSwap ? "little" : "big";

  for (int i = 0; i < numMqttRegs; i++) {
    char regKey[12];
    snprintf(regKey, sizeof(regKey), "R%u", (unsigned)mqttRegisters[i]);
    doc[regKey] = mqttValues[i];
  }

  String payload;
  serializeJson(doc, payload);

  if (mqttClient.connected()) {
    mqttClient.publish(mqtt_topic, payload.c_str());
    Serial.println("=== MQTT DATA PUBLISHED ===");
    Serial.println(payload);
  }
}
