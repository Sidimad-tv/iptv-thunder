package com.iptv.tauri.player

import android.content.Context
import android.view.View
import android.widget.ProgressBar
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class PlayerController(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val progressBar: ProgressBar?,
    private val onStateChange: (PlayerState) -> Unit,
    private val onError: (error: androidx.media3.common.PlaybackException, retryCount: Int, maxRetries: Int) -> Unit,
    private val onRetry: () -> Unit,
    private val onUiStateChange: (PlayerUiState) -> Unit = {},
    private val initialChannelName: String = "",
    private val onPlayerReady: () -> Unit = {}
) {
    companion object {
        private const val MAX_RETRIES = 3
        private val RETRY_DELAYS_MS = longArrayOf(1000, 2000, 4000)
    }

    init {
        // Constructor
    }

    var player: ExoPlayer? = null
        private set

    private var retryCount = 0
    private var retryJob: Job? = null
    var wasPlayingBeforeStop = false
    private var updateJob: Job? = null
    var currentUiState = PlayerUiState(channelName = initialChannelName)
        private set

    // Watchdog for HLS freeze detection
    private var lastPosition: Long = 0L
    private var lastPositionTimestamp: Long = 0L
    private var watchdogStuckCount: Int = 0
    private val WATCHDOG_TIMEOUT_MS = 10000L // 10 seconds
    private val WATCHDOG_MAX_STUCK_COUNT = 3 // After 3 checks (3s) of no change, trigger reprepare

    // End credits detection for VOD
    private var endedDetected = false
    private val END_CREDITS_THRESHOLD = 0.90f // 90% - detect end credits

    sealed class PlayerState {
        data object Loading : PlayerState()
        data object Live : PlayerState()
        data object Playing : PlayerState()
        data object Ended : PlayerState()
        data class Error(val message: String) : PlayerState()
        data class Reconnecting(val seconds: Long) : PlayerState()
    }

    data class PlayerUiState(
        val isPlaying: Boolean = false,
        val isLive: Boolean = false,
        val stateLabel: String = "",
        val channelName: String = "",
        val currentProgress: Float = 0f,
        val currentPosition: Long = 0L,
        val duration: Long = 0L,
        val isVod: Boolean = false,
        val videoQuality: String = "",
        val hasMultipleTracks: Boolean = false,
        val audioTracks: List<TrackInfo> = emptyList(),
        val subtitleTracks: List<TrackInfo> = emptyList(),
        val currentAudioTrackId: String? = null,
        val currentSubtitleTrackId: String? = null
    )

    data class TrackInfo(
        val id: String,
        val label: String,
        val language: String?,
        val isSelected: Boolean,
        val groupIndex: Int,
        val trackIndex: Int
    )

    fun initialize(url: String, isVod: Boolean = false) {
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                5000,  // minBufferMs: 5s for faster start
                30000, // maxBufferMs: 30s for IPTV stability
                2500,  // bufferForPlaybackMs: 2.5s before playing
                5000   // bufferForPlaybackAfterRebufferMs: 5s after rebuffer
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        // Configure data source with longer timeouts for IPTV
        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(5000)   // 5s connection timeout
            .setReadTimeoutMs(5000)      // 5s read timeout

        // Detect HLS streams - check for m3u8 in URL or query parameters
        val isHls = url.contains(".m3u8", ignoreCase = true) ||
                    url.contains("hls", ignoreCase = true)

        // Use HlsMediaSource for HLS streams
        val mediaSource = if (isHls) {
            HlsMediaSource.Factory(httpDataSourceFactory)
                .setAllowChunklessPreparation(true)
                .createMediaSource(MediaItem.fromUri(url))
        } else {
            DefaultMediaSourceFactory(httpDataSourceFactory)
                .createMediaSource(MediaItem.fromUri(url))
        }

        // Configure renderers with decoder fallback for problematic HEVC/AAC streams
        val renderersFactory = DefaultRenderersFactory(context)
            .setEnableDecoderFallback(true)

        player = ExoPlayer.Builder(context)
            .setRenderersFactory(renderersFactory)
            .setLoadControl(loadControl)
            .setSeekBackIncrementMs(10000)
            .setSeekForwardIncrementMs(10000)
            .build().apply {
                setMediaSource(mediaSource)
                playWhenReady = true
                // Prepare in background to avoid blocking UI
                lifecycleOwner.lifecycleScope.launch {
                    prepare()
                }
            }

        // Update initial UI state with isVod
        currentUiState = currentUiState.copy(isVod = isVod)
        onUiStateChange(currentUiState)

        // Reset end credits detection
        endedDetected = false

        setupListeners()
    }

    private fun setupListeners() {
        player?.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                progressBar?.visibility = if (playing) View.GONE else View.VISIBLE

                if (playing) {
                    startPeriodicUpdate()
                } else {
                    stopPeriodicUpdate()
                }
            }

            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_IDLE, Player.STATE_BUFFERING -> {
                        progressBar?.visibility = View.VISIBLE
                        onStateChange(PlayerState.Loading)
                        currentUiState = currentUiState.copy(stateLabel = "Loading...")
                        onUiStateChange(currentUiState)
                    }
                    Player.STATE_READY -> {
                        progressBar?.visibility = View.GONE
                        val isLive = player?.isCurrentMediaItemLive == true
                        onStateChange(if (isLive) PlayerState.Live else PlayerState.Playing)
                        retryCount = 0

                        // Reset watchdog on successful playback start
                        watchdogStuckCount = 0
                        lastPosition = 0L
                        lastPositionTimestamp = System.currentTimeMillis()

                        // Notify that player is ready
                        onPlayerReady()

                        // Detect video quality
                        detectVideoQuality()

                        // Update UI state immediately
                        currentUiState = currentUiState.copy(
                            stateLabel = if (isLive) "Live" else "Playing"
                        )
                        updateUiState()

                        // Start periodic update for VOD
                        if (!isLive) {
                            startPeriodicUpdate()
                        }

                        // Update track info when ready
                        updateTrackInfoInUi()
                    }
                    Player.STATE_ENDED -> {
                        progressBar?.visibility = View.GONE
                        onStateChange(PlayerState.Ended)
                        stopPeriodicUpdate()
                    }
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                handleError(error)
            }

            override fun onTracksChanged(tracks: Tracks) {
                android.util.Log.d("PlayerController", "Tracks changed, updating track info")
                updateTrackInfoInUi()
            }
        })
    }

    private fun startPeriodicUpdate() {
        stopPeriodicUpdate()
        updateJob = lifecycleOwner.lifecycleScope.launch {
            while (true) {
                delay(1000) // Update every second
                updateUiState()
            }
        }
    }

    private fun updateUiState() {
        val duration = player?.duration ?: 0L
        val position = player?.currentPosition ?: 0L
        val progress = if (duration > 0) (position.toFloat() / duration) * 100 else 0f
        val isLive = player?.isCurrentMediaItemLive == true
        val isPlaying = player?.isPlaying == true
        val isVod = currentUiState.isVod

        // Watchdog: detect if position hasn't changed while player reports playing
        if (isPlaying && position > 0) {
            if (position == lastPosition) {
                watchdogStuckCount++
                if (watchdogStuckCount >= WATCHDOG_MAX_STUCK_COUNT) {
                    android.util.Log.w("PlayerController", "Watchdog: Position stuck at $position for ${watchdogStuckCount}s, triggering reprepare")
                    watchdogStuckCount = 0
                    triggerReprepare()
                }
            } else {
                watchdogStuckCount = 0
                lastPosition = position
                lastPositionTimestamp = System.currentTimeMillis()
            }
        } else {
            watchdogStuckCount = 0
            lastPosition = position
        }

        // End credits detection for VOD: trigger Ended state at 90%
        if (isVod && !endedDetected && !isLive && duration > 0) {
            val progressRatio = position.toFloat() / duration
            if (progressRatio >= END_CREDITS_THRESHOLD) {
                android.util.Log.d("PlayerController", "End credits detected at ${String.format("%.1f%%", progressRatio * 100)}")
                endedDetected = true
                onStateChange(PlayerState.Ended)
                return
            }
        }

        currentUiState = currentUiState.copy(
            isPlaying = isPlaying,
            isLive = isLive,
            currentProgress = progress,
            currentPosition = position,
            duration = duration
        )

        onUiStateChange(currentUiState)
    }

    private fun triggerReprepare() {
        android.util.Log.d("PlayerController", "Watchdog: Repreparing player...")
        player?.let { exoPlayer ->
            val currentPosition = exoPlayer.currentPosition
            exoPlayer.seekTo(currentPosition)
            exoPlayer.prepare()
        }
    }

    private fun detectVideoQuality() {
        val videoFormat = player?.videoFormat
        if (videoFormat != null) {
            val height = videoFormat.height
            val width = videoFormat.width
            val quality = when {
                height >= 4320 -> "8K"
                height >= 2160 -> "4K"
                height >= 1440 -> "QHD"
                height >= 1080 -> "FHD"
                height >= 720 -> "HD"
                height >= 480 -> "SD"
                else -> "${width}x${height}"
            }
            android.util.Log.d("PlayerController", "Video quality detected: $quality (${width}x${height})")
            currentUiState = currentUiState.copy(videoQuality = quality)
            onUiStateChange(currentUiState)
        }
    }

    private fun stopPeriodicUpdate() {
        updateJob?.cancel()
        updateJob = null
    }

    private fun handleError(error: androidx.media3.common.PlaybackException) {
        android.util.Log.e("PlayerController", "Player error: ${error.errorCode}, retry: $retryCount/$MAX_RETRIES", error)

        if (retryCount < MAX_RETRIES) {
            retryCount++
            val delayMs = RETRY_DELAYS_MS.getOrElse(retryCount - 1) { 10000L }
            onStateChange(PlayerState.Reconnecting(delayMs / 1000))
            progressBar?.visibility = View.VISIBLE
            currentUiState = currentUiState.copy(stateLabel = "Reconnecting in ${delayMs / 1000}s...")
            onUiStateChange(currentUiState)
            onError(error, retryCount, MAX_RETRIES)

            retryJob = lifecycleOwner.lifecycleScope.launch {
                delay(delayMs)
                android.util.Log.d("PlayerController", "Retrying playback (attempt $retryCount)")
                onRetry()
            }
        } else {
            onStateChange(PlayerState.Error("No signal"))
            progressBar?.visibility = View.GONE
            currentUiState = currentUiState.copy(stateLabel = "No signal")
            onUiStateChange(currentUiState)
            android.util.Log.e("PlayerController", "Max retries reached, giving up")
        }
    }

    fun retry() {
        player?.prepare()
        player?.play()
    }

    fun changeChannel(url: String, channelName: String = "", isVod: Boolean = false) {
        android.util.Log.d("PlayerController", "Changing channel to: $channelName, URL: $url, isVod: $isVod")
        retryCount = 0
        // Reset watchdog state
        watchdogStuckCount = 0
        lastPosition = 0L
        lastPositionTimestamp = 0L
        // Reset end credits detection
        endedDetected = false
        player?.stop()

        // Create appropriate media source for the URL
        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(5000)
            .setReadTimeoutMs(5000)

        // Detect HLS streams
        val isHls = url.contains(".m3u8", ignoreCase = true) ||
                    url.contains("hls", ignoreCase = true)

        val mediaSource = if (isHls) {
            HlsMediaSource.Factory(httpDataSourceFactory)
                .setAllowChunklessPreparation(true)
                .createMediaSource(MediaItem.fromUri(url))
        } else {
            DefaultMediaSourceFactory(httpDataSourceFactory)
                .createMediaSource(MediaItem.fromUri(url))
        }

        player?.setMediaSource(mediaSource)
        player?.playWhenReady = true
        // Prepare in background to avoid blocking UI
        lifecycleOwner.lifecycleScope.launch {
            player?.prepare()
        }

        currentUiState = currentUiState.copy(
            channelName = channelName,
            isVod = isVod,
            stateLabel = "",
            videoQuality = ""
        )
        onUiStateChange(currentUiState)
    }

    fun pause() {
        wasPlayingBeforeStop = player?.isPlaying == true
        player?.pause()
    }

    fun resume() {
        if (wasPlayingBeforeStop) {
            player?.play()
        }
    }

    fun togglePlayPause() {
        player?.let {
            if (it.isPlaying) {
                it.pause()
                wasPlayingBeforeStop = false
            } else {
                it.play()
                wasPlayingBeforeStop = true
            }
        }
    }

    fun mute() {
        player?.mute()
    }

    fun unmute() {
        player?.unmute()
    }

    fun toggleMute(): Boolean {
        return player?.let {
            val isMuted = it.volume == 0f
            if (isMuted) {
                it.unmute()
            } else {
                it.mute()
            }
            !isMuted
        } ?: false
    }

    fun setVolume(volume: Float) {
        player?.volume = volume.coerceIn(0f, 1f)
    }

    fun seekTo(position: Long) {
        if (player?.isCurrentMediaItemSeekable == true) {
            player?.seekTo(position.coerceAtLeast(0L))
        }
    }

    fun seekRelative(offsetMs: Long) {
        if (player?.isCurrentMediaItemSeekable == true) {
            val newPosition = (player?.currentPosition ?: 0L) + offsetMs
            player?.seekTo(newPosition.coerceAtLeast(0L))
        }
    }

    fun seekByProgress(progressPercent: Int) {
        val duration = player?.duration ?: 0
        if (duration > 0 && duration != C.TIME_UNSET) {
            val position = (duration * progressPercent / 1000).toLong()
            player?.seekTo(position)
        }
    }

    fun getCurrentProgress(): Float {
        val duration = player?.duration ?: 0L
        val position = player?.currentPosition ?: 0L
        return if (duration > 0 && duration != C.TIME_UNSET) {
            (position.toFloat() / duration) * 100
        } else 0f
    }

    fun getAvailableTracks(): Pair<List<TrackInfo>, List<TrackInfo>> {
        val exoPlayer = player ?: return Pair(emptyList(), emptyList())
        val tracks = exoPlayer.currentTracks

        val audioTracks = mutableListOf<TrackInfo>()
        val subtitleTracks = mutableListOf<TrackInfo>()

        tracks.groups.forEachIndexed { groupIndex, group ->
            val trackGroup = group.mediaTrackGroup
            val type = trackGroup.type

            for (trackIndex in 0 until trackGroup.length) {
                val format = trackGroup.getFormat(trackIndex)
                val trackId = "${groupIndex}_$trackIndex"
                val isSelected = group.isSelected && exoPlayer.trackSelectionParameters.overrides.any { it.key == trackGroup && it.value.trackIndices.contains(trackIndex) }

                val label = buildString {
                    format.language?.let { append(it.uppercase()) }
                    if (format.label != null) {
                        if (isNotEmpty()) append(" - ")
                        append(format.label)
                    }
                    if (isEmpty()) append("Track ${trackIndex + 1}")
                }

                when (type) {
                    C.TRACK_TYPE_AUDIO -> {
                        audioTracks.add(TrackInfo(
                            id = trackId,
                            label = label,
                            language = format.language,
                            isSelected = isSelected,
                            groupIndex = groupIndex,
                            trackIndex = trackIndex
                        ))
                    }
                    C.TRACK_TYPE_TEXT -> {
                        subtitleTracks.add(TrackInfo(
                            id = trackId,
                            label = label,
                            language = format.language,
                            isSelected = isSelected,
                            groupIndex = groupIndex,
                            trackIndex = trackIndex
                        ))
                    }
                }
            }
        }

        return Pair(audioTracks, subtitleTracks)
    }

    fun selectAudioTrack(trackId: String?) {
        val exoPlayer = player ?: return
        val (audioTracks, _) = getAvailableTracks()

        val track = audioTracks.find { it.id == trackId } ?: audioTracks.firstOrNull() ?: return

        val parametersBuilder = exoPlayer.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)

        val trackGroup = exoPlayer.currentTracks.groups[track.groupIndex].mediaTrackGroup
        parametersBuilder.addOverride(TrackSelectionOverride(trackGroup, listOf(track.trackIndex)))

        exoPlayer.trackSelectionParameters = parametersBuilder.build()
        updateTrackInfoInUi()
    }

    fun selectSubtitleTrack(trackId: String?) {
        val exoPlayer = player ?: return
        val (_, subtitleTracks) = getAvailableTracks()

        val parametersBuilder = exoPlayer.trackSelectionParameters.buildUpon()

        if (trackId == null || trackId == "disabled") {
            parametersBuilder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        } else {
            val track = subtitleTracks.find { it.id == trackId } ?: return
            val trackGroup = exoPlayer.currentTracks.groups[track.groupIndex].mediaTrackGroup
            parametersBuilder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            parametersBuilder.addOverride(TrackSelectionOverride(trackGroup, listOf(track.trackIndex)))
        }

        exoPlayer.trackSelectionParameters = parametersBuilder.build()
        updateTrackInfoInUi()
    }

    private fun updateTrackInfoInUi() {
        val (audioTracks, subtitleTracks) = getAvailableTracks()
        val hasMultipleTracks = audioTracks.size > 1 || subtitleTracks.isNotEmpty()
        val currentAudio = audioTracks.find { it.isSelected }?.id ?: audioTracks.firstOrNull()?.id
        val currentSubtitle = subtitleTracks.find { it.isSelected }?.id

        currentUiState = currentUiState.copy(
            hasMultipleTracks = hasMultipleTracks,
            audioTracks = audioTracks,
            subtitleTracks = subtitleTracks,
            currentAudioTrackId = currentAudio,
            currentSubtitleTrackId = currentSubtitle
        )
        onUiStateChange(currentUiState)
    }

    fun release() {
        retryJob?.cancel()
        updateJob?.cancel()
        watchdogStuckCount = 0
        lastPosition = 0L
        lastPositionTimestamp = 0L
        endedDetected = false
        player?.stop()
        player?.clearMediaItems()
        player?.release()
        player = null
    }
}
