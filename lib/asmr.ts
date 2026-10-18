// Procedural ASMR Sound Synthesizer using Web Audio API
// Runs completely client-side: 0 bandwidth, zero external assets, infinite loop, no audio bleeding into mic.

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
  { id: "fireplace", name: "장작 타는 소리", emoji: "🔥", desc: "따뜻한 벽난로 속 타닥거리는 장작불 소리", badge: "추천" },
  { id: "rain", name: "포근한 빗소리", emoji: "🌧️", desc: "창문을 촉촉하게 적시는 잔잔하고 차분한 빗소리", badge: "인기" },
  { id: "snow", name: "눈 오는 소리", emoji: "❄️", desc: "소복이 쌓이는 눈길 위 평화롭고 고요한 겨울 바람", badge: "겨울" },
  { id: "cafe", name: "카페 라운지", emoji: "☕", desc: "따스한 조명 아래 나지막한 커피 하우스 분위기", badge: "감성" },
  { id: "waves", name: "밤바다 파도", emoji: "🌊", desc: "잔잔히 밀려왔다 시원하게 부서지는 밤 파도소리", badge: "힐링" },
];

function createPinkNoiseBuffer(ctx: AudioContext, seconds = 5): AudioBuffer {
  const bufferSize = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
    b6 = white * 0.115926;
  }
  return buffer;
}

function createBrownNoiseBuffer(ctx: AudioContext, seconds = 5): AudioBuffer {
  const bufferSize = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 3.2;
  }
  return buffer;
}

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
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentType(): ASMRType {
    return this.currentType;
  }

  public stop() {
    this.timerIds.forEach((t) => clearInterval(t as any));
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

  // 1. 장작 타는 소리 (벽난로 로우엔드 럼블 + 타닥거리는 크랙/스파크 팝)
  private startFireplace(ctx: AudioContext, destination: AudioNode) {
    // 로우엔드 불길 럼블 베이스
    const brownBuffer = createBrownNoiseBuffer(ctx, 4);
    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = brownBuffer;
    rumbleSource.loop = true;

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.setValueAtTime(260, ctx.currentTime);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.7, ctx.currentTime);

    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(destination);

    rumbleSource.start();
    this.activeNodes.push(rumbleSource, rumbleGain);

    // 타닥거리는 장작 크랙/불꽃 튀는 소리
    const triggerCrackle = () => {
      if (this.currentType !== "fireplace" || !this.ctx) return;
      const now = this.ctx.currentTime;
      const isThud = Math.random() < 0.18; // 묵직한 장작 갈라짐 vs 가벼운 불꽃 튐

      if (isThud) {
        // 장작 터지는 묵직한 퍽 소리
        const osc = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(120 + Math.random() * 40, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

        thudGain.gain.setValueAtTime(0.5 * (0.6 + Math.random() * 0.4), now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(thudGain);
        thudGain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else {
        // 타닥 불꽃 파열음
        const crackleLen = Math.floor(ctx.sampleRate * (0.015 + Math.random() * 0.025));
        const crackleBuf = ctx.createBuffer(1, crackleLen, ctx.sampleRate);
        const data = crackleBuf.getChannelData(0);
        for (let i = 0; i < crackleLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (crackleLen * 0.25));
        }

        const crackleSrc = ctx.createBufferSource();
        crackleSrc.buffer = crackleBuf;

        const crackleFilter = ctx.createBiquadFilter();
        crackleFilter.type = "bandpass";
        crackleFilter.frequency.setValueAtTime(1400 + Math.random() * 2600, now);
        crackleFilter.Q.setValueAtTime(3.0, now);

        const crackleGain = ctx.createGain();
        const crackleVol = (0.25 + Math.random() * 0.75) * 0.45;
        crackleGain.gain.setValueAtTime(crackleVol, now);

        crackleSrc.connect(crackleFilter);
        crackleFilter.connect(crackleGain);
        crackleGain.connect(destination);

        crackleSrc.start(now);
      }

      // 다음 크랙 무작위 타이밍 스케줄링 (60ms ~ 280ms)
      const nextDelay = 60 + Math.random() * 220;
      const tid = setTimeout(triggerCrackle, nextDelay);
      this.timerIds.push(tid);
    };

    triggerCrackle();
  }

  // 2. 포근한 빗소리 (부드러운 연속 레인 베드 + 촉촉한 물방울 텍스처)
  private startRain(ctx: AudioContext, destination: AudioNode) {
    const pinkBuffer = createPinkNoiseBuffer(ctx, 5);

    // 1층: 중저음 잔잔한 비
    const rainLowSrc = ctx.createBufferSource();
    rainLowSrc.buffer = pinkBuffer;
    rainLowSrc.loop = true;

    const rainLowFilter = ctx.createBiquadFilter();
    rainLowFilter.type = "lowpass";
    rainLowFilter.frequency.setValueAtTime(1100, ctx.currentTime);

    const rainLowGain = ctx.createGain();
    rainLowGain.gain.setValueAtTime(0.55, ctx.currentTime);

    rainLowSrc.connect(rainLowFilter);
    rainLowFilter.connect(rainLowGain);
    rainLowGain.connect(destination);
    rainLowSrc.start();
    this.activeNodes.push(rainLowSrc, rainLowGain);

    // 2층: 촉촉한 창문 물방울 고음
    const rainHighSrc = ctx.createBufferSource();
    rainHighSrc.buffer = pinkBuffer;
    rainHighSrc.loop = true;

    const rainHighFilter = ctx.createBiquadFilter();
    rainHighFilter.type = "bandpass";
    rainHighFilter.frequency.setValueAtTime(2400, ctx.currentTime);
    rainHighFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    const rainHighGain = ctx.createGain();
    rainHighGain.gain.setValueAtTime(0.35, ctx.currentTime);

    // 잔잔한 비바람 변화 LFO
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.18, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.08, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(rainHighGain.gain);
    lfo.start();

    rainHighSrc.connect(rainHighFilter);
    rainHighFilter.connect(rainHighGain);
    rainHighGain.connect(destination);
    rainHighSrc.start();
    this.activeNodes.push(rainHighSrc, rainHighGain, lfo);
  }

  // 3. 눈 오는 소리 (고요하고 적막한 겨울바람 + 흩날리는 눈의 부드러운 스위핑)
  private startSnow(ctx: AudioContext, destination: AudioNode) {
    const pinkBuffer = createPinkNoiseBuffer(ctx, 6);
    const brownBuffer = createBrownNoiseBuffer(ctx, 6);

    // 적막한 겨울 대지의 차분한 저음
    const groundSrc = ctx.createBufferSource();
    groundSrc.buffer = brownBuffer;
    groundSrc.loop = true;

    const groundFilter = ctx.createBiquadFilter();
    groundFilter.type = "lowpass";
    groundFilter.frequency.setValueAtTime(180, ctx.currentTime);

    const groundGain = ctx.createGain();
    groundGain.gain.setValueAtTime(0.45, ctx.currentTime);

    groundSrc.connect(groundFilter);
    groundFilter.connect(groundGain);
    groundGain.connect(destination);
    groundSrc.start();
    this.activeNodes.push(groundSrc, groundGain);

    // 나뭇가지를 스쳐 지나가는 잔잔한 겨울 바람
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = pinkBuffer;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.setValueAtTime(450, ctx.currentTime);
    windFilter.Q.setValueAtTime(2.8, ctx.currentTime);

    // 바람의 느린 파동 (LFO 0.1Hz)
    const windLfo = ctx.createOscillator();
    const windLfoGain = ctx.createGain();
    windLfo.frequency.setValueAtTime(0.09, ctx.currentTime);
    windLfoGain.gain.setValueAtTime(180, ctx.currentTime);
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.5, ctx.currentTime);

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(destination);
    windSrc.start();
    this.activeNodes.push(windSrc, windGain, windLfo);
  }

  // 4. 카페 라운지 (나지막한 웅성임 베이스 + 가끔 들리는 커피잔 달그락)
  private startCafe(ctx: AudioContext, destination: AudioNode) {
    const pinkBuffer = createPinkNoiseBuffer(ctx, 5);

    // 아늑한 카페 실내 베이스 웅성임
    const murmurSrc = ctx.createBufferSource();
    murmurSrc.buffer = pinkBuffer;
    murmurSrc.loop = true;

    const murmurFilter = ctx.createBiquadFilter();
    murmurFilter.type = "lowpass";
    murmurFilter.frequency.setValueAtTime(420, ctx.currentTime);

    const murmurGain = ctx.createGain();
    murmurGain.gain.setValueAtTime(0.6, ctx.currentTime);

    murmurSrc.connect(murmurFilter);
    murmurFilter.connect(murmurGain);
    murmurGain.connect(destination);
    murmurSrc.start();
    this.activeNodes.push(murmurSrc, murmurGain);

    // 커피잔 / 스푼이 부딪히는 맑은 소리 (가끔 발생)
    const triggerCupChime = () => {
      if (this.currentType !== "cafe" || !this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();

      const freq = 1900 + Math.random() * 800;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      const vol = 0.08 + Math.random() * 0.08;
      chimeGain.gain.setValueAtTime(vol, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(chimeGain);
      chimeGain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.15);

      const nextDelay = 2500 + Math.random() * 4500;
      const tid = setTimeout(triggerCupChime, nextDelay);
      this.timerIds.push(tid);
    };

    triggerCupChime();
  }

  // 5. 밤바다 파도 (주기적으로 밀려와 부서지는 파도 시뮬레이션)
  private startWaves(ctx: AudioContext, destination: AudioNode) {
    const pinkBuffer = createPinkNoiseBuffer(ctx, 6);

    const waveSrc = ctx.createBufferSource();
    waveSrc.buffer = pinkBuffer;
    waveSrc.loop = true;

    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = "lowpass";
    waveFilter.frequency.setValueAtTime(320, ctx.currentTime);

    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.4, ctx.currentTime);

    // 파도 밀물/썰물 주기적 스위핑 (8초 주기)
    const waveLfo = ctx.createOscillator();
    const waveLfoGain = ctx.createGain();
    waveLfo.frequency.setValueAtTime(0.125, ctx.currentTime); // ~8초 주기
    waveLfoGain.gain.setValueAtTime(280, ctx.currentTime);
    waveLfo.connect(waveLfoGain);
    waveLfoGain.connect(waveFilter.frequency);
    waveLfo.start();

    // 볼륨도 파도 타이밍에 맞춰 부드럽게 호흡
    const volLfo = ctx.createOscillator();
    const volLfoGain = ctx.createGain();
    volLfo.frequency.setValueAtTime(0.125, ctx.currentTime);
    volLfoGain.gain.setValueAtTime(0.22, ctx.currentTime);
    volLfo.connect(volLfoGain);
    volLfoGain.connect(waveGain.gain);
    volLfo.start();

    waveSrc.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(destination);
    waveSrc.start();
    this.activeNodes.push(waveSrc, waveGain, waveLfo, volLfo);
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
