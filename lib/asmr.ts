// Clean, Noise-Free Procedural ASMR Sound Synthesizer using Web Audio API
// Zero continuous white/pink/brown static noise: crystal-clear background with gentle, organic acoustic events.

export type ASMRType = "off" | "fireplace" | "rain" | "snow" | "cafe" | "waves";

export interface ASMRConfig {
  id: ASMRType;
  name: string;
  emoji: string;
  desc: string;
  badge: string;
}

export const ASMR_LIST: ASMRConfig[] = [
  { id: "off", name: "배경음 끄기", emoji: "🔇", desc: "배경음 없이 대화에만 집중합니다", badge: "OFF" },
  { id: "fireplace", name: "장작 타는 소리", emoji: "🔥", desc: "백색소음 없이 깨끗한 배경에 은은하게 타닥거리는 장작불 소리", badge: "추천" },
  { id: "rain", name: "포근한 빗소리", emoji: "🌧️", desc: "깨끗한 배경 위 창가와 나뭇잎에 똑똑 떨어지는 맑은 빗방울 소리", badge: "인기" },
  { id: "snow", name: "눈 오는 밤", emoji: "❄️", desc: "고요한 겨울밤 사르르 내려앉는 맑고 포근한 눈꽃 오르골 울림", badge: "겨울" },
  { id: "cafe", name: "카페 라운지", emoji: "☕", desc: "은은한 로파이 재즈 피아노 화음과 가끔 들리는 찻잔 소리", badge: "감성" },
  { id: "waves", name: "밤바다 물결", emoji: "🌊", desc: "고요한 밤바다에 잔잔하게 밀려왔다 사라지는 맑은 물결 소리", badge: "힐링" },
];

export class ASMRSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentType: ASMRType = "off";
  private volume: number = 0.25; // default 25%
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];
  private timerIds: (number | NodeJS.Timeout)[] = [];

  constructor() {
    // Lazy init AudioContext on first user interaction
  }

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = null;

      const tryResume = () => {
        if (this.ctx && this.ctx.state === "suspended" && this.currentType !== "off") {
          this.ctx.resume().catch(() => {});
        }
      };
      window.addEventListener("pointerdown", tryResume, { passive: true });
      window.addEventListener("keydown", tryResume, { passive: true });
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      // Overall master scaling kept gentle so voice chat is always crystal clear
      this.masterGain.gain.setValueAtTime(this.volume * 0.55, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.55, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentType(): ASMRType {
    return this.currentType;
  }

  public stop() {
    this.timerIds.forEach((t) => {
      clearTimeout(t as any);
      clearInterval(t as any);
    });
    this.timerIds = [];

    this.activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
    this.currentType = "off";
  }

  public async setType(type: ASMRType) {
    this.stop();
    this.currentType = type;

    if (type === "off") return;

    const ctx = this.initContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const soundBus = ctx.createGain();
    soundBus.gain.setValueAtTime(1.0, ctx.currentTime);
    soundBus.connect(this.masterGain!);
    this.activeNodes.push(soundBus);

    switch (type) {
      case "fireplace":
        this.startFireplace(ctx, soundBus);
        break;
      case "rain":
        this.startRain(ctx, soundBus);
        break;
      case "snow":
        this.startSnow(ctx, soundBus);
        break;
      case "cafe":
        this.startCafe(ctx, soundBus);
        break;
      case "waves":
        this.startWaves(ctx, soundBus);
        break;
    }
  }

  // 장작 한 번 타닥/톡 튀는 개별 사운드 생성 (지속적인 백색소음 전혀 없음)
  private playWoodSnap(ctx: AudioContext, destination: AudioNode, timeOffset = 0, intensity = 1.0) {
    const now = ctx.currentTime + timeOffset;

    // 1) 나무 결이 갈라지는 짧은 우드 공명음 (Sine pitch drop: 똑 / 탁)
    const woodOsc = ctx.createOscillator();
    const woodGain = ctx.createGain();
    woodOsc.type = "triangle";
    const baseFreq = 260 + Math.random() * 520;
    woodOsc.frequency.setValueAtTime(baseFreq, now);
    woodOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.28, now + 0.028);

    const woodVol = (0.08 + Math.random() * 0.1) * intensity;
    woodGain.gain.setValueAtTime(0.0001, now);
    woodGain.gain.linearRampToValueAtTime(woodVol, now + 0.002);
    woodGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);

    woodOsc.connect(woodGain);
    woodGain.connect(destination);
    woodOsc.start(now);
    woodOsc.stop(now + 0.036);

    // 2) 불꽃 스파크가 톡 튀는 극초단파(6~14ms) 클린 스냅
    const snapDuration = 0.006 + Math.random() * 0.009;
    const snapLen = Math.max(16, Math.floor(ctx.sampleRate * snapDuration));
    const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
    const data = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      const env = Math.sin((Math.PI * i) / snapLen) * Math.exp(-i / (snapLen * 0.35));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const snapSrc = ctx.createBufferSource();
    snapSrc.buffer = snapBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1600 + Math.random() * 1800, now);
    bp.Q.setValueAtTime(4.5, now);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3400, now);

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime((0.12 + Math.random() * 0.14) * intensity, now);

    snapSrc.connect(bp);
    bp.connect(lp);
    lp.connect(snapGain);
    snapGain.connect(destination);
    snapSrc.start(now);
  }

  // 1. 장작 타는 소리 (지속 백색소음 ZERO, 고요한 배경 위에 은은하게 타닥거리는 장작불 소리)
  private startFireplace(ctx: AudioContext, destination: AudioNode) {
    const scheduleNextCrackleCluster = () => {
      if (this.currentType !== "fireplace" || !this.ctx) return;
      const now = this.ctx.currentTime;

      // 가끔 묵직한 장작 속울림 (부드러운 저음 툭 소리)
      if (Math.random() < 0.25) {
        const emberOsc = this.ctx.createOscillator();
        const emberGain = this.ctx.createGain();
        emberOsc.type = "sine";
        const startF = 110 + Math.random() * 50;
        emberOsc.frequency.setValueAtTime(startF, now);
        emberOsc.frequency.exponentialRampToValueAtTime(42, now + 0.065);

        emberGain.gain.setValueAtTime(0.0001, now);
        emberGain.gain.linearRampToValueAtTime(0.11 + Math.random() * 0.07, now + 0.005);
        emberGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

        emberOsc.connect(emberGain);
        emberGain.connect(destination);
        emberOsc.start(now);
        emberOsc.stop(now + 0.08);
      }

      // 1~3번 연속으로 타닥-탁 튀는 자연스러운 장작 패턴
      const count = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < count; i++) {
        const offset = i === 0 ? 0 : 0.035 + Math.random() * 0.09 * i;
        const inten = i === 0 ? 0.85 + Math.random() * 0.3 : 0.45 + Math.random() * 0.4;
        this.playWoodSnap(this.ctx, destination, offset, inten);
      }

      // 고요한 여백을 두고 은은하게 반복 (180ms ~ 950ms 간격)
      const nextDelay = 180 + Math.random() * 770;
      const tid = setTimeout(scheduleNextCrackleCluster, nextDelay);
      this.timerIds.push(tid);
    };

    scheduleNextCrackleCluster();
  }

  // 빗방울 1개가 떨어지는 맑은 물방울 음향 합성 (지속 백색소음 ZERO)
  private playRainDrop(
    ctx: AudioContext,
    destination: AudioNode,
    timeOffset = 0,
    style: "window" | "leaf" | "puddle" = "window"
  ) {
    const now = ctx.currentTime + timeOffset;

    if (style === "puddle") {
      // 물웅덩이/처마 끝에 똑 떨어지는 맑은 물방울 공명 (고전 물방울 음향: 짧은 상향 피치 엔벨로프)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const baseF = 680 + Math.random() * 620;
      osc.frequency.setValueAtTime(baseF, now);
      osc.frequency.exponentialRampToValueAtTime(baseF * 1.42, now + 0.032);

      const vol = 0.035 + Math.random() * 0.055;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.042);
    } else if (style === "window") {
      // 창문/지붕에 토독 부딪히는 부드럽고 둥근 빗방울 소리
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const startF = 320 + Math.random() * 420;
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(startF * 0.55, now + 0.022);

      const vol = 0.03 + Math.random() * 0.05;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);

      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } else {
      // 나뭇잎에 사락/톡 스치는 촉촉한 빗방울 (극초단파 8ms 소프트 필터 탭)
      const tapLen = Math.max(16, Math.floor(ctx.sampleRate * 0.009));
      const tapBuf = ctx.createBuffer(1, tapLen, ctx.sampleRate);
      const data = tapBuf.getChannelData(0);
      for (let i = 0; i < tapLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (tapLen * 0.3));
      }

      const src = ctx.createBufferSource();
      src.buffer = tapBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(950 + Math.random() * 900, now);
      filter.Q.setValueAtTime(5.0, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.04 + Math.random() * 0.05, now);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      src.start(now);
    }
  }

  // 2. 포근한 빗소리 (지속적인 치지직 백색소음 ZERO! 깨끗한 배경에 빗물이 토독토독 떨어지는 소리)
  private startRain(ctx: AudioContext, destination: AudioNode) {
    const scheduleDrops = () => {
      if (this.currentType !== "rain" || !this.ctx) return;

      // 한 주기에 1~3개의 물방울이 시차를 두고 토독.. 똑.. 떨어짐
      const dropCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < dropCount; i++) {
        const offset = Math.random() * 0.08;
        const r = Math.random();
        const style: "window" | "leaf" | "puddle" =
          r < 0.45 ? "window" : r < 0.78 ? "puddle" : "leaf";
        this.playRainDrop(this.ctx, destination, offset, style);
      }

      // 70ms ~ 240ms 간격으로 자연스러운 빗방울 리듬 유지
      const nextDelay = 70 + Math.random() * 170;
      const tid = setTimeout(scheduleDrops, nextDelay);
      this.timerIds.push(tid);
    };

    scheduleDrops();
  }

  // 3. 눈 오는 밤 (백색소음 ZERO, 고요한 겨울밤에 은은하게 울리는 맑은 크리스탈 벨/오르골 하모닉스)
  private startSnow(ctx: AudioContext, destination: AudioNode) {
    // 펜타토닉 맑은 종소리 음계 (F major pentatonic: F4, G4, A4, C5, D5, F5, G5, A5)
    const notes = [349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99, 880.0];

    const triggerSnowChime = () => {
      if (this.currentType !== "snow" || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = notes[Math.floor(Math.random() * notes.length)];

      const osc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(freq * 0.5, now);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.25, now);
      subOsc.connect(subGain);

      const peakVol = 0.03 + Math.random() * 0.035;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peakVol, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

      osc.connect(gain);
      subGain.connect(gain);
      gain.connect(destination);

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 2.9);
      subOsc.stop(now + 2.9);

      const nextDelay = 1200 + Math.random() * 2200;
      const tid = setTimeout(triggerSnowChime, nextDelay);
      this.timerIds.push(tid);
    };

    triggerSnowChime();
  }

  // 4. 카페 라운지 (백색소음 ZERO, 포근한 로파이 재즈 일렉트릭 피아노 화음 + 가끔 들리는 찻잔 달그락 소리)
  private startCafe(ctx: AudioContext, destination: AudioNode) {
    // 따뜻한 재즈 메이저7/마이너7 코드 진행 (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
    const chords = [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
    ];
    let chordIdx = 0;

    const playSoftChord = () => {
      if (this.currentType !== "cafe" || !this.ctx) return;
      const now = this.ctx.currentTime;
      const chord = chords[chordIdx % chords.length];
      chordIdx++;

      chord.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        // 살짝 아르페지오처럼 부드럽게 짚는 느낌
        const noteStart = now + idx * 0.06;
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.018, noteStart + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 4.2);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(noteStart);
        osc.stop(noteStart + 4.3);
      });

      const tid = setTimeout(playSoftChord, 4400);
      this.timerIds.push(tid);
    };

    // 커피잔 / 티스푼이 살짝 닿는 맑고 작은 도자기 소리
    const triggerCupClink = () => {
      if (this.currentType !== "cafe" || !this.ctx) return;
      const now = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const clinkGain = this.ctx.createGain();

      const base = 1850 + Math.random() * 550;
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(base, now);
      osc2.frequency.setValueAtTime(base * 1.58, now);

      const vol = 0.025 + Math.random() * 0.025;
      clinkGain.gain.setValueAtTime(0.0001, now);
      clinkGain.gain.linearRampToValueAtTime(vol, now + 0.003);
      clinkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      osc1.connect(clinkGain);
      osc2.connect(clinkGain);
      clinkGain.connect(destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.09);
      osc2.stop(now + 0.09);

      const nextDelay = 3000 + Math.random() * 5000;
      const tid = setTimeout(triggerCupClink, nextDelay);
      this.timerIds.push(tid);
    };

    playSoftChord();
    triggerCupClink();
  }

  // 5. 밤바다 물결 (지속 백색소음 ZERO, 고요한 밤바다에 찰랑이는 물방울과 부드러운 심해 공명)
  private startWaves(ctx: AudioContext, destination: AudioNode) {
    // 찰랑이는 물결 방울 소리 + 부드러운 바다 하모닉 패드 호흡
    const playWaveCycle = () => {
      if (this.currentType !== "waves" || !this.ctx) return;
      const now = this.ctx.currentTime;

      // 은은한 심해 공명 (5초간 부드럽게 들어왔다 완전히 사라짐)
      const padOsc1 = this.ctx.createOscillator();
      const padOsc2 = this.ctx.createOscillator();
      const padGain = this.ctx.createGain();

      padOsc1.type = "sine";
      padOsc2.type = "sine";
      padOsc1.frequency.setValueAtTime(130.81, now); // C3
      padOsc2.frequency.setValueAtTime(196.0, now);  // G3

      padGain.gain.setValueAtTime(0.0001, now);
      padGain.gain.linearRampToValueAtTime(0.022, now + 1.8);
      padGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.8);

      padOsc1.connect(padGain);
      padOsc2.connect(padGain);
      padGain.connect(destination);

      padOsc1.start(now);
      padOsc2.start(now);
      padOsc1.stop(now + 4.9);
      padOsc2.stop(now + 4.9);

      // 물결이 밀려온 뒤 자갈/모래 위에서 찰랑거리는 물방울 소리 4~7개
      const lapCount = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < lapCount; i++) {
        const offset = 0.8 + i * (0.35 + Math.random() * 0.25);
        this.playRainDrop(this.ctx, destination, offset, i % 2 === 0 ? "puddle" : "window");
      }

      const nextDelay = 5200 + Math.random() * 1800;
      const tid = setTimeout(playWaveCycle, nextDelay);
      this.timerIds.push(tid);
    };

    playWaveCycle();
  }
}

// Global Singleton Instance (browser-only)
let asmrInstance: ASMRSynthesizer | null = null;
export function getASMRSynthesizer(): ASMRSynthesizer {
  if (typeof window === "undefined") {
    return new ASMRSynthesizer();
  }
  if (!asmrInstance) {
    asmrInstance = new ASMRSynthesizer();
  }
  return asmrInstance;
}
