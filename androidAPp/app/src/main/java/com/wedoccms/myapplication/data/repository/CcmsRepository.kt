package com.wedoccms.myapplication.data.repository

import com.wedoccms.myapplication.data.local.AppPreferences
import com.wedoccms.myapplication.data.model.AlertItem
import com.wedoccms.myapplication.data.model.AlertSeverity
import com.wedoccms.myapplication.data.model.ApiResponse
import com.wedoccms.myapplication.data.model.DashboardSummary
import com.wedoccms.myapplication.data.model.GpsCoordinates
import com.wedoccms.myapplication.data.model.PanelLocation
import com.wedoccms.myapplication.data.model.PanelMetadata
import com.wedoccms.myapplication.data.model.PanelState
import com.wedoccms.myapplication.data.model.PatchRelayPayload
import com.wedoccms.myapplication.data.model.PatchSchedulePayload
import com.wedoccms.myapplication.data.model.RtcSchedule
import com.wedoccms.myapplication.data.model.SnapshotItem
import com.wedoccms.myapplication.data.model.TelemetryLog
import com.wedoccms.myapplication.data.remote.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CcmsRepository(private val prefs: AppPreferences) {

    private fun getService() = ApiClient.createApiService(prefs)

    suspend fun getSnapshot(): Result<List<SnapshotItem>> = withContext(Dispatchers.IO) {
        if (!prefs.useMockFallback) {
            try {
                val response = getService().getSnapshot()
                if (response.isSuccessful && response.body() != null) {
                    return@withContext Result.success(response.body()!!)
                } else {
                    return@withContext Result.failure(Exception("API Request Failed (${response.code()}): ${response.errorBody()?.string()}"))
                }
            } catch (e: Exception) {
                return@withContext Result.failure(e)
            }
        }
        Result.success(getMockSnapshotItems())
    }

    suspend fun getDashboardSummary(): Result<DashboardSummary> = withContext(Dispatchers.IO) {
        val snapshotResult = getSnapshot()
        if (snapshotResult.isFailure && !prefs.useMockFallback) {
            return@withContext Result.failure(snapshotResult.exceptionOrNull() ?: Exception("Failed to load dashboard"))
        }

        val snapshot = snapshotResult.getOrDefault(getMockSnapshotItems())

        var activeAlarms = 0
        var onlineCount = 0
        var offlineCount = 0
        var faultCount = 0

        var gridAvgVoltageSum = 0.0
        var gridFreqSum = 0.0
        var gridPfSum = 0.0
        var telemetryCount = 0
        var fleetPowerKw = 0.0

        for (item in snapshot) {
            val status = item.metadata.status
            when (status) {
                PanelState.ONLINE -> onlineCount++
                PanelState.OFFLINE -> offlineCount++
                PanelState.FAULT -> {
                    faultCount++
                    activeAlarms++
                }
                PanelState.UNKNOWN -> onlineCount++
            }

            val latest = item.recentLogs.firstOrNull()
            if (latest != null) {
                val v = latest.avgVoltage ?: 230.0
                val f = latest.gridFrequency ?: 50.0
                val pf = latest.totalPowerFactor ?: 0.98
                val i = latest.avgCurrent ?: 0.0

                gridAvgVoltageSum += v
                gridFreqSum += f
                gridPfSum += pf
                telemetryCount++

                if (v > 0 && i > 0 && pf > 0) {
                    fleetPowerKw += (v * i * pf) / 1000.0
                }
            }
        }

        val totalPanels = snapshot.size
        val avgVoltage = if (telemetryCount > 0) gridAvgVoltageSum / telemetryCount else 230.4
        val avgFreq = if (telemetryCount > 0) gridFreqSum / telemetryCount else 50.01
        val avgPf = if (telemetryCount > 0) gridPfSum / telemetryCount else 0.985
        val estEnergy24h = Math.round(fleetPowerKw * 12.0 * 100) / 100.0

        Result.success(
            DashboardSummary(
                totalPanels = totalPanels,
                activeAlarms = activeAlarms,
                onlineCount = onlineCount,
                offlineCount = offlineCount,
                faultCount = faultCount,
                gridAvgVoltage = Math.round(avgVoltage * 10.0) / 10.0,
                gridFrequency = Math.round(avgFreq * 100.0) / 100.0,
                gridTotalPf = Math.round(avgPf * 100.0) / 100.0,
                instantLoadKw = Math.round(fleetPowerKw * 100.0) / 100.0,
                estEnergy24hKwh = estEnergy24h
            )
        )
    }

    suspend fun getTelemetryHistory(
        panelId: String,
        startTs: Long,
        endTs: Long
    ): Result<List<TelemetryLog>> = withContext(Dispatchers.IO) {
        if (!prefs.useMockFallback) {
            try {
                val startStr = startTs.toString().padStart(13, '0')
                val endStr = endTs.toString().padStart(13, '0')
                val response = getService().getTelemetryHistory(panelId = panelId, start = startStr, end = endStr)
                if (response.isSuccessful && response.body() != null) {
                    return@withContext Result.success(response.body()!!)
                } else {
                    return@withContext Result.failure(Exception("Telemetry History Failed (${response.code()})"))
                }
            } catch (e: Exception) {
                return@withContext Result.failure(e)
            }
        }
        Result.success(getMockTelemetryHistory(panelId))
    }

    suspend fun sendRelayCommand(panelId: String, isOn: Boolean): Result<ApiResponse> = withContext(Dispatchers.IO) {
        val desiredStateStr = if (isOn) "ON" else "OFF"
        if (!prefs.useMockFallback) {
            try {
                val response = getService().patchRelayState(PatchRelayPayload(panelId, desiredStateStr))
                if (response.isSuccessful && response.body() != null) {
                    return@withContext Result.success(response.body()!!)
                } else {
                    return@withContext Result.failure(Exception("Relay Dispatch Failed (${response.code()})"))
                }
            } catch (e: Exception) {
                return@withContext Result.failure(e)
            }
        }

        mockPanels.find { it.panelId == panelId }?.let {
            val updated = it.copy(desiredState = desiredStateStr)
            val index = mockPanels.indexOf(it)
            if (index >= 0) mockPanels[index] = updated
        }
        Result.success(
            ApiResponse(
                message = "Relay $desiredStateStr command dispatched successfully for $panelId",
                panelId = panelId,
                accepted = true,
                requestId = "CMD-$panelId-${System.currentTimeMillis()}"
            )
        )
    }

    suspend fun updateSchedule(panelId: String, schedule: RtcSchedule): Result<ApiResponse> = withContext(Dispatchers.IO) {
        if (!prefs.useMockFallback) {
            try {
                val response = getService().patchSchedule(PatchSchedulePayload(panelId, schedule))
                if (response.isSuccessful && response.body() != null) {
                    return@withContext Result.success(response.body()!!)
                } else {
                    return@withContext Result.failure(Exception("Schedule Update Failed (${response.code()})"))
                }
            } catch (e: Exception) {
                return@withContext Result.failure(e)
            }
        }
        Result.success(
            ApiResponse(
                message = "Schedule updated (${schedule.startLocalTime} - ${schedule.endLocalTime})",
                panelId = panelId,
                accepted = true
            )
        )
    }

    suspend fun registerPanel(metadata: PanelMetadata): Result<ApiResponse> = withContext(Dispatchers.IO) {
        if (!prefs.useMockFallback) {
            try {
                val response = getService().registerPanel(metadata)
                if (response.isSuccessful && response.body() != null) {
                    return@withContext Result.success(response.body()!!)
                } else {
                    return@withContext Result.failure(Exception("Panel Registration Failed (${response.code()})"))
                }
            } catch (e: Exception) {
                return@withContext Result.failure(e)
            }
        }
        mockPanels.add(metadata)
        Result.success(ApiResponse(message = "Panel ${metadata.panelId} synchronized successfully."))
    }

    suspend fun getAlerts(): Result<List<AlertItem>> = withContext(Dispatchers.IO) {
        if (!prefs.useMockFallback) {
            val snapshotResult = getSnapshot()
            if (snapshotResult.isSuccess) {
                val snapshot = snapshotResult.getOrNull() ?: emptyList()
                val realAlerts = snapshot.filter {
                    it.metadata.status == PanelState.FAULT || it.metadata.faultCode != null
                }.map {
                    val meta = it.metadata
                    AlertItem(
                        alertId = "ALT-${meta.panelId}-${System.currentTimeMillis()}",
                        panelId = meta.panelId,
                        severity = AlertSeverity.CRITICAL,
                        faultCode = meta.faultCode ?: "SYSTEM_FAULT",
                        message = meta.faultMessage ?: "Critical fault detected on panel ${meta.panelId}",
                        raisedAtUtc = meta.lastSeen ?: "Recently",
                        isAcknowledged = false
                    )
                }
                return@withContext Result.success(realAlerts)
            }
        }
        Result.success(getMockAlerts())
    }

    private fun getMockAlerts(): List<AlertItem> = mockAlerts

    suspend fun acknowledgeAlert(alertId: String): Result<AlertItem> = withContext(Dispatchers.IO) {
        val alert = mockAlerts.find { it.alertId == alertId }
        if (alert != null) {
            val updated = alert.copy(isAcknowledged = true)
            val index = mockAlerts.indexOf(alert)
            if (index >= 0) mockAlerts[index] = updated
            Result.success(updated)
        } else {
            Result.success(
                AlertItem(
                    alertId = alertId,
                    panelId = "NODE",
                    severity = AlertSeverity.CRITICAL,
                    faultCode = "ACK_OK",
                    message = "Alert acknowledged by operator",
                    raisedAtUtc = "Just now",
                    isAcknowledged = true
                )
            )
        }
    }

    // --- Mock Data Generator (Fallback Only) ---
    private val mockPanels = mutableListOf(
        PanelMetadata(
            panelId = "PANEL_001",
            statusRaw = "ONLINE",
            location = PanelLocation("Sector 17 Plaza Junction", GpsCoordinates(30.7333, 76.7794)),
            deviceId = "Meter_001",
            firmware = "v2.0.1",
            macAddress = "A4:CF:12:89:FE:01",
            lastSeen = "Just now",
            desiredState = "ON"
        ),
        PanelMetadata(
            panelId = "PANEL_002",
            statusRaw = "ONLINE",
            location = PanelLocation("IT Park Expressway Gate A", GpsCoordinates(30.7262, 76.8436)),
            deviceId = "Meter_002",
            firmware = "v2.0.1",
            macAddress = "A4:CF:12:89:FE:02",
            lastSeen = "2 mins ago",
            desiredState = "ON"
        ),
        PanelMetadata(
            panelId = "PANEL_003",
            statusRaw = "FAULT",
            location = PanelLocation("Industrial Area Phase II", GpsCoordinates(30.7046, 76.7821)),
            deviceId = "Meter_003",
            firmware = "v1.9.4",
            macAddress = "A4:CF:12:89:FE:03",
            lastSeen = "15 mins ago",
            faultCode = "E02_OVERVOLTAGE",
            faultMessage = "Phase 1 voltage exceeded 255V threshold",
            desiredState = "OFF"
        )
    )

    private fun getMockSnapshotItems(): List<SnapshotItem> {
        val now = System.currentTimeMillis()
        return mockPanels.map { meta ->
            val logs = when (meta.panelId) {
                "PANEL_001" -> listOf(
                    TelemetryLog(
                        meterId = meta.panelId,
                        timestamp = now,
                        batteryVoltageSnake = 12.8,
                        mainsVoltageSnake = 232.4,
                        mainsStatusSnake = "ON",
                        tiltSwitchSnake = 0,
                        temperature = 29.2,
                        phase1Voltage = 232.4,
                        avgVoltage = 232.1,
                        gridFrequency = 50.02,
                        powerFactorPh1 = 0.98,
                        totalPowerFactor = 0.98,
                        avgCurrent = 14.8,
                        powerVector = 3.36
                    )
                )
                "PANEL_002" -> listOf(
                    TelemetryLog(
                        meterId = meta.panelId,
                        timestamp = now - 120000,
                        batteryVoltageSnake = 12.6,
                        mainsVoltageSnake = 230.1,
                        mainsStatusSnake = "ON",
                        tiltSwitchSnake = 0,
                        temperature = 28.1,
                        phase1Voltage = 230.1,
                        avgVoltage = 229.8,
                        gridFrequency = 49.98,
                        powerFactorPh1 = 0.97,
                        totalPowerFactor = 0.97,
                        avgCurrent = 11.2,
                        powerVector = 2.50
                    )
                )
                else -> emptyList()
            }
            SnapshotItem(metadata = meta, recentLogs = logs)
        }
    }

    private fun getMockTelemetryHistory(panelId: String): List<TelemetryLog> {
        val now = System.currentTimeMillis()
        val list = mutableListOf<TelemetryLog>()
        for (i in 24 downTo 0) {
            val ts = now - (i * 3600000L)
            val baseV = 228.0 + (Math.sin(i / 3.0) * 5.0) + (Math.random() * 2.0)
            val baseI = 12.0 + (Math.cos(i / 4.0) * 3.0)
            val pf = 0.95 + (Math.random() * 0.04)
            val power = (baseV * baseI * pf) / 1000.0

            list.add(
                TelemetryLog(
                    meterId = panelId,
                    timestamp = ts,
                    batteryVoltageSnake = 12.5,
                    mainsVoltageSnake = Math.round(baseV * 10.0) / 10.0,
                    mainsStatusSnake = "ON",
                    tiltSwitchSnake = 0,
                    temperature = 25.0 + (Math.random() * 5.0),
                    phase1Voltage = Math.round(baseV * 10.0) / 10.0,
                    avgVoltage = Math.round(baseV * 10.0) / 10.0,
                    gridFrequency = 49.95 + (Math.random() * 0.1),
                    powerFactorPh1 = Math.round(pf * 100.0) / 100.0,
                    totalPowerFactor = Math.round(pf * 100.0) / 100.0,
                    avgCurrent = Math.round(baseI * 10.0) / 10.0,
                    powerVector = Math.round(power * 100.0) / 100.0
                )
            )
        }
        return list
    }

    private val mockAlerts = mutableListOf(
        AlertItem(
            alertId = "ALT-001",
            panelId = "PANEL_003",
            severity = AlertSeverity.CRITICAL,
            faultCode = "E02_OVERVOLTAGE",
            message = "Phase 1 voltage spike detected: 258.6V exceeds safety threshold (250V).",
            raisedAtUtc = "15 mins ago",
            isAcknowledged = false
        )
    )
}
