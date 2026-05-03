const SLIDES = [
  {
    title: '🂡 Welcome to Gut Check',
    body: `
      <p>Gut Check is a blackjack strategy trainer that teaches you to play <strong>perfect basic strategy</strong> — the mathematically optimal way to play every hand.</p>
      <p>Master basic strategy and the house edge drops to under <strong>0.5%</strong>. This trainer tracks every decision and scores your accuracy.</p>
      <p>Use the hint panel on the right to see the correct move and why before you decide.</p>
    `,
  },
  {
    title: '🎯 The Goal of Basic Strategy',
    body: `
      <p>Basic strategy is a lookup table: given <em>your hand</em> and the <em>dealer's upcard</em>, it tells you the statistically best move.</p>
      <ul>
        <li><strong>Hit</strong> — take another card</li>
        <li><strong>Stand</strong> — keep your hand</li>
        <li><strong>Double Down</strong> — double your bet, take exactly one more card</li>
        <li><strong>Split</strong> — split a pair into two separate hands</li>
        <li><strong>Surrender</strong> — fold and get half your bet back</li>
      </ul>
      <p>The dealer's face-up card is the key — always look at it before deciding.</p>
    `,
  },
  {
    title: '🃏 Hand Values',
    body: `
      <p>Number cards are worth their face value. Face cards (J, Q, K) are worth <strong>10</strong>. The Ace is special:</p>
      <ul>
        <li>An Ace counts as <strong>11</strong> if it doesn't bust you — called a <em>soft</em> hand</li>
        <li>An Ace counts as <strong>1</strong> when 11 would bust — called a <em>hard</em> hand</li>
      </ul>
      <p>Example: Ace + 6 = <strong>Soft 17</strong>. If you hit and get a 10, it becomes <strong>Hard 17</strong>. You can never bust a soft hand in one hit.</p>
    `,
  },
  {
    title: '📏 Core Strategy Rules',
    body: `
      <p>Here are the most important rules to memorize:</p>
      <ul>
        <li><strong>Always split Aces and 8s</strong></li>
        <li><strong>Never split 10s or 5s</strong></li>
        <li><strong>Double on 11</strong> (vs most dealer cards); double on 10 vs 2–9</li>
        <li><strong>Stand on hard 17+</strong> always</li>
        <li><strong>Stand on 12–16 when dealer shows 2–6</strong> (dealer likely busts)</li>
        <li><strong>Hit on 12–16 when dealer shows 7+</strong></li>
      </ul>
    `,
  },
  {
    title: '🔢 Dealer Rules',
    body: `
      <p>The dealer has no choices — they follow fixed rules:</p>
      <ul>
        <li>Must <strong>hit</strong> on any total of 16 or less</li>
        <li>Must <strong>stand</strong> on any total of 17 or more</li>
      </ul>
      <p>This means when the dealer shows a <strong>2–6</strong>, they're likely to bust. That's why basic strategy says to stand with weak hands — let the dealer fail.</p>
      <p>When the dealer shows <strong>7–Ace</strong>, they're strong. You need to fight back by hitting more aggressively.</p>
    `,
  },
  {
    title: '💰 Betting Mode',
    body: `
      <p>Toggle <strong>Betting Mode</strong> in the header to add a real chip experience:</p>
      <ul>
        <li>You start with <strong>$1,000</strong> in chips</li>
        <li>Choose your bet using the chip tray before each hand</li>
        <li>Blackjack pays <strong>3 to 2</strong></li>
        <li>Surrender returns <strong>half your bet</strong></li>
        <li>Split and Double Down use additional chips</li>
      </ul>
      <p>In non-betting mode, the focus is purely on strategy — every hand is dealt automatically with a flat bet.</p>
    `,
  },
  {
    title: '📊 Your Score',
    body: `
      <p>The scoreboard tracks every decision against basic strategy:</p>
      <ul>
        <li><strong>Accuracy %</strong> — your overall correct-decision rate</li>
        <li><strong>Correct / Wrong</strong> — running counts of decisions</li>
      </ul>
      <p>The <strong>Hints toggle</strong> in the header shows or hides the strategy panel. Try hiding hints to test yourself — you can always flip them back on.</p>
      <p>Aim for <strong>95%+ accuracy</strong>. Most casino players play at 75–85%. Perfect strategy is learnable with practice!</p>
    `,
  },
];

export class Tutorial {
  constructor() {
    this.step     = 0;
    this.modal    = document.getElementById('tutorial-modal');
    this.backdrop = document.getElementById('modal-backdrop');
    this.body     = document.getElementById('tutorial-body');
    this.prevBtn  = document.getElementById('tut-prev');
    this.nextBtn  = document.getElementById('tut-next');
    this.dots     = document.getElementById('tut-dots');
    this.closeBtn = document.getElementById('tutorial-close');

    this.closeBtn.addEventListener('click', () => this.hide());
    this.backdrop.addEventListener('click', () => {
      if (!this.modal.classList.contains('hidden')) this.hide();
    });
    this.prevBtn.addEventListener('click',  () => this.go(this.step - 1));
    this.nextBtn.addEventListener('click',  () => {
      if (this.step === SLIDES.length - 1) this.hide();
      else this.go(this.step + 1);
    });
  }

  show(step = 0) {
    this.step = step;
    this._render();
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
  }

  hide() {
    this.modal.classList.add('hidden');
    this.backdrop.classList.add('hidden');
    localStorage.setItem('tutorialSeen', '1');
  }

  go(step) {
    if (step < 0 || step >= SLIDES.length) return;
    this.step = step;
    this._render();
  }

  _render() {
    const slide = SLIDES[this.step];
    const n     = SLIDES.length;

    this.body.innerHTML = `<h2 class="tut-title">${slide.title}</h2><div class="tut-body">${slide.body}</div>`;
    this.prevBtn.disabled = this.step === 0;
    this.nextBtn.textContent = this.step === n - 1 ? 'Start Playing ✓' : 'Next →';

    this.dots.innerHTML = SLIDES.map((_, i) =>
      `<span class="dot${i === this.step ? ' active' : ''}"></span>`
    ).join('');
  }

  maybeShowOnFirstVisit() {
    if (!localStorage.getItem('tutorialSeen')) {
      // Small delay so the table renders first
      setTimeout(() => this.show(0), 600);
    }
  }
}
