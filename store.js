export const KEYS = {
  sessions: 'pianoSessions',
  pieces: 'pianoRepertoire',
  settings: 'tempoSettings',
  timer: 'tempoTimer',
  assignments: 'tempoAssignments',
  plans: 'tempoPlans',
  lessons: 'tempoLessons',
  questions: 'tempoQuestions',
  events: 'tempoEvents',
  skills: 'tempoSkills',
  goals: 'tempoGoals',
  milestones: 'tempoMilestones',
  metronome: 'tempoMetronome',
  snapshots: 'tempoSnapshots',
  selectedDate: 'tempoSelectedDate',
  view: 'tempoView',
  role: 'tempoRole',
  cloudUpdatedAt: 'tempoCloudUpdatedAt',
  cloudDirtyAt: 'tempoCloudDirtyAt'
};

export const CLOUD_KEYS = [
  KEYS.sessions, KEYS.pieces, KEYS.settings, KEYS.assignments,
  KEYS.milestones, KEYS.plans, KEYS.lessons, KEYS.questions,
  KEYS.events, KEYS.skills, KEYS.goals
];

export const iso = (date = new Date()) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

export const today = () => iso();
export const dateAtNoon = value => new Date(`${value}T12:00:00`);
export const uid = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

export function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

const array = value => Array.isArray(value) ? value : [];

function normalizeSession(session) {
  return {
    ...session,
    id: session.id || uid(),
    date: session.date || today(),
    time: session.time || '',
    minutes: Number(session.minutes) || 0,
    durationSeconds: Number(session.durationSeconds) || (Number(session.minutes) || 0) * 60,
    category: session.category || 'Repertoire',
    pieceId: session.pieceId || null,
    assignmentId: session.assignmentId || null,
    method: session.method || '',
    focus: session.focus || 'Practice',
    bpmStart: Number(session.bpmStart ?? session.bpm) || null,
    bpmEnd: Number(session.bpmEnd ?? session.bpm) || null,
    bpm: Number(session.bpmEnd ?? session.bpmStart ?? session.bpm) || null,
    notes: session.notes || '',
    next: session.next || '',
    tags: array(session.tags)
  };
}

function normalizePiece(piece) {
  return {
    ...piece,
    id: piece.id || uid(),
    title: piece.title || 'Untitled',
    composer: piece.composer || '',
    status: piece.status || 'New',
    priority: Number(piece.priority) || 2,
    progress: Number(piece.progress) || 0,
    targetBpm: Number(piece.targetBpm) || null,
    currentBpm: Number(piece.currentBpm) || null,
    section: piece.section || '',
    notes: piece.notes || '',
    tags: array(piece.tags),
    pinned: Boolean(piece.pinned),
    archived: Boolean(piece.archived || piece.status === 'Archived')
  };
}

export function loadState() {
  const selectedDate = read(KEYS.selectedDate, today());
  return {
    sessions: array(read(KEYS.sessions, [])).map(normalizeSession),
    pieces: array(read(KEYS.pieces, [])).map(normalizePiece),
    settings: {
      name: '', teacherName: '', dailyGoal: 45, defaultMinutes: 30,
      defaultBpm: 75, countInSound: true, completionSound: true,
      ...read(KEYS.settings, {})
    },
    assignments: array(read(KEYS.assignments, [])),
    plans: array(read(KEYS.plans, [])),
    lessons: array(read(KEYS.lessons, [])),
    questions: array(read(KEYS.questions, [])),
    events: array(read(KEYS.events, [])),
    skills: array(read(KEYS.skills, [])),
    goals: array(read(KEYS.goals, [])),
    milestones: array(read(KEYS.milestones, [])),
    timer: {
      version: 2, phase: 'prepare', plannedDurationMs: 30 * 60000,
      remainingAtPauseMs: 30 * 60000, targetEndAt: null,
      countInEndsAt: null, startedAt: null, completedAt: null,
      pieceId: null, category: 'Repertoire', focus: '',
      startingBpm: null, endingBpm: null, metronomeUsed: false,
      ...read(KEYS.timer, {})
    },
    metronome: {
      bpm: 75, numerator: 4, denominator: 4, muted: false, volume: .7,
      ...read(KEYS.metronome, {})
    },
    selectedDate,
    view: read(KEYS.view, 'today'),
    role: localStorage.getItem(KEYS.role) || 'student',
    cloudUpdatedAt: localStorage.getItem(KEYS.cloudUpdatedAt) || '',
    cloudDirtyAt: localStorage.getItem(KEYS.cloudDirtyAt) || '',
    teacherNotes: []
  };
}

export function persistState(state) {
  localStorage.setItem(KEYS.sessions, JSON.stringify(state.sessions));
  localStorage.setItem(KEYS.pieces, JSON.stringify(state.pieces));
  localStorage.setItem(KEYS.settings, JSON.stringify(state.settings));
  localStorage.setItem(KEYS.assignments, JSON.stringify(state.assignments));
  localStorage.setItem(KEYS.plans, JSON.stringify(state.plans));
  localStorage.setItem(KEYS.lessons, JSON.stringify(state.lessons));
  localStorage.setItem(KEYS.questions, JSON.stringify(state.questions));
  localStorage.setItem(KEYS.events, JSON.stringify(state.events));
  localStorage.setItem(KEYS.skills, JSON.stringify(state.skills));
  localStorage.setItem(KEYS.goals, JSON.stringify(state.goals));
  localStorage.setItem(KEYS.milestones, JSON.stringify(state.milestones));
  localStorage.setItem(KEYS.timer, JSON.stringify(state.timer));
  localStorage.setItem(KEYS.metronome, JSON.stringify(state.metronome));
  localStorage.setItem(KEYS.selectedDate, JSON.stringify(state.selectedDate));
  localStorage.setItem(KEYS.view, JSON.stringify(state.view));
  localStorage.setItem(KEYS.role, state.role);
  writeSnapshot(state);
}

export function snapshotForCloud(state) {
  return {
    [KEYS.sessions]: state.sessions,
    [KEYS.pieces]: state.pieces,
    [KEYS.settings]: state.settings,
    [KEYS.assignments]: state.assignments,
    [KEYS.milestones]: state.milestones,
    [KEYS.plans]: state.plans,
    [KEYS.lessons]: state.lessons,
    [KEYS.questions]: state.questions,
    [KEYS.events]: state.events,
    [KEYS.skills]: state.skills,
    [KEYS.goals]: state.goals
  };
}

export function hydrateCloudSnapshot(state, data = {}) {
  state.sessions = array(data[KEYS.sessions]).map(normalizeSession);
  state.pieces = array(data[KEYS.pieces]).map(normalizePiece);
  state.settings = { ...state.settings, ...(data[KEYS.settings] || {}) };
  state.assignments = array(data[KEYS.assignments]);
  state.milestones = array(data[KEYS.milestones]);
  state.plans = array(data[KEYS.plans]);
  state.lessons = array(data[KEYS.lessons]);
  state.questions = array(data[KEYS.questions]);
  state.events = array(data[KEYS.events]);
  state.skills = array(data[KEYS.skills]);
  state.goals = array(data[KEYS.goals]);
  persistState(state);
}

function writeSnapshot(state) {
  try {
    const snapshots = array(read(KEYS.snapshots, []));
    const latest = snapshots[0];
    if (latest && Date.now() - new Date(latest.createdAt).getTime() < 300000) return;
    snapshots.unshift({
      id: Date.now(), createdAt: new Date().toISOString(),
      data: { schema: 6, ...snapshotForCloud(state) }
    });
    localStorage.setItem(KEYS.snapshots, JSON.stringify(snapshots.slice(0, 5)));
  } catch (error) {
    console.warn('Tempo could not create a recovery snapshot.', error);
  }
}

export function makeFixture(type, state) {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname) || !type) return;
  const brahms = { id: 'fixture-brahms', title: 'Lullaby', composer: 'Johannes Brahms', status: 'Developing fluency', priority: 3, progress: 62, currentBpm: 72, targetBpm: 88, section: 'Hands together · bars 12–18', pinned: true, archived: false, tags: [] };
  const doll = { id: 'fixture-doll', title: 'The Sick Doll', composer: 'Pyotr Ilyich Tchaikovsky', status: 'Learning notes', priority: 2, progress: 38, section: 'Middle section', pinned: false, archived: false, tags: [] };
  state.pieces = type === 'fresh' ? [] : [brahms, doll];
  state.sessions = [];
  if (type === 'sparse' || type === 'heavy') {
    const days = type === 'heavy' ? 90 : 4;
    for (let index = days; index >= 0; index -= type === 'heavy' ? 2 : 2) {
      const date = new Date(); date.setDate(date.getDate() - index);
      state.sessions.push(normalizeSession({ id: `fixture-${index}`, date: iso(date), time: '18:30', minutes: 20 + (index % 4) * 6, pieceId: index % 3 ? brahms.id : doll.id, category: 'Repertoire', focus: index % 2 ? 'Hands together · bars 12–18' : 'Legato and balance', bpmStart: 68 + index % 5, bpmEnd: 74 + index % 7, notes: 'The left hand felt more even.' }));
    }
  }
  state.plans = type === 'fresh' ? [] : [
    { id: 'plan-1', date: today(), minutes: 20, category: 'Repertoire', pieceId: brahms.id, focus: 'Hands together · bars 12–18', completed: false, order: 0 },
    { id: 'plan-2', date: today(), minutes: 10, category: 'Technique', pieceId: null, focus: 'C major scale · even tone', completed: false, order: 1 }
  ];
}
