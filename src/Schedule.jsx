import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const PLATFORMS = {
  meet:  { label: "Meet",  color: "#0C447C", bg: "#E6F1FB" },
  zoom:  { label: "Zoom",  color: "#3C3489", bg: "#EEEDFE" },
  teams: { label: "Teams", color: "#712B13", bg: "#FAECE7" },
};

const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getWeekDates(offset = 0) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const emptyForm = { student: "", subject: "", date: "", time: "", duration: 60, platform: "meet", link: "" };

export default function Schedule() {
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [weekOffset, setWeek]   = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => { fetchClasses(); }, []);

  async function fetchClasses() {
    setLoading(true);
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    if (error) setError("Could not load classes: " + error.message);
    else setClasses(data || []);
    setLoading(false);
  }

  async function saveClass() {
    if (!form.student || !form.date || !form.time || !form.link) {
      setError("Please fill in student name, date, time and meeting link.");
      return;
    }
    setError("");
    setSaving(true);
    if (editId) {
      const { error } = await supabase
        .from("classes")
        .update({ ...form, duration: Number(form.duration) })
        .eq("id", editId);
      if (error) setError("Could not update: " + error.message);
    } else {
      const { error } = await supabase
        .from("classes")
        .insert([{ ...form, duration: Number(form.duration) }]);
      if (error) setError("Could not save: " + error.message);
    }
    setSaving(false);
    setShowForm(false);
    fetchClasses();
  }

  async function deleteClass(id) {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) setError("Could not delete: " + error.message);
    else fetchClasses();
  }

  function handleField(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(cls) {
    setForm({ student: cls.student, subject: cls.subject || "", date: cls.date, time: cls.time.slice(0,5), duration: cls.duration, platform: cls.platform, link: cls.link || "" });
    setEditId(cls.id);
    setError("");
    setShowForm(true);
  }

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd   = weekDates[6];

  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${DAYS[weekStart.getDay()].slice(0,3)} ${weekStart.getDate()} – ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()} ${weekEnd.getFullYear()}`;

  const classesThisWeek = weekDates
    .map(date => {
      const iso = date.toISOString().split("T")[0];
      const dayClasses = classes.filter(c => c.date === iso).sort((a,b) => a.time.localeCompare(b.time));
      return { date, iso, dayClasses };
    })
    .filter(d => d.dayClasses.length > 0);

  const s = {
    wrap:     { fontFamily: "var(--font-sans)", padding: "0 0 1.5rem" },
    header:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" },
    navBtn:   { background: "transparent", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: "14px" },
    weekLbl:  { fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)", minWidth: "240px", textAlign: "center" },
    addBtn:   { display: "flex", alignItems: "center", gap: "6px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", color: "var(--color-text-primary)", fontSize: "13px", fontWeight: 500 },
    dayHdr:   { fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 8px" },
    card:     { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" },
    timeCol:  { minWidth: "68px" },
    timeMain: { fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 },
    timeDur:  { fontSize: "12px", color: "var(--color-text-secondary)", margin: "2px 0 0" },
    divider:  { width: "1px", alignSelf: "stretch", background: "var(--color-border-tertiary)" },
    infoCol:  { flex: 1, minWidth: 0 },
    student:  { fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 },
    subject:  { fontSize: "12px", color: "var(--color-text-secondary)", margin: "3px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    iconBtn:  { background: "transparent", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: "13px" },
    joinBtn:  { display: "flex", alignItems: "center", gap: "5px", background: "transparent", border: "0.5px solid var(--color-border-secondary)", borderRadius: "6px", padding: "5px 12px", cursor: "pointer", color: "var(--color-text-primary)", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap" },
    modal:    { minHeight: "420px", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", margin: "1rem 0" },
    modalBox: { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "12px", padding: "20px 24px", width: "100%", maxWidth: "420px" },
    label:    { fontSize: "12px", color: "var(--color-text-secondary)", display: "block", marginBottom: "4px", marginTop: "12px" },
    input:    { width: "100%", boxSizing: "border-box" },
    row2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
    formBtns: { display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" },
    cancelBtn:{ background: "transparent", border: "0.5px solid var(--color-border-secondary)", borderRadius: "8px", padding: "7px 16px", cursor: "pointer", fontSize: "13px", color: "var(--color-text-secondary)" },
    saveBtn:  { background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "8px", padding: "7px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)" },
    addDash:  { width: "100%", padding: "10px", border: "0.5px dashed var(--color-border-secondary)", borderRadius: "12px", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "8px" },
    errBox:   { fontSize: "13px", color: "var(--color-text-danger)", background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "8px", padding: "8px 12px", marginTop: "10px" },
    empty:    { textAlign: "center", padding: "2.5rem 0", color: "var(--color-text-secondary)", fontSize: "14px" },
  };

  const Badge = ({ platform }) => {
    const p = PLATFORMS[platform] || PLATFORMS.meet;
    return (
      <span style={{ fontSize: "11px", fontWeight: 500, padding: "3px 8px", borderRadius: "20px", background: p.bg, color: p.color, whiteSpace: "nowrap" }}>
        {p.label}
      </span>
    );
  };

  if (loading) return <div style={s.empty}>Loading your classes...</div>;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button style={s.navBtn} onClick={() => setWeek(w => w - 1)}>&#8592;</button>
          <span style={s.weekLbl}>{weekLabel}</span>
          <button style={s.navBtn} onClick={() => setWeek(w => w + 1)}>&#8594;</button>
        </div>
        <button style={s.addBtn} onClick={openAdd}>+ Add class</button>
      </div>

      {showForm && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: "15px", color: "var(--color-text-primary)" }}>
              {editId ? "Edit class" : "Add new class"}
            </p>

            <label style={s.label}>Student name</label>
            <input style={s.input} name="student" value={form.student} onChange={handleField} placeholder="e.g. Priya Sharma" />

            <label style={s.label}>Subject &amp; grade</label>
            <input style={s.input} name="subject" value={form.subject} onChange={handleField} placeholder="e.g. Grade 11 · Trig Functions" />

            <div style={s.row2}>
              <div>
                <label style={s.label}>Date</label>
                <input style={s.input} type="date" name="date" value={form.date} onChange={handleField} />
              </div>
              <div>
                <label style={s.label}>Time</label>
                <input style={s.input} type="time" name="time" value={form.time} onChange={handleField} />
              </div>
            </div>

            <div style={s.row2}>
              <div>
                <label style={s.label}>Duration (min)</label>
                <input style={s.input} type="number" name="duration" value={form.duration} onChange={handleField} min="15" step="15" />
              </div>
              <div>
                <label style={s.label}>Platform</label>
                <select style={s.input} name="platform" value={form.platform} onChange={handleField}>
                  <option value="meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">MS Teams</option>
                </select>
              </div>
            </div>

            <label style={s.label}>Meeting link</label>
            <input style={s.input} name="link" value={form.link} onChange={handleField} placeholder="Paste your Meet / Zoom / Teams link" />

            {error && <div style={s.errBox}>{error}</div>}

            <div style={s.formBtns}>
              <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={saveClass} disabled={saving}>
                {saving ? "Saving..." : "Save class"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showForm && error && <div style={s.errBox}>{error}</div>}

      {classesThisWeek.length === 0 && !showForm && (
        <div style={s.empty}>No classes this week. Click "Add class" to get started.</div>
      )}

      {classesThisWeek.map(({ date, dayClasses }) => (
        <div key={date.toISOString()}>
          <p style={s.dayHdr}>{DAYS[date.getDay()]}, {MONTHS[date.getMonth()]} {date.getDate()}</p>
          {dayClasses.map(cls => (
            <div key={cls.id} style={s.card}>
              <div style={s.timeCol}>
                <p style={s.timeMain}>{formatTime(cls.time)}</p>
                <p style={s.timeDur}>{cls.duration} min</p>
              </div>
              <div style={s.divider} />
              <div style={s.infoCol}>
                <p style={s.student}>{cls.student}</p>
                <p style={s.subject}>{cls.subject}</p>
              </div>
              <Badge platform={cls.platform} />
              <button style={s.iconBtn} onClick={() => openEdit(cls)} title="Edit">&#9998;</button>
              <button style={s.iconBtn} onClick={() => deleteClass(cls.id)} title="Delete">&#x2715;</button>
              <button style={s.joinBtn} onClick={() => window.open(cls.link, "_blank")}>
                &#x2197; Join
              </button>
            </div>
          ))}
        </div>
      ))}

      {!showForm && (
        <button style={s.addDash} onClick={openAdd}>+ Add another class</button>
      )}
    </div>
  );
}