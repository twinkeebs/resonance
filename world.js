'use strict';
(() => {
  const H = 180;
  const WY = 126;
  const P = 1024;
  const PM = P - 1;
  const TAU = Math.PI * 2;
  const qs = new URLSearchParams(location.search);
  const DEMO = qs.has('demo');
  const FIXT = qs.has('t');
  const FORCE = qs.get('ev');
  const KEEPUI = qs.has('ui');
  const DLOUD = qs.has('loud') ? +qs.get('loud') : 0.5;
  let tod = FIXT ? ((+qs.get('t') % 1) + 1) % 1 : 0.64;

  const NAMES = (
    'sky0 sky1 sky2 sky3 sky4 sky5 sky6 sky7 star starDim orb orbShade halo cloudHi cloudMid cloudLo ' +
    'r0 r0hi snow r1 r1hi r2 r2hi water waterHi ground groundHi grass tree treeHi trunk aur0 aur1 aur2 ' +
    'fly flyDim spark rain bird leaf leaf2 bolt'
  ).split(' ');
  const I = {};
  NAMES.forEach((n, i) => (I[n] = i));

  const RAW = {
    night:
      '0b0d22 10132e 151a3b 1b2248 222b55 2b3561 35406b 414c74 e9f0ff 7f8fbf f4efd8 bfb89c 3b4876 46527a 30395f 222a4c ' +
      '2a3360 4a5a8c a9b9e0 1c2347 36447a 121834 222c56 0b1029 6578b0 06081a 1c2748 0f1630 070a1c 1f2d54 0a0c1a 5ff5a6 2fbfa8 8058d0 ' +
      'f6ff9e 86b84a ffffff 5d6fa8 0c1026 3a3060 5c4478 eef3ff',
    dawn:
      '34407e 4d5898 6f70ae 9585bc bb95bf dea4bb f4b9b2 ffd6b0 fff4f0 b4aed6 fff8dc ffe0a0 ffe2c4 fff2e4 efb6c2 9c86b6 ' +
      '9a90c2 c8b4d8 f6eef6 6e6aa0 9686b8 474677 66609a 434b84 ffe4cc 1b1b36 46466e 2a2a4e 16162e 54507e 171428 a0ffd0 80d0e0 c0a0f0 ' +
      'fff0b0 c0b080 ffffff a8b0d8 2a2a48 f2a2ba ffd4dc ffffff',
    day:
      '2d6acc 3878d8 4587e0 5597e8 68a8ee 80b9f1 9dcbf3 bfdff5 ffffff d6eaff fffbe6 fff1a8 e9f6ff ffffff e1eefa a9c3e2 ' +
      '86a7d4 a9c4e6 f4f8ff 5b86b4 7fa6cc 3b7466 5c9a6c 2b64a2 eef8ff 1d4029 4f9440 2f6634 18392a 468a40 3a2a1e c0ffe0 a0e0f0 d0c0ff ' +
      'fff8b0 e0d880 ffffff 9ab8d8 22324a e2a040 f2d060 ffffff',
    dusk:
      '24163f 3a1d5c 59266d 80306f a9406b d25a62 ef7d5a ffa95e ffe8d6 c48aa8 fff4b8 ffcc66 ffc27a ffb870 e2666c 8c3768 ' +
      'a14c78 d9707a ffc0a0 6d2f68 a24f70 431f4f 6e3360 2e1745 ffc27a 170b20 4f2244 2a1233 13091c 5e2848 120814 ff9a8a d86aa8 8a4ac0 ' +
      'ffe58a d08a4a fff4d6 c27a9e 2a1230 e8784a ffb35e fff0e0',
  };
  const rgb = (h) => {
    const v = parseInt(h, 16);
    return [v >> 16, (v >> 8) & 255, v & 255];
  };
  const FL = [228, 234, 255];
  function build(s) {
    const cols = s.split(' ').map(rgb);
    const w = cols[I.water];
    const rc = new Float32Array(384);
    const rf = new Float32Array(384);
    const put = (arr, i, v) => ((arr[i * 3] = v[0]), (arr[i * 3 + 1] = v[1]), (arr[i * 3 + 2] = v[2]));
    for (let i = 0; i < NAMES.length; i++) {
      const a = cols[i];
      const r = a.map((v, j) => Math.round((v * 0.55 + w[j] * 0.45) * 0.9));
      put(rc, i, a);
      put(rc, i + 64, r);
      put(rf, i, a.map((v, j) => v + (FL[j] - v) * 0.55));
      put(rf, i + 64, r.map((v, j) => v + (FL[j] - v) * 0.45));
    }
    return { rc, rf };
  }
  const PAL = {};
  for (const k in RAW) PAL[k] = build(RAW[k]);
  const KF = [
    [0, PAL.night],
    [0.3, PAL.dawn],
    [0.5, PAL.day],
    [0.7, PAL.dusk],
    [1, PAL.night],
  ];

  const BA = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16));
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const rnd = Math.random;

  function hash(n) {
    n = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d);
    n ^= n >>> 15;
    n = Math.imul(n, 0x165667b1);
    n ^= n >>> 13;
    return (n >>> 0) / 4294967296;
  }
  function vn(x, per, seed) {
    const i = Math.floor(x);
    const f = x - i;
    const a = hash((((i % per) + per) % per) + seed * 7919);
    const b = hash(((((i + 1) % per) + per) % per) + seed * 7919);
    return a + (b - a) * f * f * (3 - 2 * f);
  }
  function ridgeMap(seed, cells, oct, ridged, pw) {
    const h = new Float32Array(P);
    let mn = 1e9;
    let mx = -1e9;
    for (let x = 0; x < P; x++) {
      let v = 0;
      let a = 1;
      let c = cells;
      for (let o = 0; o < oct; o++) {
        let n = vn((x / P) * c, c, seed + o * 13);
        if (ridged) n = 1 - Math.abs(n * 2 - 1);
        v += n * a;
        a *= 0.5;
        c *= 2;
      }
      h[x] = v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    for (let x = 0; x < P; x++) h[x] = Math.pow((h[x] - mn) / (mx - mn), pw);
    return h;
  }

  const RIDGES = [
    { h: ridgeMap(11, 5, 5, true, 1.6), base: 120, amp: 64, spd: 0.08, col: I.r0, hi: I.r0hi, hz: I.sky7, haze: 12, lit: 10, slk: 26, snow: true, pulse: 0.03 },
    { h: ridgeMap(23, 9, 4, false, 1.2), base: 123, amp: 32, spd: 0.22, col: I.r1, hi: I.r1hi, hz: I.r0, haze: 8, lit: 4, slk: 20, snow: false, pulse: 0.05 },
    { h: ridgeMap(37, 16, 3, false, 1), base: 126, amp: 11, spd: 0.45, col: I.r2, hi: I.r2hi, hz: I.r1, haze: 4, lit: 2, slk: 30, snow: false, pulse: 0.08 },
  ];
  const GR = { h: ridgeMap(41, 6, 4, false, 1.15), base: 175, amp: 38 };

  const shore = [];
  for (let x = 0; x < P; x++) {
    const c = vn((x / P) * 22, 22, 77);
    if (c > 0.5 && hash(x * 3 + 1) < (c - 0.42) * 1.5) {
      shore.push(x, 3 + ((hash(x * 5 + 2) * 6) | 0));
      x += 1;
    }
  }

  const GH = new Uint8Array(P);
  const GF = new Uint8Array(P);
  for (let x = 0; x < P; x++) {
    const tuft = vn((x / P) * 70, 70, 91);
    GH[x] = (hash(x * 7 + 3) * (1.3 + tuft * tuft * 7)) | 0;
    GF[x] = GH[x] > 2 && hash(x * 11 + 5) < 0.12 ? 1 : 0;
  }

  function makeBlob(seed, w, h, nb, flat) {
    const m = new Uint8Array(w * h);
    const nx = new Float32Array(w * h);
    const ny = new Float32Array(w * h);
    const bl = [];
    for (let i = 0; i < nb; i++) {
      if (flat) {
        const u = (i + 0.5) / nb;
        const r = h * (0.28 + 0.42 * Math.sin(u * Math.PI)) * (0.8 + hash(seed + i * 17) * 0.4);
        bl.push((w - 4) * u + 2 + (hash(seed + i * 3) - 0.5) * 4, h - r * 0.75 - 1 - hash(seed + i * 5) * 2, r);
      } else {
        const r = i ? Math.min(w, h) * (0.2 + hash(seed + i * 17) * 0.1) : Math.min(w, h) * 0.36;
        const a = (i / nb) * TAU + hash(seed + i * 3);
        const d = i ? Math.min(w, h) * 0.26 : 0;
        bl.push(w / 2 + Math.cos(a) * d * 1.2, h * 0.5 + Math.sin(a) * d * 0.8, r);
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let best = 0;
        let bi = -1;
        for (let i = 0; i < bl.length; i += 3) {
          const dx = x + 0.5 - bl[i];
          const dy = y + 0.5 - bl[i + 1];
          const k = bl[i + 2] - Math.sqrt(dx * dx + dy * dy);
          if (k > best) {
            best = k;
            bi = i;
          }
        }
        if (bi < 0 || (flat && y > h - 2)) continue;
        const j = y * w + x;
        m[j] = 1;
        nx[j] = (x + 0.5 - bl[bi]) / bl[bi + 2];
        ny[j] = (y + 0.5 - bl[bi + 1]) / bl[bi + 2];
      }
    }
    return { w, h, m, nx, ny };
  }

  function makeCloud(seed) {
    const w = 24 + ((hash(seed) * 40) | 0);
    const h = 11 + ((hash(seed + 1) * 9) | 0);
    const b = makeBlob(seed, w, h, 3 + ((w / 13) | 0), true);
    const px = new Uint8Array(w * h).fill(255);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = y * w + x;
        if (!b.m[j]) continue;
        const t = BA[((y & 3) << 2) | (x & 3)];
        const l = -b.ny[j] * 0.9 - b.nx[j] * 0.3;
        const lo = y >= h - 3 - (t > 0.5 ? 1 : 0);
        px[j] = lo ? I.cloudLo : l > 0.3 + (t - 0.5) * 0.3 ? I.cloudHi : l < -0.35 + (t - 0.5) * 0.3 ? I.cloudLo : I.cloudMid;
      }
    }
    return { w, h, px };
  }
  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const spr = makeCloud(i * 101 + 7);
    clouds.push({ spr, x: hash(i * 9 + 1) * 420 - 40, y: 8 + hash(i * 9 + 2) * 58, spd: 0.5 + hash(i * 9 + 3) * 0.8 });
  }

  const trees = [];
  for (let tx = 20; tx < P - 30; tx += 6) {
    if (GR.h[tx] < 0.42 || hash(tx * 3 + 1) > 0.5) continue;
    const pine = hash(tx) < 0.6;
    const big = 0.7 + GR.h[tx] * 0.5;
    trees.push({
      x: tx,
      pine,
      h: pine ? ((30 + hash(tx + 9) * 26) * big) | 0 : 12,
      spr: pine ? null : makeBlob(tx, 26 + ((hash(tx + 4) * 12) | 0), 22 + ((hash(tx + 5) * 8) | 0), 6, false),
    });
    tx += 26 + ((hash(tx + 3) * 60) | 0);
  }

  const NS = 160;
  const sxs = new Float32Array(NS);
  const sys = new Float32Array(NS);
  const sb = new Float32Array(NS);
  const sth = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    sxs[i] = hash(i * 3);
    sys[i] = Math.pow(hash(i * 3 + 1), 1.4) * 104;
    sb[i] = hash(i * 3 + 2);
    sth[i] = 0.12 + hash(i * 7 + 1) * 0.8;
  }

  const pool = (n, mk) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push(mk());
    return a;
  };
  const get = (p) => {
    for (let i = 0; i < p.length; i++) if (!p[i].on) return (p[i].on = true), p[i];
    return null;
  };
  const shoots = pool(8, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
  const rings = pool(40, () => ({ on: false, x: 0, y: 0, r: 0, life: 0, max: 1 }));
  const fishes = pool(4, () => ({ on: false, x: 0, y: 0, t: 0, d: 1 }));
  const birds = pool(48, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, ph: 0, fr: 8, big: false, lift: false }));
  const flies = pool(90, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, ph: 0, life: 0, burst: false }));
  const leaves = pool(70, () => ({ on: false, x: 0, y: 0, ph: 0, g: 0, c: 0 }));
  const sparks = pool(70, () => ({ on: false, x: 0, y: 0, life: 0, max: 1 }));
  const drops = pool(320, () => ({ on: false, x: 0, y: 0, vy: 0 }));
  const sunRings = pool(4, () => ({ on: false, life: 0 }));
  const bolt = new Float32Array(200);
  let boltN = 0;
  let boltB = 0;
  let boltLife = 0;

  const BIRD = [
    [-1, -1, 0, 0, 1, -1],
    [-1, 0, 0, 0, 1, 0],
    [-1, 1, 0, 0, 1, 1],
    [-1, 0, 0, 0, 1, 0],
  ];
  const BIRD2 = [
    [-2, -2, -1, -1, 0, 0, 1, -1, 2, -2],
    [-2, 0, -1, -1, 0, 0, 1, -1, 2, 0],
    [-2, 1, -1, 0, 0, 0, 1, 0, 2, 1],
    [-2, 0, -1, -1, 0, 0, 1, -1, 2, 0],
  ];

  const cvs = document.getElementById('c');
  const g = cvs.getContext('2d', { alpha: false });
  let W = 0;
  let img;
  let buf;
  let idx;
  let gTop = new Int16Array(400).fill(160);

  function resize() {
    const vw = innerWidth;
    const vh = innerHeight;
    const nw = Math.max(240, Math.min(400, Math.round((H * vw) / vh)));
    if (nw !== W) {
      W = nw;
      cvs.width = W;
      cvs.height = H;
      img = g.createImageData(W, H);
      buf = new Uint32Array(img.data.buffer);
      idx = new Uint8Array(W * H);
    }
    const s = Math.max(vw / W, vh / H);
    cvs.style.width = W * s + 'px';
    cvs.style.height = H * s + 'px';
    cvs.style.left = (vw - W * s) / 2 + 'px';
    cvs.style.top = (vh - H * s) / 2 + 'px';
  }
  addEventListener('resize', resize);
  resize();

  let T = 0;
  let cam = 300;
  let bass = 0;
  let mid = 0;
  let high = 0;
  let loud = 0;
  let loudL = 0.5;
  let wind = 0.5;
  let rain = 0;
  let surge = 0;
  let flash = 0;
  let glowK = 0;
  let evN = 0;
  let lamp = 0;
  let demoBeat = -1;
  let birdTimer = 4;
  let sunX = 0;
  let sunY = 0;
  let sunAlt = 0;
  let moonX = 0;
  let moonY = 0;
  let moonAlt = 0;
  let night = 0;
  let day = 0;
  let lightX = 0;
  let palA = PAL.night;
  let palB = PAL.night;
  let palW = 0;
  let energy = 0;
  let quiet = false;
  let dropCool = 8;
  const queue = [];
  const LIVE = new Uint32Array(128);
  let treeSX = -1;
  let treeSY = 0;
  let spec = new Float32Array(16);
  const dspec = new Float32Array(16);

  const POOL_N = ['shoot', 'flies', 'aurora', 'lightning', 'shoot', 'fish'];
  const POOL_T = ['shoot', 'birds', 'flies', 'fish', 'ring'];
  const POOL_D = ['birds', 'fish', 'leaves', 'ring'];

  function sway(wx) {
    return wind * (Math.sin(T * 1.9 + wx * 0.045) * 0.65 + Math.sin(T * 3.3 + wx * 0.13) * 0.35 + 0.55);
  }
  const gAt = (x) => gTop[x < 0 ? 0 : x >= W ? W - 1 : x | 0];

  function fire(e) {
    if (e === 'shoot') {
      const o = get(shoots);
      if (!o) return;
      const a = Math.PI * (0.76 + rnd() * 0.14);
      const sp = 210 + rnd() * 90;
      o.x = W * (0.3 + rnd() * 0.68);
      o.y = 3 + rnd() * 34;
      o.vx = Math.cos(a) * sp;
      o.vy = Math.sin(a) * sp;
      o.life = 0.5;
    } else if (e === 'lightning') {
      if (night < 0.3) return fire('shoot');
      let x = W * (0.15 + rnd() * 0.7);
      let y = 0;
      let n = 0;
      const end = 72 + rnd() * 22;
      while (y < end && n < 150) {
        bolt[n++] = x;
        bolt[n++] = y;
        y += 3 + rnd() * 5;
        x += (rnd() - 0.5) * 10;
      }
      bolt[n++] = x;
      bolt[n++] = y;
      boltB = n;
      let k = (((n / 2) * (0.3 + rnd() * 0.2)) | 0) * 2;
      let bx = bolt[k];
      let by = bolt[k + 1];
      const dir = rnd() < 0.5 ? -1 : 1;
      for (let j = 0; j < 7 && n < 198; j++) {
        bolt[n++] = bx;
        bolt[n++] = by;
        bx += dir * (2 + rnd() * 4);
        by += 2 + rnd() * 4;
      }
      boltN = n;
      boltLife = 0.24;
      flash = 0.5;
    } else if (e === 'flies') {
      const cx = 20 + rnd() * (W - 40);
      const cy = 138 + rnd() * 16;
      for (let i = 0; i < 28; i++) {
        const o = get(flies);
        if (!o) break;
        const a = rnd() * TAU;
        const s = 10 + rnd() * 34;
        o.x = cx + Math.cos(a) * 3;
        o.y = cy + Math.sin(a) * 2;
        o.vx = Math.cos(a) * s;
        o.vy = Math.sin(a) * s * 0.6 - 16;
        o.ph = rnd() * TAU;
        o.life = 2 + rnd() * 2.2;
        o.burst = true;
      }
    } else if (e === 'aurora') {
      surge = 1.2;
    } else if (e === 'birds') {
      const x0 = treeSX >= 0 ? treeSX : W * (0.2 + rnd() * 0.4);
      const y0 = treeSX >= 0 ? treeSY : 118;
      for (let i = 0; i < 10; i++) {
        const o = get(birds);
        if (!o) break;
        o.x = x0 + (rnd() - 0.5) * 14;
        o.y = y0 + rnd() * 8;
        o.vx = 20 + rnd() * 28;
        o.vy = -(30 + rnd() * 34);
        o.ph = rnd() * 4;
        o.fr = 13 + rnd() * 4;
        o.big = rnd() < 0.55;
        o.lift = true;
      }
    } else if (e === 'fish') {
      const o = get(fishes);
      if (!o) return;
      for (let k = 0; k < 6; k++) {
        o.x = 16 + rnd() * (W - 32);
        o.y = WY + 4 + rnd() * 10;
        if (gAt(o.x) > o.y + 4 && gAt(o.x + 14) > o.y + 4) break;
      }
      o.t = 0;
      o.d = rnd() < 0.5 ? -1 : 1;
      ring(o.x, o.y, 7, 0.9);
    } else if (e === 'leaves') {
      for (let i = 0; i < 18; i++) {
        const o = get(leaves);
        if (!o) break;
        o.x = -rnd() * 60;
        o.y = 100 + rnd() * 60;
        o.ph = rnd() * TAU;
        o.g = 70 + rnd() * 50;
        o.c = rnd() < 0.5 ? I.leaf : I.leaf2;
      }
    } else if (e === 'ring') {
      const o = get(sunRings);
      if (o) o.life = 0.75;
    }
  }
  function ring(x, y, r, life) {
    const o = get(rings);
    if (!o) return;
    o.x = x;
    o.y = y;
    o.r = r;
    o.life = o.max = life;
  }
  function drop() {
    quiet = false;
    dropCool = 16;
    flash = Math.max(flash, 0.7);
    glowK = 1;
    const seq = night > 0.65 ? ['shoot', 'shoot', 'aurora', 'shoot', 'flies', 'shoot', 'shoot'] : day > 0.55 ? ['birds', 'ring', 'leaves', 'birds', 'fish'] : ['ring', 'birds', 'flies', 'shoot', 'ring'];
    seq.forEach((e, i) => queue.push({ t: i * 0.22, e }));
  }

  function onBeat() {
    glowK = 1;
    lamp = 1;
    const p = night > 0.65 ? POOL_N : day > 0.55 ? POOL_D : POOL_T;
    fire(FORCE || p[evN++ % p.length]);
  }

  function update(dt) {
    T += dt;
    cam += dt * 5;
    if (!FIXT) tod = (tod + dt / 120) % 1;
    let beat = false;
    if (DEMO) {
      const bi = 60 / 104;
      const n = Math.floor(T / bi);
      const ph = T / bi - n;
      bass = Math.exp(-ph * 4.5);
      mid = 0.45 + 0.25 * Math.sin(T * 0.7);
      high = 0.25 + 0.5 * Math.exp(-((ph * 2) % 1) * 6);
      loud = DLOUD;
      beat = n !== demoBeat;
      demoBeat = n;
      for (let i = 0; i < 16; i++) dspec[i] = clamp(0.8 - i * 0.03 + 0.15 * Math.sin(T * 3 + i * 0.9) + (i < 4 ? bass * 0.25 : 0));
      spec = dspec;
    } else {
      const S = window.ResAudio.frame(dt);
      bass = S.bass;
      mid = S.mid;
      high = S.high;
      loud = S.loud;
      beat = S.beat;
      spec = S.spec;
    }
    loudL += (loud - loudL) * dt * 0.04;
    const rt = DEMO ? (loud > 0.8 ? 1 : 0) : loud > 0.42 && loud / Math.max(0.1, loudL) > 1.2 ? 1 : 0;
    rain = clamp(rain + (rt - rain) * dt * 0.5);
    wind += (0.35 + mid * 1.9 - wind) * Math.min(1, dt * 1.5);
    surge = Math.max(0, surge - dt * 0.9);
    flash = Math.max(0, flash - dt * 2.6);
    glowK *= Math.exp(-dt * 4);
    const et = clamp((loud - 0.22) / 0.6);
    energy += (et - energy) * Math.min(1, dt * (et > energy ? 0.9 : 0.25));
    dropCool -= dt;
    if (loud < loudL * 0.8) quiet = true;
    if (beat && quiet && dropCool < 0 && loud > loudL * 1.12 && loud > 0.45) drop();
    for (let i = queue.length - 1; i >= 0; i--) {
      queue[i].t -= dt;
      if (queue[i].t <= 0) {
        fire(queue[i].e);
        queue.splice(i, 1);
      }
    }
    lamp = Math.max(0, lamp - dt * 5);
    boltLife -= dt;

    const a = (tod - 0.25) * TAU;
    sunAlt = Math.sin(a);
    sunX = W * 0.5 - Math.cos(a) * W * 0.32;
    sunY = WY - 8 - sunAlt * 104;
    const am = a + Math.PI * 0.85;
    moonAlt = Math.sin(am);
    moonX = W * 0.5 - Math.cos(am) * W * 0.34;
    moonY = WY - 8 - moonAlt * 92;
    night = clamp((0.3 - sunAlt) / 0.5);
    day = clamp((sunAlt - 0.25) / 0.35);
    lightX = sunAlt > -0.08 ? sunX : moonX;
    for (let i = 0; i < KF.length - 1; i++) {
      if (tod >= KF[i][0] && tod < KF[i + 1][0]) {
        palA = KF[i][1];
        palB = KF[i + 1][1];
        const u = clamp(((tod - KF[i][0]) / (KF[i + 1][0] - KF[i][0]) - 0.12) / 0.76);
        palW = u * u * (3 - 2 * u);
      }
    }

    if (beat) onBeat();

    for (const o of shoots) {
      if (!o.on) continue;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0) o.on = false;
    }
    for (const o of rings) {
      if (!o.on) continue;
      o.life -= dt;
      if (o.life <= 0) o.on = false;
    }
    for (const o of sunRings) {
      if (!o.on) continue;
      o.life -= dt;
      if (o.life <= 0) o.on = false;
    }
    for (const o of fishes) {
      if (!o.on) continue;
      o.t += dt;
      if (o.t >= 0.62) {
        o.on = false;
        ring(o.x + o.d * 12, o.y, 6, 0.8);
      }
    }

    birdTimer -= dt;
    if (birdTimer < 0) {
      birdTimer = 14 + rnd() * 14;
      if (night < 0.5) {
        const n = 5 + ((rnd() * 5) | 0);
        const y = 24 + rnd() * 40;
        for (let i = 0; i < n; i++) {
          const o = get(birds);
          if (!o) break;
          const k = Math.abs(i - (n >> 1));
          o.x = -8 - k * 6 - rnd() * 2;
          o.y = y + k * 3 + rnd() * 2;
          o.vx = 15 + rnd() * 2;
          o.vy = (rnd() - 0.5) * 2;
          o.ph = rnd() * 4;
          o.fr = 7 + rnd() * 2;
          o.big = false;
          o.lift = false;
        }
      }
    }
    for (const o of birds) {
      if (!o.on) continue;
      if (o.lift) {
        o.vy = Math.min(-5, o.vy + 30 * dt);
        o.vx += 10 * dt;
        o.fr = Math.max(8, o.fr - dt * 3);
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.ph += dt * o.fr * (o.lift ? 1 : 0.6 + 0.4 * Math.sin(o.x * 0.05));
      if (o.x > W + 12 || o.y < -12) o.on = false;
    }

    const target = Math.round(night * 18 + (1 - day) * (1 - night) * 6);
    let idle = 0;
    for (const o of flies) if (o.on && !o.burst) idle++;
    if (idle < target) {
      const o = get(flies);
      if (o) {
        o.x = rnd() * W;
        o.y = WY - 12 + rnd() * 44;
        o.vx = (rnd() - 0.5) * 8;
        o.vy = (rnd() - 0.5) * 6;
        o.ph = rnd() * TAU;
        o.life = 5 + rnd() * 9;
        o.burst = false;
      }
    }
    for (const o of flies) {
      if (!o.on) continue;
      o.ph += dt * (2.2 + (o.burst ? 4 : 0));
      o.vx += (rnd() - 0.5) * 50 * dt + wind * 2 * dt;
      o.vy += (rnd() - 0.5) * 50 * dt - (o.burst ? 0 : 1.5 * dt);
      const d = 1 - dt * (o.burst ? 1.2 : 0.9);
      o.vx *= d;
      o.vy *= d;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < -2) o.x += W + 4;
      if (o.x > W + 2) o.x -= W + 4;
      if (!o.burst && o.y > gAt(o.x) - 2) o.vy -= 20 * dt;
      o.life -= dt;
      if (o.life <= 0 || o.y < 20) o.on = false;
    }

    if (night < 0.8 && treeSX >= 0 && rnd() < dt * (0.3 + wind * 0.7)) {
      const o = get(leaves);
      if (o) {
        o.x = treeSX + (rnd() - 0.5) * 18;
        o.y = treeSY + 4 + rnd() * 14;
        o.ph = rnd() * TAU;
        o.g = 0;
        o.c = rnd() < 0.5 ? I.leaf : I.leaf2;
      }
    }
    for (const o of leaves) {
      if (!o.on) continue;
      o.ph += dt * 4;
      o.g -= o.g * Math.min(1, dt * 0.8);
      o.x += (wind * 18 + o.g + Math.sin(o.ph) * 9) * dt;
      o.y += (9 + Math.cos(o.ph * 0.8) * 7 - o.g * 0.08) * dt;
      if (o.x > W + 4 || o.y > H || (o.x >= 0 && o.y >= gAt(o.x))) o.on = false;
    }

    const sr = 0.7 + high * high * 40;
    if (rnd() < dt * sr) {
      const o = get(sparks);
      if (o) {
        o.x = (rnd() * W) | 0;
        const gt = gAt(o.x);
        if (rnd() < 0.7 && gt - WY > 4) o.y = WY + 1 + ((rnd() * (gt - WY - 3)) | 0);
        else o.y = gt - 3 - ((rnd() * 22) | 0);
        o.life = o.max = 0.25 + rnd() * 0.25;
      }
    }
    for (const o of sparks) {
      if (!o.on) continue;
      o.life -= dt;
      if (o.life <= 0) o.on = false;
    }

    let nr = rain * 480 * dt;
    while (nr > 0) {
      if (rnd() < nr) {
        const o = get(drops);
        if (!o) break;
        o.x = rnd() * (W + 40) - 20;
        o.y = -rnd() * 20;
        o.vy = 230 + rnd() * 80;
      }
      nr -= 1;
    }
    const sl = 0.12 + wind * 0.12;
    for (const o of drops) {
      if (!o.on) continue;
      o.y += o.vy * dt;
      o.x += o.vy * sl * dt;
      const gt = gAt(o.x);
      if (o.y >= gt || o.y >= H) o.on = false;
      else if (o.y >= WY && rnd() < 0.5) {
        o.on = false;
        if (rnd() < 0.5) ring(o.x, o.y, 2 + rnd() * 2, 0.35);
      }
    }
  }

  function px(x, y, c) {
    x |= 0;
    y |= 0;
    if (x >= 0 && x < W && y >= 0 && y < H) idx[y * W + x] = c;
  }
  function line(x0, y0, x1, y1, c) {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) {
        e += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        e += dx;
        y0 += sy;
      }
    }
  }

  function drawSky() {
    let gx;
    let gy;
    let gR;
    let gS;
    if (sunAlt > -0.12) {
      gx = sunX;
      gy = sunY;
      gR = 60 + (1 - day) * 55;
      gS = (1.4 + (1 - day) * 1.6) * (1 + glowK * 0.3);
    } else {
      gx = moonX;
      gy = moonY;
      gR = 44;
      gS = 1.5 * (1 + glowK * 0.35);
    }
    const gR2 = gR * gR;
    const inv = 1 / gR;
    for (let y = 0; y < WY; y++) {
      const v0 = Math.pow(y / (WY - 1), 1.25) * 7.2;
      const dy = (y - gy) * 1.3;
      const row = y * W;
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++) {
        let v = v0;
        const dx = x - gx;
        const d2 = dx * dx + dy * dy;
        if (d2 < gR2) {
          const k = 1 - Math.sqrt(d2) * inv;
          v += gS * k * k;
        }
        let b = v | 0;
        if ((v - b - 0.5) * 2.4 + 0.5 > BA[by | (x & 3)]) b++;
        idx[row + x] = b > 7 ? 7 : b;
      }
    }
  }

  function drawStars() {
    if (night <= 0.1) return;
    const fl = (T * 10) | 0;
    for (let i = 0; i < NS; i++) {
      if (night < sth[i]) continue;
      const x = (sxs[i] * W) | 0;
      const y = sys[i] | 0;
      const j = y * W + x;
      if (idx[j] > 7) continue;
      const b = sb[i];
      const tw = Math.sin(T * (1.3 + b * 3) + i * 1.7) * 0.5 + 0.5;
      if (b < 0.4 && tw < 0.25) continue;
      const flare = hash(i * 13 + fl) < high * 0.3 * b;
      idx[j] = b > 0.72 || tw > 0.85 || flare ? I.star : I.starDim;
      if (flare || (b > 0.94 && tw > 0.6)) {
        px(x - 1, y, I.starDim);
        px(x + 1, y, I.starDim);
        px(x, y - 1, I.starDim);
        px(x, y + 1, I.starDim);
      }
    }
  }

  function drawAurora() {
    const str = night * (0.2 + 0.85 * clamp((loud - 0.3) / 0.5) + surge);
    if (str < 0.03) return;
    const f0 = cam * 0.05;
    for (let x = 0; x < W; x++) {
      const fx = x + f0;
      const yb = 60 + 9 * Math.sin(fx * 0.021 + T * 0.23) + 6 * Math.sin(fx * 0.057 - T * 0.41) + 2.5 * Math.sin(fx * 0.13 + T * 0.9);
      const L = 36 + 14 * Math.sin(fx * 0.016 + T * 0.17);
      const fold = 0.5 + 0.5 * Math.sin(fx * 0.043 + T * 0.5 + 2.5 * Math.sin(fx * 0.012 + T * 0.21));
      const sw = 0.5 + 0.5 * Math.sin(fx * 0.85 + 3 * Math.sin(fx * 0.11 + T * 0.7) + T * 0.4);
      const ray = (0.25 + 0.75 * sw * sw) * (0.6 + 0.4 * vn(fx * 0.4 + T * 1.6, 1 << 20, 5));
      const it = str * fold * ray * 2.1;
      if (it < 0.06) continue;
      const y1 = yb | 0;
      for (let y = Math.max(0, (yb - L) | 0); y <= y1; y++) {
        const j = y * W + x;
        if (idx[j] > 9) continue;
        const u = (yb - y) / L;
        const t = BA[((y & 3) << 2) | (x & 3)];
        const iv = it * Math.pow(1 - u, 1.4) * Math.min(1, (u + 0.03) * 10);
        if (!(iv >= t)) continue;
        idx[j] = u < 0.3 + (t - 0.5) * 0.2 ? I.aur0 : u < 0.62 + (t - 0.5) * 0.2 ? I.aur1 : I.aur2;
      }
    }
  }

  function drawOrbs() {
    if (moonAlt > -0.1 && night > 0.2) {
      const cx = Math.round(moonX);
      const cy = Math.round(moonY);
      const r = 6;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r + 2) continue;
          const y = cy + dy;
          if (y >= WY || y < 0) continue;
          const sh = (dx + 3) * (dx + 3) + (dy - 1) * (dy - 1) > r * r + 6;
          px(cx + dx, y, sh ? I.orbShade : I.orb);
        }
      }
      px(cx - 2, cy - 2, I.orbShade);
      px(cx - 1, cy - 2, I.orbShade);
      px(cx + 1, cy + 1, I.orbShade);
      px(cx - 2, cy + 2, I.orbShade);
      px(cx + 2, cy - 3, I.orbShade);
    }
    if (sunAlt > -0.15) {
      const cx = Math.round(sunX);
      const cy = Math.round(sunY);
      const r = Math.round(7 + (1 - day) * 4);
      const stripes = sunAlt < 0.5;
      for (let dy = -r; dy <= r; dy++) {
        const y = cy + dy;
        if (y >= WY || y < 0) continue;
        if (stripes && dy > 0) {
          const k = dy / r;
          if (((dy + 1) % 3 === 0 && k > 0.15) || ((dy + 2) % 3 === 0 && k > 0.6)) continue;
        }
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r * r + r * 0.6) continue;
          px(cx + dx, y, d2 > (r - 1.3) * (r - 1.3) || dy > r * 0.45 ? I.orbShade : I.orb);
        }
      }
      for (const o of sunRings) {
        if (!o.on) continue;
        const u = 1 - o.life / 0.75;
        const rr = r + 3 + u * 26;
        const fade = 1 - u;
        const n = (rr * 6.3) | 0;
        for (let i = 0; i < n; i++) {
          const an = (i / n) * TAU;
          const x = (cx + Math.cos(an) * rr) | 0;
          const y = (cy + Math.sin(an) * rr * 0.92) | 0;
          if (y < 0 || y >= WY || x < 0 || x >= W) continue;
          if (fade > BA[((y & 3) << 2) | (x & 3)]) idx[y * W + x] = I.halo;
        }
      }
    }
  }

  function drawClouds(lo) {
    for (const c of clouds) {
      if ((c.y > 50) !== lo) continue;
      const s = c.spr;
      const x0 = Math.round(c.x);
      const y0 = Math.round(c.y);
      for (let y = 0; y < s.h; y++) {
        const yy = y0 + y;
        if (yy < 0 || yy >= WY) continue;
        for (let x = 0; x < s.w; x++) {
          const v = s.px[y * s.w + x];
          const xx = x0 + x;
          if (v === 255 || xx < 0 || xx >= W) continue;
          idx[yy * W + xx] = v;
        }
      }
    }
  }
  function moveClouds(dt) {
    for (const c of clouds) {
      c.x += c.spd * (1.5 + wind * 7) * dt;
      if (c.x > W + 4) {
        c.x = -c.spr.w - rnd() * 60;
        c.y = 8 + rnd() * 58;
      }
    }
  }

  function drawShoots() {
    for (const o of shoots) {
      if (!o.on) continue;
      const sp = Math.hypot(o.vx, o.vy);
      const ux = -o.vx / sp;
      const uy = -o.vy / sp;
      const len = 18;
      const fade = Math.min(1, o.life * 5);
      for (let k = 0; k < len; k++) {
        const x = (o.x + ux * k) | 0;
        const y = (o.y + uy * k) | 0;
        if (x < 0 || x >= W || y < 0 || y >= WY) continue;
        const f = (1 - k / len) * fade;
        if (f < BA[((y & 3) << 2) | (x & 3)]) continue;
        idx[y * W + x] = k < 3 ? I.spark : k < 9 ? I.star : I.starDim;
      }
    }
  }

  function drawBolt() {
    if (boltLife <= 0 || (boltLife < 0.12 && ((T * 30) | 0) & 1)) return;
    for (let i = 2; i < boltB; i += 2) line(bolt[i - 2], bolt[i - 1], bolt[i], bolt[i + 1], I.bolt);
    for (let i = boltB + 2; i < boltN; i += 2) line(bolt[i - 2], bolt[i - 1], bolt[i], bolt[i + 1], I.bolt);
  }

  function drawRidges() {
    for (let r = 0; r < 3; r++) {
      const R = RIDGES[r];
      const off = (cam * R.spd) | 0;
      const k = 1 + bass * R.pulse;
      const hz0 = R.base - R.haze;
      for (let x = 0; x < W; x++) {
        const wx = (x + off) & PM;
        const hv = R.h[wx];
        const top = Math.round(R.base - R.amp * hv * k);
        const sl = R.h[(wx + 2) & PM] - R.h[(wx - 2) & PM];
        const lit = sl > 0 ? lightX < x : lightX > x;
        const ld = lit ? R.lit * Math.min(1, Math.abs(sl) * R.slk + 0.3) : 0;
        const snow = R.snow ? (hv - 0.6) * 50 : 0;
        for (let y = top < 0 ? 0 : top; y < WY; y++) {
          const d = y - top;
          const t = BA[((y & 3) << 2) | (x & 3)];
          let c = R.col;
          if (d < snow - t * 4) c = I.snow;
          else if (ld > 0 && d < ld - t * 3 + 1) c = R.hi;
          if (y > hz0 && ((y - hz0) / R.haze) * 0.8 > t) c = R.hz;
          idx[y * W + x] = c;
        }
      }
      if (r === 2) {
        for (let i = 0; i < shore.length; i += 2) {
          let sx = shore[i] - off;
          sx = ((sx % P) + P) % P;
          if (sx >= W + 4) continue;
          const wx = shore[i];
          const top = Math.round(R.base - R.amp * R.h[wx] * k);
          const h = shore[i + 1];
          for (let q = 0; q < h; q++) {
            const half = ((h - 1 - q) * 0.42) | 0;
            const y = top - q;
            for (let dx = -half; dx <= half; dx++) px(sx + dx, y, R.col);
          }
        }
      }
    }
  }

  function drawWater() {
    const ripple = 0.55 + bass * 2.4;
    const glx = sunAlt > -0.05 ? sunX : moonAlt > 0 && night > 0.3 ? moonX : -999;
    const glk = sunAlt > -0.05 ? 1 : 0.6;
    const fr = (T * 7) | 0;
    for (let y = WY; y < H; y++) {
      const dy = y - WY + 1;
      const pz = dy / (H - WY);
      const amp = (0.35 + pz * 1.9) * ripple;
      const ox = Math.round(Math.sin(dy * 0.62 - T * 2.3) * amp + Math.sin(dy * 1.9 + T * 3.1) * amp * 0.35);
      let sy = WY - dy + Math.round(Math.sin(dy * 0.37 + T * 1.7) * 0.6);
      sy = sy < 0 ? 0 : sy > WY - 1 ? WY - 1 : sy;
      const srow = sy * W;
      const row = y * W;
      const by = (y & 3) << 2;
      const deep = pz > 0.6 ? (pz - 0.6) * 0.5 : 0;
      const streak = dy % 4 === 2;
      const dir = dy & 4 ? 1 : -1;
      for (let x = 0; x < W; x++) {
        let sx = x + ox;
        sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx;
        const t = BA[by | (x & 3)];
        let c = deep > t ? I.water : (idx[srow + sx] & 63) + 64;
        if (streak && vn(x * 0.09 + T * (0.3 + pz) * dir, 1 << 20, dy) > 0.84 - pz * 0.06) c = I.waterHi;
        idx[row + x] = c;
      }
      if (glx > -100 && (dy & 1) === 0) {
        const half = 2 + pz * 12 + high * 4;
        for (let k = 0; k < 2; k++) {
          const h1 = hash(y * 977 + fr * 13 + k * 7);
          const h2 = hash(y * 131 + fr * 29 + k * 3);
          const c0 = glx + (h1 - 0.5) * half * 1.4;
          const len = (1 + h2 * half * 0.5 * glk) | 0;
          for (let x = Math.max(0, (c0 - len / 2) | 0), e = Math.min(W - 1, (c0 + len / 2) | 0); x <= e; x++) idx[row + x] = h2 > 0.8 && k === 0 ? I.spark : I.waterHi;
        }
      }
    }
    for (const o of rings) {
      if (!o.on) continue;
      const u = 1 - o.life / o.max;
      const rx = 1 + u * o.r;
      const ry = rx * 0.32;
      const fade = 1 - u;
      for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        const q = 1 - (dx / rx) * (dx / rx);
        if (q < 0) continue;
        const e = Math.round(ry * Math.sqrt(q));
        const x = (o.x + dx) | 0;
        for (let s = -1; s <= 1; s += 2) {
          const y = (o.y + s * e) | 0;
          if (y < WY || y >= H || x < 0 || x >= W) continue;
          if (fade * 1.3 > BA[((y & 3) << 2) | (x & 3)]) idx[y * W + x] = I.waterHi;
        }
      }
    }
    for (const o of fishes) {
      if (!o.on) continue;
      const u = o.t / 0.62;
      const x = o.x + o.d * u * 12;
      const y = o.y - 36 * u * (1 - u);
      const c = night > 0.5 ? I.waterHi : I.bird;
      px(x, y, c);
      px(x - o.d, y + (u < 0.5 ? 1 : -1), c);
      if (u > 0.15 && u < 0.85) px(x + o.d, y + (u < 0.5 ? -1 : 1), c);
    }
  }

  function pine(cx, by, h, s, seed) {
    const trunkH = 3 + ((h * 0.08) | 0);
    const fh = h - trunkH;
    const top = by - h;
    const side = lightX > cx ? 1 : -1;
    for (let y = by - trunkH; y <= by; y++) {
      px(cx, y, I.trunk);
      px(cx - side, y, I.trunk);
    }
    for (let r = 0; r < fh; r++) {
      const u = r / fh;
      const tl = (u * 4.2) % 1;
      const off = Math.round(s * (1 - u) * (1 - u) * 2.6);
      const hw = Math.round((0.6 + u * h * 0.22) * (0.42 + 0.58 * tl));
      const y = top + r;
      if (y < 0 || y >= H) continue;
      for (let dx = -hw; dx <= hw; dx++) {
        const x = cx + off + dx;
        if (x < 0 || x >= W) continue;
        if (Math.abs(dx) === hw && hw > 1 && hash(seed + r * 13 + dx * 7) < 0.4) continue;
        const e = dx * side;
        const t = BA[((y & 3) << 2) | (x & 3)];
        let c = I.tree;
        if (hw > 0 && e >= hw - 1 - (tl > 0.7 ? 1 : 0)) c = I.treeHi;
        else if (tl > 0.82 && e > hw * 0.15 && t < 0.6) c = I.treeHi;
        idx[y * W + x] = c;
      }
    }
  }

  function roundTree(cx, by, spr, s) {
    const trunkH = 11;
    const side = lightX > cx ? 1 : -1;
    for (let y = by - trunkH; y <= by; y++) {
      px(cx, y, I.trunk);
      px(cx + 1, y, I.trunk);
    }
    px(cx - 1, by, I.trunk);
    px(cx + 2, by, I.trunk);
    line(cx, by - 7, cx - 3 * side, by - 10, I.trunk);
    const y0 = by - trunkH - spr.h + 6;
    const x0 = cx - (spr.w >> 1);
    for (let r = 0; r < spr.h; r++) {
      const y = y0 + r;
      if (y < 0 || y >= H) continue;
      const off = Math.round(s * (1 - r / spr.h) * 1.8);
      for (let c = 0; c < spr.w; c++) {
        const j = r * spr.w + c;
        if (!spr.m[j]) continue;
        const x = x0 + c + off;
        if (x < 0 || x >= W) continue;
        const t = BA[((y & 3) << 2) | (x & 3)];
        const l = spr.nx[j] * side - spr.ny[j] * 0.9;
        idx[y * W + x] = l > 0.42 + (t - 0.5) * 0.5 ? I.treeHi : I.tree;
      }
    }
  }

  function drawGround() {
    const off = cam | 0;
    for (let x = 0; x < W; x++) gTop[x] = Math.round(GR.base - GR.amp * GR.h[(x + off) & PM] - bass * 1.6);
    for (let x = 0; x < W; x++) {
      const t0 = gTop[x];
      for (let y = t0 < 0 ? 0 : t0; y < H; y++) {
        const d = y - t0;
        idx[y * W + x] = d === 0 ? I.groundHi : d < 5 && (1 - d / 5) * 0.75 > BA[((y & 3) << 2) | (x & 3)] ? I.grass : I.ground;
      }
    }
    treeSX = -1;
    for (const tr of trees) {
      let sx = (((tr.x - off) % P) + P) % P;
      if (sx > W + 40) sx -= P;
      if (sx < -40 || sx > W + 40) continue;
      const by = gAt(sx) + 1;
      const s = sway(tr.x);
      if (tr.pine) pine(sx, by, tr.h, s, tr.x);
      else roundTree(sx, by, tr.spr, s);
      if (treeSX < 0 && sx > 10 && sx < W - 10) {
        treeSX = sx;
        treeSY = by - (tr.pine ? tr.h : 30);
      }
    }
    const flw = night < 0.55;
    for (let x = 0; x < W; x++) {
      const wx = (x + off) & PM;
      const hb = GH[wx];
      if (!hb) continue;
      const s = sway(wx);
      const t0 = gTop[x];
      for (let k = 1; k <= hb; k++) {
        const xx = x + Math.round((s * k) / 3.5);
        px(xx, t0 - k, k === hb ? I.groundHi : I.grass);
      }
      if (flw && GF[wx]) px(x + Math.round((s * hb) / 3.5), t0 - hb - 1, I.leaf2);
    }
  }

  function drawLife() {
    for (const o of flies) {
      if (!o.on) continue;
      let b = 0.5 + 0.5 * Math.sin(o.ph);
      b *= Math.min(1, o.life * 1.5);
      if (b < 0.25) continue;
      const x = o.x | 0;
      const y = o.y | 0;
      if (b > 0.55) {
        px(x, y, I.fly);
        if (b > 0.85) {
          px(x - 1, y, I.flyDim);
          px(x + 1, y, I.flyDim);
          px(x, y - 1, I.flyDim);
          px(x, y + 1, I.flyDim);
        }
      } else px(x, y, I.flyDim);
    }
    for (const o of leaves) {
      if (!o.on) continue;
      px(o.x, o.y, o.c);
      if (Math.sin(o.ph * 1.7) > 0) px(o.x + 1, o.y, o.c);
      else px(o.x, o.y + 1, o.c);
    }
    for (const o of sparks) {
      if (!o.on) continue;
      const l = o.life / o.max;
      if (l > 0.33 && l < 0.75) {
        px(o.x - 1, o.y, I.waterHi);
        px(o.x + 1, o.y, I.waterHi);
        px(o.x, o.y - 1, I.waterHi);
        px(o.x, o.y + 1, I.waterHi);
        px(o.x, o.y, I.spark);
      } else px(o.x, o.y, l > 0.5 ? I.spark : I.waterHi);
    }
    const sl = 0.12 + wind * 0.12;
    for (const o of drops) {
      if (!o.on) continue;
      for (let k = 0; k < 4; k++) px(Math.round(o.x - sl * k), o.y - k, I.rain);
    }
    for (const o of birds) {
      if (!o.on) continue;
      const f = (o.big ? BIRD2 : BIRD)[(o.ph | 0) & 3];
      const x = Math.round(o.x);
      const y = Math.round(o.y);
      for (let i = 0; i < f.length; i += 2) px(x + f[i], y + f[i + 1], I.bird);
    }
  }

  function grade() {
    const A = palA.rc;
    const B = palB.rc;
    const FA = palA.rf;
    const FB = palB.rf;
    const w = palW;
    const fl = Math.min(1, flash * flash * 1.3);
    const lift = 1 + energy * 0.07 + glowK * 0.05;
    const sat = 1 + energy * 0.3;
    for (let i = 0; i < 128; i++) {
      const o = i * 3;
      let r = A[o] + (B[o] - A[o]) * w;
      let gg = A[o + 1] + (B[o + 1] - A[o + 1]) * w;
      let b = A[o + 2] + (B[o + 2] - A[o + 2]) * w;
      r += (FA[o] + (FB[o] - FA[o]) * w - r) * fl;
      gg += (FA[o + 1] + (FB[o + 1] - FA[o + 1]) * w - gg) * fl;
      b += (FA[o + 2] + (FB[o + 2] - FA[o + 2]) * w - b) * fl;
      const l = r * 0.3 + gg * 0.59 + b * 0.11;
      r = (l + (r - l) * sat) * lift;
      gg = (l + (gg - l) * sat) * lift;
      b = (l + (b - l) * sat) * lift;
      LIVE[i] = (255 << 24) | (Math.min(255, Math.max(0, b)) << 16) | (Math.min(255, Math.max(0, gg)) << 8) | Math.min(255, Math.max(0, r));
    }
  }

  function present() {
    grade();
    const n = W * H;
    for (let i = 0; i < n; i++) buf[i] = LIVE[idx[i]];
    g.putImageData(img, 0, 0);
  }

  function render() {
    drawSky();
    drawStars();
    drawAurora();
    drawOrbs();
    drawClouds(false);
    drawShoots();
    drawBolt();
    drawRidges();
    drawClouds(true);
    drawWater();
    drawGround();
    drawLife();
    present();
  }

  const eq = document.getElementById('eq');
  const eg = eq.getContext('2d');
  function drawEq() {
    if (eq.hidden) return;
    eg.fillStyle = '#0d0b1c';
    eg.fillRect(0, 0, 40, 14);
    for (let i = 0; i < 16; i++) {
      const h = Math.round(clamp((spec[i] - 0.25) / 0.6) * 12);
      eg.fillStyle = '#ffb35e';
      eg.fillRect(1 + i * 2, 13 - h, 1, h);
      if (h > 8) {
        eg.fillStyle = '#ff6a8a';
        eg.fillRect(1 + i * 2, 13 - h, 1, h - 8);
      }
    }
    eg.fillStyle = lamp > 0.3 ? '#fff4d6' : '#3a3050';
    eg.fillRect(34, 4, 5, 5);
    eg.fillStyle = '#6a5a8a';
    eg.fillRect(34, 11, Math.round(bass * 5), 1);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!FREEZE) {
      update(dt);
      moveClouds(dt);
    }
    render();
    drawEq();
    requestAnimationFrame(loop);
  }
  if (DEMO) {
    for (let i = 0; i < 330; i++) {
      update(1 / 60);
      moveClouds(1 / 60);
      if (i % 30 === 0) render();
    }
  }
  const FREEZE = DEMO && qs.has('beat');
  if (FREEZE) {
    onBeat();
    for (let i = 0; i < +qs.get('beat'); i++) update(1 / 60);
    bass = 1;
  }
  render();
  drawEq();
  requestAnimationFrame(loop);

  const body = document.body;
  const msg = document.getElementById('msg');
  const bPlay = document.getElementById('bPlay');
  const start = document.getElementById('start');
  const fileIn = document.getElementById('file');
  const say = (s) => (msg.textContent = s);
  let idleT = 0;
  function wake() {
    body.classList.remove('idle');
    clearTimeout(idleT);
    if (!KEEPUI) idleT = setTimeout(() => body.classList.add('idle'), 3000);
  }
  ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, wake, { passive: true }));
  wake();

  function mark(kind) {
    document.querySelectorAll('[data-src]').forEach((b) => b.classList.toggle('on', b.dataset.src === kind));
    bPlay.textContent = 'PAUSE';
  }
  async function choose(kind, f) {
    start.hidden = true;
    try {
      if (kind === 'demo') await window.ResAudio.demo();
      else if (kind === 'file') await window.ResAudio.file(f);
      else if (kind === 'tab') await window.ResAudio.tab();
      else await window.ResAudio.mic();
      mark(kind);
      say(kind === 'demo' ? 'demo beat · generative synth' : kind === 'file' ? f.name.slice(0, 32) : kind === 'tab' ? 'listening to your tab' : 'listening to your mic');
    } catch (e) {
      say(kind === 'mic' ? 'mic blocked here. try a file or the demo' : kind === 'tab' ? (e.message === 'noaudio' ? 'tick share tab audio and try again' : 'tab capture blocked here. open the page in chrome') : 'could not play that file');
    }
  }
  if (DEMO) start.hidden = true;
  start.addEventListener('click', () => choose('demo'));
  document.querySelectorAll('[data-src]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.src === 'file') fileIn.click();
      else choose(b.dataset.src);
    })
  );
  fileIn.addEventListener('change', () => {
    if (fileIn.files[0]) choose('file', fileIn.files[0]);
    fileIn.value = '';
  });
  function togglePlay() {
    if (window.ResAudio.src === 'none') return choose('demo');
    bPlay.textContent = window.ResAudio.toggle() ? 'PLAY' : 'PAUSE';
  }
  bPlay.addEventListener('click', togglePlay);
  const bEq = document.getElementById('bEq');
  function toggleEq() {
    eq.hidden = !eq.hidden;
    bEq.classList.toggle('on', !eq.hidden);
  }
  bEq.addEventListener('click', toggleEq);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'KeyE') toggleEq();
  });
  addEventListener('dragover', (e) => {
    e.preventDefault();
    body.classList.add('drag');
  });
  addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) body.classList.remove('drag');
  });
  addEventListener('drop', (e) => {
    e.preventDefault();
    body.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('audio')) choose('file', f);
    else say('that is not an audio file');
  });
})();
