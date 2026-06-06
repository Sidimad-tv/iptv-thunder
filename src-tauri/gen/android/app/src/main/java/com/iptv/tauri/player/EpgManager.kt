package com.iptv.tauri.player

import android.view.View
import android.widget.TextView
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class EpgInfo(
    val title: String,
    val start: String,
    val end: String,
    val startMin: Int = 0,
    val endMin: Int = 0,
    val nextTitle: String = "",
    val nextStart: String = "",
    val nextEnd: String = "",
    val category: String = "",
    val nextCategory: String = ""
)

class EpgManager(
    private val lifecycleOwner: LifecycleOwner,
    private val epgCard: androidx.cardview.widget.CardView?,
    private val epgCurrentTime: TextView?,
    private val epgCurrentTitle: TextView?,
    private val epgCurrentCategory: TextView?,
    private val epgCurrentProgressText: TextView?,
    private val epgProgressBar: android.widget.ProgressBar?,
    private val epgNextContainer: android.view.View?,
    private val epgNextTime: TextView?,
    private val epgNextTitle: TextView?,
    private val epgNextCategory: TextView?,
    private val getPlayerPosition: () -> Long,
    private val getPlayerDuration: () -> Long,
    private val isLive: () -> Boolean,
    private val formatTime: (Long) -> String
) {
    companion object {
        private const val EPG_REFRESH_INTERVAL_MS = 60_000L
        private const val PROGRESS_UPDATE_INTERVAL_MS = 1000L
    }

    @Volatile
    var currentEpg: EpgInfo? = null
        private set

    private var epgJob: Job? = null
    private var progressJob: Job? = null

    fun start(isVod: Boolean) {
        stop() // Cancel any existing jobs

        progressJob = lifecycleOwner.lifecycleScope.launch {
            while (isActive) {
                updateProgress()
                delay(PROGRESS_UPDATE_INTERVAL_MS)
            }
        }

        if (!isVod) {
            epgJob = lifecycleOwner.lifecycleScope.launch {
                while (isActive) {
                    refreshEpg()
                    delay(EPG_REFRESH_INTERVAL_MS)
                }
            }
        }
    }

    fun stop() {
        epgJob?.cancel()
        epgJob = null
    }

    fun updateEpg(title: String, start: String, end: String, nextTitle: String = "", nextStart: String = "", nextEnd: String = "", category: String = "", nextCategory: String = "") {
        val startMin = parseTimeToMinutes(start)
        val endMin = parseTimeToMinutes(end)
        currentEpg = EpgInfo(title, start, end, startMin, endMin, nextTitle, nextStart, nextEnd, category, nextCategory)
        updateProgress()
    }

    fun resetEpg() {
        currentEpg = null
        epgCard?.visibility = android.view.View.GONE
    }

    private fun parseTimeToMinutes(time: String): Int {
        return try {
            val parts = time.split(":")
            if (parts.size == 2) {
                val hours = parts[0].toInt()
                val minutes = parts[1].toInt()
                hours * 60 + minutes
            } else 0
        } catch (e: Exception) {
            0
        }
    }

    fun updateProgress() {
        val epg = currentEpg
        val duration = getPlayerDuration()
        val position = getPlayerPosition()

        // VOD progress
        if (duration > 0 && duration != C.TIME_UNSET && !isLive()) {
            val progress = ((position.toFloat() / duration) * 100).coerceIn(0f, 100f)

            epgCard?.post {
                epgCard.visibility = View.VISIBLE
                epgCurrentTime?.text = formatTime(position)
                epgCurrentTitle?.text = "Video Playback"
                epgCurrentCategory?.visibility = View.GONE
                epgCurrentProgressText?.text = "${String.format("%.0f%%", progress)}"
                epgProgressBar?.progress = progress.toInt()
                epgNextContainer?.visibility = View.GONE
            }
            return
        }

        // Live TV EPG
        epg?.let { info ->
            // Get current time in minutes since midnight (not since epoch)
            val calendar = java.util.Calendar.getInstance()
            val now = calendar.get(java.util.Calendar.HOUR_OF_DAY) * 60 + calendar.get(java.util.Calendar.MINUTE)
            val startMin = info.startMin
            val endMin = info.endMin

            val progress = if (startMin == 0 || endMin == 0) {
                0f
            } else {
                val adjustedEndMin = if (endMin < startMin) endMin + 24 * 60 else endMin
                val adjustedNow = if (now < startMin && endMin < startMin) now + 24 * 60 else now

                when {
                    adjustedNow >= startMin && adjustedNow <= adjustedEndMin ->
                        ((adjustedNow - startMin).toFloat() / (adjustedEndMin - startMin)) * 100
                    adjustedNow > adjustedEndMin -> 100f
                    else -> 0f
                }.coerceIn(0f, 100f)
            }

            epgCard?.post {
                epgCard.visibility = View.VISIBLE

                // Current program
                epgCurrentTime?.text = info.start
                epgCurrentTitle?.text = info.title

                if (info.category.isNotEmpty()) {
                    epgCurrentCategory?.text = info.category
                    epgCurrentCategory?.visibility = View.VISIBLE
                } else {
                    epgCurrentCategory?.visibility = View.GONE
                }

                epgCurrentProgressText?.text = "${String.format("%.0f%%", progress)}"
                epgProgressBar?.progress = progress.toInt()

                // Next program
                if (info.nextTitle.isNotEmpty()) {
                    epgNextContainer?.visibility = View.VISIBLE
                    epgNextTime?.text = info.nextStart
                    epgNextTitle?.text = info.nextTitle

                    if (info.nextCategory.isNotEmpty()) {
                        epgNextCategory?.text = info.nextCategory
                        epgNextCategory?.visibility = View.VISIBLE
                    } else {
                        epgNextCategory?.visibility = View.GONE
                    }
                } else {
                    epgNextContainer?.visibility = View.GONE
                }
            }
        }
    }

    private suspend fun refreshEpg() {
        // EPG refresh is now handled by the TypeScript side
        // The initial EPG data is passed when opening the player
        // Future refreshes could be implemented via Tauri commands if needed
        try {
            // For now, we don't auto-refresh EPG from Android side
            // The data is provided by the JavaScript layer
            android.util.Log.d("EpgManager", "EPG refresh skipped - data provided by JS layer")
        } catch (e: Exception) {
            android.util.Log.e("EpgManager", "Failed to refresh EPG", e)
        }
    }

    fun release() {
        epgJob?.cancel()
        progressJob?.cancel()
        epgJob = null
        progressJob = null
    }
}
