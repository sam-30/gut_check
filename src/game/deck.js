export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.faceUp = true;
    this.id = `${rank}${suit}-${Math.random().toString(36).slice(2, 7)}`;
  }

  get value() {
    if (this.rank === 'A') return 11;
    if (['J','Q','K'].includes(this.rank)) return 10;
    return parseInt(this.rank);
  }

  get isRed() {
    return this.suit === '♥' || this.suit === '♦';
  }
}

export class Deck {
  constructor(numDecks = 6) {
    this.numDecks = numDecks;
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (let d = 0; d < this.numDecks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push(new Card(suit, rank));
        }
      }
    }
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal() {
    if (this.cards.length < 52) this.reset();
    return this.cards.pop();
  }

  get remaining() {
    return this.cards.length;
  }
}
