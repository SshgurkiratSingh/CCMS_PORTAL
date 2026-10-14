package com.wedoccms.myapplication.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wedoccms.myapplication.data.model.TelemetryLog
import com.wedoccms.myapplication.ui.components.TelemetryLineChart
import com.wedoccms.myapplication.ui.theme.CcmsBlueAccent
import com.wedoccms.myapplication.ui.theme.CcmsCyanPrimary
import com.wedoccms.myapplication.ui.theme.CcmsOnlineGreen
import com.wedoccms.myapplication.ui.theme.CcmsTealSecondary
import com.wedoccms.myapplication.ui.theme.CcmsWarningAmber
import com.wedoccms.myapplication.ui.viewmodel.CcmsViewModel
import com.wedoccms.myapplication.ui.viewmodel.UiState

enum class MetricType(val label: String, val unit: String, val color: Color) {
    VOLTAGE("Avg Voltage", "V", CcmsCyanPrimary),
    CURRENT("Avg Current", "A", CcmsTealSecondary),
    POWER_FACTOR("Power Factor", "PF", CcmsBlueAccent),
    FREQUENCY("Grid Frequency", "Hz", CcmsOnlineGreen),
    TEMPERATURE("Enclosure Temp", "°C", CcmsWarningAmber)
}

@Composable
fun AnalyticsScreen(viewModel: CcmsViewModel) {
    val historyState by viewModel.telemetryHistoryState.collectAsState()
    val snapshotState by viewModel.snapshotState.collectAsState()

    var selectedMetric by remember { mutableStateOf(MetricType.VOLTAGE) }
    var selectedTimeRange by remember { mutableStateOf("24h") }

    val activePanelId = (snapshotState as? UiState.Success)?.data?.firstOrNull()?.metadata?.panelId ?: "Meter_001"

    LaunchedEffect(activePanelId) {
        viewModel.loadTelemetryHistory(activePanelId)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 16.dp)
    ) {
        // Header
        Text(
            text = "TELEMETRY ANALYTICS",
            fontSize = 11.sp,
            fontWeight = FontWeight.ExtraBold,
            color = CcmsCyanPrimary,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(top = 16.dp)
        )
        Text(
            text = "Historical Power & Grid Performance ($activePanelId)",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Metric Selectors
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(MetricType.values().toList()) { metric ->
                FilterChip(
                    selected = selectedMetric == metric,
                    onClick = { selectedMetric = metric },
                    label = { Text(metric.label) },
                    shape = RoundedCornerShape(20.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = metric.color.copy(alpha = 0.2f),
                        selectedLabelColor = metric.color
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Time Range Selectors
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf("1h", "6h", "24h", "7d").forEach { range ->
                FilterChip(
                    selected = selectedTimeRange == range,
                    onClick = { selectedTimeRange = range },
                    label = { Text(range) },
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Chart View
        when (val state = historyState) {
            is UiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
            is UiState.Success -> {
                val extractor: (TelemetryLog) -> Double = when (selectedMetric) {
                    MetricType.VOLTAGE -> { log -> log.avgVoltage ?: 0.0 }
                    MetricType.CURRENT -> { log -> log.avgCurrent ?: 0.0 }
                    MetricType.POWER_FACTOR -> { log -> log.totalPowerFactor ?: 0.0 }
                    MetricType.FREQUENCY -> { log -> log.gridFrequency ?: 0.0 }
                    MetricType.TEMPERATURE -> { log -> log.temperature ?: 0.0 }
                }

                TelemetryLineChart(
                    logs = state.data,
                    valueExtractor = extractor,
                    unit = selectedMetric.unit,
                    lineColor = selectedMetric.color,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            is UiState.Error -> {
                Text("Error loading analytics data: ${state.message}", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            }
        }
    }
}
