/** A small, deterministic PRNG. It is not suitable for cryptography. */
export class SeededRandom {
  private readonly initialState: readonly [number, number, number, number];
  private state: [number, number, number, number];

  constructor(seed: string) {
    this.initialState = hashSeed(seed);
    this.state = [...this.initialState];
  }

  next(): number {
    const [a, b, c, d] = this.state;
    const result = rotl(Math.imul(b, 5), 7);
    const output = Math.imul(result, 9) >>> 0;
    const t = (b << 9) >>> 0;

    this.state = [
      (a ^ d) >>> 0,
      (b ^ c) >>> 0,
      (c ^ t) >>> 0,
      rotl(d ^ b, 11),
    ];

    return output / 0x1_0000_0000;
  }

  between(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  integer(min: number, maxInclusive: number): number {
    return Math.floor(this.between(min, maxInclusive + 1));
  }

  chance(probability: number): boolean {
    return this.next() < clamp(probability, 0, 1);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty collection");
    }
    return items[Math.floor(this.next() * items.length)]!;
  }

  fork(label: string): SeededRandom {
    return new SeededRandom(`${this.snapshot()}:${label}`);
  }

  snapshot(): string {
    return this.state.map((value) => value.toString(16).padStart(8, "0")).join("");
  }

  reset(): void {
    this.state = [...this.initialState];
  }
}

export function deterministicUuid(namespace: string, value: string): string {
  const words = hashSeed(`${namespace}:${value}`);
  const bytes = new Uint8Array(16);

  words.forEach((word, wordIndex) => {
    for (let byteIndex = 0; byteIndex < 4; byteIndex += 1) {
      bytes[wordIndex * 4 + byteIndex] =
        (word >>> (byteIndex * 8)) & 0xff;
    }
  });

  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function stableHash(value: unknown): string {
  const serialized = stableStringify(value);
  return hashSeed(serialized)
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function hashSeed(seed: string): [number, number, number, number] {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  let h3 = 0xc0decafe ^ seed.length;
  let h4 = 0x9e3779b9 ^ seed.length;

  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
    h3 = Math.imul(h3 ^ code, 2246822507);
    h4 = Math.imul(h4 ^ code, 3266489909);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const result: [number, number, number, number] = [
    h1 >>> 0,
    h2 >>> 0,
    h3 >>> 0,
    h4 >>> 0,
  ];
  if (result.every((word) => word === 0)) result[0] = 1;
  return result;
}

function rotl(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
