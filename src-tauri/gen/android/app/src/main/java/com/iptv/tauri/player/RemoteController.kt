package com.iptv.tauri.player

import android.view.KeyEvent
import android.view.View
import androidx.media3.common.C
import com.iptv.tauri.MainActivity

class RemoteController(
    private val isVod: () -> Boolean,
    private val showControls: () -> Boolean,
    private val setShowControls: (Boolean) -> Unit,
    private val resetHideTimer: () -> Unit,
    private val onTogglePlayPause: () -> Unit,
    private val onSeekForward: () -> Unit,
    private val onSeekBackward: () -> Unit,
    private val onChannelUp: () -> Unit,
    private val onChannelDown: () -> Unit,
    private val getSeekBar: () -> View?,
    private val getDuration: () -> Long,
    private val getCurrentPosition: () -> Long,
    private val onSeekTo: (Long) -> Unit,
    private val focusSeekBar: () -> Boolean,
    private val focusPlayPause: () -> Boolean
) {
    fun handleKeyEvent(event: KeyEvent): Boolean {
        if (event.action != KeyEvent.ACTION_DOWN) {
            return false
        }

        if (showControls()) {
            resetHideTimer()
        }

        return when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT -> handleDpadLeftRight(event.keyCode)

            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN -> handleDpadUpDown()

            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> handleEnter()

            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                onTogglePlayPause()
                true
            }

            KeyEvent.KEYCODE_CHANNEL_UP -> {
                onChannelUp()
                true
            }

            KeyEvent.KEYCODE_CHANNEL_DOWN -> {
                onChannelDown()
                true
            }

            KeyEvent.KEYCODE_MEDIA_NEXT -> {
                onSeekForward()
                true
            }

            KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                onSeekBackward()
                true
            }

            else -> false
        }
    }

    private fun handleDpadLeftRight(keyCode: Int): Boolean {
        if (!showControls()) {
            setShowControls(true)
            return true
        }

        // TV SeekBar navigation when SeekBar has focus
        if (getSeekBar()?.hasFocus() == true && isVod()) {
            val duration = getDuration()
            if (duration > 0 && duration != C.TIME_UNSET) {
                val seekStep = (duration / 100).toLong()
                val currentPosition = getCurrentPosition()
                val newPosition = when (keyCode) {
                    KeyEvent.KEYCODE_DPAD_LEFT -> (currentPosition - seekStep).coerceAtLeast(0L)
                    KeyEvent.KEYCODE_DPAD_RIGHT -> (currentPosition + seekStep).coerceAtMost(duration)
                    else -> currentPosition
                }
                onSeekTo(newPosition)
                return true
            }
        }
        return false
    }

    private fun handleDpadUpDown(): Boolean {
        if (!showControls()) {
            setShowControls(true)
            return true
        }
        return false
    }

    private fun handleEnter(): Boolean {
        if (!showControls()) {
            setShowControls(true)
            return true
        }
        return false
    }

    fun emitChannelUp() {
        MainActivity.currentInstance?.emitChannelUp()
    }

    fun emitChannelDown() {
        MainActivity.currentInstance?.emitChannelDown()
    }
}
