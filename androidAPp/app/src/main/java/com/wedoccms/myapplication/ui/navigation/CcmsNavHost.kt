package com.wedoccms.myapplication.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.wedoccms.myapplication.ui.screens.AlertsScreen
import com.wedoccms.myapplication.ui.screens.AnalyticsScreen
import com.wedoccms.myapplication.ui.screens.DashboardScreen
import com.wedoccms.myapplication.ui.screens.ManagePanelScreen
import com.wedoccms.myapplication.ui.screens.PanelDetailScreen
import com.wedoccms.myapplication.ui.screens.PanelsScreen
import com.wedoccms.myapplication.ui.screens.SettingsScreen
import com.wedoccms.myapplication.ui.viewmodel.CcmsViewModel

@Composable
fun CcmsNavHost(
    navController: NavHostController,
    viewModel: CcmsViewModel,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route,
        modifier = modifier
    ) {
        composable(Screen.Dashboard.route) {
            DashboardScreen(
                viewModel = viewModel,
                onNavigateToPanelDetail = { panelId ->
                    navController.navigate(Screen.PanelDetail.createRoute(panelId))
                },
                onNavigateToPanels = {
                    navController.navigate(Screen.Panels.route)
                },
                onNavigateToAlerts = {
                    navController.navigate(Screen.Alerts.route)
                }
            )
        }

        composable(Screen.Panels.route) {
            PanelsScreen(
                viewModel = viewModel,
                onNavigateToPanelDetail = { panelId ->
                    navController.navigate(Screen.PanelDetail.createRoute(panelId))
                },
                onNavigateToManagePanel = {
                    navController.navigate(Screen.ManagePanel.route)
                }
            )
        }

        composable(Screen.Analytics.route) {
            AnalyticsScreen(viewModel = viewModel)
        }

        composable(Screen.Alerts.route) {
            AlertsScreen(viewModel = viewModel)
        }

        composable(Screen.Settings.route) {
            SettingsScreen(viewModel = viewModel)
        }

        composable(
            route = Screen.PanelDetail.route,
            arguments = listOf(navArgument("panelId") { type = NavType.StringType })
        ) { backStackEntry ->
            val panelId = backStackEntry.arguments?.getString("panelId") ?: ""
            PanelDetailScreen(
                panelId = panelId,
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.ManagePanel.route) {
            ManagePanelScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
