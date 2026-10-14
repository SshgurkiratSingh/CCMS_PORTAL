package com.wedoccms.myapplication.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.wedoccms.myapplication.data.local.AppPreferences
import com.wedoccms.myapplication.data.model.AlertItem
import com.wedoccms.myapplication.data.model.DashboardSummary
import com.wedoccms.myapplication.data.model.GpsCoordinates
import com.wedoccms.myapplication.data.model.PanelLocation
import com.wedoccms.myapplication.data.model.PanelMetadata
import com.wedoccms.myapplication.data.model.RtcSchedule
import com.wedoccms.myapplication.data.model.SnapshotItem
import com.wedoccms.myapplication.data.model.TelemetryLog
import com.wedoccms.myapplication.data.repository.CcmsRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}

class CcmsViewModel(application: Application) : AndroidViewModel(application) {

    val prefs = AppPreferences(application)
    private val repository = CcmsRepository(prefs)

    // --- Dashboard State ---
    private val _dashboardState = MutableStateFlow<UiState<DashboardSummary>>(UiState.Loading)
    val dashboardState: StateFlow<UiState<DashboardSummary>> = _dashboardState.asStateFlow()

    // --- Snapshot State ---
    private val _snapshotState = MutableStateFlow<UiState<List<SnapshotItem>>>(UiState.Loading)
    val snapshotState: StateFlow<UiState<List<SnapshotItem>>> = _snapshotState.asStateFlow()

    // --- Telemetry History State ---
    private val _telemetryHistoryState = MutableStateFlow<UiState<List<TelemetryLog>>>(UiState.Loading)
    val telemetryHistoryState: StateFlow<UiState<List<TelemetryLog>>> = _telemetryHistoryState.asStateFlow()

    // --- Alerts State ---
    private val _alertsState = MutableStateFlow<UiState<List<AlertItem>>>(UiState.Loading)
    val alertsState: StateFlow<UiState<List<AlertItem>>> = _alertsState.asStateFlow()

    // --- Command Processing State ---
    private val _isCommandProcessing = MutableStateFlow(false)
    val isCommandProcessing: StateFlow<Boolean> = _isCommandProcessing.asStateFlow()

    // --- Snackbars & User Feedback Messages ---
    private val _userMessage = MutableSharedFlow<String>()
    val userMessage: SharedFlow<String> = _userMessage.asSharedFlow()

    // --- Settings Preferences State ---
    private val _isDarkMode = MutableStateFlow(prefs.isDarkMode)
    val isDarkMode: StateFlow<Boolean> = _isDarkMode.asStateFlow()

    init {
        refreshAllData()
    }

    fun refreshAllData() {
        viewModelScope.launch {
            _dashboardState.value = UiState.Loading
            _snapshotState.value = UiState.Loading
            _alertsState.value = UiState.Loading

            val summaryRes = repository.getDashboardSummary()
            val snapshotRes = repository.getSnapshot()
            val alertsRes = repository.getAlerts()

            if (summaryRes.isSuccess) {
                _dashboardState.value = UiState.Success(summaryRes.getOrThrow())
            } else {
                _dashboardState.value = UiState.Error(summaryRes.exceptionOrNull()?.message ?: "Failed to load summary")
            }

            if (snapshotRes.isSuccess) {
                _snapshotState.value = UiState.Success(snapshotRes.getOrThrow())
            } else {
                _snapshotState.value = UiState.Error(snapshotRes.exceptionOrNull()?.message ?: "Failed to load panels")
            }

            if (alertsRes.isSuccess) {
                _alertsState.value = UiState.Success(alertsRes.getOrThrow())
            } else {
                _alertsState.value = UiState.Error(alertsRes.exceptionOrNull()?.message ?: "Failed to load alerts")
            }
        }
    }

    fun loadTelemetryHistory(panelId: String) {
        viewModelScope.launch {
            _telemetryHistoryState.value = UiState.Loading
            val endTs = System.currentTimeMillis()
            val startTs = endTs - (24 * 3600 * 1000L) // 24 hours
            val res = repository.getTelemetryHistory(panelId, startTs, endTs)
            if (res.isSuccess) {
                _telemetryHistoryState.value = UiState.Success(res.getOrThrow())
            } else {
                _telemetryHistoryState.value = UiState.Error("Failed to load telemetry history")
            }
        }
    }

    fun toggleRelay(panelId: String, turnOn: Boolean) {
        viewModelScope.launch {
            _isCommandProcessing.value = true

            // Optimistic Local State Update
            val desiredStr = if (turnOn) "ON" else "OFF"
            val currentSnapshot = _snapshotState.value
            if (currentSnapshot is UiState.Success) {
                val updatedItems = currentSnapshot.data.map { item ->
                    if (item.metadata.panelId == panelId) {
                        item.copy(metadata = item.metadata.copy(desiredState = desiredStr, relayState = desiredStr))
                    } else {
                        item
                    }
                }
                _snapshotState.value = UiState.Success(updatedItems)
            }

            val res = repository.sendRelayCommand(panelId, turnOn)
            _isCommandProcessing.value = false

            if (res.isSuccess) {
                val apiResp = res.getOrThrow()
                _userMessage.emit(apiResp.message ?: "Relay $desiredStr command dispatched successfully")
            } else {
                _userMessage.emit("Failed to dispatch relay command: ${res.exceptionOrNull()?.message}")
                refreshAllData() // Revert if failed
            }
        }
    }

    fun updateRtcSchedule(panelId: String, schedule: RtcSchedule) {
        viewModelScope.launch {
            _isCommandProcessing.value = true
            val res = repository.updateSchedule(panelId, schedule)
            _isCommandProcessing.value = false
            if (res.isSuccess) {
                _userMessage.emit(res.getOrThrow().message ?: "Schedule saved")
                refreshAllData()
            } else {
                _userMessage.emit("Failed to update schedule")
            }
        }
    }

    fun registerPanel(
        panelId: String,
        locationName: String,
        latStr: String,
        lngStr: String,
        deviceId: String,
        firmware: String,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            _isCommandProcessing.value = true
            val lat = latStr.toDoubleOrNull() ?: 0.0
            val lng = lngStr.toDoubleOrNull() ?: 0.0
            val meta = PanelMetadata(
                panelId = panelId.trim(),
                statusRaw = "ONLINE",
                location = PanelLocation(locationName.trim(), GpsCoordinates(lat, lng)),
                deviceId = deviceId.trim(),
                firmware = firmware.trim(),
                desiredState = "ON"
            )
            val res = repository.registerPanel(meta)
            _isCommandProcessing.value = false
            if (res.isSuccess) {
                _userMessage.emit(res.getOrThrow().message ?: "Panel registered successfully")
                refreshAllData()
                onSuccess()
            } else {
                _userMessage.emit("Registration failed")
            }
        }
    }

    fun acknowledgeAlert(alertId: String) {
        viewModelScope.launch {
            val res = repository.acknowledgeAlert(alertId)
            if (res.isSuccess) {
                _userMessage.emit("Alert $alertId acknowledged")
                refreshAllData()
            }
        }
    }

    fun saveSettings(
        baseUrl: String,
        dashKey: String,
        adminKey: String,
        useMock: Boolean,
        darkMode: Boolean
    ) {
        viewModelScope.launch {
            prefs.baseUrl = baseUrl
            prefs.dashboardKey = dashKey
            prefs.adminKey = adminKey
            prefs.useMockFallback = useMock
            prefs.isDarkMode = darkMode
            _isDarkMode.value = darkMode
            _userMessage.emit("Settings saved & updated")
            refreshAllData()
        }
    }
}
