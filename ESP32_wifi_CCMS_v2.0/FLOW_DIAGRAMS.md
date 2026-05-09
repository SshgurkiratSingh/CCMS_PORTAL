# CCMS V2.0 Firmware - Mermaid Flow Diagrams

This file contains Mermaid.js diagrams illustrating the hardware architecture, main software execution loop, and the AWS Device Shadow data flow of the CCMS ESP32 V2.0 System.

You can view these diagrams natively in VS Code by installing a Markdown preview extension that supports Mermaid (like "Markdown Preview Mermaid Support"), or by pasting the code blocks into the [Mermaid Live Editor](https://mermaid.live).

## 1. System Hardware Architecture

This diagram outlines the physical hardware topology, illustrating what is connected to the ESP32 and via which interfaces.

```mermaid
graph TD
    %% Core Node
    ESP[ESP32 Master Core]

    %% Cloud & External Comm layer
    AWS((AWS IoT Core))
    COMM_CARD[External Comms Card<br>LoRa / nRF / HaLow]

    %% I2C Peripherals
    RTC[DS3231 RTC]
    OLED[SSD1306 Display]

    %% Serial Peripherals
    METER[Multi-function Modbus Meter]

    %% Sensors & IO
    RELAY[Actuation Relay]
    BTN((Push Button))
    DHT[DHT11 Temp Sensor]
    TILT[Tilt Switch]
    BAT[Battery ADC]
    MAINS[Mains ADC]
    LEDS[LED Diagnostics]

    %% Connections
    ESP <-->|Wi-Fi / mTLS| AWS
    ESP -->|UART1 Bridge - TX 12, RX 13| COMM_CARD
    ESP <-->|UART2 RS-485 - TX 17, RX 16| METER

    ESP <-->|I2C - SDA 21, SCL 22| RTC
    ESP <-->|I2C - SDA 21, SCL 22| OLED

    ESP -->|GPIO 14| RELAY
    ESP -->|GPIO 25, 26, 27| LEDS
    BTN -->|GPIO 32 with Debounce| ESP
    DHT -->|GPIO 4| ESP
    TILT -->|GPIO 15| ESP
    BAT -->|Analog GPIO 34| ESP
    MAINS -->|Analog GPIO 35| ESP

    classDef core fill:#f9f,stroke:#333,stroke-width:2px;
    classDef cloud fill:#ff9,stroke:#333,stroke-width:2px;
    class ESP core;
    class AWS cloud;
```

---

## 2. Main Software Execution Loop

This flowchart visualizes the non-blocking execution thread running inside the `loop()` function of `main.cpp`.

```mermaid
flowchart TD
    Start((Loop Start)) --> WiFiCheck{Is Wi-Fi<br>Connected?}

    WiFiCheck -- No --> Reconnect[Reconnect Wi-Fi<br>& Sync NTP Time] --> MQTTCheck
    WiFiCheck -- Yes --> MQTTCheck[Handle MQTT<br>Connection & loop]

    MQTTCheck --> ADCPoll[Poll ADCs & Sensors:<br>Battery, Mains, Tilt, Temp]

    ADCPoll --> ButtonCheck{Button<br>Pressed?}
    ButtonCheck -- Yes --> Cycle[Cycle currentScreen ID] --> RenderOLED
    ButtonCheck -- No --> RenderOLED[Render OLED Display<br>Based on currentScreen]

    RenderOLED --> LEDCheck[Update Status LEDs<br>Mains, Net Link]
    LEDCheck --> ModbusPoll[Read Modbus<br>Holding Registers]

    ModbusPoll --> TimeCheck{Millis - LastPub<br>>= 25000ms?}

    TimeCheck -- Yes --> Serialize[Serialize Telemetry JSON]
    Serialize --> PubAWS[Publish to AWS IoT Core]
    PubAWS --> PubUART[Print JSON to UART1 Bridge]
    PubUART --> ToggleLED[Toggle LED3 Heartbeat]
    ToggleLED --> End((Loop End))

    TimeCheck -- No --> End((Loop End))
    End -.-> Start
```

---

## 3. Remote Control & AWS Shadow Delta Flow

This sequence diagram shows how remote control commands flow from the Cloud (AWS) down down to the end-node components.

```mermaid
sequenceDiagram
    participant Admin as User / Server
    participant AWS as AWS IoT Core
    participant ESP as ESP32 (mqttCallback)
    participant HW as Hardware (Relay/Variables)
    participant Bridge as UART1 Bridge

    Admin->>AWS: Request State Change (e.g. Relay ON)
    AWS-->>ESP: Push JSON to shadow/update/delta
    ESP->>ESP: parse JSON payload

    alt JSON Contains "relay_state"
        ESP->>HW: digitalWrite(RELAY_PIN, state)
    end

    alt JSON Contains Timers/Schedules
        ESP->>HW: Update global schedule strings
    end

    alt JSON Contains "device_state"
        ESP->>HW: Update currentDeviceState string
    end

    ESP->>ESP: Build Shadow Reported JSON
    ESP->>AWS: Publish Reported JSON to shadow/update
    Note over ESP, AWS: Syncs the Cloud's "Reported" state <br> with reality.

    ESP->>Bridge: Print Reported JSON to Serial1
    Note over Bridge: External comms cards (LoRa etc.)<br>can eavesdrop on the shadow sync.
```
