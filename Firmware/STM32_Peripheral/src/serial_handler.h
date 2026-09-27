#ifndef SERIAL_HANDLER_H
#define SERIAL_HANDLER_H

#include "meter_handler.h"

class SerialHandler {
public:
    static void init(unsigned long baudrate);
    static void processIncoming(int relayPin);
    static void sendTelemetry(float batteryVoltage, int mainsRaw, int tiltState, const MeterData& meterData);
};

#endif // SERIAL_HANDLER_H
