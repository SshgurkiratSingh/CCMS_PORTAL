#ifndef METER_HANDLER_H
#define METER_HANDLER_H

#include <ModbusMaster.h>

extern ModbusMaster node;

float decodeFloatFromRegisters(uint16_t regHigh, uint16_t regLow, bool wordSwap);
void setupMeter();
void readMqttRegisters();
void updateDashboard();

#endif
