// client/src/components/Topbar.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { LogOut, ChevronDown } from 'lucide-react';
import logoImg from '../asset/icon.png';
import bgImg from '../asset/background.png';

const formatAdminName = (email) => {
  if (!email) return "Admin User";
  const namePart = email.split('@')[0];
  return namePart.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

const getAvatarColor = (name) => {
  const colors = [
    "bg-blue-100 text-blue-700", 
    "bg-green-100 text-green-700", 
    "bg-purple-100 text-purple-700", 
    "bg-orange-100 text-orange-700",
    "bg-pink-100 text-pink-700",
    "bg-indigo-100 text-indigo-700"
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

const getInitials = (name) => {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

export default function Topbar({ admin, onLogout }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const doLogout = async () => {
    try {
      setBusy(true);
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('scope');
      localStorage.removeItem('email');
      localStorage.removeItem('me');
      delete api.defaults.headers?.common?.Authorization;
      if (onLogout) onLogout();
      window.location.replace('/login');
    } finally {
      setBusy(false);
    }
  };

  const email = admin?.email || JSON.parse(localStorage.getItem('me') || '{}')?.email || localStorage.getItem('email');
  const role = localStorage.getItem('role') || 'admin';
  const name = formatAdminName(email);
  
  let roleDisplay = "Admin";
  if (role === "super") roleDisplay = "Super Admin";
  if (role === "admin_tl") roleDisplay = "Team Lead";

  return (
    <div className="sticky top-0 z-50 bg-[#f1f5f9] pt-2 sm:pt-3 pb-2 px-3 sm:px-6">
      <div className="relative w-full bg-white border border-slate-100 shadow-sm rounded-[20px] overflow-hidden">
        {/* Background wave image */}
      <div 
        className="absolute inset-0 z-0 opacity-40 pointer-events-none bg-cover bg-right-top bg-no-repeat"
        style={{ backgroundImage: `url(${bgImg})` }}
      />
      
      <div className="relative w-full px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
        
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <div className="w-[52px] h-[52px] flex items-center justify-center shrink-0">
            <img src={logoImg} alt="Logo" className="w-full h-full object-cover scale-[2.2] mix-blend-multiply" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#13254a] leading-tight">Attendance Admin</h1>
            <p className="text-[13px] font-medium text-slate-500 mt-0.5">Manage attendance and workforce efficiently</p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${getAvatarColor(name)}`}>
              {getInitials(name)}
            </div>
            <div className="hidden sm:block">
              <div className="text-[14px] font-bold text-[#13254a] leading-tight">{name}</div>
              <div className="text-[12px] font-medium text-slate-500">{roleDisplay}</div>
            </div>
            <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 hidden sm:block ml-1" />
          </div>
          
          <button
            type="button"
            onClick={doLogout}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl transition-colors border border-blue-100 shadow-[0_2px_8px_rgba(37,99,235,0.08)]"
            title="Logout"
          >
            <LogOut size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">{busy ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>

      </div>
    </div>
    </div>
  );
}
