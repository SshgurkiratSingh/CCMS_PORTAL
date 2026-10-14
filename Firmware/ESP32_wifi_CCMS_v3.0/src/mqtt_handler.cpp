#include "mqtt_handler.h"
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>
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
        mqttClient.subscribe(SHADOW_UPDATE_TOPIC);
        lastReconnectAttempt = 0;
        delay(1000);
      }
      else
      {
        Serial.printf("failed, rc=%d — retry in 5 s\n", mqttClient.state());
        displayStatusMessage("MQTT Failed.");
      }
    }
  }
}

void publishMqttData()
{
  JsonDocument doc;

  // v3.0: use Unix timestamp from ESP32's SNTP-synced internal clock
  time_t now = time(nullptr);
  doc["timestamp"]     = (long)now;
  doc["uptime_ms"]     = millis();
  doc["client_id"]     = mqtt_client_id;

  // Sensor readings
  doc["batteryVoltage"]   = batteryVoltage;
  doc["mainsVoltageRaw"]  = mainsRaw;
  doc["mainsStatus"]      = (mainsRaw > 500) ? "ON" : "OFF";
  doc["tiltSwitch"]       = tiltSwitchState;
  doc["temperature"]      = currentTemp;

  // Modbus register values
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
      Serial1.println(payload);
      digitalWrite(LED3_PIN, !digitalRead(LED3_PIN));
    }
    else
    {
      Serial.printf("=== MQTT PUBLISH FAILED === rc=%d\n", mqttClient.state());
    }

    // Device Shadow — report relay pin, schedule, and timestamps
    JsonDocument shadowDoc;
    JsonObject state    = shadowDoc["state"].to<JsonObject>();
    JsonObject reported = state["reported"].to<JsonObject>();
    reported["relay_pin"]         = RELAY_PIN;   // handy reference
    reported["relay_state"]       = currentRelayState;
    reported["device_state"]      = currentDeviceState;
    reported["timeToAutoTurnOn"]  = autoOnTime;
    reported["timeToAutoTurnOff"] = autoOffTime;
    reported["fault_code"]        = currentFaultCode;
    reported["timestamp"]         = (long)now;

    String shadowPayload;
    serializeJson(shadowDoc, shadowPayload);
    mqttClient.publish(SHADOW_UPDATE_TOPIC, shadowPayload.c_str());
    Serial.println("=== SHADOW UPDATE PUBLISHED ===");
    Serial1.println(shadowPayload);
  }
}
