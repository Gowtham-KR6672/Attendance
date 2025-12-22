// client/src/pages/Team.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';

const emptyForm = {
  name: '',
  code: '',
  gender: '',
  bloodGroup: '',
  dob: '',        // 'YYYY-MM-DD' for <input type="date">
  certDob: '',
  doj: '',
  designation: '',
  shift: '',
  teamType: '',
  personalEmail: '',
  officialEmail: '',
  personalPhone: '',
  parentPhone: '',
  laptopStatus: '',
  presentLocation: '',
  permanentLocation: '',
  department: '',
  remarks: '',
};

const toDateInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function Team() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get('/employees');
    setList(data || []);
  };

  useEffect(() => { load(); }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  // Create or Update
  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await api.put(`/employees/${editingId}`, form);
      } else {
        await api.post('/employees', form);
      }
      await load();
      resetForm();
    } catch (err) {
      alert(err?.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  // Load row into form for editing
  const onEdit = (emp) => {
    setEditingId(emp._id);
    setForm({
      name: emp.name || '',
      code: emp.code || '',
      gender: emp.gender || '',
      bloodGroup: emp.bloodGroup || '',
      dob: toDateInput(emp.dob),
      certDob: toDateInput(emp.certDob),
      doj: toDateInput(emp.doj),
      designation: emp.designation || '',
      shift: emp.shift || '',
      teamType: emp.teamType || '',
      personalEmail: emp.personalEmail || '',
      officialEmail: emp.officialEmail || '',
      personalPhone: emp.personalPhone || '',
      parentPhone: emp.parentPhone || '',
      laptopStatus: emp.laptopStatus || '',
      presentLocation: emp.presentLocation || '',
      permanentLocation: emp.permanentLocation || '',
      department: emp.department || '',
      remarks: emp.remarks || '',
    });
    // scroll left panel into view if needed
    document.getElementById('employee-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* LEFT: Add/Update form */}
      <div className="col-span-12 md:col-span-4">
        <div className="card" id="employee-form">
          <div className="font-semibold mb-3">
            {editingId ? 'Update Employee' : 'Add Employee'}
          </div>
          <form onSubmit={onSubmit} className="space-y-3">
            <input className="input w-full" placeholder="Name" name="name" value={form.name} onChange={onChange} required />

            <input className="input w-full" placeholder="Emp ID" name="code" value={form.code} onChange={onChange} required />

            <div className="grid grid-cols-2 gap-3">
              <select className="select w-full" name="gender" value={form.gender} onChange={onChange}>
                <option value="">Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Others</option>
              </select>
              <input className="input w-full" placeholder="Blood Group" name="bloodGroup" value={form.bloodGroup} onChange={onChange} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <input type="date" className="input w-full" name="dob" value={form.dob} onChange={onChange} placeholder="DOB" />
              <input type="date" className="input w-full" name="certDob" value={form.certDob} onChange={onChange} placeholder="Cert DOB" />
              <input type="date" className="input w-full" name="doj" value={form.doj} onChange={onChange} placeholder="DOJ" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <select className="select w-full" name="designation" value={form.designation} onChange={onChange}>
                <option value="">Designation</option>
                <option>ATL</option>
                <option>SME</option>
                <option>Senior Process Associate</option>
                <option>Process Associate</option>
                <option>Trainee Process Associate</option>
              </select>
              <select className="select w-full" name="shift" value={form.shift} onChange={onChange}>
                <option value="">Shift</option>
                <option>Day Shift</option>
                <option>Night Shift</option>
              </select>
              <select className="select w-full" name="teamType" value={form.teamType} onChange={onChange}>
                <option value="">Team</option>
                <option>On Going</option>
                <option>One Time</option>
                <option>FTE</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input className="input w-full" placeholder="Personal Email" name="personalEmail" value={form.personalEmail} onChange={onChange} />
              <input className="input w-full" placeholder="Official Email" name="officialEmail" value={form.officialEmail} onChange={onChange} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input className="input w-full" placeholder="Personal Phone" name="personalPhone" value={form.personalPhone} onChange={onChange} />
              <input className="input w-full" placeholder="Parent Phone" name="parentPhone" value={form.parentPhone} onChange={onChange} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select className="select w-full" name="laptopStatus" value={form.laptopStatus} onChange={onChange}>
                <option value="">Laptop Status</option>
                <option>PC</option>
                <option>Laptop</option>
              </select>
              <input className="input w-full" placeholder="Department" name="department" value={form.department} onChange={onChange} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input className="input w-full" placeholder="Present Location" name="presentLocation" value={form.presentLocation} onChange={onChange} />
              <input className="input w-full" placeholder="Permanent Location" name="permanentLocation" value={form.permanentLocation} onChange={onChange} />
            </div>

            <textarea className="input w-full" rows={2} placeholder="Remarks" name="remarks" value={form.remarks} onChange={onChange} />

            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Update' : 'Save'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-outline" onClick={resetForm} disabled={busy}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT: table */}
      <div className="col-span-12 md:col-span-8">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Team</div>
            {/* your existing Download button here */}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="p-2">Name</th>
                  <th className="p-2">Emp ID</th>
                  <th className="p-2">Designation</th>
                  <th className="p-2">Shift</th>
                  <th className="p-2">Team</th>
                  <th className="p-2">Personal Email</th>
                  <th className="p-2">Official Email</th>
                  <th className="p-2">Personal Phone</th>
                  <th className="p-2">Parent Phone</th>
                  <th className="p-2">Present Location</th>
                  <th className="p-2">Permanent Location</th>
                  <th className="p-2 w-[80px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((emp) => (
                  <tr key={emp._id} className="border-t">
                    <td className="p-2">{emp.name}</td>
                    <td className="p-2">{emp.code}</td>
                    <td className="p-2">{emp.designation}</td>
                    <td className="p-2">{emp.shift}</td>
                    <td className="p-2">{emp.teamType}</td>
                    <td className="p-2">{emp.personalEmail}</td>
                    <td className="p-2">{emp.officialEmail}</td>
                    <td className="p-2">{emp.personalPhone}</td>
                    <td className="p-2">{emp.parentPhone}</td>
                    <td className="p-2">{emp.presentLocation}</td>
                    <td className="p-2">{emp.permanentLocation}</td>
                    <td className="p-2">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onEdit(emp)}
                        title="Edit this employee"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={12}>No employees found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
