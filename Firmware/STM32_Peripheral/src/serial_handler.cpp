#include "serial_handler.h"
#include <Arduino.h>
#include <ArduinoJson.h>

void SerialHandler::init(unsigned long baudrate) {
    Serial.begin(baudrate);
}

void SerialHandler::processIncoming(int relayPin) {
    if (Serial.available() > 0) {
        String line = Serial.readStringUntil('\n');
        
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, line);
        
        if (!error) {
            const char* cmd = doc["cmd"];
            int val = doc["val"];
            
            if (strcmp(cmd, "relay") == 0) {
                digitalWrite(relayPin, val > 0 ? HIGH : LOW);
            }
        }
    }
}

void SerialHandler::sendTelemetry(float batteryVoltage, int mainsRaw, int tiltState, const MeterData& meterData) {
    StaticJsonDocument<300> doc;
    doc["battery_v"] = batteryVoltage;
    doc["mains_raw"] = mainsRaw;
    doc["tilt"] = tiltState;
    doc["voltage"] = meterData.voltage;
    doc["current"] = meterData.current;
    doc["power"] = meterData.power;
    doc["energy"] = meterData.energy;
    
    serializeJson(doc, Serial);
    Serial.println();
}
