package com.wedoccms.myapplication.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wedoccms.myapplication.data.model.TelemetryLog
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun TelemetryLineChart(
    logs: List<TelemetryLog>,
    valueExtractor: (TelemetryLog) -> Double,
    unit: String,
    lineColor: Color = MaterialTheme.colorScheme.primary,
    modifier: Modifier = Modifier
) {
    if (logs.isEmpty()) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .height(200.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
            contentAlignment = androidx.compose.ui.Alignment.Center
        ) {
            Text(
                text = "No telemetry points available",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp
            )
        }
        return
    }

    val values = logs.map { valueExtractor(it) }
    val minValue = (values.minOrNull() ?: 0.0) * 0.98
    val maxValue = (values.maxOrNull() ?: 100.0) * 1.02
    val valueRange = if (maxValue - minValue == 0.0) 1.0 else maxValue - minValue

    var selectedIndex by remember { mutableStateOf<Int?>(null) }

    val gridColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        if (selectedIndex != null && selectedIndex!! in values.indices) {
            val log = logs[selectedIndex!!]
            val timeStr = SimpleDateFormat("HH:mm:ss, dd MMM", Locale.getDefault()).format(Date(log.timestampMillis))
            Text(
                text = "Selected: ${valueExtractor(log)} $unit ($timeStr)",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = lineColor
            )
        } else {
            val latestValue = values.lastOrNull() ?: 0.0
            Text(
                text = "Latest: $latestValue $unit",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .pointerInput(logs) {
                    detectTapGestures { offset ->
                        val width = size.width
                        val stepX = width / (values.size - 1).coerceAtLeast(1)
                        val index = (offset.x / stepX).coerceIn(0f, (values.size - 1).toFloat()).toInt()
                        selectedIndex = index
                    }
                }
        ) {
            val width = size.width
            val height = size.height

            // Horizontal Grid Lines
            val gridLineCount = 4
            for (i in 0..gridLineCount) {
                val y = height * (i.toFloat() / gridLineCount)
                drawLine(
                    color = gridColor,
                    start = Offset(0f, y),
                    end = Offset(width, y),
                    strokeWidth = 1.dp.toPx()
                )
            }

            val stepX = width / (values.size - 1).coerceAtLeast(1)
            val points = values.mapIndexed { index, valItem ->
                val x = index * stepX
                val normalizedY = ((valItem - minValue) / valueRange).toFloat()
                val y = height - (normalizedY * height)
                Offset(x, y)
            }

            // Draw Area Fill Gradient
            if (points.size > 1) {
                val fillPath = Path().apply {
                    moveTo(points.first().x, points.first().y)
                    for (i in 1 until points.size) {
                        lineTo(points[i].x, points[i].y)
                    }
                    lineTo(points.last().x, height)
                    lineTo(points.first().x, height)
                    close()
                }

                drawPath(
                    path = fillPath,
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            lineColor.copy(alpha = 0.35f),
                            lineColor.copy(alpha = 0.01f)
                        )
                    )
                )

                // Draw Smooth Line
                val strokePath = Path().apply {
                    moveTo(points.first().x, points.first().y)
                    for (i in 1 until points.size) {
                        lineTo(points[i].x, points[i].y)
                    }
                }

                drawPath(
                    path = strokePath,
                    color = lineColor,
                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                )
            }

            // Draw Data Points
            points.forEachIndexed { index, pt ->
                val isSelected = index == selectedIndex
                drawCircle(
                    color = if (isSelected) Color.White else lineColor,
                    radius = if (isSelected) 6.dp.toPx() else 3.5.dp.toPx(),
                    center = pt
                )
                if (isSelected) {
                    drawCircle(
                        color = lineColor,
                        radius = 8.dp.toPx(),
                        center = pt,
                        style = Stroke(width = 2.dp.toPx())
                    )
                    // Indicator Line
                    drawLine(
                        color = lineColor.copy(alpha = 0.5f),
                        start = Offset(pt.x, 0f),
                        end = Offset(pt.x, height),
                        strokeWidth = 1.dp.toPx()
                    )
                }
            }
        }
    }
}
