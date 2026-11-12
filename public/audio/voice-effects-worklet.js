/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// Two overlapping variable-delay grains shift pitch without changing speech speed.
class VoiceEffectsWorklet extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();
    this.mode = ['original','low','high','robot'].includes(options.processorOptions?.mode) ? options.processorOptions.mode : 'original'; this.target = this.mode; this.fade = 1;
    this.buffer = new Float32Array(Math.ceil(sampleRate * .2));
    this.write = 0; this.phase = 0; this.robotPhase = 0;
    this.port.onmessage = ({data}) => { if (['original','low','high','robot'].includes(data.mode)) this.target = data.mode; };
  }
  read(delay) {
    let position = this.write - delay;
    if (position < 0) position += this.buffer.length;
    const left = Math.floor(position), fraction = position - left;
    return this.buffer[left] * (1 - fraction) + this.buffer[(left + 1) % this.buffer.length] * fraction;
  }
  process(inputs, outputs) {
    const output = outputs[0]?.[0]; if (!output) return true;
    const input = inputs[0]?.[0], span = sampleRate * .06, base = sampleRate * .008;
    for (let i=0;i<output.length;i++) {
      const x = input?.[i] || 0; this.buffer[this.write] = x;
      if (this.mode !== this.target) {
        this.fade = Math.max(0, this.fade - 1/(sampleRate*.015));
        if (this.fade === 0) { this.mode = this.target; this.phase = 0; }
      } else this.fade = Math.min(1, this.fade + 1/(sampleRate*.015));
      let y = x;
      if (this.mode === 'low' || this.mode === 'high') {
        const ratio = Math.pow(2, (this.mode === 'low' ? -4 : 4)/12);
        const p = this.phase, q = (p+.5)%1;
        const a = this.mode === 'low' ? p : 1-p, b = this.mode === 'low' ? q : 1-q;
        y = this.read(base+a*span)*(1-Math.abs(2*p-1)) + this.read(base+b*span)*(1-Math.abs(2*q-1));
        this.phase = (p+Math.abs(1-ratio)/span)%1;
      } else if (this.mode === 'robot') y = x * (.35 + .65*Math.sin(this.robotPhase));
      this.robotPhase = (this.robotPhase + 2*Math.PI*60/sampleRate)%(2*Math.PI);
      output[i] = Math.max(-1,Math.min(1,y*this.fade));
      this.write = (this.write+1)%this.buffer.length;
    }
    return true;
  }
}
registerProcessor('voice-room-effects', VoiceEffectsWorklet);
