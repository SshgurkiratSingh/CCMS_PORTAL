# CCMS Digital Hardware Clone (ESP32 Simulator)

An interactive, graphical digital twin of the CCMS (Centralized Control & Monitoring System) smart streetlight node and Schneider Electric multifunction energy meter, written in Python with **Tkinter** and **paho-mqtt**.

---

## 🌟 Overview & Purpose

This tool is a full software clone of the physical CCMS hardware (ESP32 v2.0 / v3.0). It allows engineers, portal developers, and QA to test the entire CCMS ecosystem without needing physical hardware, wiring, or meters connected:

1. **Hardware Visualization (Left Panel)**:
   - **SSD1306 128x64 OLED Display**: Renders live screens (System, Sensors, Modbus) with auto-switch every 5 seconds.
   - **GPIO 32 Tactile Push Button**: Click to manually cycle OLED screens.
   - **GPIO 25, 26, 27 LEDs**:
     - `LED 1 (GPIO 25)`: Mains Power OK (glows when Mains ADC > 500).
     - `LED 2 (GPIO 26)`: Network Activity (glows when connected to MQTT).
     - `LED 3 (GPIO 27)`: Telemetry Tx (flashes amber on each packet sent).
   - **Relay Contactor (GPIO 23 in v3.0)**: Visual contactor indicator (CLOSED/OPEN) with manual toggle override.

2. **Environmental & Grid Stimulator (Center/Right Tabs)**:
   - **Schneider Electric Modbus Meter**:
     - Phase 1 & Avg Voltage (`R3027`, `R3035`) with quick presets (Normal 230V, Sag 185V, Surge 255V, Blackout 0V).
     - Load Current (`R3009`) with automatic zero-current logic when Relay is opened.
     - Grid Frequency (`R3109`, default 50.0 Hz).
     - Power Factor (`R3053`, `R3059`, default 0.96).
     - Real Active Power (`R3083`) computed in real-time ($P = V \times I \times PF$).
     - Live Grid Jitter (Noise) simulation toggle.
   - **DC & Tamper Sensors**:
     - Backup Battery Voltage (`GPIO 34`).
     - Mains AC Raw ADC (`GPIO 35`).
     - Tilt / Tamper Switch (`GPIO 15`, Safe vs Tilted alarm).
     - DHT11 Temperature (`GPIO 4`).

3. **Cloud Connectivity (AWS IoT Core & Device Shadow)**:
   - **Real AWS IoT TLS Connection**: Auto-discovers certificates from `Firmware/ESP32_wifi_CCMS_v3.0/credentials/`.
   - **Mock Loopback Mode**: Test fully offline with simulated local telemetry & shadow.
   - **Shadow Delta Consumer**: Listens for cloud commands dispatched by Lambda / Next.js Portal / Android App (`relay_state`, `schedule`, `timeToAutoTurnOn`, `timeToAutoTurnOff`).
   - **Shadow Reported Sync**: Automatically acknowledges deltas and updates reported device state.
   - **Telemetry Dispatch**: Publishes exact firmware JSON payload to `meter/telemetry/{CLIENT_ID}`.

4. **Live Serial Console**:
   - Mirrors ESP32 UART output at 115200 baud with formatted logs, timestamps, and payload inspection.

---

## 🚀 How to Run

### Quick Launch
From the repository root:
```bash
./run_hardware_clone.sh
```

Or run directly with Python:
```bash
python3 Tools/hardware_clone/hardware_clone.py
```

### Dependencies
Requires Python 3.8+ with standard `tkinter` and `paho-mqtt`:
```bash
pip install paho-mqtt
```
*(Both are already installed in this environment)*

---

## 🧪 Testing Scenarios

### 1. Test Remote Relay Switching from Cloud / Lambda
1. Click **"Connect to AWS IoT Core"** (or use **"Mock Loopback Mode"**).
2. Trigger a Relay ON/OFF command from:
   - Next.js Web Portal (Dashboard -> Switch Relay)
   - Android App (Panel Details -> Toggle Relay)
   - AWS IoT Console (Device Shadow -> Update Desired State)
   - Or click **"⚡ Inject Cloud Delta Test"** on the top bar!
3. Observe:
   - The Relay banner instantly snaps to `RELAY CLOSED (ON - ENERGIZED)` (or `RELAY OPEN`).
   - The OLED display updates `Relay(G23): [ON]`.
   - The serial console logs: `TACTICAL ALERT: Remote Relay Command received`.
   - The device immediately publishes the updated reported state back to AWS IoT Shadow.

### 2. Test Grid Failure / Blackout
1. Click the **"Voltage Sag (185V)"** or drag the **Mains Raw ADC** slider below 500.
2. Observe `LED 1 (Mains OK)` turn OFF.
3. Telemetry packet sent to cloud will report `"mainsStatus": "OFF"`.

### 3. Test Tilt Tamper Alarm
1. Under **"DC Battery, Mains & Tamper"** tab, select **"TILTED / TAMPER DETECTED"**.
2. Notice `Fault Code: 1` on OLED and telemetry payload `tiltSwitch: 0`.
