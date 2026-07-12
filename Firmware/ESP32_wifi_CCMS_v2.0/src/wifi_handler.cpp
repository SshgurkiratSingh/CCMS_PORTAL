#include "wifi_handler.h"
#include <WiFi.h>
#include "config.h"

void setupWiFi()
{
  delay(10);
  Serial.print("Connecting to WiFi...");
  displayStatusMessage("WiFi Connecting...");
  WiFi.begin(ssid, password);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000)
  {
    delay(250);
  }
  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("Connected.");
    displayStatusMessage("WiFi Connected.");
    delay(1000);
  }
  else
  {
    displayStatusMessage("WiFi Failed.");
    delay(1000);
  }
}
