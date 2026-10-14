package com.wedoccms.myapplication.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun CircularGauge(
    title: String,
    registerCode: String,
    value: Double,
    unit: String,
    min: Double = 0.0,
    max: Double = 300.0,
    gaugeColor: Color = MaterialTheme.colorScheme.primary,
    modifier: Modifier = Modifier
) {
    val progress = ((value - min) / (max - min)).coerceIn(0.0, 1.0).toFloat()
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 800),
        label = "gaugeProgress"
    )

    val trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
            .padding(14.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = title.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 0.5.sp
            )

            Text(
                text = registerCode,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = gaugeColor,
                modifier = Modifier
                    .padding(top = 2.dp, bottom = 8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(gaugeColor.copy(alpha = 0.15f))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            )

            Box(
                modifier = Modifier.size(130.dp),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.size(130.dp)) {
                    val strokeWidth = 10.dp.toPx()
                    val diameter = size.minDimension - strokeWidth
                    val topLeft = Offset(strokeWidth / 2, strokeWidth / 2)
                    val arcSize = Size(diameter, diameter)

                    val startAngle = 135f
                    val sweepAngle = 270f

                    // Background Track Arc
                    drawArc(
                        color = trackColor,
                        startAngle = startAngle,
                        sweepAngle = sweepAngle,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                    )

                    // Foreground Filled Progress Arc
                    if (animatedProgress > 0f) {
                        drawArc(
                            brush = Brush.sweepGradient(
                                colors = listOf(gaugeColor.copy(alpha = 0.6f), gaugeColor)
                            ),
                            startAngle = startAngle,
                            sweepAngle = sweepAngle * animatedProgress,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                        )
                    }
                }

                // Digital Readout Text
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (value % 1.0 == 0.0) value.toInt().toString() else String.format("%.1f", value),
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = unit,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = gaugeColor
                    )
                }
            }
        }
    }
}
