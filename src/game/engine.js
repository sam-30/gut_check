import { Deck } from './deck.js';
import { Scorer } from './scorer.js';
import { getAction, handValue, isSoft, isPair } from './strategy.js';

export const State = {
  IDLE:        'idle',
  BETTING:     'betting',
  DEALING:     'dealing',
  PLAYER_TURN: 'player_turn',
  DEALER_TURN: 'dealer_turn',
  PAYOUT:      'payout',
};

export class GameEngine {
  constructor() {
    this.deck    = new Deck(6);
    this.scorer  = new Scorer();
    this.state   = State.IDLE;
    this._listeners = {};

    // Settings
    this.bettingMode = false;

    // Betting state
    this.bankroll   = 1000;
    this.currentBet = 25;

    // Hand state
    this.dealerCards  = [];
    this.playerHands  = [[]];   // array of hands (splits create more)
    this.handBets     = [25];
    this.handResults  = [];     // 'win'|'lose'|'push'|'bust'|'blackjack'|'surrender'|'stood'
    this.activeIdx    = 0;
  }

  // ── Event bus ──────────────────────────────────────────────────────
  on(evt, fn)   { (this._listeners[evt] ??= []).push(fn); return this; }
  off(evt, fn)  { this._listeners[evt] = (this._listeners[evt] ?? []).filter(f => f !== fn); }
  emit(evt, d)  { (this._listeners[evt] ?? []).forEach(fn => fn(d)); }

  // ── Computed ───────────────────────────────────────────────────────
  get activeHand()   { return this.playerHands[this.activeIdx]; }
  get dealerUpcard() { return this.dealerCards[0]; }

  get availableActions() {
    if (this.state !== State.PLAYER_TURN) return {};
    const hand = this.activeHand;
    const total = handValue(hand);
    const bet   = this.handBets[this.activeIdx];

    const canDouble    = hand.length === 2 && (!this.bettingMode || this.bankroll >= bet);
    const canSplit     = hand.length === 2 && isPair(hand) && this.playerHands.length < 4
                          && (!this.bettingMode || this.bankroll >= bet);
    const canSurrender = hand.length === 2 && this.playerHands.length === 1 && this.activeIdx === 0;
    const canHit       = total < 21;

    return { hit: canHit, stand: true, double: canDouble, split: canSplit, surrender: canSurrender };
  }

  get idealAction() {
    if (this.state !== State.PLAYER_TURN) return null;
    return getAction(this.activeHand, this.dealerUpcard); // all options allowed (ideal)
  }

  get practicalAction() {
    if (this.state !== State.PLAYER_TURN) return null;
    return getAction(this.activeHand, this.dealerUpcard, this.availableActions);
  }

  // ── Public actions ─────────────────────────────────────────────────
  async startOrBet() {
    if (this.bettingMode) {
      this._transitionTo(State.BETTING);
    } else {
      await this.deal();
    }
  }

  setBet(amount) {
    if (![State.IDLE, State.BETTING, State.PAYOUT].includes(this.state)) return;
    const max = this.bettingMode ? this.bankroll : Infinity;
    this.currentBet = Math.max(0, Math.min(this.currentBet + amount, max));
    this.emit('betChanged', { bet: this.currentBet, bankroll: this.bankroll });
  }

  clearBet() {
    this.currentBet = 0;
    this.emit('betChanged', { bet: 0, bankroll: this.bankroll });
  }

  async deal() {
    if (![State.IDLE, State.BETTING, State.PAYOUT].includes(this.state)) return;
    if (this.bettingMode && this.currentBet <= 0) return;

    // Reset hand state
    this.dealerCards = [];
    this.playerHands = [[]];
    this.handBets    = [this.currentBet];
    this.handResults = [undefined];
    this.activeIdx   = 0;

    if (this.bettingMode) {
      this.bankroll -= this.currentBet;
      this.emit('bankrollChanged', this.bankroll);
    }

    this._transitionTo(State.DEALING);

    const seq = [
      { to: 'player', idx: 0,    up: true  },
      { to: 'dealer', idx: null, up: true  },
      { to: 'player', idx: 0,    up: true  },
      { to: 'dealer', idx: null, up: false },  // hole card
    ];

    for (const step of seq) {
      const card = this.deck.deal();
      card.faceUp = step.up;
      if (step.to === 'dealer') this.dealerCards.push(card);
      else                      this.playerHands[step.idx].push(card);
      this.emit('cardDealt', { card, to: step.to, handIdx: step.idx ?? 0 });
      await this._wait(380);
    }

    this.emit('shoeCount', this.deck.remaining);

    const playerTotal = handValue(this.playerHands[0]);

    // Natural blackjack check
    if (playerTotal === 21) {
      await this._revealHole();
      const dealerTotal = handValue(this.dealerCards);
      if (dealerTotal === 21) {
        this.handResults = ['push'];
        if (this.bettingMode) this._addToBank(this.handBets[0]); // return bet
        this.emit('result', { type: 'push', text: 'PUSH — Both Blackjack!' });
      } else {
        this.handResults = ['blackjack'];
        if (this.bettingMode) this._addToBank(Math.floor(this.handBets[0] * 2.5)); // 3:2
        this.emit('result', { type: 'win', text: 'BLACKJACK! 🂡 Pays 3 to 2!' });
      }
      this._transitionTo(State.PAYOUT);
      this.emit('handComplete', { results: this.handResults });
      return;
    }

    this._transitionTo(State.PLAYER_TURN);
    this._emitPlayerTurn();
  }

  async hit() {
    if (!this._inPlayerTurn() || !this.availableActions.hit) return;
    this._recordDecision('H');

    const card = this.deck.deal();
    card.faceUp = true;
    this.activeHand.push(card);
    this.emit('cardDealt', { card, to: 'player', handIdx: this.activeIdx });
    this.emit('shoeCount', this.deck.remaining);
    await this._wait(350);

    const total = handValue(this.activeHand);
    if (total > 21) {
      this.handResults[this.activeIdx] = 'bust';
      this.emit('handBust', { handIdx: this.activeIdx });
      await this._nextHandOrDealer();
    } else if (total === 21) {
      this.handResults[this.activeIdx] = 'stood';
      await this._nextHandOrDealer();
    } else {
      this._emitPlayerTurn();
    }
  }

  async stand() {
    if (!this._inPlayerTurn()) return;
    this._recordDecision('S');
    this.handResults[this.activeIdx] = 'stood';
    await this._nextHandOrDealer();
  }

  async double() {
    if (!this._inPlayerTurn() || !this.availableActions.double) return;
    this._recordDecision('D');

    if (this.bettingMode) {
      const extra = this.handBets[this.activeIdx];
      this.bankroll -= extra;
      this.handBets[this.activeIdx] *= 2;
      this.emit('bankrollChanged', this.bankroll);
    }

    const card = this.deck.deal();
    card.faceUp = true;
    this.activeHand.push(card);
    this.emit('cardDealt', { card, to: 'player', handIdx: this.activeIdx });
    this.emit('shoeCount', this.deck.remaining);
    await this._wait(350);

    const total = handValue(this.activeHand);
    this.handResults[this.activeIdx] = total > 21 ? 'bust' : 'stood';
    if (total > 21) this.emit('handBust', { handIdx: this.activeIdx });
    await this._nextHandOrDealer();
  }

  async split() {
    if (!this._inPlayerTurn() || !this.availableActions.split) return;
    this._recordDecision('SP');

    if (this.bettingMode) {
      this.bankroll -= this.handBets[this.activeIdx];
      this.emit('bankrollChanged', this.bankroll);
    }

    // Pull one card into a new hand
    const splitCard = this.activeHand.pop();
    const newHand   = [splitCard];
    this.playerHands.push(newHand);
    this.handBets.push(this.handBets[this.activeIdx]);
    this.handResults.push(undefined);

    this.emit('handSplit', { fromIdx: this.activeIdx, newIdx: this.playerHands.length - 1 });

    // Deal one card to current hand
    const c1 = this.deck.deal(); c1.faceUp = true;
    this.activeHand.push(c1);
    this.emit('cardDealt', { card: c1, to: 'player', handIdx: this.activeIdx });
    await this._wait(380);

    // Deal one card to new hand
    const c2 = this.deck.deal(); c2.faceUp = true;
    newHand.push(c2);
    this.emit('cardDealt', { card: c2, to: 'player', handIdx: this.playerHands.length - 1 });
    this.emit('shoeCount', this.deck.remaining);
    await this._wait(380);

    // Aces only get one card each
    if (this.activeHand[0].rank === 'A') {
      for (let i = this.activeIdx; i < this.playerHands.length; i++) {
        this.handResults[i] = 'stood';
      }
      await this._nextHandOrDealer();
    } else {
      this._emitPlayerTurn();
    }
  }

  async surrender() {
    if (!this._inPlayerTurn() || !this.availableActions.surrender) return;
    this._recordDecision('R');

    this.handResults = ['surrender'];
    if (this.bettingMode) this._addToBank(Math.floor(this.handBets[0] / 2));

    this.emit('result', { type: 'surrender', text: 'Surrender — half bet returned.' });
    this._transitionTo(State.PAYOUT);
    this.emit('handComplete', { results: this.handResults });
  }

  // ── Dealer play ────────────────────────────────────────────────────
  async _nextHandOrDealer() {
    const next = this.activeIdx + 1;
    if (next < this.playerHands.length) {
      this.activeIdx = next;
      this._emitPlayerTurn();
    } else {
      await this._dealerPlay();
    }
  }

  async _dealerPlay() {
    this._transitionTo(State.DEALER_TURN);
    await this._revealHole();
    await this._wait(400);

    const hasLiveHand = this.handResults.some(r => r !== 'bust' && r !== 'surrender');
    if (hasLiveHand) {
      while (handValue(this.dealerCards) < 17) {
        const card = this.deck.deal(); card.faceUp = true;
        this.dealerCards.push(card);
        this.emit('cardDealt', { card, to: 'dealer', handIdx: 0 });
        this.emit('shoeCount', this.deck.remaining);
        await this._wait(500);
      }
    }

    this._resolveAll();
  }

  _resolveAll() {
    const dealerTotal = handValue(this.dealerCards);
    const dealerBust  = dealerTotal > 21;
    const msgs = [];

    for (let i = 0; i < this.playerHands.length; i++) {
      const r = this.handResults[i];
      if (r === 'bust' || r === 'surrender') continue;

      const pt = handValue(this.playerHands[i]);
      if (dealerBust || pt > dealerTotal) {
        this.handResults[i] = 'win';
        if (this.bettingMode) this._addToBank(this.handBets[i] * 2);
        msgs.push(this.playerHands.length > 1 ? `Hand ${i+1}: WIN` : 'YOU WIN!');
      } else if (pt < dealerTotal) {
        this.handResults[i] = 'lose';
        msgs.push(this.playerHands.length > 1 ? `Hand ${i+1}: LOSE` : 'DEALER WINS');
      } else {
        this.handResults[i] = 'push';
        if (this.bettingMode) this._addToBank(this.handBets[i]);
        msgs.push(this.playerHands.length > 1 ? `Hand ${i+1}: PUSH` : 'PUSH');
      }
    }

    const wins   = this.handResults.filter(r => r === 'win').length;
    const losses = this.handResults.filter(r => r === 'lose' || r === 'bust').length;
    const prefix = dealerBust ? 'Dealer busts! ' : '';

    // Only show a result banner if at least one non-bust/surrender hand was resolved
    if (msgs.length > 0) {
      const type = wins > losses ? 'win' : losses > wins ? 'lose' : 'push';
      this.emit('result', { type, text: prefix + msgs.join(' · ') });
    }
    this._transitionTo(State.PAYOUT);
    this.emit('handComplete', { results: this.handResults, dealerTotal });
  }

  // ── Helpers ────────────────────────────────────────────────────────
  _transitionTo(s) {
    this.state = s;
    this.emit('stateChange', s);
  }

  _inPlayerTurn() { return this.state === State.PLAYER_TURN; }

  _emitPlayerTurn() {
    this.emit('playerTurn', {
      handIdx:       this.activeIdx,
      hand:          this.activeHand,
      dealerUpcard:  this.dealerUpcard,
      available:     this.availableActions,
      ideal:         this.idealAction,
      practical:     this.practicalAction,
    });
  }

  async _revealHole() {
    const hole = this.dealerCards.find(c => !c.faceUp);
    if (!hole) return;
    hole.faceUp = true;
    this.emit('cardFlipped', { card: hole, to: 'dealer' });
    await this._wait(350);
  }

  _addToBank(amount) {
    this.bankroll += amount;
    this.emit('bankrollChanged', this.bankroll);
  }

  _recordDecision(playerAction) {
    const ideal     = this.idealAction;
    const avail     = this.availableActions;
    const practical = this.practicalAction;

    // Correct if they matched the ideal, OR if ideal wasn't available and they
    // matched the practical fallback, OR standard fallback patterns:
    // D→H (can't double), Ds→S (can't double), R→H (can't surrender)
    let isCorrect =
      playerAction === ideal ||
      (ideal === 'D'  && !avail.double    && playerAction === 'H')  ||
      (ideal === 'Ds' && !avail.double    && playerAction === 'S')  ||
      (ideal === 'R'  && !avail.surrender && playerAction === 'H')  ||
      (ideal === 'SP' && !avail.split     && playerAction === practical);

    this.scorer.record(isCorrect);
    this.emit('decision', {
      playerAction,
      idealAction: ideal,
      isCorrect,
      hand:        [...this.activeHand],
      dealerUpcard: this.dealerUpcard,
    });
  }

  _wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}
