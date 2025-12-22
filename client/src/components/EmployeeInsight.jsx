import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';

// Full palette used by chart
const STATUS_LIST = [
  'PRESENT', 'CASUAL LEAVE', 'SICK LEAVE', 'SESSION_01 LEAVE', 'SESSION_02 LEAVE',
  'COMP-OFF', 'PHONE INTIMATION', 'NO INTIMATION', 'L.O.P.',
  '1 Hr Per MORN', '2 Hr Per MORN', '1 Hr Per EVE', '2 Hr Per EVE'
];

// Day-based leave types to show in the first table
const DAY_LEAVE = [
  'CASUAL LEAVE','SICK LEAVE','SESSION_01 LEAVE','SESSION_02 LEAVE',
  'COMP-OFF','PHONE INTIMATION','NO INTIMATION','L.O.P.'
];

// Hour-based leave types to show in the second table
const HOUR_LEAVE = [
  '1 Hr Per MORN','2 Hr Per MORN','1 Hr Per EVE','2 Hr Per EVE'
];

// day/hour equivalents
const DAY_EQ = {
  'SESSION_01 LEAVE': 0.5,
  'SESSION_02 LEAVE': 0.5,
  'CASUAL LEAVE': 1,
  'SICK LEAVE': 1,
  'COMP-OFF': 1,
  'PHONE INTIMATION': 1,
  'NO INTIMATION': 1,
  'L.O.P.': 1
};
const HOUR_EQ = {
  '1 Hr Per MORN': 1,
  '2 Hr Per MORN': 2,
  '1 Hr Per EVE': 1,
  '2 Hr Per EVE': 2
};

const pad = (n)=>String(n).padStart(2,'0');
const toYMD=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export default function EmployeeInsight() {
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState('');
  const [emp, setEmp] = useState(null);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd   = new Date(today.getFullYear(), today.getMonth()+1, 0);
  const [from, setFrom] = useState(toYMD(monthStart));
  const [to, setTo] = useState(toYMD(monthEnd));

  const [records, setRecords] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/employees');
      setEmployees(data);
      if (data?.length) setEmpId(data[0]._id);
    })();
  }, []);

  useEffect(() => {
    setEmp(employees.find(e => e._id === empId) || null);
  }, [empId, employees]);

  const load = async () => {
    if (!empId) return;
    const { data } = await api.get('/attendance', { params: { employeeId: empId, from, to } });
    setRecords(data || []);
  };
  useEffect(()=>{ if (empId) load(); }, [empId, from, to]);

  /* ---------- chart counts ---------- */
  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_LIST.map(s => [s, 0]));
    for (const r of records) if (c[r.status] !== undefined) c[r.status]++;
    return c;
  }, [records]);

  const chartData = useMemo(
    () => STATUS_LIST.map(s => ({ status: s, days: counts[s] || 0 })),
    [counts]
  );

  /* ---------- tables / totals ---------- */
  const dayRows = useMemo(() => {
    return DAY_LEAVE
      .map(s => ({ status: s, count: counts[s] || 0, eq: (counts[s] || 0) * (DAY_EQ[s] || 0) }))
      .filter(r => r.count > 0); // show only occurred
  }, [counts]);

  const hourRows = useMemo(() => {
    return HOUR_LEAVE
      .map(s => ({ status: s, count: counts[s] || 0, eq: (counts[s] || 0) * (HOUR_EQ[s] || 0) }))
      .filter(r => r.count > 0); // show only occurred
  }, [counts]);

  const totalDayEq = useMemo(
    () => dayRows.reduce((sum, r) => sum + r.eq, 0),
    [dayRows]
  );
  const totalHourEq = useMemo(
    () => hourRows.reduce((sum, r) => sum + r.eq, 0),
    [hourRows]
  );

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left: Employee card */}
      <div className="card col-span-12 lg:col-span-4">
        <h3 className="font-semibold mb-4">Employee</h3>

        <div className="space-y-3">
          <div>
            <div className="label mb-1">Select Employee</div>
            <select className="select w-full" value={empId} onChange={e=>setEmpId(e.target.value)}>
              {employees.map(e => (
                <option key={e._id} value={e._id}>{e.name} ({e.code})</option>
              ))}
            </select>
          </div>

          {emp && (
            <div className="space-y-1 text-sm">
              <div><span className="text-gray-500">Name:</span> {emp.name}</div>
              <div><span className="text-gray-500">Emp ID:</span> {emp.code}</div>
              <div><span className="text-gray-500">Designation:</span> {emp.designation || '-'}</div>
              <div><span className="text-gray-500">Team:</span> {emp.teamType || '-'}</div>
              <div><span className="text-gray-500">Shift:</span> {emp.shift || '-'}</div>
              <div><span className="text-gray-500">Personal Email:</span> {emp.personalEmail || '-'}</div>
              <div><span className="text-gray-500">Phone:</span> {emp.personalPhone || '-'}</div>
              <div><span className="text-gray-500">Department:</span> {emp.department || '-'}</div>
              <div><span className="text-gray-500">Present Location:</span> {emp.presentLocation || '-'}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">From</div>
              <input type="date" className="input w-full" value={from} onChange={e=>setFrom(e.target.value)} />
            </div>
            <div>
              <div className="label">To</div>
              <input type="date" className="input w-full" value={to} onChange={e=>setTo(e.target.value)} />
            </div>
          </div>

          <button className="btn btn-outline w-full" onClick={load}>Reload</button>
        </div>
      </div>

      {/* Right: Chart + tables */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <div className="card">
          <h3 className="font-semibold mb-4">Attendance (Counts) — {from} to {to}</h3>
          <div style={{ width: '100%', height: 420 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={80} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="days" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary strip */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-3 rounded border">
              <div className="text-xs text-gray-500">Total day-leave (days)</div>
              <div className="text-xl font-semibold">{totalDayEq.toFixed(1)}</div>
            </div>
            <div className="p-3 rounded border">
              <div className="text-xs text-gray-500">Total hour Permission Taken (hrs)</div>
              <div className="text-xl font-semibold">{totalHourEq}</div>
            </div>
          </div>
        </div>

        {/* Table 1: Day-based leaves */}
        <div className="card">
          <h3 className="font-semibold mb-3">Leave (Day-based)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="pb-2 px-3">Status</th>
                  <th className="pb-2 px-3">Count</th>
                  <th className="pb-2 px-3">Day equivalent</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.length === 0 ? (
                  <tr className="border-t"><td className="py-4 px-3 text-gray-500" colSpan={3}>No day-based leave taken.</td></tr>
                ) : (
                  <>
                    {dayRows.map(r => (
                      <tr key={r.status} className="border-t">
                        <td className="py-2 px-3">{r.status}</td>
                        <td className="px-3">{r.count}</td>
                        <td className="px-3">{r.eq.toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-medium">
                      <td className="py-2 px-3">Total</td>
                      <td className="px-3">{dayRows.reduce((s,r)=>s+r.count,0)}</td>
                      <td className="px-3">{totalDayEq.toFixed(1)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Hour-based deductions */}
        <div className="card">
          <h3 className="font-semibold mb-3">Permission Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="pb-2 px-3">Status</th>
                  <th className="pb-2 px-3">Count</th>
                  <th className="pb-2 px-3">Hours</th>
                </tr>
              </thead>
              <tbody>
                {hourRows.length === 0 ? (
                  <tr className="border-t"><td className="py-4 px-3 text-gray-500" colSpan={3}>No hour deductions.</td></tr>
                ) : (
                  <>
                    {hourRows.map(r => (
                      <tr key={r.status} className="border-t">
                        <td className="py-2 px-3">{r.status}</td>
                        <td className="px-3">{r.count}</td>
                        <td className="px-3">{r.eq}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-medium">
                      <td className="py-2 px-3">Total</td>
                      <td className="px-3">{hourRows.reduce((s,r)=>s+r.count,0)}</td>
                      <td className="px-3">{totalHourEq}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
