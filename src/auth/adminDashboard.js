import { supabase } from './supabase.js';

export class AdminDashboard {
  constructor() {
    this.modal    = document.getElementById('admin-modal');
    this.backdrop = document.getElementById('modal-backdrop');
    this._rows    = [];   // enriched rows (accuracy, wrong added)
    this._sortKey = 'decisions';
    this._sortDir = -1;   // -1 = desc, 1 = asc
    this._filter  = '';
    this._setup();
  }

  _setup() {
    document.getElementById('admin-close')
      .addEventListener('click', () => this.hide());

    document.getElementById('admin-refresh')
      .addEventListener('click', () => this._load());

    document.getElementById('admin-search')
      .addEventListener('input', e => {
        this._filter = e.target.value.toLowerCase();
        this._render();
      });

    document.querySelectorAll('.admin-th[data-sort]').forEach(th =>
      th.addEventListener('click', () => {
        if (this._sortKey === th.dataset.sort) this._sortDir *= -1;
        else { this._sortKey = th.dataset.sort; this._sortDir = -1; }
        this._render();
      })
    );

    this.backdrop.addEventListener('click', () => {
      if (!this.modal.classList.contains('hidden')) this.hide();
    });
  }

  async show() {
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
    document.getElementById('admin-search').value = '';
    this._filter = '';
    await this._load();
  }

  hide() {
    this.modal.classList.add('hidden');
    const otherOpen = ['tutorial-modal', 'chart-modal', 'auth-modal'].some(
      id => !document.getElementById(id).classList.contains('hidden')
    );
    if (!otherOpen) this.backdrop.classList.add('hidden');
  }

  async _load() {
    const status = document.getElementById('admin-status');
    status.textContent = 'Loading…';
    status.className   = 'admin-status';

    const { data, error } = await supabase.rpc('get_all_user_stats');

    if (error) {
      status.textContent = `Error: ${error.message}`;
      status.className   = 'admin-status admin-status-error';
      return;
    }

    this._rows = (data || []).map(r => ({
      ...r,
      wrong:    r.decisions - r.correct,
      accuracy: r.decisions > 0 ? Math.round(r.correct / r.decisions * 100) : -1,
    }));

    status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    this._renderSummary();
    this._render();
  }

  _renderSummary() {
    const rows = this._rows;
    const total       = rows.reduce((s, r) => s + r.decisions, 0);
    const correct     = rows.reduce((s, r) => s + r.correct, 0);
    const avgAcc      = total > 0 ? Math.round(correct / total * 100) : null;
    const active      = rows.filter(r => r.decisions > 0).length;

    document.getElementById('adm-users').textContent     = rows.length;
    document.getElementById('adm-active').textContent    = active;
    document.getElementById('adm-decisions').textContent = total.toLocaleString();
    document.getElementById('adm-accuracy').textContent  = avgAcc !== null ? `${avgAcc}%` : '—';
  }

  _render() {
    const key = this._sortKey;
    const dir = this._sortDir;

    let rows = this._rows.filter(r =>
      !this._filter || r.email.toLowerCase().includes(this._filter)
    );

    rows.sort((a, b) => {
      let av = a[key], bv = b[key];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return av < bv ? -dir : av > bv ? dir : 0;
    });

    // Update sort indicators
    document.querySelectorAll('.admin-th[data-sort]').forEach(th => {
      th.dataset.dir = th.dataset.sort === key ? (dir === -1 ? 'desc' : 'asc') : '';
    });

    const tbody = document.getElementById('admin-tbody');

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="adm-empty">${
        this._filter ? 'No users match that filter.' : 'No data yet.'
      }</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r, i) => {
      const acc      = r.accuracy >= 0 ? `${r.accuracy}%` : '—';
      const accClass = r.accuracy >= 80 ? 'adm-green' : r.accuracy >= 60 ? 'adm-gold' : r.accuracy >= 0 ? 'adm-red' : '';
      const lastSeen = r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—';

      return `<tr class="adm-row">
        <td class="adm-cell adm-rank">${i + 1}</td>
        <td class="adm-cell adm-email" title="${r.email}">${r.email}</td>
        <td class="adm-cell adm-num">${r.decisions.toLocaleString()}</td>
        <td class="adm-cell adm-num adm-green">${r.correct.toLocaleString()}</td>
        <td class="adm-cell adm-num adm-red">${r.wrong.toLocaleString()}</td>
        <td class="adm-cell adm-num ${accClass}">${acc}</td>
        <td class="adm-cell adm-date">${lastSeen}</td>
      </tr>`;
    }).join('');
  }
}
