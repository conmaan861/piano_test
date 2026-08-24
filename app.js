import {
  KEYS, iso, today, dateAtNoon, uid, loadState, persistState,
  snapshotForCloud, hydrateCloudSnapshot, makeFixture
} from './store.js';
import { TempoAudio, MetronomeEngine, calculateTapTempo } from './audio.js';

const CLOUD_URL = 'https://iftanbhnuozhdxrhoxlg.supabase.co';
const CLOUD_KEY = 'sb_publishable_rVYllZ5DWyzDKvCzwA9mhg_-RjSPgMj';
const STUDIO_SLUG = 'conmaan861';
const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname);
const preview = isLocal && new URLSearchParams(location.search).has('preview');
const state = loadState();
if (preview) makeFixture(new URLSearchParams(location.search).get('fixture') || 'sparse', state);

const $ = selector => document.querySelector(selector);
const screen = $('#screen');
const practiceLayer = $('#practiceLayer');
const practiceScreen = $('#practiceScreen');
const backdrop = $('#dialogBackdrop');
const dialog = $('#dialog');
const announcer = $('#announcer');
const syncState = $('#syncState');
const audio = new TempoAudio();
let cloud = null;
let cloudUser = null;
let cloudReady = false;
let saveTimer = null;
let timerTicker = null;
let countTicker = null;
let toastTimer = null;
let lastFocus = null;
let repertoireFilter = 'Active';
let repertoireSearch = '';
let calendarCursor = dateAtNoon(state.selectedDate || today());
let teacherTab = 'overview';
let taps = [];
let activeBeat = -1;
let metronomeWasRunning = false;

const icons = {
  today: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z"/><path d="M12 8v4l2.6 1.7"/></svg>',
  log: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/></svg>',
  repertoire: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z"/><path d="M5 19a2.5 2.5 0 0 1 2.5-2.5H20"/></svg>',
  progress: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18V9M10 18V5M16 18v-7M22 18V3"/></svg>',
  more: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></svg>',
  plus: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 18-6-6 6-6"/></svg>',
  chevron: '<svg class="chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg>',
  check: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 4 4L19 6"/></svg>',
  user: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
  cloud: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.5 19h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.4-1.8A5 5 0 0 0 6.5 19Z"/></svg>',
  sliders: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  teacher: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 8 9-5 9 5-9 5-9-5Z"/><path d="M7 11v5c3 2.3 7 2.3 10 0v-5M21 8v6"/></svg>',
  download: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>',
  trash: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>'
};

const navItems = [
  ['today', 'Today', icons.today], ['log', 'Practice Log', icons.log],
  ['repertoire', 'Repertoire', icons.repertoire], ['progress', 'Progress', icons.progress],
  ['more', 'More', icons.more]
];

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);
const formatMinutes = value => {
  const raw = Math.max(0, Number(value) || 0);
  if (raw > 0 && raw < 1) return 'Under 1 min';
  const minutes = Math.round(raw);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};
const longDate = value => dateAtNoon(value).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const monthName = value => value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const pieceFor = id => state.pieces.find(piece => String(piece.id) === String(id));
const pieceName = id => {
  const piece = pieceFor(id);
  return piece ? (piece.composer ? `${piece.composer.split(' ').slice(-1)[0]} — ${piece.title}` : piece.title) : '';
};
const sessionMinutes = session => Number(session.durationSeconds ? session.durationSeconds / 60 : session.minutes) || 0;
const dateSessions = date => state.sessions.filter(session => session.date === date);
const todayMinutes = () => sum(dateSessions(today()).map(sessionMinutes));
const setInert = (element, value) => {
  if (!element) return;
  element.inert = value;
  if (value) { element.setAttribute('inert', ''); element.setAttribute('aria-hidden', 'true'); }
  else { element.removeAttribute('inert'); element.removeAttribute('aria-hidden'); }
};

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function save({ cloudSync = true } = {}) {
  if (!preview) persistState(state);
  if (cloudSync && cloudUser && state.role === 'student' && cloudReady && !preview) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCloud, 650);
  }
}

function setView(view, { focus = true } = {}) {
  if (!navItems.some(item => item[0] === view) && view !== 'teacher') view = 'today';
  state.view = view;
  if (view !== 'teacher') state.role = 'student';
  save({ cloudSync: false });
  history.replaceState(null, '', `${location.pathname}${location.search}#${view}`);
  renderNavigation();
  renderView();
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (focus) $('#main')?.focus({ preventScroll: true });
}

function renderNavigation() {
  const markup = navItems.map(([id, label, icon]) => `<button class="nav-link ${state.view === id ? 'selected' : ''}" type="button" data-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></button>`).join('');
  $('#desktopNav').innerHTML = markup;
  $('#bottomNav').innerHTML = markup;
}

function pageHeader(kicker, title, subtitle = '', action = '') {
  return `<header class="page-header"><div><span class="page-kicker">${escapeHtml(kicker)}</span><h1 class="page-title">${escapeHtml(title)}</h1>${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ''}</div>${action}</header>`;
}

function sectionHeader(title, meta = '') {
  return `<div class="section-header"><h2 class="section-title">${escapeHtml(title)}</h2>${meta ? `<span class="section-meta">${escapeHtml(meta)}</span>` : ''}</div>`;
}

function recommendedPlan() {
  const plans = state.plans.filter(plan => plan.date === today() && !plan.completed).sort((a, b) => (a.order || 0) - (b.order || 0));
  return plans[0] || null;
}

function renderToday() {
  const plan = recommendedPlan();
  const plans = state.plans.filter(item => item.date === today()).sort((a, b) => (a.order || 0) - (b.order || 0));
  const practiced = todayMinutes();
  const goal = Number(state.settings.dailyGoal) || 45;
  const suggestedPiece = state.pieces.find(piece => piece.pinned && !piece.archived) || state.pieces.find(piece => !piece.archived);
  const activeSession = ['running','paused','count-in'].includes(state.timer.phase);
  const promptTitle = activeSession ? (pieceName(state.timer.pieceId) || state.timer.category || 'Practice') : plan ? (pieceName(plan.pieceId) || plan.focus || plan.category) : suggestedPiece ? pieceName(suggestedPiece.id) : 'Ready to practise?';
  const promptMeta = activeSession ? (state.timer.phase === 'count-in' ? 'Count-in ready' : `${state.timer.phase === 'paused' ? 'Paused' : 'Session in progress'} · ${timerText(remainingMs())} remaining`) : plan ? `${plan.minutes || state.settings.defaultMinutes} min · ${plan.focus || plan.category || 'Focused practice'}` : suggestedPiece ? (suggestedPiece.section || 'Choose a focus and begin') : 'Set up a focused session in a few taps.';
  const notes = state.teacherNotes.filter(note => !note.completed);
  screen.innerHTML = `
    <header class="today-header"><p class="today-date">${escapeHtml(longDate(today()))}</p><h1 class="today-heading">${state.settings.name ? `Good ${dayPart()}, ${escapeHtml(state.settings.name)}.` : 'Today'}</h1></header>
    <section class="practice-prompt surface raised" aria-labelledby="practicePromptTitle">
      <div><span class="eyebrow">Up next</span><h2 id="practicePromptTitle">${escapeHtml(promptTitle)}</h2><p>${escapeHtml(promptMeta)}</p></div>
      <button class="button primary" data-action="${activeSession ? 'resume-existing' : 'prepare'}" data-plan="${plan?.id || ''}" type="button">${activeSession ? 'Return to practice' : 'Start practice'}</button>
    </section>
    <section class="section">
      ${sectionHeader('Today’s work', plans.length ? `${plans.filter(item => item.completed).length} of ${plans.length}` : '')}
      ${plans.length ? `<div class="plan-list">${plans.map(planRow).join('')}</div>` : `<div class="empty-inline">No plan yet. Start with what needs your attention, or <button class="button tertiary" data-action="add-plan" type="button">add a practice block</button>.</div>`}
    </section>
    <section class="section">
      ${sectionHeader('Today', `${formatMinutes(practiced)} practised`)}
      <div class="progress-line"><span>${Math.min(100, Math.round(practiced / goal * 100))}%</span><span class="progress-track"><i style="width:${Math.min(100, practiced / goal * 100)}%"></i></span><span>${goal} min</span></div>
    </section>
    ${notes.length ? `<section class="section">${sectionHeader('From your teacher')}<div class="context-note"><div><p><strong>${escapeHtml(notes[0].note || notes[0].text)}</strong>${notes[0].focus ? `<br>${escapeHtml(notes[0].focus)}` : ''}</p><button class="button tertiary" data-action="complete-teacher-note" data-id="${notes[0].id}" type="button">Mark done</button></div></div></section>` : ''}`;
}

function dayPart() {
  const hour = new Date().getHours();
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

function planRow(plan) {
  const title = pieceName(plan.pieceId) || plan.category || 'Practice';
  return `<div class="plan-row">
    <input class="plan-check" type="checkbox" data-action="toggle-plan" data-id="${plan.id}" ${plan.completed ? 'checked' : ''} aria-label="Mark ${escapeHtml(title)} complete">
    <button class="row-button" type="button" data-action="prepare" data-plan="${plan.id}"><p class="row-title">${escapeHtml(title)}</p><p class="row-meta">${escapeHtml(plan.focus || 'Focused practice')}</p></button>
    <span class="row-value">${plan.minutes || state.settings.defaultMinutes} min</span>
  </div>`;
}

function renderLog() {
  const year = calendarCursor.getFullYear(), month = calendarCursor.getMonth();
  const first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
  const monthSessions = state.sessions.filter(session => { const d = dateAtNoon(session.date); return d.getFullYear() === year && d.getMonth() === month; });
  const selected = dateSessions(state.selectedDate);
  screen.innerHTML = `
    ${pageHeader('Practice history', 'Practice Log', 'A musical record of what happened—not just a streak.', `<button class="button primary" data-action="log-session" type="button">${icons.plus}<span class="optional">Log practice</span></button>`)}
    <section aria-label="Practice calendar">
      <div class="calendar-toolbar"><div><h2>${escapeHtml(monthName(calendarCursor))}</h2><span class="month-summary">${formatMinutes(sum(monthSessions.map(sessionMinutes)))}</span></div><div class="action-row"><button class="icon-button" data-action="month-prev" aria-label="Previous month">${icons.back}</button><button class="icon-button" data-action="month-next" aria-label="Next month" style="transform:rotate(180deg)">${icons.back}</button></div></div>
      <div class="calendar-grid">${['S','M','T','W','T','F','S'].map(day => `<span class="calendar-dow">${day}</span>`).join('')}${days.map(calendarDay).join('')}</div>
    </section>
    <section class="section">
      <div class="day-summary"><h2>${escapeHtml(longDate(state.selectedDate))}</h2><span class="section-meta">${formatMinutes(sum(selected.map(sessionMinutes)))}</span></div>
      ${selected.length ? `<div class="session-list">${selected.sort((a,b) => String(b.time).localeCompare(String(a.time))).map(sessionRow).join('')}</div>` : `<div class="empty-inline">No practice recorded on this day.</div>`}
    </section>`;
}

function calendarDay(date) {
  const value = iso(date), minutes = sum(dateSessions(value).map(sessionMinutes));
  const level = minutes ? Math.min(4, Math.ceil(minutes / 15)) : 0;
  return `<button class="calendar-day ${date.getMonth() !== calendarCursor.getMonth() ? 'other' : ''} ${level ? `level-${level}` : ''} ${value === today() ? 'today' : ''} ${value === state.selectedDate ? 'selected' : ''}" data-action="select-day" data-date="${value}" type="button" aria-label="${escapeHtml(longDate(value))}, ${formatMinutes(minutes)}">${date.getDate()}</button>`;
}

function sessionRow(session) {
  const title = pieceName(session.pieceId) || session.category || 'Practice';
  return `<button class="session-row row-button" type="button" data-action="edit-session" data-id="${session.id}" style="grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:13px 0"><span><span class="row-title">${escapeHtml(title)}</span><span class="row-meta">${escapeHtml(session.focus || session.notes || 'Practice')}</span></span><span class="row-value">${formatMinutes(sessionMinutes(session))}</span></button>`;
}

function renderRepertoire() {
  const pieces = state.pieces.filter(piece => {
    const query = `${piece.title} ${piece.composer}`.toLowerCase();
    const matchesSearch = query.includes(repertoireSearch.toLowerCase());
    const matchesFilter = repertoireFilter === 'All' || (repertoireFilter === 'Active' && !piece.archived) || (repertoireFilter === 'Priority' && piece.priority >= 3) || (repertoireFilter === 'Archived' && piece.archived);
    return matchesSearch && matchesFilter;
  });
  const genuineEmpty = !state.pieces.length;
  screen.innerHTML = `
    ${pageHeader('Your music', 'Repertoire', 'A working library, organised around the next musical problem.', `<button class="button primary" data-action="add-piece" type="button">${icons.plus}<span class="optional">Add piece</span></button>`)}
    <input class="search-field" id="repertoireSearch" type="search" placeholder="Search repertoire" value="${escapeHtml(repertoireSearch)}" aria-label="Search repertoire">
    <div class="filters" aria-label="Repertoire filters">${['Active','Priority','All','Archived'].map(filter => `<button class="filter-chip ${repertoireFilter === filter ? 'selected' : ''}" data-action="filter-repertoire" data-filter="${filter}" type="button">${filter}</button>`).join('')}</div>
    ${pieces.length ? `<div class="piece-list">${pieces.sort((a,b) => Number(b.pinned)-Number(a.pinned) || Number(b.priority)-Number(a.priority) || a.title.localeCompare(b.title)).map(pieceRow).join('')}</div>` : genuineEmpty ? `<div class="empty-state"><div class="empty-companion"><img src="./greyhound-mascot-sprite.png" alt=""></div><h2>Your repertoire is waiting.</h2><p>Add the first piece you want to shape. You can include the passage and tempo that need attention.</p><button class="button primary" data-action="add-piece">Add first piece</button></div>` : `<div class="empty-state"><h2>No pieces match.</h2><p>Try a different search or remove the current filter.</p><button class="button secondary" data-action="clear-filters">Clear filters</button></div>`}`;
}

function pieceRow(piece) {
  const practiced = sum(state.sessions.filter(session => String(session.pieceId) === String(piece.id)).map(sessionMinutes));
  return `<button class="piece-row row-button" type="button" data-action="edit-piece" data-id="${piece.id}"><span><span class="piece-composer">${escapeHtml(piece.composer || 'Unattributed')}</span><span class="row-title">${escapeHtml(piece.title)}</span><span class="row-meta">${escapeHtml(piece.status)}${piece.priority >= 3 ? ' · High priority' : ''}${piece.section ? `<br>${escapeHtml(piece.section)}` : ''}</span></span><span class="row-value">${practiced ? formatMinutes(practiced) : '<span class="status">New</span>'}</span></button>`;
}

function weekData(offset = 0) {
  const now = new Date();
  const monday = new Date(now); monday.setHours(12,0,0,0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - (offset * 7));
  return Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); const minutes = sum(dateSessions(iso(date)).map(sessionMinutes)); return { date, minutes }; });
}

function renderProgress() {
  if (!state.sessions.length) {
    screen.innerHTML = `${pageHeader('Practice patterns', 'Progress', 'Tempo will reveal where your attention is going.')}<div class="empty-state"><h2>Your practice story will appear here.</h2><p>Complete a few sessions and Tempo will begin to show how your time, repertoire and tempo are moving.</p><button class="button primary" data-action="prepare">Start a session</button></div>`;
    return;
  }
  const week = weekData(), previous = weekData(1);
  const total = sum(week.map(item => item.minutes)), previousTotal = sum(previous.map(item => item.minutes));
  const days = week.filter(item => item.minutes > 0).length;
  const difference = Math.round(total - previousTotal);
  const attention = state.pieces.map(piece => ({ piece, minutes: sum(state.sessions.filter(session => String(session.pieceId) === String(piece.id) && week.some(day => iso(day.date) === session.date)).map(sessionMinutes)) })).filter(item => item.minutes).sort((a,b) => b.minutes-a.minutes);
  const tempoMoves = state.pieces.map(piece => {
    const sessions = state.sessions.filter(session => String(session.pieceId) === String(piece.id) && (session.bpmStart || session.bpmEnd));
    return sessions.length ? { piece, from: sessions[0].bpmStart || sessions[0].bpm, to: sessions[sessions.length-1].bpmEnd || sessions[sessions.length-1].bpm } : null;
  }).filter(Boolean).filter(item => item.from && item.to && item.from !== item.to);
  const max = Math.max(1, ...week.map(item => item.minutes));
  screen.innerHTML = `
    ${pageHeader('Practice patterns', 'Progress', 'What your recent work is beginning to show.')}
    <section class="progress-hero"><span class="eyebrow">This week</span><p class="progress-number">${escapeHtml(formatMinutes(total))}</p><p class="progress-caption">${days} practice ${days === 1 ? 'day' : 'days'}${difference ? ` · <span class="comparison ${difference < 0 ? 'down' : ''}">${difference > 0 ? '+' : '−'}${formatMinutes(Math.abs(difference))} from last week</span>` : ''}</p></section>
    <section class="section">${sectionHeader('Practice over time')}<div class="week-bars" aria-label="Minutes practised each day">${week.map(item => `<div class="week-bar" title="${item.minutes} minutes"><i style="height:${Math.max(3, item.minutes / max * 100)}%"></i><span>${item.date.toLocaleDateString(undefined,{weekday:'narrow'})}</span></div>`).join('')}</div></section>
    <section class="section">${sectionHeader('Repertoire attention')}${attention.length ? attention.map(item => `<div class="attention-row"><span><strong>${escapeHtml(pieceName(item.piece.id))}</strong>${item.piece.section ? `<span class="row-meta">${escapeHtml(item.piece.section)}</span>` : ''}</span><span class="row-value">${formatMinutes(item.minutes)}</span></div>`).join('') : '<div class="empty-inline">This week’s sessions were not linked to repertoire.</div>'}</section>
    ${tempoMoves.length ? `<section class="section">${sectionHeader('Recent movement')}${tempoMoves.slice(0,4).map(item => `<div class="attention-row"><span><strong>${escapeHtml(pieceName(item.piece.id))}</strong></span><span class="tempo-movement"><strong>${item.from} → ${item.to}</strong><span class="row-meta">BPM</span></span></div>`).join('')}</section>` : ''}`;
}

function renderMore() {
  const account = cloudUser ? `<h2>${escapeHtml(cloudUser.email || 'Tempo account')}</h2><p>Your studio is saved locally and synced to the cloud.</p><button class="button secondary" data-action="sign-out">Sign out</button>` : `<h2>Your studio, on every device.</h2><p>Practice data already stays on this device. Sign in to sync it securely.</p><button class="button primary" data-action="account">Sign in or create account</button>`;
  const goal = Number(state.settings.dailyGoal) || 45;
  screen.innerHTML = `
    ${pageHeader('Studio', 'More', 'Settings and tools that stay out of the practice flow.')}
    <section class="account-panel surface">${account}</section>
    <section class="section">${sectionHeader('Practice defaults')}<div class="settings-list">
      ${settingRow(icons.user, 'Your name', state.settings.name || 'Not set', 'edit-settings')}
      ${settingRow(icons.today, 'Daily intention', `${goal} min`, 'edit-settings')}
      ${settingRow(icons.sliders, 'Session defaults', `${state.settings.defaultMinutes || 30} min · ${state.settings.defaultBpm || 75} BPM`, 'edit-settings')}
      ${settingRow(icons.teacher, 'Teacher workspace', 'Assignments and lesson report', 'teacher')}
      ${cloudUser ? settingRow(icons.cloud, 'Teacher access code', 'Update private access', 'teacher-code') : ''}
    </div></section>
    <section class="section">${sectionHeader('Data')}<div class="settings-list">
      ${settingRow(icons.download, 'Export studio', 'Portable JSON backup', 'export')}
      ${settingRow(icons.cloud, 'Import studio', 'Restore or move your data', 'import')}
    </div><input id="importFile" type="file" accept="application/json" hidden></section>
    <section class="section">${sectionHeader('About')}<p class="page-subtitle">Tempo keeps timers and metronome audio on this device. Dynamic timer changes are not announced every second, and motion follows your system preference.</p></section>`;
}

function settingRow(icon, title, value, action) {
  return `<button class="settings-row row-button" type="button" data-action="${action}">${icon}<span><span class="row-title">${escapeHtml(title)}</span><span class="row-meta">${escapeHtml(value)}</span></span>${icons.chevron}</button>`;
}

function teacherWeekSummary() {
  const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0,0,0,0);
  const sessions = state.sessions.filter(session => dateAtNoon(session.date) >= since);
  return { sessions, minutes: sum(sessions.map(sessionMinutes)), days: new Set(sessions.map(session => session.date)).size };
}

function renderTeacher() {
  state.role = 'teacher';
  const unlocked = preview || sessionStorage.getItem('tempoTeacherCode');
  if (!unlocked) {
    screen.innerHTML = `${pageHeader('Private workspace', 'Teacher Mode', 'See the student’s work since the previous lesson.')}<section class="account-panel surface"><h2>Enter the teacher access code</h2><p>This workspace is separate from the student’s practice interface.</p><form id="teacherUnlockForm" class="form-grid"><label class="field full">Access code<input name="code" type="password" autocomplete="current-password" required minlength="8"></label><div class="field full"><button class="button primary" data-action="submit-form" type="button">Open workspace</button></div><p class="row-meta" id="teacherUnlockMessage"></p></form></section><button class="button tertiary" data-view="more">Back to settings</button>`;
    return;
  }
  const summary = teacherWeekSummary();
  const tabs = `<div class="teacher-tabs" role="tablist">${[['overview','Overview'],['assignments','Assignments'],['report','Lesson report']].map(([id,label]) => `<button class="teacher-tab ${teacherTab === id ? 'selected' : ''}" data-action="teacher-tab" data-tab="${id}" role="tab" aria-selected="${teacherTab === id}">${label}</button>`).join('')}</div>`;
  screen.innerHTML = `${pageHeader('Teacher workspace', state.settings.name || 'Student studio', 'A concise view of work completed since the last lesson.', `<button class="button secondary" data-action="leave-teacher">Student view</button>`)}${tabs}${teacherTab === 'overview' ? teacherOverview(summary) : teacherTab === 'assignments' ? teacherAssignments() : teacherReport(summary)}`;
}

function teacherOverview(summary) {
  const recent = [...summary.sessions].sort((a,b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).slice(0,5);
  const attention = state.pieces.map(piece => ({ piece, minutes: sum(summary.sessions.filter(session => String(session.pieceId) === String(piece.id)).map(sessionMinutes)) })).filter(item => item.minutes).sort((a,b) => b.minutes-a.minutes);
  return `<section class="teacher-summary"><div class="summary-item"><span class="eyebrow">Past 7 days</span><strong>${formatMinutes(summary.minutes)}</strong></div><div class="summary-item"><span class="eyebrow">Practice days</span><strong>${summary.days}</strong></div><div class="summary-item"><span class="eyebrow">Sessions</span><strong>${summary.sessions.length}</strong></div></section>
    <section class="section">${sectionHeader('Recent work')}${recent.length ? `<div class="session-list">${recent.map(teacherSessionRow).join('')}</div>` : '<div class="empty-inline">No sessions yet.</div>'}</section>
    <section class="section">${sectionHeader('Attention')}${attention.length ? attention.map(item => `<div class="attention-row"><strong>${escapeHtml(pieceName(item.piece.id))}</strong><span class="row-value">${formatMinutes(item.minutes)}</span></div>`).join('') : '<div class="empty-inline">Repertoire attention will appear after linked sessions.</div>'}</section>`;
}

function teacherSessionRow(session) {
  const title = pieceName(session.pieceId) || session.category || 'Practice';
  return `<div class="session-row" style="grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:13px 0"><span><span class="row-title">${escapeHtml(title)}</span><span class="row-meta">${escapeHtml(session.focus || session.notes || 'Practice')}</span></span><span class="row-value">${formatMinutes(sessionMinutes(session))}</span></div>`;
}

function teacherAssignments() {
  const notes = state.teacherNotes;
  return `<div class="action-row"><button class="button primary" data-action="add-assignment" type="button">${icons.plus} Assign focus</button></div><section class="section">${sectionHeader('Current assignments')}${notes.length ? `<div class="assignment-list">${notes.map(note => `<div class="assignment-row" style="grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:13px 0"><span><span class="row-title">${escapeHtml(note.note || note.text)}</span><span class="row-meta">${escapeHtml(note.focus || 'General practice')}${note.due_date ? ` · due ${escapeHtml(longDate(note.due_date))}` : ''}</span></span><span class="status">${note.completed ? 'Complete' : 'Open'}</span></div>`).join('')}</div>` : '<div class="empty-inline">No teacher assignments yet.</div>'}</section>`;
}

function teacherReport(summary) {
  const notes = summary.sessions.filter(session => session.notes).slice(-5).reverse();
  return `<div class="action-row"><button class="button secondary" data-action="print" type="button">Print lesson report</button></div><section class="section">${sectionHeader('Since the previous week')}<p class="progress-number">${formatMinutes(summary.minutes)}</p><p class="progress-caption">${summary.sessions.length} sessions across ${summary.days} days</p></section><section class="section">${sectionHeader('Student reflections')}${notes.length ? notes.map(session => `<div class="context-note" style="margin-bottom:8px"><p><strong>${escapeHtml(pieceName(session.pieceId) || session.category)}</strong><br>${escapeHtml(session.notes)}</p></div>`).join('') : '<div class="empty-inline">No reflections were recorded.</div>'}</section>`;
}

function renderView() {
  if (state.view === 'today') renderToday();
  else if (state.view === 'log') renderLog();
  else if (state.view === 'repertoire') renderRepertoire();
  else if (state.view === 'progress') renderProgress();
  else if (state.view === 'teacher') renderTeacher();
  else renderMore();
}

function openDialog(markup, onReady) {
  lastFocus = document.activeElement;
  dialog.innerHTML = markup;
  backdrop.hidden = false;
  if (practiceLayer.hidden) setInert($('#appShell'), true);
  else setInert(practiceLayer, true);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    (dialog.querySelector('[autofocus]') || dialog.querySelector('input,button,select,textarea'))?.focus();
    onReady?.();
  });
}

function closeDialog() {
  backdrop.hidden = true;
  dialog.innerHTML = '';
  if (practiceLayer.hidden) setInert($('#appShell'), false);
  else setInert(practiceLayer, false);
  document.body.style.overflow = practiceLayer.hidden ? '' : 'hidden';
  lastFocus?.focus?.();
}

function dialogHeader(title) {
  return `<header class="dialog-header"><h2 id="dialogTitle">${escapeHtml(title)}</h2><button class="icon-button" data-action="close-dialog" type="button" aria-label="Close">${icons.close}</button></header>`;
}

function openPieceDialog(id = null) {
  const piece = id ? pieceFor(id) : null;
  openDialog(`${dialogHeader(piece ? 'Edit piece' : 'Add a piece')}<form id="pieceForm" class="form-grid">
    <input name="id" type="hidden" value="${piece?.id || ''}">
    <label class="field full">Title<input name="title" value="${escapeHtml(piece?.title || '')}" required autofocus></label>
    <label class="field full">Composer<input name="composer" value="${escapeHtml(piece?.composer || '')}" placeholder="Optional"></label>
    <label class="field">Stage<select name="status">${['New','Learning notes','Developing fluency','Polishing','Performance ready','Archived'].map(value => `<option ${piece?.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
    <label class="field">Priority<select name="priority">${[[1,'Low'],[2,'Medium'],[3,'High']].map(([value,label]) => `<option value="${value}" ${Number(piece?.priority || 2) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <label class="field full">Current focus<input name="section" value="${escapeHtml(piece?.section || '')}" placeholder="e.g. Hands together · bars 12–18"></label>
    <details class="details"><summary>Tempo and notes</summary><div class="details-grid"><label class="field">Current BPM<input name="currentBpm" type="number" min="30" max="240" value="${piece?.currentBpm || ''}"></label><label class="field">Target BPM<input name="targetBpm" type="number" min="30" max="240" value="${piece?.targetBpm || ''}"></label><label class="field full">Notes<textarea name="notes">${escapeHtml(piece?.notes || '')}</textarea></label></div></details>
    <div class="dialog-actions field full">${piece ? '<button class="button danger" data-action="archive-piece" type="button">Archive</button>' : ''}<button class="button tertiary" data-action="close-dialog" type="button">Cancel</button><button class="button primary" data-action="submit-form" type="button">${piece ? 'Save changes' : 'Add piece'}</button></div>
  </form>`);
}

function openSessionDialog(id = null) {
  const session = id ? state.sessions.find(item => String(item.id) === String(id)) : null;
  openDialog(`${dialogHeader(session ? 'Edit practice' : 'Log practice')}<form id="sessionForm" class="form-grid">
    <input name="id" type="hidden" value="${session?.id || ''}">
    <label class="field">Date<input name="date" type="date" value="${session?.date || state.selectedDate || today()}" required autofocus></label>
    <label class="field">Minutes<input name="minutes" type="number" min="1" max="600" value="${Math.round(sessionMinutes(session || {})) || state.settings.defaultMinutes}" required></label>
    <label class="field full">Piece or skill<select name="pieceId"><option value="">Technique / general practice</option>${state.pieces.filter(piece => !piece.archived).map(piece => `<option value="${piece.id}" ${String(session?.pieceId) === String(piece.id) ? 'selected' : ''}>${escapeHtml(pieceName(piece.id))}</option>`).join('')}</select></label>
    <label class="field full">Focus<input name="focus" value="${escapeHtml(session?.focus || '')}" placeholder="e.g. LH balance · bars 12–18"></label>
    <label class="field full">What changed?<textarea name="notes">${escapeHtml(session?.notes || '')}</textarea></label>
    <div class="dialog-actions field full">${session ? '<button class="button danger" data-action="delete-session" type="button">Delete</button>' : ''}<button class="button tertiary" data-action="close-dialog" type="button">Cancel</button><button class="button primary" data-action="submit-form" type="button">Save session</button></div>
  </form>`);
}

function openPlanDialog() {
  openDialog(`${dialogHeader('Add today’s work')}<form id="planForm" class="form-grid">
    <label class="field full">Piece or skill<select name="pieceId"><option value="">Technique / general practice</option>${state.pieces.filter(piece => !piece.archived).map(piece => `<option value="${piece.id}">${escapeHtml(pieceName(piece.id))}</option>`).join('')}</select></label>
    <label class="field full">Focus<input name="focus" required autofocus placeholder="e.g. Slow practice · bars 12–18"></label>
    <label class="field">Duration<input name="minutes" type="number" min="1" max="180" value="${state.settings.defaultMinutes || 30}" required></label>
    <label class="field">Category<select name="category"><option>Repertoire</option><option>Technique</option><option>Sight-reading</option><option>Improvisation</option></select></label>
    <div class="dialog-actions field full"><button class="button tertiary" data-action="close-dialog" type="button">Cancel</button><button class="button primary" data-action="submit-form" type="button">Add to today</button></div>
  </form>`);
}

function openSettingsDialog() {
  openDialog(`${dialogHeader('Practice defaults')}<form id="settingsForm" class="form-grid">
    <label class="field full">Your name<input name="name" value="${escapeHtml(state.settings.name || '')}" autofocus></label>
    <label class="field">Daily intention (min)<input name="dailyGoal" type="number" min="5" max="300" value="${state.settings.dailyGoal || 45}"></label>
    <label class="field">Default session (min)<input name="defaultMinutes" type="number" min="1" max="180" value="${state.settings.defaultMinutes || 30}"></label>
    <label class="field">Default BPM<input name="defaultBpm" type="number" min="30" max="240" value="${state.settings.defaultBpm || 75}"></label>
    <label class="field">Count-in sound<select name="countInSound"><option value="true" ${state.settings.countInSound !== false ? 'selected' : ''}>On</option><option value="false" ${state.settings.countInSound === false ? 'selected' : ''}>Off</option></select></label>
    <label class="field">Completion sound<select name="completionSound"><option value="true" ${state.settings.completionSound !== false ? 'selected' : ''}>On</option><option value="false" ${state.settings.completionSound === false ? 'selected' : ''}>Off</option></select></label>
    <div class="dialog-actions field full"><button class="button tertiary" data-action="close-dialog" type="button">Cancel</button><button class="button primary" data-action="submit-form" type="button">Save settings</button></div>
  </form>`);
}

function openAccountDialog() {
  openDialog(`${dialogHeader('Tempo account')}<form id="accountForm" class="form-grid"><label class="field full">Email<input name="email" type="email" autocomplete="email" required autofocus></label><label class="field full">Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><p class="row-meta field full" id="accountMessage">Sign in to sync this studio. Your local data remains available either way.</p><div class="dialog-actions field full"><button class="button secondary" data-action="sign-up" type="button">Create account</button><button class="button primary" data-action="submit-form" type="button">Sign in</button></div></form>`);
}

function openAssignmentDialog() {
  openDialog(`${dialogHeader('Assign a focus')}<form id="assignmentForm" class="form-grid"><label class="field full">Access code<input name="accessCode" type="password" value="${escapeHtml(sessionStorage.getItem('tempoTeacherCode') || '')}" required></label><label class="field full">Assignment<textarea name="note" required autofocus placeholder="What should the student work on?"></textarea></label><label class="field full">Musical focus<input name="focus" placeholder="e.g. Even semiquavers · bars 24–30"></label><label class="field">Due date<input name="dueDate" type="date"></label><p class="row-meta field full" id="assignmentMessage"></p><div class="dialog-actions field full"><button class="button tertiary" data-action="close-dialog" type="button">Cancel</button><button class="button primary" data-action="submit-form" type="button">Assign</button></div></form>`);
}

function openTeacherCodeDialog() {
  openDialog(`${dialogHeader('Teacher access code')}<form id="teacherCodeForm" class="form-grid"><label class="field full">New access code<input name="code" type="password" minlength="8" required autofocus></label><p class="row-meta field full" id="teacherCodeMessage">Use at least 8 characters and share it privately with your teacher.</p><div class="dialog-actions field full"><button class="button tertiary" data-action="close-dialog" type="button">Cancel</button><button class="button primary" data-action="submit-form" type="button">Update code</button></div></form>`);
}

const metronome = new MetronomeEngine(audio, (beat, total) => {
  activeBeat = beat;
  practiceScreen.querySelectorAll('.beat-dot').forEach((dot, index) => dot.classList.toggle('active', index === beat));
  setTimeout(() => {
    if (activeBeat === beat) practiceScreen.querySelectorAll('.beat-dot').forEach(dot => dot.classList.remove('active'));
  }, Math.min(120, 30000 / state.metronome.bpm));
});

function openPrepare(seed = {}) {
  clearPracticeTimers();
  metronome.stop();
  const plan = seed.planId ? state.plans.find(item => String(item.id) === String(seed.planId)) : null;
  const piece = seed.pieceId || plan?.pieceId || state.timer.pieceId || recommendedPlan()?.pieceId || state.pieces.find(item => item.pinned && !item.archived)?.id || null;
  state.timer = {
    ...state.timer,
    version: 2,
    phase: 'prepare',
    pieceId: piece,
    category: piece ? 'Repertoire' : (plan?.category || seed.category || 'Technique'),
    focus: plan?.focus || seed.focus || pieceFor(piece)?.section || '',
    plannedDurationMs: Number(plan?.minutes || seed.minutes || state.settings.defaultMinutes || 30) * 60000,
    remainingAtPauseMs: Number(plan?.minutes || seed.minutes || state.settings.defaultMinutes || 30) * 60000,
    targetEndAt: null, countInEndsAt: null, startedAt: null, completedAt: null,
    actualDurationMs: null, planId: plan?.id || null, sessionId: null,
    startingBpm: pieceFor(piece)?.currentBpm || null, endingBpm: null, metronomeUsed: false
  };
  save({ cloudSync: false });
  showPractice();
  renderPrepare();
}

function showPractice() {
  practiceLayer.hidden = false;
  setInert($('#appShell'), true);
  document.body.style.overflow = 'hidden';
  practiceLayer.scrollTop = 0;
}

function closePractice() {
  if (['running','paused','count-in'].includes(state.timer.phase) && !confirm('Leave this practice session? Your current timer will be kept so you can return.')) return;
  clearPracticeTimers();
  metronome.stop();
  practiceLayer.hidden = true;
  setInert($('#appShell'), false);
  practiceScreen.innerHTML = '';
  document.body.style.overflow = '';
  renderView();
}

function renderPrepare() {
  const activePieces = state.pieces.filter(piece => !piece.archived);
  const minutes = Math.round(state.timer.plannedDurationMs / 60000);
  const choices = [
    ...activePieces.slice(0, 6).map(piece => ({ id: piece.id, label: pieceName(piece.id), category: 'Repertoire' })),
    { id: '', label: 'Technique', category: 'Technique' },
    { id: '', label: 'Sight-reading', category: 'Sight-reading' }
  ];
  practiceScreen.innerHTML = `<div class="practice-topbar"><button class="icon-button" data-action="close-practice" type="button" aria-label="Close practice setup">${icons.close}</button><strong>Prepare</strong><span style="width:44px"></span></div>
    <main class="prepare"><h1>What needs your attention?</h1><p class="prepare-copy">Choose the musical work. Tempo will handle the clock.</p>
      <section class="prepare-group"><h2>Piece or skill</h2><div class="choice-list">${choices.map(choice => `<button class="choice-chip ${String(state.timer.pieceId || '') === String(choice.id) && state.timer.category === choice.category ? 'selected' : ''}" data-action="choose-piece" data-piece="${choice.id}" data-category="${choice.category}" type="button">${escapeHtml(choice.label)}</button>`).join('')}</div></section>
      <section class="prepare-group"><h2>Focus <span class="row-meta">optional</span></h2><input class="focus-input" id="practiceFocus" value="${escapeHtml(state.timer.focus || '')}" placeholder="Bars, balance, rhythm, sound…" aria-label="Practice focus"></section>
      <section class="prepare-group"><h2>Duration</h2><div class="duration-list">${[10,20,30,45,60].map(value => `<button class="duration-chip ${minutes === value ? 'selected' : ''}" data-action="choose-duration" data-minutes="${value}" type="button">${value}</button>`).join('')}<button class="duration-chip ${![10,20,30,45,60].includes(minutes) ? 'selected' : ''}" data-action="custom-duration" type="button">${![10,20,30,45,60].includes(minutes) ? `${minutes} min` : 'Custom'}</button></div></section>
      <button class="button primary start-practice" data-action="start-count-in" type="button">Start practice</button>
    </main>`;
}

async function startCountIn() {
  state.timer.focus = $('#practiceFocus')?.value.trim() || '';
  state.timer.phase = 'count-in';
  state.timer.countInEndsAt = Date.now() + 3040;
  state.timer.targetEndAt = null;
  await audio.ensure();
  audio.scheduleCountIn(state.settings.countInSound !== false);
  save({ cloudSync: false });
  renderCountIn();
}

function renderCountIn() {
  showPractice();
  clearInterval(countTicker);
  let previousCue = '';
  const update = () => {
    const remaining = Number(state.timer.countInEndsAt) - Date.now();
    if (remaining <= 0) { clearInterval(countTicker); beginRunning(); return; }
    const elapsed = 3040 - remaining;
    const index = clamp(Math.floor(elapsed / 760), 0, 3);
    const cue = ['3','2','1','Play'][index];
    if (cue !== previousCue) {
      previousCue = cue;
      practiceScreen.innerHTML = `<div class="count-in"><div><span class="eyebrow">Count in</span><div class="count-cue" ${cue === 'Play' ? 'style="font-family:var(--serif);font-size:72px;letter-spacing:-.04em"' : ''}>${cue}</div></div></div>`;
      announcer.textContent = cue;
    }
  };
  update();
  countTicker = setInterval(update, 40);
}

function beginRunning() {
  clearInterval(countTicker);
  const now = Date.now();
  state.timer.phase = 'running';
  state.timer.startedAt = state.timer.startedAt || now;
  state.timer.targetEndAt = now + Number(state.timer.remainingAtPauseMs || state.timer.plannedDurationMs);
  state.timer.countInEndsAt = null;
  save({ cloudSync: false });
  renderPracticeActive();
  startTimerTicker();
}

function remainingMs() {
  if (state.timer.phase === 'running') return Math.max(0, Number(state.timer.targetEndAt) - Date.now());
  return Math.max(0, Number(state.timer.remainingAtPauseMs) || 0);
}

function timerText(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderPracticeActive() {
  showPractice();
  const paused = state.timer.phase === 'paused';
  const name = pieceName(state.timer.pieceId) || state.timer.category || 'Practice';
  practiceScreen.innerHTML = `<main class="active-practice">
    <div class="practice-topbar"><button class="icon-button" data-action="close-practice" type="button" aria-label="Leave session">${icons.close}</button><strong>Practice</strong><span style="width:44px"></span></div>
    <div class="session-context"><h1 class="session-piece">${escapeHtml(name)}</h1>${state.timer.focus ? `<p class="session-focus">${escapeHtml(state.timer.focus)}</p>` : ''}</div>
    <div class="timer-display" role="timer" aria-label="Time remaining"><span class="timer-state">${paused ? 'Paused' : 'Remaining'}</span><span id="timerValue">${timerText(remainingMs())}</span></div>
    <div class="practice-controls"><button class="button primary" data-action="${paused ? 'resume-session' : 'pause-session'}" type="button">${paused ? 'Resume' : 'Pause'}</button><button class="button secondary" data-action="finish-session" type="button">Finish</button></div>
    ${metronomeMarkup(paused)}
  </main>`;
}

function metronomeMarkup(paused) {
  const running = metronome.running;
  return `<section class="metronome" aria-label="Metronome">
    <div class="metronome-head"><div><span class="eyebrow">Metronome</span><div class="bpm-control"><button class="icon-button" data-action="bpm-down" aria-label="Decrease tempo">−</button><div class="bpm-value">${state.metronome.bpm}<small>BPM</small></div><button class="icon-button" data-action="bpm-up" aria-label="Increase tempo">+</button></div></div><button class="button secondary" data-action="toggle-metronome" ${paused ? 'disabled' : ''}>${running ? 'Stop' : 'Start'}</button></div>
    <div class="beat-indicator" aria-hidden="true">${Array.from({ length: state.metronome.numerator }, (_, index) => `<i class="beat-dot ${index === 0 ? 'accent' : ''}"></i>`).join('')}</div>
    <div class="metronome-options"><button class="button tertiary" data-action="tap-tempo" ${paused ? 'disabled' : ''}>Tap tempo</button><select class="compact-select" data-action="time-signature" aria-label="Time signature" ${paused ? 'disabled' : ''}>${[[2,4],[3,4],[4,4],[6,8]].map(([n,d]) => `<option value="${n}/${d}" ${state.metronome.numerator === n && state.metronome.denominator === d ? 'selected' : ''}>${n}/${d}</option>`).join('')}</select><button class="button tertiary" data-action="toggle-mute" ${paused ? 'disabled' : ''}>${state.metronome.muted ? 'Sound off' : 'Sound on'}</button><label class="sr-only" for="metroVolume">Metronome volume</label><input class="volume" id="metroVolume" data-action="volume" type="range" min="0" max="1" step="0.05" value="${state.metronome.volume}" ${paused ? 'disabled' : ''}></div>
  </section>`;
}

function startTimerTicker() {
  clearInterval(timerTicker);
  let last = null;
  const tick = () => {
    if (state.timer.phase !== 'running') return;
    const remaining = remainingMs();
    if (remaining <= 0) { completeSession(true); return; }
    const text = timerText(remaining);
    if (text !== last) {
      last = text;
      const value = $('#timerValue');
      if (value) value.textContent = text;
    }
  };
  tick();
  timerTicker = setInterval(tick, 250);
}

function pauseSession() {
  state.timer.remainingAtPauseMs = remainingMs();
  state.timer.phase = 'paused';
  metronomeWasRunning = metronome.running;
  metronome.stop();
  clearInterval(timerTicker);
  save({ cloudSync: false });
  renderPracticeActive();
  announcer.textContent = 'Practice paused';
}

function resumeSession() {
  state.timer.phase = 'running';
  state.timer.targetEndAt = Date.now() + Number(state.timer.remainingAtPauseMs);
  save({ cloudSync: false });
  renderPracticeActive();
  startTimerTicker();
  if (metronomeWasRunning) startMetronome();
  announcer.textContent = 'Practice resumed';
}

function completeSession(natural = false) {
  const remaining = natural ? 0 : remainingMs();
  const planned = Number(state.timer.plannedDurationMs) || 0;
  const actual = Math.max(0, planned - remaining);
  state.timer.phase = 'completed';
  state.timer.actualDurationMs = natural ? planned : actual;
  state.timer.remainingAtPauseMs = 0;
  state.timer.targetEndAt = null;
  state.timer.completedAt = Date.now();
  clearPracticeTimers();
  metronome.stop();
  save({ cloudSync: false });
  if (natural) audio.playCompletion(state.settings.completionSound !== false);
  renderComplete();
  announcer.textContent = natural ? 'Practice complete' : 'Practice finished';
}

function renderComplete() {
  showPractice();
  const duration = Math.max(0, Number(state.timer.actualDurationMs || state.timer.plannedDurationMs));
  const short = duration < 30000;
  practiceScreen.innerHTML = `<main class="complete"><div class="complete-mark">${icons.check}</div><span class="eyebrow">${short ? 'Session stopped' : 'Practice complete'}</span><h1>${short ? 'Too brief to record?' : 'A little further.'}</h1><p class="complete-duration">${duration < 60000 ? `${Math.round(duration / 1000)} sec` : formatMinutes(duration / 60000)}</p><p class="complete-piece">${escapeHtml(pieceName(state.timer.pieceId) || state.timer.category || 'Practice')}</p>${state.timer.focus ? `<p class="complete-focus">${escapeHtml(state.timer.focus)}</p>` : '<div class="complete-focus"></div>'}<label class="field" for="reflection">What changed? <span class="row-meta">optional</span></label><textarea class="reflection" id="reflection" placeholder="One or two lines is enough."></textarea><div class="complete-actions"><button class="button primary" data-action="save-completed" type="button">${short ? 'Save anyway' : 'Save session'}</button><button class="button secondary" data-action="add-five" type="button">Add 5 minutes</button><button class="button tertiary" data-action="discard-session" type="button">Discard</button></div></main>`;
}

function saveCompleted() {
  if (!state.timer.sessionId) {
    const durationSeconds = Math.max(1, Math.round(Number(state.timer.actualDurationMs || state.timer.plannedDurationMs) / 1000));
    const date = new Date(state.timer.completedAt || Date.now());
    const session = {
      id: uid(), date: iso(date), time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      minutes: Math.max(1, Math.round(durationSeconds / 60)), durationSeconds,
      category: state.timer.category || 'Repertoire', pieceId: state.timer.pieceId || null,
      focus: state.timer.focus || 'Practice', notes: $('#reflection')?.value.trim() || '',
      bpmStart: state.timer.startingBpm || null, bpmEnd: state.timer.endingBpm || state.metronome.bpm || null,
      bpm: state.timer.endingBpm || state.metronome.bpm || null, metronomeUsed: Boolean(state.timer.metronomeUsed), tags: []
    };
    state.sessions.push(session);
    state.timer.sessionId = session.id;
    if (state.timer.planId) {
      const plan = state.plans.find(item => String(item.id) === String(state.timer.planId));
      if (plan) plan.completed = true;
    }
  }
  state.timer.phase = 'prepare';
  save();
  practiceLayer.hidden = true;
  setInert($('#appShell'), false);
  practiceScreen.innerHTML = '';
  document.body.style.overflow = '';
  state.view = 'today';
  renderNavigation(); renderView();
  notify('Session saved');
}

function addFiveMinutes() {
  const prior = Number(state.timer.actualDurationMs || 0);
  state.timer.phase = 'running';
  state.timer.plannedDurationMs = prior + 300000;
  state.timer.remainingAtPauseMs = 300000;
  state.timer.targetEndAt = Date.now() + 300000;
  state.timer.actualDurationMs = null;
  state.timer.completedAt = null;
  save({ cloudSync: false });
  renderPracticeActive(); startTimerTicker();
}

function discardPractice() {
  state.timer = { ...state.timer, phase: 'prepare', targetEndAt: null, countInEndsAt: null, startedAt: null, completedAt: null, actualDurationMs: null, sessionId: null };
  save({ cloudSync: false });
  practiceLayer.hidden = true; setInert($('#appShell'), false); practiceScreen.innerHTML = ''; document.body.style.overflow = '';
  renderView(); notify('Session discarded');
}

function clearPracticeTimers() {
  clearInterval(timerTicker); clearInterval(countTicker);
  timerTicker = null; countTicker = null;
}

async function startMetronome() {
  state.timer.metronomeUsed = true;
  state.timer.startingBpm = state.timer.startingBpm || state.metronome.bpm;
  state.timer.endingBpm = state.metronome.bpm;
  await metronome.start(state.metronome);
  save({ cloudSync: false });
  renderPracticeActive();
  startTimerTicker();
}

function updateMetronome(patch, rerender = true) {
  state.metronome = { ...state.metronome, ...patch };
  state.timer.endingBpm = state.metronome.bpm;
  metronome.update(state.metronome);
  save({ cloudSync: false });
  if (rerender) { renderPracticeActive(); if (state.timer.phase === 'running') startTimerTicker(); }
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-view],[data-action]');
  if (!target) return;
  if (target.dataset.view) { setView(target.dataset.view); return; }
  const action = target.dataset.action;
  if (action === 'prepare') openPrepare({ planId: target.dataset.plan || null });
  else if (action === 'resume-existing') {
    if (state.timer.phase === 'count-in') renderCountIn();
    else { renderPracticeActive(); if (state.timer.phase === 'running') startTimerTicker(); }
  }
  else if (action === 'add-piece') openPieceDialog();
  else if (action === 'edit-piece') openPieceDialog(target.dataset.id);
  else if (action === 'clear-filters') { repertoireFilter = 'Active'; repertoireSearch = ''; renderRepertoire(); }
  else if (action === 'filter-repertoire') { repertoireFilter = target.dataset.filter; renderRepertoire(); }
  else if (action === 'log-session') openSessionDialog();
  else if (action === 'edit-session') openSessionDialog(target.dataset.id);
  else if (action === 'add-plan') openPlanDialog();
  else if (action === 'submit-form') {
    const form = target.closest('form');
    if (form) handleForm(form);
  }
  else if (action === 'month-prev' || action === 'month-next') { calendarCursor.setMonth(calendarCursor.getMonth() + (action === 'month-next' ? 1 : -1)); renderLog(); }
  else if (action === 'select-day') { state.selectedDate = target.dataset.date; calendarCursor = dateAtNoon(state.selectedDate); save({ cloudSync: false }); renderLog(); }
  else if (action === 'toggle-plan') { const plan = state.plans.find(item => String(item.id) === String(target.dataset.id)); if (plan) { plan.completed = target.checked; save(); renderToday(); } }
  else if (action === 'close-dialog') closeDialog();
  else if (action === 'archive-piece') archiveCurrentPiece();
  else if (action === 'delete-session') deleteCurrentSession();
  else if (action === 'edit-settings') openSettingsDialog();
  else if (action === 'teacher-code') openTeacherCodeDialog();
  else if (action === 'account') openAccountDialog();
  else if (action === 'sign-up') accountAction('signUp');
  else if (action === 'sign-out') signOut();
  else if (action === 'teacher') { state.view = 'teacher'; state.role = 'teacher'; save({ cloudSync: false }); renderNavigation(); renderTeacher(); loadTeacherStudio(); }
  else if (action === 'leave-teacher') { state.role = 'student'; setView('more'); }
  else if (action === 'teacher-tab') { teacherTab = target.dataset.tab; renderTeacher(); }
  else if (action === 'add-assignment') openAssignmentDialog();
  else if (action === 'complete-teacher-note') completeTeacherNote(target.dataset.id);
  else if (action === 'print') window.print();
  else if (action === 'export') exportStudio();
  else if (action === 'import') $('#importFile')?.click();
  else if (action === 'close-practice') closePractice();
  else if (action === 'choose-piece') { state.timer.pieceId = target.dataset.piece || null; state.timer.category = target.dataset.category; if (!$('#practiceFocus')?.value && state.timer.pieceId) state.timer.focus = pieceFor(state.timer.pieceId)?.section || ''; renderPrepare(); }
  else if (action === 'choose-duration') { const minutes = Number(target.dataset.minutes); state.timer.plannedDurationMs = minutes * 60000; state.timer.remainingAtPauseMs = minutes * 60000; renderPrepare(); }
  else if (action === 'custom-duration') customDuration();
  else if (action === 'start-count-in') startCountIn();
  else if (action === 'pause-session') pauseSession();
  else if (action === 'resume-session') resumeSession();
  else if (action === 'finish-session') completeSession(false);
  else if (action === 'save-completed') saveCompleted();
  else if (action === 'add-five') addFiveMinutes();
  else if (action === 'discard-session') discardPractice();
  else if (action === 'toggle-metronome') metronome.running ? (metronome.stop(), renderPracticeActive(), startTimerTicker()) : startMetronome();
  else if (action === 'bpm-down') updateMetronome({ bpm: clamp(state.metronome.bpm - 1, 30, 240) });
  else if (action === 'bpm-up') updateMetronome({ bpm: clamp(state.metronome.bpm + 1, 30, 240) });
  else if (action === 'tap-tempo') { const result = calculateTapTempo(taps); taps = result.taps; if (result.bpm) updateMetronome({ bpm: result.bpm }); }
  else if (action === 'toggle-mute') updateMetronome({ muted: !state.metronome.muted });
});

document.addEventListener('input', event => {
  if (event.target.id === 'repertoireSearch') {
    repertoireSearch = event.target.value;
    const selection = event.target.selectionStart;
    renderRepertoire();
    const search = $('#repertoireSearch'); search?.focus(); search?.setSelectionRange(selection, selection);
  }
  if (event.target.dataset.action === 'volume') updateMetronome({ volume: Number(event.target.value) }, false);
});

document.addEventListener('change', event => {
  if (event.target.dataset.action === 'time-signature') {
    const [numerator, denominator] = event.target.value.split('/').map(Number);
    updateMetronome({ numerator, denominator });
  }
  if (event.target.id === 'importFile') importStudio(event.target.files?.[0]);
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  handleForm(event.target);
});

function handleForm(form) {
  try {
    const data = new FormData(form);
    const formId = form.getAttribute('id');
    if (formId === 'pieceForm') savePiece(data);
    else if (formId === 'sessionForm') saveManualSession(data);
    else if (formId === 'planForm') savePlan(data);
    else if (formId === 'settingsForm') saveSettings(data);
    else if (formId === 'accountForm') accountAction('signIn');
    else if (formId === 'teacherUnlockForm') unlockTeacher(data);
    else if (formId === 'assignmentForm') saveAssignment(data);
    else if (formId === 'teacherCodeForm') saveTeacherCode(data);
  } catch (error) {
    console.error('Tempo could not complete the form action.', error);
    notify('That change could not be saved. Please try again.');
  }
}

backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) closeDialog(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !backdrop.hidden) { closeDialog(); return; }
  if (event.key !== 'Tab' || backdrop.hidden) return;
  const focusable = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')];
  if (!focusable.length) return;
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

function savePiece(data) {
  const id = String(data.get('id') || '');
  const existing = id ? pieceFor(id) : null;
  const piece = {
    ...(existing || {}), id: existing?.id || uid(), title: String(data.get('title')).trim(), composer: String(data.get('composer')).trim(),
    status: String(data.get('status')), priority: Number(data.get('priority')) || 2, section: String(data.get('section')).trim(),
    currentBpm: Number(data.get('currentBpm')) || null, targetBpm: Number(data.get('targetBpm')) || null,
    notes: String(data.get('notes')).trim(), progress: existing?.progress || 0, pinned: existing?.pinned || false,
    archived: String(data.get('status')) === 'Archived', tags: existing?.tags || []
  };
  if (existing) Object.assign(existing, piece); else state.pieces.push(piece);
  save(); closeDialog(); renderView(); notify(existing ? 'Piece updated' : 'Piece added');
}

function archiveCurrentPiece() {
  const id = new FormData($('#pieceForm')).get('id');
  const piece = pieceFor(id);
  if (!piece) return;
  piece.archived = true; piece.status = 'Archived';
  save(); closeDialog(); renderRepertoire(); notify('Piece archived');
}

function saveManualSession(data) {
  const id = String(data.get('id') || '');
  const existing = state.sessions.find(item => String(item.id) === id);
  const minutes = clamp(Number(data.get('minutes')) || 1, 1, 600);
  const session = { ...(existing || {}), id: existing?.id || uid(), date: String(data.get('date')), minutes, durationSeconds: minutes * 60, pieceId: String(data.get('pieceId') || '') || null, category: data.get('pieceId') ? 'Repertoire' : 'Technique', focus: String(data.get('focus')).trim() || 'Practice', notes: String(data.get('notes')).trim(), time: existing?.time || new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false}), tags: existing?.tags || [] };
  if (existing) Object.assign(existing, session); else state.sessions.push(session);
  state.selectedDate = session.date; calendarCursor = dateAtNoon(session.date);
  save(); closeDialog(); renderView(); notify('Practice saved');
}

function deleteCurrentSession() {
  const id = new FormData($('#sessionForm')).get('id');
  if (!confirm('Delete this practice session?')) return;
  state.sessions = state.sessions.filter(item => String(item.id) !== String(id));
  save(); closeDialog(); renderView(); notify('Session deleted');
}

function savePlan(data) {
  state.plans.push({ id: uid(), date: today(), minutes: Number(data.get('minutes')) || 30, pieceId: String(data.get('pieceId') || '') || null, category: String(data.get('category')), focus: String(data.get('focus')).trim(), completed: false, order: state.plans.filter(item => item.date === today()).length });
  save(); closeDialog(); renderToday(); notify('Added to today');
}

function saveSettings(data) {
  Object.assign(state.settings, { name: String(data.get('name')).trim(), dailyGoal: clamp(Number(data.get('dailyGoal')) || 45, 5, 300), defaultMinutes: clamp(Number(data.get('defaultMinutes')) || 30, 1, 180), defaultBpm: clamp(Number(data.get('defaultBpm')) || 75, 30, 240), countInSound: data.get('countInSound') === 'true', completionSound: data.get('completionSound') === 'true' });
  save(); closeDialog(); renderMore(); notify('Defaults saved');
}

function customDuration() {
  const current = Math.round(state.timer.plannedDurationMs / 60000);
  const value = prompt('Session duration in minutes', String(current));
  if (value === null) return;
  const minutes = clamp(Number(value) || current, 1, 180);
  state.timer.plannedDurationMs = minutes * 60000; state.timer.remainingAtPauseMs = minutes * 60000; renderPrepare();
}

function exportStudio() {
  const payload = JSON.stringify({ schema: 6, exportedAt: new Date().toISOString(), ...snapshotForCloud(state) }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `tempo-studio-${today()}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000); notify('Studio exported');
}

async function importStudio(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data[KEYS.sessions]) || !Array.isArray(data[KEYS.pieces])) throw new Error('invalid');
    if (!confirm('Import this Tempo studio? A local recovery snapshot of the current studio will be kept.')) return;
    persistState(state);
    hydrateCloudSnapshot(state, data);
    renderView(); notify('Studio imported');
  } catch { notify('That file is not a valid Tempo backup'); }
}

async function initCloud() {
  if (preview || !window.supabase?.createClient) {
    syncState.textContent = preview ? 'Preview studio' : 'Local studio';
    return;
  }
  try {
    cloud = window.supabase.createClient(CLOUD_URL, CLOUD_KEY);
    const { data } = await cloud.auth.getSession();
    cloudUser = data.session?.user || null;
    cloud.auth.onAuthStateChange((_event, session) => {
      cloudUser = session?.user || null;
      updateSyncLabel();
      if (state.view === 'more') renderMore();
    });
    if (cloudUser) {
      state.role = 'student';
      await loadStudentStudio();
      await loadTeacherNotes();
    } else {
      cloudReady = false;
    }
    updateSyncLabel();
  } catch (error) {
    console.warn('Tempo cloud is unavailable; the local studio remains active.', error);
    syncState.textContent = 'Local studio';
  }
}

async function loadStudentStudio() {
  if (!cloud || !cloudUser) return;
  syncState.textContent = 'Syncing…';
  const { data, error } = await cloud.from('practice_studios').select('data,updated_at').eq('slug', STUDIO_SLUG).maybeSingle();
  if (error) { syncState.textContent = 'Local studio'; return; }
  if (data?.data) {
    const remoteTime = new Date(data.updated_at || 0).getTime();
    const localTime = new Date(state.cloudUpdatedAt || 0).getTime();
    if (!state.sessions.length || remoteTime > localTime) {
      const localData = snapshotForCloud(state);
      const merged = { ...data.data };
      Object.keys(localData).forEach(key => {
        if (Array.isArray(localData[key]) && Array.isArray(data.data[key])) {
          const remoteIds = new Set(data.data[key].map(item => item?.id).filter(Boolean).map(String));
          merged[key] = [...data.data[key], ...localData[key].filter(item => !item?.id || !remoteIds.has(String(item.id)))];
        } else if (key === KEYS.settings) merged[key] = { ...(localData[key] || {}), ...(data.data[key] || {}) };
      });
      hydrateCloudSnapshot(state, merged);
      state.cloudUpdatedAt = data.updated_at;
      localStorage.setItem(KEYS.cloudUpdatedAt, data.updated_at || '');
      renderView();
    }
  }
  cloudReady = true;
  updateSyncLabel();
}

async function saveCloud() {
  if (!cloud || !cloudUser || !cloudReady || state.role !== 'student') return;
  syncState.textContent = 'Saving…';
  const stamp = new Date().toISOString();
  const { error } = await cloud.from('practice_studios').upsert({ slug: STUDIO_SLUG, owner_id: cloudUser.id, data: snapshotForCloud(state), updated_at: stamp }, { onConflict: 'slug' });
  if (error) {
    syncState.textContent = 'Sync paused'; syncState.classList.add('error');
    console.warn('Cloud save failed.', error);
  } else {
    state.cloudUpdatedAt = stamp; localStorage.setItem(KEYS.cloudUpdatedAt, stamp); updateSyncLabel();
  }
}

async function loadTeacherNotes() {
  if (!cloud) return;
  const code = sessionStorage.getItem('tempoTeacherCode') || '';
  const result = state.role === 'student' && cloudUser
    ? await cloud.from('teacher_notes').select('*').eq('studio_slug', STUDIO_SLUG).order('created_at', { ascending: false })
    : code ? await cloud.rpc('get_teacher_notes', { p_slug: STUDIO_SLUG, p_access_code: code }) : { data: [], error: null };
  if (!result.error) { state.teacherNotes = result.data || []; if (state.view === 'teacher') renderTeacher(); }
}

async function loadTeacherStudio() {
  if (!cloud || preview) return;
  const code = sessionStorage.getItem('tempoTeacherCode') || '';
  if (!code) return;
  syncState.textContent = 'Opening teacher studio…';
  const { data, error } = await cloud.rpc('get_teacher_studio', { p_slug: STUDIO_SLUG, p_access_code: code });
  if (error) {
    sessionStorage.removeItem('tempoTeacherCode');
    syncState.textContent = 'Teacher · locked'; renderTeacher(); return;
  }
  if (data?.data) hydrateCloudSnapshot(state, data.data);
  await loadTeacherNotes();
  syncState.textContent = 'Teacher · private'; renderTeacher();
}

async function unlockTeacher(data) {
  const code = String(data.get('code')).trim();
  if (preview) { sessionStorage.setItem('tempoTeacherCode', code || 'preview-code'); renderTeacher(); return; }
  if (!cloud) { $('#teacherUnlockMessage').textContent = 'Teacher access needs an internet connection.'; return; }
  $('#teacherUnlockMessage').textContent = 'Checking access…';
  const result = await cloud.rpc('get_teacher_studio', { p_slug: STUDIO_SLUG, p_access_code: code });
  if (result.error) { $('#teacherUnlockMessage').textContent = 'That access code is not correct.'; return; }
  sessionStorage.setItem('tempoTeacherCode', code);
  if (result.data?.data) hydrateCloudSnapshot(state, result.data.data);
  await loadTeacherNotes(); renderTeacher(); updateSyncLabel();
}

async function saveAssignment(data) {
  if (!cloud) { $('#assignmentMessage').textContent = 'Assignments need an internet connection.'; return; }
  const code = String(data.get('accessCode')).trim();
  $('#assignmentMessage').textContent = 'Assigning…';
  const { error } = await cloud.rpc('add_teacher_note', { p_slug: STUDIO_SLUG, p_access_code: code, p_note: String(data.get('note')).trim(), p_focus: String(data.get('focus')).trim(), p_due_date: data.get('dueDate') || null });
  if (error) { $('#assignmentMessage').textContent = error.message?.includes('Invalid') ? 'That access code is not correct.' : 'The assignment could not be saved.'; return; }
  sessionStorage.setItem('tempoTeacherCode', code); closeDialog(); await loadTeacherNotes(); renderTeacher(); notify('Focus assigned');
}

async function saveTeacherCode(data) {
  const code = String(data.get('code')).trim();
  if (code.length < 8) { $('#teacherCodeMessage').textContent = 'Use at least 8 characters.'; return; }
  if (!cloud || !cloudUser) { $('#teacherCodeMessage').textContent = 'Sign in before updating teacher access.'; return; }
  $('#teacherCodeMessage').textContent = 'Updating securely…';
  const { error } = await cloud.rpc('set_teacher_access_code', { p_slug: STUDIO_SLUG, p_access_code: code });
  if (error) { $('#teacherCodeMessage').textContent = error.message || 'The access code could not be updated.'; return; }
  closeDialog(); notify('Teacher access code updated');
}

async function completeTeacherNote(id) {
  const note = state.teacherNotes.find(item => String(item.id) === String(id));
  if (!note) return;
  if (preview) {
    note.completed = true; renderToday(); notify('Teacher focus completed'); return;
  }
  if (!cloud || !cloudUser) { notify('Sign in to update teacher notes'); return; }
  const { error } = await cloud.from('teacher_notes').update({ completed: true }).eq('id', id);
  if (error) { notify('The teacher note could not be updated'); return; }
  await loadTeacherNotes(); renderToday(); notify('Teacher focus completed');
}

async function accountAction(method) {
  const form = $('#accountForm');
  if (!form) return;
  if (!cloud) { $('#accountMessage').textContent = 'Cloud sign-in is unavailable right now. Your local studio is safe.'; return; }
  const data = new FormData(form), email = String(data.get('email')).trim(), password = String(data.get('password'));
  $('#accountMessage').textContent = method === 'signUp' ? 'Creating account…' : 'Signing in…';
  const result = method === 'signUp'
    ? await cloud.auth.signUp({ email, password, options: { emailRedirectTo: 'https://conmaan861.github.io/piano_test/' } })
    : await cloud.auth.signInWithPassword({ email, password });
  if (result.error) { $('#accountMessage').textContent = result.error.message; return; }
  cloudUser = result.data.user || result.data.session?.user || null;
  state.role = 'student';
  if (result.data.session) {
    cloudReady = false;
    closeDialog();
    await loadStudentStudio();
    await loadTeacherNotes();
    await saveCloud();
    renderMore();
    notify('Studio connected');
  }
  else $('#accountMessage').textContent = 'Check your email to confirm the account, then sign in.';
}

async function signOut() {
  if (!cloud) return;
  await cloud.auth.signOut(); cloudUser = null; cloudReady = false; updateSyncLabel(); renderMore(); notify('Signed out; local studio remains available');
}

function updateSyncLabel() {
  syncState.classList.remove('error');
  if (preview) syncState.textContent = 'Preview studio';
  else if (state.role === 'teacher' && sessionStorage.getItem('tempoTeacherCode')) syncState.textContent = 'Teacher · private';
  else if (cloudUser && cloudReady) syncState.textContent = 'Studio · synced';
  else syncState.textContent = 'Local studio';
}

function restorePractice() {
  const timer = state.timer;
  if (timer.version !== 2) return;
  if (timer.phase === 'count-in' && Number(timer.countInEndsAt) > Date.now()) renderCountIn();
  else if (timer.phase === 'count-in') beginRunning();
  else if (timer.phase === 'running' && Number(timer.targetEndAt)) {
    if (remainingMs() <= 0) completeSession(true);
    else { renderPracticeActive(); startTimerTicker(); }
  } else if (timer.phase === 'paused') renderPracticeActive();
  else if (timer.phase === 'completed' && timer.completedAt && Date.now() - Number(timer.completedAt) < 86400000) renderComplete();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (state.timer.phase === 'running') {
    if (remainingMs() <= 0) completeSession(true);
    else { renderPracticeActive(); startTimerTicker(); }
  } else if (state.timer.phase === 'count-in') {
    if (Number(state.timer.countInEndsAt) <= Date.now()) beginRunning(); else renderCountIn();
  }
});

window.addEventListener('beforeunload', () => { if (!preview) persistState(state); });

async function init() {
  const hashView = location.hash.slice(1);
  if (navItems.some(item => item[0] === hashView)) state.view = hashView;
  if (!navItems.some(item => item[0] === state.view) && state.view !== 'teacher') state.view = 'today';
  renderNavigation(); renderView(); updateSyncLabel(); restorePractice();
  await initCloud();
  if ('serviceWorker' in navigator && !isLocal) navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Offline support could not start.', error));
}

init();
