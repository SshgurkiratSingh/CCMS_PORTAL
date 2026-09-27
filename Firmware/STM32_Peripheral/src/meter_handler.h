#ifndef METER_HANDLER_H
#define METER_HANDLER_H

struct MeterData {
    float voltage;
    float current;
    float power;
    float energy;
};

class MeterHandler {
public:
    static void init();
    static MeterData readRegisters();
};

#endif // METER_HANDLER_H
