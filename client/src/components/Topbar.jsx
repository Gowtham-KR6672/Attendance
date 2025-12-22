// client/src/components/Topbar.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Topbar({ admin, onLogout }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const doLogout = async () => {
    try {
      setBusy(true);

      // If you later add a server endpoint for audit logs, you *may* call it here.
      // It's not required for token-based logout:
      // await api.post('/auth/logout').catch(() => {});

      // Clear all local auth state
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('scope');
      localStorage.removeItem('email');
      localStorage.removeItem('me');

      // Ensure axios won’t reuse any old auth header
      delete api.defaults.headers?.common?.Authorization;

      // Notify parent (if it maintains user state)
      if (onLogout) onLogout();

      // Hard redirect for a fully clean app state
      window.location.replace('/login');
      // or: navigate('/login', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const email = admin?.email || JSON.parse(localStorage.getItem('me') || '{}')?.email;

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="font-semibold">Attendance Admin</div>

        <div className="flex items-center gap-3">
          {email && <div className="text-sm text-gray-600">({email})</div>}
          <button
            type="button"
            onClick={doLogout}
            disabled={busy}
            className="btn btn-outline"
            title="Logout"
          >
            {busy ? '…' : 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
}
