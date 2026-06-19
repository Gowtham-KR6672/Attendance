import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Calendar, User, Search, Save, ClipboardX } from 'lucide-react';
import LoadingScreen from "./LoadingScreen";

const LEAVE_STATUSES = [
  'CASUAL LEAVE','SICK LEAVE','SESSION_01 LEAVE','SESSION_02 LEAVE',
  'COMP-OFF','PHONE INTIMATION','NO INTIMATION','L.O.P.',
  '1 Hr Per MORN','2 Hr Per MORN','1 Hr Per EVE','2 Hr Per EVE'
];

const pad = (n) => String(n).padStart(2,'0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monthToRange = (ym) => {
  const [y,m] = ym.split('-').map(Number);
  const s = new Date(y, m-1, 1);
  const e = new Date(y, m, 0);
  return { from: toYMD(s), to: toYMD(e) };
};

export default function LeaveSummary() {
  const [employees, setEmployees] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [{from, to}, setRange] = useState(monthToRange(new Date().toISOString().slice(0,7)));

  const [detailsEmpId, setDetailsEmpId] = useState('');
  const [detailsRecords, setDetailsRecords] = useState([]);
  const [detailsNotes, setDetailsNotes] = useState({});
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => { setRange(monthToRange(month)); }, [month]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/employees');
        setEmployees(data);
        if (data?.length) setDetailsEmpId(data[0]._id);
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoad(false);
      }
    })();
  }, []);

  const loadDetails = async () => {
    if (!detailsEmpId) return;
    setDetailsBusy(true);
    try {
      const { data } = await api.get('/attendance', { params: { employeeId: detailsEmpId, from, to } });
      const filtered = (data || []).filter(r => LEAVE_STATUSES.includes(r.status));
      setDetailsRecords(filtered);
      const init = {};
      for (const r of filtered) init[r._id] = r.note || '';
      setDetailsNotes(init);
      setHasSearched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsBusy(false);
    }
  };

  useEffect(() => { 
    if (detailsEmpId) {
      loadDetails(); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsEmpId, from, to]);

  const groupedDetails = useMemo(() => {
    const by = {};
    for (const s of LEAVE_STATUSES) by[s] = [];
    for (const r of detailsRecords) by[r.status]?.push(r);
    for (const s of Object.keys(by)) by[s].sort((a,b)=>new Date(a.date)-new Date(b.date));
    return by;
  }, [detailsRecords]);

  const shownStatuses = useMemo(
    () => LEAVE_STATUSES.filter(s => (groupedDetails[s]?.length || 0) > 0),
    [groupedDetails]
  );

  const saveDetailsRemarks = async () => {
    const changes = Object.entries(detailsNotes).filter(([id, val]) => {
      const current = detailsRecords.find(r => r._id === id)?.note || '';
      return (current !== val);
    });
    if (!changes.length) return alert('No changes to save.');
    
    setDetailsBusy(true);
    try {
      await Promise.all(changes.map(([recordId, note]) =>
        api.post('/attendance/note', { recordId, note })
      ));
      await loadDetails();
    } catch (err) {
      console.error(err);
      alert('Failed to save remarks.');
    } finally {
      setDetailsBusy(false);
    }
  };

  const getMonthName = (ym) => {
    const [y, m] = ym.split('-');
    const date = new Date(y, m - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // SVG Illustration for empty state
  const EmptyIllustration = () => (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-6 drop-shadow-lg">
      <style>
        {`
          @keyframes searchSweep {
            0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
            25% { transform: translate(-35px, -15px) rotate(-15deg); }
            75% { transform: translate(15px, 25px) rotate(10deg); }
          }
          .glass-anim {
            animation: searchSweep 5s ease-in-out infinite;
            transform-origin: 130px 120px;
          }
          @keyframes floatDoc {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-12px); }
          }
          .doc-anim {
            animation: floatDoc 4s ease-in-out infinite;
          }
          @keyframes pulseShadow {
            0%, 100% { transform: scale(1); opacity: 0.15; }
            50% { transform: scale(0.7); opacity: 0.05; }
          }
          .shadow-anim {
            animation: pulseShadow 4s ease-in-out infinite;
            transform-origin: center;
          }
        `}
      </style>

      {/* Floor Shadow */}
      <ellipse cx="100" cy="185" rx="65" ry="12" fill="#64748b" className="shadow-anim" />

      {/* Floating Clipboard */}
      <g className="doc-anim">
        {/* Board */}
        <rect x="40" y="25" width="120" height="150" rx="16" fill="#ffffff" stroke="#e2e8f0" strokeWidth="4" />
        
        {/* Clip */}
        <rect x="75" y="10" width="50" height="24" rx="8" fill="#3b82f6" />
        <rect x="85" y="18" width="30" height="6" rx="3" fill="#ffffff" opacity="0.8" />
        
        {/* Document Content Lines */}
        <rect x="60" y="55" width="24" height="24" rx="6" fill="#f1f5f9" />
        <path d="M95 67H135" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
        
        <path d="M60 95H140M60 120H140M60 145H100" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
      </g>
      
      {/* Animated Magnifying Glass */}
      <g className="glass-anim">
        {/* Glass lens and rim */}
        <circle cx="135" cy="125" r="32" fill="#eff6ff" fillOpacity="0.85" stroke="#3b82f6" strokeWidth="8" />
        {/* Handle */}
        <path d="M158 148L185 175" stroke="#3b82f6" strokeWidth="16" strokeLinecap="round" />
        {/* Glass reflection highlight */}
        <path d="M118 110 A 20 20 0 0 1 142 105" stroke="#bfdbfe" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );

  if (initialLoad) {
    return <LoadingScreen text="Loading Summary" subtext="Fetching the leave details..." />;
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* Filter Bar */}
      <div className="card border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 lg:col-span-1">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Employee</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-500">
                <User size={16} strokeWidth={2.5} />
              </div>
              <select className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium" value={detailsEmpId} onChange={e=>setDetailsEmpId(e.target.value)}>
                {employees.map(e => <option key={e._id} value={e._id}>{e.name} ({e.code})</option>)}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Month</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-500">
                <Calendar size={16} strokeWidth={2.5} />
              </div>
              <input type="month" className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium" value={month} onChange={(e)=>setMonth(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-1 flex justify-end md:justify-start">
            <button className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors w-full md:w-auto shadow-sm" onClick={loadDetails} disabled={detailsBusy}>
              <Search size={16} />
              {detailsBusy ? 'Loading...' : 'Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {(!hasSearched || shownStatuses.length === 0) ? (
        
        /* Premium Empty State */
        <div className="card relative border border-blue-100 rounded-xl bg-white shadow-sm overflow-hidden min-h-[calc(100vh-280px)] flex items-center justify-center">
          {/* Base Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#eff6ff] to-[#f0fdf4] opacity-50"></div>
          
          {/* Animated Background Blobs */}
          <div className="absolute -top-10 -left-10 w-96 h-96 bg-blue-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDuration: '6s' }}></div>
          <div className="absolute top-10 -right-10 w-96 h-96 bg-indigo-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }}></div>
          <div className="absolute -bottom-20 left-1/4 w-96 h-96 bg-cyan-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDuration: '7s', animationDelay: '2s' }}></div>

          {/* Dotted Pattern */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#0f172a 2px, transparent 2px)', backgroundSize: '32px 32px' }}></div>

          {/* Content */}
          <div className="relative z-10 text-center py-12 px-6">
            <div className="transform transition-transform duration-700 hover:scale-105">
              <EmptyIllustration />
            </div>
            <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 mb-3 tracking-tight">No leave data found</h3>
            <p className="text-slate-500 text-base max-w-sm mx-auto">Please select an employee and click <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 shadow-sm">Details</span> to see the results.</p>
          </div>
        </div>

      ) : (

        /* Populated State (Image 2 style) */
        <div className="card border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-600 flex items-center gap-3">
                  Leave Details
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{from} to {to}</span>
                </h3>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm" onClick={saveDetailsRemarks} disabled={detailsBusy}>
              <Save size={18} className="text-blue-600" />
              {detailsBusy ? 'Saving...' : 'Save Remarks'}
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-8">
              {shownStatuses.map(status => (
                <div key={status} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${status.includes('CASUAL') ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                    <h4 className="font-bold text-slate-800 tracking-wide">{status} — {groupedDetails[status].length}</h4>
                  </div>
                  
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="py-3 px-5 font-semibold w-48">Date</th>
                          <th className="py-3 px-5 font-semibold">Remark (per day)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {groupedDetails[status].map(rec => (
                          <tr key={rec._id} className="hover:bg-slate-50/50 transition-colors align-top">
                            <td className="py-4 px-5">
                              <div className="inline-flex items-center gap-2 text-slate-700 font-medium bg-slate-100 px-3 py-1.5 rounded-lg">
                                <Calendar size={14} className="text-blue-500" />
                                {new Date(rec.date).toLocaleDateString('en-GB')}
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <textarea
                                className="w-full min-h-[60px] p-3 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 resize-y"
                                placeholder={`Reason for ${status} on ${new Date(rec.date).toLocaleDateString('en-GB')}`}
                                value={detailsNotes[rec._id] ?? ''}
                                onChange={(e)=>setDetailsNotes({ ...detailsNotes, [rec._id]: e.target.value })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
