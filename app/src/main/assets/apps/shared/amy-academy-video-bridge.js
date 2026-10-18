/**
 * Amy FX Academy Video Bridge — Seamless Lockscreen Player & Resume-to-Lesson Deep Linking
 * Menghubungkan pemutaran video Akademi dengan Android MediaSession foreground service
 * dan menyelaraskan deep link kembali ke materi/pelajaran yang tepat di lockscreen.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AmyAcademyVideoBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'amy_academy_video_session';

  function isBridgeAvailable() {
    return Boolean(
      typeof window !== 'undefined' &&
      window.Android &&
      (typeof window.Android.playBackgroundVideo === 'function' ||
       typeof window.Android.playBackgroundVideoWithTarget === 'function')
    );
  }

  function getActiveLessonMetadata(video) {
    const parentLesson = video?.closest?.('[data-lesson-id]') || document.querySelector('[data-lesson-id]');
    const lessonId = parentLesson?.getAttribute('data-lesson-id') || document.body?.getAttribute('data-lesson-id') || '';
    const heading = document.querySelector('h1, h2')?.textContent?.trim() || 'Materi Masterclass Akademi';
    const baseUrl = (typeof window !== 'undefined' && window.location) ? window.location.href.split('#')[0] : '';
    const targetUrl = lessonId ? `${baseUrl}#lesson-${lessonId}` : baseUrl;

    return {
      lessonId,
      title: heading,
      targetUrl,
      sourceUrl: video?.currentSrc || video?.src || ''
    };
  }

  function handoffToBackground(video, customMetadata = {}) {
    if (!video || !isBridgeAvailable()) return false;

    const meta = { ...getActiveLessonMetadata(video), ...customMetadata };
    const positionMs = Math.max(0, Math.round((video.currentTime || 0) * 1000));
    const loop = Boolean(video.loop);
    const source = meta.sourceUrl || video.currentSrc || video.src || '';

    if (!source) return false;

    // Simpan snapshot playback ke storage lokal
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        source,
        lessonId: meta.lessonId,
        title: meta.title,
        targetUrl: meta.targetUrl,
        positionMs,
        timestamp: Date.now()
      }));
    } catch (_) {}

    let started = false;
    if (typeof window.Android.playBackgroundVideoWithTarget === 'function') {
      started = window.Android.playBackgroundVideoWithTarget(
        source,
        meta.lessonId || source,
        meta.title,
        String(positionMs),
        loop,
        '',
        meta.targetUrl
      );
    } else {
      started = window.Android.playBackgroundVideo(
        source,
        meta.lessonId || source,
        meta.title,
        String(positionMs),
        loop,
        ''
      );
    }

    if (started) {
      video.pause();
    }
    return started;
  }

  function restorePlaybackOnResume(video) {
    if (!isBridgeAvailable() || typeof window.Android.getBackgroundVideoStateJson !== 'function') return false;

    let state = null;
    try {
      const raw = window.Android.getBackgroundVideoStateJson();
      state = raw ? JSON.parse(raw) : null;
    } catch (_) {
      return false;
    }

    if (!state || !state.active) return false;

    const positionSec = Number(state.positionMs || 0) / 1000;
    if (video && Number.isFinite(positionSec) && positionSec >= 0) {
      try {
        video.currentTime = positionSec;
      } catch (_) {}
    }

    // Hentikan service latar belakang setelah trader kembali ke aplikasi
    try {
      if (typeof window.Android.pauseBackgroundVideo === 'function') {
        window.Android.pauseBackgroundVideo();
      }
    } catch (_) {}

    if (video && state.playing) {
      try {
        video.play().catch(() => {});
      } catch (_) {}
    }

    return true;
  }

  function autoAttach() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      const activeVideos = [...document.querySelectorAll('video')].filter(v => !v.paused && !v.ended);
      if (document.hidden) {
        if (activeVideos.length > 0) {
          handoffToBackground(activeVideos[0]);
        }
      } else {
        const videos = document.querySelectorAll('video');
        if (videos.length > 0) {
          restorePlaybackOnResume(videos[0]);
        }
      }
    });

    // Periksa apakah URL memiliki parameter waktu / hash saat kembali dari lockscreen
    window.addEventListener('pageshow', () => {
      const videos = document.querySelectorAll('video');
      if (videos.length > 0) {
        restorePlaybackOnResume(videos[0]);
      }
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoAttach);
    } else {
      autoAttach();
    }
  }

  return {
    isBridgeAvailable,
    getActiveLessonMetadata,
    handoffToBackground,
    restorePlaybackOnResume,
    STORAGE_KEY
  };
});
