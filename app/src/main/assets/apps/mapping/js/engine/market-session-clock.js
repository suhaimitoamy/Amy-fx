const DISPLAY_ZONE = 'Asia/Makassar';

const SESSION_DEFINITIONS = Object.freeze({
  LONDON: Object.freeze({
    id: 'LONDON',
    label: 'London',
    timeZone: 'Europe/London',
    startMinute: 7 * 60,
    endMinute: 11 * 60
  }),
  NEW_YORK: Object.freeze({
    id: 'NEW_YORK',
    label: 'New York',
    timeZone: 'America/New_York',
    startMinute: 7 * 60 + 30,
    endMinute: 16 * 60
  })
});

function timestampMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  return number > 10_000_000_000 ? number : number * 1000;
}

function zonedParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  const read = type => Number(parts.find(item => item.type === type)?.value || 0);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second')
  };
}

function sourceOffsetMinutes(timestamp, timeZone) {
  const observed = zonedParts(timestamp, timeZone);
  const observedAsUtc = Date.UTC(
    observed.year,
    observed.month - 1,
    observed.day,
    observed.hour,
    observed.minute,
    observed.second
  );
  return Math.round((observedAsUtc - timestamp) / 60000);
}

function sourceSeason(timestamp, timeZone) {
  const offset = sourceOffsetMinutes(timestamp, timeZone);
  if (timeZone === 'America/New_York') {
    if (offset === -240) return 'EDT';
    if (offset === -300) return 'EST';
  }
  if (timeZone === 'Europe/London') {
    if (offset === 60) return 'BST';
    if (offset === 0) return 'GMT';
  }
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function zonedTimestamp(dateParts, minuteOfDay, timeZone) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const targetAsUtc = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    hour,
    minute,
    0
  );
  let guess = targetAsUtc;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const observed = zonedParts(guess, timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    const correction = targetAsUtc - observedAsUtc;
    guess += correction;
    if (Math.abs(correction) < 1000) break;
  }
  return guess;
}

function formatWita(timestamp) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: DISPLAY_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(timestamp)).replace('.', ':');
}

function minuteInZone(timestamp, timeZone) {
  const parts = zonedParts(timestamp, timeZone);
  return parts.hour * 60 + parts.minute;
}

function inWindow(minute, start, end) {
  return start < end
    ? minute >= start && minute < end
    : minute >= start || minute < end;
}

function sessionDetail(definition, timestamp) {
  const sourceDate = zonedParts(timestamp, definition.timeZone);
  const start = zonedTimestamp(sourceDate, definition.startMinute, definition.timeZone);
  const end = zonedTimestamp(sourceDate, definition.endMinute, definition.timeZone);
  return {
    id: definition.id,
    label: definition.label,
    timeZone: definition.timeZone,
    season: sourceSeason(timestamp, definition.timeZone),
    active: inWindow(
      minuteInZone(timestamp, definition.timeZone),
      definition.startMinute,
      definition.endMinute
    ),
    sourceStartMinute: definition.startMinute,
    sourceEndMinute: definition.endMinute,
    start,
    end,
    witaStart: formatWita(start),
    witaEnd: formatWita(end)
  };
}

export function executionSessionState(value, mode = 'NONE') {
  const timestamp = timestampMs(value);
  if (!Number.isFinite(timestamp)) {
    return {
      mode,
      ready: false,
      allowed: mode === 'NONE',
      activeSession: 'UNKNOWN',
      london: null,
      newYork: null,
      source: 'DST_AWARE_SESSION_CLOCK_V1'
    };
  }
  const london = sessionDetail(SESSION_DEFINITIONS.LONDON, timestamp);
  const newYork = sessionDetail(SESSION_DEFINITIONS.NEW_YORK, timestamp);
  const allowed = mode === 'NONE'
    ? true
    : mode === 'NEW_YORK_ONLY'
      ? newYork.active
      : mode === 'LONDON_ONLY'
        ? london.active
        : london.active || newYork.active;
  const activeSession = newYork.active
    ? 'NEW_YORK'
    : london.active
      ? 'LONDON'
      : 'OFF_SESSION';
  return {
    mode,
    ready: true,
    allowed,
    activeSession,
    london,
    newYork,
    displayZone: DISPLAY_ZONE,
    source: 'DST_AWARE_SESSION_CLOCK_V1'
  };
}

export function executionSessionAllowed(value, mode = 'NONE') {
  return executionSessionState(value, mode).allowed;
}

export function executionSessionRequirement(mode = 'NONE', value = Date.now()) {
  if (mode === 'NONE') return 'Tidak menjadi hard gate';
  const state = executionSessionState(value, mode);
  if (!state.ready) return 'Jam sesi belum dapat dihitung';
  const london = `London ${state.london.witaStart}–${state.london.witaEnd} WITA (${state.london.season})`;
  const newYork = `New York ${state.newYork.witaStart}–${state.newYork.witaEnd} WITA (${state.newYork.season})`;
  if (mode === 'NEW_YORK_ONLY') return `${newYork} · DST otomatis`;
  if (mode === 'LONDON_ONLY') return `${london} · DST otomatis`;
  return `${london} / ${newYork} · DST otomatis`;
}

export const EXECUTION_SESSION_CONFIG = Object.freeze({
  displayZone: DISPLAY_ZONE,
  london: SESSION_DEFINITIONS.LONDON,
  newYork: SESSION_DEFINITIONS.NEW_YORK
});

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
}

export function sessionCountdownPill(value = Date.now()) {
  const timestamp = timestampMs(value);
  if (!Number.isFinite(timestamp)) {
    return {
      text: '[ ⏳ Memuat Sesi... ]',
      activeSession: 'UNKNOWN',
      status: 'OFFLINE'
    };
  }

  const london = sessionDetail(SESSION_DEFINITIONS.LONDON, timestamp);
  const newYork = sessionDetail(SESSION_DEFINITIONS.NEW_YORK, timestamp);

  // 1. Active sessions
  if (london.active) {
    const remaining = Math.max(0, london.end - timestamp);
    return {
      text: `[ 🇬🇧 London Killzone Aktif (Sisa ${formatDuration(remaining)}) ]`,
      activeSession: 'LONDON',
      status: 'ACTIVE',
      season: london.season,
      witaTime: `${london.witaStart}–${london.witaEnd} WITA`,
      remainingMs: remaining
    };
  }

  if (newYork.active) {
    const remaining = Math.max(0, newYork.end - timestamp);
    return {
      text: `[ 🇺🇸 New York Sesi Aktif (Sisa ${formatDuration(remaining)}) ]`,
      activeSession: 'NEW_YORK',
      status: 'ACTIVE',
      season: newYork.season,
      witaTime: `${newYork.witaStart}–${newYork.witaEnd} WITA`,
      remainingMs: remaining
    };
  }

  // 2. Upcoming / countdown to next session
  if (timestamp < london.start) {
    const msUntil = london.start - timestamp;
    return {
      text: `[ 🇬🇧 Menuju London Open dalam ${formatDuration(msUntil)} (${london.witaStart} WITA) ]`,
      activeSession: 'OFF_SESSION',
      status: 'UPCOMING',
      nextSession: 'LONDON',
      season: london.season,
      targetTime: london.witaStart,
      remainingMs: msUntil
    };
  }

  if (timestamp < newYork.start) {
    const msUntil = newYork.start - timestamp;
    return {
      text: `[ 🇺🇸 Menuju NY Open dalam ${formatDuration(msUntil)} (${newYork.witaStart} WITA) ]`,
      activeSession: 'OFF_SESSION',
      status: 'UPCOMING',
      nextSession: 'NEW_YORK',
      season: newYork.season,
      targetTime: newYork.witaStart,
      remainingMs: msUntil
    };
  }

  const tomorrowTimestamp = timestamp + 24 * 3600 * 1000;
  const tomorrowLondon = sessionDetail(SESSION_DEFINITIONS.LONDON, tomorrowTimestamp);
  const msUntilTomorrow = Math.max(0, tomorrowLondon.start - timestamp);

  return {
    text: `[ 🇬🇧 Menuju London Open dalam ${formatDuration(msUntilTomorrow)} (${tomorrowLondon.witaStart} WITA) ]`,
    activeSession: 'OFF_SESSION',
    status: 'UPCOMING',
    nextSession: 'LONDON',
    season: tomorrowLondon.season,
    targetTime: tomorrowLondon.witaStart,
    remainingMs: msUntilTomorrow
  };
}

export function updateCockpitSessionPill(element, timestamp = Date.now()) {
  const pillEl = typeof element === 'string' ? (typeof document !== 'undefined' ? document.getElementById(element) : null) : element;
  if (!pillEl) return null;
  const info = sessionCountdownPill(timestamp);
  pillEl.textContent = info.text;
  if (info.status === 'ACTIVE') {
    pillEl.className = 'cockpit-session-pill session-active';
    pillEl.style.color = '#22C55E';
    pillEl.style.borderColor = 'rgba(34,197,94,0.4)';
    pillEl.style.background = 'rgba(34,197,94,0.12)';
  } else {
    pillEl.className = 'cockpit-session-pill session-upcoming';
    pillEl.style.color = 'var(--amy-accent,#F5C451)';
    pillEl.style.borderColor = 'rgba(245,196,81,0.3)';
    pillEl.style.background = 'rgba(245,196,81,0.1)';
  }
  return info;
}

export function startCockpitSessionPill(element = 'cockpit-session-pill', intervalMs = 30000) {
  updateCockpitSessionPill(element);
  if (typeof setInterval !== 'undefined' && intervalMs > 0) {
    return setInterval(() => updateCockpitSessionPill(element), intervalMs);
  }
  return null;
}


