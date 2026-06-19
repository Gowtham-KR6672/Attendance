import React, { useState } from 'react';

export default function MarkAttendanceModal({ open, onClose, onSave, employee }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState('Present');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave({ employeeId: employee._id, date, status, checkIn, checkOut, note });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Mark Attendance – {employee.name}</h3>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <div className="label">Date</div>
            <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} required />
          </div>
          <div>
            <div className="label">Status</div>
            <select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
              <option>Present</option>
              <option>Absent</option>
              <option>Leave</option>
              <option>WFH</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">Check‑in (HH:MM)</div>
              <input placeholder="09:30" className="input" value={checkIn} onChange={e=>setCheckIn(e.target.value)} />
            </div>
            <div>
              <div className="label">Check‑out (HH:MM)</div>
              <input placeholder="18:00" className="input" value={checkOut} onChange={e=>setCheckOut(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="label">Note</div>
            <textarea className="input min-h-[90px]" value={note} onChange={e=>setNote(e.target.value)} />
          </div>
          <button className="btn btn-primary w-full">Save</button>
        </form>
      </div>
    </div>
  );
}
