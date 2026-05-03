import { getAction } from '../game/strategy.js';

// Minimal fake card objects sufficient for strategy lookup
const fc = (rank) => ({
  rank:   String(rank),
  value:  rank === 'A' ? 11 : (['J','Q','K'].includes(String(rank)) ? 10 : Number(rank)),
  suit:   '♠',
  faceUp: true,
  isRed:  false,
  id:     String(rank),
});

const DEALER_RANKS = ['2','3','4','5','6','7','8','9','10','A'];

const COLORS = {
  H:  { bg: '#0d3b66', fg: '#74b9ff', abbr: 'H',   label: 'Hit' },
  S:  { bg: '#1a4731', fg: '#55efc4', abbr: 'S',   label: 'Stand' },
  D:  { bg: '#7d3c00', fg: '#f39c12', abbr: 'D',   label: 'Double' },
  Ds: { bg: '#5a2d00', fg: '#e67e22', abbr: 'D/S', label: 'Double or Stand' },
  SP: { bg: '#2e1760', fg: '#a29bfe', abbr: 'SP',  label: 'Split' },
  R:  { bg: '#5c1313', fg: '#ff7675', abbr: 'R',   label: 'Surrender' },
};

function td(action) {
  const c = COLORS[action] ?? COLORS.H;
  return `<td class="sc-cell" style="background:${c.bg};color:${c.fg}" title="${c.label}">${c.abbr}</td>`;
}

function section(title, rows) {
  let html = `<div class="sc-section">
    <h3 class="sc-title">${title}</h3>
    <div class="sc-scroll"><table class="sc-table">
      <thead><tr><th class="sc-row-head"></th>${DEALER_RANKS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>`;
  for (const row of rows) {
    html += `<tr><td class="sc-row-label">${row.label}</td>`;
    for (const dRank of DEALER_RANKS) {
      const action = getAction(row.hand, fc(dRank), {
        canDouble:    true,
        canSplit:     row.canSplit ?? false,
        canSurrender: true,
      });
      html += td(action);
    }
    html += '</tr>';
  }
  html += '</tbody></table></div></div>';
  return html;
}

function buildChart() {
  const hard = [
    { label: '≤ 8',  hand: [fc(3), fc(5)]  },
    { label: '9',    hand: [fc(4), fc(5)]  },
    { label: '10',   hand: [fc(4), fc(6)]  },
    { label: '11',   hand: [fc(5), fc(6)]  },
    { label: '12',   hand: [fc(4), fc(8)]  },
    { label: '13',   hand: [fc(4), fc(9)]  },
    { label: '14',   hand: [fc(5), fc(9)]  },
    { label: '15',   hand: [fc(6), fc(9)]  },
    { label: '16',   hand: [fc(7), fc(9)]  },
    { label: '17+',  hand: [fc(8), fc(9)]  },
  ];

  const soft = [
    { label: 'A,2',  hand: [fc('A'), fc(2)]  },
    { label: 'A,3',  hand: [fc('A'), fc(3)]  },
    { label: 'A,4',  hand: [fc('A'), fc(4)]  },
    { label: 'A,5',  hand: [fc('A'), fc(5)]  },
    { label: 'A,6',  hand: [fc('A'), fc(6)]  },
    { label: 'A,7',  hand: [fc('A'), fc(7)]  },
    { label: 'A,8',  hand: [fc('A'), fc(8)]  },
    { label: 'A,9',  hand: [fc('A'), fc(9)]  },
  ];

  const pairs = [
    { label: '2,2',   hand: [fc(2),    fc(2)   ], canSplit: true },
    { label: '3,3',   hand: [fc(3),    fc(3)   ], canSplit: true },
    { label: '4,4',   hand: [fc(4),    fc(4)   ], canSplit: true },
    { label: '5,5',   hand: [fc(5),    fc(5)   ], canSplit: true },
    { label: '6,6',   hand: [fc(6),    fc(6)   ], canSplit: true },
    { label: '7,7',   hand: [fc(7),    fc(7)   ], canSplit: true },
    { label: '8,8',   hand: [fc(8),    fc(8)   ], canSplit: true },
    { label: '9,9',   hand: [fc(9),    fc(9)   ], canSplit: true },
    { label: '10,10', hand: [fc(10),   fc(10)  ], canSplit: true },
    { label: 'A,A',   hand: [fc('A'),  fc('A') ], canSplit: true },
  ];

  const legend = `<div class="sc-legend">
    ${Object.entries(COLORS).map(([, c]) =>
      `<span class="sc-leg" style="background:${c.bg};color:${c.fg}">${c.abbr} = ${c.label}</span>`
    ).join('')}
  </div>
  <p class="sc-note">6-deck · Dealer stands on soft 17 · Double after split allowed</p>`;

  return legend +
    section('Hard Totals', hard) +
    section('Soft Totals', soft) +
    section('Pairs', pairs);
}

export class StrategyChart {
  constructor() {
    this.modal    = document.getElementById('chart-modal');
    this.backdrop = document.getElementById('modal-backdrop');
    this.closeBtn = document.getElementById('chart-close');
    this._built   = false;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.backdrop.addEventListener('click', () => {
      if (!this.modal.classList.contains('hidden')) this.hide();
    });
  }

  show() {
    if (!this._built) {
      document.getElementById('chart-body').innerHTML = buildChart();
      this._built = true;
    }
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
  }

  hide() {
    this.modal.classList.add('hidden');
    if (document.getElementById('tutorial-modal').classList.contains('hidden')) {
      this.backdrop.classList.add('hidden');
    }
  }
}
