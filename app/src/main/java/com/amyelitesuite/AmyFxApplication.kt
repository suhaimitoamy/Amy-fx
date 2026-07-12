package com.amyelitesuite

import android.app.Application

class AmyFxApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // FCM dapat menerima news push tanpa foreground service yang berjalan terus.
        FcmDeviceRegistrar.registerCurrentToken(this)
    }
}
