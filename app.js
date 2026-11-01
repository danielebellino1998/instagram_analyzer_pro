"use strict";

/* ===== Instagram Analyzer PRO v3.0 ===== */

const CACHE_KEY = "igAnalyzerCache";
const VISITED_KEY = "visitedAccounts";
const MAX_ZIP_MB = 150;

const TITLES = {
  non: "❌ Account che segui ma che non ti seguono",
  fan: "👥 Account che ti seguono ma che non segui",
  pending: "⏳ Richieste di follow in sospeso",
  recent: "📥 Richieste di follow ricevute di recente"
};

/* Percorsi ancorati: evitano di pescare file come hashtags_following.json */
const RE_FOLLOWERS = /(^|\/)followers(_\d+)?\.json$/i;
const RE_FOLLOWING = /(^|\/)following(_\d+)?\.json$/i;
const RE_PENDING = /(^|\/)pending_follow_requests\.json$/i;
const RE_RECENT = /(^|\/)recent_follow_requests\.json$/i;

let data = {};
let followDates = {};
let current = [];
let currentType = "non";
let visited = new Set(loadVisited());

const $ = (id) => document.getElementById(id);

/* ---------- Storage sicuro (può lanciare in navigazione privata) ---------- */

function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
}

function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* ignora */ }
}

function loadVisited() {
  try {
    const v = JSON.parse(storageGet(VISITED_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function saveVisited() {
  storageSet(VISITED_KEY, JSON.stringify([...visited]));
}

/* ---------- Stato / messaggi ---------- */

function setStatus(message, kind) {
  const el = $("status");
  if (!el) return;
  el.textContent = message || "";
  el.className = message ? "status " + (kind || "info") : "";
}

function setBusy(busy) {
  const btn = $("analyzeBtn");
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? "⏳ Analisi in corso…" : "🚀 Analizza ZIP";
}

/* ---------- Lettura dei JSON ---------- */

/*
 * Estrae {name, ts} da qualsiasi struttura dell'export.
 * - voce con string_list_data: nome = title oppure value (export vecchi/nuovi)
 * - fallback: label_values "Nome utente", oppure semplice title
 */
function extractEntries(json) {
  const out = [];

  (function scan(x) {
    if (Array.isArray(x)) {
      x.forEach(scan);
      return;
    }
    if (!x || typeof x !== "object") return;

    if (Array.isArray(x.string_list_data)) {
      const first = x.string_list_data[0] || {};
      const name = String(x.title || first.value || "").trim();
      if (name) out.push({ name: name, ts: Number(first.timestamp) || 0 });
      return;
    }

    if (Array.isArray(x.label_values)) {
      x.label_values.forEach((a) => {
        if (a && a.label === "Nome utente" && a.value) {
          out.push({ name: String(a.value).trim(), ts: 0 });
        }
      });
    } else if (typeof x.title === "string" && x.title.trim()) {
      out.push({ name: x.title.trim(), ts: 0 });
    }

    Object.values(x).forEach(scan);
  })(json);

  return out;
}

async function readJsonFiles(zip, regex) {
  const names = Object.keys(zip.files).filter(
    (n) => !zip.files[n].dir && regex.test(n)
  );
  const entries = [];

  for (const n of names) {
    let json;
    try {
      json = JSON.parse(await zip.file(n).async("text"));
    } catch (e) {
      throw new Error("Il file «" + n.split("/").pop() + "» non è un JSON valido.");
    }
    entries.push(...extractEntries(json));
  }

  return { found: names.length > 0, entries: entries };
}

/* Mappa nome-minuscolo → voce (deduplica e confronto senza maiuscole/minuscole) */
function toMap(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    if (!map.has(key)) map.set(key, e);
  }
  return map;
}

function names(map) {
  return [...map.values()].map((e) => e.name);
}

/* Calcolo puro: nessun accesso al DOM */
function calcola(fo, fi, pe, re) {
  const followerMap = toMap(fo.entries);
  const followingMap = toMap(fi.entries);

  const dates = {};
  for (const [key, e] of followingMap) {
    if (e.ts) dates[key] = new Date(e.ts * 1000).toLocaleDateString("it-IT");
  }

  return {
    dates: dates,
    data: {
      followers: names(followerMap),
      following: names(followingMap),
      non: [...followingMap].filter(([k]) => !followerMap.has(k)).map(([, e]) => e.name),
      fan: [...followerMap].filter(([k]) => !followingMap.has(k)).map(([, e]) => e.name),
      pending: names(toMap(pe.entries)),
      recent: names(toMap(re.entries))
    }
  };
}

/* ---------- Analisi ---------- */

async function analizza() {
  const file = $("file").files[0];

  if (!file) return setStatus("Seleziona prima il file ZIP scaricato da Instagram.", "error");
  if (!/\.zip$/i.test(file.name)) return setStatus("Il file deve essere uno ZIP (.zip).", "error");
  if (typeof JSZip === "undefined") {
    return setStatus("Impossibile caricare la libreria JSZip. Controlla la connessione e ricarica la pagina.", "error");
  }
  if (file.size > MAX_ZIP_MB * 1024 * 1024) {
    const ok = confirm(
      "Il file è molto grande (" + Math.round(file.size / 1048576) + " MB) e potrebbe bloccare il browser.\n" +
      "Per l'analisi bastano follower e seguiti: rifai l'esportazione senza foto e video.\n\nVuoi continuare lo stesso?"
    );
    if (!ok) return;
  }

  setBusy(true);
  setStatus("Lettura del file in corso…", "info");

  try {
    const zip = await JSZip.loadAsync(file);

    const fo = await readJsonFiles(zip, RE_FOLLOWERS);
    const fi = await readJsonFiles(zip, RE_FOLLOWING);
    const pe = await readJsonFiles(zip, RE_PENDING);
    const re = await readJsonFiles(zip, RE_RECENT);

    if (!fo.found && !fi.found) {
      const isHtml = Object.keys(zip.files).some((n) => /followers_and_following\/.*\.html$/i.test(n));
      throw new Error(
        isHtml
          ? "Questo export è in formato HTML. Rifai l'esportazione scegliendo il formato JSON."
          : "Non trovo followers e following nello ZIP. Assicurati di aver scelto «Follower e persone/Pagine seguite» e il formato JSON."
      );
    }

    const result = calcola(fo, fi, pe, re);
    data = result.data;
    followDates = result.dates;

    renderStats();
    mostra("non");

    const missing = [];
    if (!fo.found) missing.push("followers");
    if (!fi.found) missing.push("seguiti");
    if (missing.length) {
      setStatus("Attenzione: nello ZIP mancano i file dei " + missing.join(" e ") + ", i risultati non sono completi.", "error");
    } else {
      setStatus("Analisi completata ✅", "ok");
    }
  } catch (e) {
    console.error(e);
    setStatus(e && e.message ? e.message : "Impossibile leggere lo ZIP. Il file potrebbe essere danneggiato.", "error");
  } finally {
    setBusy(false);
  }
}

/* ---------- Interfaccia ---------- */

function renderStats() {
  if (!data.followers) {
    $("stats").innerHTML = "";
    return;
  }

  const box = (n, label) =>
    '<div class="stat"><div class="number">' + Number(n) + '</div><div class="label">' + label + "</div></div>";

  $("stats").innerHTML =
    box(data.followers.length, "Followers totali") +
    box(data.following.length, "Account seguiti") +
    box(data.non.length, "Segui ma non ti seguono") +
    box(data.fan.length, "Ti seguono ma non segui") +
    box(data.pending.length, "Richieste in sospeso");
}

function updateTabs() {
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.tab === currentType && !!data.followers));
  });
}

function mostra(tipo) {
  currentType = tipo;
  current = data[tipo] || [];

  const title = $("title");
  title.textContent = data.followers ? TITLES[tipo] || tipo : "";

  updateTabs();
  render();
  salvaCache();
}

function render() {
  const list = $("list");
  const count = $("count");
  list.textContent = "";

  if (!data.followers) {
    count.textContent = "";
    return;
  }

  const q = $("search").value.trim().toLowerCase();
  const items = current.filter((x) => x.toLowerCase().includes(q));

  count.textContent = items.length + " account" + (q ? " trovati" : "");

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "item empty";
    empty.textContent = q ? "Nessun risultato per questa ricerca." : "Nessun account in questa lista 🎉";
    list.appendChild(empty);
    return;
  }

  const showDate = currentType === "non";
  const frag = document.createDocumentFragment();

  for (const name of items) {
    const item = document.createElement("div");
    item.className = "item";

    const a = document.createElement("a");
    a.className = "account-link" + (visited.has(name) ? " visited-account" : "");
    a.href = "https://instagram.com/" + encodeURIComponent(name);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.dataset.user = name;
    a.textContent = "@" + name;
    item.appendChild(a);

    const date = showDate ? followDates[name.toLowerCase()] : null;
    if (date) {
      const small = document.createElement("div");
      small.className = "since";
      small.textContent = "Segui dal " + date;
      item.appendChild(small);
    }

    frag.appendChild(item);
  }

  list.appendChild(frag);
}

function segnaVisitato(event) {
  const a = event.target.closest && event.target.closest("a.account-link");
  if (!a) return;
  visited.add(a.dataset.user);
  saveVisited();
  a.classList.add("visited-account");
}

/* ---------- Cache locale ---------- */

function salvaCache() {
  if (!data.followers) return;
  const ok = storageSet(CACHE_KEY, JSON.stringify({
    data: data,
    followDates: followDates,
    currentType: currentType,
    search: $("search").value || "",
    scroll: window.scrollY,
    savedAt: Date.now()
  }));
  if (!ok) console.warn("Impossibile salvare la cache locale");
}

function caricaCache() {
  const saved = storageGet(CACHE_KEY);
  if (!saved) return;

  try {
    const cache = JSON.parse(saved);
    if (!cache || !cache.data || !Array.isArray(cache.data.followers)) return;

    data = cache.data;
    followDates = cache.followDates || {};
    currentType = TITLES[cache.currentType] ? cache.currentType : "non";
    current = data[currentType] || [];
    $("search").value = cache.search || "";

    renderStats();
    $("title").textContent = TITLES[currentType];
    updateTabs();
    render();

    if (cache.savedAt) {
      setStatus(
        "Dati ripristinati dall'ultima analisi (" + new Date(cache.savedAt).toLocaleString("it-IT") +
        "). Restano salvati su questo dispositivo finché non premi «Pulisci tutto».",
        "info"
      );
    }

    requestAnimationFrame(() => window.scrollTo(0, cache.scroll || 0));
  } catch (e) {
    console.error("Errore caricamento cache", e);
    storageRemove(CACHE_KEY);
  }
}

function pulisciTutto() {
  if (!confirm("Vuoi davvero cancellare i dati dell'analisi, la sessione salvata e la cronologia degli account visitati?")) return;

  storageRemove(CACHE_KEY);
  storageRemove(VISITED_KEY);
  visited = new Set();

  data = {};
  current = [];
  followDates = {};
  currentType = "non";

  $("stats").innerHTML = "";
  $("title").textContent = "";
  $("list").textContent = "";
  $("count").textContent = "";
  $("search").value = "";
  $("file").value = "";
  updateTabs();
  setStatus("Tutti i dati sono stati cancellati da questo dispositivo.", "ok");
  window.scrollTo(0, 0);
}

/* ---------- Avvio ---------- */

function debounce(fn, ms) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

function init() {
  $("analyzeBtn").addEventListener("click", analizza);
  $("clearBtn").addEventListener("click", pulisciTutto);

  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.addEventListener("click", () => {
      if (!data.followers) return setStatus("Carica prima lo ZIP e premi «Analizza».", "error");
      mostra(b.dataset.tab);
    });
  });

  const saveLater = debounce(salvaCache, 500);

  $("search").addEventListener("input", () => {
    render();
    saveLater();
  });

  $("list").addEventListener("click", segnaVisitato);
  $("list").addEventListener("auxclick", segnaVisitato);

  window.addEventListener("scroll", saveLater, { passive: true });
  window.addEventListener("beforeunload", salvaCache);

  caricaCache();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* facoltativo */ });
  }
}

document.addEventListener("DOMContentLoaded", init);
