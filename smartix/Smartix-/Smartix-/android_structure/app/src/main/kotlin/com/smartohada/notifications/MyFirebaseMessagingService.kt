package com.smartohada.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.smartohada.MainActivity // Remplacez par votre activité principale

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // 1. Gérer les données de la notification (Deep Linking)
        val data = remoteMessage.data
        val screen = data["screen"]
        val id = data["id"] ?: data["postId"] ?: data["conversationId"]

        // 2. Afficher la notification si elle contient un corps
        remoteMessage.notification?.let {
            sendNotification(it.title ?: "SmartOHADA", it.body ?: "", screen, id)
        }
    }

    override fun onNewToken(token: String) {
        // Envoyer le nouveau token au backend
        sendTokenToServer(token)
    }

    private fun sendNotification(title: String, body: String, screen: String?, id: String?) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            // Passer les données de routage à l'activité
            putExtra("screen", screen)
            putExtra("id", id)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "smartohada_notifications"
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Remplacez par votre icône
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "SmartOHADA Notifications",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(0, notificationBuilder.build())
    }

    private fun sendTokenToServer(token: String) {
        // TODO: Appeler votre endpoint POST /api/notifications/register-token
    }
}
