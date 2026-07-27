import React, { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { UploadCloud, Download, List, BarChart2, AlertCircle, FileSpreadsheet } from "lucide-react";

// --- Helpers ---
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const pNum = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (d) => {
  if (!d) return "";
  const day = d.getDate();
  const mon = monthShort[d.getMonth()];
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
};

const isoDate = (d) => (d ? d.toISOString().split("T")[0] : "");
const f1 = (v) => (v === null || v === undefined || isNaN(Number(v)) ? "--" : (Math.round(Number(v) * 10) / 10).toFixed(1));
const f0 = (v) => {
  const n = Number(v);
  if (v === null || v === undefined || isNaN(n)) return "--";
  return String(Math.floor(n + 0.5));
};

function parseDate(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (!v) return null;
  const s = String(v).trim();
  let d = new Date(s);
  if (!isNaN(d.getTime()) && s.length > 5) return d;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    d = new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function matchCol(headers, aliases) {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h === alias || h.replace(/\s+/g, "") === alias.replace(/\s+/g, ""));
    if (idx >= 0) return idx;
  }
  return -1;
}

function uniqJoin(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const v = String(x || "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.join(", ");
}

function getProductivityDivisor(remarksJoined, leaveJoined) {
  const txt = `${String(remarksJoined || "")} ${String(leaveJoined || "")}`.toLowerCase();
  if (txt.includes("half day leave") || txt.includes("session_01 leave") || txt.includes("session_02 leave")) return 4;
  if (txt.includes("2 hr per morn") || txt.includes("2 hr per eve")) return 6;
  if (txt.includes("1 hr per morn") || txt.includes("1 hr per eve")) return 7;
  return 8;
}

const requiredHeaders = ["Date", "Name", "Process", "UOM", "TAT / Hour", "Target", "Count", "Working Hours", "Notes", "Leave Report"];
const D_IDX = 0, N_IDX = 1, P_IDX = 2, TAT_IDX = 4, CNT_IDX = 6, WH_IDX = 7;
const summaryHeaders = ["Name", "Date", "Working Hours", "Hours", "Productivity %", "Remarks", "Leave", "Traget Status", "Concatenate"];
const finalHeaders = [
  "Date", "Name", "Working Hours", "Productivity %", "Average of Productivity",
  "Remarks", "Quality(100%)", "Working days", "Late Login", "Leave", "Permission",
  "No. of Process Worked", "Name of process worked", "Notes", "Errors %", "Floor Ethics %",
  "Login", "Leave"
];

function cleanFinalRemarks(text) {
  return String(text || "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v && v.toLowerCase() !== "present")
    .join(", ");
}

export default function ClientReportPage() {
  const [allData, setAllData] = useState([]);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState("detail"); // "detail" | "summary"

  // Filters
  const [fName, setFName] = useState("");
  const [fProcess, setFProcess] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const fileInputRef = useRef(null);

  const showError = (msg) => setErrorMsg(msg);
  const hideError = () => setErrorMsg("");

  // Process selected file
  const handleSelectedFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    hideError();

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
        const sheets = wb.SheetNames;
        if (!sheets.length) throw new Error("No sheets found.");
        
        setWorkbook(wb);
        setSheetNames(sheets);

        let best = 0;
        sheets.forEach((s, i) => {
          if (/report|daily|data|march|employee/i.test(s)) best = i;
        });
        setSelectedSheetIndex(best);
        loadSheetData(wb, best);
      } catch (err) {
        showError(err.message || "Failed to process file.");
      }
    };
    reader.onerror = () => showError("Failed to read file.");
    reader.readAsArrayBuffer(file);
  };

  const loadSheetData = (wb, idx) => {
    if (!wb) return;
    const ws = wb.Sheets[wb.SheetNames[idx]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
    parseAndRender(raw);
  };

  const onSheetChange = (e) => {
    const idx = parseInt(e.target.value, 10);
    setSelectedSheetIndex(idx);
    loadSheetData(workbook, idx);
  };

  const parseAndRender = (rows) => {
    if (!rows || rows.length === 0) return showError("Sheet is empty");

    let hIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const r = rows[i].map(norm);
      if (r.some((h) => h === "date") && r.some((h) => h === "name")) {
        hIdx = i;
        break;
      }
    }
    if (hIdx < 0) return showError("Cannot find header row with 'Date' and 'Name'.");

    const normCols = rows[hIdx].map(norm);
    const mapOutToIn = [];
    const requiredNorms = requiredHeaders.map(norm);

    for (let i = 0; i < requiredNorms.length; i++) {
      const rNorm = requiredNorms[i];
      let foundIdx = -1;
      if (rNorm === "tat / hour") foundIdx = matchCol(normCols, ["tat / hour", "tat/hour", "tat per hour", "tat"]);
      else if (rNorm === "working hours") foundIdx = matchCol(normCols, ["working hours", "duration", "workinghours", "work hours"]);
      else foundIdx = matchCol(normCols, [rNorm]);
      mapOutToIn[i] = foundIdx;
    }

    const parsedData = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r.length || r.every((c) => !String(c).trim())) continue;

      const raw = {};
      for (let c = 0; c < requiredHeaders.length; c++) {
        const inIdx = mapOutToIn[c];
        raw[c] = inIdx >= 0 && r[inIdx] !== undefined ? r[inIdx] : "";
      }

      const dateObj = parseDate(raw[D_IDX]);
      const dateSort = isoDate(dateObj) || String(raw[D_IDX] || "");

      const tatVal = pNum(raw[TAT_IDX]);
      const cntVal = pNum(raw[CNT_IDX]);
      const durVal = pNum(raw[WH_IDX]);

      const countIsEmpty = cntVal === null || cntVal === 0;
      const tatIsEmpty = tatVal === null || tatVal === 0;

      let hours = null;
      if (countIsEmpty || tatIsEmpty) hours = durVal;
      else hours = cntVal / tatVal;

      let minHours = null;
      if (hours !== null && durVal !== null) minHours = Math.min(hours, durVal);
      else if (hours !== null) minHours = hours;
      else if (durVal !== null) minHours = durVal;

      if (!String(raw[N_IDX] || "").trim() && !dateSort) continue;

      parsedData.push({ raw, dateObj, dateSort, __hours: hours, __minHours: minHours });
    }

    if (!parsedData.length) return showError("No valid data rows found after header.");

    setAllData(parsedData);
    
    // Set default dates
    const dates = parsedData.map(d => d.dateSort).filter(Boolean).sort();
    if (dates.length) {
      setFFrom(dates[0]);
      setFTo(dates[dates.length - 1]);
    }
    setFName("");
    setFProcess("");
    setViewMode("detail");
    hideError();
  };

  // Filtered data
  const currentFiltered = useMemo(() => {
    return allData.filter((d) => {
      if (fName && String(d.raw[N_IDX] || "").trim() !== fName) return false;
      if (fProcess && String(d.raw[P_IDX] || "").trim() !== fProcess) return false;
      if (fFrom && d.dateSort < fFrom) return false;
      if (fTo && d.dateSort > fTo) return false;
      return true;
    }).sort((a, b) => a.dateSort.localeCompare(b.dateSort));
  }, [allData, fName, fProcess, fFrom, fTo]);

  // Derived filter options
  const nameOptions = useMemo(() => [...new Set(allData.map(d => String(d.raw[N_IDX] || '').trim()))].filter(Boolean).sort(), [allData]);
  const processOptions = useMemo(() => [...new Set(allData.map(d => String(d.raw[P_IDX] || '').trim()))].filter(Boolean).sort(), [allData]);

  // Stats
  const stats = useMemo(() => {
    const sTotal = currentFiltered.length;
    const sEmp = new Set(currentFiltered.map(d => d.raw[N_IDX])).size;
    const sCount = currentFiltered.reduce((s, d) => s + (pNum(d.raw[CNT_IDX]) || 0), 0);
    
    const hArr = currentFiltered.map(d => d.__hours).filter(v => v !== null && v !== undefined);
    const mArr = currentFiltered.map(d => d.__minHours).filter(v => v !== null && v !== undefined);

    const avgH = hArr.length ? (hArr.reduce((a, b) => a + b, 0) / hArr.length) : null;
    const avgM = mArr.length ? (mArr.reduce((a, b) => a + b, 0) / mArr.length) : null;

    return { sTotal, sEmp, sCount, avgH, avgM };
  }, [currentFiltered]);

  // Summary Rows
  const summaryRows = useMemo(() => {
    const byName = new Map();
    currentFiltered.forEach(d => {
      const name = String(d.raw[N_IDX] || "").trim();
      const dateKey = d.dateSort || "";
      if (!name || !dateKey) return;

      if (!byName.has(name)) byName.set(name, new Map());
      const byDate = byName.get(name);
      
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          name, dateSort: dateKey, dateObj: d.dateObj, whSum: 0, hoursSum: 0, remarks: [], leave: []
        });
      }

      const g = byDate.get(dateKey);
      g.whSum += (pNum(d.raw[WH_IDX]) || 0);
      const mh = (d.__minHours === null || d.__minHours === undefined) ? 0 : (Number(d.__minHours) || 0);
      g.hoursSum += mh;

      const note = String(d.raw[8] || "").trim();
      if (note) g.remarks.push(note);
      
      const lv = String(d.raw[9] || "").trim();
      if (lv) g.leave.push(lv);
    });

    const out = [];
    const names = Array.from(byName.keys()).sort((a, b) => a.localeCompare(b));
    names.forEach(name => {
      const byDate = byName.get(name);
      const dates = Array.from(byDate.keys()).sort();

      dates.forEach(dateKey => {
        const g = byDate.get(dateKey);
        const remarksJoined = uniqJoin(g.remarks);
        const leaveJoined = uniqJoin(g.leave);
        const divisor = getProductivityDivisor(remarksJoined, leaveJoined);
        const productivity = g.hoursSum ? (g.hoursSum * 100 / divisor) : 0;
        let targetStatus = "";
        if (productivity !== 0 && productivity < 100) targetStatus = "Target not achieved";
        const concatenate = [remarksJoined, leaveJoined, targetStatus].filter(Boolean).join(", ");
        
        out.push({
          name: g.name,
          dateSort: g.dateSort,
          dateDisplay: g.dateObj ? fmtDate(g.dateObj) : g.dateSort,
          whSum: g.whSum,
          hoursSum: g.hoursSum,
          productivity,
          remarks: remarksJoined,
          leave: leaveJoined,
          targetStatus,
          concatenate,
          __divisor: divisor
        });
      });
    });
    return out;
  }, [currentFiltered]);

  // Exports
  const downloadCSV = (filename, csvString) => {
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const h = [...requiredHeaders, "Hours", "Min Hours Cal"];
    const rows = currentFiltered.map(d => {
      const vals = requiredHeaders.map((_, ci) => String(d.raw[ci] || "").replace(/"/g, '""'));
      vals.push(d.__hours !== null && d.__hours !== undefined ? d.__hours.toFixed(4) : "");
      vals.push(d.__minHours !== null && d.__minHours !== undefined ? d.__minHours.toFixed(4) : "");
      return vals.map(v => `"${v}"`).join(",");
    });
    const csv = [h.map(v => `"${v}"`).join(","), ...rows].join("\n");
    downloadCSV(`employee_report_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportSummaryCSV = () => {
    if (!summaryRows.length) return showError("No summary rows to export.");
    const rows = summaryRows.map(r => {
      const vals = [
        r.name || "",
        r.dateDisplay || "",
        (r.whSum == null ? "" : (Math.round(Number(r.whSum) * 10) / 10).toFixed(1)),
        (r.hoursSum == null ? "" : (Math.round(Number(r.hoursSum) * 10) / 10).toFixed(1)),
        (r.productivity == null ? "" : String(Math.floor(Number(r.productivity) + 0.5))),
        r.remarks || "",
        r.leave || "",
        r.targetStatus || "",
        r.concatenate || ""
      ].map(v => String(v).replace(/"/g, '""'));
      return vals.map(v => `"${v}"`).join(",");
    });
    const csv = [summaryHeaders.map(v => `"${v}"`).join(","), ...rows].join("\n");
    downloadCSV(`summary_report_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportFinalCSV = () => {
    if (!summaryRows.length) return showError("No final report rows to export.");
    
    const prodByName = new Map();
    const workingDaysByName = new Map();
    summaryRows.forEach(r => {
      const name = String(r.name || "").trim();
      if (!name) return;
      const prod = Number(r.productivity) || 0;
      if (!prodByName.has(name)) prodByName.set(name, []);
      if (prod > 0) prodByName.get(name).push(prod);
      if (!workingDaysByName.has(name)) workingDaysByName.set(name, new Set());
      if (prod > 0 && r.dateSort) workingDaysByName.get(name).add(r.dateSort);
    });

    const procMap = new Map();
    currentFiltered.forEach(d => {
      const name = String(d.raw[N_IDX] || "").trim();
      const proc = String(d.raw[P_IDX] || "").trim();
      if (!name || !proc) return;
      if (!procMap.has(name)) procMap.set(name, new Set());
      procMap.get(name).add(proc);
    });

    const processRowIndexByName = new Map();
    const rows = summaryRows.map(r => {
      const name = String(r.name || "").trim();
      const prodList = prodByName.get(name) || [];
      const avgProd = prodList.length ? (prodList.reduce((a, b) => a + b, 0) / prodList.length) : 0;
      const workingDays = workingDaysByName.get(name) ? workingDaysByName.get(name).size : 0;
      const procSet = procMap.get(name) || new Set();
      const procList = Array.from(procSet).sort();
      const rowIndex = processRowIndexByName.get(name) || 0;
      const processForThisRow = procList[rowIndex] || "";
      processRowIndexByName.set(name, rowIndex + 1);
      
      return {
        Date: r.dateDisplay || "", Name: name, WorkingHours: r.whSum ?? "", Productivity: r.productivity ?? "",
        AvgProductivity: avgProd, Remarks: cleanFinalRemarks(r.concatenate), Quality: "100%", WorkingDays: workingDays,
        LateLogin: "", Leave: r.leave || "", Permission: "", NoProcessWorked: procList.length, NameProcessWorked: processForThisRow,
        Notes: "", Errors: "", FloorEthics: "", Login: "", Leave2: ""
      };
    });

    const csvRows = [];
    rows.forEach((r, index) => {
      const wh = (r.WorkingHours === "" ? "" : (Math.round(Number(r.WorkingHours) * 10) / 10).toFixed(1));
      const prod = (r.Productivity === "" ? "" : String(Math.floor(Number(r.Productivity) + 0.5)));
      const avg = (r.AvgProductivity === "" ? "" : String(Math.floor(Number(r.AvgProductivity) + 0.5)));

      const vals = [
        r.Date || "", r.Name || "", wh, prod, avg, r.Remarks || "", r.Quality || "", String(r.WorkingDays ?? ""),
        r.LateLogin || "", r.Leave || "", r.Permission || "", String(r.NoProcessWorked ?? ""), r.NameProcessWorked || "",
        r.Notes || "", r.Errors || "", r.FloorEthics || "", r.Login || "", r.Leave2 || ""
      ].map(v => String(v).replace(/"/g, '""'));
      
      csvRows.push(vals.map(v => `"${v}"`).join(","));
      const nextRow = rows[index + 1];
      if (nextRow && String(nextRow.Name || "").trim() !== String(r.Name || "").trim()) {
        csvRows.push(new Array(finalHeaders.length).fill('""').join(","));
      }
    });

    const csv = [finalHeaders.map(v => `"${v}"`).join(","), ...csvRows].join("\n");
    downloadCSV(`final_report_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const clearFilters = () => {
    setFName("");
    setFProcess("");
    const dates = allData.map(d => d.dateSort).filter(Boolean).sort();
    if (dates.length) {
      setFFrom(dates[0]);
      setFTo(dates[dates.length - 1]);
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Upload Card */}
      <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#13254a]">Upload Team Report</h2>
          <a
            href="/Report/Template_One%20Time%20Team%20Report%20May-%202026.xlsx"
            download
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-xl transition-colors shadow-sm"
          >
            <Download size={16} /> Download Template
          </a>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div 
            className={`w-full sm:w-auto px-6 py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              handleSelectedFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="text-slate-400 mb-3" size={32} />
            <div className="font-bold text-sm text-slate-700">Upload / Choose Excel File</div>
            <div className="text-xs text-slate-400 mt-1">.xlsx or .xls</div>
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              accept=".xlsx,.xls" 
              onChange={(e) => handleSelectedFile(e.target.files[0])} 
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {allData.length > 0 && (
              <>
                <button
                  className={`flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold rounded-xl transition-all shadow-sm ${
                    viewMode === "summary"
                      ? "bg-[#1d4ed8] text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  onClick={() => setViewMode(viewMode === "detail" ? "summary" : "detail")}
                >
                  <List size={16} /> {viewMode === "summary" ? "Show Detail View" : "Show Summary View"}
                </button>
                
                {viewMode === "summary" && (
                  <>
                    <button
                      className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-xl transition-all shadow-sm"
                      onClick={exportSummaryCSV}
                    >
                      <Download size={16} /> Summary
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-xl transition-all shadow-sm"
                      onClick={exportFinalCSV}
                    >
                      <Download size={16} /> Final Report
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {fileName && (
          <div className="mt-4 flex items-center justify-between bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-sm">
            <span className="font-medium text-blue-800 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-blue-500" /> {fileName}
            </span>
            {sheetNames.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Sheet</span>
                <select 
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-medium outline-none"
                  value={selectedSheetIndex} 
                  onChange={onSheetChange}
                >
                  {sheetNames.map((s, i) => <option key={i} value={i}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div className="text-sm font-medium leading-relaxed">{errorMsg}</div>
        </div>
      )}

      {/* Filters & Stats */}
      {allData.length > 0 && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Employee</label>
              <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none w-full bg-slate-50 focus:bg-white focus:border-blue-400" value={fName} onChange={e => setFName(e.target.value)}>
                <option value="">All</option>
                {nameOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">From Date</label>
              <input type="date" className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none w-full bg-slate-50 focus:bg-white focus:border-blue-400" value={fFrom} onChange={e => setFFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">To Date</label>
              <input type="date" className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none w-full bg-slate-50 focus:bg-white focus:border-blue-400" value={fTo} onChange={e => setFTo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Process</label>
              <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none w-full bg-slate-50 focus:bg-white focus:border-blue-400" value={fProcess} onChange={e => setFProcess(e.target.value)}>
                <option value="">All</option>
                {processOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div className="flex gap-2 w-full lg:w-auto justify-end">
              <button className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors" onClick={clearFilters}>
                Clear
              </button>
              {viewMode === "detail" && (
                <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-colors" onClick={exportCSV}>
                  <Download size={16} /> Export CSV
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Records", val: stats.sTotal, sub: "loaded rows" },
              { label: "Employees", val: stats.sEmp, sub: "unique names" },
              { label: "Total Count", val: stats.sCount.toLocaleString(), sub: "units processed" },
              { label: "Avg Hours", val: stats.avgH === null ? "--" : f1(stats.avgH), sub: "calculated hours" },
              { label: "Avg Min Hours", val: stats.avgM === null ? "--" : f1(stats.avgM), sub: "minimum hours cal" },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-[20px] p-5 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-indigo-500 rounded-l-[20px]" />
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</div>
                <div className="text-2xl font-bold text-[#13254a]">{s.val}</div>
                <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table Data */}
      <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm overflow-hidden">
        {allData.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
              <BarChart2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No data loaded</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">Upload an Excel file to generate the detailed report view.</p>
          </div>
        ) : viewMode === "detail" ? (
          <>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="font-bold text-[#13254a] flex items-center gap-3">
                Report Data 
                <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs">{currentFiltered.length} records</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {requiredHeaders.map((h, i) => <th key={i} className="px-4 py-3 font-bold text-slate-500 whitespace-nowrap">{h}</th>)}
                    <th className="px-4 py-3 font-bold text-blue-600 whitespace-nowrap">Hours</th>
                    <th className="px-4 py-3 font-bold text-indigo-600 whitespace-nowrap">Min Hours Cal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentFiltered.map((row, i) => {
                    const dateDisplay = row.dateObj ? fmtDate(row.dateObj) : String(row.raw[D_IDX] || "");
                    const processName = String(row.raw[P_IDX] || "").trim() || "--";
                    const hVal = row.__hours === null || row.__hours === undefined ? "--" : f1(row.__hours);
                    const mVal = row.__minHours === null || row.__minHours === undefined ? "--" : f1(row.__minHours);

                    // Add a date separator row logic visually if needed, but standard table is cleaner here.
                    return (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">{dateDisplay}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{String(row.raw[N_IDX] || "") || "--"}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-slate-600" title={processName}>{processName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{String(row.raw[3] || "") || "--"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{String(row.raw[4] || "") || "--"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{String(row.raw[5] || "") || "--"}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">{String(row.raw[6] || "") || "--"}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">{String(row.raw[7] || "") || "--"}</td>
                        <td className="px-4 py-3 max-w-[150px] truncate text-slate-500">{String(row.raw[8] || "") || "--"}</td>
                        <td className="px-4 py-3 max-w-[150px] truncate text-slate-500">{String(row.raw[9] || "") || "--"}</td>
                        
                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-blue-600 bg-blue-50/30">{hVal}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-indigo-600 bg-indigo-50/30">{mVal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="font-bold text-[#13254a] flex items-center gap-3">
                Summary Report 
                <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs">{summaryRows.length} records</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {summaryHeaders.map((h, i) => <th key={i} className="px-4 py-3 font-bold text-slate-500 whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summaryRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-700">{r.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{r.dateDisplay || "--"}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">{f1(r.whSum)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-blue-600 bg-blue-50/30">{f1(r.hoursSum)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-green-600 bg-green-50/30">{f0(r.productivity)}%</td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-slate-600" title={r.remarks}>{r.remarks || "--"}</td>
                      <td className="px-4 py-3 max-w-[150px] truncate text-slate-600" title={r.leave}>{r.leave || "--"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-red-500 font-medium">{r.targetStatus}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-slate-500" title={r.concatenate}>{r.concatenate || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
