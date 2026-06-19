import React, { useEffect, useState, useRef } from "react";
import { api } from "../api";
import {
  UserPlus,
  Users,
  Search,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Info,
  Plus,
  X,
  ChevronDown
} from "lucide-react";
import LoadingScreen from "./LoadingScreen";

const TEAM_TYPES = ["On Going", "One Time", "FTE"];
const SHIFTS = ["Day Shift", "Night Shift"];

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "admin_tl", label: "Admin TL" },
  { value: "super", label: "Super Admin" },
];

export default function AdminManager() {
  const role = localStorage.getItem("role");
  const [list, setList] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // create form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showCreatePwd, setShowCreatePwd] = useState(false);

  const [newRole, setNewRole] = useState("admin");
  const [teamTypes, setTeamTypes] = useState([]); 
  const [shift, setShift] = useState("");

  // edit mode
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("admin");
  const [editTeamTypes, setEditTeamTypes] = useState([]);
  const [editShift, setEditShift] = useState("");

  // password change in edit (optional)
  const [editPassword, setEditPassword] = useState("");
  const [showEditPwd, setShowEditPwd] = useState(false);

  // dialog box states
  const [successOpen, setSuccessOpen] = useState(false);
  const [successText, setSuccessText] = useState("Success");
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

  const load = async () => {
    try {
      const { data } = await api.get("/admins");
      setList(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (role !== "super") {
    return <div className="card border border-slate-200 shadow-sm p-6 rounded-xl bg-white">You do not have access to this page.</div>;
  }

  const resetCreate = () => {
    setEmail("");
    setPassword("");
    setShowCreatePwd(false);
    setNewRole("admin");
    setTeamTypes([]);
    setShift("");
  };

  const createAdmin = async (e) => {
    e.preventDefault();

    if (!email || !password) return openError("Email & Password required");

    if ((newRole === "admin" || newRole === "admin_tl") && (!teamTypes || teamTypes.length === 0)) {
      return openError(`Select at least 1 Team for ${newRole === "admin" ? "Admin" : "Admin TL"}`);
    }

    try {
      await api.post("/admins", {
        email,
        password,
        role: newRole,
        allowedTeamTypes: newRole === "admin" || newRole === "admin_tl" ? teamTypes : undefined,
        allowedShift: newRole === "super" ? undefined : shift || undefined,
      });

      openSuccess(
        newRole === "admin_tl"
          ? "Admin TL created successfully ✅"
          : newRole === "admin"
          ? "Admin created successfully ✅"
          : "Super Admin created successfully ✅"
      );

      resetCreate();
      load();
    } catch (err) {
      openError(err?.response?.data?.message || "Create failed");
    }
  };

  const startEdit = (a) => {
    setEditingId(a._id);
    setEditRole(a.role || "admin");

    const teams =
      Array.isArray(a.allowedTeamTypes) && a.allowedTeamTypes.length
        ? a.allowedTeamTypes
        : a.allowedTeamType
        ? [a.allowedTeamType]
        : [];
    setEditTeamTypes(teams);
    setEditShift(a.allowedShift || "");
    setEditPassword("");
    setShowEditPwd(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRole("admin");
    setEditTeamTypes([]);
    setEditShift("");
    setEditPassword("");
    setShowEditPwd(false);
  };

  const saveEdit = async (id, rowRole) => {
    if (rowRole === "super") return;

    if ((editRole === "admin" || editRole === "admin_tl") && (!editTeamTypes || editTeamTypes.length === 0)) {
      return openError(`Select at least 1 Team for ${editRole === "admin" ? "Admin" : "Admin TL"}`);
    }

    try {
      await api.put(`/admins/${id}`, {
        role: editRole,
        allowedTeamTypes: editRole === "admin" || editRole === "admin_tl" ? editTeamTypes : undefined,
        allowedShift: editRole === "super" ? undefined : editShift || undefined,
        newPassword: editPassword.trim() ? editPassword : undefined,
      });

      openSuccess("Admin updated successfully ✅");
      cancelEdit();
      load();
    } catch (err) {
      openError(err?.response?.data?.message || "Update failed");
    }
  };

  const remove = async (id, rowRole) => {
    if (rowRole === "super") return;
    if (!window.confirm("Delete this admin?")) return;

    try {
      await api.delete(`/admins/${id}`);
      openSuccess("Admin deleted successfully ✅");
      load();
    } catch (err) {
      openError(err?.response?.data?.message || "Delete failed");
    }
  };

  const isSuperRow = (a) => a.role === "super";

  const renderTeamsText = (a) => {
    const arr = Array.isArray(a.allowedTeamTypes) ? a.allowedTeamTypes : [];
    if (arr.length) return arr.join(", ");
    return a.allowedTeamType || "—";
  };

  const filteredList = list.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const teamText = Array.isArray(a.allowedTeamTypes) ? a.allowedTeamTypes.join(" ") : (a.allowedTeamType || "");
    return (a.email || "").toLowerCase().includes(q) || teamText.toLowerCase().includes(q);
  });

  // Custom multi-select component for Teams
  const TeamSelect = ({ value, onChange, disabled }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (ref.current && !ref.current.contains(event.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (t) => {
      if (disabled) return;
      if (value.includes(t)) {
        onChange(value.filter((v) => v !== t));
      } else {
        onChange([...value, t]);
      }
    };

    return (
      <div className="relative w-full" ref={ref}>
        <div 
          className={`w-full min-h-[42px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm transition-colors flex flex-wrap items-center gap-1.5 ${disabled ? "bg-slate-50 cursor-not-allowed opacity-70" : "cursor-pointer hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"}`}
          onClick={() => !disabled && setOpen(!open)}
        >
          {value.length === 0 ? (
            <span className="text-slate-400">Select...</span>
          ) : (
            value.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">
                {t}
                <button 
                  type="button"
                  className="hover:text-red-500 transition-colors"
                  onClick={(e) => { e.stopPropagation(); toggleOption(t); }}
                >
                  <X size={12} />
                </button>
              </span>
            ))
          )}
          <ChevronDown size={14} className="ml-auto text-slate-400 shrink-0" />
        </div>

        {open && !disabled && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {TEAM_TYPES.map(t => (
              <div 
                key={t}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${value.includes(t) ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
                onClick={(e) => { e.stopPropagation(); toggleOption(t); }}
              >
                {t}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const sortedList = [...filteredList].sort((a,b) => {
    if(a.role === 'super' && b.role !== 'super') return -1;
    if(a.role !== 'super' && b.role === 'super') return 1;
    return 0;
  });

  if (initialLoad) {
    return <LoadingScreen text="Loading Admins" subtext="Fetching the admin list..." />;
  }

  return (
    <div className="w-full space-y-6">
      
      {/* SUCCESS MODAL */}
      {successOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 animate-in fade-in duration-200" onClick={() => setSuccessOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-green-200 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">✅</div>
                <div>
                  <div className="font-bold text-slate-800 text-lg">Success</div>
                  <div className="text-sm text-slate-600 mt-0.5">{successText}</div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors" onClick={() => setSuccessOpen(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ERROR MODAL */}
      {errorOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 animate-in fade-in duration-200" onClick={() => setErrorOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-red-200 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">❌</div>
                <div>
                  <div className="font-bold text-slate-800 text-lg">Error</div>
                  <div className="text-sm text-slate-600 mt-0.5">{errorText}</div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button className="px-5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-sm transition-colors" onClick={() => setErrorOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: CREATE ADMIN */}
      <div className="border border-slate-200 rounded-xl shadow-sm bg-white p-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UserPlus size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-blue-600">Create Admin</h2>
            <p className="text-sm text-slate-500">Create a new admin and assign access.</p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={createAdmin}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
            
            <div className="w-full">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Email <span className="text-red-500">*</span></label>
              <input 
                className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium placeholder:text-slate-400 placeholder:font-normal" 
                placeholder="e.g. admin@example.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>

            <div className="w-full">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Password <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showCreatePwd ? "text" : "password"}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium placeholder:text-slate-400 placeholder:font-normal pr-10"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowCreatePwd((v) => !v)}>
                    {showCreatePwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button type="button" className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 rounded-lg text-xs font-bold transition-colors shrink-0" onClick={() => setShowCreatePwd((v) => !v)}>
                  {showCreatePwd ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="w-full">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Role <span className="text-red-500">*</span></label>
              <select
                className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium"
                value={newRole}
                onChange={(e) => {
                  setNewRole(e.target.value);
                  setTeamTypes([]);
                }}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Team</label>
              {(newRole === "admin" || newRole === "admin_tl") ? (
                <>
                  <TeamSelect value={teamTypes} onChange={setTeamTypes} disabled={newRole === "super"} />
                  <div className="text-[10px] text-slate-500 mt-1.5">
                    Tip: Hold Ctrl (Windows) / Cmd (Mac) to select multiple
                  </div>
                </>
              ) : (
                <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 text-sm rounded-lg appearance-none text-slate-400 font-medium cursor-not-allowed" disabled>
                  <option>(Not applicable)</option>
                </select>
              )}
            </div>

            <div className="w-full">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Shift (Optional)</label>
              <select
                className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                disabled={newRole === "super"}
              >
                <option value="">Select shift</option>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            
          </div>

          <div>
            <button className="inline-flex items-center justify-center gap-2 bg-[#256eed] hover:brightness-110 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors text-sm shrink-0">
              <Plus size={16} /> Create
            </button>
          </div>
        </form>

        <div className="flex items-center gap-2 text-xs text-slate-500 mt-6 pt-4 border-t border-slate-100">
          <Info size={14} className="text-blue-600 shrink-0" />
          <span>Roles: <b>Super</b> (all access), <b>Admin TL</b> (multi-team scoped), <b>Admin</b> (multi-team selectable).</span>
        </div>
      </div>

      {/* SECTION 2: ADMINS LIST */}
      <div className="border border-slate-200 rounded-xl shadow-sm bg-white p-6 animate-in fade-in duration-300 delay-75">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-600">Admins</h2>
              <p className="text-sm text-slate-500">Manage system admins and their access.</p>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <input 
              type="text"
              placeholder="Search by email or team..." 
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 px-4 text-left font-semibold text-slate-800">Email</th>
                <th className="py-3 px-4 text-left font-semibold text-slate-800">Role</th>
                <th className="py-3 px-4 text-left font-semibold text-slate-800">Team</th>
                <th className="py-3 px-4 text-left font-semibold text-slate-800">Shift</th>
                <th className="py-3 px-4 text-left font-semibold text-slate-800">Reset Password</th>
                <th className="py-3 px-4 text-left font-semibold text-slate-800">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredList.map((a) => {
                const isEditing = editingId === a._id;

                return (
                  <tr key={a._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 text-slate-700 font-medium">{a.email}</td>

                    <td className="py-4 px-4">
                      {isEditing ? (
                        <select
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 focus:border-blue-500 outline-none transition-colors text-sm rounded-md text-slate-700"
                          value={editRole}
                          onChange={(e) => {
                            const r = e.target.value;
                            setEditRole(r);
                            setEditTeamTypes([]);
                          }}
                          disabled={isSuperRow(a)}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.value}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600 capitalize">{a.role}</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-slate-600">
                      {isEditing ? (
                        (editRole === "admin" || editRole === "admin_tl") ? (
                          <TeamSelect
                            value={editTeamTypes}
                            onChange={setEditTeamTypes}
                            disabled={isSuperRow(a)}
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )
                      ) : (
                        renderTeamsText(a)
                      )}
                    </td>

                    <td className="py-4 px-4 text-slate-600">
                      {isEditing ? (
                        <select
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 focus:border-blue-500 outline-none transition-colors text-sm rounded-md text-slate-700"
                          value={editShift}
                          onChange={(e) => setEditShift(e.target.value)}
                          disabled={editRole === "super" || isSuperRow(a)}
                        >
                          <option value="">(Optional)</option>
                          {SHIFTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        a.allowedShift || "—"
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type={showEditPwd ? "text" : "password"}
                            className="w-32 px-2 py-1.5 bg-white border border-slate-200 focus:border-blue-500 outline-none transition-colors text-sm rounded-md text-slate-700"
                            placeholder="New pwd"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            disabled={isSuperRow(a)}
                          />
                          <button
                            type="button"
                            className="p-1.5 border border-slate-200 text-slate-500 hover:text-blue-600 rounded-md transition-colors"
                            onClick={() => setShowEditPwd((v) => !v)}
                            disabled={isSuperRow(a)}
                          >
                            {showEditPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button className="px-3 py-1.5 bg-[#256eed] hover:brightness-110 text-white rounded-md font-semibold text-xs transition-colors" onClick={() => saveEdit(a._id, a.role)}>
                            Save
                          </button>
                          <button className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-md font-semibold text-xs transition-colors" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {!isSuperRow(a) && (
                            <>
                              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-md font-semibold text-xs transition-colors" onClick={() => startEdit(a)}>
                                <Edit2 size={12} /> Edit
                              </button>
                              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-md font-semibold text-xs transition-colors" onClick={() => remove(a._id, a.role)}>
                                <Trash2 size={12} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!filteredList.length && (
                <tr>
                  <td className="py-12 px-4 text-center text-slate-500" colSpan={6}>
                    {searchQuery ? "No admins match your search." : "No admins found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
