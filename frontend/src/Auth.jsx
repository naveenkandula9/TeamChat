import { useState } from 'react';
import { ArrowRight, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';

const empty = { name: '', location: '', age: '', email: '', password: '', confirmPassword: '' };

export default function Auth({ onLogin, api }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';
  const set = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  function switchMode(next) { setMode(next); setError(''); setNotice(''); }
  async function submit(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (signup) {
      if (form.name.trim().length < 2 || form.name.trim().length > 80) return setError('Name must be 2 to 80 characters.');
      if (!form.location.trim() || form.location.trim().length > 100) return setError('Enter a location of up to 100 characters.');
      if (!Number.isInteger(Number(form.age)) || Number(form.age) < 13 || Number(form.age) > 120) return setError('Age must be a whole number from 13 to 120.');
      if (form.password.length < 8 || new TextEncoder().encode(form.password).length > 72) return setError('Password must be at least 8 characters and at most 72 bytes.');
      if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    }
    setBusy(true);
    try {
      if (signup) {
        await api('/api/auth/register', { method: 'POST', body: form });
        setMode('login'); setForm({ ...empty, email: form.email }); setNotice('Your account is ready. Sign in to join the conversation.');
      } else {
        const result = await api('/api/auth/login', { method: 'POST', body: { email: form.email, password: form.password } });
        onLogin(result.user);
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="auth-page">
    <div className="auth-shell">
      <section className="auth-story"><div className="brand brand-light"><span className="brand-icon"><MessageCircle size={19} /></span>teamchat<span className="brand-dot">.</span></div>
        <div className="story-copy"><div className="story-badge"><Sparkles size={14} /> A LITTLE CLOSER, EVERY DAY</div><h1>Good conversations<br />start here<span>.</span></h1><p>Make space for the ideas, updates, and little moments that bring your team together.</p><div className="story-avatars"><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span><small>One space. Your whole team.</small></div></div>
        <div className="story-footer"><ShieldCheck size={15} /> Your conversations, thoughtfully connected.</div>
      </section>
      <section className="auth-content"><div className="auth-card"><div className="auth-mobile-brand brand"><span className="brand-icon"><MessageCircle size={18} /></span>teamchat<span className="brand-dot">.</span></div><p className="eyebrow">{signup ? 'JOIN YOUR TEAM' : 'WELCOME BACK'}</p><h2>{signup ? 'Create your account' : 'Hello again.'}</h2><p className="auth-description">{signup ? 'A few details and you’re ready to connect.' : 'Sign in to pick up the conversation.'}</p>
        {error && <div className="notice error" role="alert">{error}</div>}{notice && <div className="notice success" role="status">{notice}</div>}
        <form onSubmit={submit} className="auth-form">
          {signup && <><label>Full name<input name="name" value={form.name} onChange={set} placeholder="Your full name" autoComplete="name" maxLength="80" required /></label><div className="form-row"><label>Location<input name="location" value={form.location} onChange={set} placeholder="City or location" maxLength="100" required /></label><label>Age<input name="age" type="number" min="13" max="120" step="1" value={form.age} onChange={set} placeholder="Age" required /></label></div></>}
          <label>Email address<input name="email" type="email" value={form.email} onChange={set} placeholder="you@example.com" autoComplete="email" maxLength="254" required /></label>
          <label>Password<input name="password" type="password" value={form.password} onChange={set} placeholder={signup ? 'At least 8 characters' : 'Enter your password'} autoComplete={signup ? 'new-password' : 'current-password'} required /></label>
          {signup && <label>Confirm password<input name="confirmPassword" type="password" value={form.confirmPassword} onChange={set} placeholder="Repeat your password" autoComplete="new-password" required /></label>}
          <button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait...' : signup ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>
        </form><p className="auth-switch">{signup ? 'Already have an account?' : 'New to TeamChat?'} <button type="button" onClick={() => switchMode(signup ? 'login' : 'signup')}>{signup ? 'Sign in' : 'Create an account'}</button></p>
      </div></section>
    </div>
  </main>;
}
