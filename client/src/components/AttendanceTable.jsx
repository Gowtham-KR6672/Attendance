import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

const STATUS_LIST = [
  "PRESENT",
  "WFH",
  "ABSENT",
  "CASUAL LEAVE",
  "SICK LEAVE",
  "SESSION_01 LEAVE",
  "SESSION_02 LEAVE",
  "COMP-OFF",
  "PHONE INTIMATION",
  "NO INTIMATION",
  "NCNS",
  "L.O.P.",
  "HOLIDAY",
  "RELIEVED",
  "1 Hr Per MORN",
  "2 Hr Per MORN",
  "1 Hr Per EVE",
  "2 Hr Per EVE",
  "SUNDAY",
  "3rd Saturday Week off",
];

const statusClass = (s) =>
  ({
    PRESENT: "bg-green-600 text-white",
    WFH: "bg-blue-500 text-white",
    ABSENT: "bg-slate-500 text-white",

    "CASUAL LEAVE": "bg-cyan-500 text-white",
    "SICK LEAVE": "bg-lime-500 text-black",
    "SESSION_01 LEAVE": "bg-amber-300 text-black",
    "SESSION_02 LEAVE": "bg-yellow-400 text-black",
    "COMP-OFF": "bg-yellow-300 text-black",

    "PHONE INTIMATION": "bg-black text-white",
    "NO INTIMATION": "bg-red-700 text-white",
    NCNS: "bg-pink-700 text-white",
    "L.O.P.": "bg-red-600 text-white",

    HOLIDAY: "bg-emerald-400 text-black",
    RELIEVED: "bg-gray-400 text-black",

    "1 Hr Per MORN": "bg-amber-200 text-black",
    "2 Hr Per MORN": "bg-orange-300 text-black",
    "1 Hr Per EVE": "bg-teal-200 text-black",
    "2 Hr Per EVE": "bg-teal-300 text-black",

    SUNDAY: "bg-gray-800 text-white",
    "3rd Saturday Week off": "bg-slate-800 text-white",
  }[s] || "bg-white text-black");

/* =========================
   Local-time date helpers
========================= */
const pad = (n) => String(n).padStart(2, "0");
const toYMD = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const parseYMD = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};
const getMonthRange = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 0, 0, 0, 0);
  return { from: toYMD(start), to: toYMD(end) };
};
const buildDates = (fromStr, toStr) => {
  const out = [];
  let d = parseYMD(fromStr);
  const end = parseYMD(toStr);
  while (d <= end) {
    out.push(toYMD(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return out;
};

const isSundayYMD = (ymd) => parseYMD(ymd).getDay() === 0;
const isThirdSaturdayYMD = (ymd) => {
  const dt = parseYMD(ymd);
  const day = dt.getDay();
  const dateNum = dt.getDate();
  return day === 6 && dateNum >= 15 && dateNum <= 21;
};

/* =========================
   Monthly Permission Points
========================= */
const PERMISSION_POINTS = {
  "1 Hr Per MORN": 1,
  "1 Hr Per EVE": 1,
  "2 Hr Per MORN": 2,
  "2 Hr Per EVE": 2,
};
const isPermission = (s) =>
  Object.prototype.hasOwnProperty.call(PERMISSION_POINTS, s);
const pointsOf = (s) => PERMISSION_POINTS[s] || 0;

/* =========================
   Sticky column widths
========================= */
const COL_W = { sno: 60, emp: 220, id: 140, day: 130 };
const LEFT = { sno: 0, emp: COL_W.sno, id: COL_W.sno + COL_W.emp };

export default function AttendanceTable() {
  // ✅ FIXED (removed "=s")
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);

  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [{ from, to }, setRange] = useState(() =>
    getMonthRange(new Date().toISOString().slice(0, 7))
  );

  const [teamFilter, setTeamFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");

  const role = useMemo(() => localStorage.getItem("role") || "", []);
  const scope = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("scope") || "{}");
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    if (role === "admin" || role === "admin_tl") {
      if (scope.teamType) setTeamFilter(scope.teamType);
      if (scope.shift) setShiftFilter(scope.shift);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editing, setEditing] = useState(null); // { empId, date }
  const [savingKey, setSavingKey] = useState(""); // "empId|YYYY-MM-DD"

  const [msg, setMsg] = useState("");
  const [showMsg, setShowMsg] = useState(false);
  const openMsg = (text) => {
    setMsg(text);
    setShowMsg(true);
  };

  useEffect(() => setRange(getMonthRange(month)), [month]);

  // Load employees
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/employees");
        setEmployees(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        openMsg(e?.response?.data?.message || "Failed to load employees");
      }
    })();
  }, []);

  // Load attendance
  const [recordsLoaded, setRecordsLoaded] = useState(false);

  const fetchRecords = async () => {
    const { data } = await api.get("/attendance", { params: { from, to } });
    setRecords(Array.isArray(data) ? data : []);
    setRecordsLoaded(true);
  };

  useEffect(() => {
    if (!from || !to) return;
    (async () => {
      try {
        await fetchRecords();
      } catch (e) {
        console.error(e);
        openMsg(e?.response?.data?.message || "Failed to load attendance");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const teamOptions = useMemo(
    () => Array.from(new Set(employees.map((e) => e.teamType).filter(Boolean))),
    [employees]
  );
  const shiftOptions = useMemo(
    () => Array.from(new Set(employees.map((e) => e.shift).filter(Boolean))),
    [employees]
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (e) =>
          (!teamFilter || e.teamType === teamFilter) &&
          (!shiftFilter || e.shift === shiftFilter)
      ),
    [employees, teamFilter, shiftFilter]
  );

  const filteredEmployeesSorted = useMemo(() => {
    const arr = [...filteredEmployees];
    if (arr.some((e) => e.createdAt)) {
      arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return arr;
    }
    arr.sort((a, b) =>
      String(a.code || "").localeCompare(String(b.code || ""))
    );
    return arr;
  }, [filteredEmployees]);

  const dates = useMemo(() => buildDates(from, to), [from, to]);

  /**
   * ✅ FIX: timezone-safe map key
   * - If backend sends "YYYY-MM-DD" use it directly.
   * - If backend sends ISO datetime, convert to local YMD.
   */
  const recMap = useMemo(() => {
    const m = new Map();
    for (const r of records) {
      const empId = r.employee?._id || r.employee;
      const raw = r.date;

      const ymd =
        typeof raw === "string" && raw.length === 10 ? raw : toYMD(new Date(raw));

      m.set(`${empId}|${ymd}`, r);
    }
    return m;
  }, [records]);

  const getMonthlyTotals = (empId) => {
    let permissionPoints = 0;
    let casualCount = 0;
    let sickCount = 0;

    for (const d of dates) {
      const rec = recMap.get(`${empId}|${d}`);
      const s = rec?.status || "";
      permissionPoints += pointsOf(s);
      if (s === "CASUAL LEAVE") casualCount += 1;
      if (s === "SICK LEAVE") sickCount += 1;
    }
    return { permissionPoints, casualCount, sickCount };
  };

  const validateMonthlyRules = (empId, date, newStatus) => {
    if (newStatus === "SUNDAY" || newStatus === "3rd Saturday Week off") return true;

    const { permissionPoints, casualCount, sickCount } = getMonthlyTotals(empId);
    const prev = recMap.get(`${empId}|${date}`)?.status || "";

    const nextPermissionPoints = permissionPoints - pointsOf(prev) + pointsOf(newStatus);
    if (isPermission(newStatus) && nextPermissionPoints > 2) {
      openMsg(
        `Monthly permission limit is 2 points. Already used ${permissionPoints} point(s). You cannot set "${newStatus}" now.`
      );
      return false;
    }

    const nextCasual =
      casualCount - (prev === "CASUAL LEAVE" ? 1 : 0) + (newStatus === "CASUAL LEAVE" ? 1 : 0);
    const nextSick =
      sickCount - (prev === "SICK LEAVE" ? 1 : 0) + (newStatus === "SICK LEAVE" ? 1 : 0);

    if (newStatus === "CASUAL LEAVE" && nextCasual > 1) {
      openMsg("CASUAL LEAVE is allowed only 1 time per month.");
      return false;
    }
    if (newStatus === "SICK LEAVE" && nextSick > 1) {
      openMsg("SICK LEAVE is allowed only 1 time per month.");
      return false;
    }
    return true;
  };

  const saveStatus = async (empId, date, status) => {
    const key = `${empId}|${date}`;
    if (savingKey) return;

    setMsg("");
    setShowMsg(false);

    const prev = recMap.get(key)?.status || "";
    if ((prev || "") === (status || "")) {
      setEditing(null);
      return;
    }

    if (!validateMonthlyRules(empId, date, status)) {
      setEditing(null);
      return;
    }

    setSavingKey(key);
    try {
      await api.post("/attendance/mark", {
        employeeId: empId,
        date, // YYYY-MM-DD
        status: status || "",
      });
      await fetchRecords();
    } catch (e) {
      console.error(e);
      openMsg(e?.response?.data?.message || "Save failed. Please try again.");
      try {
        await fetchRecords();
      } catch {}
    } finally {
      setSavingKey("");
      setEditing(null);
    }
  };

  /* =========================================================
     ✅ Auto-fill SUNDAY + 3rd Saturday only ONCE per range
  ========================================================= */
  const didAutoFillRef = useRef(false);

  useEffect(() => {
    didAutoFillRef.current = false;
  }, [from, to]);

  useEffect(() => {
    if (!recordsLoaded) return;
    if (!dates.length || !employees.length) return;
    if (didAutoFillRef.current) return;

    didAutoFillRef.current = true;

    const missing = [];
    for (const emp of employees) {
      for (const d of dates) {
        const k = `${emp._id}|${d}`;
        const rec = recMap.get(k);
        if (rec?.status) continue;

        if (isSundayYMD(d)) missing.push({ employeeId: emp._id, date: d, status: "SUNDAY" });
        else if (isThirdSaturdayYMD(d))
          missing.push({ employeeId: emp._id, date: d, status: "3rd Saturday Week off" });
      }
    }
    if (!missing.length) return;

    (async () => {
      try {
        await Promise.all(missing.map((x) => api.post("/attendance/mark", x)));
        await fetchRecords();
      } catch (e) {
        console.error("Auto weekend fill failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsLoaded, from, to, employees.length, dates.length]);

  return (
    <div className="space-y-4">
      {showMsg && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowMsg(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-white shadow-xl border border-red-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="text-sm text-red-700 font-medium">{msg}</div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowMsg(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-12 gap-4">
        <div className="card col-span-12 md:col-span-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="label mb-1">Month</div>
              <input
                type="month"
                className="input w-full"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            <div>
              <div className="label mb-1">Team</div>
              <select
                className="select w-full"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                disabled={(role === "admin" || role === "admin_tl") && !!scope.teamType}
              >
                <option value="">All</option>
                {teamOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="label mb-1">Shift</div>
              <select
                className="select w-full"
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                disabled={(role === "admin" || role === "admin_tl") && !!scope.shift}
              >
                <option value="">All</option>
                {shiftOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card col-span-12 md:col-span-4">
          <div className="font-semibold mb-2">Legend</div>
          <div className="flex flex-wrap gap-2">
            {STATUS_LIST.map((s) => (
              <span key={s} className={`text-xs px-2 py-1 rounded ${statusClass(s)}`}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[1100px] table-fixed">
            <thead className="bg-gray-50 sticky top-0 z-[80]">
              <tr className="text-left text-gray-600">
                <th
                  className="pb-2 px-3 sticky top-0 left-0 z-[90] bg-gray-50"
                  style={{ width: COL_W.sno }}
                >
                  #
                </th>
                <th
                  className="pb-2 px-3 sticky top-0 z-[90] bg-gray-50"
                  style={{ left: LEFT.emp, width: COL_W.emp }}
                >
                  Employee
                </th>
                <th
                  className="pb-2 px-3 sticky top-0 z-[90] bg-gray-50"
                  style={{ left: LEFT.id, width: COL_W.id }}
                >
                  Emp ID
                </th>

                {dates.map((d) => (
                  <th
                    key={d}
                    className="pb-2 px-3 text-center sticky top-0 z-[80] bg-gray-50"
                    style={{ width: COL_W.day }}
                  >
                    {parseYMD(d).toLocaleDateString()}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredEmployeesSorted.map((emp, idx) => (
                <tr key={emp._id} className="border-t">
                  <td className="py-2 px-3 sticky left-0 bg-white z-40" style={{ width: COL_W.sno }}>
                    {idx + 1}
                  </td>
                  <td className="px-3 sticky bg-white z-40" style={{ left: LEFT.emp, width: COL_W.emp }}>
                    {emp.name}
                  </td>
                  <td className="px-3 sticky bg-white z-40" style={{ left: LEFT.id, width: COL_W.id }}>
                    {emp.code}
                  </td>

                  {dates.map((d) => {
                    const key = `${emp._id}|${d}`;
                    const rec = recMap.get(key);
                    const val = rec?.status || "";
                    const note = rec?.note || "";
                    const isEditing = editing?.empId === emp._id && editing?.date === d;
                    const isSaving = savingKey === `${emp._id}|${d}`;

                    const title = [
                      `${emp.name} — ${parseYMD(d).toLocaleDateString()}`,
                      val ? `Status: ${val}` : "Status: —",
                      note ? `Remark: ${note}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n");

                    return (
                      <td key={key} className="px-3 py-1" style={{ width: COL_W.day }}>
                        {isEditing ? (
                          <select
                            autoFocus
                            className="select w-full"
                            value={val || ""}
                            disabled={!!savingKey}
                            onChange={(e) => saveStatus(emp._id, d, e.target.value)}
                            onBlur={() => setEditing(null)}
                          >
                            <option value="">—</option>
                            {STATUS_LIST.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="relative">
                            <button
                              className={`w-full rounded text-xs px-2 py-2 border ${
                                val ? statusClass(val) : "bg-white"
                              } ${isSaving ? "opacity-60" : ""}`}
                              onClick={() => !savingKey && setEditing({ empId: emp._id, date: d })}
                              title={title}
                              disabled={!!savingKey}
                            >
                              {isSaving ? "Saving..." : val || "—"}
                            </button>

                            {note && (
                              <span
                                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500"
                                title={`Remark: ${note}`}
                              />
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {!filteredEmployeesSorted.length && (
                <tr className="border-t">
                  <td className="py-6 px-3 text-gray-500" colSpan={3 + dates.length}>
                    No employees match the selected filters.
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
