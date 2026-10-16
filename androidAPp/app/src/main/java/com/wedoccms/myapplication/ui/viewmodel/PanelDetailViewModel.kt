package com.wedoccms.myapplication.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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

class PanelDetailViewModel(private val repository: CcmsRepository) : ViewModel() {
    private val _snapshotState = MutableStateFlow<UiState<List<SnapshotItem>>>(UiState.Loading)
    val snapshotState: StateFlow<UiState<List<SnapshotItem>>> = _snapshotState.asStateFlow()

    private val _telemetryHistoryState = MutableStateFlow<UiState<List<TelemetryLog>>>(UiState.Loading)
    val telemetryHistoryState: StateFlow<UiState<List<TelemetryLog>>> = _telemetryHistoryState.asStateFlow()

    private val _isCommandProcessing = MutableStateFlow(false)
    val isCommandProcessing: StateFlow<Boolean> = _isCommandProcessing.asStateFlow()

    private val _userMessage = MutableSharedFlow<String>()
    val userMessage: SharedFlow<String> = _userMessage.asSharedFlow()

    init {
        refreshSnapshot()
    }

    fun refreshSnapshot() {
        viewModelScope.launch {
            _snapshotState.value = UiState.Loading
            val snapshotRes = repository.getSnapshot()
            if (snapshotRes.isSuccess) {
                _snapshotState.value = UiState.Success(snapshotRes.getOrThrow())
            } else {
                _snapshotState.value = UiState.Error(snapshotRes.exceptionOrNull()?.message ?: "Failed to load panels")
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
                refreshSnapshot() // Revert if failed
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
                refreshSnapshot()
            } else {
                _userMessage.emit("Failed to update schedule")
            }
        }
    }
}
