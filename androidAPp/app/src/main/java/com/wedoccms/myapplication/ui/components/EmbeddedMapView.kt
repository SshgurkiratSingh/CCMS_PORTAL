package com.wedoccms.myapplication.ui.components

import android.annotation.SuppressLint
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.wedoccms.myapplication.data.model.SnapshotItem

class MapWebAppInterface(private val onPanelSelect: (String) -> Unit) {
    @JavascriptInterface
    fun onPanelClick(panelId: String) {
        onPanelSelect(panelId)
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun EmbeddedMapView(
    panels: List<SnapshotItem>,
    onPanelSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    heightDp: Int = 300
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(heightDp.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                WebView(context).apply {
                    webViewClient = WebViewClient()
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    addJavascriptInterface(MapWebAppInterface(onPanelSelect), "AndroidBridge")

                    val markersJson = buildString {
                        append("[")
                        panels.forEachIndexed { index, snapshot ->
                            val meta = snapshot.metadata
                            val lat = meta.location?.coordinates?.lat ?: 30.7333
                            val lng = meta.location?.coordinates?.lng ?: 76.7794
                            val statusColor = when (meta.status) {
                                com.wedoccms.myapplication.data.model.PanelState.ONLINE -> "#10B981"
                                com.wedoccms.myapplication.data.model.PanelState.FAULT -> "#FF3366"
                                else -> "#64748B"
                            }
                            append("""
                                {
                                    "id": "${meta.panelId}",
                                    "place": "${meta.displayLocation.replace("\"", "\\\"")}",
                                    "lat": $lat,
                                    "lng": $lng,
                                    "color": "$statusColor",
                                    "status": "${meta.status.name}"
                                }
                            """)
                            if (index < panels.size - 1) append(",")
                        }
                        append("]")
                    }

                    val htmlContent = """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                            <style>
                                body { margin: 0; padding: 0; background-color: #080C14; }
                                #map { height: 100vh; width: 100vw; background: #080C14; }
                                .leaflet-popup-content-wrapper {
                                    background: #0F172A;
                                    color: #F8FAFC;
                                    border: 1px solid #00F0FF;
                                    border-radius: 12px;
                                    font-family: sans-serif;
                                    font-size: 12px;
                                }
                                .leaflet-popup-tip { background: #0F172A; }
                                .inspect-btn {
                                    background: #00F0FF;
                                    color: #080C14;
                                    border: none;
                                    padding: 6px 12px;
                                    border-radius: 6px;
                                    font-weight: bold;
                                    cursor: pointer;
                                    margin-top: 6px;
                                    width: 100%;
                                }
                            </style>
                        </head>
                        <body>
                            <div id="map"></div>
                            <script>
                                var map = L.map('map', { zoomControl: false }).setView([30.7333, 76.7794], 12);
                                
                                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                                    attribution: '&copy; CartoDB &copy; OpenStreetMap',
                                    subdomains: 'abcd',
                                    maxZoom: 19
                                }).addTo(map);

                                var markers = $markersJson;
                                var bounds = [];

                                markers.forEach(function(m) {
                                    var customIcon = L.divIcon({
                                        className: 'custom-div-icon',
                                        html: "<div style='background-color:" + m.color + "; width:16px; height:16px; border-radius:50%; border:3px solid #FFFFFF; box-shadow: 0 0 10px " + m.color + ";'></div>",
                                        iconSize: [16, 16],
                                        iconAnchor: [8, 8]
                                    });

                                    var marker = L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);
                                    bounds.push([m.lat, m.lng]);

                                    var popupContent = "<div style='text-align:center;'><b>" + m.id + "</b><br/>" + m.place + "<br/><span style='color:" + m.color + ";font-weight:bold;'>" + m.status + "</span><br/><button class='inspect-btn' onclick='window.AndroidBridge.onPanelClick(\"" + m.id + "\")'>Inspect Console</button></div>";
                                    marker.bindPopup(popupContent);
                                });

                                if (bounds.length > 0) {
                                    map.fitBounds(bounds, { padding: [30, 30] });
                                }
                            </script>
                        </body>
                        </html>
                    """.trimIndent()

                    loadDataWithBaseURL("https://leafletjs.com", htmlContent, "text/html", "UTF-8", null)
                }
            }
        )
    }
}
