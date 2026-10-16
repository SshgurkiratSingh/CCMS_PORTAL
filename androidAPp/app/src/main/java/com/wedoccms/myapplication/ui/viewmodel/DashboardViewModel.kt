package com.wedoccms.myapplication.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wedoccms.myapplication.data.model.DashboardSummary
import com.wedoccms.myapplication.data.model.SnapshotItem
import com.wedoccms.myapplication.data.repository.CcmsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class DashboardViewModel(private val repository: CcmsRepository) : ViewModel() {
    private val _dashboardState = MutableStateFlow<UiState<DashboardSummary>>(UiState.Loading)
    val dashboardState: StateFlow<UiState<DashboardSummary>> = _dashboardState.asStateFlow()

    private val _snapshotState = MutableStateFlow<UiState<List<SnapshotItem>>>(UiState.Loading)
    val snapshotState: StateFlow<UiState<List<SnapshotItem>>> = _snapshotState.asStateFlow()

    init {
        refreshAllData()
    }

    fun refreshAllData() {
        viewModelScope.launch {
            _dashboardState.value = UiState.Loading
            _snapshotState.value = UiState.Loading
            
            val summaryRes = repository.getDashboardSummary()
            if (summaryRes.isSuccess) {
                _dashboardState.value = UiState.Success(summaryRes.getOrThrow())
            } else {
                _dashboardState.value = UiState.Error(summaryRes.exceptionOrNull()?.message ?: "Failed to load summary")
            }

            val snapshotRes = repository.getSnapshot()
            if (snapshotRes.isSuccess) {
                _snapshotState.value = UiState.Success(snapshotRes.getOrThrow())
            } else {
                _snapshotState.value = UiState.Error(snapshotRes.exceptionOrNull()?.message ?: "Failed to load panels")
            }
        }
    }
}
