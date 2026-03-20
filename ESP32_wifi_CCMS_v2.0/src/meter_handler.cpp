#include "meter_handler.h"
#include "config.h"

ModbusMaster node;

float decodeFloatFromRegisters(uint16_t regHigh, uint16_t regLow, bool wordSwap)
 {
  uint32_t raw;
  if (wordSwap) {
    raw = ((uint32_t)regLow << 16) | regHigh;
  } else {
    raw = ((uint32_t)regHigh << 16) | regLow;
  }

  union {
    uint32_t u;
    float f;
  } conv;
  conv.u = raw;
  return conv.f;
}

void setupMeter() {
  Serial2.begin(9600, SERIAL_8E1, RX2_PIN, TX2_PIN);
  node.begin(1, Serial2);
}

void readMqttRegisters() {
  for (int idx = 0; idx < numMqttRegs; idx++) {
    uint16_t regA = mqttRegisters[idx];
    uint8_t result = node.readHoldingRegisters(regA, 2);
    delay(120);

    if (result == node.ku8MBSuccess) {
      uint16_t r1 = node.getResponseBuffer(0);
      uint16_t r2 = node.getResponseBuffer(1);

      float decoded = decodeFloatFromRegisters(r1, r2, useByteSwap);

      if (isnan(decoded) || isinf(decoded) || fabs(decoded) > 1e7) {
        mqttValues[idx] = 0.0f;
      } else {
        mqttValues[idx] = decoded;
      }
    } else {
      mqttValues[idx] = 0.0f;
    }
  }
}
