'use strict';
(() => {
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  function impulse(ctx, sec) {
    const n = (ctx.sampleRate * sec) | 0;
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    return b;
  }

  function makeSynth(ctx) {
    const BPM = 104;
    const STEP = 60 / BPM / 4;
    const G = (v, to) => {
      const g = ctx.createGain();
      g.gain.value = v;
      if (to) g.connect(to);
      return g;
    };
    const F = (type, f, q, to) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      if (to) b.connect(to);
      return b;
    };

    const out = ctx.createDynamicsCompressor();
    out.threshold.value = -14;
    out.knee.value = 8;
    out.ratio.value = 3.5;
    out.attack.value = 0.005;
    out.release.value = 0.18;
    const master = G(0.65);
    master.connect(F('lowpass', 10500, 0.4, out));

    const rev = ctx.createConvolver();
    rev.buffer = impulse(ctx, 2.8);
    rev.connect(G(0.3, master));
    const dly = ctx.createDelay(1);
    dly.delayTime.value = STEP * 3;
    const dlp = F('lowpass', 2400, 0.5);
    const dfb = G(0.36);
    dly.connect(dlp);
    dlp.connect(dfb);
    dfb.connect(dly);
    dlp.connect(G(0.45, master));

    const drum = G(0.95, master);
    const drumRev = G(0.14, rev);
    const bassB = G(0.55, master);
    const padB = G(0.42, master);
    const arpB = G(0.36, master);
    padB.connect(G(0.6, rev));
    arpB.connect(dly);
    arpB.connect(G(0.3, rev));

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    hiss.connect(F('bandpass', 5200, 0.4, G(0.01, master)));
    hiss.start();

    const api = { out, log: null, STEP };

    function kick(t, v) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(155, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g);
      g.connect(drum);
      o.start(t);
      o.stop(t + 0.4);
      const p = padB.gain;
      p.setValueAtTime(0.42 * 0.5, t);
      p.linearRampToValueAtTime(0.42, t + 0.3);
      if (api.log) api.log.push(t);
    }

    function nz(t, v, type, f, q, dec, bus) {
      const s = ctx.createBufferSource();
      const b = F(type, f, q);
      const g = ctx.createGain();
      s.buffer = noise;
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      s.connect(b);
      b.connect(g);
      g.connect(bus);
      s.start(t, Math.random() * 0.8);
      s.stop(t + dec + 0.05);
      return g;
    }

    function snare(t, v) {
      nz(t, v * 0.55, 'bandpass', 1800, 0.7, 0.19, drum).connect(drumRev);
      nz(t + 0.012, v * 0.4, 'bandpass', 1300, 1.4, 0.04, drum);
      nz(t + 0.024, v * 0.4, 'bandpass', 1300, 1.4, 0.05, drum);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      g.gain.setValueAtTime(v * 0.45, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g);
      g.connect(drum);
      o.start(t);
      o.stop(t + 0.13);
    }

    const hat = (t, v, open) => nz(t, v, 'highpass', 7800, 0.6, open ? 0.3 : 0.045, drum);

    function bass(t, m, dur) {
      const f = mtof(m);
      const o = ctx.createOscillator();
      const s = ctx.createOscillator();
      const lp = F('lowpass', 1000, 4);
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      s.type = 'sine';
      s.frequency.value = f;
      lp.frequency.setValueAtTime(1000, t);
      lp.frequency.setTargetAtTime(240, t, 0.09);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.42, t + 0.05);
      g.gain.setTargetAtTime(0.3, t + 0.05, 0.12);
      g.gain.setTargetAtTime(0, t + dur, 0.035);
      o.connect(lp);
      lp.connect(g);
      s.connect(G(0.7, g));
      g.connect(bassB);
      o.start(t);
      s.start(t);
      o.stop(t + dur + 0.3);
      s.stop(t + dur + 0.3);
    }

    function pad(t, notes, dur, bright) {
      const lp = F('lowpass', bright ? 1700 : 900, 0.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + 0.45);
      g.gain.setTargetAtTime(0, t + dur, 0.45);
      lp.connect(g);
      g.connect(padB);
      for (const m of notes) {
        for (const d of [-9, 8]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = mtof(m);
          o.detune.setValueAtTime(d, t);
          o.detune.linearRampToValueAtTime(d + (Math.random() - 0.5) * 14, t + dur);
          o.connect(G(0.045, lp));
          o.start(t);
          o.stop(t + dur + 2.5);
        }
      }
    }

    function pluck(t, m, v) {
      const o = ctx.createOscillator();
      const lp = F('lowpass', 3200, 3);
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = mtof(m);
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.2);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(lp);
      lp.connect(g);
      g.connect(arpB);
      o.start(t);
      o.stop(t + 0.3);
    }

    const CH = [
      [45, [57, 60, 64, 67]],
      [41, [53, 57, 60, 64]],
      [48, [55, 59, 60, 64]],
      [43, [55, 59, 62, 64]],
      [40, [52, 55, 59, 62]],
    ];
    const PA = [0, 1, 2, 3];
    const PB = [1, 3, 4, 0];
    const BL1 = [
      [0, 0, 6],
      [6, 0, 2],
      [8, 0, 4],
      [12, 7, 2],
      [14, 12, 2],
    ];
    const BL2 = [
      [0, 0, 3],
      [3, 0, 3],
      [6, 12, 2],
      [8, 0, 3],
      [11, 7, 3],
      [14, 12, 2],
    ];
    const ARP3 = [0, 1, 2, 3, 2, 1, 2, 3];
    const hum = () => 0.88 + Math.random() * 0.12;

    function step(n, t) {
      const st = n & 15;
      const bar = n >> 4;
      const sec = (bar >> 3) & 3;
      const bi = bar & 7;
      if (st & 1) t += STEP * 0.12;
      const ch = CH[(sec < 2 ? PA : PB)[bi & 3]];
      const brk = sec === 2 && bi < 4;
      const fill = bi === 7 && sec !== 2 && st >= 12;

      const kp =
        sec === 0 ? st === 0 || st === 10 : sec === 2 ? !brk && (st === 0 || st === 8) : st === 0 || st === 7 || st === 10;
      if (kp) kick(t, 0.95);
      if (fill) snare(t, 0.25 + (st - 12) * 0.12);
      else if ((st === 4 || st === 12) && !(brk && st === 4)) snare(t, 0.6 * hum());

      if (sec === 0 || brk) {
        if (!(st & 1)) hat(t, (st & 3 ? 0.08 : 0.13) * hum(), false);
      } else hat(t, (st & 1 ? 0.06 : 0.12) * hum(), sec === 3 && st === 14);
      if (st === 0 && bi === 0 && (sec === 1 || sec === 3)) nz(t, 0.1, 'highpass', 5000, 0.3, 1.4, drum).connect(drumRev);

      if (!brk) {
        const bl = sec & 1 ? BL2 : BL1;
        for (let i = 0; i < bl.length; i++) if (bl[i][0] === st) bass(t, ch[0] + bl[i][1], bl[i][2] * STEP * 0.95);
      }
      if (st === 0) pad(t, ch[1], STEP * 16, sec === 2);
      if (sec === 1 && !(st & 1)) pluck(t, ch[1][(st >> 1) & 3] + 12, 0.06);
      if (sec === 3) pluck(t, ch[1][ARP3[st & 7]] + (st >= 8 ? 24 : 12), 0.045);
      if (sec === 2 && (st === 0 || st === 6 || st === 10)) pluck(t, ch[1][st & 3] + 24, 0.04);
    }

    let n = 0;
    let next = 0;
    let timer = 0;
    function pump() {
      if (next < ctx.currentTime - 0.05) {
        while (next < ctx.currentTime) {
          n++;
          next += STEP;
        }
      }
      while (next < ctx.currentTime + 0.15) {
        step(n++, next);
        next += STEP;
      }
    }
    api.start = () => {
      if (timer) return;
      n = 0;
      next = ctx.currentTime + 0.08;
      pump();
      timer = setInterval(pump, 30);
    };
    api.stop = () => {
      clearInterval(timer);
      timer = 0;
    };
    api.renderUntil = (sec) => {
      n = 0;
      next = 0.05;
      while (next < sec) {
        step(n++, next);
        next += STEP;
      }
    };
    return api;
  }

  function makeAnalyzer(sr, bins, minDb, maxDb) {
    const hz = sr / (bins * 2);
    const bin = (f) => Math.max(1, Math.min(bins - 1, Math.round(f / hz)));
    const B0 = bin(30);
    const B1 = bin(120);
    const M0 = bin(300);
    const M1 = bin(2500);
    const H0 = bin(4500);
    const H1 = bin(12000);
    const lin = new Float32Array(256);
    for (let i = 1; i < 256; i++) lin[i] = Math.pow(10, (minDb + (i / 255) * (maxDb - minDb)) / 20);
    const prev = new Float32Array(bins);
    const N = 48;
    const hist = new Float32Array(N);
    const edges = new Int16Array(17);
    for (let i = 0; i <= 16; i++) edges[i] = bin(40 * Math.pow(300, i / 16));
    const pk = new Float32Array([0.4, 0.4, 0.4]);
    const S = { bass: 0, mid: 0, high: 0, loud: 0, beat: false, flux: 0, thr: 0, spec: new Float32Array(16) };
    let hp = 0;
    let since = 1;
    let rpk = 0.05;
    let fpk = 1e-4;
    const avg = (f, a, b) => {
      let s = 0;
      for (let i = a; i <= b; i++) s += f[i];
      return s / ((b - a + 1) * 255);
    };
    const ease = (c, v, dt, up, dn) => c + (v - c) * Math.min(1, dt * (v > c ? up : dn));
    const norm = (i, raw, dt) => {
      pk[i] = Math.max(raw, pk[i] - dt * 0.015, 0.3);
      const o = i ? 0.42 : 0.6;
      return clamp((raw / pk[i] - o) / (1 - o));
    };

    function run(f, rms, dt) {
      S.bass = ease(S.bass, norm(0, avg(f, B0, B1), dt), dt, 40, 7);
      S.mid = ease(S.mid, norm(1, avg(f, M0, M1), dt), dt, 12, 3);
      S.high = ease(S.high, norm(2, avg(f, H0, H1), dt), dt, 30, 6);
      let fl = 0;
      for (let i = B0; i <= B1; i++) {
        const v = lin[f[i]];
        const d = v - prev[i];
        if (d > 0) fl += d;
        prev[i] = v;
      }
      fpk = Math.max(fl, fpk * (1 - dt * 0.1), 1e-5);
      fl /= fpk;
      let m = 0;
      for (let i = 0; i < N; i++) m += hist[i];
      m /= N;
      let v = 0;
      for (let i = 0; i < N; i++) v += (hist[i] - m) * (hist[i] - m);
      const thr = m + 1.8 * Math.sqrt(v / N) + 0.12;
      hist[hp] = fl;
      hp = (hp + 1) % N;
      since += dt;
      S.beat = fl > thr && fl > 0.2 && since > 0.18 && rms > 0.003;
      if (S.beat) since = 0;
      S.flux = fl;
      S.thr = thr;
      rpk = Math.max(rms, rpk * (1 - dt * 0.02), 0.01);
      S.loud = ease(S.loud, clamp(rms / rpk), dt, 0.4, 0.4);
      for (let i = 0; i < 16; i++) S.spec[i] = avg(f, edges[i], Math.max(edges[i], edges[i + 1] - 1));
      return S;
    }
    function idle(dt) {
      const k = Math.min(1, dt * 4);
      S.bass -= S.bass * k;
      S.mid -= S.mid * k;
      S.high -= S.high * k;
      S.loud -= S.loud * dt * 0.5;
      S.beat = false;
      for (let i = 0; i < 16; i++) S.spec[i] -= S.spec[i] * k;
      return S;
    }
    return { run, idle, S };
  }

  let ctx = null;
  let an = null;
  let outG = null;
  let synth = null;
  let A = null;
  let freq = null;
  let td = null;
  let fEl = null;
  let fNode = null;
  let fUrl = null;
  let mStream = null;
  let mNode = null;
  let src = 'none';
  let paused = false;
  const Z = { bass: 0, mid: 0, high: 0, loud: 0, beat: false, spec: new Float32Array(16) };

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    an = ctx.createAnalyser();
    an.fftSize = 2048;
    an.smoothingTimeConstant = 0;
    an.minDecibels = -90;
    an.maxDecibels = -20;
    const z = ctx.createGain();
    z.gain.value = 0;
    an.connect(z);
    z.connect(ctx.destination);
    outG = ctx.createGain();
    outG.connect(ctx.destination);
    freq = new Uint8Array(an.frequencyBinCount);
    td = new Float32Array(an.fftSize);
    A = makeAnalyzer(ctx.sampleRate, an.frequencyBinCount, -90, -20);
  }

  function stopAll() {
    if (synth) {
      synth.stop();
      try {
        synth.out.disconnect();
      } catch (e) {}
    }
    if (fEl) {
      fEl.pause();
      try {
        fNode.disconnect();
      } catch (e) {}
    }
    if (mStream) {
      mStream.getTracks().forEach((t) => t.stop());
      mNode.disconnect();
      mStream = null;
    }
    src = 'none';
    paused = false;
  }

  async function demo() {
    ensure();
    stopAll();
    if (!synth) synth = makeSynth(ctx);
    synth.out.connect(an);
    synth.out.connect(outG);
    await ctx.resume();
    synth.start();
    src = 'demo';
  }

  async function file(f) {
    ensure();
    stopAll();
    if (!fEl) {
      fEl = new Audio();
      fEl.loop = true;
      fNode = ctx.createMediaElementSource(fEl);
    }
    if (fUrl) URL.revokeObjectURL(fUrl);
    fUrl = URL.createObjectURL(f);
    fEl.src = fUrl;
    fNode.connect(an);
    fNode.connect(outG);
    await ctx.resume();
    await fEl.play();
    src = 'file';
  }

  async function mic() {
    ensure();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no mic');
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    stopAll();
    mStream = s;
    mNode = ctx.createMediaStreamSource(s);
    mNode.connect(an);
    await ctx.resume();
    src = 'mic';
  }

  async function tab() {
    ensure();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('no tab');
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      systemAudio: 'include',
    });
    s.getVideoTracks().forEach((t) => t.stop());
    if (!s.getAudioTracks().length) throw new Error('noaudio');
    stopAll();
    mStream = s;
    mNode = ctx.createMediaStreamSource(s);
    mNode.connect(an);
    await ctx.resume();
    src = 'tab';
  }

  function toggle() {
    if (src === 'none') return false;
    paused = !paused;
    if (paused) {
      ctx.suspend();
      if (src === 'file') fEl.pause();
    } else {
      ctx.resume();
      if (src === 'file') fEl.play();
    }
    return paused;
  }

  function frame(dt) {
    if (!A) return Z;
    if (src === 'none' || paused) return A.idle(dt);
    an.getByteFrequencyData(freq);
    an.getFloatTimeDomainData(td);
    let s = 0;
    for (let i = 0; i < td.length; i++) s += td[i] * td[i];
    return A.run(freq, Math.sqrt(s / td.length), dt);
  }

  window.ResAudio = {
    demo,
    file,
    mic,
    tab,
    toggle,
    frame,
    makeSynth,
    makeAnalyzer,
    get src() {
      return src;
    },
    get paused() {
      return paused;
    },
  };
})();
