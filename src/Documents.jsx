import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const CATEGORIES = ["Homework", "Test paper", "Notes"];

const CATEGORY_STYLE = {
  "Homework":   { bg: "#E1F5EE", color: "#085041" },
  "Test paper": { bg: "#EEEDFE", color: "#3C3489" },
  "Notes":      { bg: "#FAEEDA", color: "#633806" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(str) {
  const d = new Date(str);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function Documents() {
  const [docs, setDocs]             = useState([]);
  const [students, setStudents]     = useState([]);
  const [filterStudent, setFilter]  = useState("All students");
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState("");
  const [category, setCategory]     = useState("Homework");
  const [selStudent, setSelStudent] = useState("");
  const fileRef = useRef();

  useEffect(() => { fetchDocs(); fetchStudents(); }, []);

  async function fetchStudents() {
    const { data } = await supabase.from("classes").select("student").order("student");
    if (data) setStudents([...new Set(data.map(r => r.student))]);
  }

  async function fetchDocs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (error) setError("Could not load documents: " + error.message);
    else setDocs(data || []);
    setLoading(false);
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!selStudent) { setError("Please select a student before uploading."); return; }
    setError("");
    setUploading(true);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${selStudent}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (upErr) { setError("Upload failed: " + upErr.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);

    const { error: dbErr } = await supabase.from("documents").insert([{
      student: selStudent,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_path: filePath,
      category,
    }]);

    if (dbErr) setError("Could not save record: " + dbErr.message);
    else { fetchDocs(); fileRef.current.value = ""; }
    setUploading(false);
  }

  async function handleDelete(doc) {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    fetchDocs();
  }

  const filtered = filterStudent === "All students"
    ? docs
    : docs.filter(d => d.student === filterStudent);

  const s = {
    wrap:     { fontFamily: "var(--font-sans)", padding: "0 0 1.5rem" },
    header:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" },
    title:    { fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 },
    tabRow:   { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" },
    tab:      { padding: "6px 14px", borderRadius: "20px", fontSize: "13px", cursor: "pointer", border: "0.5px solid var(--color-border-tertiary)", background: "transparent", color: "var(--color-text-secondary)" },
    tabActive:{ padding: "6px 14px", borderRadius: "20px", fontSize: "13px", cursor: "pointer", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontWeight: 500 },
    uploadBox:{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "12px", padding: "16px", marginBottom: "16px" },
    row2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" },
    label:    { fontSize: "12px", color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" },
    input:    { width: "100%", boxSizing: "border-box" },
    dropZone: { border: "0.5px dashed var(--color-border-secondary)", borderRadius: "10px", padding: "20px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px", cursor: "pointer" },
    card:     { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" },
    docIcon:  { width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 },
    docInfo:  { flex: 1, minWidth: 0 },
    docName:  { fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    docMeta:  { fontSize: "12px", color: "var(--color-text-secondary)", margin: 0 },
    iconBtn:  { background: "transparent", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: "13px", flexShrink: 0 },
    secHdr:   { fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" },
    errBox:   { fontSize: "13px", color: "var(--color-text-danger)", background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "8px", padding: "8px 12px", marginBottom: "10px" },
    empty:    { textAlign: "center", padding: "2rem 0", color: "var(--color-text-secondary)", fontSize: "14px" },
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <p style={s.title}>Documents</p>
      </div>

      <div style={s.tabRow}>
        {["All students", ...students].map(st => (
          <button key={st} style={filterStudent === st ? s.tabActive : s.tab} onClick={() => setFilter(st)}>{st}</button>
        ))}
      </div>

      {error && <div style={s.errBox}>{error}</div>}

      <div style={s.uploadBox}>
        <div style={s.row2}>
          <div>
            <label style={s.label}>Student</label>
            <select style={s.input} value={selStudent} onChange={e => setSelStudent(e.target.value)}>
              <option value="">Select student...</option>
              {students.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Category</label>
            <select style={s.input} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={s.dropZone} onClick={() => fileRef.current.click()}>
          <i className="ti ti-upload" style={{ fontSize: "22px", display: "block", marginBottom: "6px" }}></i>
          {uploading ? "Uploading..." : "Click to upload a file (PDF, Word, image)"}
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleUpload} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
        </div>
      </div>

      <p style={s.secHdr}>
        {filterStudent === "All students" ? "All documents" : `${filterStudent}'s documents`} ({filtered.length})
      </p>

      {loading && <div style={s.empty}>Loading documents...</div>}

      {!loading && filtered.length === 0 && (
        <div style={s.empty}>No documents yet. Upload one above.</div>
      )}

      {filtered.map(doc => {
        const cat = CATEGORY_STYLE[doc.category] || CATEGORY_STYLE["Homework"];
        return (
          <div key={doc.id} style={s.card}>
            <div style={{ ...s.docIcon, background: cat.bg }}>&#128196;</div>
            <div style={s.docInfo}>
              <p style={s.docName}>{doc.file_name}</p>
              <p style={s.docMeta}>{doc.student} · {formatDate(doc.uploaded_at)}</p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 500, padding: "3px 8px", borderRadius: "20px", background: cat.bg, color: cat.color, whiteSpace: "nowrap" }}>
              {doc.category}
            </span>
            <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <button style={s.iconBtn} title="Download">
                <i className="ti ti-download" style={{ fontSize: "14px" }}></i>
              </button>
            </a>
            <button style={s.iconBtn} title="Delete" onClick={() => handleDelete(doc)}>
              <i className="ti ti-trash" style={{ fontSize: "14px" }}></i>
            </button>
          </div>
        );
      })}
    </div>
  );
}
