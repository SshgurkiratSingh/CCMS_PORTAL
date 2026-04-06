#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <RTClib.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"
#include "wifi_handler.h"
#include "mqtt_handler.h"
#include "meter_handler.h"

WiFiClientSecure espClient;
RTC_DS3231 rtc;
DHT dht(DHT_PIN, DHT_TYPE);

float batteryVoltage = 0.0f;
float mainsRaw = 0.0f;
int tiltSwitchState = 0;
float currentTemp = 0.0f;

void syncNTP()
{
  Serial.print("Syncing time with NTP...");
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov"); // IST (5.5 hrs * 3600)
  time_t now = time(nullptr);
  int retry = 0;
  while (now < 100000 && retry < 10)
  {
    delay(1000);
    Serial.print(".");
    now = time(nullptr);
    retry++;
  }
  if (now >= 100000)
  {
    rtc.adjust(DateTime(now));
    Serial.println(" RTC updated from NTP.");
  }
  else
  {
    Serial.println(" NTP Sync Failed.");
  }
}

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  if (strcmp(topic, SHADOW_DELTA_TOPIC) == 0)
  {
    Serial.println("TACTICAL ALERT: Multi-Vector Shadow Delta Received.");

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    if (error)
    {
      Serial.println("JSON Parse Failed.");
      return;
    }

    JsonObject state = doc["state"].as<JsonObject>();
    bool stateChanged = false;

    // PARSE RELAY COMMAND
    if (state["relay_state"].is<bool>())
    {
      currentRelayState = state["relay_state"];
      digitalWrite(RELAY_PIN, currentRelayState ? HIGH : LOW);
      Serial.print("Relay GPIO switched to: ");
      Serial.println(currentRelayState ? "ON" : "OFF");
      stateChanged = true;
    }

    // PARSE TIMING/SCHEDULE COMMANDS
    if (state["timeToAutoTurnOn"].is<String>())
    {
      autoOnTime = state["timeToAutoTurnOn"].as<String>();
      Serial.println("New Auto-ON Schedule Locked: " + autoOnTime);
      stateChanged = true;
    }

    if (state["timeToAutoTurnOff"].is<String>())
    {
      autoOffTime = state["timeToAutoTurnOff"].as<String>();
      Serial.println("New Auto-OFF Schedule Locked: " + autoOffTime);
      stateChanged = true;
    }

    // PARSE DEVICE STATE
    if (state["device_state"].is<String>())
    {
      currentDeviceState = state["device_state"].as<String>();
      Serial.println("Device Status Override: " + currentDeviceState);
      stateChanged = true;
    }
  }
}

void setup()
{
  Serial.begin(115200);
  delay(50);

  // Initialize Hardware
  Wire.begin(21, 22);
  if (!rtc.begin())
  {
    Serial.println("Couldn't find RTC");
  }
  dht.begin();

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, currentRelayState ? HIGH : LOW);
  pinMode(TILT_SW_PIN, INPUT_PULLUP);
  // ADC mapping
  // BAT_ADC_PIN & MAINS_ADC_PIN do not explicitly need pinMode but good practice
  pinMode(BAT_ADC_PIN, INPUT);
  pinMode(MAINS_ADC_PIN, INPUT);

  setupMeter();

  for (int i = 0; i < numMqttRegs; ++i)
    mqttValues[i] = 0.0f;

  setupWiFi();
  syncNTP();
  setupMQTT();

  Serial.println("\n--- Multifunction Meter MQTT Publisher Started ---");
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    setupWiFi();
    syncNTP();
  }

  handleMQTTConnection();
  mqttClient.loop();

  // Multi-Vector Hardware Polling
  // Simple voltage divider assuming standard resistors, calibrate later
  batteryVoltage = analogRead(BAT_ADC_PIN) * (3.3 / 4095.0) * 4.0; // Assume factor of 4
  mainsRaw = analogRead(MAINS_ADC_PIN);
  tiltSwitchState = digitalRead(TILT_SW_PIN);
  float newTemp = dht.readTemperature();
  if (!isnan(newTemp))
  {
    currentTemp = newTemp;
  }

  readMqttRegisters();

  if (millis() - lastMqttPublish >= mqttPublishInterval)
  {
    publishMqttData();
    lastMqttPublish = millis();
  }
}
