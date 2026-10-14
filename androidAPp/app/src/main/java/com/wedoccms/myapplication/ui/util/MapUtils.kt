package com.wedoccms.myapplication.ui.util

import android.content.Context
import android.content.Intent
import android.net.Uri

object MapUtils {
    fun openLocationInMaps(context: Context, lat: Double, lng: Double, label: String) {
        val uri = Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(label)})")
        val mapIntent = Intent(Intent.ACTION_VIEW, uri)
        mapIntent.setPackage("com.google.android.apps.maps")
        try {
            context.startActivity(mapIntent)
        } catch (e: Exception) {
            try {
                val genericIntent = Intent(Intent.ACTION_VIEW, uri)
                context.startActivity(genericIntent)
            } catch (ex: Exception) {
                // Ignore if no map app installed
            }
        }
    }
}
