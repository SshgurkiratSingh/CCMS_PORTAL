package com.wedoccms.myapplication

import android.app.Application
import com.wedoccms.myapplication.data.local.AppPreferences
import com.wedoccms.myapplication.data.repository.CcmsRepository

class CcmsApplication : Application() {

    lateinit var prefs: AppPreferences
        private set

    lateinit var repository: CcmsRepository
        private set

    override fun onCreate() {
        super.onCreate()
        prefs = AppPreferences(this)
        repository = CcmsRepository(prefs)
    }
}
