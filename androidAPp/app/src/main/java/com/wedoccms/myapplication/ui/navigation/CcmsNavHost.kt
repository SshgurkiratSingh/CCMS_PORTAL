package com.wedoccms.myapplication.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
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
import com.wedoccms.myapplication.ui.viewmodel.AlertsViewModel
import com.wedoccms.myapplication.ui.viewmodel.DashboardViewModel
import com.wedoccms.myapplication.ui.viewmodel.PanelDetailViewModel
import com.wedoccms.myapplication.ui.viewmodel.PanelsViewModel
import com.wedoccms.myapplication.ui.viewmodel.SettingsViewModel
import com.wedoccms.myapplication.ui.viewmodel.ViewModelFactory

@Composable
fun CcmsNavHost(
    navController: NavHostController,
    factory: ViewModelFactory,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route,
        modifier = modifier
    ) {
        composable(Screen.Dashboard.route) {
            val vm: DashboardViewModel = viewModel(factory = factory)
            DashboardScreen(
                viewModel = vm,
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
            val vm: PanelsViewModel = viewModel(factory = factory)
            PanelsScreen(
                viewModel = vm,
                onNavigateToPanelDetail = { panelId ->
                    navController.navigate(Screen.PanelDetail.createRoute(panelId))
                },
                onNavigateToManagePanel = {
                    navController.navigate(Screen.ManagePanel.route)
                }
            )
        }

        composable(Screen.Analytics.route) {
            val vm: PanelDetailViewModel = viewModel(factory = factory)
            AnalyticsScreen(viewModel = vm)
        }

        composable(Screen.Alerts.route) {
            val vm: AlertsViewModel = viewModel(factory = factory)
            AlertsScreen(viewModel = vm)
        }

        composable(Screen.Settings.route) {
            val vm: SettingsViewModel = viewModel(factory = factory)
            SettingsScreen(viewModel = vm)
        }

        composable(
            route = Screen.PanelDetail.route,
            arguments = listOf(navArgument("panelId") { type = NavType.StringType })
        ) { backStackEntry ->
            val panelId = backStackEntry.arguments?.getString("panelId") ?: ""
            val vm: PanelDetailViewModel = viewModel(factory = factory)
            PanelDetailScreen(
                panelId = panelId,
                viewModel = vm,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.ManagePanel.route) {
            val vm: PanelsViewModel = viewModel(factory = factory)
            ManagePanelScreen(
                viewModel = vm,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
