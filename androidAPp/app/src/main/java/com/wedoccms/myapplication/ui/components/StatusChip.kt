package com.wedoccms.myapplication.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wedoccms.myapplication.data.model.PanelState
import com.wedoccms.myapplication.ui.theme.CcmsFaultRed
import com.wedoccms.myapplication.ui.theme.CcmsOfflineGray
import com.wedoccms.myapplication.ui.theme.CcmsOnlineGreen

@Composable
fun StatusChip(
    status: PanelState,
    modifier: Modifier = Modifier
) {
    val (bgColor, textColor, dotColor, label) = when (status) {
        PanelState.ONLINE -> Quadruple(
            CcmsOnlineGreen.copy(alpha = 0.15f),
            CcmsOnlineGreen,
            CcmsOnlineGreen,
            "ONLINE"
        )
        PanelState.OFFLINE -> Quadruple(
            CcmsOfflineGray.copy(alpha = 0.15f),
            CcmsOfflineGray,
            CcmsOfflineGray,
            "OFFLINE"
        )
        PanelState.FAULT -> Quadruple(
            CcmsFaultRed.copy(alpha = 0.15f),
            CcmsFaultRed,
            CcmsFaultRed,
            "FAULT"
        )
        PanelState.UNKNOWN -> Quadruple(
            CcmsOfflineGray.copy(alpha = 0.15f),
            CcmsOfflineGray,
            CcmsOfflineGray,
            "UNKNOWN"
        )
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .border(1.dp, dotColor.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(7.dp)
                .clip(CircleShape)
                .background(dotColor)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp
        )
    }
}

private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
