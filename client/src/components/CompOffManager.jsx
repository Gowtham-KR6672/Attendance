import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const pad = (n) => String(n).padStart(2,'0');
const toYMD = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;
};

const STATUS_OPTIONS = [
  { v:'PENDING',     label:'Pending',         cls:'bg-orange-500 text-white' },
  { v:'HALF_TAKEN',  label:'0.5 day taken',   cls:'bg-rose-300 text-black'   },
  { v:'TAKEN',       label:'Leave taken',     cls:'bg-rose-600 text-white'   },
  { v:'PAID',        label:'Paid',            cls:'bg-green-600 text-white'  },
];

const statusMeta = Object.fromEntries(STATUS_OPTIONS.map(s=>[s.v, s]));

export default function CompOffManager() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');

  const [rows, setRows] = useState([]); // compoff items for selected employee
  const [allRows, setAllRows] = useState([]); // for export all

  // new item form
  const [workDate, setWorkDate] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/employees');
      setEmployees(data);
      if (data?.length) setSelectedEmp(data[0]._id);
    })();
  }, []);

  const loadEmployee = async (empId) => {
    if (!empId) return;
    const { data } = await api.get('/compoff', { params: { employeeId: empId } });
    setRows(data || []);
  };

  const loadAll = async () => {
    const { data } = await api.get('/compoff'); // ALL employees
    setAllRows(data || []);
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (selectedEmp) loadEmployee(selectedEmp); }, [selectedEmp]);

  const addItem = async () => {
    if (!selectedEmp || !workDate) return alert('Employee and Work Date are required');
    const payload = {
      employeeId: selectedEmp,
      workDate,
      leaveDate: leaveDate || undefined,
      status,
      remark,
    };
    const { data } = await api.post('/compoff', payload);
    // refresh
    setWorkDate(''); setLeaveDate(''); setStatus('PENDING'); setRemark('');
    loadEmployee(selectedEmp);
    loadAll();
  };

  const updateItem = async (row) => {
    await api.post('/compoff', {
      id: row._id,
      leaveDate: row.leaveDate ? toYMD(new Date(row.leaveDate)) : null,
      status: row.status,
      remark: row.remark ?? '',
    });
    loadEmployee(selectedEmp);
    loadAll();
  };

  const deleteItem = async (id) => {
    if (!confirm('Delete this comp-off entry?')) return;
    await api.delete(`/compoff/${id}`);
    setRows((r)=>r.filter(x=>x._id!==id));
    loadAll();
  };

  // Export ALL employees to Excel
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
      const XLSX = await import('xlsx'); // ensure xlsx installed
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
    <div className="space-y-4">
      {/* Controls */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="label mb-1">Employee</div>
            <select className="select w-full" value={selectedEmp} onChange={e=>setSelectedEmp(e.target.value)}>
              {employees.map(e => (
                <option key={e._id} value={e._id}>{e.name} ({e.code})</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button className="btn btn-primary" onClick={downloadAll}>Download All (Excel)</button>
          </div>
        </div>
      </div>

      {/* Add new */}
      <div className="card">
        <h3 className="font-semibold mb-3">Add Comp-Off</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <div className="label">Worked Date</div>
            <input type="date" className="input w-full" value={workDate} onChange={e=>setWorkDate(e.target.value)} />
          </div>
          <div>
            <div className="label">Leave Taken Date (optional)</div>
            <input type="date" className="input w-full" value={leaveDate} onChange={e=>setLeaveDate(e.target.value)} />
          </div>
          <div>
            <div className="label">Status</div>
            <select className="select w-full" value={status} onChange={e=>setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="label">Remark</div>
            <input className="input w-full" value={remark} onChange={e=>setRemark(e.target.value)} placeholder="e.g., Worked on Sunday deployment" />
          </div>
        </div>
        <div className="mt-3">
          <button className="btn btn-outline" onClick={addItem}>Add</button>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Comp-Off Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="pb-2 px-3">Worked Date</th>
                <th className="pb-2 px-3">Leave Taken Date</th>
                <th className="pb-2 px-3">Status</th>
                <th className="pb-2 px-3">Remark</th>
                <th className="pb-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t">
                  <td className="py-6 px-3 text-gray-500" colSpan={5}>No comp-off entries.</td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r._id} className="border-t">
                  <td className="py-2 px-3">{toYMD(new Date(r.workDate))}</td>
                  <td className="px-3">
                    <input
                      type="date"
                      className="input w-full"
                      value={r.leaveDate ? toYMD(new Date(r.leaveDate)) : ''}
                      onChange={(e)=>setRows(rows.map(x=>x._id===r._id ? {...x, leaveDate: e.target.value || null } : x))}
                    />
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${statusMeta[r.status]?.cls || 'bg-gray-300'}`}>
                        {statusMeta[r.status]?.label || r.status}
                      </span>
                      <select
                        className="select"
                        value={r.status}
                        onChange={(e)=>setRows(rows.map(x=>x._id===r._id ? {...x, status: e.target.value } : x))}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="px-3">
                    <input
                      className="input w-full"
                      value={r.remark || ''}
                      onChange={(e)=>setRows(rows.map(x=>x._id===r._id ? {...x, remark: e.target.value } : x))}
                      placeholder="Remark"
                    />
                  </td>
                  <td className="px-3">
                    <div className="flex gap-2">
                      <button className="btn btn-outline" onClick={()=>updateItem(r)}>Save</button>
                      <button className="btn" onClick={()=>deleteItem(r._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
