package com.wedoccms.myapplication

import android.app.Application
import com.wedoccms.myapplication.data.local.AppPreferences
import com.wedoccms.myapplication.data.repository.CcmsRepository
import org.osmdroid.config.Configuration
import java.io.File

class CcmsApplication : Application() {

    lateinit var prefs: AppPreferences
        private set

    lateinit var repository: CcmsRepository
        private set

    override fun onCreate() {
        super.onCreate()
        prefs = AppPreferences(this)
        repository = CcmsRepository(prefs)

        // Osmdroid MUST be configured BEFORE any MapView instance is constructed!
        val basePath = cacheDir
        val osmdroidBasePath = File(basePath, "osmdroid_v3").apply { mkdirs() }
        val osmdroidTileCache = File(osmdroidBasePath, "tiles").apply { mkdirs() }

        Configuration.getInstance().apply {
            userAgentValue = "$packageName/1.1.0 (admin@wedoccms.com)"
            this.osmdroidBasePath = osmdroidBasePath
            this.osmdroidTileCache = osmdroidTileCache
        }
    }
}
