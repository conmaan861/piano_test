(() => {
  const DATA_VERSION = 5;
  const MILESTONE_KEY = 'tempoMilestones';
  const METRONOME_KEY = 'tempoMetronome';
  const PLAN_KEY = 'tempoPlans';
  const LESSON_KEY = 'tempoLessons';
  const QUESTION_KEY = 'tempoQuestions';
  const EVENT_KEY = 'tempoEvents';
  const SKILL_KEY = 'tempoSkills';
  const GOAL_KEY = 'tempoGoals';
  const SNAPSHOT_KEY = 'tempoSnapshots';
  let plans = read(PLAN_KEY, []);
  let lessons = read(LESSON_KEY, []);
  let questions = read(QUESTION_KEY, []);
  let events = read(EVENT_KEY, []);
  let skills = read(SKILL_KEY, []);
  let goals = read(GOAL_KEY, []);

  plans = Array.isArray(plans) ? plans : [];
  lessons = Array.isArray(lessons) ? lessons : [];
  questions = Array.isArray(questions) ? questions : [];
  events = Array.isArray(events) ? events : [];
  skills = Array.isArray(skills) ? skills : [];
  goals = Array.isArray(goals) ? goals : [];

  const previousVersion = Number(localStorage.getItem('tempoDataVersion') || 0);
  if (previousVersion < DATA_VERSION) {
    sessions.forEach(session => {
      if (session.question && !questions.some(question => question.sourceSessionId === session.id)) {
        questions.push({
          id: `session-${session.id}`,
          sourceSessionId: session.id,
          createdAt: session.date,
          pieceId: session.pieceId || null,
          assignmentId: session.assignmentId || null,
          question: session.question,
          context: session.focus || '',
          priority: 2,
          answered: false,
          teacherAnswer: '',
          answeredLessonDate: ''
        });
      }
    });
    localStorage.setItem(QUESTION_KEY, JSON.stringify(questions));
    localStorage.setItem('tempoDataVersion', String(DATA_VERSION));
  }

  function completeDataSnapshot() {
    return {
      schema: DATA_VERSION,
      sessions,
      pieces,
      assignments: window.getTempoAssignments?.() || [],
      lessons,
      skills,
      goals,
      plans,
      events,
      questions,
      settings,
      milestones: read(MILESTONE_KEY, [])
    };
  }

  function writeRotatingSnapshot(force = false) {
    try {
      const snapshots = read(SNAPSHOT_KEY, []);
      const latest = snapshots[0];
      if (!force && latest && Date.now() - new Date(latest.createdAt).getTime() < 300000) return;
      snapshots.unshift({ id: Date.now(), createdAt: new Date().toISOString(), data: completeDataSnapshot() });
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, 5)));
    } catch (error) {
      console.warn('A local recovery snapshot could not be saved.', error);
    }
  }

  const saveBeforeSafety = save;
  save = function safeSave() {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
    localStorage.setItem(LESSON_KEY, JSON.stringify(lessons));
    localStorage.setItem(QUESTION_KEY, JSON.stringify(questions));
    localStorage.setItem(EVENT_KEY, JSON.stringify(events));
    localStorage.setItem(SKILL_KEY, JSON.stringify(skills));
    localStorage.setItem(GOAL_KEY, JSON.stringify(goals));
    localStorage.setItem('tempoDataVersion', String(DATA_VERSION));
    writeRotatingSnapshot();
    saveBeforeSafety();
  };
  const selectablePieceOptions = () => '<option value="">None</option>' + pieces.filter(piece => !piece.archived && piece.status !== 'Archived').map(piece => `<option value="${piece.id}">${esc(piece.title)}</option>`).join('');

  const nav = document.querySelector('.nav');
  const moreNav = document.getElementById('moreNav');
  document.querySelector('#moreModal .more-links [data-go="settings"]').insertAdjacentHTML('beforebegin', '<button class="ghost" data-go="wrapped">Weekly Replay <span>›</span></button>');

  document.getElementById('view-settings').insertAdjacentHTML('beforebegin', `
    <section class="view" id="view-wrapped">
      <div class="wrapped-head">
        <div>
          <span class="eyebrow">YOUR WEEK IN MUSIC</span>
          <h2>Weekly Replay</h2>
          <p id="wrappedDates"></p>
        </div>
        <div class="wrapped-nav">
          <button class="ghost" id="wrappedPrev" aria-label="Previous week">‹</button>
          <button class="ghost" id="wrappedThis">This week</button>
          <button class="ghost" id="wrappedNext" aria-label="Next week">›</button>
        </div>
      </div>
      <div class="wrapped-stage" id="wrappedStage" aria-label="Weekly practice story"></div>
      <button class="btn wrapped-share" id="shareWrapped">Share this replay</button>
    </section>`);

  document.getElementById('timerCard').insertAdjacentHTML('beforeend', `
    <div class="metronome-panel" data-student-only>
      <div class="metronome-orb" id="metronomeOrb" aria-hidden="true">1</div>
      <div class="metronome-copy">
        <span class="label">BUILT-IN METRONOME</span>
        <h4><span id="metronomeBpmLabel">80</span> BPM · 4/4</h4>
        <span class="small" id="metronomeStatus">Set a comfortable starting pace.</span>
      </div>
      <div class="metronome-controls">
        <div class="bpm-stepper">
          <button type="button" id="bpmDown" aria-label="Decrease tempo">−</button>
          <input id="metronomeBpm" type="number" min="30" max="240" value="80" aria-label="Metronome tempo in BPM">
          <button type="button" id="bpmUp" aria-label="Increase tempo">＋</button>
        </div>
        <button class="ghost" type="button" id="tapTempo">Tap tempo</button>
        <button class="btn" type="button" id="toggleMetronome">Start click</button>
      </div>
    </div>`);
  document.querySelector('#timerCard .timer-actions').insertAdjacentHTML('beforebegin', `
    <div class="timer-context" data-student-only>
      <select class="field" id="timerCategory" aria-label="Timer practice category"></select>
      <select class="field" id="timerPiece" aria-label="Timer repertoire piece"></select>
      <input class="field" id="timerFocus" placeholder="Timer focus" aria-label="Timer practice focus">
    </div>`);

  const todayAssignments = document.getElementById('todayAssignments');
  document.querySelector('#view-today .grid3').before(todayAssignments);
  todayAssignments.insertAdjacentHTML('afterend', `
    <section class="practice-plan" id="practicePlan">
      <div class="heading">
        <div><span class="eyebrow">STUDENT PRACTICE PLAN</span><h3>Planned blocks</h3></div>
        <button class="ghost" id="addPlanBlock" data-student-only>＋ Add block</button>
      </div>
      <div class="plan-summary" id="planSummary"></div>
      <div class="plan-list" id="planList"></div>
    </section>`);

  document.getElementById('timerCard').insertAdjacentHTML('afterend', `
    <section class="milestone-peek" id="milestonePeek">
      <div class="milestone-medal" aria-hidden="true">★</div>
      <div><span class="label">PERSONAL BESTS</span><h4 id="milestonePeekTitle">Your next milestone is waiting</h4><p class="small" id="milestonePeekCopy"></p></div>
      <button class="ghost" id="openMilestones">Open weekly replay</button>
    </section>`);

  document.getElementById('view-insights').insertAdjacentHTML('beforeend', `
    <section class="milestone-section">
      <div class="heading"><div><span class="eyebrow">PERSONAL BESTS</span><h3>Your milestone cabinet</h3></div><span class="status" id="milestoneCount">0 unlocked</span></div>
      <div class="milestone-grid" id="milestoneGrid"></div>
    </section>`);

  document.querySelector('#view-settings .backup-card').insertAdjacentHTML('beforebegin', `
    <div class="section card install-card">
      <div><span class="label">PHONE APP</span><h3>Take Tempo with you</h3><p class="small">Install this studio on your home screen for a full-screen, app-like experience. Your existing practice data stays available during temporary connection loss.</p><p class="small install-state" id="installState">Checking install availability…</p></div>
      <button class="btn" id="installApp">Install app</button>
    </div>`);
  document.querySelector('#view-settings .backup-card').insertAdjacentHTML('afterend', `
    <div class="section card" id="recoveryCard">
      <span class="label">LOCAL RECOVERY</span><h3>Automatic snapshots</h3>
      <p class="small" id="storageSummary"></p><div class="storage-meter"><i id="storageBar"></i></div>
      <div class="snapshot-list" id="snapshotList"></div>
    </div>
    <div class="section privacy-note" id="privacySummary"><strong>Privacy and sharing</strong><br>Your signed-in Connor studio is stored in Supabase and cached in this browser. Teacher access requires the private studio code. Exported reports contain only the sections you choose. Keep a JSON backup for independent recovery.</div>`);

  const reportActions = document.querySelector('#view-report .report-actions');
  document.querySelector('#view-report .report-head').insertAdjacentHTML('afterend', `
    <div class="section card teacher-unlock no-print" data-teacher-only>
      <div><span class="label">PRIVATE TEACHER VIEW</span><h3>Open Connor’s practice record</h3><p class="small" id="teacherUnlockMessage">Enter the access code Connor shared with you. The public website does not reveal practice records without it.</p></div>
      <div class="auth-row"><input class="field" id="teacherUnlockCode" type="password" autocomplete="current-password" placeholder="Teacher access code"><button class="btn" id="unlockTeacherView">Open record</button></div>
    </div>`);
  reportActions.insertAdjacentHTML('beforeend', `
    <button class="ghost" id="exportReportHtml">Export dated HTML</button>
    <label class="report-option"><input type="checkbox" id="includeReflections" checked> Include reflections</label>
    <label class="report-option"><input type="checkbox" id="includeHistory"> Include session history</label>`);
  document.getElementById('reportStats').insertAdjacentHTML('afterend', `
    <section class="card report-section" id="lessonPreparation">
      <div class="heading"><div><span class="eyebrow">PREPARE FOR LESSON</span><h3>Items to discuss</h3></div><button class="ghost" id="addLesson" data-student-only>＋ Add lesson record</button></div>
      <div class="prep-grid" id="prepGrid"></div>
    </section>
    <section class="card report-section"><h3>Lesson records</h3><div class="lesson-records" id="lessonRecords"></div></section>`);
  document.getElementById('reportQuestions').closest('.report-section').insertAdjacentHTML('afterend', '<section class="card report-section" id="rawHistorySection" hidden><h3>Session history</h3><div id="rawHistory"></div></section>');

  document.querySelector('main').insertAdjacentHTML('beforeend', `
    <div class="modal" id="lessonModal">
      <form id="lessonForm">
        <button type="button" class="close" data-close aria-label="Close dialog">×</button>
        <span class="eyebrow">LESSON RECORD</span><h2>Add lesson record</h2>
        <input name="id" type="hidden">
        <div class="form-grid">
          <label>DATE<input class="field" name="date" type="date" required></label>
          <label>TEACHER<input class="field" name="teacher" placeholder="Teacher name"></label>
          <label class="full">REPERTOIRE DISCUSSED<input class="field" name="repertoire" placeholder="Pieces, movements or passages"></label>
          <label class="full">TECHNIQUE DISCUSSED<input class="field" name="technique" placeholder="Scales, exercises or technical ideas"></label>
          <label class="full">FEEDBACK<textarea class="field" name="feedback" rows="3"></textarea></label>
          <label class="full">CONCEPTS OR DEMONSTRATIONS<textarea class="field" name="concepts" rows="2"></textarea></label>
          <label class="full">QUESTIONS ANSWERED<textarea class="field" name="questionsAnswered" rows="2"></textarea></label>
          <label>NEXT LESSON<input class="field" name="nextLessonDate" type="date"></label>
          <label class="full">STUDENT LESSON SUMMARY<textarea class="field" name="summary" rows="3"></textarea></label>
        </div>
        <button class="btn" type="submit">Save lesson record</button>
      </form>
    </div>`);

  document.querySelector('main').insertAdjacentHTML('beforeend', `
    <div class="modal" id="planModal">
      <form id="planForm">
        <button type="button" class="close" data-close aria-label="Close dialog">×</button>
        <span class="eyebrow">PRACTICE PLAN</span><h2 id="planFormTitle">Add practice block</h2>
        <input name="id" type="hidden">
        <div class="form-grid">
          <label>DATE<input class="field" name="date" type="date" required></label>
          <label>BLOCK<select class="field" name="category"><option>Warm-up</option><option>Technique</option><option>Repertoire</option><option>Sight-reading</option><option>Musicianship</option><option>Performance run</option><option>Reflection</option></select></label>
          <label>MINUTES<input class="field" name="minutes" type="number" min="1" max="180" required></label>
          <label>REPERTOIRE PIECE<select class="field" name="pieceId"></select></label>
          <label class="full">FOCUS<input class="field" name="focus" required placeholder="What will you work on?"></label>
        </div>
        <button class="btn" type="submit">Save block</button>
      </form>
    </div>`);

  let lastModalTrigger = null;
  const modalBeforeAccessibility = modal;
  modal = function accessibleModal(id, on = true) {
    const dialog = document.getElementById(id);
    if (on) lastModalTrigger = document.activeElement;
    modalBeforeAccessibility(id, on);
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-hidden', String(!on));
    if (on) requestAnimationFrame(() => (dialog.querySelector('input:not([type="hidden"]), select, textarea, button') || dialog).focus());
    else if (lastModalTrigger?.focus) lastModalTrigger.focus();
  };
  document.querySelectorAll('.modal').forEach(dialog => {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-hidden', String(!dialog.classList.contains('open')));
  });
  document.querySelectorAll('[data-close]').forEach(button => {
    button.onclick = () => modal(button.closest('.modal').id, false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const openDialog = document.querySelector('.modal.open');
    if (openDialog) modal(openDialog.id, false);
  });

  document.querySelectorAll('.nav button').forEach(button => {
    if (button.dataset.view) button.onclick = () => switchView(button.dataset.view);
  });
  document.querySelectorAll('#moreModal [data-go]').forEach(button => {
    button.onclick = () => {
      modal('moreModal', false);
      switchView(button.dataset.go);
    };
  });

  const sessionForm = document.getElementById('sessionForm');
  const bpmStartInput = sessionForm.querySelector('[name="bpm"]');
  const bpmStartLabel = bpmStartInput.closest('label');
  const bpmLabelNode = [...bpmStartLabel.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
  if (bpmLabelNode) bpmLabelNode.textContent = 'STARTING BPM';
  bpmStartInput.name = 'bpmStart';
  bpmStartLabel.insertAdjacentHTML('afterend', '<label class="optional-field">ENDING BPM<input class="field" name="bpmEnd" type="number" min="1" max="400" placeholder="Where you finished"></label>');
  sessionForm.elements.category.innerHTML = '<option>Repertoire</option><option>Scales</option><option>Arpeggios</option><option>Chords</option><option>Technical exercise</option><option>Sight-reading</option><option>Ear training</option><option>Theory</option><option>Improvisation</option><option>Memorisation</option><option>Performance practice</option><option>Warm-up</option><option>Other</option>';
  document.getElementById('timerCategory').innerHTML = sessionForm.elements.category.innerHTML;
  sessionForm.elements.method.innerHTML = '<option value="">Not specified</option><option>Slow practice</option><option>Metronome work</option><option>Hands separately</option><option>Rhythmic variation</option><option>Chunking</option><option>Looping</option><option>Backward chaining</option><option>Silent or mental practice</option><option>Recording review</option><option>Full run-through</option><option>Other</option>';
  sessionForm.elements.category.required = true;
  sessionForm.elements.category.closest('label').classList.remove('optional-field');
  sessionForm.elements.pieceId.closest('label').classList.remove('optional-field');
  document.getElementById('sessionDetails').insertAdjacentHTML('beforebegin', `
    <label class="optional-field">SECTION / BARS<input class="field" name="section" placeholder="Movement, bars, scale or exercise"></label>
    <label class="optional-field">TARGET TEMPO<input class="field" name="targetBpm" type="number" min="1" max="400"></label>
    <label class="optional-field">HANDS<select class="field" name="hands"><option value="">Not specified</option><option>Hands separately</option><option>Hands together</option><option>Both</option></select></label>
    <label class="optional-field">DIFFICULTY (1–5)<input class="field" name="difficulty" type="number" min="1" max="5"></label>
    <label class="optional-field">CONCENTRATION (1–5)<input class="field" name="concentration" type="number" min="1" max="5"></label>
    <label class="optional-field">CONFIDENCE BEFORE (1–5)<input class="field" name="confidenceBefore" type="number" min="1" max="5"></label>
    <label class="optional-field full">WHAT IMPROVED<textarea class="field" name="improved" rows="2"></textarea></label>
    <label class="optional-field full">WHAT REMAINS DIFFICULT<textarea class="field" name="remainsDifficult" rows="2"></textarea></label>
    <label class="optional-field full">TAGS<input class="field" name="tags" placeholder="rhythm, fingering, memory"></label>`);

  const pieceForm = document.getElementById('pieceForm');
  pieceForm.elements.status.innerHTML = '<option>Considering</option><option>New</option><option>Learning notes</option><option>Hands separately</option><option>Hands together</option><option>Developing fluency</option><option>Developing tempo</option><option>Memorising</option><option>Polishing</option><option>Performance ready</option><option>Maintaining</option><option>Paused</option><option>Archived</option>';
  document.getElementById('pieceStatus').innerHTML = '<option value="">All statuses</option>' + pieceForm.elements.status.innerHTML;
  pieceForm.querySelector('.form-grid').insertAdjacentHTML('beforeend', `
    <label>WORK / COLLECTION<input class="field" name="work"></label>
    <label>MOVEMENT<input class="field" name="movement"></label>
    <label>KEY<input class="field" name="key"></label>
    <label>DIFFICULTY<select class="field" name="difficulty"><option value="">Not set</option><option>Early</option><option>Intermediate</option><option>Advanced</option></select></label>
    <label>CURRENT COMFORTABLE BPM<input class="field" name="currentBpm" type="number" min="1" max="400"></label>
    <label>DATE ADDED<input class="field" name="dateAdded" type="date"></label>
    <label class="full">TAGS<input class="field" name="tags" placeholder="baroque, recital, memory"></label>
    <label class="full">SHEET-MUSIC LINK<input class="field" name="sheetUrl" type="url" placeholder="https://"></label>
    <label class="full">REFERENCE-RECORDING LINK<input class="field" name="recordingUrl" type="url" placeholder="https://"></label>
    <label><input name="pinned" type="checkbox"> PIN TO CURRENT FOCUS</label>
    <label><input name="archived" type="checkbox"> ARCHIVE PIECE</label>`);

  pieceForm.onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = Number(form.get('id'));
    const existing = pieces.find(piece => piece.id === id);
    const piece = {
      ...(existing || {}),
      id: id || uid(),
      title: form.get('title'),
      composer: form.get('composer'),
      work: form.get('work'),
      movement: form.get('movement'),
      key: form.get('key'),
      difficulty: form.get('difficulty'),
      status: form.get('archived') ? 'Archived' : form.get('status'),
      priority: Number(form.get('priority')),
      progress: Number(form.get('progress')),
      targetBpm: Number(form.get('targetBpm')) || null,
      currentBpm: Number(form.get('currentBpm')) || null,
      section: form.get('section'),
      targetDate: form.get('targetDate'),
      dateAdded: form.get('dateAdded') || existing?.dateAdded || today(),
      notes: form.get('notes'),
      tags: String(form.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean),
      sheetUrl: form.get('sheetUrl'),
      recordingUrl: form.get('recordingUrl'),
      pinned: form.get('pinned') === 'on',
      archived: form.get('archived') === 'on'
    };
    pieces = id ? pieces.map(item => item.id === id ? piece : item) : [...pieces, piece];
    modal('pieceModal', false);
    render();
    toast(id ? 'Piece updated' : 'Piece added');
  };
  const editPieceBeforeEnhancement = editPiece;
  editPiece = function enhancedEditPiece(id) {
    editPieceBeforeEnhancement(id);
    const piece = pieces.find(item => item.id === id);
    pieceForm.elements.pinned.checked = Boolean(piece?.pinned);
    pieceForm.elements.archived.checked = Boolean(piece?.archived || piece?.status === 'Archived');
  };
  document.getElementById('addPiece').onclick = () => {
    pieceForm.reset();
    pieceForm.elements.id.value = '';
    pieceForm.elements.progress.value = 10;
    pieceForm.elements.dateAdded.value = today();
    document.getElementById('pieceFormTitle').textContent = 'Add piece';
    modal('pieceModal');
  };

  const assignmentForm = document.getElementById('assignmentForm');
  assignmentForm.elements.status.innerHTML += '<option>Carried forward</option>';
  document.getElementById('assignmentFilter').innerHTML += '<option>Carried forward</option>';
  assignmentForm.querySelector('.form-grid').insertAdjacentHTML('beforeend', `
    <label>LESSON DATE<input class="field" name="lessonDate" type="date"></label>
    <label>PRACTICE FREQUENCY<input class="field" name="frequency" placeholder="e.g. 4 times this week"></label>
    <label>TARGET TEMPO<input class="field" name="targetBpm" type="number" min="1" max="400"></label>
    <label class="full">COMPLETION CRITERIA<input class="field" name="completionCriteria" placeholder="What will make this ready to review?"></label>
    <label class="full">TEACHER NOTE<textarea class="field" name="teacherNote" rows="2"></textarea></label>`);
  assignmentForm.onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = Number(form.get('id'));
    const current = window.getTempoAssignments?.() || [];
    const existing = current.find(assignment => assignment.id === id);
    const assignment = {
      ...(existing || {}),
      id: id || uid(),
      title: form.get('title'),
      pieceId: Number(form.get('pieceId')) || null,
      status: form.get('status'),
      priority: Number(form.get('priority')),
      dueDate: form.get('dueDate'),
      minutes: Number(form.get('minutes')) || 0,
      instruction: form.get('instruction'),
      studentNote: form.get('studentNote'),
      lessonDate: form.get('lessonDate'),
      frequency: form.get('frequency'),
      targetBpm: Number(form.get('targetBpm')) || null,
      completionCriteria: form.get('completionCriteria'),
      teacherNote: form.get('teacherNote')
    };
    window.setTempoAssignments(id ? current.map(item => item.id === id ? assignment : item) : [...current, assignment]);
    modal('assignmentModal', false);
    render();
    toast(id ? 'Assignment updated' : 'Assignment added');
  };

  const metronome = { bpm: 80, ...read(METRONOME_KEY, {}) };
  let metronomeTimer = null;
  let audioContext = null;
  let beat = 0;
  let tapTimes = [];
  let pendingStartBpm = null;
  let metronomeUsed = false;
  let pendingTimerContext = null;

  function saveMetronome() {
    localStorage.setItem(METRONOME_KEY, JSON.stringify({ bpm: metronome.bpm }));
  }

  function metronomeClick() {
    const orb = document.getElementById('metronomeOrb');
    const accented = beat % 4 === 0;
    orb.textContent = String((beat % 4) + 1);
    orb.classList.add('beat');
    setTimeout(() => orb.classList.remove('beat'), 90);
    if (audioContext) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = accented ? 1220 : 820;
      gain.gain.setValueAtTime(.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(accented ? .22 : .13, audioContext.currentTime + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .055);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + .065);
    }
    beat += 1;
  }

  function stopMetronome() {
    clearInterval(metronomeTimer);
    metronomeTimer = null;
    beat = 0;
    document.getElementById('toggleMetronome').textContent = 'Start click';
    document.getElementById('metronomeStatus').textContent = 'Stopped · ending tempo ready to log.';
    document.getElementById('metronomeOrb').textContent = '1';
  }

  async function startMetronome() {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    metronomeUsed = true;
    if (timer.running && !timer.startBpm) {
      timer.startBpm = metronome.bpm;
      save();
    }
    beat = 0;
    metronomeClick();
    metronomeTimer = setInterval(metronomeClick, 60000 / metronome.bpm);
    document.getElementById('toggleMetronome').textContent = 'Stop click';
    document.getElementById('metronomeStatus').textContent = 'Clicking in 4/4 · first beat accented.';
  }

  function setBpm(value) {
    metronome.bpm = Math.max(30, Math.min(240, Math.round(Number(value) || 80)));
    document.getElementById('metronomeBpm').value = metronome.bpm;
    document.getElementById('metronomeBpmLabel').textContent = metronome.bpm;
    saveMetronome();
    if (metronomeTimer) {
      stopMetronome();
      startMetronome();
    }
  }

  setBpm(metronome.bpm);
  document.getElementById('bpmDown').onclick = () => setBpm(metronome.bpm - 1);
  document.getElementById('bpmUp').onclick = () => setBpm(metronome.bpm + 1);
  document.getElementById('metronomeBpm').onchange = event => setBpm(event.target.value);
  document.getElementById('toggleMetronome').onclick = () => metronomeTimer ? stopMetronome() : startMetronome();
  document.getElementById('tapTempo').onclick = () => {
    const now = performance.now();
    tapTimes = [...tapTimes.filter(time => now - time < 2500), now].slice(-5);
    if (tapTimes.length > 1) {
      const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
      setBpm(60000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length));
      document.getElementById('metronomeStatus').textContent = 'Tap tempo captured.';
    } else {
      document.getElementById('metronomeStatus').textContent = 'Keep tapping…';
    }
  };

  const previousNewSession = newSession;
  newSession = function enhancedNewSession(minutes) {
    previousNewSession(minutes);
    const hasTempo = Boolean(pendingStartBpm || metronomeUsed);
    sessionForm.elements.bpmStart.value = hasTempo ? (pendingStartBpm || metronome.bpm) : '';
    sessionForm.elements.bpmEnd.value = hasTempo ? metronome.bpm : '';
    if (pendingTimerContext) {
      sessionForm.elements.category.value = pendingTimerContext.category || 'Repertoire';
      sessionForm.elements.pieceId.value = pendingTimerContext.pieceId || '';
      sessionForm.elements.focus.value = pendingTimerContext.focus || '';
    }
    pendingStartBpm = null;
    pendingTimerContext = null;
    metronomeUsed = false;
  };

  document.getElementById('startTimer').onclick = () => {
    if (!timer.running) {
      timer.running = true;
      timer.startedAt = Date.now();
      timer.startBpm = metronomeUsed ? metronome.bpm : null;
      timer.category = document.getElementById('timerCategory').value;
      timer.pieceId = Number(document.getElementById('timerPiece').value) || null;
      timer.focus = document.getElementById('timerFocus').value;
      save();
      renderTimer();
    }
  };

  document.getElementById('stopTimer').onclick = () => {
    const elapsed = timerElapsed();
    const minutes = Math.max(1, Math.round(elapsed / 60000));
    if (elapsed < 1000 && !confirm('The timer has barely started. Save a one-minute session?')) return;
    pendingStartBpm = timer.startBpm || (metronomeUsed ? metronome.bpm : null);
    pendingTimerContext = { category: timer.category, pieceId: timer.pieceId, focus: timer.focus };
    if (metronomeTimer) stopMetronome();
    timer = { running: false, elapsed: 0, startedAt: null, startBpm: null };
    save();
    newSession(minutes);
  };
  window.addEventListener('beforeunload', event => {
    if (!timer.running) return;
    event.preventDefault();
    event.returnValue = '';
  });

  sessionForm.onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = Number(form.get('id'));
    const bpmStart = Number(form.get('bpmStart')) || null;
    const bpmEnd = Number(form.get('bpmEnd')) || null;
    const session = {
      id: id || uid(),
      date: form.get('date'),
      time: form.get('time'),
      minutes: Number(form.get('minutes')),
      category: form.get('category'),
      pieceId: Number(form.get('pieceId')) || null,
      assignmentId: Number(form.get('assignmentId')) || null,
      method: form.get('method'),
      focus: form.get('focus'),
      bpmStart,
      bpmEnd,
      bpm: bpmEnd || bpmStart,
      targetBpm: Number(form.get('targetBpm')) || null,
      section: form.get('section'),
      hands: form.get('hands'),
      difficulty: Number(form.get('difficulty')) || null,
      concentration: Number(form.get('concentration')) || null,
      confidenceBefore: Number(form.get('confidenceBefore')) || null,
      confidence: Number(form.get('confidence')) || null,
      improved: form.get('improved'),
      remainsDifficult: form.get('remainsDifficult'),
      notes: form.get('notes'),
      next: form.get('next'),
      question: form.get('question'),
      tags: String(form.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean)
    };
    sessions = id ? sessions.map(item => item.id === id ? session : item) : [...sessions, session];
    const linkedQuestion = questions.find(question => String(question.sourceSessionId) === String(session.id));
    if (session.question) {
      const questionRecord = {
        ...(linkedQuestion || {}),
        id: linkedQuestion?.id || `session-${session.id}`,
        sourceSessionId: session.id,
        createdAt: session.date,
        pieceId: session.pieceId,
        assignmentId: session.assignmentId,
        question: session.question,
        context: session.focus,
        priority: linkedQuestion?.priority || 2,
        answered: linkedQuestion?.answered || false,
        teacherAnswer: linkedQuestion?.teacherAnswer || '',
        answeredLessonDate: linkedQuestion?.answeredLessonDate || ''
      };
      questions = linkedQuestion ? questions.map(item => item.id === linkedQuestion.id ? questionRecord : item) : [...questions, questionRecord];
    }
    selected = session.date;
    modal('sessionModal', false);
    render();
    toast(id ? 'Session updated' : 'Session saved');
  };

  document.getElementById('exportCsv').onclick = () => {
    const rows = [
      ['date', 'time', 'minutes', 'category', 'focus', 'method', 'starting_bpm', 'ending_bpm', 'notes'],
      ...sessions.map(session => [session.date, session.time, session.minutes, session.category, session.focus, session.method, session.bpmStart || '', session.bpmEnd || '', session.notes])
    ];
    download('tempo-sessions-' + today() + '.csv', rows.map(row => row.map(value => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')).join('\n'), 'text/csv');
    toast('CSV downloaded');
  };

  document.querySelectorAll('#view-settings .privacy-note:not(#privacySummary)').forEach(note => note.remove());

  function mergeById(current, incoming) {
    return [...new Map([...current, ...incoming].map(item => [String(item.id), item])).values()];
  }

  function applyImportedData(data, merge) {
    sessions = merge ? mergeById(sessions, data.sessions) : data.sessions;
    pieces = merge ? mergeById(pieces, data.pieces) : data.pieces;
    window.setTempoAssignments(merge ? mergeById(window.getTempoAssignments?.() || [], data.assignments || []) : (data.assignments || []));
    plans = merge ? mergeById(plans, data.plans || []) : (data.plans || []);
    lessons = merge ? mergeById(lessons, data.lessons || []) : (data.lessons || []);
    questions = merge ? mergeById(questions, data.questions || []) : (data.questions || []);
    events = merge ? mergeById(events, data.events || []) : (data.events || []);
    skills = merge ? mergeById(skills, data.skills || []) : (data.skills || []);
    goals = merge ? mergeById(goals, data.goals || []) : (data.goals || []);
    settings = { ...settings, ...(data.settings || {}) };
    if (Array.isArray(data.milestones)) localStorage.setItem(MILESTONE_KEY, JSON.stringify(merge ? [...new Set([...read(MILESTONE_KEY, []), ...data.milestones])] : data.milestones));
    unlockedMilestones = read(MILESTONE_KEY, []);
    save();
  }

  document.getElementById('exportBackup').onclick = () => {
    const data = { app: 'Tempo Piano Studio', exportedAt: new Date().toISOString(), ...completeDataSnapshot() };
    download(`tempo-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
    localStorage.setItem('tempoLastExport', data.exportedAt);
    writeRotatingSnapshot(true);
    renderDataSafety();
    toast('Complete JSON backup downloaded');
  };

  document.getElementById('importFile').onchange = async event => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      const data = JSON.parse(await file.text());
      if (data.app !== 'Tempo Piano Studio' || !Array.isArray(data.sessions) || !Array.isArray(data.pieces) || !data.settings || typeof data.settings !== 'object') throw new Error('Invalid backup structure');
      const merge = confirm('Choose OK to merge this validated backup without duplicating matching records. Choose Cancel to consider replacing the current studio.');
      if (merge) applyImportedData(data, true);
      else if (confirm('Replace the current studio with this validated backup? A recovery snapshot will be kept.')) {
        writeRotatingSnapshot(true);
        applyImportedData(data, false);
      } else return;
      render();
      toast(merge ? 'Backup merged' : 'Backup restored');
    } catch (error) {
      alert('This file is not a valid Tempo Piano Studio backup. No data was changed.');
    } finally {
      event.target.value = '';
    }
  };

  function renderDataSafety() {
    const snapshots = read(SNAPSHOT_KEY, []);
    const bytes = Object.keys(localStorage).reduce((sum, key) => sum + (localStorage.getItem(key)?.length || 0) * 2, 0);
    const megabytes = bytes / 1024 / 1024;
    const lastExport = localStorage.getItem('tempoLastExport');
    const backupText = lastExport ? `Last manual backup: ${new Date(lastExport).toLocaleString()}.` : 'No manual backup has been recorded on this device.';
    document.getElementById('storageSummary').textContent = `${megabytes.toFixed(2)} MB used in this browser · schema ${DATA_VERSION}. ${backupText}`;
    document.getElementById('storageBar').style.width = `${Math.min(100, megabytes / 5 * 100)}%`;
    document.getElementById('snapshotList').innerHTML = snapshots.length ? snapshots.map(snapshot => `<div class="snapshot-row"><span class="small">${new Date(snapshot.createdAt).toLocaleString()} · ${snapshot.data.sessions?.length || 0} sessions</span><button class="ghost" data-student-only onclick="restoreTempoSnapshot('${snapshot.id}')">Restore</button></div>`).join('') : '<span class="small">A recovery snapshot will be created after the next saved change.</span>';
    const backupSummary = document.getElementById('backupSummary');
    if (backupSummary) backupSummary.textContent = `${sessions.length} sessions, ${pieces.length} pieces, ${(window.getTempoAssignments?.() || []).length} assignments, ${lessons.length} lessons, ${questions.length} questions and ${plans.length} plan blocks are included.`;
  }

  window.restoreTempoSnapshot = id => {
    const snapshot = read(SNAPSHOT_KEY, []).find(item => String(item.id) === String(id));
    if (!snapshot || !confirm(`Restore the snapshot from ${new Date(snapshot.createdAt).toLocaleString()}? A copy of the current studio will be kept.`)) return;
    writeRotatingSnapshot(true);
    applyImportedData(snapshot.data, false);
    render();
    toast('Recovery snapshot restored');
  };

  document.getElementById('resetData').onclick = () => {
    if (prompt('This clears the shared studio and this browser. Type RESET to continue:') !== 'RESET') return;
    writeRotatingSnapshot(true);
    ['pianoSessions', 'pianoRepertoire', 'tempoSettings', 'tempoAssignments', PLAN_KEY, LESSON_KEY, QUESTION_KEY, EVENT_KEY, SKILL_KEY, GOAL_KEY, MILESTONE_KEY, METRONOME_KEY].forEach(key => localStorage.removeItem(key));
    sessions = [];
    pieces = [];
    window.setTempoAssignments([]);
    plans = [];
    lessons = [];
    questions = [];
    events = [];
    skills = [];
    goals = [];
    unlockedMilestones = [];
    settings = { name: '', teacherName: '', lastLesson: '', nextLesson: '', dailyGoal: 45, defaultMinutes: 30, accent: 'violet' };
    render();
    toast('Studio reset · recovery snapshot retained');
  };

  function renderTimerSelectors() {
    const pieceSelect = document.getElementById('timerPiece');
    const currentPiece = String(timer.pieceId || pieceSelect.value || '');
    pieceSelect.innerHTML = selectablePieceOptions();
    pieceSelect.value = currentPiece;
    document.getElementById('timerCategory').value = timer.category || document.getElementById('timerCategory').value || 'Repertoire';
    if (!document.getElementById('timerFocus').value) document.getElementById('timerFocus').value = timer.focus || '';
  }
  ['timerCategory', 'timerPiece', 'timerFocus'].forEach(id => {
    document.getElementById(id).onchange = () => {
      timer.category = document.getElementById('timerCategory').value;
      timer.pieceId = Number(document.getElementById('timerPiece').value) || null;
      timer.focus = document.getElementById('timerFocus').value;
      save();
    };
  });

  duplicateSession = function copySessionToDate(id) {
    const source = sessions.find(session => session.id === id);
    if (!source) return;
    const targetDate = prompt('Copy this session to which date? Use YYYY-MM-DD.', selected);
    if (!targetDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || Number.isNaN(dateObj(targetDate).getTime())) {
      toast('Enter a valid date in YYYY-MM-DD format');
      return;
    }
    sessions.push({ ...source, id: uid(), date: targetDate });
    selected = targetDate;
    render();
    toast('Session copied to ' + targetDate);
  };

  function renderPracticePlan() {
    const list = plans.filter(block => block.date === selected).sort((a, b) => (a.order || 0) - (b.order || 0));
    const plannedMinutes = list.reduce((sum, block) => sum + Number(block.minutes || 0), 0);
    const completedMinutes = list.filter(block => block.completed).reduce((sum, block) => sum + Number(block.minutes || 0), 0);
    const loggedMinutes = dayData(selected).minutes;
    const lessonText = settings.nextLesson ? (() => {
      const days = Math.ceil((dateObj(settings.nextLesson) - dateObj(today())) / 86400000);
      return days >= 0 ? `Next lesson in ${days} day${days === 1 ? '' : 's'}` : 'Lesson date needs updating';
    })() : 'Next lesson not set';
    const openQuestions = questions.filter(question => !question.answered).length;
    document.getElementById('planSummary').innerHTML = `<span><strong>${completedMinutes} of ${plannedMinutes} planned minutes</strong> · ${loggedMinutes} logged</span><span>${esc(lessonText)} · ${openQuestions} open question${openQuestions === 1 ? '' : 's'}</span>`;
    document.getElementById('planList').innerHTML = list.length ? list.map((block, index) => {
      const piece = pieces.find(item => item.id === block.pieceId);
      return `<article class="plan-block ${block.completed ? 'complete' : ''}">
        <input type="checkbox" data-student-only aria-label="Mark ${esc(block.focus)} complete" ${block.completed ? 'checked' : ''} onchange="togglePlanBlock('${block.id}')">
        <span class="plan-duration">${Number(block.minutes)} min<br><span class="small">${esc(block.category)}</span></span>
        <div><h4>${esc(block.focus)}</h4><p>${piece ? esc(piece.title) : 'No repertoire link'}</p></div>
        <div class="plan-tools" data-student-only>
          <button class="icon" type="button" aria-label="Move earlier" onclick="movePlanBlock('${block.id}',-1)" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon" type="button" aria-label="Move later" onclick="movePlanBlock('${block.id}',1)" ${index === list.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon" type="button" aria-label="Log this block" onclick="logPlanBlock('${block.id}')">＋</button>
          <button class="icon" type="button" aria-label="Duplicate block" onclick="duplicatePlanBlock('${block.id}')">⧉</button>
          <button class="icon" type="button" aria-label="Edit block" onclick="openPlanBlock('${block.id}')">✎</button>
        </div>
      </article>`;
    }).join('') : '<div class="plan-empty">No blocks planned for this day. Add a short block when a specific intention would help.</div>';
  }

  function openPlanBlock(id = '') {
    const form = document.getElementById('planForm');
    form.reset();
    form.elements.pieceId.innerHTML = selectablePieceOptions();
    form.elements.id.value = '';
    form.elements.date.value = selected;
    form.elements.minutes.value = 10;
    document.getElementById('planFormTitle').textContent = 'Add practice block';
    if (id) {
      const block = plans.find(item => String(item.id) === String(id));
      if (!block) return;
      Object.entries(block).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ''; });
      document.getElementById('planFormTitle').textContent = 'Edit practice block';
    }
    modal('planModal');
  }

  window.openPlanBlock = openPlanBlock;
  window.togglePlanBlock = id => {
    plans = plans.map(block => String(block.id) === String(id) ? { ...block, completed: !block.completed } : block);
    render();
    toast('Practice plan updated');
  };
  window.movePlanBlock = (id, direction) => {
    const list = plans.filter(block => block.date === selected).sort((a, b) => (a.order || 0) - (b.order || 0));
    const index = list.findIndex(block => String(block.id) === String(id));
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= list.length) return;
    [list[index], list[swap]] = [list[swap], list[index]];
    list.forEach((block, order) => block.order = order);
    render();
  };
  window.duplicatePlanBlock = id => {
    const block = plans.find(item => String(item.id) === String(id));
    if (!block) return;
    plans.push({ ...block, id: String(uid()), completed: false, order: plans.filter(item => item.date === block.date).length });
    render();
    toast('Practice block duplicated');
  };
  window.logPlanBlock = id => {
    const block = plans.find(item => String(item.id) === String(id));
    if (!block) return;
    newSession(block.minutes);
    sessionForm.elements.date.value = block.date;
    sessionForm.elements.category.value = block.category === 'Technique' ? 'Technical exercise' : block.category === 'Performance run' ? 'Performance practice' : block.category;
    sessionForm.elements.pieceId.value = block.pieceId || '';
    sessionForm.elements.focus.value = block.focus;
  };
  document.getElementById('addPlanBlock').onclick = () => openPlanBlock();
  document.querySelector('#planModal [data-close]').onclick = () => modal('planModal', false);
  document.getElementById('planModal').onclick = event => { if (event.target.id === 'planModal') modal('planModal', false); };
  document.getElementById('planForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = String(form.get('id') || '');
    const existing = plans.find(block => String(block.id) === id);
    const block = {
      ...(existing || {}),
      id: id || String(uid()),
      date: form.get('date'),
      category: form.get('category'),
      minutes: Number(form.get('minutes')),
      pieceId: Number(form.get('pieceId')) || null,
      focus: String(form.get('focus') || '').trim(),
      completed: existing?.completed || false,
      order: existing?.order ?? plans.filter(item => item.date === form.get('date')).length
    };
    plans = id ? plans.map(item => String(item.id) === id ? block : item) : [...plans, block];
    modal('planModal', false);
    render();
    toast(id ? 'Practice block updated' : 'Practice block added');
  };

  function selectedReportSessions() {
    const from = document.getElementById('reportFrom').value || settings.lastLesson || today();
    const to = document.getElementById('reportTo').value || today();
    return { from, to, list: sessions.filter(session => session.date >= from && session.date <= to) };
  }

  function renderLessonPreparation() {
    const range = selectedReportSessions();
    const assignmentList = window.getTempoAssignments?.() || [];
    const ready = assignmentList.filter(assignment => assignment.status === 'Ready to review').length;
    const openQuestions = questions.filter(question => !question.answered);
    const problemSessions = range.list.filter(session => Number(session.difficulty) >= 4 || session.remainsDifficult);
    const tempoChanges = range.list.filter(session => session.bpmStart && session.bpmEnd && session.bpmStart !== session.bpmEnd);
    const neglected = pieces.filter(piece => !piece.archived && piece.status !== 'Archived' && (!lastPractised(piece.id) || dateObj(lastPractised(piece.id)) < new Date(Date.now() - 14 * 86400000))).length;
    document.getElementById('prepGrid').innerHTML = [
      [ready, 'assignments ready to review'],
      [openQuestions.length, 'unanswered student questions'],
      [problemSessions.length, 'sessions noting difficulty'],
      [tempoChanges.length, 'sessions with tempo change'],
      [neglected, 'active pieces not practised recently'],
      [lessons.length, 'lesson records saved']
    ].map(item => `<div class="prep-item"><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join('');

    document.getElementById('lessonRecords').innerHTML = lessons.length ? [...lessons].sort((a, b) => b.date.localeCompare(a.date)).map(lesson => `
      <article class="lesson-row"><time>${dateObj(lesson.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time><div><h4>${esc(lesson.teacher || settings.teacherName || 'Lesson')}</h4><p>${esc(lesson.summary || lesson.feedback || 'No summary recorded.')}${lesson.nextLessonDate ? ` · Next lesson ${esc(lesson.nextLessonDate)}` : ''}</p></div><button class="icon" data-student-only aria-label="Edit lesson record" onclick="openLessonRecord('${lesson.id}')">✎</button></article>`).join('') : '<p class="small">No lesson records saved yet.</p>';

    const reportQuestions = questions.filter(question => !question.answered || (question.createdAt >= range.from && question.createdAt <= range.to));
    document.getElementById('reportQuestions').innerHTML = reportQuestions.length ? reportQuestions.map(question => `
      <article class="question-row ${question.answered ? 'answered' : ''}"><div><strong>${esc(question.question)}</strong><p>${esc(question.context || 'No additional context')} · ${esc(question.createdAt || '')}${question.teacherAnswer ? `<br>Answer: ${esc(question.teacherAnswer)}` : ''}</p></div>${question.answered ? '<span class="status ready">Answered</span>' : `<button class="ghost" data-student-only onclick="answerPracticeQuestion('${question.id}')">Record answer</button>`}</article>`).join('') : '<p class="small">No questions saved for this period.</p>';

    const includeHistory = document.getElementById('includeHistory').checked;
    const includeReflections = document.getElementById('includeReflections').checked;
    document.getElementById('rawHistorySection').hidden = !includeHistory;
    document.getElementById('rawHistory').innerHTML = includeHistory ? `<div class="report-session-table"><table class="report-table"><thead><tr><th>Date</th><th>Focus</th><th>Minutes</th><th>Tempo</th>${includeReflections ? '<th>Reflection</th>' : ''}</tr></thead><tbody>${range.list.map(session => `<tr><td>${esc(session.date)}</td><td>${esc(session.focus)}</td><td>${session.minutes}</td><td>${session.bpmStart || session.bpmEnd ? `${session.bpmStart || '—'} → ${session.bpmEnd || '—'}` : '—'}</td>${includeReflections ? `<td>${esc(session.improved || session.remainsDifficult || session.notes || '')}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '';
  }

  function openLessonRecord(id = '') {
    if (!document.body.classList.contains('student-mode')) return;
    const form = document.getElementById('lessonForm');
    form.reset();
    form.elements.id.value = '';
    form.elements.date.value = today();
    form.elements.teacher.value = settings.teacherName || '';
    form.elements.nextLessonDate.value = settings.nextLesson || '';
    if (id) {
      const lesson = lessons.find(item => String(item.id) === String(id));
      if (!lesson) return;
      Object.entries(lesson).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ''; });
    }
    modal('lessonModal');
  }

  window.openLessonRecord = openLessonRecord;
  window.answerPracticeQuestion = id => {
    if (!document.body.classList.contains('student-mode')) return;
    const answer = prompt('Record the teacher answer or lesson note:');
    if (answer === null) return;
    questions = questions.map(question => String(question.id) === String(id) ? { ...question, answered: true, teacherAnswer: answer.trim(), answeredLessonDate: settings.lastLesson || today() } : question);
    render();
    toast('Question marked answered');
  };
  document.getElementById('addLesson').onclick = () => openLessonRecord();
  document.querySelector('#lessonModal [data-close]').onclick = () => modal('lessonModal', false);
  document.getElementById('lessonModal').onclick = event => { if (event.target.id === 'lessonModal') modal('lessonModal', false); };
  document.getElementById('lessonForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = String(form.get('id') || '');
    const existing = lessons.find(lesson => String(lesson.id) === id);
    const lesson = {
      ...(existing || {}),
      id: id || String(uid()),
      date: form.get('date'),
      teacher: form.get('teacher'),
      repertoire: form.get('repertoire'),
      technique: form.get('technique'),
      feedback: form.get('feedback'),
      concepts: form.get('concepts'),
      questionsAnswered: form.get('questionsAnswered'),
      nextLessonDate: form.get('nextLessonDate'),
      summary: form.get('summary')
    };
    lessons = id ? lessons.map(item => String(item.id) === id ? lesson : item) : [...lessons, lesson];
    settings.teacherName = lesson.teacher || settings.teacherName;
    settings.lastLesson = lesson.date;
    if (lesson.nextLessonDate) settings.nextLesson = lesson.nextLessonDate;
    modal('lessonModal', false);
    render();
    toast(id ? 'Lesson record updated' : 'Lesson record saved');
  };

  document.getElementById('includeHistory').onchange = renderLessonPreparation;
  document.getElementById('includeReflections').onchange = renderLessonPreparation;
  document.getElementById('reportFrom').onchange = render;
  document.getElementById('reportTo').onchange = render;
  document.getElementById('teacherUnlockCode').value = sessionStorage.getItem('tempoTeacherCode') || '';
  document.getElementById('unlockTeacherView').onclick = async () => {
    const code = document.getElementById('teacherUnlockCode').value.trim();
    const message = document.getElementById('teacherUnlockMessage');
    if (code.length < 8) {
      message.textContent = 'Enter the access code of at least 8 characters.';
      return;
    }
    message.textContent = 'Opening the private practice record…';
    const opened = await window.unlockTempoTeacher?.(code);
    message.textContent = opened ? 'Private practice record opened for this browser session.' : 'That access code did not open the practice record.';
    if (opened) render();
  };
  document.getElementById('exportReportHtml').onclick = () => {
    const range = selectedReportSessions();
    const total = range.list.reduce((sum, session) => sum + session.minutes, 0);
    const activeDays = new Set(range.list.map(session => session.date)).size;
    const includeHistory = document.getElementById('includeHistory').checked;
    const includeReflections = document.getElementById('includeReflections').checked;
    const assignmentList = window.getTempoAssignments?.() || [];
    const questionList = questions.filter(question => !question.answered || (question.createdAt >= range.from && question.createdAt <= range.to));
    const sessionRows = includeHistory ? `<h2>Session history</h2><table><thead><tr><th>Date</th><th>Focus</th><th>Minutes</th><th>Tempo</th>${includeReflections ? '<th>Reflection</th>' : ''}</tr></thead><tbody>${range.list.map(session => `<tr><td>${esc(session.date)}</td><td>${esc(session.focus)}</td><td>${session.minutes}</td><td>${session.bpmStart || session.bpmEnd ? `${session.bpmStart || '—'} → ${session.bpmEnd || '—'} BPM` : '—'}</td>${includeReflections ? `<td>${esc(session.improved || session.remainsDifficult || session.notes || '')}</td>` : ''}</tr>`).join('')}</tbody></table>` : '';
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(settings.name || 'Student')} practice report · ${range.to}</title><style>body{max-width:900px;margin:48px auto;padding:0 28px;color:#17202d;font:15px/1.55 Arial,sans-serif}h1,h2{font-family:Georgia,serif}h1{font-size:34px;margin-bottom:4px}.meta{color:#5c6674}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:28px 0}.stat{border:1px solid #ccd2da;padding:16px}.stat strong{display:block;font-size:28px}table{width:100%;border-collapse:collapse;margin:12px 0 28px}th,td{text-align:left;padding:9px;border-bottom:1px solid #d9dde3}th{font-size:11px;text-transform:uppercase;color:#5c6674}li{margin:7px 0}@media print{body{margin:0}}</style></head><body><h1>Piano practice report</h1><p class="meta">${esc(settings.name || 'Student')} · ${esc(range.from)} to ${esc(range.to)}${settings.teacherName ? ` · Teacher: ${esc(settings.teacherName)}` : ''}</p><div class="stats"><div class="stat"><strong>${total}</strong>minutes</div><div class="stat"><strong>${activeDays}</strong>active days</div><div class="stat"><strong>${range.list.length ? Math.round(total / range.list.length) : 0}</strong>average minutes</div></div><h2>Assignments</h2><ul>${assignmentList.map(assignment => `<li>${esc(assignment.title)} — ${esc(assignment.status)}</li>`).join('') || '<li>None recorded</li>'}</ul><h2>Questions for the teacher</h2><ul>${questionList.map(question => `<li>${esc(question.question)}${question.teacherAnswer ? ` — ${esc(question.teacherAnswer)}` : ''}</li>`).join('') || '<li>None recorded</li>'}</ul>${sessionRows}<p class="meta">Exported from Tempo Piano Studio on ${new Date().toLocaleDateString()}.</p></body></html>`;
    download(`tempo-teacher-report-${range.to}.html`, html, 'text/html');
    toast('Dated teacher report exported');
  };

  function weekStart(date) {
    const result = new Date(date);
    result.setHours(12, 0, 0, 0);
    const day = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - day);
    return result;
  }

  function practiceMetrics() {
    const dates = [...new Set(sessions.filter(session => session.minutes > 0).map(session => session.date))].sort();
    let longestStreak = 0;
    let run = 0;
    let previous = null;
    dates.forEach(value => {
      const current = dateObj(value);
      run = previous && Math.round((current - previous) / 86400000) === 1 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      previous = current;
    });
    const byWeek = {};
    sessions.forEach(session => {
      const key = iso(weekStart(dateObj(session.date)));
      byWeek[key] = (byWeek[key] || 0) + session.minutes;
    });
    const byDay = {};
    sessions.forEach(session => byDay[session.date] = (byDay[session.date] || 0) + session.minutes);
    const tempoTarget = pieces.some(piece => piece.targetBpm && sessions.some(session => session.pieceId === piece.id && Number(session.bpmEnd || session.bpm) >= piece.targetBpm));
    return {
      activeDays: dates.length,
      longestStreak,
      maxWeek: Math.max(0, ...Object.values(byWeek)),
      maxDay: Math.max(0, ...Object.values(byDay)),
      totalMinutes: sessions.reduce((sum, session) => sum + session.minutes, 0),
      completedPieces: pieces.filter(piece => piece.status === 'Performance ready' || piece.progress >= 100).length,
      tempoTarget,
      longestSession: Math.max(0, ...sessions.map(session => session.minutes))
    };
  }

  const milestoneDefinitions = [
    { id: 'first-session', icon: '01', title: 'First session recorded', copy: 'A focused practice session is in the journal.', met: metrics => metrics.activeDays >= 1, progress: metrics => `${metrics.activeDays ? 1 : 0} of 1 session` },
    { id: 'goal-day', icon: '◎', title: 'Daily plan completed', copy: 'The daily practice target was reached.', met: metrics => metrics.maxDay >= settings.dailyGoal, progress: metrics => `${Math.min(metrics.maxDay, settings.dailyGoal)} of ${settings.dailyGoal} minutes` },
    { id: 'sixty-week', icon: '60', title: '60-minute week', copy: 'A full hour of practice was recorded in one week.', met: metrics => metrics.maxWeek >= 60, progress: metrics => `${Math.min(metrics.maxWeek, 60)} of 60 minutes` },
    { id: 'seven-streak', icon: '7d', title: 'Seven consecutive days', copy: 'Practice was recorded on seven consecutive days.', met: metrics => metrics.longestStreak >= 7, progress: metrics => `${Math.min(metrics.longestStreak, 7)} of 7 days` },
    { id: 'piece-ready', icon: '✓', title: 'Piece performance-ready', copy: 'A repertoire piece reached performance-ready status.', met: metrics => metrics.completedPieces >= 1, progress: metrics => `${metrics.completedPieces ? 1 : 0} of 1 piece` },
    { id: 'tempo-target', icon: '♩', title: 'Target tempo recorded', copy: 'A session reached the target tempo for its repertoire piece.', met: metrics => metrics.tempoTarget, progress: metrics => metrics.tempoTarget ? 'Target recorded' : 'No target recorded yet' },
    { id: 'three-hundred', icon: '5h', title: 'Five hours recorded', copy: 'The journal contains 300 minutes of practice.', met: metrics => metrics.totalMinutes >= 300, progress: metrics => `${Math.min(metrics.totalMinutes, 300)} of 300 minutes` },
    { id: 'deep-session', icon: '60', title: '60-minute session', copy: 'A single 60-minute practice session was completed.', met: metrics => metrics.longestSession >= 60, progress: metrics => `${Math.min(metrics.longestSession, 60)} of 60 minutes` }
  ];

  let unlockedMilestones = read(MILESTONE_KEY, []);
  if (!Array.isArray(unlockedMilestones)) unlockedMilestones = [];

  function renderMilestones() {
    const metrics = practiceMetrics();
    const newlyUnlocked = milestoneDefinitions.filter(definition => definition.met(metrics) && !unlockedMilestones.includes(definition.id));
    if (newlyUnlocked.length) {
      unlockedMilestones = [...unlockedMilestones, ...newlyUnlocked.map(definition => definition.id)];
      localStorage.setItem(MILESTONE_KEY, JSON.stringify(unlockedMilestones));
      save();
      setTimeout(() => toast(`Milestone recorded · ${newlyUnlocked.at(-1).title}`), 80);
    }
    const unlockedCount = milestoneDefinitions.filter(definition => definition.met(metrics)).length;
    document.getElementById('milestoneCount').textContent = `${unlockedCount} of ${milestoneDefinitions.length} unlocked`;
    document.getElementById('milestoneGrid').innerHTML = milestoneDefinitions.map(definition => {
      const unlocked = definition.met(metrics);
      return `<article class="card milestone-card ${unlocked ? '' : 'locked'}"><div class="milestone-icon" aria-hidden="true">${definition.icon}</div><h4>${definition.title}</h4><p>${definition.copy}</p><span class="milestone-state">${unlocked ? 'UNLOCKED' : esc(definition.progress(metrics))}</span></article>`;
    }).join('');
    const next = milestoneDefinitions.find(definition => !definition.met(metrics));
    const latest = [...milestoneDefinitions].reverse().find(definition => definition.met(metrics));
    document.getElementById('milestonePeekTitle').textContent = latest ? `${latest.title} unlocked` : 'Your first milestone is waiting';
    document.getElementById('milestonePeekCopy').textContent = next ? `Next: ${next.title} · ${next.progress(metrics)}` : 'All current milestones are recorded.';
  }

  document.getElementById('openMilestones').onclick = () => switchView('wrapped');

  let wrappedOffset = 0;
  let wrappedSummary = '';

  function wrappedWeek(offset) {
    const start = weekStart(new Date());
    start.setDate(start.getDate() + offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end, from: iso(start), to: iso(end) };
  }

  function countRuns(dateValues) {
    const dates = [...new Set(dateValues)].sort();
    let longest = 0;
    let run = 0;
    let previous = null;
    dates.forEach(value => {
      const current = dateObj(value);
      run = previous && Math.round((current - previous) / 86400000) === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
      previous = current;
    });
    return longest;
  }

  function wrappedCard(kicker, number, heading, copy, foot, index, total) {
    const dots = Array.from({ length: total }, (_, dot) => `<i class="${dot === index ? 'active' : ''}"></i>`).join('');
    return `<article class="wrapped-card"><div><span class="wrapped-kicker">${esc(kicker)}</span>${number !== null ? `<strong class="wrapped-number">${esc(number)}</strong>` : ''}<h3>${esc(heading)}</h3><p>${esc(copy)}</p></div><div class="wrapped-foot"><span>${esc(foot)}</span><span class="wrapped-dots" aria-hidden="true">${dots}</span></div></article>`;
  }

  function renderWrapped() {
    const week = wrappedWeek(wrappedOffset);
    const list = sessions.filter(session => session.date >= week.from && session.date <= week.to);
    const previousWeek = wrappedWeek(wrappedOffset - 1);
    const previousList = sessions.filter(session => session.date >= previousWeek.from && session.date <= previousWeek.to);
    const total = list.reduce((sum, session) => sum + session.minutes, 0);
    const previousTotal = previousList.reduce((sum, session) => sum + session.minutes, 0);
    const activeDates = [...new Set(list.map(session => session.date))];
    const dayTotals = activeDates.map(date => [date, list.filter(session => session.date === date).reduce((sum, session) => sum + session.minutes, 0)]).sort((a, b) => b[1] - a[1]);
    const focusTotals = {};
    list.forEach(session => focusTotals[session.category || 'Practice'] = (focusTotals[session.category || 'Practice'] || 0) + session.minutes);
    const topFocus = Object.entries(focusTotals).sort((a, b) => b[1] - a[1])[0];
    const pieceTotals = pieces.map(piece => ({ title: piece.title, minutes: list.filter(session => session.pieceId === piece.id).reduce((sum, session) => sum + session.minutes, 0) })).sort((a, b) => b.minutes - a.minutes);
    const topPiece = pieceTotals.find(piece => piece.minutes > 0);
    const tempoSessions = list.filter(session => session.bpmStart && session.bpmEnd);
    const tempoLift = tempoSessions.map(session => ({ session, lift: session.bpmEnd - session.bpmStart })).sort((a, b) => b.lift - a.lift)[0];
    const questions = list.filter(session => session.question).length;
    const teacherNotes = window.tempoTeacherNotes || [];
    const notesCompleted = teacherNotes.filter(note => note.completed && String(note.created_at || '').slice(0, 10) >= week.from && String(note.created_at || '').slice(0, 10) <= week.to).length;
    const completedAssignments = (window.getTempoAssignments?.() || []).filter(assignment => assignment.status === 'Completed').length;
    const streak = countRuns(activeDates);
    const change = previousTotal ? Math.round((total - previousTotal) / previousTotal * 100) : null;
    const bestDay = dayTotals[0];
    const weekPattern = activeDates.length >= 5 ? 'Consistent practice' : tempoLift?.lift > 0 ? 'Tempo development' : questions ? 'Reflective practice' : total ? 'Focused practice' : 'No sessions recorded';
    const name = settings.name || 'Connor';
    document.getElementById('wrappedDates').textContent = `${week.start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${week.end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    document.getElementById('wrappedNext').disabled = wrappedOffset >= 0;
    const cards = [
      ['Tempo Weekly Replay', null, `${name}, this was your week at the piano.`, total ? 'This review brings together recorded time, questions, focus areas and tempo changes.' : 'No practice sessions were recorded for this week. The review remains ready for the next entry.', `${list.length} session${list.length === 1 ? '' : 's'} captured`],
      ['Time in the music', String(total), 'minutes of focused practice.', change === null ? 'This is the beginning of your weekly rhythm.' : change >= 0 ? `${change}% more time at the piano than the previous week.` : `${Math.abs(change)}% less than the previous week — recovery is part of progress too.`, total ? `About ${Math.max(1, Math.round(total / 4))} four-minute songs` : 'A fresh week awaits'],
      ['Active practice days', String(activeDates.length), `active day${activeDates.length === 1 ? '' : 's'}.`, bestDay ? `${bestDay[0] === today() ? 'Today' : dateObj(bestDay[0]).toLocaleDateString(undefined, { weekday: 'long' })} had the most recorded practice with ${bestDay[1]} minutes.` : 'One recorded practice day is enough to begin this comparison.', `${streak}-day longest run this week`],
      ['Primary focus', topFocus ? topFocus[0] : '—', topFocus ? 'received the most practice time.' : 'No leading focus was recorded.', topPiece ? `${topPiece.title} received the most attention: ${topPiece.minutes} minutes.` : 'Link sessions to repertoire pieces to show where practice time was spent.', topFocus ? `${topFocus[1]} focused minutes` : 'No focus recorded'],
      ['Tempo journey', tempoLift?.lift > 0 ? `+${tempoLift.lift}` : '—', tempoLift?.lift > 0 ? 'BPM was your biggest lift.' : 'Your tempo story is ready to begin.', tempoLift?.lift > 0 ? `${tempoLift.session.focus}: ${tempoLift.session.bpmStart} → ${tempoLift.session.bpmEnd} BPM.` : 'Use the metronome and log starting and ending tempo to make progress visible.', `${notesCompleted} teacher notes completed · ${questions} questions saved`],
      ['Weekly pattern', null, weekPattern, total ? `You completed ${completedAssignments} assignment${completedAssignments === 1 ? '' : 's'} overall during the current practice record.` : 'No score or penalty is applied to an irregular week. The next entry begins a new record.', `${practiceMetrics().longestStreak}-day longest run`]
    ];
    document.getElementById('wrappedStage').innerHTML = cards.map((card, index) => wrappedCard(...card, index, cards.length)).join('');
    wrappedSummary = `${name}'s Weekly Replay (${week.from} to ${week.to})\n${total} practice minutes across ${list.length} sessions and ${activeDates.length} active days.\nTop focus: ${topFocus?.[0] || '—'}. Top piece: ${topPiece?.title || '—'}.\nBiggest tempo lift: ${tempoLift?.lift > 0 ? `${tempoLift.session.bpmStart} to ${tempoLift.session.bpmEnd} BPM` : '—'}.\nTeacher notes completed: ${notesCompleted}. Questions saved: ${questions}.\nWeekly pattern: ${weekPattern}.`;
  }

  document.getElementById('wrappedPrev').onclick = () => { wrappedOffset -= 1; renderWrapped(); };
  document.getElementById('wrappedNext').onclick = () => { if (wrappedOffset < 0) wrappedOffset += 1; renderWrapped(); };
  document.getElementById('wrappedThis').onclick = () => { wrappedOffset = 0; renderWrapped(); };
  document.getElementById('shareWrapped').onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'My Tempo Weekly Replay', text: wrappedSummary, url: location.href });
      else await navigator.clipboard.writeText(wrappedSummary);
      toast(navigator.share ? 'Replay shared' : 'Replay summary copied');
    } catch (error) {
      if (error.name !== 'AbortError') toast('Sharing is unavailable right now');
    }
  };

  let deferredInstall = null;
  const installButton = document.getElementById('installApp');
  const installState = document.getElementById('installState');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) {
    installButton.hidden = true;
    installState.textContent = 'Installed · Tempo is running as an app.';
  } else {
    installState.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'On iPhone or iPad: tap Share, then Add to Home Screen.' : 'Install becomes available after your browser confirms the app is ready.';
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstall = event;
    installButton.disabled = false;
    installState.textContent = 'Ready to install on this device.';
  });

  installButton.onclick = async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      const choice = await deferredInstall.userChoice;
      installState.textContent = choice.outcome === 'accepted' ? 'Installation started.' : 'You can install whenever you are ready.';
      deferredInstall = null;
      return;
    }
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) toast('Tap Share, then Add to Home Screen');
    else toast('Use your browser menu and choose Install app');
  };

  function updateOnlineState() {
    document.body.classList.toggle('is-offline', !navigator.onLine);
    if (!navigator.onLine) installState.textContent = 'Offline mode · local practice tools remain available.';
  }
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
  updateOnlineState();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(error => console.error('Offline setup failed', error)));
  }

  const previousRender = render;
  render = function enhancedRender() {
    previousRender();
    if (document.body.classList.contains('viewer-mode')) {
      document.getElementById('cloudStatus').innerHTML = `<span class="sync-dot"></span>${window.tempoTeacherUnlocked ? 'Teacher · private' : 'Teacher · locked'}`;
    }
    moreNav.classList.toggle('active', ['assignments', 'report', 'settings', 'wrapped'].includes(currentView));
    if (currentView === 'today') {
      renderTimerSelectors();
      renderPracticePlan();
    }
    if (currentView === 'report') renderLessonPreparation();
    if (currentView === 'settings') renderDataSafety();
    renderMilestones();
    if (currentView === 'wrapped') {
      document.getElementById('viewTitle').textContent = 'Weekly Replay';
      renderWrapped();
    }
  };

  window.addEventListener('tempo:teacher-notes', () => {
    if (currentView === 'wrapped') renderWrapped();
  });

  const launchParams = new URLSearchParams(location.search);
  if (launchParams.get('view') === 'wrapped') currentView = 'wrapped';
  if (launchParams.get('action') === 'practice') {
    setTimeout(() => {
      if (document.body.classList.contains('student-mode')) {
        switchView('today');
        newSession();
      } else {
        switchView('settings');
        toast('Unlock Connor view to log practice');
      }
    }, 800);
  }

  switchView(currentView);
})();
