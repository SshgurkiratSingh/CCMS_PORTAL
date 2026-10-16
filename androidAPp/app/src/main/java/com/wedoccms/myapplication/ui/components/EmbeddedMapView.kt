package com.wedoccms.myapplication.ui.components

import android.content.Context
import android.graphics.Color
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
import androidx.compose.runtime.LaunchedEffect
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
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.util.MapTileIndex
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import java.io.File

@Composable
fun EmbeddedMapView(
    panels: List<SnapshotItem>,
    onPanelSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    heightDp: Int = 300
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Setup Osmdroid configuration to use internal cache (no external storage permission needed)
    LaunchedEffect(Unit) {
        val basePath = context.cacheDir
        val osmdroidBasePath = File(basePath, "osmdroid").apply { mkdirs() }
        val osmdroidTileCache = File(osmdroidBasePath, "tiles").apply { mkdirs() }
        
        Configuration.getInstance().apply {
            userAgentValue = context.packageName
            this.osmdroidBasePath = osmdroidBasePath
            this.osmdroidTileCache = osmdroidTileCache
        }
    }

    val mapView = remember {
        MapView(context).apply {
            setTileSource(
                object : OnlineTileSourceBase(
                    "CartoDbDark", 
                    1, 20, 256, ".png", 
                    arrayOf(
                        "https://a.basemaps.cartocdn.com/dark_all/",
                        "https://b.basemaps.cartocdn.com/dark_all/",
                        "https://c.basemaps.cartocdn.com/dark_all/"
                    ), 
                    "CartoDB"
                ) {
                    override fun getTileURLString(pMapTileIndex: Long): String {
                        return baseUrl + MapTileIndex.getZoom(pMapTileIndex) + "/" + MapTileIndex.getX(pMapTileIndex) + "/" + MapTileIndex.getY(pMapTileIndex) + mImageFilenameEnding + "?api_key=cb1_4mkc_1_9367ed4e7126c12bb4357abd"
                    }
                }
            )
            setMultiTouchControls(true)
            controller.setZoom(12.0)
            controller.setCenter(GeoPoint(30.7333, 76.7794))
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
                        // Pad the bounding box slightly
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
