package com.wedoccms.myapplication.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.ElectricMeter
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.PinDrop
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Router
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wedoccms.myapplication.data.model.PanelMetadata
import com.wedoccms.myapplication.data.model.TelemetryLog
import com.wedoccms.myapplication.ui.components.CircularGauge
import com.wedoccms.myapplication.ui.components.GlassCard
import com.wedoccms.myapplication.ui.components.MetricTile
import com.wedoccms.myapplication.ui.components.PulsingStatusBadge
import com.wedoccms.myapplication.ui.components.RelayControlCard
import com.wedoccms.myapplication.ui.components.ScheduleDialog
import com.wedoccms.myapplication.ui.components.TelemetryLineChart
import com.wedoccms.myapplication.ui.theme.CcmsBlueAccent
import com.wedoccms.myapplication.ui.theme.CcmsFaultRed
import com.wedoccms.myapplication.ui.theme.CcmsNeonCyan
import com.wedoccms.myapplication.ui.theme.CcmsOnlineGreen
import com.wedoccms.myapplication.ui.theme.CcmsTealSecondary
import com.wedoccms.myapplication.ui.theme.CcmsWarningAmber
import com.wedoccms.myapplication.ui.viewmodel.CcmsViewModel
import com.wedoccms.myapplication.ui.viewmodel.UiState

@Composable
fun PanelDetailScreen(
    panelId: String,
    viewModel: CcmsViewModel,
    onNavigateBack: () -> Unit
) {
    val snapshotState by viewModel.snapshotState.collectAsState()
    val historyState by viewModel.telemetryHistoryState.collectAsState()
    val isProcessing by viewModel.isCommandProcessing.collectAsState()

    var showScheduleDialog by remember { mutableStateOf(false) }

    LaunchedEffect(panelId) {
        viewModel.loadTelemetryHistory(panelId)
    }

    val snapshotItem = (snapshotState as? UiState.Success)?.data?.find { it.metadata.panelId == panelId }
    val meta = snapshotItem?.metadata ?: PanelMetadata(panelId = panelId)
    val latestLog = snapshotItem?.recentLogs?.firstOrNull()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 16.dp)
    ) {
        // Top Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = meta.panelId,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = meta.displayLocation,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
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
            // Hero Status Header Banner
            item {
                PanelHeroHeader(meta = meta, latestLog = latestLog)
            }

            // Remote Contactor Relay Control Card
            item {
                RelayControlCard(
                    panelId = meta.panelId,
                    currentRelayOn = meta.isRelayActive,
                    schedule = meta.schedule,
                    isProcessing = isProcessing,
                    onToggleRelay = { turnOn ->
                        viewModel.toggleRelay(meta.panelId, turnOn)
                    },
                    onOpenScheduleDialog = { showScheduleDialog = true }
                )
            }

            // Real-time Circular Gauges Row
            item {
                Text(
                    text = "Live Telemetry Gauges",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    CircularGauge(
                        title = "Voltage",
                        registerCode = "R3035",
                        value = latestLog?.avgVoltage ?: 0.0,
                        unit = "V",
                        min = 0.0,
                        max = 300.0,
                        gaugeColor = CcmsNeonCyan,
                        modifier = Modifier.weight(1f)
                    )
                    CircularGauge(
                        title = "Current",
                        registerCode = "R3009",
                        value = latestLog?.avgCurrent ?: 0.0,
                        unit = "A",
                        min = 0.0,
                        max = 20.0,
                        gaugeColor = CcmsTealSecondary,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Schneider Electric Modbus Register Matrix
            item {
                Text(
                    text = "Schneider Electric Modbus Telemetry",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MetricTile(
                            label = "Average Voltage",
                            registerCode = "R3035",
                            value = "${latestLog?.avgVoltage ?: 0.0}",
                            unit = "V",
                            icon = Icons.Default.ElectricMeter,
                            color = CcmsNeonCyan,
                            modifier = Modifier.weight(1f)
                        )
                        MetricTile(
                            label = "Phase 1 Voltage",
                            registerCode = "R3027",
                            value = "${latestLog?.phase1Voltage ?: 0.0}",
                            unit = "V",
                            icon = Icons.Default.Bolt,
                            color = CcmsTealSecondary,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MetricTile(
                            label = "Average Current",
                            registerCode = "R3009",
                            value = "${latestLog?.avgCurrent ?: 0.0}",
                            unit = "A",
                            icon = Icons.Default.FlashOn,
                            color = CcmsBlueAccent,
                            modifier = Modifier.weight(1f)
                        )
                        MetricTile(
                            label = "Grid Frequency",
                            registerCode = "R3109",
                            value = "${latestLog?.gridFrequency ?: 0.0}",
                            unit = "Hz",
                            icon = Icons.Default.Speed,
                            color = CcmsOnlineGreen,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MetricTile(
                            label = "System Power Factor",
                            registerCode = "R3053",
                            value = "${latestLog?.totalPowerFactor ?: 0.0}",
                            unit = "PF",
                            icon = Icons.Default.Timeline,
                            color = CcmsWarningAmber,
                            modifier = Modifier.weight(1f)
                        )
                        MetricTile(
                            label = "Power Vector Load",
                            registerCode = "R3083",
                            value = "${latestLog?.powerVector ?: 0.0}",
                            unit = "kW",
                            icon = Icons.Default.Bolt,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Historical Telemetry Chart Section
            item {
                Text(
                    text = "Historical Voltage Trend (24h)",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            item {
                when (val hState = historyState) {
                    is UiState.Loading -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        }
                    }
                    is UiState.Success -> {
                        TelemetryLineChart(
                            logs = hState.data,
                            valueExtractor = { it.avgVoltage ?: 0.0 },
                            unit = "V",
                            lineColor = CcmsNeonCyan
                        )
                    }
                    is UiState.Error -> {
                        Text("Chart unavailable: ${hState.message}", color = CcmsFaultRed, fontSize = 12.sp)
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }

    if (showScheduleDialog) {
        ScheduleDialog(
            initialSchedule = meta.schedule,
            onDismiss = { showScheduleDialog = false },
            onSaveSchedule = { schedule ->
                showScheduleDialog = false
                viewModel.updateRtcSchedule(panelId, schedule)
            }
        )
    }
}

@Composable
private fun PanelHeroHeader(
    meta: PanelMetadata,
    latestLog: TelemetryLog?
) {
    val lat = meta.location?.coordinates?.lat ?: 0.0
    val lng = meta.location?.coordinates?.lng ?: 0.0

    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                PulsingStatusBadge(status = meta.status)
                Text(
                    text = "HW: ${meta.hardware ?: "ESP32-Modbus"} • FW: ${meta.firmware ?: "1.0.2"}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Location & GPS Row
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.PinDrop,
                    contentDescription = "GPS Coordinates",
                    tint = CcmsNeonCyan,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "${meta.displayLocation} ($lat° N, $lng° E)",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Diagnostic Telemetry Indicators (Mains Status, Battery, Temp, Tamper/Tilt)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .padding(10.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.BatteryChargingFull,
                        contentDescription = "Battery",
                        tint = CcmsOnlineGreen,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${latestLog?.batteryVoltage ?: 0.0} V",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Thermostat,
                        contentDescription = "Temperature",
                        tint = CcmsWarningAmber,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${latestLog?.temperature ?: 0.0} °C",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    val isTiltAlert = (latestLog?.tiltSwitchValue ?: 0) != 0
                    Icon(
                        imageVector = Icons.Default.Security,
                        contentDescription = "Tilt Switch",
                        tint = if (!isTiltAlert) CcmsOnlineGreen else CcmsFaultRed,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (!isTiltAlert) "Secure" else "Tamper Alert",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (!isTiltAlert) CcmsOnlineGreen else CcmsFaultRed
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // MQTT Topic Banner
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Router,
                    contentDescription = "MQTT Topic",
                    tint = CcmsTealSecondary,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Topic: meter/telemetry/${meta.panelId}",
                    fontSize = 10.sp,
                    color = CcmsTealSecondary
                )
            }
        }
    }
}
