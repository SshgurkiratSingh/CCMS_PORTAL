package com.wedoccms.myapplication.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wedoccms.myapplication.data.model.AlertItem
import com.wedoccms.myapplication.data.repository.CcmsRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AlertsViewModel(private val repository: CcmsRepository) : ViewModel() {
    private val _alertsState = MutableStateFlow<UiState<List<AlertItem>>>(UiState.Loading)
    val alertsState: StateFlow<UiState<List<AlertItem>>> = _alertsState.asStateFlow()

    private val _userMessage = MutableSharedFlow<String>()
    val userMessage: SharedFlow<String> = _userMessage.asSharedFlow()

    init {
        refreshAlerts()
    }

    fun refreshAlerts() {
        viewModelScope.launch {
            _alertsState.value = UiState.Loading
            val alertsRes = repository.getAlerts()
            if (alertsRes.isSuccess) {
                _alertsState.value = UiState.Success(alertsRes.getOrThrow())
            } else {
                _alertsState.value = UiState.Error(alertsRes.exceptionOrNull()?.message ?: "Failed to load alerts")
            }
        }
    }

    fun acknowledgeAlert(alertId: String) {
        viewModelScope.launch {
            val res = repository.acknowledgeAlert(alertId)
            if (res.isSuccess) {
                _userMessage.emit("Alert $alertId acknowledged")
                refreshAlerts()
            }
        }
    }
}
