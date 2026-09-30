import { AudioPlaybackState } from '../types/bell';

type PlaybackListener = (state: AudioPlaybackState) => void;

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private isArmedState: boolean = false;
  private isStopping: boolean = false;
  private activeSinkId: string = 'default';

  private playbackState: AudioPlaybackState = {
    isPlaying: false,
    currentEventName: null,
    currentPhase: 'idle',
    currentAnnouncementName: null,
    currentIteration: 0,
    totalIterations: 0,
    sourceType: 'schedule',
  };

  private listeners: Set<PlaybackListener> = new Set();

  constructor() {
    // Check if user previously interacted in this session
    if (typeof window !== 'undefined') {
      const storedArmed = sessionStorage.getItem('PA_AUDIO_ARMED');
      if (storedArmed === 'true') {
        this.armAudioEngine().catch(() => {});
      }
    }
  }

  // -------------------------------------------------------------
  // Audio Context Initialization & Arming
  // -------------------------------------------------------------

  public async armAudioEngine(): Promise<boolean> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return false;
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64;

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Play an imperceptible micro-blip (0.001 amplitude for 10ms) to ensure audio hardware wakes up
      const osc = this.audioCtx.createOscillator();
      const clickGain = this.audioCtx.createGain();
      clickGain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.00001, this.audioCtx.currentTime + 0.05);
      osc.connect(clickGain);
      clickGain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);

      this.isArmedState = true;
      sessionStorage.setItem('PA_AUDIO_ARMED', 'true');
      this.notifyListeners();
      return true;
    } catch (err) {
      console.error('Failed to arm Web Audio Engine:', err);
      return false;
    }
  }

  public isArmed(): boolean {
    return this.isArmedState && this.audioCtx !== null && this.audioCtx.state === 'running';
  }

  public setMasterVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.volume = clamped;
    }
  }

  public async setAudioOutputDevice(sinkId: string): Promise<boolean> {
    this.activeSinkId = sinkId;
    if (this.currentAudioElement && (this.currentAudioElement as any).setSinkId) {
      try {
        await (this.currentAudioElement as any).setSinkId(sinkId);
        return true;
      } catch (e) {
        console.warn('Could not set sinkId on audio element:', e);
      }
    }

    if (this.audioCtx && (this.audioCtx as any).setSinkId) {
      try {
        await (this.audioCtx as any).setSinkId(sinkId);
        return true;
      } catch (e) {
        console.warn('Could not set sinkId on audio context:', e);
      }
    }
    return false;
  }

  public async getAvailableAudioDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audiooutput');
    } catch (e) {
      console.warn('Failed to enumerate audio devices:', e);
      return [];
    }
  }

  // -------------------------------------------------------------
  // Real Playback Logic (Single or Repeat Sequence)
  // -------------------------------------------------------------

  public async playBellSequence(params: {
    eventName: string;
    soundUrl?: string | null;
    soundFormat?: string;
    announcementUrl?: string | null;
    announcementName?: string | null;
    announcementDelaySec?: number;
    repeatCount: number;
    repeatIntervalSec: number;
    sourceType?: 'schedule' | 'manual';
    volume?: number;
  }): Promise<boolean> {
    // Ensure audio engine is armed
    if (!this.isArmed()) {
      const armed = await this.armAudioEngine();
      if (!armed) {
        console.warn('Playback blocked by browser audio policy. User interaction required.');
      }
    }

    this.isStopping = false;
    const total = Math.max(1, params.repeatCount || 1);
    const intervalMs = Math.max(0, (params.repeatIntervalSec || 2) * 1000);
    const vol = typeof params.volume === 'number' ? params.volume : 1.0;
    const announcementDelayMs = Math.max(0, (params.announcementDelaySec ?? 1) * 1000);

    this.playbackState = {
      isPlaying: true,
      currentEventName: params.eventName,
      currentPhase: 'bell',
      currentAnnouncementName: params.announcementName || null,
      currentIteration: 0,
      totalIterations: total,
      sourceType: params.sourceType || 'schedule',
    };
    this.notifyListeners();

    try {
      // ---------------------------------------------------------
      // STAGE 1: Bell Chime Rings First
      // ---------------------------------------------------------
      for (let i = 1; i <= total; i++) {
        if (this.isStopping) break;

        this.playbackState.currentPhase = 'bell';
        this.playbackState.currentIteration = i;
        this.notifyListeners();

        if (params.soundUrl && params.soundUrl.trim() !== '') {
          await this.playAudioUrl(params.soundUrl, vol);
        } else {
          console.warn(`No audio file URL configured for bell event: ${params.eventName}`);
        }

        if (i < total && !this.isStopping) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }

      // ---------------------------------------------------------
      // STAGE 2: Voice Announcement Follows Second
      // ---------------------------------------------------------
      if (params.announcementUrl && params.announcementUrl.trim() !== '' && !this.isStopping) {
        if (announcementDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, announcementDelayMs));
        }

        if (!this.isStopping) {
          this.playbackState.currentPhase = 'announcement';
          this.notifyListeners();

          await this.playAudioUrl(params.announcementUrl, vol);
        }
      }

      return true;
    } catch (err) {
      console.error('Error during bell sequence playback:', err);
      return false;
    } finally {
      this.playbackState = {
        isPlaying: false,
        currentEventName: null,
        currentPhase: 'idle',
        currentAnnouncementName: null,
        currentIteration: 0,
        totalIterations: 0,
        sourceType: 'schedule',
      };
      this.isStopping = false;
      this.notifyListeners();
    }
  }

  // Play an actual audio file from URL
  public playAudioUrl(url: string, volume: number = 1.0): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(url);
        this.currentAudioElement = audio;
        audio.volume = Math.max(0, Math.min(1, volume));

        if (this.activeSinkId && (audio as any).setSinkId) {
          (audio as any).setSinkId(this.activeSinkId).catch(() => {});
        }

        audio.onended = () => {
          this.currentAudioElement = null;
          resolve();
        };

        audio.onerror = (e) => {
          console.error('HTMLAudioElement error for url:', url, e);
          this.currentAudioElement = null;
          reject(new Error(`Failed to load audio file at ${url}`));
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((playErr) => {
            console.warn('Audio play() failed (autoplay policy or load error):', playErr);
            reject(playErr);
          });
        }
      } catch (err) {
        console.error('Audio initialization error:', err);
        reject(err);
      }
    });
  }

  // -------------------------------------------------------------
  // Real Synthesized Acoustic School Brass Bell & Westminster Chime
  // Used as guaranteed instant audio check / fallback
  // -------------------------------------------------------------

  public async playSynthesizedAcousticBell(volume: number = 0.9): Promise<void> {
    if (!this.audioCtx) {
      await this.armAudioEngine();
    }
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const duration = 2.4;

    // A real bronze/brass bell has distinct non-harmonic partials:
    // Hum tone (0.5x), Prime / Fundamental (1.0x), Tierce / Minor Third (1.2x), Quint / Fifth (1.5x), Nominal / Octave (2.0x)
    const baseFreq = 587.33; // D5 tone (standard bright school bell strike)
    const partials = [
      { ratio: 0.5, gain: 0.35, decay: 2.2 },   // Hum tone
      { ratio: 1.0, gain: 0.8, decay: 1.8 },    // Fundamental
      { ratio: 1.19, gain: 0.5, decay: 1.5 },   // Minor third
      { ratio: 1.5, gain: 0.4, decay: 1.2 },    // Fifth
      { ratio: 2.0, gain: 0.6, decay: 0.9 },    // Nominal octave
      { ratio: 2.76, gain: 0.25, decay: 0.6 },  // Super-nominal
      { ratio: 4.07, gain: 0.15, decay: 0.3 },  // Strike transient
    ];

    const bellMaster = this.audioCtx.createGain();
    bellMaster.gain.setValueAtTime(volume, now);
    bellMaster.connect(this.masterGain || this.audioCtx.destination);

    partials.forEach(({ ratio, gain, decay }) => {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const partialGain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratio, now);

      // Strike envelope: instant attack + exponential decay
      partialGain.gain.setValueAtTime(0, now);
      partialGain.gain.linearRampToValueAtTime(gain, now + 0.005);
      partialGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(partialGain);
      partialGain.connect(bellMaster);

      osc.start(now);
      osc.stop(now + decay);
    });

    return new Promise(resolve => setTimeout(resolve, duration * 1000));
  }

  // Play two-tone electronic PA chime (High Gong -> Low Gong)
  public async playElectronicTwoToneChime(volume: number = 0.9): Promise<void> {
    if (!this.audioCtx) {
      await this.armAudioEngine();
    }
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const playTone = (freq: number, startTime: number, duration: number) => {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.7, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain || this.audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = this.audioCtx.currentTime;
    playTone(659.25, now, 0.8);        // E5
    playTone(523.25, now + 0.45, 1.2); // C5

    return new Promise(resolve => setTimeout(resolve, 1800));
  }

  // Stop active playback immediately (emergency pause/mute)
  public stopPlayback() {
    this.isStopping = true;
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch (e) {}
      this.currentAudioElement = null;
    }

    this.playbackState = {
      isPlaying: false,
      currentEventName: null,
      currentPhase: 'idle',
      currentAnnouncementName: null,
      currentIteration: 0,
      totalIterations: 0,
      sourceType: 'schedule',
    };
    this.notifyListeners();
  }

  public getVisualizerData(): Uint8Array | null {
    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.playbackState);
    return () => this.listeners.delete(listener);
  }

  public getPlaybackState(): AudioPlaybackState {
    return this.playbackState;
  }

  private notifyListeners() {
    this.listeners.forEach(fn => fn({ ...this.playbackState }));
  }
}

export const audioEngine = new AudioEngine();
