package com.wedoccms.myapplication.data.model

import com.google.gson.annotations.SerializedName

enum class PanelState {
    ONLINE, OFFLINE, FAULT, UNKNOWN
}

data class GpsCoordinates(
    @SerializedName("lat") val lat: Double = 0.0,
    @SerializedName("lng") val lng: Double = 0.0
)

data class PanelLocation(
    @SerializedName("locationPlace") val locationPlace: String? = null,
    @SerializedName("coordinates") val coordinates: GpsCoordinates? = null
)

data class PanelMetadata(
    @SerializedName("panel_id") val panelId: String = "",
    @SerializedName("status") val statusRaw: String? = "active",
    @SerializedName("location") val location: PanelLocation? = null,
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("firmware") val firmware: String? = "1.0.0",
    @SerializedName("mac_address") val macAddress: String? = null,
    @SerializedName("last_seen") val lastSeen: String? = null,
    @SerializedName("faultCode") val faultCode: String? = null,
    @SerializedName("faultMessage") val faultMessage: String? = null,
    @SerializedName("desired_state") val desiredState: String? = null,
    @SerializedName("relay_state") val relayState: String? = null,
    @SerializedName("device_state") val deviceState: String? = null,
    @SerializedName("hardware") val hardware: String? = null,
    @SerializedName("rated_kva") val ratedKva: Double? = null,
    @SerializedName("timeToAutoTurnOn") val timeToAutoTurnOn: String? = null,
    @SerializedName("timeToAutoTurnOff") val timeToAutoTurnOff: String? = null,
    @SerializedName("schedule") val schedule: RtcSchedule? = null
) {
    val status: PanelState
        get() = when (statusRaw?.uppercase()) {
            "ONLINE", "ACTIVE", "TRUE" -> PanelState.ONLINE
            "OFFLINE" -> PanelState.OFFLINE
            "FAULT" -> PanelState.FAULT
            else -> PanelState.ONLINE
        }

    val displayLocation: String
        get() = location?.locationPlace ?: if (panelId.isNotBlank()) "Node $panelId" else "Unknown Location"

    val isRelayActive: Boolean
        get() = desiredState?.uppercase() in listOf("ON", "TRUE", "1") ||
                relayState?.uppercase() in listOf("ON", "TRUE", "1") ||
                deviceState?.uppercase() in listOf("ON", "TRUE", "1")
}

data class TelemetryLog(
    @SerializedName("meter_id") val meterId: String? = null,
    @SerializedName("client_id") val clientId: String? = null,
    @SerializedName("timestamp") val timestamp: Any? = null,
    @SerializedName("server_time") val serverTime: Long? = null,
    @SerializedName("battery_voltage") val batteryVoltageSnake: Double? = null,
    @SerializedName("batteryVoltage") val batteryVoltageCamel: Double? = null,
    @SerializedName("mains_voltage_raw") val mainsVoltageSnake: Double? = null,
    @SerializedName("mainsVoltageRaw") val mainsVoltageCamel: Double? = null,
    @SerializedName("mainsStatus") val mainsStatusCamel: String? = null,
    @SerializedName("mains_status") val mainsStatusSnake: String? = null,
    @SerializedName("tilt_switch") val tiltSwitchSnake: Int? = null,
    @SerializedName("tiltSwitch") val tiltSwitchCamel: Int? = null,
    @SerializedName("temperature") val temperature: Double? = null,
    @SerializedName("uptime_ms") val uptimeMs: Long? = null,

    // Schneider Electric Modbus Meter Registers
    @SerializedName("R3027") val phase1Voltage: Double? = 0.0,    // R3027: Phase 1 Voltage (V)
    @SerializedName("R3035") val avgVoltage: Double? = 0.0,       // R3035: Average Voltage (V)
    @SerializedName("R3109") val gridFrequency: Double? = 0.0,    // R3109: Grid Frequency (Hz)
    @SerializedName("R3059") val powerFactorPh1: Double? = 0.0,   // R3059: PF Phase 1
    @SerializedName("R3053") val totalPowerFactor: Double? = 0.0, // R3053: Total Power Factor
    @SerializedName("R3009") val avgCurrent: Double? = 0.0,       // R3009: Average Current (A)
    @SerializedName("R3083") val powerVector: Double? = 0.0        // R3083: Power Vector (kW / kVA)
) {
    val batteryVoltage: Double
        get() = batteryVoltageSnake ?: batteryVoltageCamel ?: 0.0

    val mainsVoltage: Double
        get() = avgVoltage?.takeIf { it > 0 } ?: mainsVoltageSnake ?: mainsVoltageCamel ?: 0.0

    val mainsStatus: String
        get() = mainsStatusCamel ?: mainsStatusSnake ?: "OFF"

    val tiltSwitchValue: Int
        get() = tiltSwitchCamel ?: tiltSwitchSnake ?: 0

    val timestampMillis: Long
        get() = when (timestamp) {
            is Number -> timestamp.toLong()
            is String -> timestamp.toLongOrNull() ?: (serverTime ?: System.currentTimeMillis())
            else -> serverTime ?: System.currentTimeMillis()
        }
}

data class SnapshotItem(
    @SerializedName("metadata") val metadata: PanelMetadata = PanelMetadata(),
    @SerializedName("recent_logs") val recentLogs: List<TelemetryLog> = emptyList(),
    @SerializedName("error") val error: String? = null
)

data class DashboardSummary(
    val totalPanels: Int = 0,
    val activeAlarms: Int = 0,
    val onlineCount: Int = 0,
    val offlineCount: Int = 0,
    val faultCount: Int = 0,
    val gridAvgVoltage: Double = 0.0,
    val gridFrequency: Double = 0.0,
    val gridTotalPf: Double = 0.0,
    val instantLoadKw: Double = 0.0,
    val estEnergy24hKwh: Double = 0.0
)

data class RtcSchedule(
    @SerializedName("startLocalTime") val startLocalTime: String = "18:00",
    @SerializedName("endLocalTime") val endLocalTime: String = "06:00"
)

data class PatchRelayPayload(
    @SerializedName("panel_id") val panelId: String,
    @SerializedName("desired_state") val desiredState: String
)

data class PatchSchedulePayload(
    @SerializedName("panel_id") val panelId: String,
    @SerializedName("schedule") val schedule: RtcSchedule
)

data class PatchShadowKeysPayload(
    @SerializedName("panel_id") val panelId: String,
    @SerializedName("relay_state") val relayState: String? = null,
    @SerializedName("device_state") val deviceState: String? = null,
    @SerializedName("timeToAutoTurnOn") val timeToAutoTurnOn: String? = null,
    @SerializedName("timeToAutoTurnOff") val timeToAutoTurnOff: String? = null
)

data class ApiResponse(
    @SerializedName("message") val message: String? = null,
    @SerializedName("panel_id") val panelId: String? = null,
    @SerializedName("accepted") val accepted: Boolean? = true,
    @SerializedName("requestId") val requestId: String? = null,
    @SerializedName("error") val error: String? = null
)

enum class AlertSeverity {
    CRITICAL, HIGH, MEDIUM, LOW
}

data class AlertItem(
    val alertId: String,
    val panelId: String,
    val severity: AlertSeverity,
    val faultCode: String,
    val message: String,
    val raisedAtUtc: String,
    val isAcknowledged: Boolean = false
)
