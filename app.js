/*************************
 * 1) SUPABASE CONFIG
 *************************/
const SUPABASE_URL = "https://uhhszagmgddszvuuzvjo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoaHN6YWdtZ2Rkc3p2dXV6dmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0Mzg2ODAsImV4cCI6MjA4NzAxNDY4MH0.jUwnM-Bc827wNv6ABk_k55QBHXpewWQ61YTyhyR9lew";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/*************************
 * 2) UI ELEMENTS
 *************************/
const els = {
  tbody: document.getElementById("tbody"),
  statusText: document.getElementById("statusText"),
  saveDot: document.getElementById("saveDot"),

  monthStart: document.getElementById("monthStart"),
  loadBtn: document.getElementById("loadBtn"),
  monthText: document.getElementById("monthText"),

  notesGlobal: document.getElementById("notesGlobal"),
  todoGlobal: document.getElementById("todoGlobal"),

  authArea: document.getElementById("authArea"),
  userArea: document.getElementById("userArea"),
  helloUser: document.getElementById("helloUser"),
  signInBtn: document.getElementById("signInBtn"),
  signUpBtn: document.getElementById("signUpBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  authModal: document.getElementById("authModal"),
  authTitle: document.getElementById("authTitle"),
  authEmail: document.getElementById("authEmail"),
  authPass: document.getElementById("authPass"),
  submitAuth: document.getElementById("submitAuth"),
  closeAuth: document.getElementById("closeAuth"),
  authMsg: document.getElementById("authMsg"),
};

let sessionUser = null;
let authMode = "signin";

/*************************
 * 3) APP STATE
 *************************/
const DAYS_TO_SHOW = 30;
let startISO = null;                 // YYYY-MM-DD
let rowsByDay = {};                  // dayISO -> db row
let savingTimer = null;

const META_KEY = "ramadan-tracker-meta-v1"; // for global notes/todo per user+month in localStorage

/*************************
 * 4) HELPERS
 *************************/
function isoDate(d){
  return d.toISOString().slice(0,10);
}
function addDays(dateObj, n){
  const d = new Date(dateObj);
  d.setDate(d.getDate() + n);
  return d;
}
function formatDateLabel(iso){
  // show like "Mar 10"
  const d = new Date(iso + "T00:00:00");
  const m = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  return `${m} ${day}`;
}
function setSaveState(state){
  els.saveDot.className = "saveDot " + state;
}
function setStatus(msg){
  els.statusText.textContent = msg;
}

function displayName(user){
  const email = user?.email || "";
  return email.includes("@") ? email.split("@")[0] : "User";
}

/*************************
 * 5) AUTH UI
 *************************/
function openAuth(mode){
  authMode = mode;
  els.authTitle.textContent = mode === "signup" ? "Sign Up" : "Sign In";
  els.authMsg.textContent = "";
  els.authEmail.value = "";
  els.authPass.value = "";
  els.authModal.style.display = "flex";
}
function closeAuth(){
  els.authModal.style.display = "none";
}

els.signInBtn.addEventListener("click", () => openAuth("signin"));
els.signUpBtn.addEventListener("click", () => openAuth("signup"));
els.closeAuth.addEventListener("click", closeAuth);

els.submitAuth.addEventListener("click", async () => {
  const email = els.authEmail.value.trim();
  const password = els.authPass.value.trim();
  els.authMsg.textContent = "Working...";

  try {
    if (authMode === "signup") {
      const res = await supabase.auth.signUp({ email, password });
      if (res.error) throw res.error;
      els.authMsg.textContent = "Account created ✅ Now Sign In.";
      return;
    } else {
      const res = await supabase.auth.signInWithPassword({ email, password });
      if (res.error) throw res.error;
      sessionUser = res.data.user;
      closeAuth();
      updateAuthUI();
      await loadMonthFromDB();
      renderTable();
      loadMeta();
    }
  } catch (e) {
    els.authMsg.textContent = e.message || "Error";
  }
});

els.logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  sessionUser = null;
  updateAuthUI();
  rowsByDay = {};
  els.tbody.innerHTML = "";
  setStatus("Not signed in.");
});

function updateAuthUI(){
  if (sessionUser){
    els.authArea.style.display = "none";
    els.userArea.style.display = "flex";
    els.helloUser.textContent = `Salam, ${displayName(sessionUser)} 👋`;
    setStatus("Signed in. Loading…");
  } else {
    els.authArea.style.display = "flex";
    els.userArea.style.display = "none";
    setStatus("Not signed in.");
  }
}

/*************************
 * 6) DB FUNCTIONS
 *************************/
async function loadMonthFromDB(){
  if (!sessionUser || !startISO) return;

  const start = startISO;
  const end = isoDate(addDays(new Date(startISO + "T00:00:00"), DAYS_TO_SHOW - 1));

  setStatus(`Loading ${start} → ${end} ...`);
  setSaveState("saving");

  const { data, error } = await supabase
    .from("ramadan_entries")
    .select("*")
    .gte("day", start)
    .lte("day", end);

  if (error){
    console.error(error);
    setStatus("Error loading data.");
    setSaveState("error");
    return;
  }

  rowsByDay = {};
  for (const r of data){
    rowsByDay[r.day] = r;
  }

  setStatus(`Loaded. Editing saves automatically ✅`);
  setSaveState("saved");
}

async function upsertDay(dayISO, patch){
  if (!sessionUser) return;

  // merge with existing
  const existing = rowsByDay[dayISO] || {
    day: dayISO,
    rakats_prayed: 0,
    vip_row: false,
    takbeerat_al_ihram: false,
    tasbeehat: {},
    quran_pages: 0,
    prayer_mood: "",
    notes: "",
    todo: "",
  };

  const row = {
    user_id: sessionUser.id,
    day: dayISO,
    rakats_prayed: patch.rakats_prayed ?? existing.rakats_prayed ?? 0,
    vip_row: patch.vip_row ?? existing.vip_row ?? false,
    takbeerat_al_ihram: patch.takbeerat_al_ihram ?? existing.takbeerat_al_ihram ?? false,
    tasbeehat: patch.tasbeehat ?? existing.tasbeehat ?? {},
    quran_pages: patch.quran_pages ?? existing.quran_pages ?? 0,
    prayer_mood: patch.prayer_mood ?? existing.prayer_mood ?? "",
    notes: patch.notes ?? existing.notes ?? "",
    todo: patch.todo ?? existing.todo ?? "",
    updated_at: new Date().toISOString()
  };

  setSaveState("saving");

  const { data, error } = await supabase
    .from("ramadan_entries")
    .upsert(row, { onConflict: "user_id,day" })
    .select()
    .single();

  if (error){
    console.error(error);
    setSaveState("error");
    setStatus("Save error ❌ (check console)");
    return;
  }

  rowsByDay[dayISO] = data;
  setSaveState("saved");
}

/*************************
 * 7) META (GLOBAL NOTES + TODO)
 * Stored locally per user+startISO for simplicity
 *************************/
function metaStorageKey(){
  const uid = sessionUser?.id || "guest";
  return `${META_KEY}:${uid}:${startISO || "none"}`;
}
function loadMeta(){
  const raw = localStorage.getItem(metaStorageKey());
  if (!raw){
    els.notesGlobal.value = "";
    els.todoGlobal.value = "";
    return;
  }
  try{
    const obj = JSON.parse(raw);
    els.notesGlobal.value = obj.notes || "";
    els.todoGlobal.value = obj.todo || "";
  }catch{
    els.notesGlobal.value = "";
    els.todoGlobal.value = "";
  }
}
function saveMetaDebounced(){
  clearTimeout(savingTimer);
  savingTimer = setTimeout(() => {
    const obj = { notes: els.notesGlobal.value, todo: els.todoGlobal.value, savedAt: new Date().toISOString() };
    localStorage.setItem(metaStorageKey(), JSON.stringify(obj));
  }, 250);
}
els.notesGlobal.addEventListener("input", saveMetaDebounced);
els.todoGlobal.addEventListener("input", saveMetaDebounced);

/*************************
 * 8) TABLE RENDER
 *************************/
function moodOptions(){
  return [
    { v: "", t: "" },
    { v: "Amazing", t: "Amazing" },
    { v: "Good", t: "Good" },
    { v: "Okay", t: "Okay" },
    { v: "Low", t: "Low" },
    { v: "Tired", t: "Tired" },
    { v: "Focused", t: "Focused" }
  ];
}

function getRow(dayISO){
  return rowsByDay[dayISO] || {
    day: dayISO,
    rakats_prayed: 0,
    vip_row: false,
    takbeerat_al_ihram: false,
    tasbeehat: {},
    quran_pages: 0,
    prayer_mood: ""
  };
}

function buildTasbeehInputs(dayISO, tasbeehat){
  const wrap = document.createElement("div");
  wrap.className = "pills";

  const fields = [
    { k:"subhan", ph:"Sub" },
    { k:"hamd", ph:"Hamd" },
    { k:"takbir", ph:"Takbir" },
    { k:"tahlil", ph:"Tahlil" },
    { k:"istighfar", ph:"Ist" },
    { k:"salawat", ph:"Sal" },
  ];

  fields.forEach(f => {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.placeholder = f.ph;
    inp.value = String(tasbeehat?.[f.k] ?? "");
    inp.addEventListener("change", async () => {
      const row = getRow(dayISO);
      const t = { ...(row.tasbeehat || {}) };
      const val = inp.value === "" ? 0 : Math.max(0, parseInt(inp.value, 10) || 0);
      t[f.k] = val;
      await upsertDay(dayISO, { tasbeehat: t });
    });
    wrap.appendChild(inp);
  });

  return wrap;
}

function renderTable(){
  if (!startISO){
    els.tbody.innerHTML = "";
    return;
  }

  const startDate = new Date(startISO + "T00:00:00");

  els.tbody.innerHTML = "";

  for (let i=0; i<DAYS_TO_SHOW; i++){
    const dayISO = isoDate(addDays(startDate, i));
    const r = getRow(dayISO);

    const tr = document.createElement("tr");

    // Date
    const tdDate = document.createElement("td");
    tdDate.className = "dateCol";
    tdDate.textContent = formatDateLabel(dayISO);
    tr.appendChild(tdDate);

    // Rak'at (number)
    const tdRak = document.createElement("td");
    const inpRak = document.createElement("input");
    inpRak.className = "cellInput number";
    inpRak.type = "number";
    inpRak.min = "0";
    inpRak.value = String(r.rakats_prayed ?? 0);
    inpRak.addEventListener("change", async () => {
      const val = Math.max(0, parseInt(inpRak.value, 10) || 0);
      await upsertDay(dayISO, { rakats_prayed: val });
    });
    tdRak.appendChild(inpRak);
    tr.appendChild(tdRak);

    // VIP checkbox
    const tdVip = document.createElement("td");
    tdVip.className = "cellCenter";
    const cbVip = document.createElement("input");
    cbVip.type = "checkbox";
    cbVip.className = "checkbox";
    cbVip.checked = !!r.vip_row;
    cbVip.addEventListener("change", async () => {
      await upsertDay(dayISO, { vip_row: cbVip.checked });
    });
    tdVip.appendChild(cbVip);
    tr.appendChild(tdVip);

    // Takbeer checkbox
    const tdTak = document.createElement("td");
    tdTak.className = "cellCenter";
    const cbTak = document.createElement("input");
    cbTak.type = "checkbox";
    cbTak.className = "checkbox";
    cbTak.checked = !!r.takbeerat_al_ihram;
    cbTak.addEventListener("change", async () => {
      await upsertDay(dayISO, { takbeerat_al_ihram: cbTak.checked });
    });
    tdTak.appendChild(cbTak);
    tr.appendChild(tdTak);

    // Tasbeehat (6 mini inputs)
    const tdTas = document.createElement("td");
    tdTas.appendChild(buildTasbeehInputs(dayISO, r.tasbeehat || {}));
    tr.appendChild(tdTas);

    // Quran pages (number)
    const tdQ = document.createElement("td");
    const inpQ = document.createElement("input");
    inpQ.className = "cellInput number";
    inpQ.type = "number";
    inpQ.min = "0";
    inpQ.value = String(r.quran_pages ?? 0);
    inpQ.addEventListener("change", async () => {
      const val = Math.max(0, parseInt(inpQ.value, 10) || 0);
      await upsertDay(dayISO, { quran_pages: val });
    });
    tdQ.appendChild(inpQ);
    tr.appendChild(tdQ);

    // Mood dropdown
    const tdMood = document.createElement("td");
    const sel = document.createElement("select");
    sel.className = "cellInput";
    moodOptions().forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.v;
      opt.textContent = o.t;
      if ((r.prayer_mood || "") === o.v) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", async () => {
      await upsertDay(dayISO, { prayer_mood: sel.value });
    });
    tdMood.appendChild(sel);
    tr.appendChild(tdMood);

    els.tbody.appendChild(tr);
  }
}

/*************************
 * 9) MONTH START + LOAD
 *************************/
function setDefaultStart(){
  // default to today (you can set it to Ramadan start date manually)
  const today = new Date();
  els.monthStart.value = isoDate(today);
  startISO = els.monthStart.value;
}
setDefaultStart();

els.loadBtn.addEventListener("click", async () => {
  startISO = els.monthStart.value;
  if (!startISO) return;

  if (!sessionUser){
    setStatus("Please Sign In to save to database.");
    renderTable(); // show blank table anyway
    return;
  }

  await loadMonthFromDB();
  renderTable();
  loadMeta();
});

/*************************
 * 10) INIT AUTH SESSION
 *************************/
async function init(){
  const { data } = await supabase.auth.getSession();
  sessionUser = data.session?.user || null;
  updateAuthUI();

  supabase.auth.onAuthStateChange((_event, newSession) => {
    sessionUser = newSession?.user || null;
    updateAuthUI();
  });

  // show table immediately
  renderTable();

  // if already signed in, auto load
  if (sessionUser){
    startISO = els.monthStart.value;
    await loadMonthFromDB();
    renderTable();
    loadMeta();
  } else {
    setStatus("Not signed in. Sign in to save.");
  }
}

init();
