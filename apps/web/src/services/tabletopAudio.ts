export type TabletopSound = 'pick' | 'chip' | 'card' | 'noble' | 'turn';

/** Small synthesized tactile cues: no downloads, microphones, or external audio. */
export class TabletopAudio {
  private context: AudioContext | null = null;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch { /* Sound is optional. */ }
  }
  play(kind: TabletopSound) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    const frequencies = { pick: [460], chip: [760, 1120], card: [180, 260], noble: [523, 659, 784], turn: [392, 523] }[kind];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * .045;
      oscillator.type = kind === 'card' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .65, start + .09);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.035, start + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .14);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + .15);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
  close() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
