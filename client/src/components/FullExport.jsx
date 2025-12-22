// client/src/components/FullExport.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';

const pad = (n) => String(n).padStart(2,'0');
const toYMD = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '');
const fmtDT   = (d) => (d ? new Date(d).toLocaleString() : '');
const monthRange = (date = new Date()) => {
  const s = new Date(date.getFullYear(), date.getMonth(), 1);
  const e = new Date(date.getFullYear(), date.getMonth()+1, 0);
  return { from: toYMD(s), to: toYMD(e) };
};

// ---------------- Summary helpers ----------------
const norm = (s) => String(s || '').trim().toUpperCase();

const SUMMARY_KEYS = [
  'PRESENT',
  'WFH',
  'CASUAL LEAVE',
  'SICK LEAVE',
  'SESSION_01 LEAVE',
  'SESSION_02 LEAVE',
  'COMP-OFF',
  'PHONE INTIMATION',
  'NO INTIMATION',
  'L.O.P.',
  '1 HR PER MORN',
  '2 HR PER MORN',
  '1 HR PER EVE',
  '2 HR PER EVE',
  'HOLIDAY',
  'SUNDAY',
];

const makeBlankCounts = () => {
  const obj = {};
  SUMMARY_KEYS.forEach(k => (obj[k] = 0));
  return obj;
};

// Map your stored status values -> required labels
const mapStatus = (raw) => {
  const s = norm(raw);

  // Present
  if (s === 'P' || s === 'PRESENT') return 'PRESENT';

  // WFH
  if (s === 'WFH' || s === 'WORK FROM HOME') return 'WFH';

  // Leaves
  if (s === 'CL' || s === 'CASUAL LEAVE' || s === 'CASUAL') return 'CASUAL LEAVE';
  if (s === 'SL' || s === 'SICK LEAVE' || s === 'SICK') return 'SICK LEAVE';

  if (s === 'SESSION_01' || s === 'SESSION 01' || s === 'SESSION_01 LEAVE') return 'SESSION_01 LEAVE';
  if (s === 'SESSION_02' || s === 'SESSION 02' || s === 'SESSION_02 LEAVE') return 'SESSION_02 LEAVE';

  // Comp-off (if attendance table also stores it)
  if (s === 'COMP-OFF' || s === 'COMPOFF' || s === 'COMP OFF') return 'COMP-OFF';

  // Intimations
  if (s === 'PHONE INTIMATION' || s === 'PHONE') return 'PHONE INTIMATION';
  if (s === 'NO INTIMATION' || s === 'NO INT' || s === 'NOINT') return 'NO INTIMATION';

  // LOP
  if (s === 'LOP' || s === 'L.O.P.' || s === 'L O P') return 'L.O.P.';

  // Hours
  if (s === '1 HR PER MORN' || s === '1HR PER MORN' || s === '1 HR MORNING') return '1 HR PER MORN';
  if (s === '2 HR PER MORN' || s === '2HR PER MORN' || s === '2 HR MORNING') return '2 HR PER MORN';
  if (s === '1 HR PER EVE' || s === '1HR PER EVE' || s === '1 HR EVENING') return '1 HR PER EVE';
  if (s === '2 HR PER EVE' || s === '2HR PER EVE' || s === '2 HR EVENING') return '2 HR PER EVE';

  // Holiday & Sunday
  if (s === 'HOLIDAY' || s === 'H') return 'HOLIDAY';
  if (s === 'SUNDAY' || s === 'SUN') return 'SUNDAY';

  // If it already matches exactly
  if (SUMMARY_KEYS.includes(s)) return s;

  return null;
};

export default function FullExport() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('ALL'); // 'ALL' | <empId>
  const [from, setFrom] = useState(monthRange().from);
  const [to, setTo]     = useState(monthRange().to);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/employees');
      setEmployees(data || []);
    })();
  }, []);

  const employeeOptions = useMemo(() => [
    { _id: 'ALL', name: 'All Employees', code: '' },
    ...employees
  ], [employees]);

  const inRange = (d, start, end) => {
    if (!d) return false;
    const x = new Date(d);
    const s = new Date(start); s.setHours(0,0,0,0);
    const e = new Date(end);  e.setHours(23,59,59,999);
    return x >= s && x <= e;
  };

  const download = async () => {
    if (!from || !to) return alert('Please select From and To dates.');
    if (new Date(from) > new Date(to)) return alert('From date cannot be after To date.');

    const attParams = selected === 'ALL'
      ? { from, to }
      : { employeeId: selected, from, to };

    const [att, comp] = await Promise.all([
      api.get('/attendance', { params: attParams }),
      selected === 'ALL'
        ? api.get('/compoff')
        : api.get('/compoff', { params: { employeeId: selected } })
    ]);

    const allEmployees = selected === 'ALL'
      ? employees
      : employees.filter(e => String(e._id) === String(selected));

    const attendance = att.data || [];
    let compoff = comp.data || [];

    // Filter comp-off to selected period (workDate OR leaveDate)
    compoff = compoff.filter(c =>
      inRange(c.workDate, from, to) || inRange(c.leaveDate, from, to)
    );

    // fast index for name/code lookup
    const empIndex = new Map(allEmployees.map(e => [String(e._id), e]));

    // ---------------- Sheet 0: Summary ----------------
    const summaryHeader = [
      'Employee',
      'Emp ID',
      'Email',
      'Designation',
      'Shift',
      'Team',
      ...SUMMARY_KEYS
    ];

    // init counts
    const countsByEmp = new Map();
    for (const e of allEmployees) countsByEmp.set(String(e._id), makeBlankCounts());

    // count attendance statuses (within date range already)
    for (const r of attendance) {
      const empId = String(r.employee?._id || r.employee || '');
      if (!empId) continue;
      if (selected !== 'ALL' && empId !== String(selected)) continue;

      const label = mapStatus(r.status);
      if (!label) continue;

      if (!countsByEmp.has(empId)) countsByEmp.set(empId, makeBlankCounts());
      countsByEmp.get(empId)[label] += 1;
    }

    // count compoff as COMP-OFF (from compoff collection)
for (const c of compoff) {
  const empId = String(c.employee?._id || c.employee || '');
  if (!empId) continue;
  if (selected !== 'ALL' && empId !== String(selected)) continue;

  if (!countsByEmp.has(empId)) countsByEmp.set(empId, makeBlankCounts());
  countsByEmp.get(empId)['COMP-OFF'] += 1;
}


    const summaryRows = allEmployees.map(e => {
      const counts = countsByEmp.get(String(e._id)) || makeBlankCounts();
      return [
        e.name || '',
        e.code || '',
        e.officialEmail || e.personalEmail || '',
        e.designation || '',
        e.shift || '',
        e.teamType || '',
        ...SUMMARY_KEYS.map(k => counts[k] || 0)
      ];
    });

    // ---------------- Sheet 1: Employees ----------------
    const empHeader = [
      'Employee','Emp ID','Gender','Blood Group',
      'DOB','Cert DOB','Date of Joining',
      'Designation','Shift','Team','Department',
      'Personal Email','Official Email',
      'Personal Phone','Parent Phone',
      'Laptop Status','Present Location','Permanent Location',
      'Created At','Updated At'
    ];
    const empRows = allEmployees.map(e => ([
      e.name || '',
      e.code || '',
      e.gender || '',
      e.bloodGroup || '',
      fmtDate(e.dob),
      fmtDate(e.certDob),
      fmtDate(e.doj),
      e.designation || '',
      e.shift || '',
      e.teamType || '',
      e.department || '',
      e.personalEmail || '',
      e.officialEmail || '',
      e.personalPhone || '',
      e.parentPhone || '',
      e.laptopStatus || '',
      e.presentLocation || '',
      e.permanentLocation || '',
      fmtDT(e.createdAt),
      fmtDT(e.updatedAt),
    ]));

    // ---------------- Sheet 2: Attendance ----------------
    const attHeader = ['Date','Employee','Emp ID','Status','Remark','Check-in','Check-out'];
    const attRows = [];
    for (const r of attendance) {
      const e = empIndex.get(String(r.employee?._id || r.employee));
      if (!e && selected !== 'ALL') continue;

      const empName = e?.name ?? r.employee?.name ?? '';
      const empCode = e?.code ?? r.employee?.code ?? '';

      attRows.push([
        fmtDate(r.date),
        empName,
        empCode,
        r.status || '',
        r.note || '',
        r.checkIn || '',
        r.checkOut || '',
      ]);
    }

    // ---------------- Sheet 3: CompOff ----------------
    const compHeader = ['Employee','Emp ID','Worked Date','Leave Taken Date','Status','Remark','Created At'];
    const compRows = compoff.map(c => {
      const e = empIndex.get(String(c.employee?._id || c.employee));
      const empName = e?.name ?? c.employee?.name ?? '';
      const empCode = e?.code ?? c.employee?.code ?? '';
      return [
        empName,
        empCode,
        fmtDate(c.workDate),
        fmtDate(c.leaveDate),
        c.status || '',
        c.remark || '',
        fmtDT(c.createdAt),
      ];
    });

    // Write Excel (or CSV fallback)
    try {
      const XLSX = await import('xlsx'); // npm i xlsx
      const wb = XLSX.utils.book_new();

      const ws0 = XLSX.utils.aoa_to_sheet([summaryHeader, ...(summaryRows.length ? summaryRows : [[]])]);
      XLSX.utils.book_append_sheet(wb, ws0, 'Summary');

      const ws1 = XLSX.utils.aoa_to_sheet([empHeader, ...empRows]);
      XLSX.utils.book_append_sheet(wb, ws1, 'Employees');

      const ws2 = XLSX.utils.aoa_to_sheet([attHeader, ...(attRows.length ? attRows : [['','','','','','','']])]);
      XLSX.utils.book_append_sheet(wb, ws2, 'Attendance');

      const ws3 = XLSX.utils.aoa_to_sheet([compHeader, ...(compRows.length ? compRows : [['','','','','','','']])]);
      XLSX.utils.book_append_sheet(wb, ws3, 'CompOff');

      const tag = `${selected === 'ALL' ? 'ALL' : (employees.find(e=>String(e._id)===String(selected))?.code || 'emp')}_${from}_to_${to}`;
      XLSX.writeFile(wb, `alldetails_${tag}.xlsx`);
    } catch {
      // Fallback: CSVs
      const esc = (v) => `"${String(v ?? '').replace(/"/g,'""')}"`;
      const makeCSV = (header, rows) => [header, ...rows].map(r => r.map(esc).join(',')).join('\n');

      const save = (csv, name) => {
        const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      };

      const tag = `${selected === 'ALL' ? 'ALL' : (employees.find(e=>String(e._id)===String(selected))?.code || 'emp')}_${from}_to_${to}`;
      save(makeCSV(summaryHeader, summaryRows), `Summary_${tag}.csv`);
      save(makeCSV(empHeader, empRows),      `Employees_${tag}.csv`);
      save(makeCSV(attHeader, attRows),      `Attendance_${tag}.csv`);
      save(makeCSV(compHeader, compRows),    `CompOff_${tag}.csv`);
    }
  };

  return (
    <div className="card">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div className="md:col-span-2">
          <div className="label mb-1">Employee</div>
          <select className="select w-full" value={selected} onChange={e=>setSelected(e.target.value)}>
            {employeeOptions.map(e => (
              <option key={e._id} value={e._id}>
                {e._id === 'ALL' ? 'All Employees' : `${e.name} (${e.code})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="label mb-1">From</div>
          <input type="date" className="input w-full" value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div>
          <div className="label mb-1">To</div>
          <input type="date" className="input w-full" value={to} onChange={e=>setTo(e.target.value)} />
        </div>

        <div className="flex md:justify-end">
          <button className="btn btn-primary" onClick={download}>
            Download
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Exports <b>Summary</b>, <b>Employees</b>, <b>Attendance</b> (with remarks), and <b>CompOff</b> for the selected employee (or All)
        and only within the chosen date range.
      </p>
    </div>
  );
}
