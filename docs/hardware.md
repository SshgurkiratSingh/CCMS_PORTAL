# Hardware (ESP32)

Three firmware variants for ESP32 microcontrollers that communicate telemetry and receive commands over WiFi/MQTT through AWS IoT Core.

![Modular Centralised Management System](Assets/Modular%20Centralised%20Management%20System1.png)

---

## Firmware Variants

| Variant          | Path                            | Description                                                                                                              |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **v1.0**         | `ESP32_wifi_CCMS_v1.0/`         | Base implementation with WiFi, MQTT, and basic energy meter reading                                                      |
| **v2.0**         | `ESP32_wifi_CCMS_v2.0/`         | Enhanced version with AWS IoT Core integration, relay control, UART comms bridge, OLED display, and NTP-synchronized RTC |
| **v2.0 PI Link** | `ESP32_wifi_CCMS_v2.0_PI_link/` | Variant designed to communicate via Raspberry Pi for additional relay logic and protocol bridging                        |

## Development Environment

All variants use **PlatformIO** with the Espressif 32 platform.

```bash
pip install platformio
cd ESP32_wifi_CCMS_v2.0
pio run -t upload     # build and flash
pio device monitor    # serial console at 115200 baud
```

### Key Dependencies (v2.0)

| Library                | Version | Purpose                              |
| ---------------------- | ------- | ------------------------------------ |
| `ArduinoJson`          | ^7.2.2  | JSON serialization for MQTT payloads |
| `PubSubClient`         | ^2.8    | MQTT client for AWS IoT Core         |
| `ModbusMaster`         | ^2.0.1  | Modbus RTU communication via RS-485  |
| `RTClib`               | ^2.1.3  | DS3231 RTC driver                    |
| `Adafruit SSD1306`     | ^2.5.9  | OLED display driver                  |
| `Adafruit GFX Library` | -       | Graphics primitives for display      |

---

## Hardware Architecture (v2.0)

### Pin Mapping

| Function            | Pin | Interface        | Details                                             |
| ------------------- | --- | ---------------- | --------------------------------------------------- |
| **Mains ADC**       | 35  | Analog           | AC mains voltage measurement via voltage divider    |
| **Battery ADC**     | 34  | Analog           | Backup battery voltage monitoring                   |
| **Tilt Switch**     | 15  | Digital (input)  | Mechanical tilt/tamper detection (internal pull-up) |
| **DHT11 Temp**      | 4   | Digital (1-wire) | Chassis temperature sensor                          |
| **Relay Control**   | 14  | Digital (output) | Transistor-driven AC contactor actuation            |
| **Modbus RX**       | 16  | UART2 RX         | RS-485 receive (MAX485)                             |
| **Modbus TX**       | 17  | UART2 TX         | RS-485 transmit (MAX485)                            |
| **Comms Bridge RX** | 13  | UART1 RX         | External radio module receive (LoRa, nRF, etc.)     |
| **Comms Bridge TX** | 12  | UART1 TX         | External radio module transmit (payload mirror)     |
| **I2C SDA**         | 21  | I2C              | Shared bus: DS3231 RTC + SSD1306 OLED               |
| **I2C SCL**         | 22  | I2C              | Shared bus: DS3231 RTC + SSD1306 OLED               |
| **OLED Button**     | 32  | Digital (input)  | Debounced tactile switch for screen cycling         |
| **LED 1 (Mains)**   | 25  | Digital (output) | Green — solid when mains voltage > threshold        |
| **LED 2 (Cloud)**   | 26  | Digital (output) | Blue — solid when WiFi + MQTT connected             |
| **LED 3 (TX)**      | 27  | Digital (output) | Flashes on each MQTT publish (25s interval)         |

### Peripheral Configuration

- **Modbus (UART2):** 9600 baud, 8E1 (8 data bits, Even parity, 1 stop bit)
- **Comms Bridge (UART1):** 115200 baud, 8N1
- **I2C:** DS3231 RTC (addr `0x68`), SSD1306 OLED (addr `0x3C`)
- **OLED Screens:** 3 modes — OS stats, environmental stats, load parameters

---

## Communication Architecture

### Primary: AWS IoT Core (MQTT over mTLS)

- **Telemetry topic:** `meter/telemetry/Meter_001`
- **Shadow topic:** `$aws/things/Meter_001/shadow/update/delta`
- **Publish interval:** Every 25 seconds
- **Security:** Mutual TLS authentication with hardcoded device certificate

### Secondary: UART Comms Bridge

Every MQTT payload is mirrored over UART1 (TX pin 12) at 115200 baud for external radio modules (LoRa, nRF24 Mesh, Wi-Fi HaLow). This decouples RF protocol complexity from the ESP32 firmware.

### Telemetry Payload

The JSON payload published every 25 seconds includes:

- Epoch timestamp (from NTP-synced DS3231 RTC)
- Modbus register values (voltage, current, power factor, frequency, power)
- Battery voltage (ADC reading)
- Mains voltage raw (ADC reading)
- Tilt switch state
- DHT11 temperature reading

---

## Software Subsystems

### NTP + DS3231 Time Sync

1. On WiFi connect, fetches epoch from `pool.ntp.org` / `time.nist.gov`
2. Adjusts to IST (+5:30) and writes to DS3231 RTC via `rtc.adjust()`
3. If WiFi fails, falls back to RTC crystal for timestamping

### AWS Device Shadow

Subscribes to `$aws/things/Meter_001/shadow/update/delta` for:

| Shadow Key          | Effect                                     |
| ------------------- | ------------------------------------------ |
| `relay_state`       | Immediately sets relay pin HIGH/LOW        |
| `timeToAutoTurnOn`  | Sets automatic turn-on time (e.g., 18:00)  |
| `timeToAutoTurnOff` | Sets automatic turn-off time (e.g., 06:00) |
| `device_state`      | Sets operational mode (Active/Maintenance) |

### Modbus Polling Loop

- Reads predefined holding registers (3003, 3009, etc.) via `ModbusMaster.h`
- 120ms inline delay between reads for RS-485 bus timing
- Byte-swaps if required, decodes to float, validates against NaN/Infinity
- Stores results in `mqttValues[]` global buffer for next publish

### Main Loop Structure

```
loop():
  1. Verify WiFi — auto-reconnect + re-fire NTP if needed
  2. mqttClient.loop() — sustain TLS keep-alive
  3. Read ADC: batteryVoltage, mainsRaw, tiltSwitchState
  4. Debounce button — rotate OLED screen (modulo 3)
  5. Render OLED display with current globals
  6. Modbus register reads
  7. If millis() - lastMqttPublish >= 25000:
     - Serialize JSON
     - Publish to MQTT
     - Mirror to UART bridge
     - Toggle TX LED
```

---

## v1.0 vs v2.0 vs v2.0 PI Link

| Feature             | v1.0 | v2.0 | v2.0 PI Link |
| ------------------- | ---- | ---- | ------------ |
| WiFi + MQTT         | ✅   | ✅   | ✅           |
| AWS IoT Core mTLS   | ❌   | ✅   | ✅           |
| Modbus Energy Meter | ✅   | ✅   | ✅           |
| DS3231 RTC + NTP    | ❌   | ✅   | ✅           |
| OLED Display        | ❌   | ✅   | ✅           |
| UART Comms Bridge   | ❌   | ✅   | ✅           |
| AWS Device Shadow   | ❌   | ✅   | ✅           |
| Relay Control       | ❌   | ✅   | Via Pi       |
| PI Communication    | ❌   | ❌   | ✅           |

## Building and Flashing

Each firmware variant has the same PlatformIO structure:

```
ESP32_wifi_CCMS_v2.0/
├── platformio.ini          ← Build configuration
├── include/
│   ├── config.h            ← WiFi/MQTT credentials and pin definitions
│   ├── mqtt_handler.h      ← MQTT client declarations
│   ├── wifi_handler.h      ← WiFi manager declarations
│   ├── meter_handler.h     ← Modbus handler declarations
│   └── aws_certs.h         ← AWS IoT Core certificates (v2.0+)
├── src/
│   ├── main.cpp            ← Entry point and main loop
│   ├── config.cpp          ← Configuration loading
│   ├── mqtt_handler.cpp    ← MQTT publish/subscribe logic
│   ├── wifi_handler.cpp    ← WiFi connection management
│   └── meter_handler.cpp   ← Modbus polling implementation
├── test/                   ← Unit tests
├── FLOW_DIAGRAMS.md        ← System flow documentation
├── PROJECT_REPORT.md       ← Comprehensive project report
└── publish_test.py         ← MQTT publish test script
```

### Configuration

Edit `include/config.h`:

```cpp
// WiFi
#define WIFI_SSID "your_ssid"
#define WIFI_PASSWORD "your_password"

// AWS IoT
#define AWS_IOT_ENDPOINT "xxxxxxxxxxxxxx-ats.iot.ap-south-1.amazonaws.com"

// MQTT Topics
#define MQTT_TELEMETRY_TOPIC "meter/telemetry/Meter_001"
#define MQTT_SHADOW_TOPIC "$aws/things/Meter_001/shadow/update/delta"

// Modbus
#define MODBUS_SLAVE_ID 1
#define MODBUS_BAUD 9600
```

For v2.0, also configure `include/aws_certs.h` with the device certificate, private key, and Amazon Root CA.
