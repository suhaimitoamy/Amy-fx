package com.amyelitesuite

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import java.io.File

class BackgroundVideoPlaybackService : MediaSessionService() {
    companion object {
        const val ACTION_PLAY = "com.amyelitesuite.backgroundvideo.PLAY"
        const val ACTION_PAUSE = "com.amyelitesuite.backgroundvideo.PAUSE"
        const val ACTION_RESUME = "com.amyelitesuite.backgroundvideo.RESUME"
        const val ACTION_SEEK = "com.amyelitesuite.backgroundvideo.SEEK"
        const val ACTION_STOP = "com.amyelitesuite.backgroundvideo.STOP"
        const val ACTION_SET_LOOP = "com.amyelitesuite.backgroundvideo.SET_LOOP"

        const val EXTRA_SOURCE = "source"
        const val EXTRA_SOURCE_KEY = "source_key"
        const val EXTRA_TITLE = "title"
        const val EXTRA_POSITION_MS = "position_ms"
        const val EXTRA_LOOP = "loop"
        const val EXTRA_TEMP_PATH = "temp_path"

        const val STATE_PREFS = "AmyBackgroundVideoState"
        const val STATE_ACTIVE = "active"
        const val STATE_PLAYING = "playing"
        const val STATE_POSITION_MS = "position_ms"
        const val STATE_DURATION_MS = "duration_ms"
        const val STATE_SOURCE_KEY = "source_key"
        const val STATE_TITLE = "title"
        const val STATE_LOOP = "loop"
        const val STATE_ERROR = "error"
        const val STATE_UPDATED_AT = "updated_at"
    }

    private lateinit var player: ExoPlayer
    private var mediaSession: MediaSession? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var currentSourceKey = ""
    private var currentTitle = ""
    private var currentTempPath: String? = null
    private var currentLoop = true
    private var lastError = ""

    private val stateTicker = object : Runnable {
        override fun run() {
            publishState()
            mainHandler.postDelayed(this, 500L)
        }
    }

    override fun onCreate() {
        super.onCreate()

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
            .build()

        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(audioAttributes, true)
            setHandleAudioBecomingNoisy(true)
            setWakeMode(C.WAKE_MODE_LOCAL)
            repeatMode = Player.REPEAT_MODE_ONE
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) = publishState()
                override fun onPlaybackStateChanged(playbackState: Int) = publishState()
                override fun onPositionDiscontinuity(
                    oldPosition: Player.PositionInfo,
                    newPosition: Player.PositionInfo,
                    reason: Int
                ) = publishState()

                override fun onPlayerError(error: PlaybackException) {
                    lastError = error.errorCodeName
                    publishState()
                }
            })
        }

        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_url", "https://appassets.androidplatform.net/assets/apps/journal/index.html")
        }
        val sessionActivity = PendingIntent.getActivity(
            this,
            4701,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        mediaSession = MediaSession.Builder(this, player)
            .setSessionActivity(sessionActivity)
            .build()

        publishState()
        mainHandler.post(stateTicker)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val superResult = super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_PLAY -> handlePlay(intent)
            ACTION_PAUSE -> player.pause()
            ACTION_RESUME -> player.play()
            ACTION_SEEK -> player.seekTo(intent.getLongExtra(EXTRA_POSITION_MS, 0L).coerceAtLeast(0L))
            ACTION_SET_LOOP -> {
                currentLoop = intent.getBooleanExtra(EXTRA_LOOP, true)
                player.repeatMode = if (currentLoop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
                publishState()
            }
            ACTION_STOP -> stopPlaybackAndService()
            else -> return superResult
        }
        return START_STICKY
    }

    private fun handlePlay(intent: Intent) {
        val source = intent.getStringExtra(EXTRA_SOURCE).orEmpty().trim()
        if (source.isBlank()) {
            lastError = "EMPTY_SOURCE"
            publishState()
            return
        }

        val nextTempPath = intent.getStringExtra(EXTRA_TEMP_PATH)?.takeIf { it.isNotBlank() }
        if (currentTempPath != null && currentTempPath != nextTempPath) cleanupTempFile(currentTempPath)

        currentSourceKey = intent.getStringExtra(EXTRA_SOURCE_KEY).orEmpty()
        currentTitle = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Video Trading" }
        currentTempPath = nextTempPath
        currentLoop = intent.getBooleanExtra(EXTRA_LOOP, true)
        lastError = ""

        val uri = when {
            source.startsWith("content://") || source.startsWith("file://") ||
                source.startsWith("http://") || source.startsWith("https://") -> Uri.parse(source)
            else -> Uri.fromFile(File(source))
        }

        val mediaItem = MediaItem.Builder()
            .setUri(uri)
            .setMediaId(currentSourceKey)
            .setMediaMetadata(MediaMetadata.Builder().setTitle(currentTitle).build())
            .build()

        player.repeatMode = if (currentLoop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        player.setMediaItem(mediaItem, intent.getLongExtra(EXTRA_POSITION_MS, 0L).coerceAtLeast(0L))
        player.prepare()
        player.play()
        publishState()
    }

    private fun stopPlaybackAndService() {
        player.stop()
        player.clearMediaItems()
        cleanupTempFile(currentTempPath)
        currentTempPath = null
        currentSourceKey = ""
        currentTitle = ""
        lastError = ""
        publishState(activeOverride = false)
        stopSelf()
    }

    private fun publishState(activeOverride: Boolean? = null) {
        if (!::player.isInitialized) return
        val duration = player.duration.takeIf { it != C.TIME_UNSET && it >= 0L } ?: 0L
        val active = activeOverride ?: (player.mediaItemCount > 0)
        getSharedPreferences(STATE_PREFS, MODE_PRIVATE).edit()
            .putBoolean(STATE_ACTIVE, active)
            .putBoolean(STATE_PLAYING, active && player.isPlaying)
            .putLong(STATE_POSITION_MS, if (active) player.currentPosition.coerceAtLeast(0L) else 0L)
            .putLong(STATE_DURATION_MS, if (active) duration else 0L)
            .putString(STATE_SOURCE_KEY, if (active) currentSourceKey else "")
            .putString(STATE_TITLE, if (active) currentTitle else "")
            .putBoolean(STATE_LOOP, currentLoop)
            .putString(STATE_ERROR, lastError)
            .putLong(STATE_UPDATED_AT, System.currentTimeMillis())
            .apply()
    }

    private fun cleanupTempFile(path: String?) {
        if (path.isNullOrBlank()) return
        try {
            val file = File(path).canonicalFile
            val allowedDir = File(cacheDir, "background-video").canonicalFile
            if (file.path.startsWith(allowedDir.path + File.separator) && file.exists()) file.delete()
        } catch (_: Exception) {
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!player.playWhenReady) stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(stateTicker)
        mediaSession?.release()
        mediaSession = null
        if (::player.isInitialized) player.release()
        cleanupTempFile(currentTempPath)
        currentTempPath = null
        getSharedPreferences(STATE_PREFS, MODE_PRIVATE).edit()
            .putBoolean(STATE_ACTIVE, false)
            .putBoolean(STATE_PLAYING, false)
            .putLong(STATE_POSITION_MS, 0L)
            .putLong(STATE_DURATION_MS, 0L)
            .putString(STATE_SOURCE_KEY, "")
            .putString(STATE_TITLE, "")
            .putLong(STATE_UPDATED_AT, System.currentTimeMillis())
            .apply()
        super.onDestroy()
    }
}
