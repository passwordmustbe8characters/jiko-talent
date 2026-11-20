import { useState } from 'react';
import { api, setToken } from './api';
import { ErrorBox, primaryBtn } from './ui';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api('/login', { method: 'POST', body: { password } });
      setToken(token);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex items-center justify-center p-6 selection:bg-rose-200">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-['Sora',_sans-serif] text-slate-900">Jiko Admin</h1>
          <p className="text-sm text-slate-500 font-['Alan_Sans',_sans-serif] mt-1">Private area. Sign in to continue.</p>
        </div>
        <ErrorBox>{error}</ErrorBox>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full text-lg bg-transparent border-b-2 border-slate-300 py-3 focus:outline-none focus:border-rose-900 transition-colors font-['Alan_Sans',_sans-serif]"
        />
        <button type="submit" disabled={busy || !password} className={`w-full ${primaryBtn}`}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
