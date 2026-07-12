# CCMS Portal Documentation

Welcome to the **Centralized Command & Monitoring System** (CCMS) documentation. This system provides end-to-end management of smart streetlight fleets — from ESP32 edge firmware through AWS cloud infrastructure to the web-based operator console.

---

## Screenshots

![Fleet Overview](Assets/fleet%20screen.png)

![Panel Command Center](Assets/Panel%20command%20center.png)

![Modular Centralised Management System](Assets/Modular%20Centralised%20Management%20System1.png)

---

## Architecture

```
┌──────────────────┐    MQTT    ┌──────────────┐    SQS     ┌─────────────────┐
│   ESP32 Nodes    │───────────▶│   AWS IoT     │──────────▶│  Ingestion      │──────▶ DynamoDB
│  (streetlights)  │            │   Core        │            │  Lambda         │       (MeterTelemetry)
└──────────────────┘            └──────────────┘            └─────────────────┘
                                                                      │
                                                                      │ Read
                                                                      ▼
┌──────────────────┐    REST    ┌──────────────┐     Query    ┌─────────────────┐
│   Next.js App    │◀──────────│  API Gateway  │◀────────────│  DynamoDB       │
│  (operator       │            │  → Lambda    │              │  (PanelMetadata │
│   console)       │            │  (lambdaAPI)  │              │   + Telemetry)  │
└──────────────────┘            └──────────────┘              └─────────────────┘
```

## System Components

| Component | Technology | Description |
|-----------|-----------|-------------|
| **Web Portal** | Next.js 16, React 19, Tailwind CSS v4 | Operator console for fleet monitoring, command dispatch, analytics, and alerts |
| **API Lambda** | Python 3.x, AWS Lambda | REST API handling snapshot, history, provisioning, and commands via SSM-authenticated endpoints |
| **Ingestion Lambda** | Python 3.x, AWS Lambda | SQS-triggered function that writes telemetry payloads into DynamoDB |
| **ESP32 Firmware** | C++ (PlatformIO) | Edge device firmware for WiFi, MQTT/IoT Core, Modbus energy metering, and relay control |
| **Documentation** | MkDocs (Material theme) | This documentation site, auto-deployed to GitHub Pages |

## Data Flow

1. **ESP32 nodes** publish telemetry (voltage, current, power factor, battery, temperature, etc.) to AWS IoT Core via MQTT.
2. **IoT rules** route incoming messages to an **SQS queue**.
3. **Ingestion Lambda** (`saveDataFromSQStoDB`) reads from SQS and writes records to the `MeterTelemetry` DynamoDB table.
4. **API Lambda** (`lambdaAPI.py`) serves data to the frontend:
   - `?enquiry=snapshot` — scans `PanelMetadata` and attaches latest 5 telemetry records per panel
   - `?enquiry=history` — queries `MeterTelemetry` by panel ID and time range
   - `POST`/`PUT` — provisions/updates panel metadata
   - `PATCH` — dispatches relay commands, schedule updates, or shadow key changes (published to IoT Device Shadow)
   - `DELETE` — decommissions a panel
5. **Web portal** consumes the API using key-based auth headers and renders dashboards, maps, charts, and command interfaces.

## Quick Links

- [Web Portal Guide](web-portal.md) — Routes, components, auth, and deployment
- [Lambda Backend](lambda.md) — API endpoints, auth model, DynamoDB schema
- [Hardware (ESP32)](hardware.md) — Firmware variants, build instructions, interfaces
- [Frontend & Lambda Report](frontend-lambda-project-report.md) — Comprehensive architecture and implementation analysis