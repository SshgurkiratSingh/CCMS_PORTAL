package com.wedoccms.myapplication.data.util

import com.wedoccms.myapplication.data.model.AlertItem
import com.wedoccms.myapplication.data.model.AlertSeverity
import com.wedoccms.myapplication.data.model.TelemetryLog

object AlertEngine {

    fun analyzeTelemetry(panelId: String, logs: List<TelemetryLog>): List<AlertItem> {
        if (logs.isEmpty()) return emptyList()

        val alerts = mutableListOf<AlertItem>()

        // Rule 1: Sustained Low Voltage (< 200V)
        val lowVoltLogs = logs.filter { (it.avgVoltage ?: 230.0) in 1.0..199.9 }
        if (lowVoltLogs.size >= 2) {
            val avgV = lowVoltLogs.mapNotNull { it.avgVoltage }.average()
            alerts.add(
                AlertItem(
                    alertId = "ALT-E001-$panelId-${System.currentTimeMillis()}",
                    panelId = panelId,
                    severity = AlertSeverity.HIGH,
                    faultCode = "E001_LOW_VOLTAGE",
                    message = "Sustained Low Voltage: ${String.format("%.1f", avgV)}V across ${lowVoltLogs.size} readings",
                    raisedAtUtc = "Recently",
                    isAcknowledged = false
                )
            )
        }

        // Rule 2: Sustained High Voltage (> 250V)
        val highVoltLogs = logs.filter { (it.avgVoltage ?: 230.0) > 250.0 }
        if (highVoltLogs.size >= 2) {
            val avgV = highVoltLogs.mapNotNull { it.avgVoltage }.average()
            alerts.add(
                AlertItem(
                    alertId = "ALT-E002-$panelId-${System.currentTimeMillis()}",
                    panelId = panelId,
                    severity = AlertSeverity.CRITICAL,
                    faultCode = "E002_HIGH_VOLTAGE",
                    message = "Sustained High Voltage Spike: ${String.format("%.1f", avgV)}V detected",
                    raisedAtUtc = "Recently",
                    isAcknowledged = false
                )
            )
        }

        // Rule 3: Power Factor Degradation (< 0.75)
        val lowPfLogs = logs.filter { (it.totalPowerFactor ?: 0.98) in 0.01..0.75 }
        if (lowPfLogs.size >= 2) {
            val avgPf = lowPfLogs.mapNotNull { it.totalPowerFactor }.average()
            alerts.add(
                AlertItem(
                    alertId = "ALT-E003-$panelId-${System.currentTimeMillis()}",
                    panelId = panelId,
                    severity = AlertSeverity.MEDIUM,
                    faultCode = "E003_LOW_PF",
                    message = "Power Factor Degradation: ${String.format("%.3f", avgPf)} below 0.75 threshold",
                    raisedAtUtc = "Recently",
                    isAcknowledged = false
                )
            )
        }

        // Rule 4: Frequency Instability (< 49.5Hz or > 50.5Hz)
        val unstableFreqLogs = logs.filter {
            val f = it.gridFrequency ?: 50.0
            f > 0 && (f < 49.5 || f > 50.5)
        }
        if (unstableFreqLogs.size >= 2) {
            val minF = unstableFreqLogs.mapNotNull { it.gridFrequency }.minOrNull() ?: 49.0
            val maxF = unstableFreqLogs.mapNotNull { it.gridFrequency }.maxOrNull() ?: 51.0
            alerts.add(
                AlertItem(
                    alertId = "ALT-E004-$panelId-${System.currentTimeMillis()}",
                    panelId = panelId,
                    severity = AlertSeverity.MEDIUM,
                    faultCode = "E004_FREQ_UNSTABLE",
                    message = "Grid Frequency Instability: Range ${String.format("%.2f", minF)}Hz - ${String.format("%.2f", maxF)}Hz",
                    raisedAtUtc = "Recently",
                    isAcknowledged = false
                )
            )
        }

        // Rule 5: Tilt Switch Tamper Alert (tiltSwitch != 0)
        val tamperLogs = logs.filter { it.tiltSwitchValue != 0 }
        if (tamperLogs.isNotEmpty()) {
            alerts.add(
                AlertItem(
                    alertId = "ALT-E008-$panelId-${System.currentTimeMillis()}",
                    panelId = panelId,
                    severity = AlertSeverity.HIGH,
                    faultCode = "E008_TILT_TAMPER",
                    message = "Panel Enclosure Tamper / Displacement Switch Triggered",
                    raisedAtUtc = "Recently",
                    isAcknowledged = false
                )
            )
        }

        // Rule 6: Temperature Breach (> 50°C)
        val highTempLogs = logs.filter { (it.temperature ?: 0.0) > 50.0 }
        if (highTempLogs.isNotEmpty()) {
            val maxTemp = highTempLogs.mapNotNull { it.temperature }.maxOrNull() ?: 50.0
            alerts.add(
                AlertItem(
                    alertId = "ALT-E006-$panelId-${System.currentTimeMillis()}",
                    panelId = panelId,
                    severity = if (maxTemp > 65.0) AlertSeverity.CRITICAL else AlertSeverity.HIGH,
                    faultCode = "E006_TEMP_BREACH",
                    message = "Enclosure Temperature Breach: ${String.format("%.1f", maxTemp)}°C exceeds safe limit",
                    raisedAtUtc = "Recently",
                    isAcknowledged = false
                )
            )
        }

        return alerts
    }
}
