#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <RTClib.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"
#include "wifi_handler.h"
#include "mqtt_handler.h"
#include "meter_handler.h"

WiFiClientSecure espClient;
RTC_DS3231 rtc;
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

float batteryVoltage = 0.0f;
float mainsRaw = 0.0f;
int tiltSwitchState = 0;
float currentTemp = 0.0f;

// UI & Button State
int currentScreen = 0;
const int NUM_SCREENS = 3;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

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

void updateOLED()
{
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  DateTime now = rtc.now();

  switch (currentScreen)
  {
  case 0:
    // Screen 1: System & Network
    display.println(F("--- SYSTEM ---"));
    display.printf("%02d:%02d:%02d\n", now.hour(), now.minute(), now.second());
    display.print(F("WiFi: "));
    display.println(WiFi.status() == WL_CONNECTED ? F("Connected") : F("Offline"));
    display.print(F("MQTT: "));
    display.println(mqttClient.connected() ? F("Connected") : F("Offline"));
    display.print(F("Relay: "));
    display.println(currentRelayState ? F("ON") : F("OFF"));
    break;

  case 1:
    // Screen 2: Environment Sensors
    display.println(F("--- SENSORS ---"));
    display.print(F("Temp: "));
    display.print(currentTemp);
    display.println(F(" C"));
    display.print(F("Bat Voltage: "));
    display.print(batteryVoltage);
    display.println(F(" V"));
    display.print(F("Mains Val:   "));
    display.println(mainsRaw);
    display.print(F("Tilt Switch: "));
    display.println(tiltSwitchState == LOW ? F("Tilted") : F("Safe"));
    break;

  case 2:
    // Screen 3: Modbus Summary
    display.println(F("--- MODBUS ---"));
    display.print(F("R"));
    display.print(mqttRegisters[0]);
    display.print(F(": "));
    display.println(mqttValues[0]);
    display.print(F("R"));
    display.print(mqttRegisters[1]);
    display.print(F(": "));
    display.println(mqttValues[1]);
    display.print(F("R"));
    display.print(mqttRegisters[2]);
    display.print(F(": "));
    display.println(mqttValues[2]);
    display.print(F("R"));
    display.print(mqttRegisters[3]);
    display.print(F(": "));
    display.println(mqttValues[3]);
    display.println(F("(More in MQTT JSON)"));
    break;
  }
  display.display();
}

void setup()
{
  Serial.begin(115200);
  delay(50);

  // Initialize Hardware
  Wire.begin(I2C_SDA, I2C_SCL);
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

  // Buttons, LEDs, and Bridge UART
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(LED3_PIN, OUTPUT);
  Serial1.begin(115200, SERIAL_8N1, BRIDGE_RX, BRIDGE_TX);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
  {
    Serial.println(F("SSD1306 allocation failed"));
  }
  else
  {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println(F("CCMS Node Booting..."));
    display.display();
    delay(500);
    display.println(F("Init Modules: OK"));
    display.display();
    delay(500);
  }

  setupMeter();
  if (display.getBuffer()) {
    display.println(F("UART Stream: SET"));
    display.display();
    delay(500);
  }

  for (int i = 0; i < numMqttRegs; ++i)
    mqttValues[i] = 0.0f;

  if (display.getBuffer()) {
    display.println(F("Conn WiFi..."));
    display.display();
  }
  setupWiFi();
  
  if (display.getBuffer()) {
    display.println(F("Syncing NTP..."));
    display.display();
  }
  syncNTP();
  
  if (display.getBuffer()) {
    display.println(F("Conn MQTT..."));
    display.display();
  }
  setupMQTT();

  if (display.getBuffer()) {
    display.println(F("Boot Complete!"));
    display.display();
    delay(1000);
  }

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

  // Handle Push Button & UI
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState)
  {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > debounceDelay)
  {
    if (reading == LOW && lastButtonState == HIGH)
    {
      Serial.println("Button Pressed (ON)");
      currentScreen = (currentScreen + 1) % NUM_SCREENS;
    }
  }
  lastButtonState = reading;

  updateOLED();

  // Status LEDs logic
  digitalWrite(LED1_PIN, mainsRaw > 500 ? HIGH : LOW);                                            // Mains Power OK
  digitalWrite(LED2_PIN, (WiFi.status() == WL_CONNECTED && mqttClient.connected()) ? HIGH : LOW); // Network Activity

  readMqttRegisters();

  if (millis() - lastMqttPublish >= mqttPublishInterval)
  {
    publishMqttData();
    lastMqttPublish = millis();
  }
}
