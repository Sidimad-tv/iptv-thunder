package com.iptv.tauri.player

import android.content.Context
import android.content.SharedPreferences
import android.view.View
import android.widget.TextView
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.security.MessageDigest
import java.util.Base64

class ResumeManager(
    context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val portalIdentifier: String
) {
    companion object {
        private const val PREFS_NAME = "iptv-resume-positions"
        private const val NOTIFICATION_HIDE_DELAY_MS = 3000L
        private const val MIN_WATCH_TIME_MS = 30000L // 30 seconds minimum
    }

    private val sharedPreferences: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private var notificationJob: Job? = null

    var resumeLoaded = false
        private set

    data class ResumeInfo(
        val position: Long,
        val duration: Long,
        val timestamp: Long
    )

    // MovieProgress structure matching desktop version
    private data class MovieProgress(
        val position: Long,
        val duration: Long,
        val status: String,
        val lastWatched: Long,
        val percentage: Int
    )

    fun markResumeLoaded() {
        resumeLoaded = true
    }

    fun resetResumeLoaded() {
        resumeLoaded = false
    }

    fun savePosition(url: String, position: Long, duration: Long) {
        android.util.Log.d("ResumeManager", "savePosition: url=$url, position=$position, duration=$duration, portalIdentifier=$portalIdentifier")
        if (position > MIN_WATCH_TIME_MS && duration > 0 && position < duration - 1000) {
            val key = getStableKey(url, portalIdentifier)
            val percentage = if (duration > 0) ((position.toFloat() / duration) * 100).toInt() else 0

            // Determine status (matching desktop logic)
            val status = when {
                percentage >= 90 -> "watched"
                position >= MIN_WATCH_TIME_MS -> "in_progress"
                else -> "not_started"
            }

            val progress = MovieProgress(
                position = position,
                duration = duration,
                status = status,
                lastWatched = System.currentTimeMillis(),
                percentage = percentage
            )

            val moviesJson = getMoviesJson()
            moviesJson.put(key, JSONObject().apply {
                put("position", progress.position)
                put("duration", progress.duration)
                put("status", progress.status)
                put("lastWatched", progress.lastWatched)
                put("percentage", progress.percentage)
            })

            sharedPreferences.edit().putString("movies", moviesJson.toString()).apply()
            android.util.Log.d("ResumeManager", "Position saved successfully for key=$key")
        } else {
            android.util.Log.d("ResumeManager", "Position not saved: position=$position, MIN_WATCH_TIME_MS=$MIN_WATCH_TIME_MS, duration=$duration")
        }
    }

    fun loadPosition(url: String): ResumeInfo? {
        android.util.Log.d("ResumeManager", "loadPosition: url=$url, portalIdentifier=$portalIdentifier")
        val key = getStableKey(url, portalIdentifier)
        val moviesJson = getMoviesJson()

        android.util.Log.d("ResumeManager", "Looking for key=$key in movies")
        if (moviesJson.has(key)) {
            val progressJson = moviesJson.getJSONObject(key)
            val position = progressJson.getLong("position")
            val duration = progressJson.getLong("duration")

            android.util.Log.d("ResumeManager", "Found position=$position, duration=$duration")
            return if (position > MIN_WATCH_TIME_MS && duration > 0) {
                ResumeInfo(
                    position = position,
                    duration = duration,
                    timestamp = progressJson.getLong("lastWatched")
                )
            } else null
        } else {
            android.util.Log.d("ResumeManager", "No resume data found for key=$key")
        }
        return null
    }

    fun clearPosition(url: String) {
        val key = getStableKey(url, portalIdentifier)
        val moviesJson = getMoviesJson()

        if (moviesJson.has(key)) {
            moviesJson.remove(key)
            sharedPreferences.edit().putString("movies", moviesJson.toString()).apply()
        }
    }

    fun shouldResume(url: String, currentDuration: Long): Boolean {
        val info = loadPosition(url) ?: return false

        return if (currentDuration > 0 && currentDuration != C.TIME_UNSET) {
            info.position < currentDuration - 1000
        } else {
            true
        }
    }

    private fun getMoviesJson(): JSONObject {
        val moviesStr = sharedPreferences.getString("movies", "{}")
        return try {
            JSONObject(moviesStr ?: "{}")
        } catch (e: Exception) {
            JSONObject()
        }
    }

    fun showResumeNotification(position: Long, epgTextView: TextView?, formatTime: (Long) -> String) {
        notificationJob?.cancel() // Cancel any pending hide

        epgTextView?.text = "Resuming from ${formatTime(position)}"
        epgTextView?.visibility = View.VISIBLE

        notificationJob = lifecycleOwner.lifecycleScope.launch {
            delay(NOTIFICATION_HIDE_DELAY_MS)
            epgTextView?.visibility = View.GONE
        }
    }

    fun release() {
        notificationJob?.cancel()
        notificationJob = null
    }

    private fun getStableKey(url: String, portalIdentifier: String): String {
        // Use SHA-256 hash for stable key generation with portal identifier
        // This ensures resume data is portal-specific
        // Remove play_token from URL as it changes on each request
        val stableUrl = url.replace(Regex("[?&]play_token=[^&]*"), "")
        val combined = "$portalIdentifier:$stableUrl"
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(combined.toByteArray(Charsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hashBytes)
    }
}
