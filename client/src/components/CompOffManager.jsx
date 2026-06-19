import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { User, Download, CalendarPlus, ClipboardList, Plus, ArrowUpDown, ChevronDown, Calendar, Save, Trash2 } from 'lucide-react';

const pad = (n) => String(n).padStart(2,'0');
const toYMD = (d) => {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;
};

const STATUS_OPTIONS = [
  { v:'PENDING',     label:'Pending',         cls:'bg-orange-50 text-orange-600 border-orange-200' },
  { v:'HALF_TAKEN',  label:'0.5 day taken',   cls:'bg-rose-50 text-rose-600 border-rose-200'   },
  { v:'TAKEN',       label:'Leave taken',     cls:'bg-red-50 text-red-600 border-red-200'   },
  { v:'PAID',        label:'Paid',            cls:'bg-emerald-50 text-emerald-600 border-emerald-200'  },
];

const statusMeta = Object.fromEntries(STATUS_OPTIONS.map(s=>[s.v, s]));

const EmptyIllustration = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3 drop-shadow-sm overflow-visible">
    <style>
      {`
        @keyframes floatBox {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        .box-anim {
          animation: floatBox 3s ease-in-out infinite;
        }
        @keyframes popSparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .sparkle-1 { animation: popSparkle 2s ease-in-out infinite; transform-origin: 12px 6px; }
        .sparkle-2 { animation: popSparkle 2.5s ease-in-out infinite 0.5s; transform-origin: 9px 7px; }
        .sparkle-3 { animation: popSparkle 2.2s ease-in-out infinite 1s; transform-origin: 15px 7px; }
      `}
    </style>
    <g className="box-anim">
      {/* Box back flap */}
      <path d="M4 12L8 9H16L20 12" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      {/* Box front base */}
      <path d="M4 12L4 18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V12" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 12L16 12L14 15L10 15L8 12L4 12" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Sparkles */}
      <path d="M12 2V6" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" className="sparkle-1"/>
      <path d="M7 4L9.5 7" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" className="sparkle-2"/>
      <path d="M17 4L14.5 7" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" className="sparkle-3"/>
    </g>
  </svg>
);

export default function CompOffManager() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');

  const [rows, setRows] = useState([]); 
  const [allRows, setAllRows] = useState([]); 

  // new item form
  const [workDate, setWorkDate] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [remark, setRemark] = useState('');

  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/employees');
        setEmployees(data);
        if (data?.length) setSelectedEmp(data[0]._id);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const loadEmployee = async (empId) => {
    if (!empId) return;
    try {
      const { data } = await api.get('/compoff', { params: { employeeId: empId } });
      setRows(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAll = async () => {
    try {
      const { data } = await api.get('/compoff'); 
      setAllRows(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (selectedEmp) loadEmployee(selectedEmp); }, [selectedEmp]);

  const addItem = async () => {
    if (!selectedEmp || !workDate) return alert('Employee and Work Date are required');
    try {
      const payload = {
        employeeId: selectedEmp,
        workDate,
        leaveDate: leaveDate || undefined,
        status,
        remark,
      };
      await api.post('/compoff', payload);
      setWorkDate(''); setLeaveDate(''); setStatus('PENDING'); setRemark('');
      loadEmployee(selectedEmp);
      loadAll();
    } catch (err) {
      console.error(err);
      alert('Failed to add entry');
    }
  };

  const updateItem = async (row) => {
    setSavingId(row._id);
    try {
      await api.post('/compoff', {
        id: row._id,
        leaveDate: row.leaveDate ? toYMD(new Date(row.leaveDate)) : null,
        status: row.status,
        remark: row.remark ?? '',
      });
      await loadEmployee(selectedEmp);
      loadAll();
    } catch (err) {
      console.error(err);
      alert('Failed to update entry');
    } finally {
      setSavingId(null);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this comp-off entry?')) return;
    try {
      await api.delete(`/compoff/${id}`);
      setRows((r)=>r.filter(x=>x._id!==id));
      loadAll();
    } catch (err) {
      console.error(err);
      alert('Failed to delete entry');
    }
  };

  const downloadAll = async () => {
    await loadAll();
    const rowsExport = (allRows || []).map(r => ([
      r.employee?.name || '',
      r.employee?.code || '',
      toYMD(new Date(r.workDate)),
      r.leaveDate ? toYMD(new Date(r.leaveDate)) : '',
      statusMeta[r.status]?.label || r.status,
      r.remark || '',
      new Date(r.createdAt).toLocaleString(),
    ]));

    const header = ['Employee','Emp ID','Worked Date','Leave Taken Date','Status','Remark','Created At'];

    try {
      const XLSX = await import('xlsx'); 
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([header, ...rowsExport]);
      XLSX.utils.book_append_sheet(wb, ws, 'CompOff');
      XLSX.writeFile(wb, `compoff_all.xlsx`);
    } catch {
      const esc = (v) => `"${String(v ?? '').replace(/"/g,'""')}"`;
      const csv = [header, ...rowsExport].map(r => r.map(esc).join(',')).join('\n');
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'compoff_all.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Employee Selection Card */}
      <div className="card border border-slate-200 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <User size={24} />
            </div>
            <div className="flex-1 max-w-sm">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Employee</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-500">
                  <User size={16} strokeWidth={2.5} />
                </div>
                <select 
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium"
                  value={selectedEmp} 
                  onChange={e=>setSelectedEmp(e.target.value)}
                >
                  {employees.map(e => (
                    <option key={e._id} value={e._id}>{e.name} ({e.code})</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>
          <button 
            className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm whitespace-nowrap"
            onClick={downloadAll}
          >
            <Download size={18} />
            Download All (Excel)
          </button>
        </div>
      </div>

      {/* 2. Add Comp-Off Card */}
      <div className="card border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CalendarPlus size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-blue-600">Add Comp-Off</h3>
            <p className="text-sm text-slate-500">Add a new comp-off entry for the selected employee</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1.5fr_1.5fr_2.5fr_auto] gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Worked Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <input 
                  type="date" 
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium" 
                  value={workDate} 
                  onChange={e=>setWorkDate(e.target.value)} 
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Leave Taken Date <span className="font-normal text-slate-400">(optional)</span></label>
              <div className="relative">
                <input 
                  type="date" 
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium" 
                  value={leaveDate} 
                  onChange={e=>setLeaveDate(e.target.value)} 
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Status <span className="text-red-500">*</span></label>
              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium"
                  value={status} 
                  onChange={e=>setStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Remark</label>
              <input 
                className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 placeholder:text-slate-400" 
                value={remark} 
                onChange={e=>setRemark(e.target.value)} 
                placeholder="e.g., Worked on Sunday deployment" 
              />
            </div>
            <div>
              <button 
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm w-full"
                onClick={addItem}
              >
                <Plus size={18} />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Comp-Off Details Card */}
      <div className="card border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ClipboardList size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-blue-600">Comp-Off Details</h3>
            <p className="text-sm text-slate-500">List of comp-off entries for the selected employee</p>
          </div>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1.5">Worked Date <ArrowUpDown size={12} className="text-slate-400"/></div>
                  </th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1.5">Leave Taken Date <ArrowUpDown size={12} className="text-slate-400"/></div>
                  </th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1.5">Status <ArrowUpDown size={12} className="text-slate-400"/></div>
                  </th>
                  <th className="py-3 px-4 font-semibold">Remark</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500">
                      <EmptyIllustration />
                      <p className="font-medium text-slate-600">No comp-off entries found.</p>
                    </td>
                  </tr>
                ) : rows.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                      {toYMD(r.workDate)}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="date"
                        className="px-3 py-1.5 bg-white border border-slate-200 focus:border-blue-500 outline-none transition-colors text-sm rounded-md text-slate-700 w-full"
                        value={r.leaveDate ? toYMD(r.leaveDate) : ''}
                        onChange={(e)=>setRows(rows.map(x=>x._id===r._id ? {...x, leaveDate: e.target.value || null } : x))}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative">
                        <select
                          className={`w-full pl-3 pr-8 py-1.5 border focus:border-blue-500 outline-none transition-colors text-sm font-medium rounded-md appearance-none ${statusMeta[r.status]?.cls || 'bg-slate-50 text-slate-600 border-slate-200'}`}
                          value={r.status}
                          onChange={(e)=>setRows(rows.map(x=>x._id===r._id ? {...x, status: e.target.value } : x))}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                          <ChevronDown size={14} className={statusMeta[r.status]?.cls ? 'opacity-70' : 'text-slate-400'} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-blue-500 outline-none transition-colors text-sm rounded-md text-slate-700 placeholder:text-slate-400"
                        value={r.remark || ''}
                        onChange={(e)=>setRows(rows.map(x=>x._id===r._id ? {...x, remark: e.target.value } : x))}
                        placeholder="Add a remark"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" 
                          onClick={()=>updateItem(r)}
                          title="Save Changes"
                          disabled={savingId === r._id}
                        >
                          <Save size={16} />
                        </button>
                        <button 
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors" 
                          onClick={()=>deleteItem(r._id)}
                          title="Delete Entry"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
