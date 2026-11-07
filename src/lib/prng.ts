// Seeded PRNG (mulberry32). The only source of "randomness" anywhere in this project.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number; // inclusive
  pick<T>(arr: readonly T[]): T;
  sign(): number;
}

export function rng(seed: number): Rng {
  const n = mulberry32(seed);
  return {
    next: n,
    range: (a, b) => a + (b - a) * n(),
    int: (a, b) => a + Math.floor(n() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(n() * arr.length)],
    sign: () => (n() < 0.5 ? -1 : 1),
  };
}

export const wordSeed = (chunk: number, word: number): number => chunk * 1000 + word;
/** Derived seeds for shapes / confetti so they never collide with word seeds. */
export const derivedSeed = (base: number, salt: number): number => (base * 7919 + salt * 104729 + 13) >>> 0;
