package com.wedoccms.myapplication.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wedoccms.myapplication.data.model.GpsCoordinates
import com.wedoccms.myapplication.data.model.PanelLocation
import com.wedoccms.myapplication.data.model.PanelMetadata
import com.wedoccms.myapplication.data.model.SnapshotItem
import com.wedoccms.myapplication.data.repository.CcmsRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PanelsViewModel(private val repository: CcmsRepository) : ViewModel() {
    private val _snapshotState = MutableStateFlow<UiState<List<SnapshotItem>>>(UiState.Loading)
    val snapshotState: StateFlow<UiState<List<SnapshotItem>>> = _snapshotState.asStateFlow()

    private val _isCommandProcessing = MutableStateFlow(false)
    val isCommandProcessing: StateFlow<Boolean> = _isCommandProcessing.asStateFlow()

    private val _userMessage = MutableSharedFlow<String>()
    val userMessage: SharedFlow<String> = _userMessage.asSharedFlow()

    init {
        refreshPanels()
    }

    fun refreshPanels() {
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
                refreshPanels()
                onSuccess()
            } else {
                _userMessage.emit("Registration failed")
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
                refreshPanels() // Revert if failed
            }
        }
    }
}