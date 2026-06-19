import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Parser } from "hot-formula-parser";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { PlusCircle, Settings, Download, BarChart2, Edit, Plus, Trash2, List, CheckCircle } from "lucide-react";
import LoadingScreen from "./LoadingScreen";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const slugKey = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const TYPES = ["text", "number", "date", "formula"];
const CHART_TYPES = ["bar", "line", "pie"];

const DEFAULT_CHART = {
  type: "bar",
  xField: "",
  yField: "",
  color: "#256eed",
  title: "",
  showLegend: true,
};

// random nice palette (for Pie)
const PIE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#64748b",
];

export default function ProcessManager() {
  const [processName, setProcessName] = useState("");
  const [processes, setProcesses] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [selectedId, setSelectedId] = useState("");

  const selected = useMemo(
    () => processes.find((p) => p._id === selectedId) || null,
    [processes, selectedId]
  );

  const [entries, setEntries] = useState([]);

  // dialog
  const [dlg, setDlg] = useState({ open: false, title: "", msg: "" });
  const openDlg = (title, msg) => setDlg({ open: true, title, msg });

  // header editor
  const [headersDraft, setHeadersDraft] = useState([]);
  const [showHeaderEditor, setShowHeaderEditor] = useState(false);

  // row editor
  const [rowDraft, setRowDraft] = useState({});
  const [editingEntryId, setEditingEntryId] = useState(null);

  // ✅ chart settings loaded from DB
  const [savedChart, setSavedChart] = useState(null);

  // ✅ Chart modal (draft before submit)
  const [showChartModal, setShowChartModal] = useState(false);
  const [chartDraft, setChartDraft] = useState({ ...DEFAULT_CHART });

  // ✅ download option
  const [downloadMode, setDownloadMode] = useState("selected"); // selected | all

  const loadProcesses = async () => {
    try {
      const { data } = await api.get("/processes");
      setProcesses(Array.isArray(data) ? data : []);
    } finally {
      setInitialLoad(false);
    }
  };

  const loadEntries = async (pid) => {
    const { data } = await api.get(`/processes/${pid}/entries`);
    setEntries(Array.isArray(data) ? data : []);
  };

  const loadChart = async (pid) => {
    try {
      const { data } = await api.get(`/processes/${pid}/chart`);
      setSavedChart(data?.chart || null);
    } catch {
      setSavedChart(null);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setEntries([]);
      setSavedChart(null);
      return;
    }
    loadEntries(selectedId);
    loadChart(selectedId);
  }, [selectedId]);

  const createProcess = async () => {
    const name = processName.trim();
    if (!name) return openDlg("Error", "Process name required");

    try {
      const { data } = await api.post("/processes", { name });
      openDlg("Success", "Process created successfully.");
      setProcessName("");
      await loadProcesses();
      if (data?.process?._id) setSelectedId(data.process._id);
    } catch (e) {
      openDlg("Error", e?.response?.data?.message || "Create failed");
    }
  };

  const deleteProcess = async () => {
    if (!selectedId) return openDlg("Error", "Select a process first.");

    const name = selected?.name || "this process";
    if (
      !window.confirm(`Delete "${name}"? This will remove ALL rows under it.`)
    )
      return;

    try {
      await api.delete(`/processes/${selectedId}`);
      openDlg("Success", "Process deleted successfully.");

      setSelectedId("");
      setEntries([]);
      setSavedChart(null);

      await loadProcesses();
    } catch (e) {
      openDlg("Error", e?.response?.data?.message || "Delete failed");
    }
  };

  // ==========================
  // ✅ Headers
  // ==========================
  const openHeaders = () => {
    if (!selected) return openDlg("Error", "Select a process first");
    setHeadersDraft(
      (selected.headers || []).map((h) => ({
        key: h.key || "",
        label: h.label || "",
        type: h.type || "text",
        formula: h.formula || "",
      }))
    );
    setShowHeaderEditor(true);
  };

  const addHeaderRow = () => {
    setHeadersDraft((p) => [
      ...p,
      { key: "", label: "", type: "text", formula: "" },
    ]);
  };

  const saveHeaders = async () => {
    if (!selectedId) return;

    const normalized = headersDraft
      .map((h) => {
        const label = String(h.label || "").trim();
        const key = String(h.key || "").trim() || slugKey(label);
        return {
          key,
          label,
          type: TYPES.includes(h.type) ? h.type : "text",
          formula: String(h.formula || "").trim(),
        };
      })
      .filter((h) => h.key && h.label);

    if (!normalized.length) return openDlg("Error", "Add at least 1 header.");

    for (const h of normalized) {
      if (h.type === "formula" && !h.formula) {
        return openDlg("Error", `Formula required for column "${h.label}"`);
      }
    }

    try {
      await api.put(`/processes/${selectedId}/headers`, {
        headers: normalized,
      });
      openDlg("Success", "Headers updated successfully.");
      setShowHeaderEditor(false);
      await loadProcesses();
      await loadEntries(selectedId);
    } catch (e) {
      openDlg("Error", e?.response?.data?.message || "Header update failed");
    }
  };

  // ==========================
  // ✅ Rows
  // ==========================
  const startAddRow = () => {
    if (!selected?.headers?.length)
      return openDlg("Error", "Create headers first.");
    setEditingEntryId(null);
    setRowDraft({});
  };

  const startEditRow = (entry) => {
    setEditingEntryId(entry._id);
    setRowDraft({ ...(entry.values || {}) });
  };

  const saveRow = async () => {
    if (!selectedId) return;
    const values = { ...rowDraft };

    try {
      if (editingEntryId) {
        await api.put(`/processes/${selectedId}/entries/${editingEntryId}`, {
          values,
        });
        openDlg("Success", "Row updated successfully.");
      } else {
        await api.post(`/processes/${selectedId}/entries`, { values });
        openDlg("Success", "Row added successfully.");
      }
      setEditingEntryId(null);
      setRowDraft({});
      await loadEntries(selectedId);
    } catch (e) {
      openDlg("Error", e?.response?.data?.message || "Row save failed");
    }
  };

  const deleteRow = async (entryId) => {
    if (!selectedId) return;
    if (!window.confirm("Delete this row?")) return;

    try {
      await api.delete(`/processes/${selectedId}/entries/${entryId}`);
      openDlg("Success", "Row deleted successfully.");
      await loadEntries(selectedId);
    } catch (e) {
      openDlg("Error", e?.response?.data?.message || "Delete failed");
    }
  };

  // ==========================
  // ✅ Formula evaluation
  // ==========================
  const computedTable = useMemo(() => {
    const headers = selected?.headers || [];
    if (!headers.length) return [];

    const parser = new Parser();

    const colLetter = (idx) => {
      let n = idx + 1;
      let s = "";
      while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };

    const matrix = entries.map((entry) => {
      const row = {};
      headers.forEach((h, cIdx) => {
        row[h.key] = entry.values?.[h.key] ?? "";
        row.__colMap = row.__colMap || {};
        row.__colMap[colLetter(cIdx)] = h.key;
      });
      return { ...entry, __row: row };
    });

    parser.on("callCellValue", (cellCoord, done) => {
      const r = cellCoord.row.index;
      const c = cellCoord.column.index;
      const rowObj = matrix[r]?.__row;
      if (!rowObj) return done(0);

      const letter = colLetter(c);
      const key = rowObj.__colMap?.[letter];
      const raw = key ? rowObj[key] : 0;

      const num = Number(raw);
      done(Number.isFinite(num) ? num : 0);
    });

    return matrix.map((entry, rIdx) => {
      const out = { ...entry, computed: {} };

      headers.forEach((h) => {
        if (h.type !== "formula") return;
        const fx = String(h.formula || "").trim();
        if (!fx.startsWith("=")) return;

        const res = parser.parse(fx, { row: rIdx, col: 0 });
        out.computed[h.key] = res?.result ?? "";
      });

      return out;
    });
  }, [entries, selected]);

  // ==========================
  // ✅ Excel Download (Selected)
  // ==========================
  const downloadSelectedExcel = () => {
    if (!selected) return openDlg("Error", "Select a process first.");
    const headers = selected.headers || [];
    if (!headers.length) return openDlg("Error", "No headers to export.");

    const aoa = [];
    aoa.push(headers.map((h) => h.label));

    computedTable.forEach((row) => {
      const line = headers.map((h) => {
        if (h.type === "formula") return row.computed?.[h.key] ?? "";
        return row.values?.[h.key] ?? "";
      });
      aoa.push(line);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selected.name || "Process");

    const fileName = `${selected.name}_data.xlsx`.replace(/[\\/:*?"<>|]/g, "_");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([out], { type: "application/octet-stream" }), fileName);

    openDlg("Success", "Excel downloaded successfully.");
  };

  // ==========================
  // ✅ Excel Download (All Processes)
  // ==========================
  const downloadAllProcessesExcel = async () => {
    try {
      const { data } = await api.get("/processes/export/all");
      const blocks = Array.isArray(data?.data) ? data.data : [];

      if (!blocks.length)
        return openDlg("Error", "No process data found to export.");

      const wb = XLSX.utils.book_new();

      for (const block of blocks) {
        const proc = block.process;
        const headers = proc?.headers || [];
        const entries = block.entries || [];

        if (!proc?.name) continue;

        const parser = new Parser();
        const colLetter = (idx) => {
          let n = idx + 1;
          let s = "";
          while (n > 0) {
            const r = (n - 1) % 26;
            s = String.fromCharCode(65 + r) + s;
            n = Math.floor((n - 1) / 26);
          }
          return s;
        };

        const matrix = entries.map((entry) => {
          const row = {};
          headers.forEach((h, cIdx) => {
            row[h.key] = entry.values?.[h.key] ?? "";
            row.__colMap = row.__colMap || {};
            row.__colMap[colLetter(cIdx)] = h.key;
          });
          return { ...entry, __row: row };
        });

        parser.on("callCellValue", (cellCoord, done) => {
          const r = cellCoord.row.index;
          const c = cellCoord.column.index;
          const rowObj = matrix[r]?.__row;
          if (!rowObj) return done(0);

          const letter = colLetter(c);
          const key = rowObj.__colMap?.[letter];
          const raw = key ? rowObj[key] : 0;
          const num = Number(raw);
          done(Number.isFinite(num) ? num : 0);
        });

        const computed = matrix.map((entry, rIdx) => {
          const computedRow = {};
          headers.forEach((h) => {
            if (h.type !== "formula") return;
            const fx = String(h.formula || "").trim();
            if (!fx.startsWith("=")) return;
            const res = parser.parse(fx, { row: rIdx, col: 0 });
            computedRow[h.key] = res?.result ?? "";
          });
          return { entry, computedRow };
        });

        const aoa = [];
        aoa.push(headers.map((h) => h.label));

        computed.forEach(({ entry, computedRow }) => {
          const line = headers.map((h) => {
            if (h.type === "formula") return computedRow?.[h.key] ?? "";
            return entry.values?.[h.key] ?? "";
          });
          aoa.push(line);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const safeSheet = String(proc.name).slice(0, 31); // Excel limit
        XLSX.utils.book_append_sheet(wb, ws, safeSheet);
      }

      const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      saveAs(
        new Blob([out], { type: "application/octet-stream" }),
        `all_processes.xlsx`
      );
      openDlg("Success", "All process data downloaded successfully.");
    } catch (e) {
      openDlg("Error", e?.response?.data?.message || "Download all failed");
    }
  };

  // ==========================
  // ✅ Open Chart Modal (Draft)
  // ==========================
  const openChartModal = () => {
    if (!selectedId) return openDlg("Error", "Select a process first.");
    if (!selected?.headers?.length)
      return openDlg("Error", "Create headers first.");
    if (!computedTable.length)
      return openDlg("Error", "Add at least 1 data row.");

    const headers = selected.headers;

    const x = savedChart?.xField || headers[0]?.key || "";
    const y =
      savedChart?.yField ||
      headers.find((h) => h.type === "number" || h.type === "formula")?.key ||
      headers[1]?.key ||
      "";

    setChartDraft({
        ...DEFAULT_CHART,
        ...(savedChart || {}),
        xField: x,
        yField: y,
        type: (savedChart?.type || "bar").toLowerCase(),
        color: "#256eed", // Forced for all processes
      });

    setShowChartModal(true);
  };

  // ==========================
  // ✅ Chart Data for Preview + Page Render
  // ==========================
  const chartFields = useMemo(() => selected?.headers || [], [selected]);

 const buildChartData = (xKey, yKey) => {
  if (!xKey || !yKey) return [];
  const headers = selected?.headers || [];

  const yType = headers.find((h) => h.key === yKey)?.type;
  const yIsFormula = yType === "formula";

  // 1) Build raw points (row-wise)
  const points = computedTable.map((row) => {
    const x = String(row.values?.[xKey] ?? "").trim();
    const yRaw = yIsFormula ? row.computed?.[yKey] : row.values?.[yKey];
    const y = Number(yRaw);
    return { x, y: Number.isFinite(y) ? y : 0 };
  });

  // 2) Aggregate duplicate X values (ex: "August" appears many times)
  //    This will SUM the Y values for the same X.
  const agg = new Map();
  for (const p of points) {
    if (!p.x) continue;
    agg.set(p.x, (agg.get(p.x) || 0) + (p.y || 0));
  }
  const aggregated = Array.from(agg, ([x, y]) => ({ x, y }));

  // 3) If X looks like month names, sort Jan..Dec
  const MONTHS = [
    "january","february","march","april","may","june",
    "july","august","september","october","november","december",
  ];

  const monthIndex = (s) => MONTHS.indexOf(String(s || "").trim().toLowerCase());
  const allAreMonths =
    aggregated.length > 0 && aggregated.every((p) => monthIndex(p.x) !== -1);

  if (allAreMonths) {
    aggregated.sort((a, b) => monthIndex(a.x) - monthIndex(b.x));
  }

  return aggregated;
};


  const chartPreviewData = useMemo(() => {
    return buildChartData(chartDraft.xField, chartDraft.yField);
  }, [chartDraft.xField, chartDraft.yField, computedTable, selected]);

  const pageChartData = useMemo(() => {
    if (!savedChart?.xField || !savedChart?.yField) return [];
    return buildChartData(savedChart.xField, savedChart.yField);
  }, [savedChart, computedTable, selected]);

  // ==========================
  // ✅ Submit Chart (Save to DB + show on page)
  // ==========================
  const submitChart = async () => {
    if (!selectedId) return;

    if (!chartDraft.xField || !chartDraft.yField) {
      return openDlg("Error", "Select X and Y fields.");
    }

    try {
      await api.put(`/processes/${selectedId}/chart`, {
        type: chartDraft.type,
        xField: chartDraft.xField,
        yField: chartDraft.yField,
        color: chartDraft.color,
        title: chartDraft.title,
        showLegend: chartDraft.showLegend,
      });

      openDlg("Success", "Chart created & updated on page.");
      setShowChartModal(false);

      await loadProcesses(); // refresh saved chart inside process list
      await loadChart(selectedId); // refresh savedChart state
    } catch (e) {
      openDlg("Error", e?.response?.data?.message || "Chart save failed");
    }
  };

  // ==========================
  // ✅ Render Chart on Page
  // ==========================
  const ChartOnPage = () => {
    if (!savedChart?.xField || !savedChart?.yField) {
      return (
        <div className="text-sm text-gray-500">
          No chart created yet. Click <b>Chart</b> and submit.
        </div>
      );
    }

    if (!pageChartData.length) {
      return (
        <div className="text-sm text-gray-500">No data to show chart.</div>
      );
    }

    const color = "#256eed"; // Forced for all processes
    const type = (savedChart.type || "bar").toLowerCase();

    return (
      <div className="border rounded-xl p-3">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-slate-800">
            {savedChart.title ? savedChart.title : "Chart"}
          </div>
          <button className="px-4 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors" onClick={openChartModal}>
            Edit Chart
          </button>
        </div>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            {type === "line" ? (
              <LineChart data={pageChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip />
                {savedChart.showLegend && <Legend />}
                <Line
                  type="monotone"
                  dataKey="y"
                  stroke={color}
                  strokeWidth={3}
                />
              </LineChart>
            ) : type === "pie" ? (
              <PieChart>
                <Tooltip />
                {savedChart.showLegend && <Legend />}
                <Pie
                  data={pageChartData}
                  dataKey="y"
                  nameKey="x"
                  outerRadius={110}
                  label
                >
                  {pageChartData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={PIE_COLORS[idx % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={pageChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip />
                {savedChart.showLegend && <Legend />}
                <Bar dataKey="y" fill={color} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ==========================
  // ✅ Download handler (Selected vs All)
  // ==========================
  const handleDownload = async () => {
    if (downloadMode === "all") return downloadAllProcessesExcel();
    return downloadSelectedExcel();
  };

  if (initialLoad) {
    return <LoadingScreen text="Loading Processes" subtext="Fetching the process records..." />;
  }

  return (
    <div className="space-y-4">
      {/* dialog */}
      {dlg.open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setDlg((p) => ({ ...p, open: false }))}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="font-semibold mb-2">{dlg.title}</div>
              <div className="text-sm text-gray-700">{dlg.msg}</div>
              <div className="mt-4 flex justify-end">
                <button
                  className="btn btn-primary"
                  onClick={() => setDlg((p) => ({ ...p, open: false }))}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Chart Modal */}
      {showChartModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl border">
            <div className="p-4 flex items-center justify-between">
              <div className="font-semibold">Create Chart</div>
              <button
                className="btn btn-outline"
                onClick={() => setShowChartModal(false)}
              >
                Close
              </button>
            </div>

            <div className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-3">
                  <div className="label">Chart Type</div>
                  <select
                    className="select w-full"
                    value={chartDraft.type}
                    onChange={(e) =>
                      setChartDraft((p) => ({ ...p, type: e.target.value }))
                    }
                  >
                    {CHART_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <div className="label">X Field</div>
                  <select
                    className="select w-full"
                    value={chartDraft.xField}
                    onChange={(e) =>
                      setChartDraft((p) => ({ ...p, xField: e.target.value }))
                    }
                  >
                    {chartFields.map((h) => (
                      <option key={h.key} value={h.key}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <div className="label">Y Field</div>
                  <select
                    className="select w-full"
                    value={chartDraft.yField}
                    onChange={(e) =>
                      setChartDraft((p) => ({ ...p, yField: e.target.value }))
                    }
                  >
                    {chartFields.map((h) => (
                      <option key={h.key} value={h.key}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <div className="label">Color</div>
                  <input
                    type="color"
                    className="input w-full"
                    value={chartDraft.color}
                    onChange={(e) =>
                      setChartDraft((p) => ({ ...p, color: e.target.value }))
                    }
                    title="Pick chart color"
                  />
                </div>

                <div className="col-span-12 md:col-span-8">
                  <div className="label">Chart Title (optional)</div>
                  <input
                    className="input w-full"
                    value={chartDraft.title}
                    onChange={(e) =>
                      setChartDraft((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g. Total Records by Month"
                  />
                </div>

                <div className="col-span-12 md:col-span-4 flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!chartDraft.showLegend}
                      onChange={(e) =>
                        setChartDraft((p) => ({
                          ...p,
                          showLegend: e.target.checked,
                        }))
                      }
                    />
                    Show Legend
                  </label>
                </div>
              </div>

              {/* Chart Preview */}
              <div className="border rounded-xl p-3">
                <div className="text-sm font-semibold mb-2">Chart Preview</div>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    {chartDraft.type === "line" ? (
                      <LineChart data={chartPreviewData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" />
                        <YAxis />
                        <Tooltip />
                        {chartDraft.showLegend && <Legend />}
                        <Line
                          type="monotone"
                          dataKey="y"
                          stroke={chartDraft.color}
                          strokeWidth={3}
                        />
                      </LineChart>
                    ) : chartDraft.type === "pie" ? (
                      <PieChart>
                        <Tooltip />
                        {chartDraft.showLegend && <Legend />}
                        <Pie
                          data={chartPreviewData}
                          dataKey="y"
                          nameKey="x"
                          outerRadius={95}
                          label
                        >
                          {chartPreviewData.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={PIE_COLORS[idx % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    ) : (
                      <BarChart data={chartPreviewData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" />
                        <YAxis />
                        <Tooltip />
                        {chartDraft.showLegend && <Legend />}
                        <Bar dataKey="y" fill={chartDraft.color} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                {/* ✅ THIS is the Submit action */}
                <button className="btn btn-primary" onClick={submitChart}>
                  Submit
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowChartModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full animate-in fade-in duration-300">
        {/* LEFT */}
        <div className="col-span-1 lg:col-span-4">
          <div className="card border border-slate-200 rounded-xl bg-white shadow-sm p-6 h-fit">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <PlusCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-600">Create Process</h3>
                <p className="text-sm text-slate-500">Create a new process for data export.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Process Name</label>
                <input
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg text-slate-700 font-medium"
                  value={processName}
                  onChange={(e) => setProcessName(e.target.value)}
                  placeholder="e.g. PDF to Excel Data Entry - Banks"
                />
              </div>

              <button 
                className="inline-flex items-center gap-2 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors text-sm hover:brightness-110" 
                style={{ backgroundColor: "#256eed" }}
                onClick={createProcess}
              >
                <Plus size={16} /> Create
              </button>
            </div>

            <hr className="border-slate-100 my-8" />

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Select Process</label>
                <select
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="">Select...</option>
                  {processes.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  onClick={openHeaders}
                  disabled={!selectedId}
                >
                  <Edit size={16} className="text-blue-600" /> Edit Headers
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  onClick={startAddRow}
                  disabled={!selectedId}
                >
                  <PlusCircle size={16} className="text-blue-600" /> Add Row
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors ml-auto disabled:opacity-50"
                  onClick={deleteProcess}
                  disabled={!selectedId}
                >
                  <Trash2 size={16} /> Delete Process
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-1 lg:col-span-8">
          <div className="card border border-slate-200 rounded-xl bg-white shadow-sm p-6 h-fit">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Settings size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-600">Process Setup</h3>
                  <p className="text-sm text-slate-500">Configure and download the selected process.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  className="px-4 py-2 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-lg appearance-none text-slate-700 font-medium min-w-[140px]"
                  value={downloadMode}
                  onChange={(e) => setDownloadMode(e.target.value)}
                  title="Download mode"
                >
                  <option value="selected">Selected Process</option>
                  <option value="all">All Process</option>
                </select>

                <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors whitespace-nowrap" onClick={handleDownload}>
                  <Download size={16} className="text-slate-500" /> Download Excel
                </button>

                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  onClick={openChartModal}
                  disabled={!selectedId || !selected?.headers?.length}
                >
                  <BarChart2 size={16} className="text-emerald-500" /> Chart
                </button>
              </div>
            </div>

            {/* ✅ Chart shown on page after Submit */}
            <ChartOnPage />

            <div className="mt-6 border border-slate-100 rounded-xl bg-slate-50/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <List size={18} className="text-blue-600" />
                <h4 className="font-semibold text-slate-800 text-sm">Actions</h4>
              </div>

              {/* Data table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {(selected?.headers || []).map((h) => (
                        <th key={h.key} className="px-4 py-3 text-left font-semibold text-slate-700">
                          {h.label}
                          {h.type === "formula" && (
                            <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                              fx: {h.formula}
                            </div>
                          )}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 w-[160px]">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {(selected?.headers || []).length ? (
                      <tr className="bg-blue-50/30">
                        {selected.headers.map((h) => (
                          <td key={h.key} className="px-4 py-3">
                            {h.type === "formula" ? (
                              <div className="text-slate-400 text-sm italic">Auto-calculated</div>
                            ) : (
                              <input
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm rounded-md"
                                value={rowDraft[h.key] ?? ""}
                                onChange={(e) =>
                                  setRowDraft((p) => ({
                                    ...p,
                                    [h.key]: e.target.value,
                                  }))
                                }
                              />
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                              onClick={saveRow}
                            >
                              {editingEntryId ? "Update" : "Save"}
                            </button>
                            {editingEntryId && (
                              <button
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                                onClick={() => {
                                  setEditingEntryId(null);
                                  setRowDraft({});
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500 italic bg-white" colSpan="100%">
                          No headers yet. Click "Edit Headers" to create columns.
                        </td>
                      </tr>
                    )}

                    {computedTable.map((entry) => (
                      <tr key={entry._id} className="hover:bg-slate-50 transition-colors">
                        {(selected?.headers || []).map((h) => {
                          const raw = entry.values?.[h.key] ?? "";
                          const val =
                            h.type === "formula"
                              ? entry.computed?.[h.key] ?? ""
                              : raw;
                          return (
                            <td key={h.key} className="px-4 py-3 text-slate-600">
                              {String(val)}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              className="text-blue-600 hover:text-blue-800 font-medium text-xs transition-colors"
                              onClick={() => startEditRow(entry)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-red-600 hover:text-red-800 font-medium text-xs transition-colors"
                              onClick={() => deleteRow(entry._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!computedTable.length && selected?.headers?.length ? (
                      <tr>
                        <td
                          className="px-4 py-8 text-center text-slate-500 italic bg-white"
                          colSpan={(selected.headers.length || 0) + 1}
                        >
                          No data rows yet. Use "Add Row".
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 bg-emerald-50/80 border border-emerald-100 rounded-lg p-4 text-sm text-emerald-700">
              <CheckCircle size={18} className="text-emerald-500 shrink-0" />
              <p>Excel download exports formulas as calculated values.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Editor Modal */}
      {showHeaderEditor && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl border">
            <div className="p-4 flex items-center justify-between">
              <div className="font-semibold">Edit Headers</div>
              <button
                className="btn btn-outline"
                onClick={() => setShowHeaderEditor(false)}
              >
                Close
              </button>
            </div>

            <div className="px-4 pb-4 space-y-3">
              <div className="text-sm text-gray-600">
                For formula columns, set type = <b>formula</b> and write formula
                like <b>=C1-D1</b>
              </div>

              <div className="space-y-2">
                {headersDraft.map((h, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-4">
                      <input
                        className="input w-full"
                        placeholder="Header label"
                        value={h.label}
                        onChange={(e) => {
                          const v = e.target.value;
                          setHeadersDraft((p) =>
                            p.map((x, i) =>
                              i === idx ? { ...x, label: v } : x
                            )
                          );
                        }}
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        className="input w-full"
                        placeholder="Key (auto)"
                        value={h.key}
                        onChange={(e) => {
                          const v = e.target.value;
                          setHeadersDraft((p) =>
                            p.map((x, i) => (i === idx ? { ...x, key: v } : x))
                          );
                        }}
                      />
                    </div>

                    <div className="col-span-2">
                      <select
                        className="select w-full"
                        value={h.type || "text"}
                        onChange={(e) => {
                          const v = e.target.value;
                          setHeadersDraft((p) =>
                            p.map((x, i) => (i === idx ? { ...x, type: v } : x))
                          );
                        }}
                      >
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <input
                        className="input w-full"
                        placeholder="Formula (=C1-D1)"
                        value={h.formula || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setHeadersDraft((p) =>
                            p.map((x, i) =>
                              i === idx ? { ...x, formula: v } : x
                            )
                          );
                        }}
                        disabled={h.type !== "formula"}
                      />
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() =>
                          setHeadersDraft((p) => p.filter((_, i) => i !== idx))
                        }
                      >
                        X
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button className="btn btn-outline" onClick={addHeaderRow}>
                  + Add Header
                </button>
                <button className="btn btn-primary" onClick={saveHeaders}>
                  Save Headers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
