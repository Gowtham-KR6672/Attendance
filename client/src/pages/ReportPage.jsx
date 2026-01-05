import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
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

// ✅ Achieved% can be > 100
// Achieved% = (team / actual) * 100
const calcAchievedPercent = (actualCount, teamCount) => {
  const A = Number(actualCount || 0);
  const T = Number(teamCount || 0);
  if (A === 0) return 0;
  return (T / A) * 100;
};

// ✅ Lag% rule
// if actual <= team => achieved (0 lag)
// else lag = ((actual - team) / actual) * 100
const calcLagPercent = (actualCount, teamCount) => {
  const A = Number(actualCount || 0);
  const T = Number(teamCount || 0);
  if (A === 0) return 0;
  if (A <= T) return 0;
  return ((A - T) / A) * 100;
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function CircleStat({
  label,
  value,
  color = "#2563eb",
  size = 86,
  stroke = 6,
}) {
  const pct = Number.isFinite(value) ? value : 0;

  // ring fill is capped at 100 for UI, but text can show >100
  const progress = clamp(pct, 0, 100);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;

  const endAngle = (progress / 100) * 2 * Math.PI - Math.PI / 2;
  const endX = size / 2 + r * Math.cos(endAngle);
  const endY = size / 2 + r * Math.sin(endAngle);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="block">
        {/* background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#d1d5db"
          strokeWidth={stroke}
          fill="none"
        />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {/* dots (start & end) */}
        <circle cx={size / 2} cy={stroke / 2} r={stroke / 2} fill={color} />
        {progress > 0 && <circle cx={endX} cy={endY} r={stroke / 2} fill={color} />}

        {/* center text */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="22"
          fontWeight="500"
          fill={color}
        >
          {pct.toFixed(0)}%
        </text>
      </svg>

      <div className="text-xs font-medium text-slate-600">{label}</div>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function ReportPage() {
  // manual add form
  const [date, setDate] = useState(() => dateToDDMMYYYY(new Date()));
  const [processName, setProcessName] = useState("");
  const [uom, setUom] = useState("");
  const [tat, setTat] = useState("");
  const [teamHours, setTeamHours] = useState("");
  const [teamCount, setTeamCount] = useState("");

  // range filter
  const [from, setFrom] = useState(() => {
    const r = monthRangeForDDMMYYYY(dateToDDMMYYYY(new Date()));
    return r?.from || "01-01-2026";
  });
  const [to, setTo] = useState(() => {
    const r = monthRangeForDDMMYYYY(dateToDDMMYYYY(new Date()));
    return r?.to || "31-01-2026";
  });

  // aggregate data
  const [series, setSeries] = useState([]);
  const [totals, setTotals] = useState({
    teamCount: 0,
    teamHours: 0,
    actualCount: 0,
    actualHours: 0,
  });

  // selected process
  const [selectedProcess, setSelectedProcess] = useState("");
  const [submittedProcess, setSubmittedProcess] = useState("");

  // trend points (last 3 dates)
  const [trendPoints, setTrendPoints] = useState([]);
  const [trendTotalCount, setTrendTotalCount] = useState(0);

  // messages
  const [banner, setBanner] = useState({ type: "", text: "" });

  const TAT = Number(tat);
  const TH = Number(teamHours);
  const TC = Number(teamCount);

  // computed (UI)
  const actualCount = Number.isFinite(TH) && Number.isFinite(TAT) ? TH * TAT : 0;
  const actualHours = Number.isFinite(TC) && Number.isFinite(TAT) && TAT > 0 ? TC / TAT : 0;

  const showMsg = (text, type = "info") => setBanner({ text, type });

  const loadAggregate = async (f, t) => {
    const { data } = await api.get("/report/aggregate", { params: { from: f, to: t } });
    setSeries(Array.isArray(data?.series) ? data.series : []);
    setTotals(data?.totals || { teamCount: 0, teamHours: 0, actualCount: 0, actualHours: 0 });
  };

  const loadTrend = async (proc, f, t) => {
    if (!proc) {
      setTrendPoints([]);
      setTrendTotalCount(0);
      return;
    }
    const { data } = await api.get("/report/trend", {
      params: { processName: proc, from: f, to: t, limit: 3 },
    });

    setTrendPoints(Array.isArray(data?.points) ? data.points : []);
    setTrendTotalCount(Number(data?.totalDates || 0));
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

    if (!isDDMMYYYY(from) || !isDDMMYYYY(to)) {
      return showMsg("From/To must be DD-MM-YYYY", "error");
    }

    try {
      await loadAggregate(from, to);
      if (submittedProcess) await loadTrend(submittedProcess, from, to);
    } catch (e) {
      console.error(e);
      showMsg(e?.response?.data?.message || "Failed to load data", "error");
    }
  };

  const onSave = async () => {
    setBanner({ type: "", text: "" });

    if (!isDDMMYYYY(date)) return showMsg("Date must be DD-MM-YYYY", "error");
    if (!processName.trim()) return showMsg("Process Name is required", "error");

    if (!Number.isFinite(TAT) || TAT <= 0) return showMsg("TAT must be > 0", "error");
    if (!Number.isFinite(TH) || TH < 0) return showMsg("Team Hours must be >= 0", "error");
    if (!Number.isFinite(TC) || TC < 0) return showMsg("Team Count must be >= 0", "error");

    try {
      const payload = {
        date,
        processName: processName.trim(),
        uom: uom.trim(),
        tat: TAT,
        teamHours: TH,
        teamCount: TC,
      };

      await api.post("/report", payload);

      showMsg("Saved successfully ✅", "success");

      // clear fields
      setProcessName("");
      setUom("");
      setTat("");
      setTeamHours("");
      setTeamCount("");

      // refresh data
      await loadAggregate(from, to);

      // refresh trend if same process selected
      if (submittedProcess && submittedProcess === payload.processName) {
        await loadTrend(submittedProcess, from, to);
      }
    } catch (e) {
      console.error(e);
      showMsg(e?.response?.data?.message || "Save failed", "error");
    }
  };

  const processOptions = useMemo(() => {
    return (series || []).map((x) => x.processName).filter(Boolean);
  }, [series]);

  // ✅ OVERALL = average of per-process %
  const overallAvg = useMemo(() => {
    const list = Array.isArray(series) ? series : [];
    const n = list.length;
    if (!n) return { achieved: 0, lag: 0 };

    let achievedSum = 0;
    let lagSum = 0;

    for (const p of list) {
      achievedSum += calcAchievedPercent(p.actualCount, p.teamCount);
      lagSum += calcLagPercent(p.actualCount, p.teamCount);
    }

    return {
      achieved: achievedSum / n,
      lag: lagSum / n,
    };
  }, [series]);

  // selected totals row (1 bar set)
  const selectedSeries = useMemo(() => {
    if (!submittedProcess) return [];
    const row = (series || []).find((x) => x.processName === submittedProcess);
    if (!row) return [];
    return [{ ...row, processName: row.processName }];
  }, [series, submittedProcess]);

  // trend lag/achieved (based on MOST RECENT DATE in trendPoints)
  const trendLagBox = useMemo(() => {
    if (!trendPoints?.length) return null;
    const last = trendPoints[trendPoints.length - 1];
    const lag = calcLagPercent(last.actualCount, last.teamCount);
    const achieved = calcAchievedPercent(last.actualCount, last.teamCount);
    const ok = lag === 0;
    return { ok, lag, achieved };
  }, [trendPoints]);

  const availableTrendCount = Number(trendTotalCount || 0);

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
            <div className="label mb-1">UOM</div>
            <input className="input w-full" value={uom} onChange={(e) => setUom(e.target.value)} />
          </div>

          <div className="col-span-12 md:col-span-1">
            <div className="label mb-1">TAT</div>
            <input className="input w-full" value={tat} onChange={(e) => setTat(e.target.value)} />
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

        <div className="mt-3">
          <button className="btn btn-primary" onClick={onSave}>
            Save
          </button>
        </div>
      </div>

      {/* Graph Section */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: All Process (TABLE) */}
        <div className="card col-span-12 lg:col-span-8" style={{ maxHeight: 760, overflowY: "auto" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-start gap-6">
              <div>
                <div className="font-semibold">All Process Monthly Statistics (Totals in Range)</div>
                <div className="text-xs text-slate-500">
                  Orange: Actual Count + Actual Hours | Blue: Team Count + Team Hours
                </div>
              </div>

              {/* ✅ Circles like your sample */}
              <div className="flex items-center gap-6">
                <CircleStat label="Overall Lag" value={overallAvg.lag} color="#17d406ff" size={68} stroke={4} />
                <CircleStat
                  label="Overall Achieved"
                  value={overallAvg.achieved}
                  color="#d1131cff"
                  size={68}
                  stroke={4}
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
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
            </div>
          </div>

          <div className="mt-2 overflow-auto border rounded-md" style={{ maxHeight: 520 }}>
            {(series || []).length ? (
              <table className="table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Process</th>
                    <th className="text-right">Actual Count</th>
                    <th className="text-right">Actual Hours</th>
                    <th className="text-right">Team Count</th>
                    <th className="text-right">Team Hours</th>
                    <th className="text-right">Lag %</th>
                    <th className="text-right">Achieved %</th>
                  </tr>
                </thead>

                <tbody>
                  {(series || []).map((r) => {
                    const lag = calcLagPercent(r.actualCount, r.teamCount);
                    const achieved = calcAchievedPercent(r.actualCount, r.teamCount);
                    const ok = lag === 0;

                    return (
                      <tr key={r.processName}>
                        <td className="min-w-[260px]">{r.processName}</td>
                        <td className="text-right">{Number(r.actualCount || 0).toFixed(2)}</td>
                        <td className="text-right">{Number(r.actualHours || 0).toFixed(2)}</td>
                        <td className="text-right">{Number(r.teamCount || 0).toFixed(2)}</td>
                        <td className="text-right">{Number(r.teamHours || 0).toFixed(2)}</td>

                        <td className={`text-right font-semibold ${ok ? "text-green-700" : "text-red-700"}`}>
                          {lag.toFixed(2)}%
                        </td>

                        <td className={`text-right font-semibold ${ok ? "text-green-700" : "text-slate-700"}`}>
                          {achieved.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-[360px] grid place-items-center text-slate-500 text-sm">
                No data for selected range.
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Process + Comparison + Table */}
        <div className="card col-span-12 lg:col-span-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Selected Process Graph</div>
            <div className="w-[60%]">
              <div className="label mb-1">Process Filter</div>
              <select
                className="select w-full"
                value={selectedProcess}
                onChange={(e) => setSelectedProcess(e.target.value)}
              >
                <option value="">Select...</option>
                {processOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={async () => {
              setBanner({ type: "", text: "" });
              if (!selectedProcess) return showMsg("Please select a process first.", "error");
              setSubmittedProcess(selectedProcess);

              try {
                await loadTrend(selectedProcess, from, to);
              } catch (e) {
                console.error(e);
                showMsg(e?.response?.data?.message || "Failed to load comparison data", "error");
              }
            }}
          >
            Submit
          </button>

          {/* Selected totals */}
          <div className="mt-3" style={{ width: "100%", height: 220 }}>
            {!submittedProcess ? (
              <div className="h-full grid place-items-center text-slate-500 text-sm">
                Select a process and click <b>Submit</b> to view graph.
              </div>
            ) : selectedSeries.length ? (
              <ResponsiveContainer>
                <BarChart data={selectedSeries} margin={{ top: 15, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="processName" height={40} interval={0} tick={{ fontSize: 10, fill: "#475569" }} />
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
                No data for this process in range.
              </div>
            )}
          </div>

          {/* Comparison section */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-sm">Last 3 Recent Date Comparison</div>

              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1 rounded-md text-xs font-bold border"
                  style={{
                    borderColor: "#ef4444",
                    background: "#fff",
                    minWidth: 260,
                    textAlign: "center",
                    color: trendLagBox?.ok ? "#16a34a" : "#dc2626",
                  }}
                  title="Lag & Achieved % based on most recent date in comparison"
                >
                  {trendLagBox
                    ? trendLagBox.ok
                      ? `Achieved ✅ (${trendLagBox.achieved.toFixed(2)}%) | Lag: ${trendLagBox.lag.toFixed(2)}%`
                      : `Lag: ${trendLagBox.lag.toFixed(2)}% | Achieved: ${trendLagBox.achieved.toFixed(2)}%`
                    : "Lag: - | Achieved: -"}
                </div>

                <div
                  className="px-3 py-1 rounded-md text-xs font-semibold border"
                  style={{
                    borderColor: "#ef4444",
                    color: "#111827",
                    background: "#fff",
                    minWidth: 170,
                    textAlign: "center",
                  }}
                  title="How many different dates are available for this process in the selected range"
                >
                  Available entries: {availableTrendCount} {availableTrendCount === 1 ? "date" : "dates"}
                  {availableTrendCount > 3 ? " (showing last 3)" : ""}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 mb-2">
              Add the same process for at least <b>2 different dates</b> to see comparison.
            </div>

            <div style={{ width: "100%", height: 220 }}>
              {submittedProcess && trendPoints.length ? (
                <ResponsiveContainer>
                  <BarChart data={trendPoints} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" interval={0} height={30} tick={{ fontSize: 10, fill: "#475569" }} />
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
                  {submittedProcess ? "No comparison data in range." : "Select a process and submit first."}
                </div>
              )}
            </div>

            {/* Comparison Data Report table */}
            <div className="mt-3">
              <div className="font-semibold text-sm mb-2">Comparison Data Report</div>

              {!trendPoints.length ? (
                <div className="text-sm text-slate-500">No comparison rows to display.</div>
              ) : (
                <div className="overflow-auto border rounded-md">
                  <table className="table w-full text-sm">
                    <thead>
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
                      {trendPoints.map((r) => {
                        const lag = calcLagPercent(r.actualCount, r.teamCount);
                        const achieved = calcAchievedPercent(r.actualCount, r.teamCount);
                        const ok = lag === 0;

                        return (
                          <tr key={r.date}>
                            <td className="whitespace-nowrap">{r.date}</td>
                            <td className="text-right">{Number(r.actualCount || 0).toFixed(2)}</td>
                            <td className="text-right">{Number(r.actualHours || 0).toFixed(2)}</td>
                            <td className="text-right">{Number(r.teamCount || 0).toFixed(2)}</td>
                            <td className="text-right">{Number(r.teamHours || 0).toFixed(2)}</td>

                            <td className={`text-right font-semibold ${ok ? "text-green-700" : "text-red-700"}`}>
                              {lag.toFixed(2)}%
                            </td>

                            <td className={`text-right font-semibold ${ok ? "text-green-700" : "text-slate-700"}`}>
                              {achieved.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
