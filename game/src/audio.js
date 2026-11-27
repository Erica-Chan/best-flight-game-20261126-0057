// Procedural sound: no audio files, no network. A WebAudio engine hum
// whose pitch follows the throttle, wind that rises with speed, and short
// chimes for rings and landings. Starts on the first user gesture.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      // Wind: looped filtered noise.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buffer;
      windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = ctx.createGain();
      windGain.gain.value = 0.0;
      windSrc.connect(windFilter).connect(windGain).connect(ctx.destination);
      windSrc.start();
    } catch {
      ctx = null;
    }
  }

  function blip(freq, dur = 0.16, type = 'sine', vol = 0.14) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  return {
    ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
    update(throttle, speed, flying) {
      if (!ctx || muted) return;
      if (ctx.state === 'suspended') ctx.resume();
      const target = flying ? 0.035 + throttle * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.25, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.09, speed * 0.0006) : 0, ctx.currentTime, 0.2);
    },
    ring() { blip(880, 0.18); setTimeout(() => blip(1320, 0.22), 90); },
    land() { blip(523, 0.2); setTimeout(() => blip(784, 0.3), 120); },
    crash() { blip(110, 0.5, 'sawtooth', 0.2); },
    complete() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.25), i * 130)); },
  };
}
