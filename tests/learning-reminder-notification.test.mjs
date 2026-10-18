import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gateSource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/AmyFxNotificationGate.java', import.meta.url), 'utf8');
const mainActivitySource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/MainActivity.kt', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/AmyFxApplication.kt', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/LearningReminderWorker.kt', import.meta.url), 'utf8');
const jsSource = readFileSync(new URL('../app/src/main/assets/apps/shared/amy-learning-reminder.js', import.meta.url), 'utf8');
const appJsSource = readFileSync(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8');
const readingHistorySource = readFileSync(new URL('../app/src/main/assets/apps/academy/assets/js/reading-history-v2.js', import.meta.url), 'utf8');
const receiverSource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/LearningReminderReceiver.kt', import.meta.url), 'utf8');
const bootSource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/BootReceiver.kt', import.meta.url), 'utf8');
const manifestSource = readFileSync(new URL('../app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');

test('AmyFxNotificationGate routes learning keywords to Academy', () => {
  assert.match(gateSource, /t\.contains\("belajar"\)/);
  assert.match(gateSource, /t\.contains\("materi"\)/);
  assert.match(gateSource, /t\.contains\("skill"\)/);
  assert.match(gateSource, /apps\/academy\/index\.html/);
});

test('MainActivity exposes learning reminder native bridge and local url normalizer', () => {
  assert.match(mainActivitySource, /fun recordLastStudiedLesson\(/);
  assert.match(mainActivitySource, /fun saveLearningReminderConfig\(/);
  assert.match(mainActivitySource, /fun getLearningReminderConfig\(/);
  assert.match(mainActivitySource, /fun triggerLearningReminderNotification\(/);
  assert.match(mainActivitySource, /rawUrl\.startsWith\("\/assets\/"\)/);
  assert.match(mainActivitySource, /rawUrl\.startsWith\("\/apps\/"\)/);
});

test('AmyFxApplication configures learning reminder channel and scheduler', () => {
  assert.match(appSource, /LEARNING_REMINDER_CHANNEL_ID = "amy_learning_reminder_v1"/);
  assert.match(appSource, /Amy FX Pengingat Belajar/);
  assert.match(appSource, /LearningReminderWorker\.schedule\(this\)/);
});

test('LearningReminderWorker formats reminder with user last studied lesson and customizable schedule', () => {
  assert.match(workerSource, /UNIQUE_WORK_NAME = "AmyFxLearningReminderWork"/);
  assert.match(workerSource, /Waktunya Tingkatkan Skill Trading-mu!/);
  assert.match(workerSource, /Materi terakhir yang kamu pelajari:/);
  assert.match(workerSource, /PeriodicWorkRequestBuilder<LearningReminderWorker>\(24, TimeUnit\.HOURS\)/);
  assert.match(workerSource, /initialDelayMs/);
});

test('reading-history-v2 records last studied lesson into learning reminder bridge', () => {
  assert.match(readingHistorySource, /recordLastStudiedLesson/);
});

test('app.js Profile UI includes customizable learning reminder time picker and test trigger', () => {
  assert.match(appJsSource, /id="learningReminderTimeInput"/);
  assert.match(appJsSource, /id="learningReminderEnabled"/);
  assert.match(appJsSource, /id="saveLearningReminderBtn"/);
  assert.match(appJsSource, /id="testLearningReminderBtn"/);
  assert.match(appJsSource, /Pengingat Belajar &amp; Skill/);
});

test('AmyLearningReminder JS module handles configuration, recording, and notification formatting', () => {
  const storage = new Map();
  const context = {
    localStorage: {
      getItem(k) { return storage.get(k) ?? null; },
      setItem(k, v) { storage.set(k, String(v)); },
      removeItem(k) { storage.delete(k); }
    },
    console,
    Date,
    Intl,
    String,
    Boolean,
    JSON,
    setInterval,
    clearInterval,
    document: { readyState: 'complete', addEventListener() {} },
    window: {}
  };
  context.window = context;

  vm.runInNewContext(jsSource, context);
  const reminder = context.AmyLearningReminder;
  assert.ok(reminder, 'AmyLearningReminder must be defined on window');

  // Test default config
  const defConfig = reminder.getConfig();
  assert.equal(defConfig.enabled, true);
  assert.equal(defConfig.time, '20:00');

  // Test custom user time in Profile
  reminder.saveConfig(true, '19:30');
  assert.equal(storage.get('amy_learning_reminder_time'), '19:30');
  assert.equal(storage.get('amy_learning_reminder_enabled'), 'true');

  const updatedConfig = reminder.getConfig();
  assert.equal(updatedConfig.time, '19:30');

  // Test recording a lesson
  reminder.recordLesson('01 Bias Harian: Formasi Candlestick Daily', 'https://appassets.androidplatform.net/assets/apps/academy/bagian-07/01.html', 'Bagian 07');
  assert.equal(storage.get('amy_last_opened_title'), '01 Bias Harian: Formasi Candlestick Daily');

  // Test notification format
  const notif = reminder.formatNotification();
  assert.match(notif.title, /Waktunya Tingkatkan Skill Trading-mu!/);
  assert.match(notif.message, /01 Bias Harian: Formasi Candlestick Daily/);
  assert.match(notif.message, /WITA/);
  assert.equal(notif.url, 'https://appassets.androidplatform.net/assets/apps/academy/bagian-07/01.html');

  // Test WITA timezone locking
  assert.equal(reminder.WITA_TIMEZONE, 'Asia/Makassar');
  assert.match(reminder.getWitaTimeHHMM(), /^\d{2}:\d{2}$/);
  assert.match(reminder.getWitaDateString(), /^\d{4}-\d{2}-\d{2}$/);
});

test('LearningReminderWorker anchors all alarm calculations to Asia/Makassar (WITA)', () => {
  assert.match(workerSource, /WITA_TIME_ZONE:\s*TimeZone\s*=\s*TimeZone\.getTimeZone\("Asia\/Makassar"\)/);
  assert.match(workerSource, /Calendar\.getInstance\(WITA_TIME_ZONE\)/);
  assert.match(workerSource, /gateKey = "learning_reminder\|\$witaDateKey"/);
  assert.match(workerSource, /Jadwal: \$timeStr WITA/);
});

test('app.js Profile UI clearly indicates WITA timezone', () => {
  assert.match(appJsSource, /Waktu Notifikasi \(WITA\)/);
  assert.match(appJsSource, /WITA · UTC\+8/);
  assert.match(appJsSource, /Jadwal pengingat disimpan: Setiap hari jam \$\{timeVal\} WITA/);
});

test('LearningReminderWorker strictly rejects premature execution (e.g. 13:41 when scheduled for 20:00)', () => {
  assert.match(workerSource, /diffMinutes\s*>\s*15/);
  assert.match(workerSource, /Ignored premature worker trigger/);
  assert.match(workerSource, /KEY_LAST_NOTIFIED_DATE/);
  assert.match(workerSource, /Already notified today/);
  assert.match(workerSource, /ExistingPeriodicWorkPolicy\.KEEP/);
  assert.match(workerSource, /ExistingPeriodicWorkPolicy\.CANCEL_AND_REENQUEUE/);
});

test('LearningReminderReceiver provides exact AlarmManager scheduling with Doze mode wakeup and SecurityException guard', () => {
  const currentReceiverSource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/LearningReminderReceiver.kt', import.meta.url), 'utf8');
  assert.match(currentReceiverSource, /class LearningReminderReceiver : BroadcastReceiver/);
  assert.match(currentReceiverSource, /ACTION_TRIGGER_REMINDER = "com\.amyelitesuite\.action\.TRIGGER_LEARNING_REMINDER"/);
  assert.match(currentReceiverSource, /alarmManager(\.|\?\.)setExactAndAllowWhileIdle/);
  assert.match(currentReceiverSource, /alarmManager(\.|\?\.)setAndAllowWhileIdle/);
  assert.match(currentReceiverSource, /canScheduleExactAlarms/);
  assert.match(currentReceiverSource, /catch\s*\(\w*:\s*SecurityException\)/);
  assert.match(currentReceiverSource, /diffMinutes\s*>\s*15/);
  assert.match(currentReceiverSource, /Spurious alarm trigger/);
  assert.match(manifestSource, /android:name="\.LearningReminderReceiver"/);
});

test('BootReceiver and MainActivity re-arm and synchronize both AlarmManager and WorkManager', () => {
  assert.match(bootSource, /LearningReminderReceiver\.schedule\(context\)/);
  assert.match(bootSource, /LearningReminderWorker\.schedule\(context\)/);
  assert.match(mainActivitySource, /LearningReminderReceiver\.schedule\(mContext\)/);
  assert.match(mainActivitySource, /LearningReminderWorker\.reschedule\(mContext\)/);
});
