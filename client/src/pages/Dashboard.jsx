import React, { useState } from "react";
import { LayoutGrid, CalendarCheck, Users, Contact, CalendarOff, Scale, List, Settings, BarChart2, Shield, BarChart3 } from "lucide-react";
import AttendanceTable from "../components/AttendanceTable";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeInsight from "../components/EmployeeInsight";
import LeaveSummary from "../components/LeaveSummary";
import CompOffManager from "../components/CompOffManager";
import FullExport from "../components/FullExport";
import AdminManager from "../components/AdminManager";
import EmployeeChartsModal from "../components/EmployeeChartsModal";

// ✅ NEW
import ProcessManager from "../components/ProcessManager";
import FloatingChatButton from "../components/FloatingChatButton";
import ReportPage from "../pages/ReportPage"; // ✅ ensure path correct: client/src/pages/ReportPage.jsx
import HomeDashboard from "../components/HomeDashboard";

export default function Dashboard() {
  const [tab, setTab] = useState("home");
  const [showCharts, setShowCharts] = useState(false);
  const role = localStorage.getItem("role") || "";

  const tabs = [
    { id: "home", label: "Dashboard", icon: LayoutGrid },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "team", label: "Team", icon: Users },
    { id: "employee", label: "Employee Details", icon: Contact },
    { id: "leave", label: "Leave Report", icon: CalendarOff },
    { id: "compoff", label: "Comp-Off", icon: Scale },
    { id: "alldetails", label: "All Details", icon: List },
    { id: "process", label: "Process", icon: Settings },
    { id: "report", label: "Report", icon: BarChart2 },
  ];
  if (role === "super") {
    tabs.push({ id: "admins", label: "Admins", icon: Shield });
  }

  const TabBtn = ({ id, icon: Icon, children }) => {
    const active = tab === id;
    return (
      <button
        className={`flex items-center gap-2 px-3 lg:px-4 py-2.5 text-[13px] lg:text-[14px] font-bold rounded-xl transition-all ${
          active
            ? "bg-[#1d4ed8] text-white shadow-md shadow-blue-200/50"
            : "text-[#536889] hover:text-blue-600 hover:bg-slate-50/80"
        }`}
        onClick={() => setTab(id)}
        type="button"
      >
        <Icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? "text-white" : "text-blue-600"} />
        {children}
      </button>
    );
  };

  return (
    <div className="w-full px-3 sm:px-6 py-5 space-y-6">
      <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1">
          {tabs.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <div className="hidden sm:block w-[1px] h-4 bg-slate-200 mx-0.5"></div>}
              <TabBtn id={t.id} icon={t.icon}>{t.label}</TabBtn>
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center gap-3 pr-1.5">
          <FloatingChatButton />
          <button
            className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
            onClick={() => setShowCharts(true)}
            title="View employee chart reports"
            type="button"
          >
            <BarChart3 size={16} className="text-blue-600" /> Charts
          </button>
        </div>
      </div>

      {tab === "home" && <HomeDashboard />}
      {tab === "attendance" && <AttendanceTable />}
      {tab === "team" && <EmployeeTable />}
      {tab === "employee" && <EmployeeInsight />}
      {tab === "leave" && <LeaveSummary />}
      {tab === "compoff" && <CompOffManager />}
      {tab === "alldetails" && <FullExport />}

      {/* ✅ NEW */}
      {tab === "process" && <ProcessManager />}

      {/* ✅ NEW */}
      {tab === "report" && <ReportPage />}

      {tab === "admins" && role === "super" && <AdminManager />}

      {showCharts && <EmployeeChartsModal onClose={() => setShowCharts(false)} />}
    </div>
  );
}
