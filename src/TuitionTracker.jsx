import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAYS_JS    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MON  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const PLATFORM_COLORS = {
  meet:  { bg:"#E8F5E9", color:"#2E7D32", label:"Google Meet" },
  zoom:  { bg:"#EDE7F6", color:"#4527A0", label:"Zoom" },
  teams: { bg:"#E3F2FD", color:"#1565C0", label:"MS Teams" },
};

const STATUS_CONFIG = {
  scheduled:   { bg:"#FFF8E1", color:"#F57F17", border:"#FFE082", label:"Scheduled",   emoji:"⏳" },
  conducted:   { bg:"#E8F5E9", color:"#2E7D32", border:"#A5D6A7", label:"Conducted",   emoji:"✅" },
  cancelled:   { bg:"#FFEBEE", color:"#C62828", border:"#EF9A9A", label:"Cancelled",   emoji:"❌" },
  rescheduled: { bg:"#E3F2FD", color:"#1565C0", border:"#90CAF9", label:"Rescheduled", emoji:"🔄" },
  unplanned:   { bg:"#F3E5F5", color:"#6A1B9A", border:"#CE93D8", label:"Unplanned",   emoji:"⚡" },
};

const STUDENT_COLORS = [
  { card:"linear-gradient(135deg,#667eea,#764ba2)", accent:"#667eea", light:"#EDE7F6" },
  { card:"linear-gradient(135deg,#f093fb,#f5576c)", accent:"#f5576c", light:"#FCE4EC" },
  { card:"linear-gradient(135deg,#4facfe,#00f2fe)", accent:"#4facfe", light:"#E3F2FD" },
  { card:"linear-gradient(135deg,#43e97b,#38f9d7)", accent:"#43e97b", light:"#E8F5E9" },
  { card:"linear-gradient(135deg,#fa709a,#fee140)", accent:"#fa709a", light:"#FFF8E1" },
  { card:"linear-gradient(135deg,#a18cd1,#fbc2eb)", accent:"#a18cd1", light:"#F3E5F5" },
  { card:"linear-gradient(135deg,#fda085,#f6d365)", accent:"#fda085", light:"#FBE9E7" },
  { card:"linear-gradient(135deg,#a1c4fd,#c2e9fb)", accent:"#a1c4fd", light:"#E1F5FE" },
];

const RECUR_OPTIONS = [
  { value:"none",     label:"No recurrence" },
  { value:"daily",    label:"Every day" },
  { value:"weekly",   label:"Every week (same day)" },
  { value:"weekdays", label:"Every weekday (Mon–Fri)" },
  { value:"custom",   label:"Custom days of week" },
];

function getWeekDates(offset=0){
  const today=new Date(),day=today.getDay(),monday=new Date(today);
  monday.setDate(today.getDate()-(day===0?6:day-1)+offset*7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d; });
}
function toISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function formatTime(t){ if(!t) return ""; const[h,m]=t.split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")}${h>=12?"pm":"am"}`; }

function generateRecurDates(startISO,recur,customDays,untilISO){
  if(recur==="none"||!untilISO) return [startISO];
  const dates=[],dayMap=[6,0,1,2,3,4,5];
  let cur=new Date(startISO+"T00:00:00");
  const until=new Date(untilISO+"T00:00:00"),startDay=cur.getDay();
  while(cur<=until){
    const iso=toISO(cur),jsDay=cur.getDay(),wdIdx=dayMap[jsDay];
    if(recur==="daily") dates.push(iso);
    else if(recur==="weekly"&&jsDay===startDay) dates.push(iso);
    else if(recur==="weekdays"&&jsDay>=1&&jsDay<=5) dates.push(iso);
    else if(recur==="custom"&&customDays.includes(wdIdx)) dates.push(iso);
    cur.setDate(cur.getDate()+1);
  }
  return dates.length?dates:[startISO];
}

// Map app fields to Supabase columns
function toRow(c){
  return {
    id: c.id,
    student: c.student,
    subject: c.subject||"",
    date: c.date||null,
    time: c.time||null,
    duration: Number(c.duration)||60,
    platform: c.platform||"meet",
    link: c.link||"",
    whatsapp: c.whatsapp||"",
    whiteboard: c.whiteboard||"",
    rate: Number(c.rate)||500,
    status: c.status||"scheduled",
    is_paid: !!c.isPaid,
    notes: c.notes||"",
    fee_mode: c.feeMode||"monthly",
    joined_via_app: !!c.joinedViaApp,
  };
}

function fromRow(r){
  return {
    id: r.id,
    student: r.student,
    subject: r.subject||"",
    date: r.date||"",
    time: r.time?r.time.slice(0,5):"",
    duration: r.duration||60,
    platform: r.platform||"meet",
    link: r.link||"",
    whatsapp: r.whatsapp||"",
    whiteboard: r.whiteboard||"",
    rate: r.rate||500,
    status: r.status||"scheduled",
    isPaid: r.is_paid||false,
    notes: r.notes||"",
    feeMode: r.fee_mode||"monthly",
    joinedViaApp: r.joined_via_app||false,
  };
}

const emptyForm={
  student:"",subject:"",date:"",time:"",duration:60,
  platform:"meet",link:"",whatsapp:"",whiteboard:"",
  rate:500,status:"scheduled",isPaid:false,notes:"",
  recur:"none",recurUntil:"",customDays:[],feeMode:"monthly",joinedViaApp:false,
};

export default function TuitionTracker(){
  const [classes,     setClasses]     = useState([]);
  const [weekOff,     setWeek]        = useState(0);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(emptyForm);
  const [editId,      setEditId]      = useState(null);
  const [mainTab,     setMainTab]     = useState("schedule");
  const [stuTab,      setStuTab]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState(null);
  const [showSummary, setShowSummary] = useState(null);
  const reminderRef = useRef({});

  // ── Fetch from Supabase ──
  async function fetchClasses(){
    setLoading(true);
    const{data,error}=await supabase.from("tuition_classes").select("*").order("date",{ascending:true}).order("time",{ascending:true,nullsFirst:false});
    if(error){ showToast("❌ Could not load: "+error.message); }
    else setClasses((data||[]).map(fromRow));
    setLoading(false);
  }

  useEffect(()=>{ fetchClasses(); },[]);

  // Auto-fill from past classes
  useEffect(()=>{
    if(form.student&&!editId){
      const m=[...classes].reverse().find(c=>c.student.trim().toLowerCase()===form.student.trim().toLowerCase());
      if(m) setForm(f=>({...f,link:f.link||m.link||"",whatsapp:f.whatsapp||m.whatsapp||"",whiteboard:f.whiteboard||m.whiteboard||"",rate:f.rate===500?(m.rate||500):f.rate,feeMode:m.feeMode||f.feeMode}));
    }
  },[form.student]);

  // 15-min reminders
  useEffect(()=>{
    if(!("Notification" in window)) return;
    if(Notification.permission==="default") Notification.requestPermission();
    Object.values(reminderRef.current).forEach(clearTimeout);
    reminderRef.current={};
    const now=Date.now();
    classes.filter(c=>c.status==="scheduled"&&c.date&&c.time).forEach(c=>{
      const classTime=new Date(c.date+"T"+c.time).getTime();
      const reminderTime=classTime-15*60*1000;
      if(reminderTime>now){
        reminderRef.current[c.id]=setTimeout(()=>{
          if(Notification.permission==="granted") new Notification("📚 Class in 15 minutes!",{body:`${c.student} — ${c.subject||"Class"} at ${formatTime(c.time)}`});
          showToast(`⏰ ${c.student}'s class in 15 min!`);
        },reminderTime-now);
      }
    });
    return()=>Object.values(reminderRef.current).forEach(clearTimeout);
  },[classes]);

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(null),4000); }

  const weekDates=getWeekDates(weekOff),weekISOs=weekDates.map(toISO),today=toISO(new Date());
  const weekLabel=`${SHORT_MON[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${SHORT_MON[weekDates[6].getMonth()]} ${weekDates[6].getDate()}, ${weekDates[6].getFullYear()}`;
  const studentNames=[...new Set(classes.map(c=>c.student.trim()).filter(Boolean))].sort();

  useEffect(()=>{ if(mainTab==="students"&&!stuTab&&studentNames.length>0) setStuTab(studentNames[0]); },[mainTab,studentNames.length]);

  function sc(name){ return STUDENT_COLORS[studentNames.indexOf(name)%STUDENT_COLORS.length]; }

  function studentStats(name){
    const s=classes.filter(c=>c.student.trim()===name);
    const conducted=s.filter(c=>c.joinedViaApp);
    return{
      scheduled:  s.filter(c=>c.status==="scheduled").length,
      conducted:  conducted.length,
      cancelled:  s.filter(c=>c.status==="cancelled").length,
      rescheduled:s.filter(c=>c.status==="rescheduled").length,
      unplanned:  s.filter(c=>c.status==="unplanned").length,
      earned:  conducted.filter(c=>c.isPaid).reduce((t,c)=>t+(c.duration/60)*(c.rate||0),0),
      pending: conducted.filter(c=>!c.isPaid).reduce((t,c)=>t+(c.duration/60)*(c.rate||0),0),
      link:[...s].reverse().find(c=>c.link)?.link||"",
      whatsapp:[...s].reverse().find(c=>c.whatsapp)?.whatsapp||"",
      whiteboard:[...s].reverse().find(c=>c.whiteboard)?.whiteboard||"",
      feeMode:[...s].reverse().find(c=>c.feeMode)?.feeMode||"monthly",
    };
  }

  function payLedger(name){
    const fm=studentStats(name).feeMode;
    const s=classes.filter(c=>c.student.trim()===name&&c.joinedViaApp);
    const ledger={};
    s.forEach(c=>{
      const d=new Date(c.date+"T00:00:00");
      const key=fm==="monthly"
        ?`${MONTHS[d.getMonth()]} ${d.getFullYear()}`
        :(()=>{ const mon=new Date(d),dy=d.getDay(); mon.setDate(d.getDate()-(dy===0?6:dy-1)); return `Week of ${SHORT_MON[mon.getMonth()]} ${mon.getDate()}`; })();
      const cost=(c.duration/60)*(c.rate||0);
      if(!ledger[key]) ledger[key]={paid:0,pending:0,count:0,pendingIds:[],total:0};
      ledger[key].count++; ledger[key].total+=cost;
      if(c.isPaid) ledger[key].paid+=cost;
      else{ ledger[key].pending+=cost; ledger[key].pendingIds.push(c.id); }
    });
    return{fm,ledger};
  }

  function monthlySummary(name,month,year){
    const s=classes.filter(c=>{ if(c.student.trim()!==name) return false; const d=new Date(c.date+"T00:00:00"); return d.getMonth()===month&&d.getFullYear()===year; });
    const conducted=s.filter(c=>c.joinedViaApp);
    return{ total:s.length, conducted:conducted.length, cancelled:s.filter(c=>c.status==="cancelled").length, earned:conducted.filter(c=>c.isPaid).reduce((t,c)=>t+(c.duration/60)*(c.rate||0),0), pending:conducted.filter(c=>!c.isPaid).reduce((t,c)=>t+(c.duration/60)*(c.rate||0),0) };
  }

  function overallMonthlyTotals(){
    const totals={};
    classes.filter(c=>c.joinedViaApp).forEach(c=>{
      const d=new Date(c.date+"T00:00:00");
      const key=`${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      const cost=(c.duration/60)*(c.rate||0);
      if(!totals[key]) totals[key]={earned:0,pending:0,count:0};
      totals[key].count++;
      if(c.isPaid) totals[key].earned+=cost; else totals[key].pending+=cost;
    });
    return totals;
  }

  async function joinClass(cls){
    if(!cls.link){ showToast("No meeting link saved!"); return; }
    const{error}=await supabase.from("tuition_classes").update({joined_via_app:true,status:"conducted"}).eq("id",cls.id);
    if(error){ showToast("❌ "+error.message); return; }
    setClasses(cs=>cs.map(c=>c.id===cls.id?{...c,joinedViaApp:true,status:"conducted"}:c));
    window.open(cls.link,"_blank");
    showToast("✅ Joined — marked as conducted!");
  }

  async function saveClass(){
    if(!form.student||!form.date){ showToast("Please fill student name and date!"); return; }
    setSaving(true);
    if(editId){
      const{error}=await supabase.from("tuition_classes").update(toRow({...form,id:editId})).eq("id",editId);
      if(error){ showToast("❌ "+error.message); setSaving(false); return; }
      setClasses(cs=>cs.map(c=>c.id===editId?{...form,id:editId}:c));
    } else {
      const dates=generateRecurDates(form.date,form.recur,form.customDays,form.recurUntil);
      const rows=dates.map((date,i)=>toRow({...form,date,id:Date.now()+i,recur:"none",recurUntil:"",customDays:[]}));
      const{error}=await supabase.from("tuition_classes").insert(rows);
      if(error){ showToast("❌ "+error.message); setSaving(false); return; }
      await fetchClasses();
    }
    setSaving(false); setShowForm(false); setEditId(null); setForm(emptyForm);
    showToast("✅ Saved!");
  }

  async function delClass(id){
    if(!window.confirm("Delete this class?")) return;
    await supabase.from("tuition_classes").delete().eq("id",id);
    setClasses(cs=>cs.filter(c=>c.id!==id));
  }

  async function cycleStatus(id){
    const order=["scheduled","conducted","cancelled","rescheduled","unplanned"];
    const cls=classes.find(c=>c.id===id); if(!cls) return;
    const next=order[(order.indexOf(cls.status)+1)%order.length];
    await supabase.from("tuition_classes").update({status:next}).eq("id",id);
    setClasses(cs=>cs.map(c=>c.id===id?{...c,status:next}:c));
  }

  async function togglePaid(id){
    const cls=classes.find(c=>c.id===id); if(!cls) return;
    await supabase.from("tuition_classes").update({is_paid:!cls.isPaid}).eq("id",id);
    setClasses(cs=>cs.map(c=>c.id===id?{...c,isPaid:!c.isPaid}:c));
  }

  async function markPeriodPaid(ids){
    await supabase.from("tuition_classes").update({is_paid:true}).in("id",ids);
    setClasses(cs=>cs.map(c=>ids.includes(c.id)?{...c,isPaid:true}:c));
    showToast("✅ Payment collected!");
  }

  async function setFeeMode(name,mode){
    const ids=classes.filter(c=>c.student.trim()===name).map(c=>c.id);
    await supabase.from("tuition_classes").update({fee_mode:mode}).in("id",ids);
    setClasses(cs=>cs.map(c=>c.student.trim()===name?{...c,feeMode:mode}:c));
  }

  // Bug fix 2: preserve exact time when editing — don't merge with emptyForm defaults
  function openEdit(cls){
    setForm({
      student:      cls.student||"",
      subject:      cls.subject||"",
      date:         cls.date||"",
      time:         cls.time||"",   // ← keep original time exactly
      duration:     cls.duration||60,
      platform:     cls.platform||"meet",
      link:         cls.link||"",
      whatsapp:     cls.whatsapp||"",
      whiteboard:   cls.whiteboard||"",
      rate:         cls.rate||500,
      status:       cls.status||"scheduled",
      isPaid:       cls.isPaid||false,
      notes:        cls.notes||"",
      feeMode:      cls.feeMode||"monthly",
      joinedViaApp: cls.joinedViaApp||false,
      recur:"none", recurUntil:"", customDays:[],
    });
    setEditId(cls.id);
    setShowForm(true);
  }

  function handleField(e){ const{name,value,type,checked}=e.target; setForm(f=>({...f,[name]:type==="checkbox"?checked:value})); }
  function toggleCustomDay(i){ setForm(f=>({...f,customDays:f.customDays.includes(i)?f.customDays.filter(d=>d!==i):[...f.customDays,i]})); }
  const recurCount=(!editId&&form.recur!=="none"&&form.recurUntil&&form.date)?generateRecurDates(form.date,form.recur,form.customDays,form.recurUntil).length:0;

  // Bug fix 3: Bulk edit/reset all future classes for a student
  const [showBulkEdit, setShowBulkEdit] = useState(null); // student name
  const [bulkForm, setBulkForm] = useState({ time:"", duration:60, rate:500, platform:"meet", link:"", whatsapp:"", whiteboard:"", applyFrom: toISO(new Date()) });

  async function applyBulkEdit(name){
    const futureCls = classes.filter(c=>c.student.trim()===name && c.date>=bulkForm.applyFrom);
    const ids = futureCls.map(c=>c.id);
    if(!ids.length){ showToast("No future classes found!"); return; }
    const updates = {};
    if(bulkForm.time)       updates.time      = bulkForm.time;
    if(bulkForm.duration)   updates.duration  = Number(bulkForm.duration);
    if(bulkForm.rate)       updates.rate      = Number(bulkForm.rate);
    if(bulkForm.platform)   updates.platform  = bulkForm.platform;
    if(bulkForm.link)       updates.link      = bulkForm.link;
    if(bulkForm.whatsapp)   updates.whatsapp  = bulkForm.whatsapp;
    if(bulkForm.whiteboard) updates.whiteboard= bulkForm.whiteboard;
    await supabase.from("tuition_classes").update(updates).in("id",ids);
    setClasses(cs=>cs.map(c=>ids.includes(c.id)?{...c,...updates,isPaid:c.isPaid,joinedViaApp:c.joinedViaApp}:c));
    setShowBulkEdit(null);
    showToast(`✅ Updated ${ids.length} classes for ${name}!`);
  }

  async function resetStudentClasses(name){
    if(!window.confirm(`Delete ALL classes for ${name}? This cannot be undone.`)) return;
    const ids=classes.filter(c=>c.student.trim()===name).map(c=>c.id);
    await supabase.from("tuition_classes").delete().in("id",ids);
    setClasses(cs=>cs.filter(c=>c.student.trim()!==name));
    showToast(`🗑 All classes for ${name} deleted!`);
  }

  // ── Compact month calendar ──
  function MonthCalendar({name,year,month}){
    const col=sc(name),sc2=classes.filter(c=>c.student.trim()===name);
    const firstDay=new Date(year,month,1),lastDay=new Date(year,month+1,0);
    const startOffset=(firstDay.getDay()===0?6:firstDay.getDay()-1);
    const cells=[];
    for(let i=0;i<startOffset;i++) cells.push(null);
    for(let d=1;d<=lastDay.getDate();d++) cells.push(d);
    while(cells.length%7!==0) cells.push(null);
    return(
      <div style={{background:"#fff",borderRadius:"12px",padding:"10px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px",marginBottom:"4px"}}>
          {DAYS_SHORT.map(d=><div key={d} style={{fontSize:"8px",fontWeight:700,color:"#bbb",textAlign:"center",textTransform:"uppercase"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px"}}>
          {cells.map((day,i)=>{
            if(!day) return <div key={i}/>;
            const iso=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const dc=sc2.filter(c=>c.date===iso),isT=iso===today,hasCls=dc.length>0;
            const mainSt=dc[0]?STATUS_CONFIG[dc[0].status]:null;
            return(
              <div key={i} onClick={()=>hasCls?openEdit(dc[0]):null}
                style={{borderRadius:"6px",padding:"2px",textAlign:"center",minHeight:"32px",background:isT?col.accent:hasCls?mainSt.bg:"#f9fafb",border:isT?`2px solid ${col.accent}`:hasCls?`1px solid ${mainSt.border}`:"1px solid #f0f0f0",cursor:hasCls?"pointer":"default",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:"10px",fontWeight:isT?800:hasCls?700:400,color:isT?"#fff":hasCls?mainSt.color:"#ccc"}}>{day}</div>
                {hasCls&&<div style={{fontSize:"8px",lineHeight:1,color:isT?"rgba(255,255,255,0.9)":mainSt.color}}>{mainSt.emoji}</div>}
                {dc.length>1&&<div style={{fontSize:"7px",color:isT?"#fff":"#888"}}>+{dc.length-1}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Student panel ──
  function StudentPanel({name}){
    const col=sc(name),st=studentStats(name),{fm,ledger}=payLedger(name);
    const now=new Date();
    const[calYear,setCalYear]=useState(now.getFullYear());
    const[calMonth,setCalMonth]=useState(now.getMonth());
    const prevMonth=()=>{ if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
    const nextMonth=()=>{ if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };
    const upcoming=classes.filter(c=>c.student.trim()===name&&c.date>=today&&c.status==="scheduled").sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).slice(0,4);
    const allClasses=classes.filter(c=>c.student.trim()===name).sort((a,b)=>b.date.localeCompare(a.date));

    return(
      <div>
        {/* Header */}
        <div style={{background:col.card,borderRadius:"16px",padding:"16px 18px",marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{width:"44px",height:"44px",borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:800,color:"#fff",flexShrink:0}}>{name[0]}</div>
              <div>
                <div style={{fontSize:"18px",fontWeight:800,color:"#fff"}}>{name}</div>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.75)"}}>Fee: {fm==="monthly"?"Monthly":"Weekly"}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:"2px",background:"rgba(0,0,0,0.2)",borderRadius:"8px",padding:"2px"}}>
                {[["weekly","🗓"],["monthly","📅"]].map(([v,e])=>(
                  <button key={v} onClick={()=>setFeeMode(name,v)} style={{padding:"4px 8px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700,background:fm===v?"#fff":"transparent",color:fm===v?col.accent:"rgba(255,255,255,0.7)"}}>{e} {v==="weekly"?"Weekly":"Monthly"}</button>
                ))}
              </div>
              {st.whatsapp&&<a href={`https://wa.me/${st.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><button style={{padding:"6px 10px",borderRadius:"8px",background:"#25D366",color:"#fff",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700}}>💬 WhatsApp</button></a>}
              {st.whiteboard&&<a href={st.whiteboard} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><button style={{padding:"6px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.2)",color:"#fff",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700}}>🖊 Whiteboard</button></a>}
              {st.link&&<button onClick={()=>joinClass({...upcoming[0]||{},link:st.link,student:name})} style={{padding:"6px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.9)",color:col.accent,border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700}}>🔗 Join</button>}
              <button onClick={()=>{setForm({...emptyForm,student:name,link:st.link,whatsapp:st.whatsapp,whiteboard:st.whiteboard,rate:500,feeMode:fm});setEditId(null);setShowForm(true);}} style={{padding:"6px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.2)",color:"#fff",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700}}>+ Add</button>
              <button onClick={()=>setShowSummary({name,month:now.getMonth(),year:now.getFullYear()})} style={{padding:"6px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.2)",color:"#fff",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700}}>📊 Summary</button>
              <button onClick={()=>{ setBulkForm({time:"",duration:60,rate:500,platform:"meet",link:st.link||"",whatsapp:st.whatsapp||"",whiteboard:st.whiteboard||"",applyFrom:toISO(new Date())}); setShowBulkEdit(name); }} style={{padding:"6px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.2)",color:"#fff",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700}}>✏️ Bulk Edit</button>
              <button onClick={()=>resetStudentClasses(name)} style={{padding:"6px 10px",borderRadius:"8px",background:"rgba(255,0,0,0.25)",color:"#fff",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700}}>🗑 Reset</button>
            </div>
          </div>
        </div>

        {/* Stats — horizontal scroll */}
        <div style={{overflowX:"auto",marginBottom:"12px",paddingBottom:"4px",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"flex",gap:"8px",minWidth:"max-content"}}>
            {Object.entries(STATUS_CONFIG).map(([key,cfg])=>(
              <div key={key} style={{background:cfg.bg,borderRadius:"12px",padding:"10px 16px",textAlign:"center",minWidth:"90px",flexShrink:0}}>
                <div style={{fontSize:"24px",fontWeight:800,color:cfg.color}}>{st[key]||0}</div>
                <div style={{fontSize:"9px",fontWeight:700,color:cfg.color,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:"2px"}}>{cfg.emoji} {cfg.label}</div>
              </div>
            ))}
            <div style={{background:"#E8F5E9",borderRadius:"12px",padding:"10px 16px",textAlign:"center",minWidth:"100px",flexShrink:0}}>
              <div style={{fontSize:"24px",fontWeight:800,color:"#2E7D32"}}>₹{st.earned.toFixed(0)}</div>
              <div style={{fontSize:"9px",fontWeight:700,color:"#2E7D32",textTransform:"uppercase",marginTop:"2px"}}>💰 Collected</div>
            </div>
            <div style={{background:"#FFEBEE",borderRadius:"12px",padding:"10px 16px",textAlign:"center",minWidth:"100px",flexShrink:0}}>
              <div style={{fontSize:"24px",fontWeight:800,color:"#C62828"}}>₹{st.pending.toFixed(0)}</div>
              <div style={{fontSize:"9px",fontWeight:700,color:"#C62828",textTransform:"uppercase",marginTop:"2px"}}>⚠️ Pending</div>
            </div>
          </div>
        </div>

        {/* Calendar + right column */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"12px",marginBottom:"12px"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
              <button onClick={prevMonth} style={{width:"28px",height:"28px",borderRadius:"50%",border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer",fontSize:"14px",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <span style={{fontSize:"13px",fontWeight:700,color:"#1a1a2e"}}>{MONTHS[calMonth]} {calYear}</span>
              <button onClick={nextMonth} style={{width:"28px",height:"28px",borderRadius:"50%",border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer",fontSize:"14px",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
            <MonthCalendar name={name} year={calYear} month={calMonth}/>
            <div style={{display:"flex",gap:"6px",marginTop:"6px",flexWrap:"wrap"}}>
              {Object.entries(STATUS_CONFIG).map(([k,v])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:"2px"}}>
                  <span style={{fontSize:"9px"}}>{v.emoji}</span><span style={{fontSize:"8px",color:"#999"}}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            <div style={{background:"#fff",borderRadius:"12px",padding:"12px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>📅 Upcoming</div>
              {upcoming.length===0?<div style={{fontSize:"12px",color:"#ccc",textAlign:"center",padding:"8px"}}>No upcoming classes</div>
              :upcoming.map(cls=>{
                const d=new Date(cls.date+"T00:00:00"),pl=PLATFORM_COLORS[cls.platform]||PLATFORM_COLORS.meet;
                return(
                  <div key={cls.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"6px 0",borderBottom:"1px dashed #f5f5f5"}}>
                    <div style={{width:"34px",height:"34px",borderRadius:"8px",background:col.light,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <div style={{fontSize:"12px",fontWeight:800,color:col.accent}}>{d.getDate()}</div>
                      <div style={{fontSize:"8px",color:col.accent}}>{SHORT_MON[d.getMonth()]}</div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"12px",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cls.subject||"Class"}</div>
                      <div style={{fontSize:"10px",color:"#888"}}>{formatTime(cls.time)} · {cls.duration}min</div>
                    </div>
                    <button onClick={()=>joinClass(cls)} style={{padding:"4px 10px",borderRadius:"6px",border:"none",background:pl.bg,color:pl.color,cursor:"pointer",fontSize:"10px",fontWeight:700,flexShrink:0}}>Join ✅</button>
                  </div>
                );
              })}
            </div>
            <div style={{background:"#fff",borderRadius:"12px",padding:"12px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",flex:1}}>
              <div style={{fontSize:"11px",fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>💰 {fm==="monthly"?"Monthly":"Weekly"} Ledger</div>
              {Object.keys(ledger).length===0?<div style={{fontSize:"12px",color:"#ccc",textAlign:"center",padding:"8px"}}>No joined classes yet</div>
              :Object.entries(ledger).map(([period,data])=>(
                <div key={period} style={{padding:"6px 0",borderBottom:"1px dashed #f5f5f5"}}>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"4px"}}>
                    <div style={{fontSize:"12px",fontWeight:600}}>{period}</div>
                    <div style={{fontSize:"10px",color:"#888"}}>{data.count} class{data.count!==1?"es":""} · ₹{data.total.toFixed(0)}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"3px",flexWrap:"wrap"}}>
                    {data.paid>0&&<span style={{fontSize:"11px",fontWeight:700,color:"#2E7D32"}}>₹{data.paid.toFixed(0)} ✅</span>}
                    {data.pending>0&&<><span style={{fontSize:"11px",fontWeight:700,color:"#C62828"}}>₹{data.pending.toFixed(0)} ⚠️</span><button onClick={()=>markPeriodPaid(data.pendingIds)} style={{fontSize:"10px",padding:"2px 8px",borderRadius:"6px",border:"none",background:"#43e97b",color:"#000",cursor:"pointer",fontWeight:700}}>Collect</button></>}
                    {data.pending===0&&<span style={{fontSize:"10px",color:"#2E7D32",fontWeight:600}}>All paid ✅</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* All classes */}
        <div style={{background:"#fff",borderRadius:"12px",padding:"14px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"10px"}}>🗒 All Classes ({allClasses.length})</div>
          {allClasses.map(cls=>{
            const st2=STATUS_CONFIG[cls.status]||STATUS_CONFIG.scheduled,pl=PLATFORM_COLORS[cls.platform]||PLATFORM_COLORS.meet;
            const cost=(cls.duration/60)*(cls.rate||0),d=new Date(cls.date+"T00:00:00");
            return(
              <div key={cls.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 0",borderBottom:"1px dashed #f5f5f5",flexWrap:"wrap"}}>
                <div style={{width:"34px",height:"34px",borderRadius:"8px",background:col.light,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontSize:"11px",fontWeight:800,color:col.accent}}>{d.getDate()}</div>
                  <div style={{fontSize:"8px",color:col.accent}}>{SHORT_MON[d.getMonth()]}</div>
                </div>
                <div style={{flex:1,minWidth:"120px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"4px",flexWrap:"wrap"}}>
                    <span style={{fontSize:"12px",fontWeight:600}}>{cls.subject||"Class"}</span>
                    <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"8px",background:st2.bg,color:st2.color,fontWeight:700}}>{st2.emoji} {st2.label}</span>
                    {cls.joinedViaApp&&<span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"8px",background:"#E8F5E9",color:"#2E7D32",fontWeight:700}}>✅ Joined</span>}
                  </div>
                  <div style={{fontSize:"10px",color:"#888",marginTop:"1px"}}>{formatTime(cls.time)} · {cls.duration}min {cls.joinedViaApp?`· ₹${cost.toFixed(0)} ${cls.isPaid?"✅":"⚠️"}`:""}</div>
                </div>
                <div style={{display:"flex",gap:"3px",flexShrink:0,flexWrap:"wrap"}}>
                  {!cls.joinedViaApp&&cls.link&&<button onClick={()=>joinClass(cls)} style={{padding:"3px 7px",borderRadius:"6px",border:"none",background:pl.bg,color:pl.color,cursor:"pointer",fontSize:"10px",fontWeight:700}}>Join ✅</button>}
                  {cls.joinedViaApp&&<button onClick={()=>togglePaid(cls.id)} style={{padding:"3px 7px",borderRadius:"6px",border:"none",background:cls.isPaid?"#E8F5E9":"#FFEBEE",color:cls.isPaid?"#2E7D32":"#C62828",cursor:"pointer",fontSize:"10px",fontWeight:700}}>{cls.isPaid?"Paid":"Due"}</button>}
                  {cls.whatsapp&&<a href={`https://wa.me/${cls.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"><button style={{padding:"3px 7px",borderRadius:"6px",border:"none",background:"#E8F5E9",color:"#25D366",cursor:"pointer",fontSize:"10px",fontWeight:700}}>💬</button></a>}
                  {cls.whiteboard&&<a href={cls.whiteboard} target="_blank" rel="noreferrer"><button style={{padding:"3px 7px",borderRadius:"6px",border:"none",background:"#E3F2FD",color:"#1565C0",cursor:"pointer",fontSize:"10px"}}>🖊</button></a>}
                  <button onClick={()=>openEdit(cls)} style={{padding:"3px 7px",borderRadius:"6px",border:"none",background:"#f5f5f5",color:"#555",cursor:"pointer",fontSize:"10px"}}>✏️</button>
                  <button onClick={()=>delClass(cls.id)} style={{padding:"3px 7px",borderRadius:"6px",border:"none",background:"#FFEBEE",color:"#C62828",cursor:"pointer",fontSize:"10px"}}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const overallTotals=overallMonthlyTotals();

  const S={
    app:{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#F8F9FF"},
    header:{background:"linear-gradient(135deg,#667eea,#764ba2)",position:"sticky",top:0,zIndex:50,boxShadow:"0 4px 20px rgba(102,126,234,0.4)"},
    hInner:{maxWidth:"1100px",margin:"0 auto",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"},
    logo:{fontSize:"18px",fontWeight:700,color:"#fff"},
    navRow:{display:"flex",gap:"3px",background:"rgba(255,255,255,0.15)",borderRadius:"10px",padding:"3px"},
    navBtn:{padding:"6px 12px",borderRadius:"7px",border:"none",background:"transparent",color:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:"12px",fontWeight:500},
    navActive:{padding:"6px 12px",borderRadius:"7px",border:"none",background:"rgba(255,255,255,0.25)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:700},
    addBtn:{padding:"7px 14px",borderRadius:"9px",border:"none",background:"#fff",color:"#667eea",cursor:"pointer",fontSize:"12px",fontWeight:700},
    body:{maxWidth:"1100px",margin:"0 auto",padding:"16px"},
    stuTabs:{display:"flex",gap:"0",borderBottom:"2px solid #e5e7eb",marginBottom:"16px",overflowX:"auto",WebkitOverflowScrolling:"touch"},
    stuTab:{padding:"10px 16px",border:"none",background:"transparent",cursor:"pointer",fontSize:"13px",fontWeight:600,color:"#aaa",borderBottom:"2px solid transparent",marginBottom:"-2px",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"6px",flexShrink:0},
    weekGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"5px",marginBottom:"16px"},
    dayCol:{background:"#fff",borderRadius:"10px",padding:"7px 5px",boxShadow:"0 2px 6px rgba(0,0,0,0.05)",minHeight:"90px"},
    dayColT:{background:"linear-gradient(135deg,#667eea,#764ba2)",borderRadius:"10px",padding:"7px 5px",boxShadow:"0 4px 14px rgba(102,126,234,0.4)",minHeight:"90px"},
    chip:{borderRadius:"5px",padding:"3px 4px",marginBottom:"3px",cursor:"pointer"},
    overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"12px"},
    modal:{background:"#fff",borderRadius:"18px",padding:"20px",width:"100%",maxWidth:"440px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"},
    label:{fontSize:"11px",fontWeight:700,color:"#555",display:"block",marginBottom:"3px",marginTop:"12px",textTransform:"uppercase",letterSpacing:"0.05em"},
    inp:{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:"10px",border:"1.5px solid #e5e7eb",fontSize:"14px",outline:"none"},
    g2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"},
  };

  if(loading) return(
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:"40px",marginBottom:"12px"}}>📚</div>
        <div style={{fontSize:"16px",fontWeight:700,color:"#667eea"}}>Loading TuitionHub...</div>
      </div>
    </div>
  );

  return(
    <div style={S.app}>
      {toast&&<div style={{position:"fixed",bottom:"20px",left:"50%",transform:"translateX(-50%)",background:"#1a1a2e",color:"#fff",padding:"10px 20px",borderRadius:"12px",zIndex:999,fontSize:"13px",fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",whiteSpace:"nowrap"}}>{toast}</div>}

      <div style={S.header}>
        <div style={S.hInner}>
          <span style={S.logo}>📚 TuitionHub</span>
          <div style={S.navRow}>
            {[["schedule","📅"],["students","👥"],["payments","💰"]].map(([v,e])=>(
              <button key={v} style={mainTab===v?S.navActive:S.navBtn} onClick={()=>setMainTab(v)}>{e} {v.charAt(0).toUpperCase()+v.slice(1)}</button>
            ))}
          </div>
          <button style={S.addBtn} onClick={()=>{setForm(emptyForm);setEditId(null);setShowForm(true);}}>+ Add Class</button>
        </div>
      </div>

      <div style={S.body}>

        {mainTab==="schedule"&&(<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <button onClick={()=>setWeek(w=>w-1)} style={{width:"30px",height:"30px",borderRadius:"50%",border:"1.5px solid #667eea",background:"#fff",color:"#667eea",cursor:"pointer",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <span style={{fontSize:"14px",fontWeight:700,color:"#1a1a2e"}}>{weekLabel}</span>
              <button onClick={()=>setWeek(w=>w+1)} style={{width:"30px",height:"30px",borderRadius:"50%",border:"1.5px solid #667eea",background:"#fff",color:"#667eea",cursor:"pointer",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
            <button onClick={()=>setWeek(0)} style={{padding:"5px 12px",borderRadius:"8px",border:"1.5px solid #667eea",background:"transparent",color:"#667eea",cursor:"pointer",fontSize:"12px",fontWeight:600}}>Today</button>
          </div>
          <div style={S.weekGrid}>
            {weekDates.map((date,idx)=>{
              const iso=weekISOs[idx],isT=iso===today;
              const dc=classes.filter(c=>c.date===iso).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
              return(
                <div key={iso} style={isT?S.dayColT:S.dayCol}>
                  <div style={{fontSize:"8px",fontWeight:700,textTransform:"uppercase",color:isT?"rgba(255,255,255,0.7)":"#bbb",textAlign:"center"}}>{DAYS_JS[date.getDay()]}</div>
                  <div style={{fontSize:"17px",fontWeight:800,color:isT?"#fff":"#1a1a2e",textAlign:"center",marginBottom:"4px"}}>{date.getDate()}</div>
                  {dc.map(cls=>{
                    const col2=sc(cls.student.trim()),st2=STATUS_CONFIG[cls.status]||STATUS_CONFIG.scheduled;
                    return(<div key={cls.id} style={{...S.chip,background:col2.light,border:`1px solid ${st2.border}`}} onClick={()=>openEdit(cls)}>
                      <div style={{fontSize:"9px",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cls.student}</div>
                      <div style={{fontSize:"8px",color:"#777"}}>{formatTime(cls.time)} {st2.emoji}</div>
                    </div>);
                  })}
                  <div style={{fontSize:"8px",color:isT?"rgba(255,255,255,0.3)":"#e0e0e0",textAlign:"center",cursor:"pointer",marginTop:"2px"}} onClick={()=>{setForm({...emptyForm,date:iso});setEditId(null);setShowForm(true);}}>+ add</div>
                </div>
              );
            })}
          </div>
          {weekISOs.map(iso=>{
            const dc=classes.filter(c=>c.date===iso).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
            if(!dc.length) return null;
            const d=new Date(iso+"T00:00:00");
            return(<div key={iso} style={{marginBottom:"12px"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:"#667eea",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"5px"}}>{DAYS_JS[d.getDay()]}, {SHORT_MON[d.getMonth()]} {d.getDate()}</div>
              {dc.map(cls=>{
                const col2=sc(cls.student.trim()),st2=STATUS_CONFIG[cls.status]||STATUS_CONFIG.scheduled,pl=PLATFORM_COLORS[cls.platform]||PLATFORM_COLORS.meet;
                const cost=(cls.duration/60)*(cls.rate||0);
                return(<div key={cls.id} style={{background:"#fff",borderRadius:"10px",padding:"10px 12px",marginBottom:"5px",boxShadow:"0 2px 6px rgba(0,0,0,0.06)",display:"flex",alignItems:"center",gap:"8px"}}>
                  <div style={{width:"3px",alignSelf:"stretch",borderRadius:"3px",background:col2.card,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:"13px"}}>{cls.student}</span>
                      <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"8px",background:st2.bg,color:st2.color,fontWeight:600}}>{st2.emoji} {st2.label}</span>
                      <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"8px",background:pl.bg,color:pl.color,fontWeight:600}}>{pl.label}</span>
                      {cls.joinedViaApp&&<span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"8px",background:"#E8F5E9",color:"#2E7D32",fontWeight:700}}>✅ Joined</span>}
                    </div>
                    <div style={{fontSize:"11px",color:"#888",marginTop:"1px"}}>{cls.subject} · {formatTime(cls.time)} · {cls.duration}min {cls.joinedViaApp?`· ₹${cost.toFixed(0)} ${cls.isPaid?"✅":"⚠️"}`:""}</div>
                  </div>
                  <div style={{display:"flex",gap:"3px",flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    {!cls.joinedViaApp&&cls.link&&<button onClick={()=>joinClass(cls)} style={{padding:"4px 8px",borderRadius:"6px",border:"none",background:pl.bg,color:pl.color,cursor:"pointer",fontSize:"10px",fontWeight:700}}>Join ✅</button>}
                    {cls.joinedViaApp&&<button onClick={()=>togglePaid(cls.id)} style={{padding:"4px 8px",borderRadius:"6px",border:"none",background:cls.isPaid?"#E8F5E9":"#FFEBEE",color:cls.isPaid?"#2E7D32":"#C62828",cursor:"pointer",fontSize:"10px"}}>{cls.isPaid?"✅":"⚠️"}</button>}
                    {cls.whatsapp&&<a href={`https://wa.me/${cls.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"><button style={{padding:"4px 8px",borderRadius:"6px",border:"none",background:"#E8F5E9",color:"#25D366",cursor:"pointer",fontSize:"10px",fontWeight:700}}>💬</button></a>}
                    {cls.whiteboard&&<a href={cls.whiteboard} target="_blank" rel="noreferrer"><button style={{padding:"4px 8px",borderRadius:"6px",border:"none",background:"#E3F2FD",color:"#1565C0",cursor:"pointer",fontSize:"10px"}}>🖊</button></a>}
                    <button onClick={()=>openEdit(cls)} style={{padding:"4px 8px",borderRadius:"6px",border:"none",background:"#f5f5f5",color:"#555",cursor:"pointer",fontSize:"10px"}}>✏️</button>
                    <button onClick={()=>delClass(cls.id)} style={{padding:"4px 8px",borderRadius:"6px",border:"none",background:"#FFEBEE",color:"#C62828",cursor:"pointer",fontSize:"10px"}}>🗑</button>
                  </div>
                </div>);
              })}
            </div>);
          })}
          {classes.filter(c=>weekISOs.includes(c.date)).length===0&&<div style={{textAlign:"center",padding:"40px",color:"#ccc",fontSize:"14px"}}>No classes this week. Click "+ Add Class" to start!</div>}
        </>)}

        {mainTab==="students"&&(<>
          {studentNames.length===0?<div style={{textAlign:"center",padding:"48px",color:"#ccc"}}>No students yet.</div>:(<>
            <div style={S.stuTabs}>
              {studentNames.map(name=>{
                const col2=sc(name),isA=stuTab===name;
                return(<button key={name} style={{...S.stuTab,borderBottomColor:isA?col2.accent:"transparent",color:isA?col2.accent:"#aaa"}} onClick={()=>setStuTab(name)}>
                  <div style={{width:"20px",height:"20px",borderRadius:"50%",background:isA?col2.card:"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:800,color:isA?"#fff":"#999",flexShrink:0}}>{name[0]}</div>
                  {name}
                </button>);
              })}
            </div>
            {stuTab&&<StudentPanel name={stuTab}/>}
          </>)}
        </>)}

        {mainTab==="payments"&&(<>
          <div style={{fontSize:"20px",fontWeight:800,marginBottom:"16px"}}>💰 Payment Summary</div>
          {Object.keys(overallTotals).length>0&&(
            <div style={{background:"linear-gradient(135deg,#667eea,#764ba2)",borderRadius:"14px",padding:"16px",marginBottom:"16px"}}>
              <div style={{fontSize:"12px",fontWeight:700,color:"rgba(255,255,255,0.8)",marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>📊 Overall Monthly Collection</div>
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                <div style={{display:"flex",gap:"10px",minWidth:"max-content"}}>
                  {Object.entries(overallTotals).map(([month,data])=>(
                    <div key={month} style={{background:"rgba(255,255,255,0.15)",borderRadius:"10px",padding:"10px 14px",minWidth:"130px",flexShrink:0}}>
                      <div style={{fontSize:"11px",color:"rgba(255,255,255,0.7)",fontWeight:600,marginBottom:"4px"}}>{month}</div>
                      <div style={{fontSize:"16px",fontWeight:800,color:"#fff"}}>₹{(data.earned+data.pending).toFixed(0)}</div>
                      <div style={{fontSize:"10px",color:"rgba(255,255,255,0.7)",marginTop:"2px"}}>{data.count} classes · ₹{data.earned.toFixed(0)} collected</div>
                      {data.pending>0&&<div style={{fontSize:"10px",color:"#FFE082",marginTop:"1px"}}>₹{data.pending.toFixed(0)} pending</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div style={{overflowX:"auto",marginBottom:"16px",paddingBottom:"4px",WebkitOverflowScrolling:"touch"}}>
            <div style={{display:"flex",gap:"10px",minWidth:"max-content"}}>
              {studentNames.map(name=>{
                const col2=sc(name),st2=studentStats(name);
                return(<div key={name} style={{background:"#fff",borderRadius:"12px",overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.08)",minWidth:"160px",cursor:"pointer",flexShrink:0}} onClick={()=>{setMainTab("students");setStuTab(name);}}>
                  <div style={{height:"4px",background:col2.card}}/>
                  <div style={{padding:"12px"}}>
                    <div style={{fontWeight:700,fontSize:"13px",marginBottom:"6px"}}>{name}</div>
                    <div style={{fontSize:"18px",fontWeight:800,color:"#2E7D32"}}>₹{st2.earned.toFixed(0)}</div>
                    <div style={{fontSize:"9px",color:"#888",marginBottom:"4px"}}>Collected</div>
                    {st2.pending>0&&<><div style={{fontSize:"16px",fontWeight:800,color:"#C62828"}}>₹{st2.pending.toFixed(0)}</div><div style={{fontSize:"9px",color:"#C62828"}}>Pending</div></>}
                    <div style={{fontSize:"9px",color:"#aaa",marginTop:"4px"}}>{st2.conducted} classes joined</div>
                  </div>
                </div>);
              })}
            </div>
          </div>
          {studentNames.map(name=>{
            const col2=sc(name),st2=studentStats(name),{fm,ledger}=payLedger(name);
            if(st2.conducted===0) return null;
            return(<div key={name} style={{background:"#fff",borderRadius:"14px",padding:"14px",boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:"10px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px",flexWrap:"wrap"}}>
                <div style={{width:"34px",height:"34px",borderRadius:"50%",background:col2.card,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"13px",flexShrink:0}}>{name[0]}</div>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:"14px"}}>{name}</div><div style={{fontSize:"11px",color:"#888"}}>{st2.conducted} classes · {fm==="monthly"?"Monthly":"Weekly"} billing</div></div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <div style={{textAlign:"right"}}><div style={{fontSize:"15px",fontWeight:800,color:"#2E7D32"}}>₹{st2.earned.toFixed(0)}</div><div style={{fontSize:"9px",color:"#888"}}>Collected</div></div>
                  {st2.pending>0&&<div style={{textAlign:"right"}}><div style={{fontSize:"15px",fontWeight:800,color:"#C62828"}}>₹{st2.pending.toFixed(0)}</div><div style={{fontSize:"9px",color:"#888"}}>Pending</div></div>}
                  <button onClick={()=>setShowSummary({name,month:new Date().getMonth(),year:new Date().getFullYear()})} style={{padding:"5px 10px",borderRadius:"8px",border:"none",background:col2.light,color:col2.accent,cursor:"pointer",fontSize:"11px",fontWeight:700}}>📊 Summary</button>
                </div>
              </div>
              {Object.entries(ledger).map(([period,data])=>(
                <div key={period} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px dashed #f0f0f0",flexWrap:"wrap",gap:"6px"}}>
                  <div><div style={{fontSize:"12px",fontWeight:600}}>{period}</div><div style={{fontSize:"10px",color:"#888"}}>{data.count} class{data.count!==1?"es":""} · ₹{data.total.toFixed(0)} total</div></div>
                  <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
                    {data.paid>0&&<span style={{fontSize:"12px",fontWeight:700,color:"#2E7D32"}}>₹{data.paid.toFixed(0)} ✅</span>}
                    {data.pending>0&&<><span style={{fontSize:"12px",fontWeight:700,color:"#C62828"}}>₹{data.pending.toFixed(0)} ⚠️</span><button onClick={()=>markPeriodPaid(data.pendingIds)} style={{padding:"4px 10px",borderRadius:"7px",border:"none",background:"linear-gradient(135deg,#43e97b,#38f9d7)",color:"#000",cursor:"pointer",fontSize:"11px",fontWeight:700}}>Collect</button></>}
                    {data.pending===0&&<span style={{fontSize:"10px",color:"#2E7D32",fontWeight:600}}>All paid ✅</span>}
                  </div>
                </div>
              ))}
            </div>);
          })}
        </>)}
      </div>

      {/* Bulk Edit Modal */}
      {showBulkEdit&&(
        <div style={S.overlay} onClick={()=>setShowBulkEdit(null)}>
          <div style={{...S.modal,maxWidth:"400px"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:"16px",fontWeight:700,marginBottom:"14px",color:"#1a1a2e"}}>✏️ Bulk Edit — {showBulkEdit}</div>
            <div style={{fontSize:"12px",color:"#888",marginBottom:"12px",background:"#f8f9ff",borderRadius:"8px",padding:"8px 12px"}}>
              Only fill in the fields you want to change. Leave others blank to keep existing values.
            </div>
            <label style={S.label}>Apply from date</label>
            <input style={S.inp} type="date" value={bulkForm.applyFrom} onChange={e=>setBulkForm(f=>({...f,applyFrom:e.target.value}))}/>
            <div style={S.g2}>
              <div>
                <label style={S.label}>New Time</label>
                <input style={S.inp} type="time" value={bulkForm.time} onChange={e=>setBulkForm(f=>({...f,time:e.target.value}))}/>
              </div>
              <div>
                <label style={S.label}>Duration (min)</label>
                <input style={S.inp} type="number" value={bulkForm.duration} onChange={e=>setBulkForm(f=>({...f,duration:e.target.value}))} min="15" step="15"/>
              </div>
            </div>
            <div style={S.g2}>
              <div>
                <label style={S.label}>Hourly Rate (₹)</label>
                <input style={S.inp} type="number" value={bulkForm.rate} onChange={e=>setBulkForm(f=>({...f,rate:e.target.value}))} min="0" step="50"/>
              </div>
              <div>
                <label style={S.label}>Platform</label>
                <select style={S.inp} value={bulkForm.platform} onChange={e=>setBulkForm(f=>({...f,platform:e.target.value}))}>
                  <option value="meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">MS Teams</option>
                </select>
              </div>
            </div>
            <label style={S.label}>Meeting Link</label>
            <input style={S.inp} value={bulkForm.link} onChange={e=>setBulkForm(f=>({...f,link:e.target.value}))} placeholder="https://meet.google.com/..."/>
            <label style={S.label}>WhatsApp Number</label>
            <input style={S.inp} value={bulkForm.whatsapp} onChange={e=>setBulkForm(f=>({...f,whatsapp:e.target.value}))} placeholder="+91 98765 43210"/>
            <label style={S.label}>Whiteboard Link</label>
            <input style={S.inp} value={bulkForm.whiteboard} onChange={e=>setBulkForm(f=>({...f,whiteboard:e.target.value}))} placeholder="https://whiteboard.microsoft.com/..."/>
            <div style={{fontSize:"11px",color:"#667eea",marginTop:"12px",fontWeight:600}}>
              Will update {classes.filter(c=>c.student.trim()===showBulkEdit&&c.date>=bulkForm.applyFrom).length} classes from {bulkForm.applyFrom}
            </div>
            <div style={{display:"flex",gap:"8px",marginTop:"16px",justifyContent:"flex-end"}}>
              <button onClick={()=>setShowBulkEdit(null)} style={{padding:"9px 16px",borderRadius:"10px",border:"1.5px solid #e5e7eb",background:"transparent",cursor:"pointer",fontSize:"13px",color:"#666"}}>Cancel</button>
              <button onClick={()=>applyBulkEdit(showBulkEdit)} style={{padding:"9px 20px",borderRadius:"10px",border:"none",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:700}}>Apply Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Summary Modal */}
      {showSummary&&(()=>{
        const{name,month,year}=showSummary,col2=sc(name),data=monthlySummary(name,month,year);
        return(<div style={S.overlay} onClick={()=>setShowSummary(null)}>
          <div style={{...S.modal,maxWidth:"360px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:col2.card,borderRadius:"12px",padding:"14px",marginBottom:"16px",textAlign:"center"}}>
              <div style={{fontSize:"28px",fontWeight:800,color:"#fff"}}>{name[0]}</div>
              <div style={{fontSize:"16px",fontWeight:700,color:"#fff",marginTop:"4px"}}>{name}</div>
              <div style={{fontSize:"12px",color:"rgba(255,255,255,0.75)"}}>Summary — {MONTHS[month]} {year}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"}}>
              {[{label:"Total Classes",value:data.total,bg:"#F3E5F5",color:"#6A1B9A"},{label:"Joined (Counted)",value:data.conducted,bg:"#E8F5E9",color:"#2E7D32"},{label:"Cancelled",value:data.cancelled,bg:"#FFEBEE",color:"#C62828"},{label:"Not Joined",value:data.total-data.conducted-data.cancelled,bg:"#FFF8E1",color:"#F57F17"}].map(s=>(
                <div key={s.label} style={{background:s.bg,borderRadius:"10px",padding:"12px",textAlign:"center"}}>
                  <div style={{fontSize:"26px",fontWeight:800,color:s.color}}>{s.value}</div>
                  <div style={{fontSize:"9px",fontWeight:700,color:s.color,textTransform:"uppercase",marginTop:"2px"}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"}}>
              <div style={{background:"#E8F5E9",borderRadius:"10px",padding:"12px",textAlign:"center"}}><div style={{fontSize:"22px",fontWeight:800,color:"#2E7D32"}}>₹{data.earned.toFixed(0)}</div><div style={{fontSize:"9px",fontWeight:700,color:"#2E7D32",textTransform:"uppercase",marginTop:"2px"}}>💰 Collected</div></div>
              <div style={{background:"#FFEBEE",borderRadius:"10px",padding:"12px",textAlign:"center"}}><div style={{fontSize:"22px",fontWeight:800,color:"#C62828"}}>₹{data.pending.toFixed(0)}</div><div style={{fontSize:"9px",fontWeight:700,color:"#C62828",textTransform:"uppercase",marginTop:"2px"}}>⚠️ Pending</div></div>
            </div>
            <div style={{fontSize:"12px",color:"#888",textAlign:"center",marginBottom:"14px"}}>Total estimated: ₹{(data.earned+data.pending).toFixed(0)}</div>
            <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
              <button onClick={()=>setShowSummary({name,month:month===0?11:month-1,year:month===0?year-1:year})} style={{padding:"8px 14px",borderRadius:"10px",border:"1px solid #e5e7eb",background:"transparent",cursor:"pointer",fontSize:"12px",color:"#666"}}>‹ Prev</button>
              <button onClick={()=>setShowSummary(null)} style={{padding:"8px 20px",borderRadius:"10px",border:"none",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:700}}>Close</button>
              <button onClick={()=>setShowSummary({name,month:month===11?0:month+1,year:month===11?year+1:year})} style={{padding:"8px 14px",borderRadius:"10px",border:"1px solid #e5e7eb",background:"transparent",cursor:"pointer",fontSize:"12px",color:"#666"}}>Next ›</button>
            </div>
          </div>
        </div>);
      })()}

      {/* Add/Edit Form */}
      {showForm&&(
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{fontSize:"16px",fontWeight:700,marginBottom:"14px",color:"#1a1a2e"}}>{editId?"✏️ Edit Class":"➕ Add New Class"}</div>
            <label style={S.label}>Student Name</label>
            <input style={S.inp} name="student" value={form.student} onChange={handleField} placeholder="e.g. Priya Sharma" list="stu-list"/>
            <datalist id="stu-list">{studentNames.map(n=><option key={n} value={n}/>)}</datalist>
            <label style={S.label}>Subject</label>
            <input style={S.inp} name="subject" value={form.subject} onChange={handleField} placeholder="e.g. Grade 11 · Trigonometry"/>
            <div style={S.g2}>
              <div><label style={S.label}>Date</label><input style={S.inp} type="date" name="date" value={form.date} onChange={handleField}/></div>
              <div><label style={S.label}>Time</label><input style={S.inp} type="time" name="time" value={form.time} onChange={handleField}/></div>
            </div>
            <div style={S.g2}>
              <div><label style={S.label}>Duration (min)</label><input style={S.inp} type="number" name="duration" value={form.duration} onChange={handleField} min="15" step="15"/></div>
              <div><label style={S.label}>Hourly Rate (₹)</label><input style={S.inp} type="number" name="rate" value={form.rate} onChange={handleField} min="0" step="50"/></div>
            </div>
            <div style={S.g2}>
              <div><label style={S.label}>Platform</label>
                <select style={S.inp} name="platform" value={form.platform} onChange={handleField}>
                  <option value="meet">Google Meet</option><option value="zoom">Zoom</option><option value="teams">MS Teams</option>
                </select>
              </div>
              <div><label style={S.label}>Status</label>
                <select style={S.inp} name="status" value={form.status} onChange={handleField}>
                  {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
            </div>
            <label style={S.label}>Meeting Link</label>
            <input style={S.inp} name="link" value={form.link} onChange={handleField} placeholder="https://meet.google.com/..."/>
            <label style={S.label}>💬 WhatsApp Number</label>
            <input style={S.inp} name="whatsapp" value={form.whatsapp} onChange={handleField} placeholder="+91 98765 43210"/>
            <label style={S.label}>🖊 Whiteboard Link</label>
            <input style={S.inp} name="whiteboard" value={form.whiteboard} onChange={handleField} placeholder="https://whiteboard.microsoft.com/..."/>
            {!editId&&(<>
              <label style={S.label}>🔁 Recurrence</label>
              <div style={{background:"#F8F9FF",borderRadius:"10px",padding:"12px",border:"1.5px solid #e5e7eb"}}>
                <select style={{...S.inp,marginBottom:"8px"}} name="recur" value={form.recur} onChange={handleField}>
                  {RECUR_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {form.recur==="custom"&&(<div style={{display:"flex",gap:"5px",marginBottom:"8px",flexWrap:"wrap"}}>
                  {DAYS_SHORT.map((d,i)=>(<button key={i} onClick={()=>toggleCustomDay(i)} style={{width:"32px",height:"32px",borderRadius:"50%",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,background:form.customDays.includes(i)?"linear-gradient(135deg,#667eea,#764ba2)":"#e5e7eb",color:form.customDays.includes(i)?"#fff":"#666"}}>{d}</button>))}
                </div>)}
                {form.recur!=="none"&&(<>
                  <label style={{...S.label,marginTop:"4px"}}>Repeat until</label>
                  <input style={S.inp} type="date" name="recurUntil" value={form.recurUntil} onChange={handleField} min={form.date||today}/>
                  {recurCount>0&&<div style={{fontSize:"11px",color:"#667eea",marginTop:"6px",fontWeight:700}}>📅 Will create {recurCount} classes</div>}
                </>)}
              </div>
            </>)}
            <label style={S.label}>💰 Fee Collection Mode</label>
            <div style={{display:"flex",gap:"4px",background:"#f3f4f6",padding:"3px",borderRadius:"10px"}}>
              {[["weekly","🗓 Weekly"],["monthly","📅 Monthly"]].map(([v,l])=>(
                <button key={v} onClick={()=>setForm(f=>({...f,feeMode:v}))} style={{flex:1,padding:"7px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:700,background:form.feeMode===v?"#fff":"transparent",color:form.feeMode===v?"#667eea":"#888",boxShadow:form.feeMode===v?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{l}</button>
              ))}
            </div>
            <label style={S.label}>Notes</label>
            <input style={S.inp} name="notes" value={form.notes} onChange={handleField} placeholder="Optional notes..."/>
            {form.status==="conducted"&&(
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"12px",padding:"10px 12px",background:"#E8F5E9",borderRadius:"10px"}}>
                <input type="checkbox" id="isPaid" name="isPaid" checked={form.isPaid} onChange={handleField} style={{width:"16px",height:"16px",cursor:"pointer"}}/>
                <label htmlFor="isPaid" style={{fontSize:"13px",fontWeight:600,color:"#2E7D32",cursor:"pointer"}}>Payment received — ₹{((form.duration/60)*(form.rate||0)).toFixed(0)}</label>
              </div>
            )}
            <div style={{display:"flex",gap:"8px",marginTop:"16px",justifyContent:"flex-end"}}>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{padding:"9px 16px",borderRadius:"10px",border:"1.5px solid #e5e7eb",background:"transparent",cursor:"pointer",fontSize:"13px",color:"#666"}}>Cancel</button>
              <button onClick={saveClass} disabled={saving} style={{padding:"9px 20px",borderRadius:"10px",border:"none",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:700,opacity:saving?0.7:1}}>{saving?"Saving...":(recurCount>1?`Save ${recurCount} Classes`:"Save Class")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
