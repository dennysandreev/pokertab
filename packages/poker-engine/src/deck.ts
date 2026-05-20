import { RANKS, SUITS, type Card } from "./cards.js";

const HASH_OFFSET = 0x811c9dc5;
const HASH_PRIME = 0x01000193;

const hashSeed = (seed: string): number => {
  let hash = HASH_OFFSET;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, HASH_PRIME);
  }

  return hash >>> 0;
};

const createSeededRandom = (seed: string): (() => number) => {
  let state = hashSeed(seed) || 0x9e3779b9;

  return () => {
    state += 0x6d2b79f5;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export const createDeck = (): Card[] => {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }

  return deck;
};

const shuffleCards = (deck: readonly Card[], seed: string): Card[] => {
  const random = createSeededRandom(seed);
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentCard = shuffled[index];
    const targetCard = shuffled[swapIndex];

    if (currentCard === undefined || targetCard === undefined) {
      throw new Error("Shuffle index out of bounds");
    }

    shuffled[index] = targetCard;
    shuffled[swapIndex] = currentCard;
  }

  return shuffled;
};

export const shuffleDeck = (seed: string): Card[] => shuffleCards(createDeck(), seed);
