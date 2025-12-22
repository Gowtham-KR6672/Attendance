import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
const STATUS_KEYS = [
  'CASUAL LEAVE',
  'SICK LEAVE',
  'SESSION_01 LEAVE',
  'SESSION_02 LEAVE',
  'COMP-OFF',
  'PHONE INTIMATION',
  'NO INTIMATION',
  'L.O.P.',
  '1 Hr Per MORN',
  '2 Hr Per MORN',
  '1 Hr Per EVE',
  '2 Hr Per EVE',
];

const COLORS = [
  '#22c55e', '#3b82f6', '#06b6d4', '#a855f7', '#f59e0b', '#ef4444',
  '#10b981', '#6366f1', '#14b8a6', '#f97316', '#e11d48', '#64748b'
];

const pad = (n) => String(n).padStart(2, '0');
const toYMD = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

export default function EmployeeChartsModal({ onClose }) {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);

  const [from, setFrom] = useState(toYMD(defaultFrom));
  const [to, setTo] = useState(toYMD(today));

  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('__ALL__');

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.all([
        api.get('/employees'),
        api.get('/attendance', { params: { from, to } }),
      ]);

      const empList = Array.isArray(empRes.data) ? empRes.data : [];
      const recList = Array.isArray(attRes.data) ? attRes.data : [];

      setEmployees(empList);
      setRecords(recList);

      if (selectedEmpId !== '__ALL__' && !empList.some(e => e._id === selectedEmpId)) {
        setSelectedEmpId('__ALL__');
      }
    } catch (e) {
      console.error(e);
      alert('Chart data load failed. Check backend and CORS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // employeeId -> {status -> count}
  const countsByEmployee = useMemo(() => {
    const map = new Map();

    const ensure = (empId) => {
      if (!map.has(empId)) {
        const base = {};
        for (const s of STATUS_KEYS) base[s] = 0;
        map.set(empId, base);
      }
      return map.get(empId);
    };

    for (const r of records) {
      const empId = r.employee?._id || r.employee;
      if (!empId) continue;

      const status = (r.status || '').trim();
      if (!STATUS_KEYS.includes(status)) continue;

      const obj = ensure(empId);
      obj[status] = (obj[status] || 0) + 1;
    }

    return map;
  }, [records]);

  const employeeOptions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(e =>
      (e.name || '').toLowerCase().includes(term) ||
      (e.code || '').toLowerCase().includes(term)
    );
  }, [employees, q]);

  // totals object
  const totalsObj = useMemo(() => {
    if (selectedEmpId === '__ALL__') {
      const totals = {};
      for (const s of STATUS_KEYS) totals[s] = 0;

      for (const emp of employees) {
        const obj = countsByEmployee.get(emp._id);
        if (!obj) continue;
        for (const s of STATUS_KEYS) totals[s] += (obj[s] || 0);
      }
      return totals;
    }

    const obj = countsByEmployee.get(selectedEmpId);
    if (!obj) {
      const empty = {};
      for (const s of STATUS_KEYS) empty[s] = 0;
      return empty;
    }
    return obj;
  }, [selectedEmpId, employees, countsByEmployee]);

  // chart data (non zero)
  const chartData = useMemo(() => {
    return STATUS_KEYS
      .map((name, idx) => ({
        name,
        value: totalsObj[name] || 0,
        color: COLORS[idx % COLORS.length],
      }))
      .filter(x => x.value > 0);
  }, [totalsObj]);

  // total count
  const totalCount = useMemo(() => {
    let t = 0;
    for (const s of STATUS_KEYS) t += (totalsObj[s] || 0);
    return t;
  }, [totalsObj]);

  const selectedName =
    selectedEmpId === '__ALL__'
      ? 'All Employees'
      : (employees.find(e => e._id === selectedEmpId)?.name || 'Selected');

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center px-3">
      <div className="w-[98vw] max-w-[1800px] max-h-[88vh] rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <div className="text-lg font-semibold">Employee Chart Reports</div>
            <div className="text-xs text-gray-500">Normal 2D pie chart by status</div>
          </div>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-auto" style={{ maxHeight: 'calc(88vh - 72px)' }}>
          <div className="grid grid-cols-12 gap-5">

            {/* Left controls */}
            <div className="col-span-12 lg:col-span-5">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="label mb-1">From</div>
                    <input
                      type="date"
                      className="input w-full"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="label mb-1">To</div>
                    <input
                      type="date"
                      className="input w-full"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>

                  <div className="col-span-2">
                    <div className="label mb-1">Search Employee (optional)</div>
                    <input
                      className="input w-full"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Type name or Emp ID"
                    />
                  </div>

                  <div className="col-span-2">
                    <div className="label mb-1">Select Employee (for chart)</div>
                    <select
                      className="input w-full"
                      value={selectedEmpId}
                      onChange={(e) => setSelectedEmpId(e.target.value)}
                    >
                      <option value="__ALL__">All Employees (Combined)</option>
                      {employeeOptions.map(emp => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} ({emp.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <button className="btn btn-primary w-full" onClick={loadData} disabled={loading}>
                      {loading ? 'Loading…' : 'Generate'}
                    </button>
                  </div>

                  <div className="col-span-2 mt-2 rounded-xl border p-3 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm font-semibold">Total Count</div>
                    <div className="text-xl font-bold">{totalCount}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right chart + counts */}
            <div className="col-span-12 lg:col-span-7">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div>
                  <div className="font-semibold text-sm">Leave Chart ({selectedName})</div>
                  <div className="text-xs text-gray-500">Normal 2D pie chart (no 3D)</div>
                </div>

                <div className="mt-4 grid grid-cols-12 gap-4 items-start">

                  {/* ✅ Normal 2D Pie */}
                  <div className="col-span-12 md:col-span-7">
                    <div className="rounded-2xl border bg-white overflow-visible" style={{ height: 520 }}>
                      {chartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-gray-500">
                          No matching statuses in this date range
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <ResponsiveContainer width="100%" height="100%">
  <PieChart margin={{ top: 35, right: 80, bottom: 35, left: 60 }}>
  <Pie
    data={chartData}
    dataKey="value"
    nameKey="name"
    cx="50%"
    cy="50%"
    outerRadius={180}   // ⬅️ smaller so labels won't cut
    innerRadius={0}
    paddingAngle={2}
    stroke="#ffffff"
    strokeWidth={2}
    labelLine={false}   // ✅ removes line that is getting cut
    label={({ cx, cy, midAngle, outerRadius, percent }) => {
      const RADIAN = Math.PI / 180;
      const r = outerRadius + 12; // ✅ keep label close to pie
      const x = cx + r * Math.cos(-midAngle * RADIAN);
      const y = cy + r * Math.sin(-midAngle * RADIAN);
      const pct = Math.round(percent * 100);
      if (!pct) return null;

      return (
        <text
          x={x}
          y={y}
          fill="#111827"
          textAnchor={x > cx ? 'start' : 'end'}
          dominantBaseline="central"
          style={{ fontWeight: 700, fontSize: 13 }}
        >
          {pct}%
        </text>
      );
    }}
    isAnimationActive
  >
    {chartData.map((d, i) => (
      <Cell key={`cell-${i}`} fill={d.color} />
    ))}
  </Pie>

  <Tooltip />
</PieChart>


</ResponsiveContainer>

                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Right side counts */}
                  <div className="col-span-12 md:col-span-5">
                    <div className="rounded-2xl border bg-white p-3">
                      <div className="font-semibold text-sm mb-2">Leave Counts</div>

                      <div className="max-h-[520px] overflow-auto pr-1 space-y-2">
                        {STATUS_KEYS.map((s, idx) => {
                          const val = totalsObj[s] || 0;
                          const color = COLORS[idx % COLORS.length];
                          return (
                            <div
                              key={s}
                              className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-block h-3 w-3 rounded" style={{ background: color }} />
                                <span className="text-sm text-gray-700 truncate">{s}</span>
                              </div>
                              <span className="text-sm font-bold">{val}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 rounded-xl bg-gray-50 border px-3 py-2 flex items-center justify-between">
                        <span className="text-sm font-semibold">Total</span>
                        <span className="text-sm font-bold">{totalCount}</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
