import React, { useEffect, useState } from "react";
import { api } from "../api";

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

  // create form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showCreatePwd, setShowCreatePwd] = useState(false);

  const [newRole, setNewRole] = useState("admin");
  const [teamType, setTeamType] = useState(""); // admin single
  const [teamTypes, setTeamTypes] = useState([]); // admin_tl multi
  const [shift, setShift] = useState("");

  // edit mode
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("admin");
  const [editTeamType, setEditTeamType] = useState("");
  const [editTeamTypes, setEditTeamTypes] = useState([]);
  const [editShift, setEditShift] = useState("");

  // password change in edit (optional)
  const [editPassword, setEditPassword] = useState("");
  const [showEditPwd, setShowEditPwd] = useState(false);

  // ✅ dialog box states
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
    const { data } = await api.get("/admins");
    setList(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  if (role !== "super") {
    return <div className="card">You do not have access to this page.</div>;
  }

  const resetCreate = () => {
    setEmail("");
    setPassword("");
    setShowCreatePwd(false);
    setNewRole("admin");
    setTeamType("");
    setTeamTypes([]);
    setShift("");
  };

  const createAdmin = async (e) => {
    e.preventDefault();

    // ✅ Validation using dialog box (no alert)
    if (!email || !password) return openError("Email & Password required");

    if (newRole === "admin" && !teamType) {
      return openError("Team is required for Admin");
    }

    if (newRole === "admin_tl" && (!teamTypes || teamTypes.length === 0)) {
      return openError("Select at least 1 Team for Admin TL");
    }

    try {
      await api.post("/admins", {
        email,
        password,
        role: newRole,

        // admin
        allowedTeamType: newRole === "admin" ? teamType : undefined,

        // admin_tl
        allowedTeamTypes: newRole === "admin_tl" ? teamTypes : undefined,

        // shift optional (ignored for super)
        allowedShift: newRole === "super" ? undefined : shift || undefined,
      });

      openSuccess(
        newRole === "admin_tl"
          ? "Admin TL created successfully ✅"
          : "Admin created successfully ✅"
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
    setEditTeamType(a.allowedTeamType || "");
    setEditTeamTypes(Array.isArray(a.allowedTeamTypes) ? a.allowedTeamTypes : []);
    setEditShift(a.allowedShift || "");

    // reset password field each time edit opens
    setEditPassword("");
    setShowEditPwd(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRole("admin");
    setEditTeamType("");
    setEditTeamTypes([]);
    setEditShift("");
    setEditPassword("");
    setShowEditPwd(false);
  };

  const saveEdit = async (id, rowRole) => {
    if (rowRole === "super") return;

    if (editRole === "admin" && !editTeamType) {
      return openError("Team is required for Admin");
    }

    if (editRole === "admin_tl" && (!editTeamTypes || editTeamTypes.length === 0)) {
      return openError("Select at least 1 Team for Admin TL");
    }

    try {
      await api.put(`/admins/${id}`, {
        role: editRole,
        allowedTeamType: editRole === "admin" ? editTeamType : undefined,
        allowedTeamTypes: editRole === "admin_tl" ? editTeamTypes : undefined,
        allowedShift: editRole === "super" ? undefined : editShift || undefined,

        // ✅ only send if typed
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
    if (a.role === "admin_tl") {
      const arr = Array.isArray(a.allowedTeamTypes) ? a.allowedTeamTypes : [];
      return arr.join(", ");
    }
    return a.allowedTeamType || "";
  };

  return (
    <div className="space-y-4">
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
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                  ✅
                </div>
                <div>
                  <div className="font-semibold text-green-800">Success</div>
                  <div className="text-sm text-gray-700">{successText}</div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
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
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                  ❌
                </div>
                <div>
                  <div className="font-semibold text-red-800">Error</div>
                  <div className="text-sm text-gray-700">{errorText}</div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="btn btn-outline" onClick={() => setErrorOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE */}
      <div className="card">
        <h3 className="font-semibold mb-3">Create Admin</h3>

        <form className="grid grid-cols-1 md:grid-cols-6 gap-3" onSubmit={createAdmin}>
          <div>
            <div className="label">Email</div>
            <input className="input w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <div className="label">Password</div>
            <div className="flex gap-2">
              <input
                type={showCreatePwd ? "text" : "password"}
                className="input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowCreatePwd((v) => !v)}
              >
                {showCreatePwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <div className="label">Role</div>
            <select
              className="select w-full"
              value={newRole}
              onChange={(e) => {
                const r = e.target.value;
                setNewRole(r);
                setTeamType("");
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

          {/* Team */}
          <div>
            <div className="label">Team</div>

            {newRole === "admin_tl" ? (
              <select
                className="select w-full"
                multiple
                value={teamTypes}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setTeamTypes(selected);
                }}
                disabled={newRole === "super"}
                style={{ minHeight: 40 }}
              >
                {TEAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="select w-full"
                value={teamType}
                onChange={(e) => setTeamType(e.target.value)}
                disabled={newRole === "super"}
              >
                <option value="">Select...</option>
                {TEAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {newRole === "admin_tl" && (
              <div className="text-xs text-gray-500 mt-1">
                Tip: hold Ctrl (Windows) / Cmd (Mac) to select multiple.
              </div>
            )}
          </div>

          <div>
            <div className="label">Shift</div>
            <select
              className="select w-full"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              disabled={newRole === "super"}
            >
              <option value="">(Optional)</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-6">
            <button className="btn btn-primary">Create</button>
          </div>
        </form>

        <div className="text-xs text-gray-500 mt-2">
          Roles: <b>Super</b> (all access), <b>Admin TL</b> (multi-team scoped),{" "}
          <b>Admin</b> (single-team scoped).
        </div>
      </div>

      {/* LIST */}
      <div className="card">
        <h3 className="font-semibold mb-3">Admins</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="pb-2 px-3">Email</th>
                <th className="pb-2 px-3">Role</th>
                <th className="pb-2 px-3">Team</th>
                <th className="pb-2 px-3">Shift</th>
                <th className="pb-2 px-3">Reset Password</th>
                <th className="pb-2 px-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {list.map((a) => {
                const isEditing = editingId === a._id;

                return (
                  <tr key={a._id} className="border-t">
                    <td className="py-2 px-3">{a.email}</td>

                    <td className="px-3">
                      {isEditing ? (
                        <select
                          className="select w-full"
                          value={editRole}
                          onChange={(e) => {
                            const r = e.target.value;
                            setEditRole(r);
                            setEditTeamType("");
                            setEditTeamTypes([]);
                          }}
                          disabled={isSuperRow(a)}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        a.role
                      )}
                    </td>

                    <td className="px-3">
                      {isEditing ? (
                        editRole === "admin_tl" ? (
                          <select
                            className="select w-full"
                            multiple
                            value={editTeamTypes}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions).map(
                                (o) => o.value
                              );
                              setEditTeamTypes(selected);
                            }}
                            disabled={isSuperRow(a)}
                            style={{ minHeight: 40 }}
                          >
                            {TEAM_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            className="select w-full"
                            value={editTeamType}
                            onChange={(e) => setEditTeamType(e.target.value)}
                            disabled={editRole === "super" || isSuperRow(a)}
                          >
                            <option value="">Select...</option>
                            {TEAM_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        )
                      ) : (
                        renderTeamsText(a)
                      )}
                    </td>

                    <td className="px-3">
                      {isEditing ? (
                        <select
                          className="select w-full"
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
                        a.allowedShift || ""
                      )}
                    </td>

                    {/* Reset Password */}
                    <td className="px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type={showEditPwd ? "text" : "password"}
                            className="input w-full"
                            placeholder="New password (optional)"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            disabled={isSuperRow(a)}
                          />
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setShowEditPwd((v) => !v)}
                            disabled={isSuperRow(a)}
                          >
                            {showEditPwd ? "Hide" : "Show"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button className="btn btn-primary btn-sm" onClick={() => saveEdit(a._id, a.role)}>
                            Save
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {!isSuperRow(a) && (
                            <>
                              <button className="btn btn-outline btn-sm" onClick={() => startEdit(a)}>
                                Edit
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => remove(a._id, a.role)}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!list.length && (
                <tr className="border-t">
                  <td className="py-6 px-3 text-gray-500" colSpan={6}>
                    No admins yet.
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
