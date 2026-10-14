package com.wedoccms.myapplication.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PinDrop
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.wedoccms.myapplication.data.model.PanelState
import com.wedoccms.myapplication.data.model.SnapshotItem
import com.wedoccms.myapplication.ui.components.GlassCard
import com.wedoccms.myapplication.ui.components.PulsingStatusBadge
import com.wedoccms.myapplication.ui.theme.CcmsBlueAccent
import com.wedoccms.myapplication.ui.theme.CcmsFaultRed
import com.wedoccms.myapplication.ui.theme.CcmsNeonCyan
import com.wedoccms.myapplication.ui.theme.CcmsOnlineGreen
import com.wedoccms.myapplication.ui.theme.CcmsTealSecondary
import com.wedoccms.myapplication.ui.viewmodel.CcmsViewModel
import com.wedoccms.myapplication.ui.viewmodel.UiState

@Composable
fun PanelsScreen(
    viewModel: CcmsViewModel,
    onNavigateToPanelDetail: (String) -> Unit,
    onNavigateToManagePanel: () -> Unit
) {
    val snapshotState by viewModel.snapshotState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf<PanelState?>(null) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            // Header
            Text(
                text = "CCMS FLEET PANELS",
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold,
                color = CcmsNeonCyan,
                letterSpacing = 1.2.sp,
                modifier = Modifier.padding(top = 16.dp)
            )
            Text(
                text = "Panel Nodes & Relay Dispatch",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search Panel ID, location, or MAC...") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = MaterialTheme.colorScheme.primary
                    )
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Filter Chips
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    FilterChip(
                        selected = selectedFilter == null,
                        onClick = { selectedFilter = null },
                        label = { Text("All Nodes") },
                        shape = RoundedCornerShape(20.dp)
                    )
                }
                item {
                    FilterChip(
                        selected = selectedFilter == PanelState.ONLINE,
                        onClick = { selectedFilter = PanelState.ONLINE },
                        label = { Text("Active") },
                        shape = RoundedCornerShape(20.dp),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = CcmsOnlineGreen.copy(alpha = 0.2f),
                            selectedLabelColor = CcmsOnlineGreen
                        )
                    )
                }
                item {
                    FilterChip(
                        selected = selectedFilter == PanelState.FAULT,
                        onClick = { selectedFilter = PanelState.FAULT },
                        label = { Text("Fault") },
                        shape = RoundedCornerShape(20.dp),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = CcmsFaultRed.copy(alpha = 0.2f),
                            selectedLabelColor = CcmsFaultRed
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Panels List
            when (val state = snapshotState) {
                is UiState.Loading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = 80.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                }
                is UiState.Success -> {
                    val filtered = state.data.filter { snapshot ->
                        val meta = snapshot.metadata
                        val matchesSearch = searchQuery.isBlank() ||
                                meta.panelId.contains(searchQuery, ignoreCase = true) ||
                                meta.displayLocation.contains(searchQuery, ignoreCase = true) ||
                                (meta.macAddress?.contains(searchQuery, ignoreCase = true) == true)
                        val matchesFilter = selectedFilter == null || meta.status == selectedFilter
                        matchesSearch && matchesFilter
                    }

                    if (filtered.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No CCMS panel nodes match your query",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 13.sp
                            )
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(filtered) { snapshot ->
                                PanelDetailedCardItem(
                                    snapshot = snapshot,
                                    onToggleRelay = { turnOn ->
                                        viewModel.toggleRelay(snapshot.metadata.panelId, turnOn)
                                    },
                                    onClick = { onNavigateToPanelDetail(snapshot.metadata.panelId) }
                                )
                            }
                            item { Spacer(modifier = Modifier.height(80.dp)) }
                        }
                    }
                }
                is UiState.Error -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Error loading panels: ${state.message}",
                            color = CcmsFaultRed,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        // Floating Action Button to Register Panel
        FloatingActionButton(
            onClick = onNavigateToManagePanel,
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        ) {
            Icon(imageVector = Icons.Default.Add, contentDescription = "Register New Panel")
        }
    }
}

@Composable
private fun PanelDetailedCardItem(
    snapshot: SnapshotItem,
    onToggleRelay: (Boolean) -> Unit,
    onClick: () -> Unit
) {
    val meta = snapshot.metadata
    val latestLog = snapshot.recentLogs.firstOrNull()
    val isRelayOn = meta.isRelayActive

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
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        PulsingStatusBadge(status = meta.status)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.PinDrop,
                            contentDescription = "Location",
                            tint = CcmsNeonCyan,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = meta.displayLocation,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                IconButton(
                    onClick = { onToggleRelay(!isRelayOn) },
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isRelayOn) CcmsOnlineGreen.copy(alpha = 0.15f) else CcmsFaultRed.copy(alpha = 0.15f))
                ) {
                    Icon(
                        imageVector = Icons.Default.PowerSettingsNew,
                        contentDescription = "Toggle Relay",
                        tint = if (isRelayOn) CcmsOnlineGreen else CcmsFaultRed
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Metadata Chips Row (Rated KVA, Hardware, Firmware)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Rated: ${meta.ratedKva ?: 100.0} kVA",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = CcmsNeonCyan,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(CcmsNeonCyan.copy(alpha = 0.12f))
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                )
                Text(
                    text = "HW: ${meta.hardware ?: "ESP32-Modbus"}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = CcmsTealSecondary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(CcmsTealSecondary.copy(alpha = 0.12f))
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                )
                Text(
                    text = "FW: ${meta.firmware ?: "1.0.2"}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = CcmsBlueAccent,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(CcmsBlueAccent.copy(alpha = 0.12f))
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Schneider Meter Telemetry Metrics
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .padding(10.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Avg Voltage", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${latestLog?.avgVoltage ?: "--"} V", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CcmsNeonCyan)
                }
                Column {
                    Text("Avg Current", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${latestLog?.avgCurrent ?: "--"} A", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CcmsTealSecondary)
                }
                Column {
                    Text("Power Factor", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${latestLog?.totalPowerFactor ?: "--"}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CcmsBlueAccent)
                }
                Column {
                    Text("Power Vector", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${latestLog?.powerVector ?: "--"} kW", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}
