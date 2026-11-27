// Seeded value noise: the only randomness the terrain, clouds and tree
// placement use, so one seed always builds the same fjord.
export function makeNoise(seed) {
  let s = seed >>> 0;
  function nextInt() {
    // xorshift32, deterministic for a given seed.
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  }
  function hash(ix, iz) {
    let h = (ix * 374761393 + iz * 668265263 + seed * 974634) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = (h * 1274126177) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967295;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  // Smooth value noise in [-1, 1].
  function noise2(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz) * 2 - 1;
    const b = hash(ix + 1, iz) * 2 - 1;
    const c = hash(ix, iz + 1) * 2 - 1;
    const d = hash(ix + 1, iz + 1) * 2 - 1;
    const u = smooth(fx);
    const v = smooth(fz);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
  }
  // Fractal Brownian motion, 4 octaves.
  function fbm(x, z, octaves = 4) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      sum += noise2(x * freq, z * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }
  // Ridged noise: sharp mountain crests instead of rolling hills.
  function ridged(x, z) {
    const n = fbm(x, z, 4);
    return 1 - Math.abs(n);
  }
  function random() {
    return nextInt() / 4294967295;
  }
  return { noise2, fbm, ridged, random, nextInt };
}
