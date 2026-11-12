import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';

export const VOICE_EFFECTS = [
  { id: 'original', name: '기본', description: '원래 목소리' },
  { id: 'low', name: '낮게', description: '낮고 굵게' },
  { id: 'high', name: '높게', description: '높고 가볍게' },
  { id: 'robot', name: '로봇', description: '전자음 느낌' },
] as const;
export type VoiceEffect = typeof VOICE_EFFECTS[number]['id'];
const modules = new WeakMap<AudioContext, Promise<void>>();

export class VoiceEffectProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly name = 'voice-room-effects';
  processedTrack?: MediaStreamTrack;
  private source?: MediaStreamAudioSourceNode;
  private destination?: MediaStreamAudioDestinationNode;
  private node?: AudioWorkletNode;
  private monitor?: GainNode;
  private revision = 0;
  constructor(private mode: VoiceEffect, private listening = false) {}
  setMode(mode: VoiceEffect) { this.mode = mode; this.node?.port.postMessage({mode}); }
  setMonitor(enabled: boolean) { this.listening = enabled; if(this.monitor) this.monitor.gain.setTargetAtTime(enabled ? .35 : 0, this.monitor.context.currentTime, .02); }
  async init({track,audioContext: context}: AudioProcessorOptions) {
    const revision = ++this.revision;
    if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') throw new Error('이 브라우저는 음성 변조를 지원하지 않아요.');
    if (!modules.has(context)) modules.set(context, context.audioWorklet.addModule('/audio/voice-effects-worklet.js?v=1').catch(error=>{modules.delete(context);throw error;}));
    await modules.get(context);
    if(revision !== this.revision || track.readyState === 'ended') throw new Error('마이크 연결이 종료됐어요.');
    this.source = context.createMediaStreamSource(new MediaStream([track]));
    this.node = new AudioWorkletNode(context,'voice-room-effects',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit',processorOptions:{mode:this.mode}});
    this.destination = context.createMediaStreamDestination();
    this.monitor = context.createGain(); this.monitor.gain.value = this.listening ? .35 : 0;
    this.node.port.postMessage({mode:this.mode});
    this.source.connect(this.node); this.node.connect(this.destination);
    this.node.connect(this.monitor); this.monitor.connect(context.destination);
    this.processedTrack = this.destination.stream.getAudioTracks()[0];
  }
  async restart(options: AudioProcessorOptions) { await this.destroy(); await this.init(options); }
  async destroy() {
    this.revision++; this.source?.disconnect(); this.node?.disconnect(); this.monitor?.disconnect(); this.destination?.disconnect();
    this.node?.port.close(); this.processedTrack?.stop();
    this.source=undefined;this.node=undefined;this.monitor=undefined;this.destination=undefined;this.processedTrack=undefined;
  }
}
