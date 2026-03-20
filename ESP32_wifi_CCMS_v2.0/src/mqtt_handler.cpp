#include "mqtt_handler.h"
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "config.h"
#include "aws_certs.h"

extern WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

void setupMQTT()
{
  espClient.setCACert(aws_root_ca);
  espClient.setCertificate(aws_cert);
  espClient.setPrivateKey(aws_private_key);

  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setBufferSize(2048);
}

void handleMQTTConnection()
{
  static unsigned long lastReconnectAttempt = 0;
  if (!mqttClient.connected())
  {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > 5000 || lastReconnectAttempt == 0)
    {
      lastReconnectAttempt = now;
      Serial.print("Attempting MQTT connection...");
      if (mqttClient.connect(mqtt_client_id))
      {
        Serial.println("connected");
        lastReconnectAttempt = 0;
      }
      else
      {
        Serial.print("failed, rc=");
        Serial.print(mqttClient.state());
        Serial.println(" try again in 5 seconds");
      }
    }
  }
}

void publishMqttData()
{
  StaticJsonDocument<384> doc;

  doc["timestamp"] = millis();
  // sending client ID as part of payload for easier debugging in AWS IoT console
  doc["client_id"] = mqtt_client_id;

  for (int i = 0; i < numMqttRegs; i++)
  {
    char regKey[12];
    snprintf(regKey, sizeof(regKey), "R%u", (unsigned)mqttRegisters[i]);
    doc[regKey] = mqttValues[i];
  }

  String payload;
  serializeJson(doc, payload);

  if (mqttClient.connected())
  {
    char telemetry_topic[128];
    snprintf(telemetry_topic, sizeof(telemetry_topic), "meter/telemetry/%s", mqtt_client_id);

    if (mqttClient.publish(telemetry_topic, payload.c_str()))
    {
      Serial.println("=== MQTT DATA PUBLISHED ===");
      Serial.println(payload);
    }
    else
    {
      Serial.print("=== MQTT PUBLISH FAILED === rc=");
      Serial.println(mqttClient.state());
    }
  }
}
