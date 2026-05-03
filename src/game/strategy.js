// Basic strategy for 6-deck, Dealer Stands on Soft 17, Double After Split allowed
// H=Hit  S=Stand  D=Double(else Hit)  Ds=Double(else Stand)  SP=Split  R=Surrender(else Hit)

// Dealer upcard → column index (2→0 … 10/J/Q/K→8, A→9)
function dealerIdx(card) {
  if (card.rank === 'A') return 9;
  if (['J','Q','K'].includes(card.rank)) return 8;
  const n = parseInt(card.rank);
  return n - 2; // 2→0, 3→1 … 10→8
}

//                  2     3     4     5     6     7     8     9    10     A
const HARD = {
   4: ['H','H','H','H','H','H','H','H','H','H'],
   5: ['H','H','H','H','H','H','H','H','H','H'],
   6: ['H','H','H','H','H','H','H','H','H','H'],
   7: ['H','H','H','H','H','H','H','H','H','H'],
   8: ['H','H','H','H','H','H','H','H','H','H'],
   9: ['H','D','D','D','D','H','H','H','H','H'],
  10: ['D','D','D','D','D','D','D','D','H','H'],
  11: ['D','D','D','D','D','D','D','D','D','H'],
  12: ['H','H','S','S','S','H','H','H','H','H'],
  13: ['S','S','S','S','S','H','H','H','H','H'],
  14: ['S','S','S','S','S','H','H','H','H','H'],
  15: ['S','S','S','S','S','H','H','H','R','R'],
  16: ['S','S','S','S','S','H','H','R','R','R'],
  17: ['S','S','S','S','S','S','S','S','S','S'],
};

// Soft totals (player holds an Ace counted as 11)
// total = ace(11) + other card(s); range 13 (A+2) to 21 (A+10)
//                  2     3     4     5     6     7     8     9    10     A
const SOFT = {
  13: ['H','H','H','D','D','H','H','H','H','H'],
  14: ['H','H','H','D','D','H','H','H','H','H'],
  15: ['H','H','D','D','D','H','H','H','H','H'],
  16: ['H','H','D','D','D','H','H','H','H','H'],
  17: ['H','D','D','D','D','H','H','H','H','H'],
  18: ['Ds','Ds','Ds','Ds','Ds','S','S','H','H','H'],
  19: ['S','S','S','S','Ds','S','S','S','S','S'],
  20: ['S','S','S','S','S','S','S','S','S','S'],
};

// Pairs — keyed by the numeric value of one card (Ace=11)
//                  2     3     4     5     6     7     8     9    10     A
const PAIRS = {
   2: ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
   3: ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
   4: ['H','H','H','SP','SP','H','H','H','H','H'],
   5: ['D','D','D','D','D','D','D','D','H','H'],   // never split 5s
   6: ['SP','SP','SP','SP','SP','H','H','H','H','H'],
   7: ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
   8: ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'],
   9: ['SP','SP','SP','SP','SP','S','SP','SP','S','S'],
  10: ['S','S','S','S','S','S','S','S','S','S'],
  11: ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'], // Aces
};

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11; }
    else total += c.value;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export function isSoft(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11; }
    else total += c.value;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return aces > 0 && total <= 21;
}

export function isPair(cards) {
  return cards.length === 2 && cards[0].value === cards[1].value;
}

export function getAction(playerCards, dealerUpcard, { canDouble = true, canSplit = true, canSurrender = true } = {}) {
  const di = dealerIdx(dealerUpcard);

  // Pairs
  if (canSplit && isPair(playerCards)) {
    const key = playerCards[0].rank === 'A' ? 11 : playerCards[0].value;
    let a = PAIRS[key]?.[di] ?? 'H';
    if (a === 'SP') return 'SP';
    if (!canDouble && a === 'D') a = 'H';
    return a;
  }

  const total = handValue(playerCards);

  // Soft hands
  if (isSoft(playerCards) && SOFT[total]) {
    let a = SOFT[total][di];
    if (!canDouble && (a === 'D' || a === 'Ds')) a = a === 'Ds' ? 'S' : 'H';
    return a;
  }

  // Hard hands
  if (total >= 21) return 'S';
  if (total <= 8) return 'H';
  let a = HARD[total]?.[di] ?? 'S';
  if (!canDouble && a === 'D') a = 'H';
  if (!canSurrender && a === 'R') a = 'H';
  return a;
}

export function actionLabel(a) {
  return { H:'HIT', S:'STAND', D:'DOUBLE DOWN', Ds:'DOUBLE (or Stand)', SP:'SPLIT', R:'SURRENDER' }[a] ?? a;
}

export function actionExplanation(a, playerCards, dealerUpcard) {
  const total = handValue(playerCards);
  const soft = isSoft(playerCards);
  const pair = isPair(playerCards);
  const dRank = dealerUpcard.rank === 'A' ? 'Ace' :
    ['J','Q','K'].includes(dealerUpcard.rank) ? `${dealerUpcard.rank} (10)` : dealerUpcard.rank;
  const hand = pair ? `pair of ${playerCards[0].rank}s` : soft ? `Soft ${total}` : `Hard ${total}`;

  const map = {
    H:  `${hand} vs dealer ${dRank}: Hitting improves your expected outcome — the dealer has the advantage if you stop here.`,
    S:  `${hand} vs dealer ${dRank}: Standing is correct. The dealer is likely to bust, or you risk busting if you hit.`,
    D:  `${hand} vs dealer ${dRank}: Double down! This is a favorable spot — take exactly one more card for twice the bet.`,
    Ds: `${hand} vs dealer ${dRank}: Double if allowed (great spot); otherwise stand.`,
    SP: `Pair of ${playerCards[0].rank}s vs dealer ${dRank}: Splitting creates two stronger starting hands.`,
    R:  `${hand} vs dealer ${dRank}: Surrender — statistically you lose more by playing this hand than by taking back half your bet.`,
  };
  return map[a] ?? '';
}
