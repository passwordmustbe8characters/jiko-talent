import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { clearToken, getToken } from './api';
import Login from './Login';
import Batches from './Batches';
import BatchDetail from './BatchDetail';
import LeadDetail from './LeadDetail';
import Results from './Results';

export default function AdminApp() {
  const [signedIn, setSignedIn] = useState(Boolean(getToken()));

  // api.js fires this when the server says the token is missing or expired
  useEffect(() => {
    const onLogout = () => setSignedIn(false);
    window.addEventListener('jiko-admin-logout', onLogout);
    return () => window.removeEventListener('jiko-admin-logout', onLogout);
  }, []);

  if (!signedIn) return <Login onSuccess={() => setSignedIn(true)} />;

  return (
    <div className="min-h-screen bg-[#F4F4F0] selection:bg-rose-200">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-rose-900 font-['Sora',_sans-serif] text-lg">Jiko Admin</span>
            <Link to="/admin" className="text-sm font-bold text-slate-600 hover:text-rose-900">Batches</Link>
            <Link to="/admin/results" className="text-sm font-bold text-slate-600 hover:text-rose-900">Results</Link>
          </div>
          <button
            onClick={() => { clearToken(); setSignedIn(false); }}
            className="text-sm font-bold text-slate-400 hover:text-rose-900 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 font-['Alan_Sans',_sans-serif]">
        <Routes>
          <Route index element={<Batches />} />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="results" element={<Results />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
