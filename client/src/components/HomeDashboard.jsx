import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { 
  Users, CheckCircle, XCircle, Clock, HelpCircle, 
  Download, Calendar, ChevronDown, Search, Filter, 
  RefreshCw, RotateCcw, Edit2, MoreVertical, Info, ArrowUpDown, Check, Save, X
} from "lucide-react";

const STATUS_LIST = [
  "PRESENT", "WFH", "ABSENT", "CASUAL LEAVE", "SICK LEAVE", "SESSION_01 LEAVE", "SESSION_02 LEAVE", "COMP-OFF", "PHONE INTIMATION", "NO INTIMATION", "NCNS", "L.O.P.", "HOLIDAY", "RELIEVED", "1 Hr Per MORN", "2 Hr Per MORN", "1 Hr Per EVE", "2 Hr Per EVE", "SUNDAY", "3rd Saturday Week off",
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

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getInitials = (name) => {
  if (!name) return "UK";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarColor = (name) => {
  const colors = [
    "bg-blue-100 text-blue-700", 
    "bg-green-100 text-green-700", 
    "bg-purple-100 text-purple-700", 
    "bg-orange-100 text-orange-700", 
    "bg-pink-100 text-pink-700", 
    "bg-teal-100 text-teal-700"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const formatAdminName = (email) => {
  if (!email) return "Unknown";
  const namePart = email.split('@')[0];
  return namePart
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const Sparkline = ({ color }) => {
  const strokeColors = {
    green: "#22c55e",
    red: "#ef4444",
    orange: "#f97316",
    slate: "#64748b"
  };
  return (
    <svg width="48" height="16" viewBox="0 0 48 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 12C4.5 12 6.5 4 11 4C15.5 4 18.5 14 23 14C27.5 14 30.5 2 35 2C39.5 2 43.5 10 47 10" stroke={strokeColors[color] || strokeColors.slate} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

export default function HomeDashboard() {
  const role = localStorage.getItem("role") || "";
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [savingKey, setSavingKey] = useState("");
  const [bulkEdits, setBulkEdits] = useState({});
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAdminFilter, setSelectedAdminFilter] = useState("ALL");

  const [currentTime, setCurrentTime] = useState(new Date());

  const todayDate = new Date();
  const todayStr = toYMD(todayDate);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(todayDate.getDate() - 1);
  const yesterdayStr = toYMD(yesterdayDate);
  const formattedDate = todayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ", " + todayDate.toLocaleDateString('en-US', { weekday: 'long' });
  const timeStr = currentTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " IST";

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      const promises = [
        api.get("/employees"),
        api.get("/attendance", { params: { from: yesterdayStr, to: todayStr } })
      ];

      if (role === "super" || role === "admin_tl") {
        promises.push(api.get("/admins/transfer-targets"));
      }

      const results = await Promise.all(promises);
      const empData = results[0].data;
      const attData = results[1].data;
      
      setEmployees(Array.isArray(empData) ? empData : []);
      setRecords(Array.isArray(attData) ? attData : []);

      if (results[2]) {
        setAdmins(Array.isArray(results[2].data) ? results[2].data : []);
      }
    } catch (e) {
      console.error(e);
      setMsg("Failed to load dashboard data.");
    }
  };

  const saveStatus = async (empId, status) => {
    setSavingKey(empId);
    try {
      await api.post("/attendance/mark", {
        employeeId: empId,
        date: todayStr,
        status: status || "",
      });
      await fetchData();
    } catch (e) {
      console.error(e);
      setMsg("Failed to update status. Please try again.");
    } finally {
      setSavingKey("");
    }
  };

  const handleMarkAllPresent = () => {
    const newEdits = { ...bulkEdits };
    filteredEmployees.forEach(emp => {
      newEdits[emp._id] = "PRESENT";
    });
    setBulkEdits(newEdits);
  };

  const handleCancelBulk = () => {
    setBulkEdits({});
  };

  const handleBulkSave = async () => {
    const ids = Object.keys(bulkEdits);
    if (ids.length === 0) return;
    setIsBulkSaving(true);
    try {
      await Promise.all(ids.map(empId => api.post("/attendance/mark", {
        employeeId: empId,
        date: todayStr,
        status: bulkEdits[empId] || "",
      })));
      setBulkEdits({});
      await fetchData();
    } catch (e) {
      console.error(e);
      setMsg("Failed to save bulk changes.");
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleStatusChange = (empId, newStatus) => {
    if (Object.keys(bulkEdits).length > 0) {
      setBulkEdits(prev => ({ ...prev, [empId]: newStatus }));
    } else {
      saveStatus(empId, newStatus);
    }
  };

  const attendanceMapToday = useMemo(() => {
    const map = new Map();
    records.filter(r => r.date && r.date.startsWith(todayStr)).forEach(r => {
      const empId = r.employee?._id || r.employee;
      map.set(empId, r.status);
    });
    return map;
  }, [records, todayStr]);

  const attendanceMapYesterday = useMemo(() => {
    const map = new Map();
    records.filter(r => r.date && r.date.startsWith(yesterdayStr)).forEach(r => {
      const empId = r.employee?._id || r.employee;
      map.set(empId, r.status);
    });
    return map;
  }, [records, yesterdayStr]);

  const stats = useMemo(() => {
    const total = employees.length;
    let present = 0;
    let absent = 0;
    let wfh = 0;
    let leave = 0;
    let missing = 0;

    employees.forEach(emp => {
      const status = attendanceMapToday.get(emp._id);
      if (!status) {
        missing++;
      } else if (status === "PRESENT" || status.includes("1 Hr") || status.includes("2 Hr")) {
        present++;
      } else if (status === "ABSENT" || status === "NCNS" || status === "L.O.P." || status === "NO INTIMATION") {
        absent++;
      } else if (status === "WFH") {
        wfh++;
      } else if (status.includes("LEAVE") || status === "COMP-OFF") {
        leave++;
      }
    });

    const getPercent = (val) => total === 0 ? 0 : ((val / total) * 100).toFixed(2);

    return { 
      total, 
      present, presentPct: getPercent(present),
      absent, absentPct: getPercent(absent),
      wfh, wfhPct: getPercent(wfh + leave),
      leave, 
      missing, missingPct: getPercent(missing)
    };
  }, [employees, attendanceMapToday]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    
    if (selectedAdminFilter !== "ALL") {
      result = result.filter(e => e.createdBy === selectedAdminFilter);
    }
    
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(e => 
        e.name?.toLowerCase().includes(lower) || 
        e.code?.toLowerCase().includes(lower)
      );
    }
    
    return result;
  }, [employees, search, selectedAdminFilter]);

  const StatCard = ({ icon: Icon, label, value, subtext, colorClass, bgClass, sparklineColor }) => (
    <div className="p-4 rounded-[14px] border border-slate-100 bg-white flex items-center shadow-sm">
      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${colorClass} mr-4`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold text-slate-500 mb-0.5">{label}</div>
        <div className="text-2xl font-bold text-slate-800 leading-none mb-1">{value}</div>
        <div className="text-[11px] font-medium text-slate-400">{subtext}</div>
      </div>
      {sparklineColor && (
        <div className="ml-2 shrink-0 hidden xl:block">
          <Sparkline color={sparklineColor} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 w-full">
      {msg && (
        <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200">
          {msg} <button onClick={() => setMsg("")} className="float-right font-bold">×</button>
        </div>
      )}



      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-2">
        <StatCard icon={Users} label="Total Team" value={stats.total} subtext="Employees" colorClass="text-blue-500" bgClass="bg-blue-50" />
        <StatCard icon={CheckCircle} label="Present" value={stats.present} subtext={`${stats.presentPct}% of total`} colorClass="text-green-500" bgClass="bg-green-50" sparklineColor="green" />
        <StatCard icon={XCircle} label="Absent" value={stats.absent} subtext={`${stats.absentPct}% of total`} colorClass="text-red-500" bgClass="bg-red-50" sparklineColor="red" />
        <StatCard icon={Clock} label="WFH / Leave" value={stats.wfh + stats.leave} subtext={`${stats.wfhPct}% of total`} colorClass="text-orange-500" bgClass="bg-orange-50" sparklineColor="orange" />
        <StatCard icon={HelpCircle} label="Not Marked" value={stats.missing} subtext={`${stats.missingPct}% of total`} colorClass="text-slate-500" bgClass="bg-slate-100" sparklineColor="slate" />
      </div>

      {/* Filters and Date/Time Row */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Admin Filters (Super/TL only) */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {(role === "super" || role === "admin_tl") && admins.length > 0 && (
            <>
              <span className="text-sm font-semibold text-slate-500 mr-2">Filter by Team Head:</span>
              <button 
                onClick={() => setSelectedAdminFilter("ALL")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedAdminFilter === "ALL" ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                All Teams
              </button>
              {admins.map(adm => (
                <button 
                  key={adm._id}
                  onClick={() => setSelectedAdminFilter(adm._id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedAdminFilter === adm._id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  title={adm.email}
                >
                  {formatAdminName(adm.email)}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Date and Time (Moved from top) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm font-semibold shadow-sm">
            <Calendar size={14} className="text-green-600" />
            {formattedDate}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm font-semibold shadow-sm">
            <Clock size={14} className="text-green-600" />
            {timeStr}
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        
        {/* Table Top Bar */}
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-blue-600">Today's Attendance</h3>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search employee..." 
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400 font-medium text-slate-700"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {Object.keys(bulkEdits).length > 0 ? (
              <button 
                onClick={handleCancelBulk}
                className="flex items-center gap-2 px-3 py-2 border border-red-200 bg-red-50 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
              >
                <X size={14} className="text-red-600" />
                Cancel
              </button>
            ) : (
              <button 
                onClick={handleMarkAllPresent}
                className="flex items-center gap-2 px-3 py-2 border border-green-500 bg-green-50 rounded-lg text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
              >
                <Check size={14} className="text-green-600" />
                Mark all as Present
              </button>
            )}
            
            {Object.keys(bulkEdits).length > 0 ? (
              <button 
                className="p-2 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" 
                onClick={handleBulkSave} 
                title="Save Bulk Changes"
                disabled={isBulkSaving}
              >
                {isBulkSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              </button>
            ) : (
              <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors" onClick={fetchData} title="Refresh Data">
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs font-semibold bg-blue-50 text-blue-700 border-b border-blue-100">
              <tr>
                <th className="py-3.5 px-6">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-blue-900">
                    Employee <ArrowUpDown size={12} className="opacity-50" />
                  </div>
                </th>
                <th className="py-3.5 px-6">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-blue-900">
                    Emp ID <ArrowUpDown size={12} className="opacity-50" />
                  </div>
                </th>
                <th className="py-3.5 px-6 text-center">
                  <div className="flex items-center justify-center gap-1.5 cursor-pointer hover:text-blue-900">
                    Yesterday Status <ArrowUpDown size={12} className="opacity-50" />
                  </div>
                </th>
                <th className="py-3.5 px-6 text-center">
                  <div className="flex items-center justify-center gap-1.5 cursor-pointer hover:text-blue-900">
                    Today Status <ArrowUpDown size={12} className="opacity-50" />
                  </div>
                </th>
                <th className="py-3.5 px-6 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    Quick Mark <Info size={12} className="opacity-50 cursor-help" title="Select a status to save instantly" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map(emp => {
                const apiStatus = attendanceMapToday.get(emp._id) || "";
                const yesterdayStatus = attendanceMapYesterday.get(emp._id) || "";
                const currentStatus = bulkEdits[emp._id] !== undefined ? bulkEdits[emp._id] : apiStatus;
                const isSaving = savingKey === emp._id || (isBulkSaving && bulkEdits[emp._id] !== undefined);
                
                return (
                  <tr key={emp._id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${getAvatarColor(emp.name)}`}>
                          {getInitials(emp.name)}
                        </div>
                        <span className="font-semibold text-slate-800">{emp.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 font-medium text-slate-500">{emp.code}</td>

                    <td className="py-3 px-6 text-center">
                      <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded border uppercase tracking-wide ${yesterdayStatus ? statusClass(yesterdayStatus) : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {yesterdayStatus || "Not Marked"}
                      </span>
                    </td>
                    
                    <td className="py-3 px-6 text-center">
                      <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded border uppercase tracking-wide ${currentStatus ? statusClass(currentStatus) : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {currentStatus || "Not Marked"}
                      </span>
                    </td>
                    
                    <td className="py-3 px-6 text-center">
                      <div className="inline-block relative">
                        <select
                          className="w-40 pl-3 pr-8 py-1.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md text-xs font-semibold text-slate-600 outline-none transition-colors appearance-none cursor-pointer"
                          value={currentStatus}
                          onChange={(e) => handleStatusChange(emp._id, e.target.value)}
                          disabled={isSaving}
                        >
                          <option value="">Select status</option>
                          {STATUS_LIST.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        {isSaving && <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-bold text-blue-500 rounded-md">...</div>}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <div className="text-slate-400 mb-2"><Search size={32} className="mx-auto opacity-50" /></div>
                    <div className="text-slate-500 font-medium">No employees found matching "{search}"</div>
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
