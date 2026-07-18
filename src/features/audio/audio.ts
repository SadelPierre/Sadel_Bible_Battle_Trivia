/**
 * AudioManager — Web Audio API sound engine.
 *
 * All cues are synthesized (no asset files required), so the game ships with
 * working placeholder audio. To replace any cue with a real recording, drop a
 * file in /public/audio (e.g. /public/audio/correct.mp3) and register it with
 * `audio.registerFile("correct", "/audio/correct.mp3")` — file cues take
 * precedence over synthesized ones. See README "Replacing audio".
 *
 * Rules implemented here:
 *  - Nothing plays before the first user gesture (AudioContext unlock).
 *  - A per-cue throttle prevents excessive overlapping duplicates.
 *  - Music and SFX have independent gain nodes; preferences persist locally.
 */

export type SoundCue =
  | "click"
  | "playerJoined"
  | "gameStart"
  | "countdownTick"
  | "countdownGo"
  | "timerWarning"
  | "correct"
  | "incorrect"
  | "scoreTick"
  | "rankUp"
  | "roundComplete"
  | "winner";

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

/** Each cue is a tiny score of oscillator notes. */
const CUES: Record<SoundCue, Note[]> = {
  click: [{ freq: 660, at: 0, dur: 0.05, type: "triangle", gain: 0.25 }],
  playerJoined: [
    { freq: 523.25, at: 0, dur: 0.09, type: "sine" },
    { freq: 783.99, at: 0.09, dur: 0.14, type: "sine" },
  ],
  gameStart: [
    { freq: 523.25, at: 0, dur: 0.12 },
    { freq: 659.25, at: 0.12, dur: 0.12 },
    { freq: 783.99, at: 0.24, dur: 0.2 },
  ],
  countdownTick: [{ freq: 880, at: 0, dur: 0.08, type: "square", gain: 0.15 }],
  countdownGo: [
    { freq: 1046.5, at: 0, dur: 0.25, type: "square", gain: 0.2 },
    { freq: 1318.5, at: 0.05, dur: 0.3, type: "sine", gain: 0.2 },
  ],
  timerWarning: [{ freq: 440, at: 0, dur: 0.1, type: "square", gain: 0.18 }],
  correct: [
    { freq: 587.33, at: 0, dur: 0.1 },
    { freq: 739.99, at: 0.09, dur: 0.1 },
    { freq: 880, at: 0.18, dur: 0.22 },
  ],
  incorrect: [
    { freq: 220, at: 0, dur: 0.18, type: "sawtooth", gain: 0.12 },
    { freq: 174.61, at: 0.16, dur: 0.25, type: "sawtooth", gain: 0.12 },
  ],
  scoreTick: [{ freq: 990, at: 0, dur: 0.03, type: "triangle", gain: 0.12 }],
  rankUp: [
    { freq: 659.25, at: 0, dur: 0.08 },
    { freq: 880, at: 0.08, dur: 0.12 },
  ],
  roundComplete: [
    { freq: 523.25, at: 0, dur: 0.1 },
    { freq: 659.25, at: 0.1, dur: 0.1 },
    { freq: 783.99, at: 0.2, dur: 0.1 },
    { freq: 1046.5, at: 0.3, dur: 0.25 },
  ],
  winner: [
    { freq: 523.25, at: 0, dur: 0.15 },
    { freq: 659.25, at: 0.15, dur: 0.15 },
    { freq: 783.99, at: 0.3, dur: 0.15 },
    { freq: 1046.5, at: 0.45, dur: 0.3 },
    { freq: 783.99, at: 0.75, dur: 0.1 },
    { freq: 1046.5, at: 0.85, dur: 0.5 },
  ],
};

const THROTTLE_MS: Partial<Record<SoundCue, number>> = {
  scoreTick: 40,
  click: 60,
  timerWarning: 400,
};

/** Gentle background music: a slow arpeggio loop over warm chords. */
const MUSIC_CHORDS: number[][] = [
  [261.63, 329.63, 392.0], // C
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
];

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private lastPlayed = new Map<SoundCue, number>();
  private fileBuffers = new Map<SoundCue, AudioBuffer>();
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;

  muted = false;
  sfxVolume = 0.7;
  musicVolume = 0.35;
  musicOn = false;

  /** Must be called from a user gesture (button click) before sounds play. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.musicOn && !this.musicTimer) this.startMusicLoop();
  }

  setPreferences(p: { muted: boolean; sfxVolume: number; musicVolume: number; musicOn: boolean }) {
    this.muted = p.muted;
    this.sfxVolume = p.sfxVolume;
    this.musicVolume = p.musicVolume;
    const musicTurnedOn = p.musicOn && !this.musicOn;
    this.musicOn = p.musicOn;
    this.applyVolumes();
    if (!p.musicOn) this.stopMusicLoop();
    else if (musicTurnedOn && this.ctx) this.startMusicLoop();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
    if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : this.musicVolume * 0.4;
  }

  /** Replace a synthesized cue with a real audio file (optional). */
  async registerFile(cue: SoundCue, url: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.fileBuffers.set(cue, buf);
    } catch {
      // keep synthesized fallback
    }
  }

  play(cue: SoundCue): void {
    if (!this.ctx || !this.sfxGain || this.muted || this.sfxVolume <= 0) return;
    const now = performance.now();
    const throttle = THROTTLE_MS[cue] ?? 120;
    const last = this.lastPlayed.get(cue) ?? -Infinity;
    if (now - last < throttle) return;
    this.lastPlayed.set(cue, now);

    const file = this.fileBuffers.get(cue);
    if (file) {
      const src = this.ctx.createBufferSource();
      src.buffer = file;
      src.connect(this.sfxGain);
      src.start();
      return;
    }

    const t0 = this.ctx.currentTime;
    for (const note of CUES[cue]) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = note.type ?? "sine";
      osc.frequency.value = note.freq;
      const peak = note.gain ?? 0.22;
      env.gain.setValueAtTime(0, t0 + note.at);
      env.gain.linearRampToValueAtTime(peak, t0 + note.at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + note.at + note.dur);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(t0 + note.at);
      osc.stop(t0 + note.at + note.dur + 0.05);
    }
  }

  private startMusicLoop(): void {
    if (!this.ctx || this.musicTimer) return;
    const playChord = () => {
      if (!this.ctx || !this.musicGain || this.muted || !this.musicOn) return;
      const chord = MUSIC_CHORDS[this.musicStep % MUSIC_CHORDS.length]!;
      const t0 = this.ctx.currentTime;
      chord.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const env = this.ctx!.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const at = t0 + i * 0.35;
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(0.16, at + 0.4);
        env.gain.linearRampToValueAtTime(0.0001, at + 2.6);
        osc.connect(env);
        env.connect(this.musicGain!);
        osc.start(at);
        osc.stop(at + 2.8);
      });
      this.musicStep++;
    };
    playChord();
    this.musicTimer = setInterval(playChord, 3000);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

/** App-wide singleton (client only). */
export const audio = new AudioManager();
