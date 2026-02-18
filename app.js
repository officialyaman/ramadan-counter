// Ramadan Tracker — saves to localStorage
const STORAGE_KEY = "ramadan-tracker-v1";

// Edit these if you want
const MAX_DAYS = 30;

const CHECKS = {
  prayer: [
    { key: "takbeer", label: "Caught Takbeerat Al-Ihram", tag: "quality" },
    { key: "firstRow", label: "Prayed in first row (Saff Awwal)", tag: "vip row" },
    { key: "jamaah", label: "Prayed in Jama'ah (congregation)", tag: "masjid" },
    { key: "onTime", label: "Prayed on time (overall)", tag: "discipline" },
    { key: "khushoo", label: "Khushoo (focus)", tag: "heart" },
  ],
  taraweeh: [
    { key: "taraweeh", label: "Prayed Taraweeh", tag: "night" },
    { key: "tara8", label: "Completed 8 raka'at", tag: "8" },
    { key: "tara20", label: "Completed 20 raka'at", tag: "20" },
    { key: "witr", label: "Prayed Witr", tag: "finish" },
  ],
};

const COUNTERS = {
  quran: [
    { key: "quranPages", label: "Qur’an pages", goal: 4, step: 1 },
    { key: "quranMinutes", label: "Qur’an minutes", goal: 20, step: 5 },
  ],
  dhikr: [
    { key: "istighfar", label: "Astaghfirullah", goal: 100, step: 10 },
    { key: "salawat", label: "Salawat ﷺ", goal: 100, step: 10 },
    { key: "subhanAllah", label: "SubhanAllah", goal: 33, step: 1 },
    { key: "alhamdulillah", label: "Alhamdulillah", goal: 33, step: 1 },
    { key: "allahuAkbar", label: "Allahu Akbar", goal: 34, step: 1 },
    { key: "tahlil", label: "La ilaha illa Allah", goal: 100, step: 10 },
  ],
};

function emptyDay() {
  const checks = {};
  Object.values(CHECKS).flat().forEach(c => checks[c.key] = false);

  const counters = {};
  Object.values(COUNTERS).flat().forEach(c => counters[c.key] = 0);

  return { checks, counters, notes: "" };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.days && parsed.currentDay) return parsed;
    } catch {}
  }
  const days = Array.from({ length: MAX_DAYS }, () => emptyDay());
  return { currentDay: 1, days, createdAt: new Date().toISOString() };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

const els = {
  dayLabel: document.getElementById("dayLabel"),
  prayerChecks: document.getElementById("prayerChecks"),
  taraweehChecks: document.getElementById("taraweehChecks"),
  quranCounters: document.getElementById("quranCounters"),
  dhikrCounters: document.getElementById("dhikrCounters"),
  notes: document.getElementById("notes"),
  summary: document.getElementById("summary"),
  prevDay: document.getElementById("prevDay"),
  nextDay: document.getElementById("nextDay"),
  todayBtn: document.getElementById("todayBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  resetBtn: document.getElementById("resetBtn"),
  recalcBtn: document.getElementById("recalcBtn"),
};

function clampDay(d) {
  return Math.max(1, Math.min(MAX_DAYS, d));
}

function setCurrentDay(d) {
  state.currentDay = clampDay(d);
  saveState();
  render();
}

function dayData() {
  return state.days[state.currentDay - 1];
}

function renderChecks(container, list, groupName) {
  container.innerHTML = "";
  const data = dayData();
  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "check";

    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!data.checks[item.key];
    input.addEventListener("change", () => {
      data.checks[item.key] = input.checked;
      saveState();
      renderSummary();
    });

    const text = document.createElement("span");
    text.textContent = item.label;

    label.appendChild(input);
    label.appendChild(text);

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = item.tag || groupName;

    row.appendChild(label);
    row.appendChild(tag);
    container.appendChild(row);
  });
}

function renderCounters(container, list) {
  container.innerHTML = "";
  const data = dayData();

  list.forEach(item => {
    const wrap = document.createElement("div");
    wrap.className = "counter";

    const top = document.createElement("div");
    top.className = "counter-top";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "counter-name";
    name.tex
