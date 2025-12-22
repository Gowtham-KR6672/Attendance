import React from 'react';

export default function DateRangePicker({ from, to, setFrom, setTo }) {
  return (
    <div className="flex items-end gap-3">
      <div>
        <div className="label">From</div>
        <input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} />
      </div>
      <div>
        <div className="label">To</div>
        <input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} />
      </div>
    </div>
  );
}
