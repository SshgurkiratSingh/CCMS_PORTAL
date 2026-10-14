#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"
#include "wifi_handler.h"
#include "mqtt_handler.h"
#include "meter_handler.h"

// v3.0: No external DS3231 RTC — time is kept entirely by the ESP32's
// internal SNTP-synced clock (via configTime / time.h).

WiFiClientSecure espClient;
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

float batteryVoltage = 0.0f;
float mainsRaw       = 0.0f;
int   tiltSwitchState = 0;
float currentTemp    = 0.0f;

// UI & Button State
int currentScreen = 0;
const int NUM_SCREENS = 3;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;
unsigned long lastScreenSwitchTime = 0;
const unsigned long screenSwitchInterval = 5000; // 5 s auto-switch

void displayStatusMessage(String msg)
{
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("--- BOOT SEQUENCE ---"));
  display.println(msg);
  display.display();
}

// ------------------------------------------------------------------
// syncNTP — syncs the ESP32 internal RTC via SNTP (IST = UTC+5:30)
// No external RTC chip is touched.
// ------------------------------------------------------------------
void syncNTP()
{
  Serial.print("Syncing time with NTP...");
  displayStatusMessage("Syncing NTP...");

  // IST offset = 5*3600 + 30*60 = 19800 s
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov");

  time_t now = time(nullptr);
  int retry  = 0;
  while (now < 100000 && retry < 10)
  {
    delay(1000);
    Serial.print(".");
    now = time(nullptr);
    retry++;
  }

  if (now >= 100000)
  {
    Serial.println(" NTP Sync OK — ESP32 internal RTC updated.");
    displayStatusMessage("NTP Sync OK");
  }
  else
  {
    Serial.println(" NTP Sync Failed.");
    displayStatusMessage("NTP Sync Failed");
  }
  delay(1000);
}

// Helper: get current hour & minute from ESP32 internal clock
static void getCurrentTime(int &h, int &m, int &s)
{
  time_t now = time(nullptr);
  struct tm ti;
  localtime_r(&now, &ti);
  h = ti.tm_hour;
  m = ti.tm_min;
  s = ti.tm_sec;
}

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  bool isDelta  = strcmp(topic, SHADOW_DELTA_TOPIC)  == 0;
  bool isUpdate = strcmp(topic, SHADOW_UPDATE_TOPIC) == 0;

  if (isDelta || isUpdate)
  {
    if (isDelta) Serial.println("Shadow Delta Received.");
    else         Serial.println("Shadow Update Received.");

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    if (error) { Serial.println("JSON Parse Failed."); return; }

    JsonObject state = doc["state"].as<JsonObject>();
    JsonObject desiredState = state["desired"].is<JsonObject>()
                              ? state["desired"].as<JsonObject>()
                              : state;
    if (isDelta && desiredState.size() == 0) desiredState = state;

    // ---------- RELAY ----------
    if (desiredState["relayState"].is<bool>())
    {
      currentRelayState = desiredState["relayState"];
      digitalWrite(RELAY_PIN, currentRelayState ? HIGH : LOW);
      Serial.printf("Relay GPIO%d -> %s\n", RELAY_PIN, currentRelayState ? "ON" : "OFF");
    }
    else if (desiredState["relay_state"].is<bool>())
    {
      currentRelayState = desiredState["relay_state"];
      digitalWrite(RELAY_PIN, currentRelayState ? HIGH : LOW);
      Serial.printf("Relay GPIO%d -> %s\n", RELAY_PIN, currentRelayState ? "ON" : "OFF");
    }
    else if (desiredState["relay_state"].is<String>())
    {
      String rs = desiredState["relay_state"].as<String>();
      rs.toUpperCase();
      currentRelayState = (rs == "ON");
      digitalWrite(RELAY_PIN, currentRelayState ? HIGH : LOW);
      Serial.printf("Relay GPIO%d -> %s\n", RELAY_PIN, rs.c_str());
    }

    // ---------- SCHEDULE ----------
    if (desiredState["timeToAutoTurnOn"].is<String>())
      autoOnTime = desiredState["timeToAutoTurnOn"].as<String>();
    else if (desiredState["time_to_auto_turn_on"].is<String>())
      autoOnTime = desiredState["time_to_auto_turn_on"].as<String>();

    if (desiredState["timeToAutoTurnOff"].is<String>())
      autoOffTime = desiredState["timeToAutoTurnOff"].as<String>();
    else if (desiredState["time_to_auto_turn_off"].is<String>())
      autoOffTime = desiredState["time_to_auto_turn_off"].as<String>();

    // ---------- DEVICE STATE ----------
    if (desiredState["deviceState"].is<String>())
      currentDeviceState = desiredState["deviceState"].as<String>();
    else if (desiredState["device_state"].is<String>())
      currentDeviceState = desiredState["device_state"].as<String>();
  }
}

void updateOLED()
{
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  int h, m, s;
  getCurrentTime(h, m, s);

  switch (currentScreen)
  {
  case 0:
    display.println(F("--- SYSTEM v3.0 ---"));
    display.printf("%02d:%02d:%02d (NTP)\n", h, m, s);
    display.print(F("WiFi: "));
    display.println(WiFi.status() == WL_CONNECTED ? F("Connected") : F("Offline"));
    display.print(F("MQTT: "));
    display.println(mqttClient.connected() ? F("Connected") : F("Offline"));
    display.print(F("Relay(G23): "));
    display.println(currentRelayState ? F("ON") : F("OFF"));
    break;

  case 1:
    display.println(F("--- SENSORS ---"));
    display.print(F("Temp: "));  display.print(currentTemp);  display.println(F(" C"));
    display.print(F("Bat:  "));  display.print(batteryVoltage); display.println(F(" V"));
    display.print(F("Mains: ")); display.println(mainsRaw);
    display.print(F("Tilt:  "));
    display.println(tiltSwitchState == LOW ? F("Tilted") : F("Safe"));
    break;

  case 2:
    display.println(F("--- MODBUS ---"));
    for (int i = 0; i < 4 && i < numMqttRegs; i++)
    {
      display.printf("R%u: %.2f\n", (unsigned)mqttRegisters[i], mqttValues[i]);
    }
    display.println(F("(More in MQTT)"));
    break;
  }
  display.display();
}

void setup()
{
  Serial.begin(115200);
  delay(50);

  // OLED init (I2C — no RTC on the bus in v3.0)
  Wire.begin(I2C_SDA, I2C_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
    Serial.println(F("SSD1306 allocation failed"));
  else
  {
    display.clearDisplay();
    display.display();
  }

  // DHT sensor
  dht.begin();

  // GPIO init
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // relay OFF on boot
  pinMode(TILT_SW_PIN, INPUT_PULLUP);
  pinMode(BAT_ADC_PIN, INPUT);
  pinMode(MAINS_ADC_PIN, INPUT);

  // Buttons, LEDs & Bridge UART
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(LED3_PIN, OUTPUT);
  Serial1.begin(115200, SERIAL_8N1, BRIDGE_RX, BRIDGE_TX);

  displayStatusMessage("CCMS v3.0 Boot...");
  delay(500);

  // Modbus meter
  setupMeter();

  for (int i = 0; i < numMqttRegs; ++i) mqttValues[i] = 0.0f;

  // Network & Time
  setupWiFi();
  syncNTP();
  setupMQTT();

  Serial.println("\n--- CCMS v3.0 — ESP32 Internal RTC, Relay GPIO23 ---");
}

float calculateBatteryVoltage()
{
  int adcValue = analogRead(BAT_ADC_PIN);
  float pinVoltage = adcValue * (3.3f / 4095.0f);
  const float dividerRatio = 4.0f;  // calibrate for actual resistor network
  return pinVoltage * dividerRatio;
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

  // Hardware polling
  batteryVoltage = calculateBatteryVoltage();
  mainsRaw       = analogRead(MAINS_ADC_PIN);
  tiltSwitchState = digitalRead(TILT_SW_PIN);
  float newTemp  = dht.readTemperature();
  if (!isnan(newTemp)) currentTemp = newTemp;

  // Auto screen switch
  if (millis() - lastScreenSwitchTime > screenSwitchInterval)
  {
    currentScreen = (currentScreen + 1) % NUM_SCREENS;
    lastScreenSwitchTime = millis();
  }

  // Manual button
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState) lastDebounceTime = millis();
  if ((millis() - lastDebounceTime) > debounceDelay)
  {
    if (reading == LOW && lastButtonState == HIGH)
    {
      currentScreen = (currentScreen + 1) % NUM_SCREENS;
      lastScreenSwitchTime = millis();
    }
  }
  lastButtonState = reading;

  updateOLED();

  // Status LEDs
  digitalWrite(LED1_PIN, mainsRaw > 500 ? HIGH : LOW);
  digitalWrite(LED2_PIN, (WiFi.status() == WL_CONNECTED && mqttClient.connected()) ? HIGH : LOW);

  readMqttRegisters();

  if (millis() - lastMqttPublish >= mqttPublishInterval)
  {
    publishMqttData();
    lastMqttPublish = millis();
  }
}
