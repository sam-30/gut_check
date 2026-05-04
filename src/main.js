import { GameEngine, State } from './game/engine.js';
import { handValue, isSoft, actionLabel, actionExplanation } from './game/strategy.js';
import { Tutorial } from './tutorial/tutorial.js';
import { StrategyChart } from './ui/strategyChart.js';
import { AuthModal } from './auth/authModal.js';
import { AdminDashboard } from './auth/adminDashboard.js';
import { supabase } from './auth/supabase.js';
import { loadStats, saveStats } from './auth/statsSync.js';

// ── Card rendering ────────────────────────────────────────────────────────────

function makeCardEl(card) {
  const el = document.createElement('div');
  el.className = `card${card.faceUp ? '' : ' face-down'}${card.isRed ? ' red' : ''}`;
  el.dataset.cardId = card.id;
  el.innerHTML = `
    <div class="card-inner">
      <div class="card-front">
        <span class="cr top">${card.rank}</span>
        <span class="cs top">${card.suit}</span>
        <span class="cs center">${card.suit}</span>
        <span class="cr bottom">${card.rank}</span>
        <span class="cs bottom">${card.suit}</span>
      </div>
      <div class="card-back"><div class="back-pattern"></div></div>
    </div>`;
  return el;
}

function appendCard(areaEl, card, animate = true) {
  const el = makeCardEl(card);
  if (animate) el.classList.add('card-enter');
  areaEl.appendChild(el);
  if (animate) requestAnimationFrame(() => el.classList.remove('card-enter'));
  return el;
}

function flipCard(card) {
  const el = document.querySelector(`[data-card-id="${card.id}"]`);
  if (!el) return;
  el.classList.add('flipping');
  setTimeout(() => {
    el.classList.remove('face-down', 'flipping');
  }, 300);
}

function clearArea(areaEl) {
  const cards = areaEl.querySelectorAll('.card');
  cards.forEach(c => {
    c.classList.add('card-exit');
    setTimeout(() => c.remove(), 350);
  });
}

// ── App ───────────────────────────────────────────────────────────────────────

const engine        = new GameEngine();
const tutorial      = new Tutorial();
const strategyChart = new StrategyChart();
const authModal       = new AuthModal();
const adminDashboard  = new AdminDashboard();

// ── Auth state ────────────────────────────────────────────────────────────────

let cloudStats  = { decisions: 0, correct: 0 }; // lifetime totals prior to this session
let currentUser = null;

if (supabase) {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) {
      const stats = await loadStats(currentUser.id);
      cloudStats  = stats || { decisions: 0, correct: 0 };
      _showUserChip(currentUser);
    } else {
      cloudStats = { decisions: 0, correct: 0 };
      _showSignInBtn();
    }
    updateScoreboard();
    _updateStatsScope();
  });
}

// DOM refs
const dealerHandEl     = document.getElementById('dealer-hand');
const dealerTotalEl    = document.getElementById('dealer-total');
const playerContainer  = document.getElementById('player-hands-container');

const btnDeal      = document.getElementById('btn-deal');
const btnNext      = document.getElementById('btn-next');
const btnHit       = document.getElementById('btn-hit');
const btnStand     = document.getElementById('btn-stand');
const btnDouble    = document.getElementById('btn-double');
const btnSplit     = document.getElementById('btn-split');
const btnSurrender = document.getElementById('btn-surrender');

const hintToggle   = document.getElementById('hint-toggle');
const bettingToggle= document.getElementById('betting-toggle');
const hintPanel    = document.getElementById('hint-panel');
const hintSit      = document.getElementById('hint-situation');
const hintAct      = document.getElementById('hint-action');
const hintExp      = document.getElementById('hint-explanation');

const bettingArea  = document.getElementById('betting-area');
const betAmountEl  = document.getElementById('bet-amount');
const bankrollEl   = document.getElementById('bankroll-display');
const clearBetBtn  = document.getElementById('clear-bet');

const resultMsg    = document.getElementById('result-message');
const shoeCount    = document.getElementById('shoe-count');
const decisionToast = document.getElementById('decision-toast');

const scDecisions  = document.getElementById('sc-decisions');
const scCorrect    = document.getElementById('sc-correct');
const scWrong      = document.getElementById('sc-wrong');
const scAccuracy   = document.getElementById('sc-accuracy');
const scBankCell   = document.getElementById('sc-bankroll-cell');
const scBankroll   = document.getElementById('sc-bankroll');

// ── Player hand slots ─────────────────────────────────────────────────────────

function getOrCreateHandSlot(idx) {
  let slot = playerContainer.querySelector(`[data-slot="${idx}"]`);
  if (slot) return slot.querySelector('.hand-area');

  const wrap = document.createElement('div');
  wrap.className = 'hand-slot';
  wrap.dataset.slot = idx;
  wrap.innerHTML = `<div class="hand-area"></div><div class="hand-total"></div>`;
  playerContainer.appendChild(wrap);
  return wrap.querySelector('.hand-area');
}

function getHandSlotTotal(idx) {
  const slot = playerContainer.querySelector(`[data-slot="${idx}"]`);
  return slot?.querySelector('.hand-total') ?? null;
}

function resetPlayerSlots() {
  playerContainer.innerHTML = '';
  // Pre-create slot 0
  getOrCreateHandSlot(0);
}

function setActiveSlot(idx) {
  playerContainer.querySelectorAll('.hand-slot').forEach((s, i) => {
    s.classList.toggle('active-slot', i === idx);
  });
}

function updatePlayerTotal(idx, cards) {
  const el = getHandSlotTotal(idx);
  if (!el) return;
  if (!cards || cards.length === 0) { el.textContent = ''; return; }
  const v = handValue(cards);
  const s = isSoft(cards) && v <= 21;
  el.textContent = v > 21 ? `${v} BUST` : s ? `Soft ${v}` : `${v}`;
  el.className = `hand-total${v > 21 ? ' bust' : ''}`;
}

// ── Engine event handlers ─────────────────────────────────────────────────────

engine.on('stateChange', (state) => {
  setButtons(state);
  if (state === State.IDLE || state === State.BETTING || state === State.PAYOUT) {
    updateHint('Place your bet and deal to begin.', '', '');
  }
});

engine.on('cardDealt', ({ card, to, handIdx }) => {
  if (to === 'dealer') {
    appendCard(dealerHandEl, card);
    const faceUpCards = engine.dealerCards.filter(c => c.faceUp);
    const shown = faceUpCards.length > 0 ? handValue(faceUpCards) : '';
    dealerTotalEl.textContent = shown ? `Showing: ${shown}` : '';
  } else {
    const area = getOrCreateHandSlot(handIdx);
    appendCard(area, card);
    updatePlayerTotal(handIdx, engine.playerHands[handIdx]);
  }
});

engine.on('cardFlipped', ({ card }) => {
  flipCard(card);
  setTimeout(() => {
    const total = handValue(engine.dealerCards);
    dealerTotalEl.textContent = `Total: ${total}`;
  }, 350);
});

engine.on('handSplit', ({ fromIdx, newIdx }) => {
  // Immediately clear and re-render slot 0 with just the remaining card
  const fromArea = playerContainer.querySelector(`[data-slot="${fromIdx}"] .hand-area`);
  if (fromArea) {
    fromArea.innerHTML = '';
    for (const card of engine.playerHands[fromIdx]) appendCard(fromArea, card, false);
    updatePlayerTotal(fromIdx, engine.playerHands[fromIdx]);
  }
  // Create slot 1 and render the split card
  const newArea = getOrCreateHandSlot(newIdx);
  newArea.innerHTML = '';
  for (const card of engine.playerHands[newIdx]) appendCard(newArea, card, false);
  updatePlayerTotal(newIdx, engine.playerHands[newIdx]);
});

engine.on('handBust', ({ handIdx }) => {
  const el = getHandSlotTotal(handIdx);
  if (el) el.className = 'hand-total bust';
  flashResult('BUST!', 'lose');
});

engine.on('playerTurn', ({ handIdx, hand, available, ideal, practical }) => {
  setActiveSlot(handIdx);
  updatePlayerTotal(handIdx, hand);
  setPlayerButtons(available);

  // Hint panel
  if (hintPanel.classList.contains('hint-visible')) {
    const total = handValue(hand);
    const soft  = isSoft(hand);
    const upcard = engine.dealerUpcard;
    const dRank  = upcard.rank === 'A' ? 'Ace' :
      ['J','Q','K'].includes(upcard.rank) ? `${upcard.rank} (10)` : upcard.rank;
    const handDesc = hand.length === 2 && hand[0].value === hand[1].value
      ? `Pair of ${hand[0].rank}s`
      : soft ? `Soft ${total}` : `Hard ${total}`;
    updateHint(
      `${handDesc} vs Dealer ${dRank}`,
      actionLabel(ideal),
      actionExplanation(ideal, hand, upcard),
      ideal,
    );
  }
});

engine.on('decision', ({ isCorrect, idealAction }) => {
  updateScoreboard();
  const feedbackClass = isCorrect ? 'decision-correct' : 'decision-wrong';
  const bar = document.getElementById('action-bar');
  bar.classList.add(feedbackClass);
  setTimeout(() => bar.classList.remove(feedbackClass), 700);
  showToast(isCorrect, idealAction);
});

engine.on('result', ({ type, text }) => {
  flashResult(text, type);
  // Show full dealer total
  const dt = handValue(engine.dealerCards);
  dealerTotalEl.textContent = `Total: ${dt > 21 ? dt + ' (BUST)' : dt}`;
});

engine.on('handComplete', async ({ results }) => {
  updateScoreboard();
  if (engine.bettingMode) {
    bankrollEl.textContent = fmt(engine.bankroll);
    scBankroll.textContent = fmt(engine.bankroll);
  }
  if (currentUser) {
    const s = engine.scorer;
    await saveStats(
      currentUser.id,
      cloudStats.decisions + s.decisions,
      cloudStats.correct   + s.correct,
    );
  }
});

engine.on('bankrollChanged', (amount) => {
  bankrollEl.textContent = fmt(amount);
  scBankroll.textContent = fmt(amount);
});

engine.on('shoeCount', (n) => {
  shoeCount.textContent = n;
});

engine.on('betChanged', ({ bet, bankroll }) => {
  betAmountEl.textContent = `$${bet}`;
  bankrollEl.textContent  = fmt(bankroll);
  // Enable DEAL when a valid bet has been placed
  if (engine.bettingMode && [State.IDLE, State.PAYOUT].includes(engine.state)) {
    btnDeal.disabled = bet <= 0;
  }
});

// ── Button wiring ─────────────────────────────────────────────────────────────

btnDeal.addEventListener('click',      () => engine.deal());
btnNext.addEventListener('click',      () => nextHand());
btnHit.addEventListener('click',       () => engine.hit());
btnStand.addEventListener('click',     () => engine.stand());
btnDouble.addEventListener('click',    () => engine.double());
btnSplit.addEventListener('click',     () => engine.split());
btnSurrender.addEventListener('click', () => engine.surrender());

document.querySelectorAll('.chip[data-value]').forEach(chip => {
  chip.addEventListener('click', () => engine.setBet(parseInt(chip.dataset.value)));
});
clearBetBtn.addEventListener('click', () => engine.clearBet());

hintToggle.addEventListener('click', () => {
  const active = hintToggle.dataset.active === 'true';
  const next   = !active;
  hintToggle.dataset.active = next;
  hintToggle.querySelector('.toggle-pill').textContent = next ? 'ON' : 'OFF';
  hintToggle.querySelector('.toggle-pill').classList.toggle('active', next);
  hintPanel.classList.toggle('hint-visible', next);
});

bettingToggle.addEventListener('click', () => {
  const active = bettingToggle.dataset.active === 'true';
  const next   = !active;
  bettingToggle.dataset.active = next;
  bettingToggle.querySelector('.toggle-pill').textContent = next ? 'ON' : 'OFF';
  bettingToggle.querySelector('.toggle-pill').classList.toggle('active', next);
  engine.bettingMode = next;
  bettingArea.classList.toggle('hidden', !next);
  scBankCell.classList.toggle('hidden', !next);
  if (next) {
    engine.currentBet = 0;
    engine.bankroll   = 1000;
    bankrollEl.textContent = fmt(engine.bankroll);
    betAmountEl.textContent = '$0';
    scBankroll.textContent = fmt(engine.bankroll);
  }
  setButtons(engine.state);
});

document.getElementById('tutorial-btn').addEventListener('click', () => tutorial.show(0));
document.getElementById('chart-btn').addEventListener('click',    () => strategyChart.show());
document.getElementById('auth-btn').addEventListener('click', () => authModal.show('signin'));
document.getElementById('admin-btn').addEventListener('click', () => adminDashboard.show());
document.getElementById('signout-btn').addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

let _toastTimer = null;
function showToast(isCorrect, idealAction) {
  clearTimeout(_toastTimer);
  decisionToast.className = isCorrect ? 'toast-correct' : 'toast-wrong';
  decisionToast.textContent = isCorrect
    ? '✓ Correct!'
    : `✗ Wrong — book says: ${actionLabel(idealAction)}`;
  _toastTimer = setTimeout(() => {
    decisionToast.classList.add('toast-fade');
    setTimeout(() => {
      decisionToast.className = 'hidden';
    }, 400);
  }, 2200);
}

function nextHand() {
  resultMsg.classList.add('hidden');
  resultMsg.className = 'hidden';
  clearArea(dealerHandEl);
  dealerTotalEl.textContent = '';
  resetPlayerSlots();
  engine.state = State.IDLE;

  if (engine.bettingMode) {
    // In betting mode, carry the bet over then let the player confirm before dealing
    engine.currentBet = Math.min(engine.currentBet, engine.bankroll);
    betAmountEl.textContent = `$${engine.currentBet}`;
    engine.emit('stateChange', State.IDLE);
    setButtons(State.IDLE);
    updateHint('Adjust your bet and click DEAL to continue.', '', '');
  } else {
    // In free-play mode, deal immediately — no extra click needed
    engine.deal();
  }
}

function setButtons(state) {
  const playing  = state === State.PLAYER_TURN;
  const dealable = [State.IDLE, State.PAYOUT].includes(state) &&
                   (!engine.bettingMode || engine.currentBet > 0);
  const betting  = state === State.BETTING;

  btnDeal.disabled      = !(dealable || betting);
  btnNext.disabled      = state !== State.PAYOUT;
  btnHit.disabled       = !playing;
  btnStand.disabled     = !playing;
  btnDouble.disabled    = !playing;
  btnSplit.disabled     = !playing;
  btnSurrender.disabled = !playing;

  btnDeal.classList.toggle('hidden', state === State.PAYOUT);
  btnNext.classList.toggle('hidden', state !== State.PAYOUT);
}

function setPlayerButtons(available) {
  btnHit.disabled       = !available.hit;
  btnStand.disabled     = !available.stand;
  btnDouble.disabled    = !available.double;
  btnSplit.disabled     = !available.split;
  btnSurrender.disabled = !available.surrender;
}

function updateHint(situation, action, explanation, actionCode) {
  hintSit.textContent = situation;
  hintAct.textContent = action;
  hintAct.className   = `hint-act${actionCode ? ' act-' + actionCode : ''}`;
  hintExp.textContent = explanation;
}

function flashResult(text, type) {
  resultMsg.textContent = text;
  resultMsg.className   = `result-msg result-${type}`;
  resultMsg.classList.remove('hidden');
}

function updateScoreboard() {
  const s = engine.scorer;
  const d = cloudStats.decisions + s.decisions;
  const c = cloudStats.correct   + s.correct;
  const w = d - c;
  const a = d > 0 ? Math.round(c / d * 100) : null;
  scDecisions.textContent = d;
  scCorrect.textContent   = c;
  scWrong.textContent     = w;
  scAccuracy.textContent  = a !== null ? `${a}%` : '—';
}

function fmt(n) {
  return `$${n.toLocaleString()}`;
}

async function _showUserChip(user) {
  document.getElementById('auth-btn').classList.add('hidden');
  const name  = user.user_metadata?.full_name || user.email || '?';
  const short = user.email ? user.email.split('@')[0] : name;
  document.getElementById('user-avatar').textContent      = name[0].toUpperCase();
  document.getElementById('user-email-short').textContent = short;
  document.getElementById('user-chip').classList.remove('hidden');

  // Show the admin button only if the logged-in user is the designated admin
  const adminBtn = document.getElementById('admin-btn');
  if (supabase) {
    const { data: isAdmin } = await supabase.rpc('is_admin');
    adminBtn.classList.toggle('hidden', !isAdmin);
  } else {
    adminBtn.classList.add('hidden');
  }
}

function _showSignInBtn() {
  document.getElementById('auth-btn').classList.remove('hidden');
  document.getElementById('user-chip').classList.add('hidden');
  document.getElementById('admin-btn').classList.add('hidden');
}

function _updateStatsScope() {
  const el = document.getElementById('stats-scope');
  if (el) el.textContent = currentUser ? 'Lifetime' : 'This Session';
}

// ── Init ──────────────────────────────────────────────────────────────────────

resetPlayerSlots();
hintPanel.classList.add('hint-visible'); // hints on by default
setButtons(State.IDLE);
btnDeal.disabled = false;

tutorial.maybeShowOnFirstVisit();
