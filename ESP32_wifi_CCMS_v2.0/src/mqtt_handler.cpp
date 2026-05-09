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
  mqttClient.setCallback(mqttCallback);
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
      displayStatusMessage("MQTT Connecting...");
      if (mqttClient.connect(mqtt_client_id))
      {
        Serial.println("connected");
        displayStatusMessage("MQTT Connected.");
        mqttClient.subscribe(SHADOW_DELTA_TOPIC);
        Serial.println("Subscribed to Shadow Delta Topic");
        mqttClient.subscribe(SHADOW_UPDATE_TOPIC);
        Serial.println("Subscribed to Shadow Update Topic");
        lastReconnectAttempt = 0;
        delay(1000);
      }
      else
      {
        Serial.print("failed, rc=");
        Serial.print(mqttClient.state());
        Serial.println(" try again in 5 seconds");
        displayStatusMessage("MQTT Failed.");
      }
    }
  }
}

void publishMqttData()
{
  JsonDocument doc;

  doc["timestamp"] = millis();
  // sending client ID as part of payload for easier debugging in AWS IoT console
  doc["client_id"] = mqtt_client_id;

  // New Sensors
  doc["batteryVoltage"] = batteryVoltage;
  doc["mainsVoltageRaw"] = mainsRaw;
  doc["mainsStatus"] = (mainsRaw > 500) ? "ON" : "OFF"; // Basic threshold logic
  doc["tiltSwitch"] = tiltSwitchState;
  doc["temperature"] = currentTemp;

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

      // Secondary Bridge Output
      Serial1.println(payload);

      // Toggle Telemetry Indication LED (Flash on publish)
      digitalWrite(LED3_PIN, !digitalRead(LED3_PIN));
    }
    else
    {
      Serial.print("=== MQTT PUBLISH FAILED === rc=");
      Serial.println(mqttClient.state());
    }

    // Publish Device Shadow
    JsonDocument shadowDoc;
    JsonObject state = shadowDoc["state"].to<JsonObject>();
    JsonObject reported = state["reported"].to<JsonObject>();
    reported["relay_state"] = currentRelayState;
    reported["device_state"] = currentDeviceState;
    reported["timeToAutoTurnOn"] = autoOnTime;
    reported["timeToAutoTurnOff"] = autoOffTime;
    reported["fault_code"] = currentFaultCode;

    String shadowPayload;
    serializeJson(shadowDoc, shadowPayload);
    mqttClient.publish(SHADOW_UPDATE_TOPIC, shadowPayload.c_str());
    Serial.println("=== SHADOW UPDATE PUBLISHED ===");

    // Output shadow data to the UART1 Bridge as well
    Serial1.println(shadowPayload);
  }
}
