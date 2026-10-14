package com.wedoccms.myapplication.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wedoccms.myapplication.data.model.RtcSchedule

@Composable
fun ScheduleDialog(
    initialSchedule: RtcSchedule?,
    onDismiss: () -> Unit,
    onSaveSchedule: (RtcSchedule) -> Unit
) {
    var startTime by remember { mutableStateOf(initialSchedule?.startLocalTime ?: "18:30") }
    var endTime by remember { mutableStateOf(initialSchedule?.endLocalTime ?: "06:00") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Configure Auto RTC Schedule",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Specify local times (24-hour format HH:MM) for automated dusk-to-dawn relay operation.",
                    fontSize = 12.sp
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = startTime,
                    onValueChange = { startTime = it },
                    label = { Text("Auto Turn-ON Local Time (e.g. 18:30)") },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = endTime,
                    onValueChange = { endTime = it },
                    label = { Text("Auto Turn-OFF Local Time (e.g. 06:00)") },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSaveSchedule(
                        RtcSchedule(
                            startLocalTime = startTime.trim(),
                            endLocalTime = endTime.trim()
                        )
                    )
                }
            ) {
                Text("Save Schedule")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
