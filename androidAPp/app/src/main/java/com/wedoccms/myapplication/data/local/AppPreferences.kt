package com.wedoccms.myapplication.data.local

import android.content.Context
import android.content.SharedPreferences

class AppPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("ccms_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_DASHBOARD_KEY = "dashboard_key"
        private const val KEY_ADMIN_KEY = "admin_key"
        private const val KEY_USE_MOCK_FALLBACK = "use_mock_fallback"
        private const val KEY_DARK_MODE = "dark_mode"

        const val DEFAULT_BASE_URL = "https://85siwerqrg.execute-api.us-east-1.amazonaws.com/default/"
        const val DEFAULT_DASHBOARD_KEY = "CCET-Dash-Init-01"
        const val DEFAULT_ADMIN_KEY = "Admin-Override-99"
    }

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) = prefs.edit().putString(KEY_BASE_URL, value.trim()).apply()

    var dashboardKey: String
        get() = prefs.getString(KEY_DASHBOARD_KEY, DEFAULT_DASHBOARD_KEY) ?: DEFAULT_DASHBOARD_KEY
        set(value) = prefs.edit().putString(KEY_DASHBOARD_KEY, value.trim()).apply()

    var adminKey: String
        get() = prefs.getString(KEY_ADMIN_KEY, DEFAULT_ADMIN_KEY) ?: DEFAULT_ADMIN_KEY
        set(value) = prefs.edit().putString(KEY_ADMIN_KEY, value.trim()).apply()

    var useMockFallback: Boolean
        get() = prefs.getBoolean(KEY_USE_MOCK_FALLBACK, false)
        set(value) = prefs.edit().putBoolean(KEY_USE_MOCK_FALLBACK, value).apply()

    var isDarkMode: Boolean
        get() = prefs.getBoolean(KEY_DARK_MODE, true)
        set(value) = prefs.edit().putBoolean(KEY_DARK_MODE, value).apply()
}
