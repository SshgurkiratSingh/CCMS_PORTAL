package com.wedoccms.myapplication.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.wedoccms.myapplication.data.local.AppPreferences
import com.wedoccms.myapplication.data.repository.CcmsRepository

class ViewModelFactory(
    private val repository: CcmsRepository,
    private val prefs: AppPreferences
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(DashboardViewModel::class.java) -> DashboardViewModel(repository) as T
            modelClass.isAssignableFrom(AlertsViewModel::class.java) -> AlertsViewModel(repository) as T
            modelClass.isAssignableFrom(PanelsViewModel::class.java) -> PanelsViewModel(repository) as T
            modelClass.isAssignableFrom(PanelDetailViewModel::class.java) -> PanelDetailViewModel(repository) as T
            modelClass.isAssignableFrom(SettingsViewModel::class.java) -> SettingsViewModel(prefs, repository) as T
            else -> throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
