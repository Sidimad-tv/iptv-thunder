package com.iptv.tauri.player

import android.content.Context
import android.os.Bundle
import androidx.media3.common.Player
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Manages MediaSession for Android TV integration and media notifications.
 * Provides system-level media controls support.
 */
class MediaSessionManager(
    private val context: Context,
    private val player: Player
) {
    private var mediaSession: MediaSession? = null

    fun initialize() {
        val sessionCallback = object : MediaSession.Callback {
            override fun onConnect(
                session: MediaSession,
                controller: MediaSession.ControllerInfo
            ): MediaSession.ConnectionResult {
                val connectionResult = super.onConnect(session, controller)
                val availableSessionCommands = connectionResult.availableSessionCommands
                    .buildUpon()
                    .add(SessionCommand(COMMAND_TOGGLE_MUTE, Bundle.EMPTY))
                    .add(SessionCommand(COMMAND_CHANNEL_UP, Bundle.EMPTY))
                    .add(SessionCommand(COMMAND_CHANNEL_DOWN, Bundle.EMPTY))
                    .build()
                return MediaSession.ConnectionResult.accept(
                    availableSessionCommands,
                    connectionResult.availablePlayerCommands
                )
            }

            override fun onCustomCommand(
                session: MediaSession,
                controller: MediaSession.ControllerInfo,
                customCommand: SessionCommand,
                args: Bundle
            ): ListenableFuture<SessionResult> {
                return when (customCommand.customAction) {
                    COMMAND_TOGGLE_MUTE -> {
                        handleToggleMute()
                        SessionResult(SessionResult.RESULT_SUCCESS)
                    }
                    COMMAND_CHANNEL_UP -> {
                        handleChannelUp()
                        SessionResult(SessionResult.RESULT_SUCCESS)
                    }
                    COMMAND_CHANNEL_DOWN -> {
                        handleChannelDown()
                        SessionResult(SessionResult.RESULT_SUCCESS)
                    }
                    else -> SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED)
                }.let { result ->
                    Futures.immediateFuture(result)
                }
            }
        }

        mediaSession = MediaSession.Builder(context, player)
            .setCallback(sessionCallback)
            .setId(SESSION_ID)
            .build()
    }

    fun release() {
        mediaSession?.run {
            player.release()
            release()
        }
        mediaSession = null
    }

    fun getMediaSession(): MediaSession? = mediaSession

    fun setSessionActivity(activity: android.app.PendingIntent) {
        mediaSession?.setSessionActivity(activity)
    }

    private fun handleToggleMute() {
        // Callback set by activity
    }

    private fun handleChannelUp() {
        // Callback set by activity
    }

    private fun handleChannelDown() {
        // Callback set by activity
    }

    companion object {
        private const val SESSION_ID = "IPTV_Thunder_MediaSession"
        const val COMMAND_TOGGLE_MUTE = "com.iptv.tauri.TOGGLE_MUTE"
        const val COMMAND_CHANNEL_UP = "com.iptv.tauri.CHANNEL_UP"
        const val COMMAND_CHANNEL_DOWN = "com.iptv.tauri.CHANNEL_DOWN"
    }
}
