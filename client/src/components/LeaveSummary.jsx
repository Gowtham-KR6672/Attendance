import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const LEAVE_STATUSES = [
  'CASUAL LEAVE','SICK LEAVE','SESSION_01 LEAVE','SESSION_02 LEAVE',
  'COMP-OFF','PHONE INTIMATION','NO INTIMATION','L.O.P.',
  '1 Hr Per MORN','2 Hr Per MORN','1 Hr Per EVE','2 Hr Per EVE'
];

const pad = (n)=>String(n).padStart(2,'0');
const toYMD = (d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monthToRange = (ym) => {
  const [y,m] = ym.split('-').map(Number);
  const s = new Date(y, m-1, 1);
  const e = new Date(y, m, 0);
  return { from: toYMD(s), to: toYMD(e) };
};

export default function LeaveSummary() {
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState('');

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [{from, to}, setRange] = useState(monthToRange(new Date().toISOString().slice(0,7)));

  const [records, setRecords] = useState([]);
  const [notes, setNotes] = useState({}); // { recordId: note }

  useEffect(() => { setRange(monthToRange(month)); }, [month]);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/employees');
      setEmployees(data);
      if (data?.length) setEmpId(data[0]._id);
    })();
  }, []);

  const loadDetails = async () => {
    if (!empId) return;
    const { data } = await api.get('/attendance', { params: { employeeId: empId, from, to } });
    // keep only leave-like statuses
    const filtered = (data || []).filter(r => LEAVE_STATUSES.includes(r.status));
    setRecords(filtered);
    // initialize per-record notes
    const init = {};
    for (const r of filtered) init[r._id] = r.note || '';
    setNotes(init);
  };

  useEffect(() => { if (empId) loadDetails(); }, [empId, from, to]);

  // Group records by status and sort by date
  const grouped = useMemo(() => {
    const by = {};
    for (const s of LEAVE_STATUSES) by[s] = [];
    for (const r of records) by[r.status]?.push(r);
    for (const s of Object.keys(by)) by[s].sort((a,b)=>new Date(a.date)-new Date(b.date));
    return by;
  }, [records]);

  const shownStatuses = useMemo(
    () => LEAVE_STATUSES.filter(s => (grouped[s]?.length || 0) > 0),
    [grouped]
  );

  const saveAll = async () => {
    const changes = Object.entries(notes).filter(([id, val]) => {
      const current = records.find(r => r._id === id)?.note || '';
      return (current !== val);
    });
    if (!changes.length) return alert('Nothing to save.');
    await Promise.all(changes.map(([recordId, note]) =>
      api.post('/attendance/note', { recordId, note })
    ));
    alert('Saved.');
    // refresh
    loadDetails();
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="label mb-1">Employee</div>
            <select className="select w-full" value={empId} onChange={e=>setEmpId(e.target.value)}>
              {employees.map(e => <option key={e._id} value={e._id}>{e.name} ({e.code})</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1">Month</div>
            <input type="month" className="input w-full" value={month} onChange={(e)=>setMonth(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button className="btn btn-outline" onClick={loadDetails}>Details</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Leave Details — {from} to {to}</h3>
          <button className="btn btn-primary" onClick={saveAll} disabled={!records.length}>Save Remarks</button>
        </div>

        {!shownStatuses.length ? (
          <div className="text-gray-500 px-3 py-6">No leave taken in the selected month.</div>
        ) : (
          shownStatuses.map(status => (
            <div key={status} className="mb-6">
              <div className="font-medium mb-2">{status} — {grouped[status].length}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="pb-2 px-3">Date</th>
                      <th className="pb-2 px-3">Remark (per day)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[status].map(rec => (
                      <tr key={rec._id} className="border-t align-top">
                        <td className="py-2 px-3">{new Date(rec.date).toLocaleDateString()}</td>
                        <td className="px-3">
                          <textarea
                            className="input min-h-[60px] w-full"
                            placeholder={`Reason for ${status} on ${new Date(rec.date).toLocaleDateString()}`}
                            value={notes[rec._id] ?? ''}
                            onChange={(e)=>setNotes({ ...notes, [rec._id]: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
