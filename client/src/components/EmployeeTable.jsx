import React, { useEffect, useState, useMemo } from "react";
import { api } from "../api";
import LoadingScreen from "./LoadingScreen";

/** Helpers */
const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => {
  if (!d) return "";
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "");
const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");

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
  MoveRight,
  Edit2,
  Trash2,
} from 'lucide-react';

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

/** Defaults */
const GENDER = ["Male", "Female", "Others"];
const SHIFTS = ["Day Shift", "Night Shift"];
const TEAMS = ["On Going", "One Time", "FTE"]; // ✅ add FTE
const DESIGNATIONS = [
  "Senior Process Analyst",
  "Process Analyst",
  "Trainee Process Analyst",
  "Senior Process Associate",
  "Process Associate",
  "Trainee Process Associate",
  "SME",
  "ATL",
];
const LAPTOP_STATUS = ["PC", "Laptop"];

export default function EmployeeTable() {
  const [employees, setEmployees] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);

  /** ✅ current login */
  const role = useMemo(() => localStorage.getItem("role") || "", []);
  const [adminEmail, setAdminEmail] = useState("");

  /** ✅ transfer */
  const [admins, setAdmins] = useState([]); // list of admins to transfer to
  const [transferTo, setTransferTo] = useState({}); // { [empId]: adminId }
  const canTransfer = role === "super" || role === "admin_tl";

  /** ✅ Success / Error dialog */
  const [successOpen, setSuccessOpen] = useState(false);
  const [successText, setSuccessText] = useState("Saved successfully!");
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorText, setErrorText] = useState("");

  const openSuccess = (text) => {
    setSuccessText(text || "Success");
    setSuccessOpen(true);
  };
  const openError = (text) => {
    setErrorText(text || "Something went wrong");
    setErrorOpen(true);
  };

  /** form state */
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [dob, setDob] = useState("");
  const [certDob, setCertDob] = useState("");
  const [doj, setDoj] = useState("");
  const [designation, setDesignation] = useState("");
  const [shift, setShift] = useState("");
  const [teamType, setTeamType] = useState("");
  const [department, setDepartment] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [laptopStatus, setLaptopStatus] = useState("");
  const [presentLocation, setPresentLocation] = useState("");
  const [permanentLocation, setPermanentLocation] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false); // Collapsed by default

  const loadEmployees = async () => {
    const { data } = await api.get("/employees");
    setEmployees(Array.isArray(data) ? data : []);
  };

  // ✅ IMPORTANT: /admins is super-only in your backend.
  // So we call /admins/transfer-targets which must return only role=admin list,
  // scoped for admin_tl.
  const loadAdmins = async () => {
    try {
      const { data } = await api.get("/admins/transfer-targets");
      const list = Array.isArray(data) ? data : [];
      setAdmins(list);
    } catch {
      setAdmins([]);
    }
  };

  // ✅ load me + employees (+ admins list if transfer allowed)
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get("/auth/me");
        setAdminEmail(me.data?.email || "");
      } catch {
        setAdminEmail("");
      }

      try {
        await loadEmployees();
      } catch (e) {
        openError(e?.response?.data?.message || "Failed to load employees");
      }

      if (canTransfer) {
        await loadAdmins();
      }
      setInitialLoad(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setGender("");
    setBloodGroup("");
    setDob("");
    setCertDob("");
    setDoj("");
    setDesignation("");
    setShift("");
    setTeamType("");
    setDepartment("");
    setPersonalEmail("");
    setOfficialEmail("");
    setPersonalPhone("");
    setParentPhone("");
    setLaptopStatus("");
    setPresentLocation("");
    setPermanentLocation("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // ✅ Do NOT send owner fields from frontend.
    const payload = {
      name,
      code,
      gender,
      bloodGroup,
      dob: dob || null,
      certDob: certDob || null,
      doj: doj || null,
      designation,
      shift,
      teamType,
      department,
      personalEmail,
      officialEmail,
      personalPhone,
      parentPhone,
      laptopStatus,
      presentLocation,
      permanentLocation,
    };

    setBusy(true);
    try {
      if (editingId) {
        await api.put(`/employees/${editingId}`, payload);
        openSuccess("Employee updated successfully ✅");
      } else {
        await api.post("/employees", payload);
        openSuccess("Employee added successfully ✅");
      }
      await loadEmployees();
      resetForm();
      setFormExpanded(false);
    } catch (err) {
      openError(err?.response?.data?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onEdit = (e) => {
    setEditingId(e._id);
    setName(e.name || "");
    setCode(e.code || "");
    setGender(e.gender || "");
    setBloodGroup(e.bloodGroup || "");
    setDob(toDateInput(e.dob));
    setCertDob(toDateInput(e.certDob));
    setDoj(toDateInput(e.doj));
    setDesignation(e.designation || "");
    setShift(e.shift || "");
    setTeamType(e.teamType || "");
    setDepartment(e.department || "");
    setPersonalEmail(e.personalEmail || "");
    setOfficialEmail(e.officialEmail || "");
    setPersonalPhone(e.personalPhone || "");
    setParentPhone(e.parentPhone || "");
    setLaptopStatus(e.laptopStatus || "");
    setPresentLocation(e.presentLocation || "");
    setPermanentLocation(e.permanentLocation || "");
    setFormExpanded(true);

    document.getElementById("employee-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const onDelete = async (e) => {
    if (!window.confirm(`Delete ${e.name} (${e.code})?`)) return;
    try {
      await api.delete(`/employees/${e._id}`);
      await loadEmployees();
      if (editingId === e._id) resetForm();
      openSuccess("Employee deleted successfully ✅");
    } catch (err) {
      openError(err?.response?.data?.message || "Delete failed");
    }
  };

  // ✅ Transfer (Admin TL / Super only)
  const transferEmployee = async (empId) => {
    const newAdminId = transferTo[empId];
    if (!newAdminId) return openError("Select Admin first");

    try {
      await api.put(`/employees/${empId}/reassign`, { newAdminId });
      openSuccess("Employee transferred successfully ✅");

      // cleanup selection and reload
      setTransferTo((p) => {
        const x = { ...p };
        delete x[empId];
        return x;
      });

      await loadEmployees();
    } catch (err) {
      openError(err?.response?.data?.message || "Transfer failed");
    }
  };

  const columns = useMemo(
    () => [
      { key: "name", title: "Name" },
      { key: "code", title: "Emp ID" },

      // ✅ show owner info (from schema)
      { key: "teamHeadEmail", title: "Team Head (Owner Email)" },
      { key: "createdByRole", title: "Owner Role" },

      { key: "gender", title: "Gender" },
      { key: "bloodGroup", title: "Blood" },
      { key: "dob", title: "DOB", render: (e) => fmtDate(e.dob) },
      { key: "certDob", title: "Cert DOB", render: (e) => fmtDate(e.certDob) },
      { key: "doj", title: "DOJ", render: (e) => fmtDate(e.doj) },
      { key: "designation", title: "Designation" },
      { key: "shift", title: "Shift" },
      { key: "teamType", title: "Team" },
      { key: "department", title: "Department" },
      { key: "personalEmail", title: "Personal Email" },
      { key: "officialEmail", title: "Official Email" },
      { key: "personalPhone", title: "Personal Phone" },
      { key: "parentPhone", title: "Parent Phone" },
      { key: "laptopStatus", title: "Laptop" },
      { key: "presentLocation", title: "Present Location" },
      { key: "permanentLocation", title: "Permanent Location" },
    ],
    []
  );

  // ✅ sort employees so NEWLY ADDED appears LAST
  const employeesSorted = useMemo(() => {
    const arr = [...employees];
    if (arr.some((e) => e.createdAt)) {
      arr.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      return arr;
    }
    return arr;
  }, [employees]);

  const downloadEmployeesExcel = async () => {
    const header = [
      "Name",
      "Emp ID",
      "Team Head Email",
      "Owner Role",
      "Gender",
      "Blood Group",
      "DOB",
      "Cert DOB",
      "Date of Joining",
      "Designation",
      "Shift",
      "Team",
      "Department",
      "Personal Email",
      "Official Email",
      "Personal Phone",
      "Parent Phone",
      "Laptop Status",
      "Present Location",
      "Permanent Location",
      "Created At",
      "Updated At",
    ];

    const rows = employeesSorted.map((e) => [
      e.name || "",
      e.code || "",
      e.teamHeadEmail || "",
      e.createdByRole || "",
      e.gender || "",
      e.bloodGroup || "",
      fmtDate(e.dob),
      fmtDate(e.certDob),
      fmtDate(e.doj),
      e.designation || "",
      e.shift || "",
      e.teamType || "",
      e.department || "",
      e.personalEmail || "",
      e.officialEmail || "",
      e.personalPhone || "",
      e.parentPhone || "",
      e.laptopStatus || "",
      e.presentLocation || "",
      e.permanentLocation || "",
      e.createdAt ? new Date(e.createdAt).toLocaleString() : "",
      e.updatedAt ? new Date(e.updatedAt).toLocaleString() : "",
    ]);

    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, "Employees");
      XLSX.writeFile(wb, `employees_${toYMD(new Date())}.xlsx`);
    } catch {
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `employees_${toYMD(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  // ✅ helper: show admin teams (new multi-field) in dropdown label
  const adminTeamsLabel = (a) => {
    const arr = Array.isArray(a.allowedTeamTypes) ? a.allowedTeamTypes : [];
    if (arr.length) return arr.join(", ");
    return a.allowedTeamType || "No Team";
  };
  if (initialLoad) {
    return <LoadingScreen text="Loading Team" subtext="Fetching the team details..." />;
  }

  return (
    <>
      {/* ✅ SUCCESS MODAL */}
      {successOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSuccessOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-green-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">✅</div>
                <div>
                  <div className="font-semibold text-green-800">Success</div>
                  <div className="text-sm text-gray-700">{successText}</div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button className="btn btn-primary" onClick={() => setSuccessOpen(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ ERROR MODAL */}
      {errorOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setErrorOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-red-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">❌</div>
                <div>
                  <div className="font-semibold text-red-800">Error</div>
                  <div className="text-sm text-gray-700">{errorText}</div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button className="btn btn-outline" onClick={() => setErrorOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full space-y-6">
        {/* TOP: Add / Update form */}
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
                <InputField label="Logged-in Email" icon={Mail} required placeholder="admin@example.com" name="adminEmail" value={adminEmail} readOnly />
              </div>
              <InputField label="Name" icon={User} required placeholder="Enter full name" name="name" value={name} onChange={(e) => setName(e.target.value)} />
              <InputField label="Emp ID" icon={IdCard} required placeholder="Enter employee ID" name="code" value={code} onChange={(e) => setCode(e.target.value)} disabled={!!editingId} />

              {/* Row 2 */}
              <SelectField label="Gender" icon={User} name="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Select gender</option>
                {GENDER.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </SelectField>
              <InputField label="Blood Group" icon={Droplet} placeholder="e.g., O+, A-" name="bloodGroup" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} />
              <InputField label="DOB" icon={Calendar} required type="date" name="dob" value={dob} onChange={(e) => setDob(e.target.value)} />
              <InputField label="Cert. DOB" icon={Calendar} type="date" name="certDob" value={certDob} onChange={(e) => setCertDob(e.target.value)} />

              {/* Row 3 */}
              <InputField label="Date of Joining" icon={Calendar} required type="date" name="doj" value={doj} onChange={(e) => setDoj(e.target.value)} />
              <SelectField label="Designation" icon={Briefcase} name="designation" value={designation} onChange={(e) => setDesignation(e.target.value)}>
                <option value="">Select designation</option>
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </SelectField>
              <SelectField label="Shift" icon={Clock} name="shift" value={shift} onChange={(e) => setShift(e.target.value)}>
                <option value="">Select shift</option>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectField>
              <SelectField label="Team" icon={Users} name="teamType" value={teamType} onChange={(e) => setTeamType(e.target.value)}>
                <option value="">Select team</option>
                {TEAMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SelectField>

              {/* Row 4 */}
              <InputField label="Department" icon={Building} placeholder="e.g., Production / HR / IT" name="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
              <InputField label="Personal Email" icon={Mail} placeholder="Enter personal email" name="personalEmail" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} />
              <InputField label="Official Email" icon={Mail} placeholder="Enter official email" name="officialEmail" value={officialEmail} onChange={(e) => setOfficialEmail(e.target.value)} />
              <InputField label="Personal Contact No." icon={Phone} placeholder="Enter contact number" name="personalPhone" value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)} />

              {/* Row 5 */}
              <InputField label="Parent Contact No." icon={Phone} placeholder="Enter parent contact number" name="parentPhone" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
              <SelectField label="Laptop Status" icon={Laptop} name="laptopStatus" value={laptopStatus} onChange={(e) => setLaptopStatus(e.target.value)}>
                <option value="">Select status</option>
                {LAPTOP_STATUS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </SelectField>
              <InputField label="Present Location" icon={MapPin} placeholder="Enter present location" name="presentLocation" value={presentLocation} onChange={(e) => setPresentLocation(e.target.value)} />
              <InputField label="Permanent Location" icon={MapPin} placeholder="Enter permanent location" name="permanentLocation" value={permanentLocation} onChange={(e) => setPermanentLocation(e.target.value)} />
            </div>

            <div className="pt-6">
              <button type="submit" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-blue-200" disabled={busy}>
                <Save size={18} />
                {busy ? "Saving…" : editingId ? "Update Employee" : "Save Employee"}
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

        {/* BELOW: Team table + Download */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-blue-600">Team</h3>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm" onClick={downloadEmployeesExcel}>
              Download
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1600px]">
              <thead className="bg-white">
                <tr className="text-left text-blue-700 font-semibold border-b border-slate-100">
                  {columns.map((col) => (
                    <th key={col.key} className="pb-2 px-3">
                      {col.title}
                    </th>
                  ))}
                  {canTransfer && <th className="pb-2 px-3">Transfer</th>}
                  <th className="pb-2 px-3 w-[140px]">Actions</th>
                </tr>
              </thead>

              <tbody>
                {!employeesSorted.length && (
                  <tr className="border-t">
                    <td className="py-6 px-3 text-gray-500" colSpan={columns.length + (canTransfer ? 2 : 1)}>
                      No employees yet.
                    </td>
                  </tr>
                )}

                {employeesSorted.map((e) => (
                  <tr key={e._id} className="border-t">
                    {columns.map((col) => (
                      <td key={col.key} className="py-2 px-3">
                        {col.render ? col.render(e) : e[col.key] || ""}
                      </td>
                    ))}
                    {/* ✅ Transfer column (only TL / Super) */}
                    {canTransfer && (
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <select
                              className="w-36 pl-2.5 pr-8 py-1.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-md text-xs font-medium text-slate-700 outline-none transition-colors appearance-none"
                              value={transferTo[e._id] || ""}
                              onChange={(ev) =>
                                setTransferTo((p) => ({
                                  ...p,
                                  [e._id]: ev.target.value,
                                }))
                              }
                            >
                              <option value="">Transfer to…</option>
                              {admins.map((a) => (
                                <option key={a._id} value={a._id}>
                                  {a.email} ({adminTeamsLabel(a)})
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>

                          <button className="p-1.5 border border-green-200 text-green-600 hover:bg-green-50 rounded-md transition-colors flex items-center justify-center shrink-0" onClick={() => transferEmployee(e._id)} title="Move Employee">
                            <MoveRight size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    )}

                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center justify-center shrink-0" onClick={() => onEdit(e)} title="Edit Employee">
                          <Edit2 size={14} strokeWidth={2.5} />
                        </button>
                        <button className="p-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center justify-center shrink-0" onClick={() => onDelete(e)} title="Delete Employee">
                          <Trash2 size={14} strokeWidth={2.5} />
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
    </>
  );
}
