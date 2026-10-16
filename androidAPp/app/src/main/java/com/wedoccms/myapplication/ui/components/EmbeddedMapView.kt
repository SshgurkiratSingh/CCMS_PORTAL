package com.wedoccms.myapplication.ui.components

import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.wedoccms.myapplication.data.model.PanelState
import com.wedoccms.myapplication.data.model.SnapshotItem
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

@Composable
fun EmbeddedMapView(
    panels: List<SnapshotItem>,
    onPanelSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    heightDp: Int = 300
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val mapView = remember {
        MapView(context).apply {
            // Standard OpenStreetMap Mapnik tiles
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            controller.setZoom(12.0)
            controller.setCenter(GeoPoint(30.7333, 76.7794))

            // Color Matrix to invert light map into dark theme
            val inverseMatrix = ColorMatrix(
                floatArrayOf(
                    -1.0f, 0.0f, 0.0f, 0.0f, 255f,
                    0.0f, -1.0f, 0.0f, 0.0f, 255f,
                    0.0f, 0.0f, -1.0f, 0.0f, 255f,
                    0.0f, 0.0f, 0.0f, 1.0f, 0.0f
                )
            )
            overlayManager.tilesOverlay.setColorFilter(ColorMatrixColorFilter(inverseMatrix))
        }
    }

    // Manage MapView lifecycle
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            mapView.onDetach()
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(heightDp.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
    ) {
        AndroidView(
            modifier = Modifier.fillMaxWidth().height(heightDp.dp),
            factory = { mapView },
            update = { map ->
                map.overlays.clear()
                val points = mutableListOf<GeoPoint>()

                panels.forEach { panel ->
                    val meta = panel.metadata
                    val lat = meta.location?.coordinates?.lat ?: 30.7333
                    val lng = meta.location?.coordinates?.lng ?: 76.7794
                    val geoPoint = GeoPoint(lat, lng)
                    points.add(geoPoint)

                    val marker = Marker(map).apply {
                        position = geoPoint
                        title = meta.panelId
                        snippet = meta.displayLocation
                        icon = createStatusIcon(meta.status)
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        setOnMarkerClickListener { m, _ ->
                            m.showInfoWindow()
                            onPanelSelect(meta.panelId)
                            true
                        }
                    }
                    map.overlays.add(marker)
                }

                if (points.isNotEmpty()) {
                    if (points.size == 1) {
                        map.controller.setCenter(points.first())
                        map.controller.setZoom(14.0)
                    } else {
                        val boundingBox = BoundingBox.fromGeoPoints(points)
                        map.post {
                            map.zoomToBoundingBox(boundingBox, true, 100)
                        }
                    }
                }
                map.invalidate()
            }
        )
    }
}

private fun createStatusIcon(status: PanelState): Drawable {
    val color = when (status) {
        PanelState.ONLINE -> Color.parseColor("#10B981")
        PanelState.FAULT -> Color.parseColor("#FF3366")
        else -> Color.parseColor("#64748B")
    }
    return GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
        setStroke(4, Color.WHITE)
        setSize(40, 40)
    }
}
