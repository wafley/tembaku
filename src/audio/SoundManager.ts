import { events } from '../core/EventBus';

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  masterVolume = 0.8;
  isMuted = false;

  constructor() {
    const savedVol = localStorage.getItem('tembaku_volume');
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        this.masterVolume = parsed;
      }
    }

    const savedMute = localStorage.getItem('tembaku_muted');
    if (savedMute !== null) {
      this.isMuted = savedMute === 'true';
    }

    this.initEventListeners();
  }

  private getEffectiveGain(): number {
    if (this.isMuted) return 0;
    return this.masterVolume * 0.5;
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem('tembaku_volume', String(this.masterVolume));
    } catch {}

    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.getEffectiveGain(), this.ctx.currentTime);
    }
  }

  setMute(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem('tembaku_muted', String(this.isMuted));
    } catch {}

    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.getEffectiveGain(), this.ctx.currentTime);
    }
  }

  toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  private initEventListeners(): void {
    events.on('sound:shoot', () => this.playShoot());
    events.on('sound:hit_enemy', () => this.playHitEnemy());
    events.on('sound:enemy_shoot', () => this.playEnemyShoot());
    events.on('sound:player_hit', () => this.playPlayerHit());
    events.on('sound:explosion', () => this.playExplosion());
    events.on('sound:reload', () => this.playReload());
    events.on('sound:empty', () => this.playEmpty());
    events.on('sound:empty_warning', () => this.playEmptyWarning());
    events.on('sound:jump', () => this.playJump());
    events.on('sound:footstep', () => this.playFootstep());
    events.on('sound:wave_alert', () => this.playWaveAlert());
    events.on('sound:flawless', () => this.playFlawless());
    events.on('sound:heal', () => this.playHeal());
    events.on('sound:boss_warning', () => this.playBossWarning());
    events.on('sound:boss_shoot', () => this.playBossShoot());
    events.on('sound:heartbeat', () => this.playHeartbeat());
  }

  init(): void {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.getEffectiveGain(), this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playShoot(): void {
    if (!this.initialized) this.init();
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.12);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);

    this.playNoiseBurst(0.04, 0.25, 1200);
  }

  playHitEnemy(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  playEnemyShoot(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.22);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.23);
  }

  playPlayerHit(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.26);

    this.playNoiseBurst(0.18, 0.4, 500);
  }

  playExplosion(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);

    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.52);

    this.playNoiseBurst(0.5, 0.5, 600);
  }

  playReload(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(600, t);
    osc1.frequency.exponentialRampToValueAtTime(300, t + 0.08);
    gain1.gain.setValueAtTime(0.2, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.09);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(250, t + 0.35);
    osc2.frequency.exponentialRampToValueAtTime(800, t + 0.7);
    gain2.gain.setValueAtTime(0.001, t + 0.35);
    gain2.gain.linearRampToValueAtTime(0.18, t + 0.55);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t + 0.35);
    osc2.stop(t + 0.73);

    const osc3 = this.ctx.createOscillator();
    const gain3 = this.ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(900, t + 0.75);
    osc3.frequency.exponentialRampToValueAtTime(450, t + 0.85);
    gain3.gain.setValueAtTime(0.3, t + 0.75);
    gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    osc3.connect(gain3);
    gain3.connect(this.masterGain);
    osc3.start(t + 0.75);
    osc3.stop(t + 0.86);
  }

  playEmpty(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playJump(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.12);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playFootstep(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.08);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playWaveAlert(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.1);
      gain.gain.setValueAtTime(0.12, t + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.1);
      osc.stop(t + idx * 0.1 + 0.36);
    });
  }

  playFlawless(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      gain.gain.setValueAtTime(0.28, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.38);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.39);
    });
  }

  playHeal(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const notes = [330, 440, 554, 659, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);
      gain.gain.setValueAtTime(0.2, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.26);
    });
  }

  playBossWarning(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t + i * 0.4);
      osc.frequency.linearRampToValueAtTime(80, t + i * 0.4 + 0.35);

      gain.gain.setValueAtTime(0.35, t + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.4 + 0.38);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.4);
      osc.stop(t + i * 0.4 + 0.39);
    }
  }

  playBossShoot(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.28);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.29);
    this.playNoiseBurst(0.1, 0.3, 400);
  }

  playHeartbeat(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65, t);
    osc1.frequency.exponentialRampToValueAtTime(30, t + 0.14);
    gain1.gain.setValueAtTime(0.45, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.15);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(55, t + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(25, t + 0.36);
    gain2.gain.setValueAtTime(0.35, t + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t + 0.2);
    osc2.stop(t + 0.37);
  }

  playEmptyWarning(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.setValueAtTime(450, t + 0.06);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private playNoiseBurst(duration: number, volume: number, filterCutoff: number): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    noise.stop(this.ctx.currentTime + duration);
  }
}

export const sound = new SoundManager();
