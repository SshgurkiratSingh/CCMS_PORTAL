#include <Arduino.h>
#include "serial_handler.h"
#include "meter_handler.h"

// Define Pins
#define RELAY_PIN PA0
#define BAT_ADC_PIN PA1
#define MAINS_ADC_PIN PA2
#define TILT_SW_PIN PA3

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 5000; // 5 seconds

void setup() {
    // Initialize UART communication with Raspberry Pi
    SerialHandler::init(115200);
    
    // Initialize Hardware Pins
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
    
    pinMode(BAT_ADC_PIN, INPUT_ANALOG);
    pinMode(MAINS_ADC_PIN, INPUT_ANALOG);
    pinMode(TILT_SW_PIN, INPUT_PULLUP);
    
    // Initialize Modbus Meter
    MeterHandler::init();
}

void loop() {
    // Process incoming commands from Pi
    SerialHandler::processIncoming(RELAY_PIN);
    
    // Periodically send telemetry to Pi
    if (millis() - lastTelemetryTime > TELEMETRY_INTERVAL) {
        lastTelemetryTime = millis();
        
        // Read Sensors
        float batteryVoltage = analogRead(BAT_ADC_PIN) * (3.3 / 4095.0) * 4.0;
        int mainsRaw = analogRead(MAINS_ADC_PIN);
        int tiltState = digitalRead(TILT_SW_PIN);
        
        // Read Modbus Registers
        MeterData meterData = MeterHandler::readRegisters();
        
        // Send JSON Telemetry
        SerialHandler::sendTelemetry(batteryVoltage, mainsRaw, tiltState, meterData);
    }
}
