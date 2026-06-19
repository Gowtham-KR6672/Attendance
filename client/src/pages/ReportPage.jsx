import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import * as XLSX from "xlsx";
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
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-5 space-y-4">
      {!!banner.text && (
        <div
          className={`card border ${
            banner.type === "error"
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
                className={`mt-3 border rounded-md px-3 py-2 text-sm ${
                  manageMsg.type === "error"
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
                              className={`btn btn-sm ${
                                updateAllowed ? "btn-primary" : "btn-outline opacity-50 pointer-events-none"
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
      <div className="card">
        <div className="font-semibold mb-3">Manual Add</div>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-2">
            <div className="label mb-1">Date (DD-MM-YYYY)</div>
            <input className="input w-full" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="col-span-12 md:col-span-4">
            <div className="label mb-1">Process Name</div>
            <input
              className="input w-full"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              placeholder="e.g. 1785189 - PDF to Excel Data Entry - Banks"
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <div className="label mb-1">Process Type</div>
            <select className="select w-full" value={processType} onChange={(e) => setProcessType(e.target.value)}>
              <option value="">Select...</option>
              {PROCESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-2">
            <div className="label mb-1">UOM</div>
            <input className="input w-full" value={uom} onChange={(e) => setUom(e.target.value)} />
          </div>

          <div className="col-span-12 md:col-span-1">
            <div className="label mb-1">TAT</div>
            <input className="input w-full" value={tat} onChange={(e) => setTat(e.target.value)} />
            <div className="text-[11px] text-slate-500 mt-1">TAT must be ≥ 0</div>
          </div>

          <div className="col-span-12 md:col-span-2">
            <div className="label mb-1">Team Hours</div>
            <input className="input w-full" value={teamHours} onChange={(e) => setTeamHours(e.target.value)} />
          </div>

          <div className="col-span-12 md:col-span-1">
            <div className="label mb-1">Team Count</div>
            <input className="input w-full" value={teamCount} onChange={(e) => setTeamCount(e.target.value)} />
          </div>

          <div className="col-span-12 md:col-span-6">
            <div className="label mb-1">Actual Count (Team Hours * TAT)</div>
            <input className="input w-full" value={actualCount || 0} readOnly />
          </div>

          <div className="col-span-12 md:col-span-6">
            <div className="label mb-1">Actual Hours (Team Count / TAT)</div>
            <input className="input w-full" value={actualHours || 0} readOnly />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button className="btn btn-primary" onClick={onSave}>
            Save
          </button>

          <div className="flex items-center gap-2">
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
              className={`btn btn-outline cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}
              title="Upload CSV/XLSX with required headers"
            >
              {uploading ? "Uploading..." : "Upload CSV/XLSX"}
            </label>

            <div className="text-xs text-slate-500">
              Headers: Date (DD/MM/YYYY), Process Name, <b>Process Type</b>, UOM, TAT, Team Hours, Team Count
            </div>
          </div>
        </div>
      </div>

      {/* Graph/Table Section */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: TABLE */}
        <div className="card col-span-12 lg:col-span-8" style={{ maxHeight: 760, overflowY: "auto" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <div className="font-semibold">All Process Monthly Statistics (Totals in Range)</div>
              <div className="text-xs text-slate-500">
                Orange: Actual Count + Actual Hours | Blue: Team Count + Team Hours
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-1">
                Total Processes: {totalProcesses} {typeFilter !== "All" ? `(Filtered: ${typeFilter})` : ""}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <div className="label mb-1">Process Type</div>
                <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="All">All</option>
                  {PROCESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="label mb-1">From (DD-MM-YYYY)</div>
                <input className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <div className="label mb-1">To (DD-MM-YYYY)</div>
                <input className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>

              <button className="btn btn-outline" onClick={onApplyRange}>
                Apply
              </button>

              <button className="btn btn-outline" onClick={downloadTableCSV}>
                Download CSV
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 mb-2">
            <Ring value={overall.lagAvg} label="Overall Lag" color="#dc2626" />
            <Ring value={overall.achievedAvg} label="Overall Achieved" color="#16a34a" />
          </div>

          <div className="mt-2 overflow-auto border rounded-md" style={{ maxHeight: 520 }}>
            {tableRows.length ? (
              <table className="table w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr>
                    <th className="text-left">Process</th>
                    <th className="text-left">Type</th>
                    <th className="text-right">Actual Count</th>
                    <th className="text-right">Actual Hours</th>
                    <th className="text-right">Team Count</th>
                    <th className="text-right">Team Hours</th>
                    <th className="text-right">Lag %</th>
                    <th className="text-right">Achieved %</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {tableRows.map((r) => {
                    const lagOk = Number(r.lag || 0) === 0;
                    const ach = Number(r.achieved || 0);
                    const rowKey = `${r.processName}|||${r.processType}`;

                    return (
                      <tr key={`${r.processName}-${r.processType}`}>
                        <td className="min-w-[260px]">{r.processName}</td>
                        <td className="min-w-[110px]">{r.processType}</td>

                        <td className="text-right">{Number(r.actualCount || 0).toFixed(2)}</td>
                        <td className="text-right">{Number(r.actualHours || 0).toFixed(2)}</td>
                        <td className="text-right">{Number(r.teamCount || 0).toFixed(2)}</td>
                        <td className="text-right">{Number(r.teamHours || 0).toFixed(2)}</td>

                        <td className={`text-right font-semibold ${lagOk ? "text-green-700" : "text-red-700"}`}>
                          {Number(r.lag || 0).toFixed(2)}%
                        </td>

                        <td className={`text-right font-semibold ${ach > 0 ? "text-green-700" : "text-slate-500"}`}>
                          {ach.toFixed(2)}%
                        </td>

                        <td className="text-right">
                          <button className="btn btn-outline btn-sm" onClick={() => openManage(rowKey)}>
                            Update / Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-[360px] grid place-items-center text-slate-500 text-sm">
                No data for selected range / filter.
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Process */}
        <div className="card col-span-12 lg:col-span-4">
          {/* Header + Filter */}
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Selected Process Graph</div>
              <div className="text-xs text-slate-500">{submittedKey ? "Submitted" : "Select & submit"}</div>
            </div>

            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12">
                <div className="label mb-1">Process Filter</div>
                <select className="select w-full" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
                  <option value="">Select...</option>
                  {processOptions.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-12 grid grid-cols-12 gap-2">
                <button
                  className="btn btn-primary w-full col-span-12"
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

                <button className="btn btn-outline w-full col-span-6" onClick={downloadSelectedProcessCSV}>
                  Download Totals
                </button>
                <button className="btn btn-outline w-full col-span-6" onClick={downloadComparisonCSV}>
                  Download Compare
                </button>
              </div>

              {/* ✅ quick Manage for selected */}
              {submittedKey ? (
                <button
                  className="btn btn-outline w-full col-span-12"
                  onClick={() => openManage(submittedKey)}
                  title="Open Update/Delete for selected process"
                >
                  Update / Delete (Selected)
                </button>
              ) : null}
            </div>
          </div>

          {/* Selected Process Chart */}
          <div className="border rounded-xl p-3">
            <div className="text-sm font-semibold mb-2">Current Totals (In Range)</div>

            <div style={{ width: "100%", height: 240 }}>
              {!submittedKey ? (
                <div className="h-full grid place-items-center text-slate-500 text-sm">
                  Select a process and click <b>Submit</b> to view graph.
                </div>
              ) : selectedSeries.length ? (
                <ResponsiveContainer>
                  <BarChart data={selectedSeries} margin={{ top: 15, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="processName" hide />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="actualCount" name="Actual Count" fill="#f97316" />
                    <Bar dataKey="actualHours" name="Actual Hours" fill="#fdba74" />
                    <Bar dataKey="teamCount" name="Team Count" fill="#2563eb" />
                    <Bar dataKey="teamHours" name="Team Hours" fill="#93c5fd" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full grid place-items-center text-slate-500 text-sm">No data for this process in range.</div>
              )}
            </div>
          </div>

          {/* Comparison Section */}
          <div className="mt-4 border rounded-xl p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="font-semibold text-sm">Last 3 Recent Date Comparison</div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1 rounded-md text-xs font-bold border border-red-400 bg-white text-slate-900">
                  Lag: {trendLagBox ? `${trendLagBox.lag.toFixed(2)}%` : "-"} | Achieved:{" "}
                  {trendLagBox ? `${trendLagBox.achieved.toFixed(2)}%` : "-"}
                </div>

                <div className="px-3 py-1 rounded-md text-xs font-semibold border border-red-400 bg-white text-slate-900">
                  Available entries: {availableTrendCount} {availableTrendCount === 1 ? "date" : "dates"}
                  {availableTrendCount > 3 ? " (showing last 3)" : ""}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 mb-3">
              Add the same process (same type) for at least <b>2 different dates</b> to see comparison.
            </div>

            {/* Comparison Chart */}
            <div style={{ width: "100%", height: 220 }}>
              {submittedKey && trendPoints.length ? (
                <ResponsiveContainer>
                  <BarChart data={trendPoints} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" interval={0} height={30} tick={{ fontSize: 13, fill: "#475569" }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="actualCount" name="Actual Count" fill="#f97316" />
                    <Bar dataKey="actualHours" name="Actual Hours" fill="#fdba74" />
                    <Bar dataKey="teamCount" name="Team Count" fill="#2563eb" />
                    <Bar dataKey="teamHours" name="Team Hours" fill="#93c5fd" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full grid place-items-center text-slate-500 text-sm">
                  {submittedKey ? "No comparison data in range." : "Select a process and submit first."}
                </div>
              )}
            </div>

            {/* Comparison data BELOW graph */}
            {submittedKey && trendPoints.length ? (
              <div className="mt-3 overflow-auto border rounded-lg">
                <table className="table w-full text-xs">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr>
                      <th className="text-left">Date</th>
                      <th className="text-right">Actual Count</th>
                      <th className="text-right">Actual Hours</th>
                      <th className="text-right">Team Count</th>
                      <th className="text-right">Team Hours</th>
                      <th className="text-right">Lag %</th>
                      <th className="text-right">Achieved %</th>
                    </tr>
                  </thead>

                  <tbody>
                    {trendPoints.map((p) => {
                      const lag = calcLagPercent(p.actualCount, p.teamCount);
                      const ach = calcAchievedPercent(p.actualCount, p.actualHours, p.teamCount, p.teamHours);

                      return (
                        <tr key={p.date}>
                          <td className="text-left font-medium">{p.date}</td>
                          <td className="text-right">{Number(p.actualCount || 0).toFixed(2)}</td>
                          <td className="text-right">{Number(p.actualHours || 0).toFixed(2)}</td>
                          <td className="text-right">{Number(p.teamCount || 0).toFixed(2)}</td>
                          <td className="text-right">{Number(p.teamHours || 0).toFixed(2)}</td>
                          <td className={`text-right font-semibold ${lag === 0 ? "text-green-700" : "text-red-700"}`}>
                            {lag.toFixed(2)}%
                          </td>
                          <td className={`text-right font-semibold ${ach > 0 ? "text-green-700" : "text-slate-500"}`}>
                            {ach.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
