package com.wedoccms.myapplication.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wedoccms.myapplication.data.local.AppPreferences
import com.wedoccms.myapplication.data.repository.CcmsRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(
    val prefs: AppPreferences,
    private val repository: CcmsRepository
) : ViewModel() {

    private val _isDarkMode = MutableStateFlow(prefs.isDarkMode)
    val isDarkMode: StateFlow<Boolean> = _isDarkMode.asStateFlow()

    private val _userMessage = MutableSharedFlow<String>()
    val userMessage: SharedFlow<String> = _userMessage.asSharedFlow()

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
        }
    }
}
