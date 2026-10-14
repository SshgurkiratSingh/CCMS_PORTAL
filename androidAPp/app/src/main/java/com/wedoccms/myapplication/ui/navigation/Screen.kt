package com.wedoccms.myapplication.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.ElectricMeter
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector? = null) {
    object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Dashboard)
    object Panels : Screen("panels", "Panels", Icons.Default.ElectricMeter)
    object Analytics : Screen("analytics", "Analytics", Icons.Default.Analytics)
    object Alerts : Screen("alerts", "Alerts", Icons.Default.Notifications)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)

    object PanelDetail : Screen("panel_detail/{panelId}", "Panel Detail") {
        fun createRoute(panelId: String) = "panel_detail/$panelId"
    }

    object ManagePanel : Screen("manage_panel", "Manage Panel")
}

val bottomNavItems = listOf(
    Screen.Dashboard,
    Screen.Panels,
    Screen.Analytics,
    Screen.Alerts,
    Screen.Settings
)
