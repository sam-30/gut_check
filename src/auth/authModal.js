import { supabase } from './supabase.js';

export class AuthModal {
  constructor() {
    this.modal    = document.getElementById('auth-modal');
    this.backdrop = document.getElementById('modal-backdrop');
    this._tab     = 'signin';
    if (supabase) this._setup();
  }

  _setup() {
    document.getElementById('auth-close')
      .addEventListener('click', () => this.hide());

    this.modal.querySelectorAll('.auth-tab').forEach(tab =>
      tab.addEventListener('click', () => this._showTab(tab.dataset.tab))
    );

    document.getElementById('auth-google')
      .addEventListener('click', () => this._oauthSignIn('google'));
    document.getElementById('auth-apple')
      .addEventListener('click',  () => this._oauthSignIn('apple'));

    document.getElementById('auth-form')
      .addEventListener('submit', e => this._handleSubmit(e));

    document.getElementById('auth-forgot')
      .addEventListener('click', () => this._handleForgot());

    this.modal.querySelectorAll('.auth-back')
      .forEach(btn => btn.addEventListener('click', () => this._showTab('signin')));

    this.backdrop.addEventListener('click', () => {
      if (!this.modal.classList.contains('hidden')) this.hide();
    });
  }

  show(tab = 'signin') {
    if (!supabase) return;
    this._showTab(tab);
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
  }

  hide() {
    this.modal.classList.add('hidden');
    const otherOpen = ['tutorial-modal', 'chart-modal'].some(
      id => !document.getElementById(id).classList.contains('hidden')
    );
    if (!otherOpen) this.backdrop.classList.add('hidden');
  }

  _showTab(tab) {
    this._tab = tab;
    this.modal.querySelectorAll('.auth-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab)
    );
    this._showSection('auth-form-area');
    const isSignin = tab === 'signin';
    document.getElementById('auth-submit').textContent    = isSignin ? 'Sign In' : 'Create Account';
    document.getElementById('auth-forgot').style.display  = isSignin ? '' : 'none';
    document.getElementById('auth-password').autocomplete = isSignin ? 'current-password' : 'new-password';
    this._clearError();
  }

  _showSection(id) {
    ['auth-form-area', 'auth-verify', 'auth-reset-sent'].forEach(s =>
      document.getElementById(s).classList.toggle('hidden', s !== id)
    );
  }

  _clearError() {
    const el = document.getElementById('auth-error');
    el.textContent = '';
    el.classList.add('hidden');
  }

  _showError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  _setLoading(on) {
    ['auth-submit', 'auth-google', 'auth-apple'].forEach(id =>
      document.getElementById(id).disabled = on
    );
    document.getElementById('auth-submit').textContent = on
      ? 'Please wait…'
      : (this._tab === 'signin' ? 'Sign In' : 'Create Account');
  }

  async _handleSubmit(e) {
    e.preventDefault();
    this._clearError();
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) { this._showError('Please fill in all fields.'); return; }

    this._setLoading(true);
    if (this._tab === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      this._setLoading(false);
      if (error) { this._showError(this._friendlyError(error)); return; }
      this.hide();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      this._setLoading(false);
      if (error) { this._showError(this._friendlyError(error)); return; }
      this._showSection('auth-verify');
    }
  }

  async _handleForgot() {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) { this._showError('Enter your email above, then click Forgot password.'); return; }
    this._setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    this._setLoading(false);
    if (error) { this._showError(this._friendlyError(error)); return; }
    this._showSection('auth-reset-sent');
  }

  async _oauthSignIn(provider) {
    this._setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      this._setLoading(false);
      this._showError(this._friendlyError(error));
    }
    // On success the browser redirects; no further action needed here
  }

  _friendlyError(err) {
    const m = err?.message || '';
    if (m.includes('Invalid login credentials')) return 'Incorrect email or password.';
    if (m.includes('Email not confirmed'))        return 'Please verify your email first, then sign in.';
    if (m.includes('User already registered'))    return 'An account with this email already exists.';
    if (m.includes('Password should be'))         return 'Password must be at least 6 characters.';
    if (m.includes('rate limit'))                 return 'Too many attempts. Please wait a moment.';
    return m || 'Something went wrong. Please try again.';
  }
}
