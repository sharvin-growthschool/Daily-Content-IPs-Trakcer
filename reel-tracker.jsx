import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "reel-tracker-data";

const BENCHMARKS = {
  likeRate: { good: 0.05, ok: 0.02 },
  viewsFollowers: { good: 0.3, ok: 0.1 },
  retention: { good: 0.5, ok: 0.25 },
  skipRate: { goodBelow: 0.5, okBelow: 0.75 },
  engageScore: { good: 0.08, ok: 0.04 },
};

const getColor = (val, metric) => {
  if (val == null || isNaN(val)) return "#555";
  if (metric === "skipRate") {
    if (val < BENCHMARKS.skipRate.goodBelow) return "#4CAF50";
    if (val < BENCHMARKS.skipRate.okBelow) return "#FF9800";
    return "#F44336";
  }
  const b = BENCHMARKS[metric];
  if (!b) return "#aaa";
  if (val >= b.good) return "#4CAF50";
  if (val >= b.ok) return "#FF9800";
  return "#F44336";
};

const pct = (v) => (v != null && !isNaN(v) ? (v * 100).toFixed(1) + "%" : "—");
const num = (v) => (v != null ? v.toLocaleString() : "—");

const today = () => new Date().toISOString().split("T")[0];

const defaultData = () => ({ accounts: [], entries: [] });

export default function ReelTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(today());
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", handle: "", followers: "" });
  const [entryForm, setEntryForm] = useState({
    accountIdx: 0, link: "", views: "", likes: "", avgDuration: "", reelLength: "", saves: "", shares: "",
  });
  const [editingEntry, setEditingEntry] = useState(null);
  const dashRef = useRef(null);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        setData(res ? JSON.parse(res.value) : defaultData());
      } catch {
        setData(defaultData());
      }
      setLoading(false);
    })();
  }, []);

  // Save data
  const save = useCallback(async (newData) => {
    setData(newData);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(newData)); } catch {}
  }, []);

  const addAccount = () => {
    if (!newAccount.name.trim() || !newAccount.handle.trim()) return;
    const updated = { ...data, accounts: [...data.accounts, { name: newAccount.name.trim(), handle: newAccount.handle.trim().replace("@", ""), followers: parseInt(newAccount.followers) || 0, id: Date.now().toString() }] };
    save(updated);
    setNewAccount({ name: "", handle: "", followers: "" });
  };

  const removeAccount = (id) => {
    if (!confirm("Delete this account and all its entries?")) return;
    const updated = { accounts: data.accounts.filter(a => a.id !== id), entries: data.entries.filter(e => e.accountId !== id) };
    save(updated);
  };

  const updateFollowers = (id, followers) => {
    const updated = { ...data, accounts: data.accounts.map(a => a.id === id ? { ...a, followers: parseInt(followers) || 0 } : a) };
    save(updated);
  };

  const addEntry = () => {
    const acc = data.accounts[entryForm.accountIdx];
    if (!acc) return;
    const entry = {
      id: Date.now().toString(),
      date: selectedDate,
      accountId: acc.id,
      link: entryForm.link.trim(),
      views: parseInt(entryForm.views) || 0,
      likes: parseInt(entryForm.likes) || 0,
      avgDuration: parseFloat(entryForm.avgDuration) || 0,
      reelLength: parseFloat(entryForm.reelLength) || 0,
      saves: parseInt(entryForm.saves) || 0,
      shares: parseInt(entryForm.shares) || 0,
    };
    const updated = { ...data, entries: [...data.entries, entry] };
    save(updated);
    setEntryForm({ ...entryForm, link: "", views: "", likes: "", avgDuration: "", reelLength: "", saves: "", shares: "" });
  };

  const deleteEntry = (id) => {
    const updated = { ...data, entries: data.entries.filter(e => e.id !== id) };
    save(updated);
  };

  const startEdit = (entry) => {
    setEditingEntry({ ...entry });
  };

  const saveEdit = () => {
    if (!editingEntry) return;
    const updated = {
      ...data,
      entries: data.entries.map(e => e.id === editingEntry.id ? {
        ...editingEntry,
        views: parseInt(editingEntry.views) || 0,
        likes: parseInt(editingEntry.likes) || 0,
        avgDuration: parseFloat(editingEntry.avgDuration) || 0,
        reelLength: parseFloat(editingEntry.reelLength) || 0,
        saves: parseInt(editingEntry.saves) || 0,
        shares: parseInt(editingEntry.shares) || 0,
      } : e),
    };
    save(updated);
    setEditingEntry(null);
  };

  const calcMetrics = (entry, account) => {
    const v = entry.views || 0;
    const followers = account?.followers || 0;
    const likeRate = v > 0 ? entry.likes / v : null;
    const viewsFollowers = followers > 0 ? v / followers : null;
    const retention = entry.reelLength > 0 ? entry.avgDuration / entry.reelLength : null;
    const skipRate = retention != null ? 1 - retention : null;
    const engageScore = v > 0 ? (entry.likes + entry.saves * 2 + entry.shares * 3) / v : null;
    return { likeRate, viewsFollowers, retention, skipRate, engageScore };
  };

  const dayEntries = data?.entries?.filter(e => e.date === selectedDate) || [];
  const getAccount = (id) => data?.accounts?.find(a => a.id === id);

  const allDates = [...new Set(data?.entries?.map(e => e.date) || [])].sort().reverse();

  // Export functionality
  const exportCSV = () => {
    const rows = [["Date", "Account", "Handle", "Link", "Views", "Likes", "Followers", "Avg Duration", "Reel Length", "Saves", "Shares", "Like Rate", "Views/Followers", "Retention", "Skip Rate", "Engage Score"]];
    (data?.entries || []).forEach(e => {
      const acc = getAccount(e.accountId);
      const m = calcMetrics(e, acc);
      rows.push([e.date, acc?.name, acc?.handle, e.link, e.views, e.likes, acc?.followers, e.avgDuration, e.reelLength, e.saves, e.shares, m.likeRate?.toFixed(4), m.viewsFollowers?.toFixed(4), m.retention?.toFixed(4), m.skipRate?.toFixed(4), m.engageScore?.toFixed(4)]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reel-tracker-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ background: "#0a0a12", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}><p style={{ fontSize: 18, opacity: 0.6 }}>Loading tracker...</p></div>;

  const s = {
    app: { background: "#0a0a12", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#e0e0e0", padding: screenshotMode ? "16px" : "0" },
    nav: { display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid #1a1a2e", padding: "0 20px", background: "#0d0d18", position: "sticky", top: 0, zIndex: 10 },
    navBtn: (active) => ({ padding: "16px 20px", background: "none", border: "none", color: active ? "#E94560" : "#666", fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", borderBottom: active ? "2px solid #E94560" : "2px solid transparent", fontFamily: "inherit", letterSpacing: "0.5px", textTransform: "uppercase" }),
    container: { maxWidth: 1200, margin: "0 auto", padding: "24px 20px" },
    card: { background: "#111122", borderRadius: 12, border: "1px solid #1a1a2e", padding: 20, marginBottom: 16 },
    input: { background: "#0a0a18", border: "1px solid #2a2a4a", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box" },
    btn: (color = "#E94560") => ({ background: color, border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.3px" }),
    btnSmall: (color = "#E94560") => ({ background: color, border: "none", borderRadius: 6, padding: "6px 12px", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }),
    label: { fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6, display: "block" },
    metric: (color) => ({ color, fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono', monospace" }),
    badge: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + "22", color, border: `1px solid ${color}44` }),
  };

  const MetricCell = ({ value, metric, label }) => {
    const color = getColor(value, metric);
    return (
      <div style={{ textAlign: "center", minWidth: 70 }}>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
        <div style={{ ...s.metric(color), background: color + "15", padding: "4px 10px", borderRadius: 6, border: `1px solid ${color}33` }}>{pct(value)}</div>
      </div>
    );
  };

  const ReelRow = ({ entry }) => {
    const acc = getAccount(entry.accountId);
    const m = calcMetrics(entry, acc);
    const isEditing = editingEntry?.id === entry.id;

    if (isEditing) {
      return (
        <div style={{ ...s.card, border: "1px solid #E94560" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              { key: "views", label: "Views" },
              { key: "likes", label: "Likes" },
              { key: "avgDuration", label: "Avg Duration (s)" },
              { key: "reelLength", label: "Reel Length (s)" },
              { key: "saves", label: "Saves" },
              { key: "shares", label: "Shares" },
            ].map(f => (
              <div key={f.key} style={{ flex: "1 1 100px" }}>
                <label style={s.label}>{f.label}</label>
                <input style={s.input} value={editingEntry[f.key]} onChange={e => setEditingEntry({ ...editingEntry, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.btnSmall("#4CAF50")} onClick={saveEdit}>Save</button>
            <button style={s.btnSmall("#666")} onClick={() => setEditingEntry(null)}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 140 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{acc?.name || "Unknown"}</div>
          <div style={{ fontSize: 12, color: "#E94560" }}>@{acc?.handle}</div>
          {entry.link && <a href={entry.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#64B5F6", textDecoration: "none" }}>View Reel ↗</a>}
        </div>
        <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ textAlign: "center", minWidth: 60 }}>
            <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Views</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{num(entry.views)}</div>
          </div>
          <div style={{ textAlign: "center", minWidth: 55 }}>
            <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Likes</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{num(entry.likes)}</div>
          </div>
          <div style={{ textAlign: "center", minWidth: 55 }}>
            <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Saves</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{num(entry.saves)}</div>
          </div>
          <div style={{ textAlign: "center", minWidth: 55 }}>
            <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Shares</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{num(entry.shares)}</div>
          </div>
          <div style={{ width: 1, background: "#2a2a4a", margin: "0 4px" }} />
          <MetricCell value={m.likeRate} metric="likeRate" label="Like %" />
          <MetricCell value={m.viewsFollowers} metric="viewsFollowers" label="Reach" />
          <MetricCell value={m.retention} metric="retention" label="Retain" />
          <MetricCell value={m.skipRate} metric="skipRate" label="Skip" />
          <MetricCell value={m.engageScore} metric="engageScore" label="Score" />
        </div>
        {!screenshotMode && (
          <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
            <button style={s.btnSmall("#333")} onClick={() => startEdit(entry)}>✏️</button>
            <button style={s.btnSmall("#331111")} onClick={() => deleteEntry(entry.id)}>🗑</button>
          </div>
        )}
      </div>
    );
  };

  // Summary stats for selected date
  const summaryStats = () => {
    if (dayEntries.length === 0) return null;
    const totalViews = dayEntries.reduce((s, e) => s + (e.views || 0), 0);
    const totalLikes = dayEntries.reduce((s, e) => s + (e.likes || 0), 0);
    const totalSaves = dayEntries.reduce((s, e) => s + (e.saves || 0), 0);
    const totalShares = dayEntries.reduce((s, e) => s + (e.shares || 0), 0);
    const avgRetention = dayEntries.reduce((s, e) => {
      const r = e.reelLength > 0 ? e.avgDuration / e.reelLength : 0;
      return s + r;
    }, 0) / dayEntries.length;

    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Views", value: num(totalViews), color: "#E94560" },
          { label: "Total Likes", value: num(totalLikes), color: "#E94560" },
          { label: "Total Saves", value: num(totalSaves), color: "#FF9800" },
          { label: "Total Shares", value: num(totalShares), color: "#64B5F6" },
          { label: "Reels Tracked", value: dayEntries.length, color: "#9C27B0" },
          { label: "Avg Retention", value: pct(avgRetention), color: getColor(avgRetention, "retention") },
        ].map((stat, i) => (
          <div key={i} style={{ background: "#111122", borderRadius: 10, padding: "14px 16px", border: "1px solid #1a1a2e", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, fontFamily: "'DM Mono', monospace" }}>{stat.value}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={s.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {!screenshotMode && (
        <nav style={s.nav}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#E94560", marginRight: 24, letterSpacing: "-0.5px" }}>📊 REEL TRACKER</div>
          {["dashboard", "add", "accounts", "history"].map(v => (
            <button key={v} style={s.navBtn(view === v)} onClick={() => setView(v)}>
              {v === "dashboard" ? "Today" : v === "add" ? "＋ Add Reel" : v === "accounts" ? "Accounts" : "History"}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button style={{ ...s.btnSmall("#1a1a2e"), marginRight: 8, border: "1px solid #2a2a4a" }} onClick={exportCSV}>📥 CSV</button>
          <button style={s.btnSmall(screenshotMode ? "#4CAF50" : "#E94560")} onClick={() => setScreenshotMode(!screenshotMode)}>
            {screenshotMode ? "Exit Screenshot" : "📸 Screenshot Mode"}
          </button>
        </nav>
      )}

      {screenshotMode && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#E94560" }}>📊 DAILY REEL REPORT</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{selectedDate} • GrowthSchool</div>
          </div>
          <button style={s.btn("#333")} onClick={() => setScreenshotMode(false)}>✕ Exit</button>
        </div>
      )}

      <div style={s.container} ref={dashRef}>

        {/* ===== DASHBOARD ===== */}
        {(view === "dashboard" || screenshotMode) && (
          <>
            {!screenshotMode && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>Today's Performance</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>{selectedDate}</p>
                </div>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...s.input, width: "auto" }} />
              </div>
            )}

            {summaryStats()}

            {dayEntries.length === 0 ? (
              <div style={{ ...s.card, textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 16, color: "#666", marginBottom: 8 }}>No reels tracked for {selectedDate}</div>
                {!screenshotMode && <button style={s.btn()} onClick={() => setView("add")}>＋ Add First Reel</button>}
              </div>
            ) : (
              <div>
                {/* Group by account */}
                {data.accounts.filter(acc => dayEntries.some(e => e.accountId === acc.id)).map(acc => (
                  <div key={acc.id} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 0", borderBottom: "1px solid #1a1a2e" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E94560", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                        {acc.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{acc.name}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>@{acc.handle} • {num(acc.followers)} followers</div>
                      </div>
                    </div>
                    {dayEntries.filter(e => e.accountId === acc.id).map(entry => (
                      <ReelRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Benchmarks legend */}
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
              <span style={s.badge("#4CAF50")}>🟢 Crushing it</span>
              <span style={s.badge("#FF9800")}>🟡 Average</span>
              <span style={s.badge("#F44336")}>🔴 Needs work</span>
            </div>
          </>
        )}

        {/* ===== ADD ENTRY ===== */}
        {view === "add" && !screenshotMode && (
          <div>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#fff" }}>Add Reel Entry</h2>
            {data.accounts.length === 0 ? (
              <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
                <div style={{ color: "#888", marginBottom: 12 }}>Add an account first</div>
                <button style={s.btn()} onClick={() => setView("accounts")}>Go to Accounts</button>
              </div>
            ) : (
              <div style={s.card}>
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={s.label}>Account</label>
                    <select style={{ ...s.input, cursor: "pointer" }} value={entryForm.accountIdx} onChange={e => setEntryForm({ ...entryForm, accountIdx: parseInt(e.target.value) })}>
                      {data.accounts.map((a, i) => <option key={a.id} value={i} style={{ background: "#111" }}>{a.name} (@{a.handle})</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={s.label}>Date</label>
                    <input type="date" style={s.input} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Reel Link</label>
                  <input style={s.input} placeholder="https://instagram.com/reel/..." value={entryForm.link} onChange={e => setEntryForm({ ...entryForm, link: e.target.value })} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                  {[
                    { key: "views", label: "Views", placeholder: "e.g. 50000", icon: "👁" },
                    { key: "likes", label: "Likes", placeholder: "e.g. 3500", icon: "❤️" },
                    { key: "avgDuration", label: "Avg View Duration (s)", placeholder: "e.g. 12", icon: "⏱" },
                    { key: "reelLength", label: "Reel Length (s)", placeholder: "e.g. 30", icon: "🎬" },
                    { key: "saves", label: "Saves", placeholder: "e.g. 800", icon: "🔖" },
                    { key: "shares", label: "Shares", placeholder: "e.g. 450", icon: "📤" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={s.label}>{f.icon} {f.label}</label>
                      <input style={s.input} placeholder={f.placeholder} type="number" value={entryForm[f.key]} onChange={e => setEntryForm({ ...entryForm, [f.key]: e.target.value })} />
                    </div>
                  ))}
                </div>

                {/* Live preview */}
                {entryForm.views && (
                  <div style={{ background: "#0a0a18", borderRadius: 8, padding: 14, marginBottom: 16, border: "1px solid #1a1a2e" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase" }}>Live Preview</div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
                      {(() => {
                        const v = parseInt(entryForm.views) || 0;
                        const l = parseInt(entryForm.likes) || 0;
                        const acc = data.accounts[entryForm.accountIdx];
                        const f = acc?.followers || 0;
                        const ad = parseFloat(entryForm.avgDuration) || 0;
                        const rl = parseFloat(entryForm.reelLength) || 0;
                        const sv = parseInt(entryForm.saves) || 0;
                        const sh = parseInt(entryForm.shares) || 0;
                        const lr = v > 0 ? l / v : null;
                        const vf = f > 0 ? v / f : null;
                        const ret = rl > 0 ? ad / rl : null;
                        const skip = ret != null ? 1 - ret : null;
                        const eng = v > 0 ? (l + sv * 2 + sh * 3) / v : null;
                        return (
                          <>
                            <MetricCell value={lr} metric="likeRate" label="Like %" />
                            <MetricCell value={vf} metric="viewsFollowers" label="Reach" />
                            <MetricCell value={ret} metric="retention" label="Retain" />
                            <MetricCell value={skip} metric="skipRate" label="Skip" />
                            <MetricCell value={eng} metric="engageScore" label="Score" />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <button style={{ ...s.btn(), width: "100%", padding: "14px 20px", fontSize: 15 }} onClick={addEntry}>
                  ＋ Add Reel Entry
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== ACCOUNTS ===== */}
        {view === "accounts" && !screenshotMode && (
          <div>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#fff" }}>Manage Accounts</h2>

            <div style={{ ...s.card, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E94560", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>＋ Add New Account</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={s.label}>Display Name</label>
                  <input style={s.input} placeholder="GrowthSchool" value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Instagram Handle</label>
                  <input style={s.input} placeholder="@growthschool" value={newAccount.handle} onChange={e => setNewAccount({ ...newAccount, handle: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Current Followers</label>
                  <input style={s.input} placeholder="200000" type="number" value={newAccount.followers} onChange={e => setNewAccount({ ...newAccount, followers: e.target.value })} />
                </div>
              </div>
              <button style={s.btn()} onClick={addAccount}>Add Account</button>
            </div>

            {data.accounts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#666" }}>No accounts yet. Add your first one above.</div>
            ) : (
              data.accounts.map(acc => (
                <div key={acc.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E94560", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {acc.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{acc.name}</div>
                    <div style={{ fontSize: 12, color: "#E94560" }}>@{acc.handle}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ ...s.label, margin: 0, fontSize: 10 }}>Followers</label>
                    <input
                      style={{ ...s.input, width: 110, textAlign: "right" }}
                      type="number"
                      value={acc.followers}
                      onChange={e => updateFollowers(acc.id, e.target.value)}
                    />
                  </div>
                  <button style={s.btnSmall("#331111")} onClick={() => removeAccount(acc.id)}>🗑 Remove</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ===== HISTORY ===== */}
        {view === "history" && !screenshotMode && (
          <div>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#fff" }}>History</h2>
            {allDates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#666" }}>No entries yet.</div>
            ) : (
              allDates.map(date => {
                const entries = data.entries.filter(e => e.date === date);
                return (
                  <div key={date} style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }} onClick={() => { setSelectedDate(date); setView("dashboard"); }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#E94560" }}>{date}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{entries.length} reel{entries.length !== 1 ? "s" : ""}</div>
                      <div style={{ flex: 1, height: 1, background: "#1a1a2e" }} />
                      <span style={{ fontSize: 11, color: "#64B5F6" }}>View →</span>
                    </div>
                    {entries.map(entry => {
                      const acc = getAccount(entry.accountId);
                      const m = calcMetrics(entry, acc);
                      return (
                        <div key={entry.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 12px", background: "#111122", borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: "#fff", minWidth: 100 }}>{acc?.name}</span>
                          <span style={{ color: "#888" }}>{num(entry.views)} views</span>
                          <span style={{ color: getColor(m.likeRate, "likeRate") }}>{pct(m.likeRate)} like</span>
                          <span style={{ color: getColor(m.retention, "retention") }}>{pct(m.retention)} retain</span>
                          <span style={{ color: getColor(m.engageScore, "engageScore") }}>{pct(m.engageScore)} score</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
