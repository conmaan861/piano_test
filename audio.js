export class TempoAudio {
  constructor() {
    this.context = null;
    this.master = null;
  }

  async ensure() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = .82;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return true;
  }

  pulse(frequency, when, { gain = .16, duration = .09, type = 'triangle', destination = this.master } = {}) {
    if (!this.context || !destination) return null;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    envelope.gain.setValueAtTime(.0001, when);
    envelope.gain.exponentialRampToValueAtTime(gain, when + .006);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration);
    oscillator.connect(envelope).connect(destination);
    oscillator.start(when);
    oscillator.stop(when + duration + .02);
    return oscillator;
  }

  scheduleCountIn(enabled = true) {
    if (!enabled || !this.context) return;
    const start = this.context.currentTime + .06;
    [0, .76, 1.52].forEach(offset => this.pulse(466.16, start + offset, { gain: .13, duration: .085 }));
    this.pulse(659.25, start + 2.28, { gain: .16, duration: .13 });
    this.pulse(987.77, start + 2.28, { gain: .055, duration: .16, type: 'sine' });
  }

  playCompletion(enabled = true) {
    if (!enabled || !this.context) return;
    const start = this.context.currentTime + .03;
    this.pulse(523.25, start, { gain: .09, duration: .42, type: 'sine' });
    this.pulse(659.25, start + .16, { gain: .075, duration: .52, type: 'sine' });
    this.pulse(783.99, start + .32, { gain: .06, duration: .64, type: 'sine' });
  }
}

export class MetronomeEngine {
  constructor(audio, onBeat) {
    this.audio = audio;
    this.onBeat = onBeat;
    this.running = false;
    this.timer = null;
    this.nextNoteTime = 0;
    this.beat = 0;
    this.generation = 0;
    this.scheduledNodes = new Set();
    this.output = null;
    this.options = { bpm: 75, numerator: 4, denominator: 4, muted: false, volume: .7 };
  }

  async start(options = {}) {
    if (this.running) return;
    const available = await this.audio.ensure();
    if (!available) return;
    this.options = { ...this.options, ...options };
    if (!this.output) {
      this.output = this.audio.context.createGain();
      this.output.connect(this.audio.master);
    }
    this.applyGain();
    this.running = true;
    this.generation += 1;
    this.beat = 0;
    this.nextNoteTime = this.audio.context.currentTime + .05;
    this.scheduler(this.generation);
  }

  stop() {
    this.running = false;
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = null;
    this.scheduledNodes.forEach(node => { try { node.stop(); } catch {} });
    this.scheduledNodes.clear();
    this.beat = 0;
  }

  update(options = {}) {
    this.options = { ...this.options, ...options };
    this.applyGain();
  }

  applyGain() {
    if (!this.output || !this.audio.context) return;
    const value = this.options.muted ? 0 : Math.max(0, Math.min(1, this.options.volume)) * .72;
    this.output.gain.setTargetAtTime(value, this.audio.context.currentTime, .012);
  }

  scheduler(generation) {
    if (!this.running || generation !== this.generation) return;
    const context = this.audio.context;
    if (this.nextNoteTime < context.currentTime - .1) this.nextNoteTime = context.currentTime + .04;
    while (this.nextNoteTime < context.currentTime + .1) {
      this.scheduleBeat(this.beat, this.nextNoteTime, generation);
      this.nextNoteTime += (60 / this.options.bpm) * (4 / this.options.denominator);
      this.beat = (this.beat + 1) % this.options.numerator;
    }
    this.timer = setTimeout(() => this.scheduler(generation), 25);
  }

  scheduleBeat(beat, time, generation) {
    const accented = beat === 0;
    const node = this.audio.pulse(accented ? 1280 : 860, time, {
      gain: accented ? .22 : .14,
      duration: accented ? .055 : .045,
      type: 'square',
      destination: this.output
    });
    if (node) {
      this.scheduledNodes.add(node);
      node.onended = () => this.scheduledNodes.delete(node);
    }
    const delay = Math.max(0, (time - this.audio.context.currentTime) * 1000);
    setTimeout(() => {
      if (this.running && generation === this.generation) this.onBeat?.(beat, this.options.numerator);
    }, delay);
  }
}

export function calculateTapTempo(taps, now = performance.now()) {
  const recent = [...taps.filter(value => now - value < 2500), now].slice(-7);
  if (recent.length < 3) return { taps: recent, bpm: null };
  const intervals = recent.slice(1).map((value, index) => value - recent[index]).filter(value => value >= 250 && value <= 2000);
  if (intervals.length < 2) return { taps: recent, bpm: null };
  const ordered = [...intervals].sort((a, b) => a - b);
  const useful = ordered.length > 3 ? ordered.slice(1, -1) : ordered;
  const average = useful.reduce((sum, value) => sum + value, 0) / useful.length;
  return { taps: recent, bpm: Math.max(30, Math.min(240, Math.round(60000 / average))) };
}
