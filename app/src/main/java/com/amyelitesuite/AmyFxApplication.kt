package com.amyelitesuite

import android.app.Application

class AmyFxApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FcmDeviceRegistrar.registerCurrentToken(this)
    }
}
