/**
 * Amy FX Academy Learning Reminder Service
 * Manages daily skill improvement reminders, tracking the last studied material
 * and allowing the user to customize reminder time from their Profile.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY_ENABLED = 'amy_learning_reminder_enabled';
  var STORAGE_KEY_TIME = 'amy_learning_reminder_time';
  var STORAGE_KEY_SLOTS = 'amy_learning_reminder_slots';
  var STORAGE_KEY_LAST_NOTIFIED = 'amy_learning_reminder_last_date';
  var DEFAULT_TIME = '20:00';
  var DEFAULT_SLOTS = {
    morning: { enabled: true, time: '08:00', label: 'Pagi' },
    afternoon: { enabled: true, time: '13:00', label: 'Siang' },
    night: { enabled: true, time: '20:00', label: 'Malam' }
  };
  var DEFAULT_TITLE = 'Fondasi ICT & Market Structure Dasar';
  var DEFAULT_URL = 'https://appassets.androidplatform.net/assets/apps/academy/index.html';
  var WITA_TIMEZONE = 'Asia/Makassar';

  function getWitaTimeHHMM() {
    try {
      var formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: WITA_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return formatter.format(new Date());
    } catch (_) {
      var now = new Date();
      var utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
      var witaDate = new Date(utcMs + (8 * 3600000));
      return String(witaDate.getHours()).padStart(2, '0') + ':' + String(witaDate.getMinutes()).padStart(2, '0');
    }
  }

  function getWitaDateString() {
    try {
      var formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: WITA_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(new Date());
    } catch (_) {
      var now = new Date();
      var utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
      var witaDate = new Date(utcMs + (8 * 3600000));
      return witaDate.getFullYear() + '-' + String(witaDate.getMonth() + 1).padStart(2, '0') + '-' + String(witaDate.getDate()).padStart(2, '0');
    }
  }

  function getLocalTimeHHMM() {
    return getWitaTimeHHMM();
  }

  function getLocalDateString() {
    return getWitaDateString();
  }

  function readJson(key, fallback) {
    try {
      var val = JSON.parse(localStorage.getItem(key) || 'null');
      return val == null ? fallback : val;
    } catch (_) {
      return fallback;
    }
  }

  var AmyLearningReminder = {
    DEFAULT_TIME: DEFAULT_TIME,
    DEFAULT_TITLE: DEFAULT_TITLE,

    getConfig: function () {
      var enabled = localStorage.getItem(STORAGE_KEY_ENABLED) !== 'false';
      var time = localStorage.getItem(STORAGE_KEY_TIME) || DEFAULT_TIME;
      var slots = readJson(STORAGE_KEY_SLOTS, null);

      if (!slots || typeof slots !== 'object') {
        slots = {
          morning: { enabled: true, time: '08:00', label: 'Pagi' },
          afternoon: { enabled: true, time: '13:00', label: 'Siang' },
          night: { enabled: true, time: (time.includes(',') ? time.split(',')[0] : time) || '20:00', label: 'Malam' }
        };
      }

      // Last studied lesson details from Academy reading history
      var lastRead = readJson('amy_academy_last_read_v2', null);
      var lastTitle = (lastRead && lastRead.title) || localStorage.getItem('amy_last_opened_title') || '';
      var lastUrl = (lastRead && lastRead.path) || localStorage.getItem('amy_last_opened_url') || DEFAULT_URL;
      var lastTime = (lastRead && lastRead.updatedAt) || 0;

      // Check native config if available
      if (global.Android && typeof global.Android.getLearningReminderConfig === 'function') {
        try {
          var nativeConfig = JSON.parse(global.Android.getLearningReminderConfig() || '{}');
          if (nativeConfig.enabled !== undefined) enabled = Boolean(nativeConfig.enabled);
          if (nativeConfig.time) time = nativeConfig.time;
          var nativeTime = Number(nativeConfig.lastTime || nativeConfig.timestamp || 0);
          if (nativeConfig.lastTitle && (nativeTime >= lastTime || !lastTitle)) {
            lastTitle = nativeConfig.lastTitle;
            if (nativeTime) lastTime = nativeTime;
          }
          if (nativeConfig.lastUrl && (nativeTime >= lastTime || !lastUrl || lastUrl === DEFAULT_URL)) {
            lastUrl = nativeConfig.lastUrl;
          }
        } catch (_) {}
      }

      var lastTimeText = 'Belum ada riwayat belajar';
      if (lastTime) {
        try {
          lastTimeText = new Intl.DateTimeFormat('id-ID', {
            timeZone: WITA_TIMEZONE,
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(new Date(lastTime));
        } catch (_) {
          lastTimeText = new Date(lastTime).toLocaleString('id-ID');
        }
      }

      return {
        enabled: enabled,
        time: time,
        slots: slots,
        lastTitle: lastTitle || DEFAULT_TITLE,
        lastUrl: lastUrl,
        lastTime: lastTime,
        lastTimeText: lastTimeText
      };
    },

    saveSlots: function (enabled, slots) {
      var safeSlots = slots && typeof slots === 'object' ? slots : DEFAULT_SLOTS;
      localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
      localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(safeSlots));

      var activeTimes = [];
      if (safeSlots.morning && safeSlots.morning.enabled && safeSlots.morning.time) activeTimes.push(safeSlots.morning.time);
      if (safeSlots.afternoon && safeSlots.afternoon.enabled && safeSlots.afternoon.time) activeTimes.push(safeSlots.afternoon.time);
      if (safeSlots.night && safeSlots.night.enabled && safeSlots.night.time) activeTimes.push(safeSlots.night.time);

      var timeString = activeTimes.length ? activeTimes.join(',') : (safeSlots.night && safeSlots.night.time ? safeSlots.night.time : DEFAULT_TIME);
      localStorage.setItem(STORAGE_KEY_TIME, timeString);

      if (global.Android && typeof global.Android.saveLearningReminderConfig === 'function') {
        try {
          global.Android.saveLearningReminderConfig(Boolean(enabled), timeString);
        } catch (e) {
          console.warn('Android saveLearningReminderConfig failed', e);
        }
      }

      return { enabled: Boolean(enabled), slots: safeSlots, time: timeString };
    },

    saveConfig: function (enabled, timeOfDay) {
      if (timeOfDay && typeof timeOfDay === 'object') {
        return this.saveSlots(enabled, timeOfDay);
      }
      var cleanTime = String(timeOfDay || '').trim();
      if (!/^\d{1,2}:\d{2}$/.test(cleanTime)) {
        cleanTime = DEFAULT_TIME;
      }
      var parts = cleanTime.split(':');
      cleanTime = parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');

      localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
      localStorage.setItem(STORAGE_KEY_TIME, cleanTime);

      var currentSlots = this.getConfig().slots || DEFAULT_SLOTS;
      currentSlots.night = currentSlots.night || { enabled: true, label: 'Malam' };
      currentSlots.night.time = cleanTime;
      localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(currentSlots));

      if (global.Android && typeof global.Android.saveLearningReminderConfig === 'function') {
        try {
          global.Android.saveLearningReminderConfig(Boolean(enabled), cleanTime);
        } catch (e) {
          console.warn('Android saveLearningReminderConfig failed', e);
        }
      }

      return { enabled: Boolean(enabled), time: cleanTime, slots: currentSlots };
    },

    recordLesson: function (title, url, section) {
      if (!title) return;
      var cleanTitle = String(title).replace(/\s+[—|-]\s+Tutorial Trading.*$/i, '').trim();
      var cleanUrl = String(url || DEFAULT_URL).trim();

      localStorage.setItem('amy_last_opened_title', cleanTitle);
      localStorage.setItem('amy_last_opened_url', cleanUrl);

      if (global.Android && typeof global.Android.recordLastStudiedLesson === 'function') {
        try {
          global.Android.recordLastStudiedLesson(cleanTitle, cleanUrl, String(section || ''));
        } catch (e) {
          console.warn('Android recordLastStudiedLesson failed', e);
        }
      }
    },

    formatNotification: function (customTitle, customTime) {
      var config = this.getConfig();
      var lessonTitle = customTitle || config.lastTitle || DEFAULT_TITLE;
      var timeDisplay = customTime || (config.time.includes(',') ? config.time.split(',')[0] : config.time);
      return {
        title: '📚 Waktunya Tingkatkan Skill Trading-mu!',
        message: 'Materi terakhir yang kamu pelajari: "' + lessonTitle + '". Yuk lanjutkan belajar sekarang! (Jadwal: ' + timeDisplay + ')',
        url: config.lastUrl || DEFAULT_URL
      };
    },

    triggerReminderNotification: function () {
      var notif = this.formatNotification();

      // Native notification route
      if (global.Android && typeof global.Android.triggerLearningReminderNotification === 'function') {
        try {
          return global.Android.triggerLearningReminderNotification();
        } catch (e) {
          console.warn('triggerLearningReminderNotification failed', e);
        }
      }

      if (global.Android && typeof global.Android.showNotificationWithUrl === 'function') {
        try {
          global.Android.showNotificationWithUrl(notif.title, notif.message, notif.url);
          return true;
        } catch (e) {
          console.warn('showNotificationWithUrl failed', e);
        }
      }

      // Browser Notification fallback
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(notif.title, {
            body: notif.message,
            icon: '/favicon.ico'
          });
          return true;
        } catch (_) {}
      }

      // In-app fallback toast
      if (typeof global.showToast === 'function') {
        global.showToast(notif.title + '\n' + notif.message);
      }
      return true;
    },

    checkScheduledReminder: function () {
      var config = this.getConfig();
      if (!config.enabled) return;

      var currentHHMM = getLocalTimeHHMM();
      var todayDate = getLocalDateString();
      var slots = config.slots || DEFAULT_SLOTS;

      for (var key in slots) {
        var s = slots[key];
        if (s && s.enabled && s.time === currentHHMM) {
          var slotNotifiedKey = todayDate + '_' + s.time;
          var lastNotified = localStorage.getItem(STORAGE_KEY_LAST_NOTIFIED + '_' + key);
          if (lastNotified !== slotNotifiedKey) {
            localStorage.setItem(STORAGE_KEY_LAST_NOTIFIED + '_' + key, slotNotifiedKey);
            localStorage.setItem(STORAGE_KEY_LAST_NOTIFIED, slotNotifiedKey);
            this.triggerReminderNotification(null, s.time);
            break;
          }
        }
      }
    },

    startScheduler: function () {
      if (this._schedulerStarted) return;
      this._schedulerStarted = true;

      var self = this;
      self.checkScheduledReminder();
      if (typeof setInterval !== 'undefined') {
        this._intervalId = setInterval(function () {
          self.checkScheduledReminder();
        }, 30000); // Check every 30 seconds
        if (this._intervalId && typeof this._intervalId.unref === 'function') {
          this._intervalId.unref();
        }
      }
    },

    WITA_TIMEZONE: WITA_TIMEZONE,
    getWitaTimeHHMM: getWitaTimeHHMM,
    getWitaDateString: getWitaDateString
  };

  global.AmyLearningReminder = AmyLearningReminder;

  // Auto-start in-app scheduler
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        AmyLearningReminder.startScheduler();
      });
    } else {
      AmyLearningReminder.startScheduler();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
