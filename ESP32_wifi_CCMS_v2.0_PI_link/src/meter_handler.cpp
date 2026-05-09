#include "meter_handler.h"
#include "config.h"

// Set up the Serial used for reading JSON data
void setupMeter()
{
  Serial2.begin(115200, SERIAL_8N1, RX2_PIN, TX2_PIN);
  Serial.println("UART JSON Node Start");
}

void readMqttRegisters()
{
  static String jsonBuffer = "";

  // Accumulate incoming JSON data character by character
  while (Serial2.available())
  {
    char c = Serial2.read();

    if (c == '\r')
    {
      continue; // Ignore carriage returns
    }
    else if (c == '{')
    {
      // A new JSON object starts here, reset buffer just in case we had garbage before it
      jsonBuffer = "{";
    }
    else if (c == '\n')
    {
      // Newline indicates the end of a message
      jsonBuffer.trim(); // Remove any leading/trailing whitespace

      if (jsonBuffer.length() > 0)
      {
        Serial.print("Raw received: ");
        Serial.println(jsonBuffer);

        // Standard JSON does not support 'NaN'.
        // ArduinoJson will fail with 'InvalidInput', so replace it with 'null' before parsing.
        jsonBuffer.replace("NaN", "null");

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, jsonBuffer);

        if (error)
        {
          Serial.print("JSON Parse failed: ");
          Serial.print(error.c_str());
          Serial.print(" | Input was: ");
          Serial.println(jsonBuffer);
        }
        else
        {
          Serial.println("--- Decoded JSON Data ---");

          // Map the decoded JSON to mqttValues based on mqttRegisters
          for (int i = 0; i < numMqttRegs; i++)
          {
            String regKey = String(mqttRegisters[i]);
            if (doc.containsKey(regKey))
            {
              float val = doc[regKey].as<float>();
              if (isnan(val) || isinf(val) || fabs(val) > 1e7)
              {
                mqttValues[i] = 0.0f;
              }
              else
              {
                mqttValues[i] = val;
              }
            }
          }
        }

        // Clear the buffer after processing
        jsonBuffer = "";
      }
    }
    else
    {
      // Append character to the buffer
      jsonBuffer += c;
    }
  }
}
