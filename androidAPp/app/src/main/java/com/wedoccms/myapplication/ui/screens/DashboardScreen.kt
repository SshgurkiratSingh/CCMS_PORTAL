package com.wedoccms.myapplication.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ElectricMeter
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.PinDrop
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wedoccms.myapplication.data.model.DashboardSummary
import com.wedoccms.myapplication.data.model.PanelState
import com.wedoccms.myapplication.data.model.SnapshotItem
import com.wedoccms.myapplication.ui.components.GlassCard
import com.wedoccms.myapplication.ui.components.PulsingStatusBadge
import com.wedoccms.myapplication.ui.components.StatCard
import com.wedoccms.myapplication.ui.theme.CcmsBlueAccent
import com.wedoccms.myapplication.ui.theme.CcmsFaultRed
import com.wedoccms.myapplication.ui.theme.CcmsNeonCyan
import com.wedoccms.myapplication.ui.theme.CcmsOnlineGreen
import com.wedoccms.myapplication.ui.theme.CcmsTealSecondary
import com.wedoccms.myapplication.ui.util.MapUtils
import com.wedoccms.myapplication.ui.viewmodel.DashboardViewModel
import com.wedoccms.myapplication.ui.viewmodel.UiState

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToPanelDetail: (String) -> Unit,
    onNavigateToPanels: () -> Unit,
    onNavigateToAlerts: () -> Unit
) {
    val summaryState by viewModel.dashboardState.collectAsState()
    val snapshotState by viewModel.snapshotState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 16.dp)
    ) {
        // Header Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "CCMS COMMAND CENTER",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = CcmsNeonCyan,
                    letterSpacing = 1.2.sp
                )
                Text(
                    text = "Fleet Operational Overview",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            IconButton(onClick = { viewModel.refreshAllData() }) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Refresh",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            // Fleet Summary Cards
            item {
                when (val state = summaryState) {
                    is UiState.Loading -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(140.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        }
                    }
                    is UiState.Success -> {
                        DashboardSummarySection(
                            summary = state.data,
                            onAlertsClick = onNavigateToAlerts
                        )
                    }
                    is UiState.Error -> {
                        Text(
                            text = "Connection Error: \${state.message}",
                            color = CcmsFaultRed,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // Health Status Distribution Bar
            item {
                when (val state = snapshotState) {
                    is UiState.Success -> {
                        StatusDistributionBar(items = state.data)
                    }
                    else -> {}
                }
            }

            // Active Control Nodes Section Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Active Control Nodes",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "View All",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = CcmsNeonCyan,
                        modifier = Modifier.clickable { onNavigateToPanels() }
                    )
                }
            }

            // Active Control Node Cards
            when (val state = snapshotState) {
                is UiState.Loading -> {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                is UiState.Success -> {
                    items(state.data) { snapshot ->
                        PanelCardItem(
                            snapshot = snapshot,
                            onClick = { onNavigateToPanelDetail(snapshot.metadata.panelId) }
                        )
                    }
                }
                is UiState.Error -> {
                    item {
                        Text("Failed to load panels", color = CcmsFaultRed, fontSize = 12.sp)
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun DashboardSummarySection(
    summary: DashboardSummary,
    onAlertsClick: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            StatCard(
                title = "Fleet Nodes",
                value = "\${summary.totalPanels}",
                subtitle = "\${summary.onlineCount} Active • \${summary.offlineCount} Offline",
                icon = Icons.Default.Lightbulb,
                accentColor = CcmsNeonCyan,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Active Alarms",
                value = "\${summary.activeAlarms}",
                subtitle = if (summary.activeAlarms > 0) "Requires Attention" else "All Systems Normal",
                icon = Icons.Default.Warning,
                accentColor = if (summary.activeAlarms > 0) CcmsFaultRed else CcmsOnlineGreen,
                modifier = Modifier
                    .weight(1f)
                    .clickable { onAlertsClick() }
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            StatCard(
                title = "Grid Voltage",
                value = "\${summary.gridAvgVoltage}",
                unit = "V",
                subtitle = "Frequency: \${summary.gridFrequency} Hz",
                icon = Icons.Default.ElectricMeter,
                accentColor = CcmsTealSecondary,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Instant Load",
                value = "\${summary.instantLoadKw}",
                unit = "kW",
                subtitle = "Power Factor: \${summary.gridTotalPf}",
                icon = Icons.Default.Bolt,
                accentColor = CcmsBlueAccent,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun StatusDistributionBar(items: List<SnapshotItem>) {
    val online = items.count { it.metadata.status == PanelState.ONLINE }
    val fault = items.count { it.metadata.status == PanelState.FAULT }
    val offline = items.count { it.metadata.status == PanelState.OFFLINE }

    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column {
            Text(
                text = "FLEET HEALTH STATUS DISTRIBUTION",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 0.5.sp
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                if (online > 0) {
                    Box(
                        modifier = Modifier
                            .weight(online.toFloat())
                            .height(8.dp)
                            .background(CcmsOnlineGreen)
                    )
                }
                if (fault > 0) {
                    Box(
                        modifier = Modifier
                            .weight(fault.toFloat())
                            .height(8.dp)
                            .background(CcmsFaultRed)
                    )
                }
                if (offline > 0) {
                    Box(
                        modifier = Modifier
                            .weight(offline.toFloat())
                            .height(8.dp)
                            .background(MaterialTheme.colorScheme.outline)
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("🟢 Online: \$online", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = CcmsOnlineGreen)
                Text("🔴 Fault: \$fault", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = CcmsFaultRed)
                Text("⚪ Offline: \$offline", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun PanelCardItem(
    snapshot: SnapshotItem,
    onClick: () -> Unit
) {
    val context = LocalContext.current
    val meta = snapshot.metadata
    val latestLog = snapshot.recentLogs.firstOrNull()
    val lat = meta.location?.coordinates?.lat ?: 0.0
    val lng = meta.location?.coordinates?.lng ?: 0.0

    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = meta.panelId,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        PulsingStatusBadge(status = meta.status)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable {
                            if (lat != 0.0 && lng != 0.0) {
                                MapUtils.openLocationInMaps(context, lat, lng, meta.displayLocation)
                            }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.PinDrop,
                            contentDescription = "Location",
                            tint = CcmsNeonCyan,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = meta.displayLocation,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = Icons.Default.Map,
                            contentDescription = "Open in Maps",
                            tint = CcmsNeonCyan,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }

                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = "Open Detail",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 2x2 Telemetry Metric Grid
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .padding(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Voltage (R3035)", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        Text("${latestLog?.avgVoltage ?: "--"} V", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CcmsNeonCyan)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Current (R3009)", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        Text("${latestLog?.avgCurrent ?: "--"} A", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CcmsTealSecondary)
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Power Factor (R3053)", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        Text("${latestLog?.totalPowerFactor ?: "--"}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CcmsBlueAccent)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Active Load (R3083)", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        Text("${latestLog?.powerVector ?: "--"} kW", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}
