import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import * as XLSX from "xlsx";
import {
  FileText,
  BarChart2,
  TrendingUp,
  Calendar,
  Download,
  Save,
  UploadCloud,
  Info,
  Briefcase,
  List,
  Layers,
  Clock,
  Users,
  Hash,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import LoadingScreen from "../components/LoadingScreen";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

/* ---------------- helpers ---------------- */
const isDDMMYYYY = (s) => /^\d{2}-\d{2}-\d{4}$/.test(String(s || "").trim());
const pad = (n) => String(n).padStart(2, "0");

const dateToDDMMYYYY = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
};

// input file date: DD/MM/YYYY -> DD-MM-YYYY
const ddSlashToDDDash = (s) => {
  const raw = String(s || "").trim();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
};

const parseDDMMYYYY = (s) => {
  if (!isDDMMYYYY(s)) return null;
  const [dd, mm, yyyy] = String(s).split("-").map(Number);
  const d = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const monthRangeForDDMMYYYY = (ddmmyyyy) => {
  const d = parseDDMMYYYY(ddmmyyyy);
  if (!d) return null;
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 0, 0, 0, 0);
  return { from: dateToDDMMYYYY(start), to: dateToDDMMYYYY(end) };
};

// lag% rule
const calcLagPercent = (actualCount, teamCount) => {
  const A = Number(actualCount || 0);
  const T = Number(teamCount || 0);
  if (A <= T) return 0;
  if (A === 0) return 0;
  return ((A - T) / A) * 100;
};

// ✅ Achieved % (3 scenarios exactly; allow >100 in scenario 3)
const calcAchievedPercent = (actualCount, actualHours, teamCount, teamHours) => {
  const AC = Number(actualCount || 0);
  const AH = Number(actualHours || 0);
  const TC = Number(teamCount || 0);
  const TH = Number(teamHours || 0);

  // Scenario 1 & 2
  if (AC === 0 && AH === 0) {
    if (TC > 0 || TH > 0) return 100; // Scenario 1
    return 0; // Scenario 2
  }

  // Scenario 3 (NO CLAMP)
  if (AC <= 0) return 0;
  return (TC / AC) * 100;
};

const wrapLabel = (text, maxLen = 18) => {
  const s = String(text || "");
  if (s.length <= maxLen) return s;
  const parts = [];
  let i = 0;
  while (i < s.length) {
    parts.push(s.slice(i, i + maxLen));
    i += maxLen;
  }
  return parts.join("\n");
};

const Ring = ({ value = 0, label = "", color = "#16a34a" }) => {
  const v = Number(value || 0);
  const pctText = `${v.toFixed(0)}%`;

  const r = 32;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(v, 100));
  const offset = c - (clamped / 100) * c;

  return (
    <div className="flex flex-row items-center gap-1">
      <svg width="92" height="82" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} stroke="#e5e7eb" strokeWidth="6" fill="none" />
        <circle
          cx="36"
          cy="36"
          r={r}
          stroke={color}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>
          {pctText}
        </text>
      </svg>
      <div className="text-xs font-semibold text-slate-700">{label}</div>
    </div>
  );
};

/* ---------------- CSV download helpers ---------------- */
const csvEscape = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const downloadCSV = (filename, rows) => {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
};

const safeName = (s) =>
  String(s || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 140);

/* ---------------- 24-hour helpers ---------------- */
const MS_24H = 24 * 60 * 60 * 1000;
const within24h = (createdAt) => {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= MS_24H;
};

const fmtDT = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

/* ---------------- page ---------------- */
export default function ReportPage() {
  const PROCESS_TYPES = ["On Going", "One-Time", "FTE", "Long Time"];

  // manual add form
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [date, setDate] = useState(() => dateToDDMMYYYY(new Date()));
  const [processName, setProcessName] = useState("");
  const [processType, setProcessType] = useState(""); // ✅ no forced default
  const [uom, setUom] = useState("");
  const [tat, setTat] = useState("");
  const [teamHours, setTeamHours] = useState("");
  const [teamCount, setTeamCount] = useState("");

  // upload
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDialog, setUploadDialog] = useState({ open: false, text: "" });

  // range filter
  const [from, setFrom] = useState(() => {
    const r = monthRangeForDDMMYYYY(dateToDDMMYYYY(new Date()));
    return r?.from || "01-01-2026";
  });
  const [to, setTo] = useState(() => {
    const r = monthRangeForDDMMYYYY(dateToDDMMYYYY(new Date()));
    return r?.to || "31-01-2026";
  });

  const [series, setSeries] = useState([]);

  // selected process (must store name + type)
  const [selectedKey, setSelectedKey] = useState(""); // value: "name|||type"
  const [submittedKey, setSubmittedKey] = useState("");

  // type filter for table
  const [typeFilter, setTypeFilter] = useState("All");

  // trend
  const [trendPoints, setTrendPoints] = useState([]);
  const [trendTotalCount, setTrendTotalCount] = useState(0);

  // messages
  const [banner, setBanner] = useState({ type: "", text: "" });

  // ✅ Manage (Update/Delete) modal state
  const [manageOpen, setManageOpen] = useState(false);
  const [manageKey, setManageKey] = useState(""); // "name|||type"
  const [manageRows, setManageRows] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageMsg, setManageMsg] = useState({ type: "", text: "" });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: "", label: "" });
  const [initialLoad, setInitialLoad] = useState(true);

  const TAT = Number(tat);
  const TH = Number(teamHours);
  const TC = Number(teamCount);

  const actualCount = Number.isFinite(TH) && Number.isFinite(TAT) ? TH * TAT : 0;
  const actualHours = Number.isFinite(TC) && Number.isFinite(TAT) && TAT > 0 ? TC / TAT : 0;

  const showMsg = (text, type = "info") => setBanner({ text, type });

  const splitKey = (key) => {
    const [name = "", type = ""] = String(key || "").split("|||");
    return { processName: name, processType: type };
  };

  const loadAggregate = async (f, t) => {
    const { data } = await api.get("/report/aggregate", { params: { from: f, to: t } });
    const s = Array.isArray(data?.series) ? data.series : [];
    setSeries(s);
  };

  const loadTrend = async (procName, procType, f, t) => {
    if (!procName || !procType) {
      setTrendPoints([]);
      setTrendTotalCount(0);
      return;
    }
    const { data } = await api.get("/report/trend", {
      params: { processName: procName, processType: procType, from: f, to: t, limit: 3 },
    });
    setTrendPoints(Array.isArray(data?.points) ? data.points : []);
    setTrendTotalCount(Number(data?.totalDates || 0));
  };

  const refreshAll = async () => {
    await loadAggregate(from, to);
    if (submittedKey) {
      const { processName: pn, processType: pt } = splitKey(submittedKey);
      await loadTrend(pn, pt, from, to);
    }
  };

  /* ---------------- Manage modal actions ---------------- */

  const openManage = async (key) => {
    if (!key) return;
    setManageMsg({ type: "", text: "" });
    setManageKey(key);
    setManageOpen(true);
    setManageLoading(true);
    setManageRows([]);

    try {
      const { processName: pn, processType: pt } = splitKey(key);
      const { data } = await api.get("/report/entries", {
        params: { from, to, processName: pn, processType: pt },
      });

      const rows = Array.isArray(data?.rows) ? data.rows : [];
      // add local edit fields
      const mapped = rows.map((r) => ({
        ...r,
        _edit: {
          uom: r.uom ?? "",
          tat: r.tat ?? "",
          teamHours: r.teamHours ?? "",
          teamCount: r.teamCount ?? "",
        },
      }));
      setManageRows(mapped);
    } catch (e) {
      console.error(e);
      setManageMsg({
        type: "error",
        text: e?.response?.data?.message || "Failed to load entries",
      });
    } finally {
      setManageLoading(false);
    }
  };

  const closeManage = () => {
    setManageOpen(false);
    setManageKey("");
    setManageRows([]);
    setManageMsg({ type: "", text: "" });
    setConfirmDelete({ open: false, id: "", label: "" });
  };

  const setEdit = (id, patch) => {
    setManageRows((prev) =>
      prev.map((r) => (String(r._id) === String(id) ? { ...r, _edit: { ...r._edit, ...patch } } : r))
    );
  };

  const saveRowUpdate = async (row) => {
    setManageMsg({ type: "", text: "" });
    const id = row?._id;
    if (!id) return;

    // UI disable, but keep safety:
    if (!within24h(row?.createdAt)) {
      return setManageMsg({ type: "error", text: "Update disabled after 24 hours for this entry." });
    }

    try {
      const payload = {
        uom: row?._edit?.uom ?? "",
        tat: Number(row?._edit?.tat),
        teamHours: Number(row?._edit?.teamHours),
        teamCount: Number(row?._edit?.teamCount),
      };

      await api.put(`/report/${id}`, payload);
      setManageMsg({ type: "success", text: "Updated ✅" });

      // reload manage list (fresh computed fields)
      await openManage(manageKey);
      await refreshAll();
    } catch (e) {
      console.error(e);
      setManageMsg({
        type: "error",
        text: e?.response?.data?.message || "Update failed",
      });
    }
  };

  const askDeleteRow = (row) => {
    const label = `${row?.processName || ""} (${row?.processType || ""}) - ${row?.date ? dateToDDMMYYYY(row.date) : ""}`;
    setConfirmDelete({ open: true, id: row?._id || "", label });
  };

  const doDeleteRow = async () => {
    const id = confirmDelete?.id;
    if (!id) return;

    setManageMsg({ type: "", text: "" });

    try {
      await api.delete(`/report/${id}`);
      setConfirmDelete({ open: false, id: "", label: "" });
      setManageMsg({ type: "success", text: "Deleted ✅" });

      await openManage(manageKey);
      await refreshAll();
    } catch (e) {
      console.error(e);
      setManageMsg({
        type: "error",
        text: e?.response?.data?.message || "Delete failed",
      });
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (isDDMMYYYY(from) && isDDMMYYYY(to)) {
          await loadAggregate(from, to);
        }
      } catch (e) {
        console.error(e);
        showMsg(e?.response?.data?.message || "Failed to load data", "error");
      } finally {
        setInitialLoad(false);
      }
    })();
  }, []);

  const onApplyRange = async () => {
    setBanner({ type: "", text: "" });
    if (!isDDMMYYYY(from) || !isDDMMYYYY(to)) return showMsg("From/To must be DD-MM-YYYY", "error");

    try {
      await loadAggregate(from, to);

      if (submittedKey) {
        const { processName: pn, processType: pt } = splitKey(submittedKey);
        await loadTrend(pn, pt, from, to);
      }

      // if manage modal open, refresh its list too
      if (manageOpen && manageKey) {
        await openManage(manageKey);
      }
    } catch (e) {
      console.error(e);
      showMsg(e?.response?.data?.message || "Failed to load data", "error");
    }
  };

  const onSave = async () => {
    setBanner({ type: "", text: "" });

    if (!isDDMMYYYY(date)) return showMsg("Date must be DD-MM-YYYY", "error");
    if (!processName.trim()) return showMsg("Process Name is required", "error");
    if (!processType) return showMsg("Process Type is required", "error");

    if (!Number.isFinite(TAT) || TAT < 0) return showMsg("TAT must be >= 0", "error");
    if (!Number.isFinite(TH) || TH < 0) return showMsg("Team Hours must be >= 0", "error");
    if (!Number.isFinite(TC) || TC < 0) return showMsg("Team Count must be >= 0", "error");

    try {
      const payload = {
        date,
        processName: processName.trim(),
        processType,
        uom: uom.trim(),
        tat: TAT,
        teamHours: TH,
        teamCount: TC,
      };

      await api.post("/report", payload);
      showMsg("Saved successfully ✅", "success");

      setProcessName("");
      setProcessType("");
      setUom("");
      setTat("");
      setTeamHours("");
      setTeamCount("");

      await refreshAll();
    } catch (e) {
      console.error(e);
      showMsg(e?.response?.data?.message || "Save failed", "error");
    }
  };

  /* ---------------- Upload logic ---------------- */
  const onUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBanner({ type: "", text: "" });
    setUploading(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!json.length) throw new Error("File has no rows");

      const rows = json.map((r, idx) => {
        const dateRaw =
          r["Date (DD/MM/YYYY)"] ?? r["Date"] ?? r["date"] ?? r["DATE (DD/MM/YYYY)"] ?? "";

        const pName = r["Process Name"] ?? r["Process"] ?? r["process name"] ?? "";
        const pType = r["Process Type"] ?? r["process type"] ?? r["Type"] ?? r["type"] ?? "";
        const uomVal = r["UOM"] ?? r["uom"] ?? "";
        const tatVal = r["TAT"] ?? r["tat"] ?? "";
        const thVal = r["Team Hours"] ?? r["team hours"] ?? "";
        const tcVal = r["Team Count"] ?? r["team count"] ?? "";

        const dateDDMMYYYY = ddSlashToDDDash(String(dateRaw).trim());
        if (!dateDDMMYYYY) throw new Error(`Row ${idx + 1}: Date must be DD/MM/YYYY`);

        const T = Number(tatVal);
        if (!Number.isFinite(T) || T < 0) throw new Error(`Row ${idx + 1}: TAT must be >= 0`);

        const finalType = String(pType || "").trim();
        if (!finalType) throw new Error(`Row ${idx + 1}: Process Type is required`);
        if (!PROCESS_TYPES.includes(finalType)) {
          throw new Error(
            `Row ${idx + 1}: Invalid Process Type "${finalType}". Use: ${PROCESS_TYPES.join(", ")}`
          );
        }

        return {
          date: dateDDMMYYYY,
          processName: String(pName || "").trim(),
          processType: finalType,
          uom: String(uomVal || "").trim(),
          tat: T,
          teamHours: Number(thVal),
          teamCount: Number(tcVal),
        };
      });

      if (rows.some((x) => !x.processName)) throw new Error("Process Name is missing in one or more rows.");

      const resp = await api.post("/report/bulk", { rows });

      await refreshAll();

      setUploadDialog({
        open: true,
        text: `Uploaded ${resp?.data?.insertedCount || rows.length} rows successfully. Clear the selected file?`,
      });
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.errors?.join(" | ") ||
        err?.response?.data?.message ||
        err?.message ||
        "Upload failed";
      showMsg(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const clearSelectedFile = () => {
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ---------------- Derived UI data ---------------- */

  // Filter by type for table
  const filteredSeries = useMemo(() => {
    if (typeFilter === "All") return series || [];
    return (series || []).filter((x) => x.processType === typeFilter);
  }, [series, typeFilter]);

  const totalProcesses = useMemo(() => filteredSeries.length, [filteredSeries]);

  // Options for dropdown must include name + type
  const processOptions = useMemo(() => {
    return (series || [])
      .map((x) => ({
        key: `${x.processName}|||${x.processType}`,
        label: `${x.processName} — ${x.processType}`,
      }))
      .filter((x) => x.label && x.key);
  }, [series]);

  // Selected chart uses submittedKey (name + type)
  const selectedSeries = useMemo(() => {
    if (!submittedKey) return [];
    const { processName: pn, processType: pt } = splitKey(submittedKey);
    const row = (series || []).find((x) => x.processName === pn && x.processType === pt);
    if (!row) return [];
    return [
      {
        ...row,
        processName: wrapLabel(`${row.processName}\n(${row.processType})`),
      },
    ];
  }, [series, submittedKey]);

  const tableRows = useMemo(() => {
    return (filteredSeries || []).map((r) => {
      const lag = calcLagPercent(r.actualCount, r.teamCount);
      const achieved = calcAchievedPercent(r.actualCount, r.actualHours, r.teamCount, r.teamHours);
      return { ...r, lag, achieved };
    });
  }, [filteredSeries]);

  // Overall exclude scenario 2 only (AC=0 AH=0 TC=0 TH=0)
  const overall = useMemo(() => {
    const eligible = tableRows.filter((r) => {
      const AC = Number(r.actualCount || 0);
      const AH = Number(r.actualHours || 0);
      const TCx = Number(r.teamCount || 0);
      const THx = Number(r.teamHours || 0);
      return !(AC === 0 && AH === 0 && TCx === 0 && THx === 0);
    });

    const n = eligible.length;
    if (!n) return { lagAvg: 0, achievedAvg: 0 };

    const lagSum = eligible.reduce((a, r) => a + (Number(r.lag) || 0), 0);
    const achSum = eligible.reduce((a, r) => a + (Number(r.achieved) || 0), 0);

    return { lagAvg: lagSum / n, achievedAvg: achSum / n };
  }, [tableRows]);

  // ✅ Overall (all dates) lag/achieved for the selected process+type within last-3 trend points
  const trendLagBox = useMemo(() => {
    if (!trendPoints?.length) return null;

    const sum = trendPoints.reduce(
      (acc, p) => {
        acc.actualCount += Number(p.actualCount || 0);
        acc.actualHours += Number(p.actualHours || 0);
        acc.teamCount += Number(p.teamCount || 0);
        acc.teamHours += Number(p.teamHours || 0);
        return acc;
      },
      { actualCount: 0, actualHours: 0, teamCount: 0, teamHours: 0 }
    );

    const lag = calcLagPercent(sum.actualCount, sum.teamCount);
    const achieved = calcAchievedPercent(sum.actualCount, sum.actualHours, sum.teamCount, sum.teamHours);

    return { lag, achieved };
  }, [trendPoints]);

  const availableTrendCount = Number(trendTotalCount || 0);

  /* ---------------- CSV download actions ---------------- */

  // 1) Download the TABLE data (already filtered by typeFilter + range)
  const downloadTableCSV = () => {
    if (!isDDMMYYYY(from) || !isDDMMYYYY(to)) return showMsg("From/To must be DD-MM-YYYY", "error");
    if (!tableRows.length) return showMsg("No data to download.", "error");

    const headers = [
      "Process Name",
      "Process Type",
      "From",
      "To",
      "Actual Count",
      "Actual Hours",
      "Team Count",
      "Team Hours",
      "Lag %",
      "Achieved %",
    ];

    const body = tableRows.map((r) => [
      r.processName || "",
      r.processType || "",
      from,
      to,
      Number(r.actualCount || 0).toFixed(2),
      Number(r.actualHours || 0).toFixed(2),
      Number(r.teamCount || 0).toFixed(2),
      Number(r.teamHours || 0).toFixed(2),
      Number(r.lag || 0).toFixed(2),
      Number(r.achieved || 0).toFixed(2),
    ]);

    const namePart = typeFilter === "All" ? "AllTypes" : safeName(typeFilter);
    const filename = `Report_${from}_to_${to}_${namePart}`;

    downloadCSV(filename, [headers, ...body]);
  };

  // 2) Download ONLY selected process totals (in range) (process name wise)
  const downloadSelectedProcessCSV = () => {
    if (!submittedKey) return showMsg("Select a process and submit first.", "error");
    if (!isDDMMYYYY(from) || !isDDMMYYYY(to)) return showMsg("From/To must be DD-MM-YYYY", "error");
    if (!selectedSeries.length) return showMsg("No selected process data.", "error");

    const row = selectedSeries[0];

    const headers = [
      "Process Name",
      "Process Type",
      "From",
      "To",
      "Actual Count",
      "Actual Hours",
      "Team Count",
      "Team Hours",
      "Lag %",
      "Achieved %",
    ];

    const lag = calcLagPercent(row.actualCount, row.teamCount);
    const ach = calcAchievedPercent(row.actualCount, row.actualHours, row.teamCount, row.teamHours);

    const body = [
      [
        row.processName?.replace(/\n\(.+\)$/, "") || "",
        row.processType || "",
        from,
        to,
        Number(row.actualCount || 0).toFixed(2),
        Number(row.actualHours || 0).toFixed(2),
        Number(row.teamCount || 0).toFixed(2),
        Number(row.teamHours || 0).toFixed(2),
        lag.toFixed(2),
        ach.toFixed(2),
      ],
    ];

    const { processName: pn, processType: pt } = splitKey(submittedKey);
    const filename = `Report_Selected_${from}_to_${to}_${safeName(pn)}_${safeName(pt)}`;

    downloadCSV(filename, [headers, ...body]);
  };

  // 3) Download comparison CSV (date wise) for selected process (trendPoints table)
  const downloadComparisonCSV = () => {
    if (!submittedKey) return showMsg("Select a process and submit first.", "error");
    if (!trendPoints.length) return showMsg("No comparison data to download.", "error");

    const headers = ["Date", "Actual Count", "Actual Hours", "Team Count", "Team Hours", "Lag %", "Achieved %"];

    const body = trendPoints.map((p) => {
      const lag = calcLagPercent(p.actualCount, p.teamCount);
      const ach = calcAchievedPercent(p.actualCount, p.actualHours, p.teamCount, p.teamHours);
      return [
        p.date,
        Number(p.actualCount || 0).toFixed(2),
        Number(p.actualHours || 0).toFixed(2),
        Number(p.teamCount || 0).toFixed(2),
        Number(p.teamHours || 0).toFixed(2),
        lag.toFixed(2),
        ach.toFixed(2),
      ];
    });

    const { processName: pn, processType: pt } = splitKey(submittedKey);
    const filename = `Report_Comparison_${safeName(pn)}_${safeName(pt)}_${from}_to_${to}`;

    downloadCSV(filename, [headers, ...body]);
  };

  if (initialLoad) {
    return <LoadingScreen text="Loading Reports" subtext="Gathering productivity details..." />;
  }

  return (
    <div className="w-full space-y-4">
      {!!banner.text && (
        <div
          className={`card border ${banner.type === "error"
            ? "border-red-300 text-red-700"
            : banner.type === "success"
              ? "border-green-300 text-green-700"
              : "border-slate-200 text-slate-700"
            }`}
        >
          <div className="px-3 py-2 text-sm font-medium">{banner.text}</div>
        </div>
      )}

      {/* ✅ Manage Modal (Update/Delete entries) */}
      {manageOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/40 grid place-items-center px-4">
          <div className="bg-white rounded-xl w-full max-w-5xl border shadow-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-lg">Manage Entries (Update / Delete)</div>
                <div className="text-xs text-slate-500 mt-1">
                  Range: <b>{from}</b> to <b>{to}</b>
                  {manageKey ? (
                    <>
                      {" "}
                      | <b>{splitKey(manageKey).processName}</b> — <b>{splitKey(manageKey).processType}</b>
                    </>
                  ) : null}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  ✅ Update button works only within <b>24 hours</b> from created time (backend enforced).
                </div>
              </div>

              <button className="btn btn-outline" onClick={closeManage}>
                Close
              </button>
            </div>

            {!!manageMsg.text && (
              <div
                className={`mt-3 border rounded-md px-3 py-2 text-sm ${manageMsg.type === "error"
                  ? "border-red-300 text-red-700"
                  : manageMsg.type === "success"
                    ? "border-green-300 text-green-700"
                    : "border-slate-200 text-slate-700"
                  }`}
              >
                {manageMsg.text}
              </div>
            )}

            <div className="mt-3 border rounded-lg overflow-auto" style={{ maxHeight: 520 }}>
              {manageLoading ? (
                <div className="h-[220px] grid place-items-center text-slate-500 text-sm">Loading entries...</div>
              ) : manageRows.length ? (
                <table className="table w-full text-xs">
                  <thead className="sticky top-0 bg-white z-10 shadow-sm">
                    <tr>
                      <th className="text-left">Date</th>
                      <th className="text-left">Created</th>
                      <th className="text-left">UOM</th>
                      <th className="text-right">TAT</th>
                      <th className="text-right">Team Hours</th>
                      <th className="text-right">Team Count</th>
                      <th className="text-right">Actual Count</th>
                      <th className="text-right">Actual Hours</th>
                      <th className="text-right">Update</th>
                      <th className="text-right">Delete</th>
                    </tr>
                  </thead>

                  <tbody>
                    {manageRows.map((r) => {
                      const updateAllowed = within24h(r.createdAt);

                      // show calculated values (from db)
                      const ac = Number(r.actualCount || 0);
                      const ah = Number(r.actualHours || 0);

                      return (
                        <tr key={r._id}>
                          <td className="text-left font-medium">
                            {r.date ? dateToDDMMYYYY(r.date) : "-"}
                          </td>

                          <td className="text-left">{fmtDT(r.createdAt)}</td>

                          <td className="text-left min-w-[160px]">
                            <input
                              className="input input-sm w-full"
                              value={r._edit?.uom ?? ""}
                              onChange={(e) => setEdit(r._id, { uom: e.target.value })}
                              placeholder="UOM"
                              disabled={!updateAllowed}
                              title={!updateAllowed ? "Update disabled after 24 hours" : ""}
                            />
                          </td>

                          <td className="text-right min-w-[90px]">
                            <input
                              className="input input-sm w-full text-right"
                              value={r._edit?.tat ?? ""}
                              onChange={(e) => setEdit(r._id, { tat: e.target.value })}
                              disabled={!updateAllowed}
                              title={!updateAllowed ? "Update disabled after 24 hours" : ""}
                            />
                          </td>

                          <td className="text-right min-w-[110px]">
                            <input
                              className="input input-sm w-full text-right"
                              value={r._edit?.teamHours ?? ""}
                              onChange={(e) => setEdit(r._id, { teamHours: e.target.value })}
                              disabled={!updateAllowed}
                              title={!updateAllowed ? "Update disabled after 24 hours" : ""}
                            />
                          </td>

                          <td className="text-right min-w-[110px]">
                            <input
                              className="input input-sm w-full text-right"
                              value={r._edit?.teamCount ?? ""}
                              onChange={(e) => setEdit(r._id, { teamCount: e.target.value })}
                              disabled={!updateAllowed}
                              title={!updateAllowed ? "Update disabled after 24 hours" : ""}
                            />
                          </td>

                          <td className="text-right">{ac.toFixed(2)}</td>
                          <td className="text-right">{ah.toFixed(2)}</td>

                          <td className="text-right">
                            <button
                              className={`btn btn-sm ${updateAllowed ? "btn-primary" : "btn-outline opacity-50 pointer-events-none"
                                }`}
                              onClick={() => saveRowUpdate(r)}
                              disabled={!updateAllowed}
                              title={!updateAllowed ? "Update disabled after 24 hours" : "Update this entry"}
                            >
                              Update
                            </button>
                          </td>

                          <td className="text-right">
                            <button
                              className="btn btn-sm btn-outline bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
                              onClick={() => askDeleteRow(r)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="h-[220px] grid place-items-center text-slate-500 text-sm">
                  No entries found for this process in selected range.
                </div>
              )}
            </div>

            {/* Confirm delete dialog */}
            {confirmDelete.open && (
              <div className="fixed inset-0 z-[1100] bg-black/40 grid place-items-center px-4">
                <div className="bg-white rounded-xl w-full max-w-md border shadow-lg p-4">
                  <div className="font-semibold mb-2 text-red-700">Confirm Delete</div>
                  <div className="text-sm text-slate-700">
                    Are you sure you want to delete this entry?
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{confirmDelete.label}</div>

                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      className="btn btn-outline"
                      onClick={() => setConfirmDelete({ open: false, id: "", label: "" })}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-outline bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700"
                      onClick={doDeleteRow}
                    >
                      Yes, Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload success dialog */}
      {uploadDialog.open && (
        <div className="fixed inset-0 z-[999] bg-black/40 grid place-items-center px-4">
          <div className="bg-white rounded-xl w-full max-w-md border shadow-lg p-4">
            <div className="font-semibold mb-2">Upload Completed</div>
            <div className="text-sm text-slate-600">{uploadDialog.text}</div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-outline" onClick={() => setUploadDialog({ open: false, text: "" })}>
                No
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  clearSelectedFile();
                  setUploadDialog({ open: false, text: "" });
                }}
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add */}
      <div className="card border border-slate-200 rounded-xl shadow-sm bg-white p-6 mb-6 transition-all duration-300">
        <div 
          className={`flex items-center justify-between cursor-pointer select-none transition-colors ${isManualAddOpen ? 'mb-6' : 'mb-0'}`}
          onClick={() => setIsManualAddOpen(!isManualAddOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <h2 className="text-xl font-bold text-blue-600">Manual Add</h2>
          </div>
          <div className="text-slate-400 hover:text-slate-600 transition-colors">
            {isManualAddOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {isManualAddOpen && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Date (DD-MM-YYYY)</label>
            <div className="relative">
              <input
                className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium pl-10"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Calendar size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Process Name</label>
            <div className="relative">
              <input
                className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium pl-10"
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
                placeholder="e.g. 1785189 - PDF to Excel Data Entry - Banks"
              />
              <Briefcase size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Process Type</label>
            <div className="relative">
              <select
                className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium pl-10"
                value={processType}
                onChange={(e) => setProcessType(e.target.value)}
              >
                <option value="">Select...</option>
                {PROCESS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <List size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">UOM</label>
            <div className="relative">
              <input className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium pl-10" value={uom} onChange={(e) => setUom(e.target.value)} />
              <Layers size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">TAT</label>
            <div className="relative">
              <input className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium pl-10" value={tat} onChange={(e) => setTat(e.target.value)} />
              <Clock size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
            <div className="text-[11px] text-slate-400 mt-1">TAT must be ≥ 0</div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Team Hours</label>
            <div className="relative">
              <input className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium pl-10" value={teamHours} onChange={(e) => setTeamHours(e.target.value)} />
              <Clock size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Team Count</label>
            <div className="relative">
              <input className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium pl-10" value={teamCount} onChange={(e) => setTeamCount(e.target.value)} />
              <Users size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Actual Count <span className="text-slate-400 font-normal">(Team Hours * TAT)</span></label>
            <div className="relative">
              <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm rounded-lg text-slate-700 font-semibold cursor-not-allowed pl-10" value={actualCount || 0} readOnly />
              <Hash size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Actual Hours <span className="text-slate-400 font-normal">(Team Count / TAT)</span></label>
            <div className="relative">
              <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm rounded-lg text-slate-700 font-semibold cursor-not-allowed pl-10" value={actualHours || 0} readOnly />
              <Clock size={16} className="absolute left-3 top-3 text-[#256eed]" />
            </div>
          </div>
        </div>

        <hr className="border-slate-100 my-4" />

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button className="inline-flex items-center justify-center gap-2 bg-[#256eed] hover:brightness-110 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors text-sm shrink-0 w-full sm:w-auto" onClick={onSave}>
            <Save size={16} /> Save
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onUploadFile}
              className="hidden"
              id="bulkUploadInput"
            />
            <label
              htmlFor="bulkUploadInput"
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#16a34a] hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer shrink-0 w-full sm:w-auto ${uploading ? "opacity-60 pointer-events-none" : ""}`}
            >
              <UploadCloud size={16} />
              {uploading ? "Uploading..." : "Upload CSV/XLSX"}
            </label>

            <div className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-2 sm:mt-0">
              <Info size={14} className="text-slate-400 shrink-0" />
              <span>Headers: Date (DD/MM/YYYY), Process Name, <b>Process Type</b>, UOM, TAT, Team Hours, Team Count</span>
            </div>
          </div>
        </div>
        </div>
        )}
      </div>

      {/* Graph/Table Section */}
      <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">

        {/* Top: TABLE */}
        <div className="w-full">
          <div className="card border border-slate-200 rounded-xl shadow-sm bg-white p-6 flex flex-col h-fit max-h-[800px]">

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <BarChart2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-600">All Process Monthly Statistics <span className="text-slate-500 font-normal text-base">(Totals in Range)</span></h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1"></span>Orange: Actual Count + Actual Hours | <span className="inline-block w-2 h-2 rounded-full bg-blue-500 ml-1 mr-1"></span>Blue: Team Count + Team Hours
                  </p>
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    Total Processes: {totalProcesses} {typeFilter !== "All" ? `(Filtered: ${typeFilter})` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 items-end">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Process Type</label>
                <select className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="All">All</option>
                  {PROCESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">From (DD-MM-YYYY)</label>
                <div className="relative">
                  <input className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium pl-8" value={from} onChange={(e) => setFrom(e.target.value)} />
                  <Calendar size={14} className="absolute left-2.5 top-2.5 text-[#256eed]" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">To (DD-MM-YYYY)</label>
                <div className="relative">
                  <input className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium pl-8" value={to} onChange={(e) => setTo(e.target.value)} />
                  <Calendar size={14} className="absolute left-2.5 top-2.5 text-[#256eed]" />
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 inline-flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors text-sm" onClick={onApplyRange}>
                  Apply
                </button>
                <button className="flex-1 inline-flex items-center justify-center gap-1.5 bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition-colors text-sm whitespace-nowrap" onClick={downloadTableCSV}>
                  <Download size={14} /> Download CSV
                </button>
              </div>
            </div>

            <div className="flex items-center gap-8 mb-6">
              <Ring value={overall.lagAvg} label="Overall Lag" color="#dc2626" />
              <Ring value={overall.achievedAvg} label="Overall Achieved" color="#16a34a" />
            </div>

            <div className="mt-2 overflow-auto border border-slate-200 rounded-lg bg-white min-h-[300px]">
              {tableRows.length ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Process</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Actual Count</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Actual Hours</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Team Count</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Team Hours</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Lag %</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Achieved %</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {tableRows.map((r) => {
                      const lagOk = Number(r.lag || 0) === 0;
                      const ach = Number(r.achieved || 0);
                      const rowKey = `${r.processName}|||${r.processType}`;

                      return (
                        <tr key={`${r.processName}-${r.processType}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-600 font-medium min-w-[260px]">{r.processName}</td>
                          <td className="px-4 py-3 text-slate-600 min-w-[110px]">{r.processType}</td>

                          <td className="px-4 py-3 text-slate-600 text-right">{Number(r.actualCount || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-600 text-right">{Number(r.actualHours || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-600 text-right">{Number(r.teamCount || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-600 text-right">{Number(r.teamHours || 0).toFixed(2)}</td>

                          <td className={`px-4 py-3 text-right font-bold ${lagOk ? "text-emerald-600" : "text-red-600"}`}>
                            {Number(r.lag || 0).toFixed(2)}%
                          </td>

                          <td className={`px-4 py-3 text-right font-bold ${ach > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            {ach.toFixed(2)}%
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-md text-xs font-semibold transition-colors" onClick={() => openManage(rowKey)}>
                              Update / Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="relative w-full h-full min-h-[300px] flex flex-col items-center justify-center text-blue-500 font-medium text-sm bg-slate-50/50 border-0 rounded-lg overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
                  <div className="absolute -top-10 -right-10 w-96 h-96 bg-blue-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

                  <div className="relative z-10 flex flex-col items-center">
                    <svg className="w-12 h-12 text-blue-400 animate-pulse mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>No data for selected range / filter.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Selected Process */}
        <div className="w-full">
          <div className="card border border-slate-200 rounded-xl shadow-sm bg-white p-6 flex flex-col h-fit">

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <TrendingUp size={16} />
                </div>
                <h3 className="text-lg font-bold text-blue-600">Selected Process Graph</h3>
              </div>
              <div className="text-xs text-slate-500">{submittedKey ? "Submitted" : "Select & submit"}</div>
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-6">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Process Filter</label>
                <select className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium h-[38px]" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
                  <option value="">Select...</option>
                  {processOptions.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>

              <button
                className="bg-[#256eed] hover:brightness-110 text-white px-5 py-2 rounded-lg font-semibold transition-colors text-sm whitespace-nowrap h-[38px]"
                onClick={async () => {
                  setBanner({ type: "", text: "" });
                  if (!selectedKey) return showMsg("Please select a process first.", "error");

                  setSubmittedKey(selectedKey);

                  const { processName: pn, processType: pt } = splitKey(selectedKey);
                  try {
                    await loadTrend(pn, pt, from, to);
                  } catch (e) {
                    console.error(e);
                    showMsg(e?.response?.data?.message || "Failed to load comparison data", "error");
                  }
                }}
              >
                Submit
              </button>

              <button className="inline-flex items-center justify-center gap-1.5 bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors text-xs whitespace-nowrap h-[38px]" onClick={downloadSelectedProcessCSV}>
                <Download size={14} /> Download Totals
              </button>
              <button className="inline-flex items-center justify-center gap-1.5 bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors text-xs whitespace-nowrap h-[38px]" onClick={downloadComparisonCSV}>
                <Download size={14} /> Download Compare
              </button>

              {/* ✅ quick Manage for selected */}
              {submittedKey ? (
                <button
                  className="inline-flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors text-xs whitespace-nowrap h-[38px]"
                  onClick={() => openManage(submittedKey)}
                  title="Open Update/Delete for selected process"
                >
                  Update / Delete
                </button>
              ) : null}
            </div>

            {/* Selected Process Chart */}
            <div className="border border-slate-100 rounded-xl bg-white shadow-sm p-4 mb-4">
              <div className="text-sm font-bold text-slate-800 mb-3">Current Totals (In Range)</div>

              <div style={{ width: "100%", height: 180 }}>
                {!submittedKey ? (
                  <div className="relative h-full flex flex-col items-center justify-center text-blue-500 font-medium text-xs text-center px-4 py-6 bg-slate-50/50 border border-blue-100 rounded-lg overflow-hidden">
                    <div className="absolute -top-10 -left-10 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
                    <div className="absolute -top-10 -right-10 w-96 h-96 bg-blue-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

                    <div className="relative z-10 flex flex-col items-center">
                      <svg className="w-10 h-10 text-blue-400 animate-bounce mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                      <span>Select a process and click <br /><b className="text-blue-600">Submit</b><br /> to view graph.</span>
                    </div>
                  </div>
                ) : selectedSeries.length ? (
                  <ResponsiveContainer>
                    <BarChart data={selectedSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="processName" hide />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="actualCount" name="Actual Count" fill="#f97316" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="actualHours" name="Actual Hours" fill="#fdba74" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="teamCount" name="Team Count" fill="#2563eb" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="teamHours" name="Team Hours" fill="#93c5fd" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full grid place-items-center text-slate-400 text-xs">No data for this process in range.</div>
                )}
              </div>
            </div>

            {/* Comparison Section */}
            <div className="border border-slate-100 rounded-xl bg-white shadow-sm p-4 flex-1 flex flex-col">
              <div className="flex flex-col gap-2 mb-4">
                <div className="font-bold text-slate-800 text-sm">Last 3 Recent Date Comparison</div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-2 py-0.5 rounded text-[11px] font-semibold border border-orange-200 bg-orange-50 text-orange-700">
                    Lag: {trendLagBox ? `${trendLagBox.lag.toFixed(2)}%` : "-"} | Achieved:{" "}
                    {trendLagBox ? `${trendLagBox.achieved.toFixed(2)}%` : "-"}
                  </div>

                  <div className="px-2 py-0.5 rounded text-[11px] font-semibold border border-blue-200 bg-blue-50 text-blue-700">
                    Available entries: {availableTrendCount} {availableTrendCount === 1 ? "date" : "dates"}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  Add the same process (same type) for at least <b>2 different dates</b> to see comparison.
                </div>
              </div>

              {/* Comparison Chart */}
              <div className="flex-1 min-h-[180px]" style={{ width: "100%" }}>
                {submittedKey && trendPoints.length ? (
                  <ResponsiveContainer>
                    <BarChart data={trendPoints} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" interval={0} height={20} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="actualCount" name="Actual Count" fill="#f97316" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="actualHours" name="Actual Hours" fill="#fdba74" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="teamCount" name="Team Count" fill="#2563eb" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="teamHours" name="Team Hours" fill="#93c5fd" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="relative w-full h-full min-h-[180px] flex flex-col items-center justify-center text-blue-500 font-medium text-xs text-center bg-slate-50/50 border border-blue-100 rounded-lg overflow-hidden">
                    <div className="absolute -top-10 -left-10 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
                    <div className="absolute -top-10 -right-10 w-96 h-96 bg-blue-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

                    <div className="relative z-10 flex flex-col items-center">
                      <svg className="w-10 h-10 text-blue-400 animate-pulse mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span>{submittedKey ? "No comparison data in range." : "Select a process and submit first."}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
