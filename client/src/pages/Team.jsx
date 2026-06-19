// client/src/pages/Team.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import {
  UserPlus,
  Mail,
  User,
  IdCard,
  Droplet,
  Calendar,
  Briefcase,
  Clock,
  Users,
  Building,
  Laptop,
  MapPin,
  Phone,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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
  loggedInEmail: '',
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
  const [formExpanded, setFormExpanded] = useState(false);

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
      setFormExpanded(false);
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
      loggedInEmail: emp.loggedInEmail || '',
    });
    setFormExpanded(true);
    // scroll left panel into view if needed
    document.getElementById('employee-form')?.scrollIntoView({ behavior: 'smooth' });
  };

const InputField = ({ label, icon: Icon, required, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-600">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-500">
        {Icon && <Icon size={16} strokeWidth={2.5} />}
      </div>
      <input className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg" {...props} />
    </div>
  </div>
);

const SelectField = ({ label, icon: Icon, required, children, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-600">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-500">
        {Icon && <Icon size={16} strokeWidth={2.5} />}
      </div>
      <select className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none" {...props}>
        {children}
      </select>
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  </div>
);

  return (
    <div className="flex flex-col gap-6">
      {/* TOP: Add/Update form */}
      <div className="card w-full border border-blue-50 transition-all duration-300" id="employee-form" style={{ borderRadius: '15px', background: 'linear-gradient(145deg, #ffffff 0%, #f9fbff 100%)', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
        <div className={`flex items-center justify-between cursor-pointer ${formExpanded ? 'mb-6' : ''}`} onClick={() => setFormExpanded(!formExpanded)}>
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600">
              <UserPlus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-600">{editingId ? 'Update Employee' : 'Add Employee'}</h2>
              <p className="text-sm text-gray-500">Enter employee details to create a new employee profile</p>
            </div>
          </div>
          <button type="button" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
            {formExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {formExpanded && (
          <form onSubmit={onSubmit} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
            {/* Row 1 */}
            <div className="md:col-span-2">
              <InputField label="Logged-in Email" icon={Mail} required placeholder="admin@example.com" name="loggedInEmail" value={form.loggedInEmail || ''} onChange={onChange} />
            </div>
            <InputField label="Name" icon={User} required placeholder="Enter full name" name="name" value={form.name} onChange={onChange} />
            <InputField label="Emp ID" icon={IdCard} required placeholder="Enter employee ID" name="code" value={form.code} onChange={onChange} />

            {/* Row 2 */}
            <SelectField label="Gender" icon={User} name="gender" value={form.gender} onChange={onChange}>
              <option value="">Select gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Others</option>
            </SelectField>
            <InputField label="Blood Group" icon={Droplet} placeholder="e.g., O+, A-" name="bloodGroup" value={form.bloodGroup} onChange={onChange} />
            <InputField label="DOB" icon={Calendar} required type="date" name="dob" value={form.dob} onChange={onChange} />
            <InputField label="Cert. DOB" icon={Calendar} type="date" name="certDob" value={form.certDob} onChange={onChange} />

            {/* Row 3 */}
            <InputField label="Date of Joining" icon={Calendar} required type="date" name="doj" value={form.doj} onChange={onChange} />
            <SelectField label="Designation" icon={Briefcase} name="designation" value={form.designation} onChange={onChange}>
              <option value="">Select designation</option>
              <option>ATL</option>
              <option>SME</option>
              <option>Senior Process Analyst</option>
              <option>Process Analyst</option>
              <option>Trainee Process Analyst</option>
              <option>Senior Process Associate</option>
              <option>Process Associate</option>
              <option>Trainee Process Associate</option>
            </SelectField>
            <SelectField label="Shift" icon={Clock} name="shift" value={form.shift} onChange={onChange}>
              <option value="">Select shift</option>
              <option>Day Shift</option>
              <option>Night Shift</option>
            </SelectField>
            <SelectField label="Team" icon={Users} name="teamType" value={form.teamType} onChange={onChange}>
              <option value="">Select team</option>
              <option>On Going</option>
              <option>One Time</option>
              <option>FTE</option>
            </SelectField>

            {/* Row 4 */}
            <InputField label="Department" icon={Building} placeholder="e.g., Production / HR / IT" name="department" value={form.department} onChange={onChange} />
            <InputField label="Personal Email" icon={Mail} placeholder="Enter personal email" name="personalEmail" value={form.personalEmail} onChange={onChange} />
            <InputField label="Official Email" icon={Mail} placeholder="Enter official email" name="officialEmail" value={form.officialEmail} onChange={onChange} />
            <InputField label="Personal Contact No." icon={Phone} placeholder="Enter contact number" name="personalPhone" value={form.personalPhone} onChange={onChange} />

            {/* Row 5 */}
            <InputField label="Parent Contact No." icon={Phone} placeholder="Enter parent contact number" name="parentPhone" value={form.parentPhone} onChange={onChange} />
            <SelectField label="Laptop Status" icon={Laptop} name="laptopStatus" value={form.laptopStatus} onChange={onChange}>
              <option value="">Select status</option>
              <option>PC</option>
              <option>Laptop</option>
            </SelectField>
            <InputField label="Present Location" icon={MapPin} placeholder="Enter present location" name="presentLocation" value={form.presentLocation} onChange={onChange} />
            <InputField label="Permanent Location" icon={MapPin} placeholder="Enter permanent location" name="permanentLocation" value={form.permanentLocation} onChange={onChange} />
          </div>

          <div className="pt-6">
            <button type="submit" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-blue-200" disabled={busy}>
              <Save size={18} />
              {busy ? 'Saving…' : editingId ? 'Update Employee' : 'Save Employee'}
            </button>
            {editingId && (
              <button type="button" className="ml-4 text-gray-500 hover:text-gray-700 font-medium" onClick={() => { resetForm(); setFormExpanded(false); }} disabled={busy}>
                Cancel
              </button>
            )}
          </div>
        </form>
        )}
      </div>

      {/* BOTTOM: table */}
      <div className="card border border-gray-100 shadow-sm rounded-[15px]">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-lg text-blue-600">Team Directory</div>
          {/* your existing Download button here */}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="p-3 font-semibold rounded-tl-lg">Name</th>
                <th className="p-3 font-semibold">Emp ID</th>
                <th className="p-3 font-semibold">Designation</th>
                <th className="p-3 font-semibold">Shift</th>
                <th className="p-3 font-semibold">Team</th>
                <th className="p-3 font-semibold">Personal Email</th>
                <th className="p-3 font-semibold">Official Email</th>
                <th className="p-3 font-semibold">Personal Phone</th>
                <th className="p-3 font-semibold">Parent Phone</th>
                <th className="p-3 font-semibold">Present Location</th>
                <th className="p-3 font-semibold">Permanent Location</th>
                <th className="p-3 font-semibold rounded-tr-lg w-[80px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((emp) => (
                <tr key={emp._id} className="border-t hover:bg-gray-50 transition-colors">
                  <td className="p-3">{emp.name}</td>
                  <td className="p-3">{emp.code}</td>
                  <td className="p-3">{emp.designation}</td>
                  <td className="p-3">{emp.shift}</td>
                  <td className="p-3">{emp.teamType}</td>
                  <td className="p-3">{emp.personalEmail}</td>
                  <td className="p-3">{emp.officialEmail}</td>
                  <td className="p-3">{emp.personalPhone}</td>
                  <td className="p-3">{emp.parentPhone}</td>
                  <td className="p-3">{emp.presentLocation}</td>
                  <td className="p-3">{emp.permanentLocation}</td>
                  <td className="p-3">
                    <button
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
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
                  <td className="p-6 text-center text-gray-500 bg-gray-50 rounded-b-lg" colSpan={12}>No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
