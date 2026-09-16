package com.cproeis.app.service

import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.cproeis.app.CproeisApplication
import com.cproeis.app.R
import com.cproeis.app.api.ApiClient
import com.cproeis.app.ui.main.MainActivity
import kotlinx.coroutines.*

class BotForegroundService : Service() {

    private val serviceJob = Job()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)
    private var isRunning = false
    private var lastVagasCount = 0

    companion object {
        const val NOTIFICATION_ID = 1001

        fun startService(context: Context) {
            val intent = Intent(context, BotForegroundService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, BotForegroundService::class.java)
            context.stopService(intent)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification("Automação CPROEIS em execução", "Varrendo vagas no portal...")
        startForeground(NOTIFICATION_ID, notification)

        if (!isRunning) {
            isRunning = true
            startMonitoring()
        }

        return START_STICKY
    }

    private fun startMonitoring() {
        serviceScope.launch {
            val api = ApiClient.getService(applicationContext)
            while (isRunning) {
                try {
                    val statusRes = api.getBotStatus()
                    if (statusRes.isSuccessful && statusRes.body() != null) {
                        val body = statusRes.body()!!
                        if (body.status != "running") {
                            // Concluído ou interrompido
                            showVagaNotification("Busca CPROEIS Finalizada", "Status: ${body.status.uppercase()}")
                            stopSelf()
                            break
                        }
                    }

                    val reportRes = api.getVagasReport()
                    if (reportRes.isSuccessful && reportRes.body() != null) {
                        val count = reportRes.body()!!.summary?.total ?: (reportRes.body()!!.vagas?.size ?: 0)
                        if (count > lastVagasCount) {
                            val newVagas = count - lastVagasCount
                            showVagaNotification(
                                "Vaga Confirmada no CPROEIS!",
                                "Foram agendadas $count vaga(s) com sucesso!"
                            )
                            lastVagasCount = count
                        }
                    }
                } catch (e: Exception) {
                    // Erro de rede temporário
                }
                delay(3000)
            }
        }
    }

    private fun showVagaNotification(title: String, message: String) {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            val pendingIntent = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            val notif = NotificationCompat.Builder(this, CproeisApplication.CHANNEL_VAGA_NOTIFICATIONS)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build()

            NotificationManagerCompat.from(this).notify(System.currentTimeMillis().toInt(), notif)
        } catch (e: SecurityException) {
            // Permissão de notificação Android 13+
        }
    }

    private fun createNotification(title: String, content: String) =
        NotificationCompat.Builder(this, CproeisApplication.CHANNEL_BOT_STATUS)
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentTitle(title)
            .setContentText(content)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    override fun onDestroy() {
        isRunning = false
        serviceJob.cancel()
        super.onDestroy()
    }
}
