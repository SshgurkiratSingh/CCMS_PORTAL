# Raspberry Pi & STM Architecture

## Overview
As the CCMS deployment scales, the edge computing architecture is migrating from a standalone ESP32 system to a hybrid Raspberry Pi Gateway + STM32 Peripheral model.

This model delegates heavy network operations (AWS IoT MQTT, TLS decryption, NTP, scheduling) to the Raspberry Pi running Linux, while preserving real-time hardware determinism (ADC sampling, Modbus polling, relay control) on an STM32 peripheral node.

## Hardware Connections

1. **Serial (UART)**
   - Pi `TX` (GPIO 14) -> STM32 `RX` (PA10)
   - Pi `RX` (GPIO 15) -> STM32 `TX` (PA9)
   - Set baudrate to `115200`
2. **Relay Control**
   - STM32 `PA0` controls the solid-state or mechanical relay for the streetlight.
3. **Sensors**
   - **Battery ADC**: STM32 `PA1`
   - **Mains AC ADC**: STM32 `PA2`
   - **Tilt Switch**: STM32 `PA3`
4. **Power Meter (Modbus RTU)**
   - STM32 Serial2 -> RS485 Transceiver -> Schneeler Power Meter

## Software Components

### 1. RPi Gateway (`Firmware/RPi_Gateway/`)
A Python-based daemon (`main.py`) running on the Raspberry Pi.
- Uses `AWSIoTPythonSDK` to securely communicate with AWS IoT Core.
- Uses `pyserial` to communicate with the STM32.
- Handles AWS Device Shadow deltas (e.g. changing the relay state).

**Setup:**
```bash
sudo apt-get update
sudo apt-get install python3-pip
pip3 install -r Firmware/RPi_Gateway/requirements.txt
```

### 2. STM32 Peripheral (`Firmware/STM32_Peripheral/`)
Developed using PlatformIO with the Arduino framework for STM32.
- Polled every 5 seconds by internal timer to send a JSON telemetry string over UART.
- Listens for JSON commands from the Pi to toggle the relay.

**Build and Upload:**
```bash
cd Firmware/STM32_Peripheral
pio run -t upload
```
