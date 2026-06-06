package com.iptv.tauri.player

import android.view.View
import android.view.ViewGroup
import android.widget.SeekBar
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.widget.AppCompatSeekBar
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
import androidx.media3.ui.PlayerView
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class UiController(
    private val lifecycleOwner: LifecycleOwner,
    private val playerView: PlayerView?,
    private val headerContainer: View?,
    private val controlsContainer: View?,
    private val channelNameTextView: TextView?,
    private val liveLabelTextView: TextView?,
    private val qualityLabelTextView: TextView?,
    private val currentTimeTextView: TextView?,
    private val durationTimeTextView: TextView?,
    private val seekBar: AppCompatSeekBar?,
    private val playPauseButton: MaterialButton?,
    private val seekForwardButton: MaterialButton?,
    private val seekBackwardButton: MaterialButton?,
    private val seekToBeginningButton: MaterialButton?,
    private val trackSelectButton: MaterialButton?,
    private val statusIndicator: View?,
    private val getDuration: () -> Long,
    private val onSeek: (positionMs: Long) -> Unit,
    private val onPlayPause: () -> Unit,
    private val onSeekForward: () -> Unit,
    private val onSeekBackward: () -> Unit,
    private val onSeekToBeginning: () -> Unit = {},
    private val formatTime: (Long) -> String,
    private val getTrackInfo: () -> PlayerController.PlayerUiState? = { null },
    private val onSelectAudioTrack: (String?) -> Unit = {},
    private val onSelectSubtitleTrack: (String?) -> Unit = {}
) {
    companion object {
        private const val HIDE_DELAY_MS = 5000L
    }

    private var hideJob: Job? = null
    private var autoHidePaused = false

    var showControls = true
        private set
    var isSeeking = false
        private set

    private val focusableButtons by lazy {
        listOf(seekToBeginningButton, playPauseButton, seekBackwardButton, seekForwardButton, trackSelectButton)
    }

    private var currentTrackInfo: PlayerController.PlayerUiState? = null

    init {
        setupPlayerView()
        setupFocusNavigation()
        setupSeekBar()
        setupButtons()
        setupFocusVisuals()
        setupTrackButton()
    }

    private fun setupPlayerView() {
        playerView?.isFocusable = false
        playerView?.isFocusableInTouchMode = false
        playerView?.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS

        playerView?.setOnClickListener {
            toggleControls()
        }
    }

    private fun setupFocusNavigation() {
        playPauseButton?.isFocusable = true
        seekForwardButton?.isFocusable = true
        seekBackwardButton?.isFocusable = true
        seekToBeginningButton?.isFocusable = true
        trackSelectButton?.isFocusable = true

        playPauseButton?.nextFocusRightId = seekForwardButton?.id ?: 0
        playPauseButton?.nextFocusLeftId = seekBackwardButton?.id ?: 0
        seekBackwardButton?.nextFocusRightId = playPauseButton?.id ?: 0
        seekBackwardButton?.nextFocusLeftId = seekToBeginningButton?.id ?: 0
        seekToBeginningButton?.nextFocusRightId = seekBackwardButton?.id ?: 0
        seekForwardButton?.nextFocusLeftId = playPauseButton?.id ?: 0
        seekForwardButton?.nextFocusRightId = trackSelectButton?.id ?: 0
        trackSelectButton?.nextFocusLeftId = seekForwardButton?.id ?: 0
    }

    private fun setupTrackButton() {
        trackSelectButton?.setOnClickListener {
            showTrackSelectionDialog()
            resetHideTimer()
        }
    }

    private fun showTrackSelectionDialog() {
        val trackInfo = currentTrackInfo ?: getTrackInfo() ?: return

        val audioTracks = trackInfo.audioTracks
        val subtitleTracks = trackInfo.subtitleTracks

        if (audioTracks.size <= 1 && subtitleTracks.isEmpty()) return

        val dialogBuilder = AlertDialog.Builder(playPauseButton?.context ?: return)
        dialogBuilder.setTitle("Audio & Subtitles")

        val items = mutableListOf<String>()
        val actions = mutableListOf<() -> Unit>()

        // Audio section
        if (audioTracks.size > 1) {
            items.add("━━ Audio ━━")
            actions.add({})
            audioTracks.forEach { track ->
                val prefix = if (track.isSelected) "● " else "○ "
                items.add(prefix + track.label)
                actions.add({ onSelectAudioTrack(track.id) })
            }
        }

        // Subtitle section
        if (subtitleTracks.isNotEmpty()) {
            if (items.isNotEmpty()) {
                items.add("")
                actions.add({})
            }
            items.add("━━ Subtitles ━━")
            actions.add({})
            items.add((if (trackInfo.currentSubtitleTrackId == null) "● " else "○ ") + "Disabled")
            actions.add({ onSelectSubtitleTrack(null) })
            subtitleTracks.forEach { track ->
                val prefix = if (trackInfo.currentSubtitleTrackId == track.id) "● " else "○ "
                items.add(prefix + track.label)
                actions.add({ onSelectSubtitleTrack(track.id) })
            }
        }

        dialogBuilder.setItems(items.toTypedArray()) { _, which ->
            actions.getOrNull(which)?.invoke()
        }

        dialogBuilder.setNegativeButton("Close") { dialog, _ ->
            dialog.dismiss()
        }

        val dialog = dialogBuilder.create()
        dialog.show()
    }

    fun updateTrackButtonVisibility(hasMultipleTracks: Boolean) {
        trackSelectButton?.visibility = if (hasMultipleTracks) View.VISIBLE else View.GONE
    }

    fun updateSeekToBeginningButtonVisibility(isVod: Boolean) {
        seekToBeginningButton?.visibility = if (isVod) View.VISIBLE else View.GONE
    }

    fun updatePlayPauseButtonVisibility(isVod: Boolean) {
        playPauseButton?.visibility = if (isVod) View.VISIBLE else View.GONE
    }

    fun updateTrackInfo(info: PlayerController.PlayerUiState) {
        currentTrackInfo = info
        updateTrackButtonVisibility(info.hasMultipleTracks)
    }

    private fun setupSeekBar() {
        seekBar?.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    updateTimeLabelsFromProgress(progress)
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {
                isSeeking = true
            }

            override fun onStopTrackingTouch(seekBar: SeekBar?) {
                isSeeking = false
                val progress = seekBar?.progress ?: 0
                val duration = getDuration()
                if (duration > 0) {
                    val position = (duration * progress / 1000).toLong()
                    onSeek(position)
                }
            }
        })
    }

    private fun setupButtons() {
        playPauseButton?.setOnClickListener {
            onPlayPause()
            resetHideTimer()
        }

        seekForwardButton?.setOnClickListener {
            onSeekForward()
            resetHideTimer()
        }

        seekBackwardButton?.setOnClickListener {
            onSeekBackward()
            resetHideTimer()
        }

        seekToBeginningButton?.setOnClickListener {
            onSeekToBeginning()
            resetHideTimer()
        }
    }

    private fun setupFocusVisuals() {
        focusableButtons.forEach { btn ->
            btn?.setOnFocusChangeListener { v, hasFocus ->
                resetAllButtonVisuals()
                if (hasFocus) {
                    v.scaleX = 1.1f
                    v.scaleY = 1.1f
                    v.alpha = 1f
                }
            }
        }
    }

    private fun resetAllButtonVisuals() {
        focusableButtons.forEach { btn ->
            btn?.scaleX = 1f
            btn?.scaleY = 1f
            btn?.alpha = 0.8f
        }
    }

    private fun updateTimeLabelsFromProgress(progress: Int) {
        val duration = getDuration()
        if (duration > 0) {
            val position = (duration * progress / 1000).toLong()
            currentTimeTextView?.text = formatTime(position)
            durationTimeTextView?.text = formatTime(duration)
        }
    }

    fun setChannelName(name: String) {
        channelNameTextView?.text = name
    }

    fun updatePlayPauseButton(isPlaying: Boolean) {
        playPauseButton?.text = if (isPlaying) "⏸" else "▶"
    }

    fun updateStatusIndicator(isPlaying: Boolean) {
        statusIndicator?.setBackgroundColor(
            if (isPlaying) android.graphics.Color.GREEN
            else android.graphics.Color.GRAY
        )
    }

    fun updateStateLabel(state: String) {
        liveLabelTextView?.text = state
    }

    fun updateQualityLabel(quality: String) {
        qualityLabelTextView?.text = quality
        qualityLabelTextView?.visibility = if (quality.isNotEmpty()) View.VISIBLE else View.GONE
    }

    fun updateSeekBar(progress: Float, duration: Long, currentPosition: Long, isVod: Boolean) {
        if (!isSeeking) {
            seekBar?.max = 1000
            seekBar?.progress = (progress * 10).toInt()
        }

        if (isVod && duration > 0 && duration != C.TIME_UNSET) {
            seekBar?.visibility = View.VISIBLE
            currentTimeTextView?.text = formatTime(currentPosition)
            durationTimeTextView?.text = formatTime(duration)
            currentTimeTextView?.visibility = View.VISIBLE
            durationTimeTextView?.visibility = View.VISIBLE
        } else {
            seekBar?.visibility = View.GONE
            currentTimeTextView?.visibility = View.GONE
            durationTimeTextView?.visibility = View.GONE
        }
    }

    fun toggleControls() {
        if (showControls) hideControls() else showControls()
    }

    fun showControls() {
        showControls = true
        headerContainer?.visibility = View.VISIBLE
        controlsContainer?.visibility = View.VISIBLE
        resetHideTimer()
    }

    fun hideControls() {
        showControls = false
        headerContainer?.visibility = View.GONE
        controlsContainer?.visibility = View.GONE
    }

    fun resetHideTimer() {
        hideJob?.cancel()
        hideJob = lifecycleOwner.lifecycleScope.launch {
            delay(HIDE_DELAY_MS)
            hideControls()
        }
    }

    fun stopHideTimer() {
        hideJob?.cancel()
        hideJob = null
    }

    fun pauseAutoHide() {
        autoHidePaused = true
        hideJob?.cancel()
        hideJob = null
    }

    fun resumeAutoHide() {
        if (autoHidePaused) {
            autoHidePaused = false
            resetHideTimer()
        }
    }

    fun focusPlayPauseButton(): Boolean {
        return playPauseButton?.requestFocus() ?: false
    }

    fun focusSeekBar(): Boolean {
        return seekBar?.requestFocus() ?: false
    }

    fun release() {
        stopHideTimer()
    }
}
