import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  IdCard,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  UserRound,
  UsersRound,
} from "lucide-react";
import { api } from "../api";
import MaleImage from "../asset/Male.png";
import FemaleImage from "../asset/female.png";

const STATUS_LIST = [
  "PRESENT",
  "CASUAL LEAVE",
  "SICK LEAVE",
  "SESSION_01 LEAVE",
  "SESSION_02 LEAVE",
  "COMP-OFF",
  "PHONE INTIMATION",
  "NO INTIMATION",
  "L.O.P.",
  "1 Hr Per MORN",
  "2 Hr Per MORN",
  "1 Hr Per EVE",
  "2 Hr Per EVE",
];

const DAY_LEAVE = [
  "CASUAL LEAVE",
  "SICK LEAVE",
  "SESSION_01 LEAVE",
  "SESSION_02 LEAVE",
  "COMP-OFF",
  "PHONE INTIMATION",
  "NO INTIMATION",
  "L.O.P.",
];

const HOUR_LEAVE = [
  "1 Hr Per MORN",
  "2 Hr Per MORN",
  "1 Hr Per EVE",
  "2 Hr Per EVE",
];

const DAY_EQ = {
  "SESSION_01 LEAVE": 0.5,
  "SESSION_02 LEAVE": 0.5,
  "CASUAL LEAVE": 1,
  "SICK LEAVE": 1,
  "COMP-OFF": 1,
  "PHONE INTIMATION": 1,
  "NO INTIMATION": 1,
  "L.O.P.": 1,
};

const HOUR_EQ = {
  "1 Hr Per MORN": 1,
  "2 Hr Per MORN": 2,
  "1 Hr Per EVE": 1,
  "2 Hr Per EVE": 2,
};

const pad = (value) => String(value).padStart(2, "0");
const toYMD = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const chartLabel = (status) =>
  status
    .replace(" LEAVE", " LEAVE")
    .replace("PHONE INTIMATION", "PHONE INTIMATION")
    .replace("NO INTIMATION", "NO INTIMATION");

export default function EmployeeInsight() {
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedEmpId, setHighlightedEmpId] = useState(null);
  const dropdownRef = useRef(null);
  const searchTermRef = useRef("");
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key.length === 1) {
        searchTermRef.current += e.key.toLowerCase();

        const match = employees.find(emp =>
          emp.name.toLowerCase().startsWith(searchTermRef.current) ||
          emp.code.toLowerCase().startsWith(searchTermRef.current)
        );

        if (match) {
          setHighlightedEmpId(match._id);
          const el = document.getElementById(`emp-option-${match._id}`);
          if (el) {
            el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
          searchTermRef.current = "";
          setHighlightedEmpId(null);
        }, 800);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [isOpen, employees]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setHighlightedEmpId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const today = new Date();
  const [from, setFrom] = useState(
    toYMD(new Date(today.getFullYear(), today.getMonth(), 1))
  );
  const [to, setTo] = useState(
    toYMD(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  );

  useEffect(() => {
    let active = true;
    api.get("/employees").then(({ data }) => {
      if (!active) return;
      const list = Array.isArray(data) ? data : [];
      setEmployees(list);
      if (list.length) setEmpId(list[0]._id);
    });
    return () => {
      active = false;
    };
  }, []);

  const employee = useMemo(
    () => employees.find((item) => item._id === empId) || null,
    [empId, employees]
  );

  const load = useCallback(async () => {
    if (!empId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/attendance", {
        params: { employeeId: empId, from, to },
      });
      setRecords(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [empId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(STATUS_LIST.map((status) => [status, 0]));
    records.forEach((record) => {
      if (result[record.status] !== undefined) result[record.status] += 1;
    });
    return result;
  }, [records]);

  const chartData = useMemo(
    () =>
      STATUS_LIST.map((status) => ({
        status,
        label: chartLabel(status),
        days: counts[status] || 0,
      })),
    [counts]
  );

  const dayRows = useMemo(
    () =>
      DAY_LEAVE.map((status) => ({
        status,
        count: counts[status] || 0,
        equivalent: (counts[status] || 0) * (DAY_EQ[status] || 0),
      })).filter((row) => row.count > 0),
    [counts]
  );

  const hourRows = useMemo(
    () =>
      HOUR_LEAVE.map((status) => ({
        status,
        count: counts[status] || 0,
        equivalent: (counts[status] || 0) * (HOUR_EQ[status] || 0),
      })).filter((row) => row.count > 0),
    [counts]
  );

  const totalDayCount = useMemo(
    () => dayRows.reduce((sum, row) => sum + row.count, 0),
    [dayRows]
  );
  const totalDayEquivalent = useMemo(
    () => dayRows.reduce((sum, row) => sum + row.equivalent, 0),
    [dayRows]
  );
  const totalHours = useMemo(
    () => hourRows.reduce((sum, row) => sum + row.equivalent, 0),
    [hourRows]
  );

  const details = employee
    ? [
      [UserRound, "Name", employee.name],
      [IdCard, "Emp ID", employee.code],
      [BriefcaseBusiness, "Designation", employee.designation || "-"],
      [UsersRound, "Team", employee.teamType || "-"],
      [Clock3, "Shift", employee.shift || "-"],
      [Mail, "Personal Email", employee.personalEmail || "-"],
      [Phone, "Phone", employee.personalPhone || "-"],
      [Building2, "Department", employee.department || "-"],
      [MapPin, "Present Location", employee.presentLocation || "-"],
    ]
    : [];

  return (
    <section className="insight-page">
      <div className="insight-layout">
        <div className="insight-sidebar">
          <aside className="insight-id-card" style={{ position: "relative" }} ref={dropdownRef}>
            <div className="insight-id-header" style={{ position: "relative" }}>
              <div
                className="insight-id-select"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <span>Employee Data</span>
                <ChevronDown
                  color="white"
                  size={20}
                  style={{
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </div>
            </div>

            {isOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "62px",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  overflowY: "auto",
                  backgroundColor: "#fff",
                  zIndex: 50,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                {employees.map((item) => (
                  <div
                    key={item._id}
                    id={`emp-option-${item._id}`}
                    onClick={() => {
                      setEmpId(item._id);
                      setIsOpen(false);
                      setHighlightedEmpId(null);
                    }}
                    style={{
                      padding: "10px 14px",
                      cursor: "pointer",
                      color: highlightedEmpId === item._id ? "#2563eb" : "#1c3157",
                      fontSize: "13px",
                      fontWeight: empId === item._id || highlightedEmpId === item._id ? 700 : 500,
                      backgroundColor: empId === item._id ? "#f0f5ff" : "transparent",
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background-color 0.15s ease, color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (empId !== item._id) e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (empId !== item._id) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {item.name} ({item.code})
                  </div>
                ))}
              </div>
            )}

            <div className="insight-id-body">
              <div className="insight-id-identity">
                <span className="insight-id-avatar">
                  {employee?.gender?.toLowerCase() === "female" ? (
                    <img src={FemaleImage} alt="Female Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <img src={MaleImage} alt="Male Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  )}
                </span>
                <h2>{employee?.name || "Employee"}</h2>
                <strong>{employee?.code || "-"}</strong>
                <p>{employee?.designation || "-"}</p>
              </div>

              <dl className="insight-id-details">
                {details.map(([Icon, label, value]) => (
                  <div key={label}>
                    <Icon size={18} strokeWidth={1.9} />
                    <dt>{label}</dt>
                    <span>:</span>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="insight-id-footer">
              <div className="insight-id-dates">
                <label>
                  <CalendarDays size={19} />
                  <span>
                    From
                    <input
                      type="date"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </span>
                </label>
                <label>
                  <CalendarDays size={19} />
                  <span>
                    To
                    <input
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </span>
                </label>
              </div>

              <button className="insight-id-reload" type="button" onClick={load}>
                <RefreshCw size={19} className={loading ? "animate-spin" : ""} />
                {loading ? "Loading..." : "Reload"}
              </button>
            </div>
          </aside>
        </div>

        <div className="insight-main">
          <article className="insight-card insight-chart-card">
            <div className="insight-chart-heading">
              <h3>
                Attendance (Counts) — {from} to {to}
              </h3>
              <span className="insight-chart-icon">
                <BarChart3 size={18} />
              </span>
            </div>

            <div className="insight-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 18, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="insightBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3678ff" />
                      <stop offset="100%" stopColor="#164ad8" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#dce7f8" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={-32}
                    height={64}
                    textAnchor="end"
                    tick={{ fill: "#52698e", fontSize: 9 }}
                    axisLine={{ stroke: "#aebfda" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#52698e", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(45, 108, 246, 0.05)" }}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #dbe7fa",
                      boxShadow: "0 8px 24px rgba(37, 99, 235, .12)",
                    }}
                  />
                  <Bar
                    dataKey="days"
                    fill="url(#insightBar)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={42}
                  >
                    <LabelList
                      dataKey="days"
                      position="top"
                      fill="#1c2d4c"
                      fontSize={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="insight-legend">
              <span />
              days
            </div>

            <div className="insight-summary-grid">
              <div className="insight-summary">
                <span className="insight-summary-icon">
                  <CalendarDays size={20} />
                </span>
                <div>
                  <span>Total day-leave (days)</span>
                  <strong>{totalDayEquivalent.toFixed(1)}</strong>
                </div>
              </div>
              <div className="insight-summary">
                <span className="insight-summary-icon">
                  <Clock3 size={20} />
                </span>
                <div>
                  <span>Total hour Permission Taken (hrs)</span>
                  <strong>{totalHours}</strong>
                </div>
              </div>
            </div>
          </article>

          <div className="insight-tables-grid">
            <article className="insight-card insight-table-card">
              <div className="insight-section-title">
                <CalendarDays size={15} />
                <h3>Leave (Day-based)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="insight-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Day equivalent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRows.length ? (
                      <>
                        {dayRows.map((row) => (
                          <tr key={row.status}>
                            <td>{row.status}</td>
                            <td>{row.count}</td>
                            <td>{row.equivalent.toFixed(1)}</td>
                          </tr>
                        ))}
                        <tr className="insight-total-row">
                          <td>Total</td>
                          <td>{totalDayCount}</td>
                          <td>{totalDayEquivalent.toFixed(1)}</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={3} className="insight-empty text-center align-middle" style={{ height: '220px' }}>
                          <div className="flex flex-col items-center justify-center h-full gap-3">
                            <svg className="w-14 h-14 text-blue-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-gray-500 font-medium">No day-based leave taken.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="insight-card insight-table-card">
              <div className="insight-section-title">
                <Clock3 size={15} />
                <h3>Permission Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="insight-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourRows.length ? (
                      <>
                        {hourRows.map((row) => (
                          <tr key={row.status}>
                            <td>{row.status}</td>
                            <td>{row.count}</td>
                            <td>{row.equivalent}</td>
                          </tr>
                        ))}
                        <tr className="insight-total-row">
                          <td>Total</td>
                          <td>{hourRows.reduce((sum, row) => sum + row.count, 0)}</td>
                          <td>{totalHours}</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={3} className="insight-empty text-center align-middle" style={{ height: '220px' }}>
                          <div className="flex flex-col items-center justify-center h-full gap-3">
                            <svg className="w-14 h-14 text-blue-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-500 font-medium">No hour deductions.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
