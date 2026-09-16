package com.cproeis.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

class CproeisApplication : Application() {

    companion object {
        const val CHANNEL_BOT_STATUS = "channel_bot_status"
        const val CHANNEL_VAGA_NOTIFICATIONS = "channel_vaga_notifications"
        lateinit var instance: CproeisApplication
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val statusChannel = NotificationChannel(
                CHANNEL_BOT_STATUS,
                "Status da Automação",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notificações do serviço de busca em segundo plano"
            }

            val vagaChannel = NotificationChannel(
                CHANNEL_VAGA_NOTIFICATIONS,
                "Vagas Confirmadas",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alertas sonoros e visuais de novas vagas agendadas"
                enableVibration(true)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(statusChannel)
            notificationManager.createNotificationChannel(vagaChannel)
        }
    }
}
