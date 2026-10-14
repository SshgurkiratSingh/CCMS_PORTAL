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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.wedoccms.myapplication.data.model.AlertItem
import com.wedoccms.myapplication.data.model.AlertSeverity
import com.wedoccms.myapplication.ui.components.GlassCard
import com.wedoccms.myapplication.ui.theme.CcmsCyanPrimary
import com.wedoccms.myapplication.ui.theme.CcmsFaultRed
import com.wedoccms.myapplication.ui.theme.CcmsOnlineGreen
import com.wedoccms.myapplication.ui.theme.CcmsWarningAmber
import com.wedoccms.myapplication.ui.viewmodel.CcmsViewModel
import com.wedoccms.myapplication.ui.viewmodel.UiState

@Composable
fun AlertsScreen(viewModel: CcmsViewModel) {
    val alertsState by viewModel.alertsState.collectAsState()
    var selectedSeverity by remember { mutableStateOf<AlertSeverity?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 16.dp)
    ) {
        // Header
        Text(
            text = "ALERTS & FAULT DISPATCH",
            fontSize = 11.sp,
            fontWeight = FontWeight.ExtraBold,
            color = CcmsCyanPrimary,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(top = 16.dp)
        )
        Text(
            text = "System Alarms & Node Fault Feed",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Severity Filter Chips
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                FilterChip(
                    selected = selectedSeverity == null,
                    onClick = { selectedSeverity = null },
                    label = { Text("All Alarms") },
                    shape = RoundedCornerShape(20.dp)
                )
            }
            item {
                FilterChip(
                    selected = selectedSeverity == AlertSeverity.CRITICAL,
                    onClick = { selectedSeverity = AlertSeverity.CRITICAL },
                    label = { Text("Critical") },
                    shape = RoundedCornerShape(20.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = CcmsFaultRed.copy(alpha = 0.2f),
                        selectedLabelColor = CcmsFaultRed
                    )
                )
            }
            item {
                FilterChip(
                    selected = selectedSeverity == AlertSeverity.HIGH,
                    onClick = { selectedSeverity = AlertSeverity.HIGH },
                    label = { Text("High") },
                    shape = RoundedCornerShape(20.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = CcmsWarningAmber.copy(alpha = 0.2f),
                        selectedLabelColor = CcmsWarningAmber
                    )
                )
            }
            item {
                FilterChip(
                    selected = selectedSeverity == AlertSeverity.MEDIUM,
                    onClick = { selectedSeverity = AlertSeverity.MEDIUM },
                    label = { Text("Medium") },
                    shape = RoundedCornerShape(20.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        when (val state = alertsState) {
            is UiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
            is UiState.Success -> {
                val filtered = state.data.filter { alert ->
                    selectedSeverity == null || alert.severity == selectedSeverity
                }

                if (filtered.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No active alarms matching your filter",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 13.sp
                        )
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filtered) { alert ->
                            AlertCardItem(
                                alert = alert,
                                onAcknowledge = { viewModel.acknowledgeAlert(alert.alertId) }
                            )
                        }
                        item { Spacer(modifier = Modifier.height(24.dp)) }
                    }
                }
            }
            is UiState.Error -> {
                Text("Error loading alerts: ${state.message}", color = CcmsFaultRed, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun AlertCardItem(
    alert: AlertItem,
    onAcknowledge: () -> Unit
) {
    val severityColor = when (alert.severity) {
        AlertSeverity.CRITICAL -> CcmsFaultRed
        AlertSeverity.HIGH -> CcmsWarningAmber
        AlertSeverity.MEDIUM -> MaterialTheme.colorScheme.primary
        AlertSeverity.LOW -> CcmsOnlineGreen
    }

    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        borderColor = severityColor
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = alert.severity.name,
                        tint = severityColor,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "${alert.panelId} • ${alert.faultCode}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Text(
                    text = alert.severity.name,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = severityColor,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(severityColor.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = alert.message,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Raised: ${alert.raisedAtUtc}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (alert.isAcknowledged) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Acknowledged",
                            tint = CcmsOnlineGreen,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Acknowledged",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = CcmsOnlineGreen
                        )
                    }
                } else {
                    OutlinedButton(
                        onClick = onAcknowledge,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Text(
                            text = "Acknowledge",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
