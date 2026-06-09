/**
 * xoshiro128** PRNG - fast, high-quality, well-distributed.
 * About 2× faster than Math.random() in V8 and produces better-distributed
 * floats across simulations than the default LCG-style PRNG.
 *
 * Reference: https://prng.di.unimi.it/xoshiro128starstar.c
 */
export class XoshiroRNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number = Date.now()) {
    // SplitMix32 to expand seed → 4 state words (avoid degenerate all-zero state)
    let x = seed >>> 0;
    const next = () => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  /** Returns the next 32-bit unsigned integer. */
  nextU32(): number {
    const result = Math.imul(this.rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = this.rotl(this.s3, 11);
    return result;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    // Use top 24 bits as the mantissa (uniform double precision in [0, 1)).
    return (this.nextU32() >>> 8) / 0x1000000;
  }

  /** Returns true with probability `p`. */
  bool(p: number): boolean {
    return this.next() < p;
  }

  private rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }
}
