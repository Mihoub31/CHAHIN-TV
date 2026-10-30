(() => {
  'use strict';

  const API = 'https://iptv-org.github.io/api/';
  const RADIO_API = 'https://de1.api.radio-browser.info/json/';
  const FREE_TV_M3U = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
  const TMDB_API = 'https://api.themoviedb.org/3/';
  const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w342';
  const VERSION = '2.3';
  const PAGE = 36;
  const RADIO_PAGE = 36;
  const LS = { favs: 'ctv:favs', history: 'ctv:history', playlists: 'ctv:playlists', prefs: 'ctv:prefs', radioStations: 'ctv:radioStations' };
  const DB_NAME = 'chahin-tv';
  const DB_STORE = 'playlists';
  const t = (key, vars) => window.I18N.t(key, vars);
  const tn = (key, n, vars) => window.I18N.tn(key, n, vars);
  const nf = n => window.I18N.number(n);
  const CATS = {
    news: 1, sports: 1, movies: 1, series: 1, kids: 1, music: 1, documentary: 1,
    entertainment: 1, general: 1, religious: 1, animation: 1, auto: 1, business: 1, radio: 1,
    classic: 1, comedy: 1, cooking: 1, culture: 1, education: 1, family: 1,
    legislative: 1, lifestyle: 1, outdoor: 1, relax: 1, science: 1, shop: 1,
    travel: 1, weather: 1, interactive: 1, public: 1, other: 1
  };
  const CONTENT_LANGS = ['fr', 'en', 'ar', 'es', 'de', 'it', 'pt', 'ru', 'tr', 'am', 'hi', 'zh'];
  const REGIONS = ['FR', 'BE', 'CH', 'CA', 'MA', 'DZ', 'TN', 'LU', 'SN', 'CI', 'CM', 'DE', 'AT', 'ES', 'IT', 'PT', 'NL', 'GB', 'IE', 'US', 'TR', 'SA', 'AE', 'EG', 'QA', 'KW', 'RU', 'IN', 'CN', 'BR', 'MX', 'AR', 'CL', 'CO', 'SE', 'NO', 'DK', 'FI', 'PL', 'GR', 'IL', 'JP', 'KR', 'AU', 'NZ', 'ZA', 'NG', 'KE', 'ET'];
  const LANG_ALIASES = {
    french: 'fr', français: 'fr', francais: 'fr', english: 'en', anglais: 'en',
    arabic: 'ar', arabe: 'ar', 'العربية': 'ar', spanish: 'es', español: 'es',
    espagnol: 'es', german: 'de', allemand: 'de', italian: 'it', italien: 'it',
    portuguese: 'pt', portugais: 'pt', russian: 'ru', russe: 'ru', turkish: 'tr',
    turc: 'tr', amharic: 'am', hindi: 'hi', chinese: 'zh', mandarin: 'zh'
  };

  const DEFAULT_PREFS = {
    lang: 'system',
    onboarded: false,
    region: '',
    timeFormat: 'auto',
    theme: {
      source: 'manual',
      manual: 'dark',
      schedule: 'off',
      nightStart: '22:00',
      nightEnd: '07:00',
      lat: null,
      lon: null,
      intensity: 60,
      panelAlpha: 55,
      motion: true,
      contrast: 'normal'
    },
    content: { audio: 'auto', subtitles: 'off', metadata: 'auto', channelLangs: [] },
    media: { tmdbApiKey: '' }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const debounce = (fn, ms = 120) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0; return h; };
  const tint = id => { const h = hash(String(id)) % 360; return `linear-gradient(135deg,hsl(${h} 55% 20%),hsl(${(h + 45) % 360} 60% 10%))`; };
  const initials = name => {
    const parts = String(name || '').replace(/[^\w\u00C0-\u024F\u0400-\u04FF]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    return (((parts[0] || '')[0] || '') + ((parts[1] || parts[0] || '')[1] || '')).toUpperCase() || 'CH';
  };
  let regionNames = null;
  let regionNamesLang = '';
  function countryName(code, fallback) {
    if (code && /^[A-Za-z]{2}$/.test(code)) {
      const lang = window.I18N.getLang();
      if (!regionNames || regionNamesLang !== lang) {
        try { regionNames = new Intl.DisplayNames([lang], { type: 'region' }); } catch (e) { regionNames = null; }
        regionNamesLang = lang;
      }
      try {
        const n = regionNames && regionNames.of(code.toUpperCase());
        if (n && n !== code.toUpperCase()) return n;
      } catch (e) { /* unknown region code */ }
    }
    return fallback || code || '';
  }

  function mergePrefs(base, extra) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!extra || typeof extra !== 'object') return out;
    for (const key of Object.keys(extra)) {
      const value = extra[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        out[key] = mergePrefs(base[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  function loadPrefs() {
    const raw = readJSON(LS.prefs, null);
    const prefs = mergePrefs(JSON.parse(JSON.stringify(DEFAULT_PREFS)), raw || {});
    if (prefs.lang !== 'system' && !window.I18N.supported.includes(prefs.lang)) prefs.lang = 'system';
    if (!['manual', 'system'].includes(prefs.theme.source)) prefs.theme.source = 'manual';
    if (!['light', 'dark', 'night'].includes(prefs.theme.manual)) prefs.theme.manual = 'dark';
    if (!['off', 'fixed', 'sun'].includes(prefs.theme.schedule)) prefs.theme.schedule = 'off';
    if (!['normal', 'high'].includes(prefs.theme.contrast)) prefs.theme.contrast = 'normal';
    prefs.theme.intensity = Math.max(0, Math.min(100, Number(prefs.theme.intensity) || 0));
    prefs.theme.panelAlpha = Math.max(0, Math.min(100, Number(prefs.theme.panelAlpha) || 0));
    prefs.theme.lat = prefs.theme.lat == null ? null : Number(prefs.theme.lat);
    prefs.theme.lon = prefs.theme.lon == null ? null : Number(prefs.theme.lon);
    if (!Array.isArray(prefs.content.channelLangs)) prefs.content.channelLangs = [];
    if (!prefs.media || typeof prefs.media !== 'object') prefs.media = {};
    prefs.media.tmdbApiKey = typeof prefs.media.tmdbApiKey === 'string' ? prefs.media.tmdbApiKey.trim() : '';
    return prefs;
  }
  const prefs = loadPrefs();

  function savePrefs() {
    writeJSON(LS.prefs, prefs);
  }

  function systemPrefersDark() {
    try {
      if (window.ChahinNative && typeof window.ChahinNative.systemDark === 'function') {
        return String(window.ChahinNative.systemDark()) === '1';
      }
    } catch (e) { /* bridge unavailable */ }
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return true; }
  }
  function uiLang() {
    if (prefs.lang === 'system') return window.I18N.systemLang();
    return window.I18N.supported.includes(prefs.lang) ? prefs.lang : 'fr';
  }

  function readJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function safeHttp(raw) {
    try {
      const u = new URL(String(raw), location.href);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
    } catch (e) { return ''; }
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, '') || url; } catch (e) { return url; }
  }

  const state = {
    tv: document.documentElement.getAttribute('data-tv') === '1',
    builtin: [], playlistChannels: [], all: [], byId: new Map(),
    countries: new Map(), cats: [], langs: [],
    catalogSourceError: '',
    radioItems: [], radioStations: new Map(), radioTags: [],
    radioTag: '', radioQuery: '', radioOffset: 0, radioHasMore: true,
    radioLoaded: false, radioLoading: false, radioTagsLoaded: false,
    radioError: '', radioTagsError: '',
    mediaKind: 'movies', mediaQuery: '',
    mediaItems: { movies: [], series: [], anime: [] },
    mediaPage: { movies: 1, series: 1, anime: 1 },
    mediaTotalPages: { movies: 1, series: 1, anime: 1 },
    mediaLoaded: { movies: false, series: false, anime: false },
    mediaLoading: false, mediaError: '',
    playlists: [], favs: new Set(), history: [],
    view: 'home', cat: '', country: '', query: '', limit: PAGE,
    loading: true, loadingCatalog: false, updatedAt: 0,
    detail: null, player: null, srcIndex: 0, lastFocus: null,
    searchResults: []
  };

  let hls = null;
  let playToken = 0;
  let srcTimer = null;
  let toastTimer = null;
  let plTab = 'url';
  let searchTimer = null;
  let radioRequestToken = 0;
  let radioAbort = null;
  let radioRequestQueue = Promise.resolve();
  let radioLastRequestAt = 0;
  let mediaAbort = null;
  let mediaRequestToken = 0;

  const video = $('#video');

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('no-idb'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb'));
    });
  }
  async function idbAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const rq = tx.objectStore(DB_STORE).getAll();
      rq.onsuccess = () => resolve(rq.result || []);
      rq.onerror = () => reject(rq.error);
    });
  }
  async function idbPut(pl) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(pl);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function idbDelete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function readPlaylists() {
    try {
      const list = await idbAll();
      return list.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    } catch (e) {
      return readJSON(LS.playlists, []);
    }
  }
  async function writePlaylist(pl) {
    try { await idbPut(pl); } catch (e) {
      const list = readJSON(LS.playlists, []).filter(x => x.id !== pl.id);
      list.push(pl);
      writeJSON(LS.playlists, list);
    }
  }
  async function deletePlaylist(id) {
    try { await idbDelete(id); } catch (e) { /* ignore */ }
    const list = readJSON(LS.playlists, []).filter(x => x.id !== id);
    writeJSON(LS.playlists, list);
  }

  function catLabel(key) {
    if (!key) return '';
    if (CATS[key]) return t('cat.' + key);
    if (key === 'g:__other') return t('cat.other');
    if (key.startsWith('g:')) return key.slice(2);
    if (key.startsWith('rt:')) return key.slice(3);
    return key;
  }
  function countryLabel(c) {
    if (!c) return '';
    const meta = c.country ? state.countries.get(c.country) : null;
    const name = countryName(c.country, c.countryName || (meta && meta.name) || c.country || '');
    const flag = meta && meta.flag ? meta.flag + ' ' : '';
    return (flag + name).trim();
  }
  function timeAgo(ts) {
    return window.I18N.relative(ts);
  }
  function fmtTime(s) {
    if (!isFinite(s)) return '0:00';
    s = Math.max(0, Math.floor(s));
    const m = Math.floor(s / 60), sec = s % 60, h = Math.floor(m / 60);
    return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- Thèmes : clair, sombre, nuit ---------- */
  const RAD = Math.PI / 180;
  const DAY_MS = 86400000;
  const J1970 = 2440588;
  const J2000 = 2451545;
  let onboardLang = 'system';

  function minutesOf(value) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
    if (!m) return null;
    return Math.min(1439, Math.max(0, (+m[1]) * 60 + (+m[2])));
  }
  function fixedNightActive(now = new Date()) {
    const th = prefs.theme;
    const start = minutesOf(th.nightStart);
    const end = minutesOf(th.nightEnd);
    if (start == null || end == null || start === end) return false;
    const mins = now.getHours() * 60 + now.getMinutes();
    return start < end ? (mins >= start && mins < end) : (mins >= start || mins < end);
  }
  function toJulian(date) { return date.valueOf() / DAY_MS - 0.5 + J1970; }
  function toDays(date) { return toJulian(date) - J2000; }
  function solarMeanAnomaly(d) { return RAD * (357.5291 + 0.98560028 * d); }
  function eclipticLongitude(M) {
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = RAD * 102.9372;
    return M + C + P + Math.PI;
  }
  function sunAltitude(date, lat, lng) {
    const lw = RAD * -lng;
    const phi = RAD * lat;
    const d = toDays(date);
    const M = solarMeanAnomaly(d);
    const L = eclipticLongitude(M);
    const dec = Math.asin(Math.sin(L) * Math.sin(RAD * 23.4397));
    const ra = Math.atan2(Math.sin(L) * Math.cos(RAD * 23.4397), Math.cos(L));
    const H = RAD * (280.16 + 360.9856235 * d) - lw - ra;
    return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
  }
  function sunNightNow(now = new Date()) {
    const th = prefs.theme;
    if (th.lat == null || th.lon == null) return false;
    return sunAltitude(now, th.lat, th.lon) < -0.833;
  }
  function sunEvents(now = new Date()) {
    const th = prefs.theme;
    if (th.lat == null || th.lon == null) return null;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let prev = sunAltitude(start, th.lat, th.lon);
    let rise = null;
    let set = null;
    for (let i = 1; i <= 288; i++) {
      const time = new Date(start.getTime() + i * 5 * 60000);
      const alt = sunAltitude(time, th.lat, th.lon);
      if (!rise && prev < -0.833 && alt >= -0.833) rise = time;
      if (!set && prev >= -0.833 && alt < -0.833) set = time;
      prev = alt;
    }
    return { rise, set };
  }
  function nightWindowActive() {
    const schedule = prefs.theme.schedule;
    if (schedule === 'fixed') return fixedNightActive();
    if (schedule === 'sun') return sunNightNow();
    return false;
  }
  function resolveTheme() {
    const th = prefs.theme;
    if (nightWindowActive()) return 'night';
    if (th.source === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return th.manual;
  }
  function motionReduced() {
    if (!prefs.theme.motion) return true;
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function applyTheme() {
    const th = prefs.theme;
    const mode = resolveTheme();
    const root = document.documentElement;
    if (root.getAttribute('data-theme') !== mode) root.setAttribute('data-theme', mode);
    root.setAttribute('data-contrast', th.contrast === 'high' ? 'high' : 'normal');
    root.classList.toggle('no-motion', motionReduced());
    root.style.setProperty('--night-veil', (mode === 'night' ? (th.intensity / 100) * 0.32 : 0).toFixed(3));
    root.style.setProperty('--panel-a-mul', (mode === 'night' ? 1 - (th.panelAlpha / 100) * 0.65 : 1).toFixed(3));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'light' ? '#eef5f9' : mode === 'night' ? '#01060a' : '#040b12');
    const label = $('#themeActive');
    if (label) {
      const scheduled = th.schedule !== 'off' && nightWindowActive();
      label.textContent = scheduled
        ? t('appearance.activeNight')
        : t('appearance.active', { theme: t('theme.' + mode) });
      label.classList.toggle('ok', scheduled);
    }
  }
  function setupThemeWatch() {
    const tick = () => {
      if (prefs.theme.schedule !== 'off' || prefs.theme.source === 'system') applyTheme();
      if (prefs.theme.schedule === 'sun') renderGeoStatus();
    };
    setInterval(tick, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    try {
      const dark = window.matchMedia('(prefers-color-scheme: dark)');
      const onScheme = () => { if (prefs.theme.source === 'system') applyTheme(); };
      if (dark.addEventListener) dark.addEventListener('change', onScheme);
      else if (dark.addListener) dark.addListener(onScheme);
    } catch (e) { /* ignore */ }
    try {
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onMotion = () => applyTheme();
      if (motion.addEventListener) motion.addEventListener('change', onMotion);
      else if (motion.addListener) motion.addListener(onMotion);
    } catch (e) { /* ignore */ }
  }

  /* ---------- Langues ---------- */
  function normalizeLangCode(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return '';
    const base = value.replace('_', '-').split('-')[0];
    if (CONTENT_LANGS.includes(base)) return base;
    return LANG_ALIASES[value] || '';
  }
  function normalizeLangList(raw) {
    const out = [];
    String(raw || '').split(/[,;/|]+/).forEach(item => {
      const code = normalizeLangCode(item);
      if (code && CONTENT_LANGS.includes(code) && !out.includes(code)) out.push(code);
    });
    return out;
  }
  function langName(code) {
    if (!code) return '';
    try {
      const dn = new Intl.DisplayNames([uiLang()], { type: 'language' });
      const name = dn.of(code);
      if (name && name !== code) return name;
    } catch (e) { /* ignore */ }
    const key = 'language.lang_' + code;
    const fallback = t(key);
    return fallback === key ? code : fallback;
  }
  function autonym(code) {
    try {
      const dn = new Intl.DisplayNames([code], { type: 'language' });
      const name = dn.of(code);
      if (name) return name;
    } catch (e) { /* ignore */ }
    return langName(code);
  }
  function availableLangs() {
    return Array.isArray(state.langs) ? state.langs : [];
  }
  function contentLangOptions() {
    return CONTENT_LANGS.map(code => ({ code, name: langName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, window.I18N.locale(), { sensitivity: 'base' }));
  }
  function fillContentSelect(sel, value, allowOff) {
    if (!sel) return;
    const opts = [`<option value="auto">${esc(t('language.contentAuto'))}</option>`];
    if (allowOff) opts.push(`<option value="off">${esc(t('language.contentOff'))}</option>`);
    contentLangOptions().forEach(x => opts.push(`<option value="${esc(x.code)}">${esc(x.name)}</option>`));
    sel.innerHTML = opts.join('');
    sel.value = value || 'auto';
    if (sel.value !== (value || 'auto')) sel.value = 'auto';
  }
  function buildRegionOptions() {
    const sel = $('#regionSelect');
    if (!sel) return;
    let dn = null;
    try { dn = new Intl.DisplayNames([uiLang()], { type: 'region' }); } catch (e) { dn = null; }
    const items = REGIONS.map(code => {
      let name = code;
      try {
        const n = dn && dn.of(code);
        if (n && n !== code) name = n;
      } catch (e) { /* unknown region */ }
      return { code, name };
    }).sort((a, b) => a.name.localeCompare(b.name, window.I18N.locale(), { sensitivity: 'base' }));
    sel.innerHTML = `<option value="">${esc(t('language.regionAuto'))}</option>` +
      items.map(x => `<option value="${esc(x.code)}">${esc(x.name)}</option>`).join('');
    sel.value = prefs.region || '';
    if (sel.value !== (prefs.region || '')) {
      prefs.region = '';
      sel.value = '';
      savePrefs();
    }
  }
  function langChipsHTML(selected) {
    const langs = availableLangs();
    const all = !selected.length;
    return `<button type="button" class="chip focusable${all ? ' on' : ''}" data-lang="">${esc(t('channels.langAll'))}</button>` +
      langs.map(code => `<button type="button" class="chip focusable${selected.includes(code) ? ' on' : ''}" data-lang="${esc(code)}">${esc(langName(code))}</button>`).join('');
  }
  function renderChannelLangChips() {
    const wrap = $('#chLangs');
    if (!wrap) return;
    const langs = availableLangs();
    wrap.hidden = langs.length === 0;
    wrap.innerHTML = langs.length ? langChipsHTML(prefs.content.channelLangs) : '';
  }
  function renderAppearance() {
    const th = prefs.theme;
    $$('#themeSeg [data-theme-choice]').forEach(b => b.classList.toggle('on', b.dataset.themeChoice === th.manual));
    $$('#themeSourceSeg [data-theme-source]').forEach(b => b.classList.toggle('on', b.dataset.themeSource === th.source));
    $$('#nightScheduleSeg [data-schedule]').forEach(b => b.classList.toggle('on', b.dataset.schedule === th.schedule));
    $('#themeSourceHint').textContent = th.source === 'system' ? t('appearance.followSystemHint') : t('appearance.manualHint');
    $('#nightTimes').hidden = th.schedule !== 'fixed';
    $('#geoRow').hidden = th.schedule !== 'sun';
    $('#nightStart').value = th.nightStart || '22:00';
    $('#nightEnd').value = th.nightEnd || '07:00';
    $('#nightIntensity').value = String(th.intensity);
    $('#nightIntensityVal').textContent = nf(th.intensity) + '%';
    $('#panelAlpha').value = String(th.panelAlpha);
    $('#panelAlphaVal').textContent = nf(th.panelAlpha) + '%';
    $('#motionSwitch').setAttribute('aria-checked', String(!th.motion));
    $('#contrastSwitch').setAttribute('aria-checked', String(th.contrast === 'high'));
    renderGeoStatus();
    applyTheme();
  }
  function renderGeoStatus() {
    const el = $('#geoStatus');
    if (!el) return;
    const th = prefs.theme;
    el.classList.remove('ok', 'err');
    if (th.schedule !== 'sun') { el.textContent = ''; return; }
    if (th.lat == null || th.lon == null) {
      el.textContent = t('appearance.needLocation');
      el.classList.add('err');
      return;
    }
    const ev = sunEvents();
    if (ev && ev.rise && ev.set) {
      el.textContent = t('appearance.locationOk', {
        rise: window.I18N.formatTime(ev.rise),
        set: window.I18N.formatTime(ev.set)
      });
    } else {
      el.textContent = t('appearance.locationPolar');
    }
    el.classList.add('ok');
  }
  function requestLocation() {
    const status = $('#geoStatus');
    const setStatus = (message, kind) => {
      if (!status) return;
      status.textContent = message;
      status.classList.remove('ok', 'err');
      if (kind) status.classList.add(kind);
    };
    if (!navigator.geolocation) {
      setStatus(t('appearance.locationDenied'), 'err');
      return;
    }
    setStatus(t('common.loading'));
    navigator.geolocation.getCurrentPosition(
      pos => {
        prefs.theme.lat = Number(pos.coords.latitude.toFixed(4));
        prefs.theme.lon = Number(pos.coords.longitude.toFixed(4));
        savePrefs();
        renderGeoStatus();
        applyTheme();
      },
      () => setStatus(t('appearance.locationDenied'), 'err'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
    );
  }
  function renderLanguageSettings() {
    const langSel = $('#langSelect');
    if (langSel) langSel.value = prefs.lang;
    buildRegionOptions();
    const timeSel = $('#timeFormatSelect');
    if (timeSel) timeSel.value = prefs.timeFormat;
    fillContentSelect($('#audioPref'), prefs.content.audio, false);
    fillContentSelect($('#subsPref'), prefs.content.subtitles, true);
    fillContentSelect($('#metaPref'), prefs.content.metadata, false);
    const wrap = $('#channelLangChips');
    const status = $('#channelLangStatus');
    const langs = availableLangs();
    if (wrap) wrap.innerHTML = langs.length ? langChipsHTML(prefs.content.channelLangs) : '';
    if (status) status.textContent = langs.length ? '' : t('language.noLangs');
    if (langs.length) {
      const pruned = prefs.content.channelLangs.filter(code => langs.includes(code));
      if (pruned.length !== prefs.content.channelLangs.length) {
        prefs.content.channelLangs = pruned;
        savePrefs();
      }
    }
  }
  function applyLanguage() {
    const lang = uiLang();
    window.I18N.setLang(lang);
    window.I18N.setRegion(prefs.region || '');
    window.I18N.setHour12(prefs.timeFormat === '12' ? true : prefs.timeFormat === '24' ? false : null);
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    window.I18N.applyStatic();
    rebuildFacets();
    renderAll();
    renderOnboardText();
    if (state.detail) refreshDetail();
    refreshPlayerText();
    if (!$('#pSourceSheet').hidden) renderSourceSheet();
  }

  /* ---------- Pistes audio / sous-titres ---------- */
  function trackMatches(track, code) {
    return normalizeLangCode(track && (track.language || track.lang || track.name)) === code;
  }
  function pickTrack(list, code) {
    if (!Array.isArray(list) || !list.length) return -1;
    if (!code || code === 'auto') return 0;
    return list.findIndex(tr => trackMatches(tr, code));
  }
  function applyMediaTracks() {
    const audio = prefs.content.audio;
    const subs = prefs.content.subtitles;
    if (hls) {
      if (hls.audioTracks && hls.audioTracks.length > 1 && audio !== 'auto') {
        const idx = pickTrack(hls.audioTracks, audio);
        if (idx >= 0 && hls.audioTrack !== idx) hls.audioTrack = idx;
      }
      if (hls.subtitleTracks && hls.subtitleTracks.length) {
        hls.subtitleDisplay = subs !== 'off';
        if (subs !== 'auto') {
          hls.subtitleTrack = subs === 'off' ? -1 : pickTrack(hls.subtitleTracks, subs);
        }
      }
      return;
    }
    const tracks = video.textTracks ? Array.from(video.textTracks) : [];
    for (const tr of tracks) {
      if (tr.kind !== 'subtitles' && tr.kind !== 'captions') continue;
      if (subs === 'off') { tr.mode = 'disabled'; continue; }
      if (subs === 'auto') continue;
      tr.mode = trackMatches(tr, subs) ? 'showing' : 'disabled';
    }
  }

  /* ---------- Onboarding ---------- */
  function renderOnboardText() {
    const overlay = $('#onboardOverlay');
    if (!overlay) return;
    $('#onboardTitle').textContent = t('onboard.title');
    $('#onboardBody').textContent = t('onboard.body');
    $('#onboardContinue').textContent = t('onboard.continue');
    $('#onboardSystem').textContent = t('onboard.system', { lang: autonym(window.I18N.systemLang()) });
    $$('#onboardOverlay [data-onboard-lang]').forEach(b => b.classList.toggle('on', b.dataset.onboardLang === onboardLang));
  }
  function openOnboard() {
    onboardLang = prefs.lang;
    $('#onboardOverlay').hidden = false;
    renderOnboardText();
    syncLock();
    setTimeout(() => {
      const el = $('#onboardOverlay [data-onboard-lang="' + onboardLang + '"]') || $('#onboardContinue');
      if (el) el.focus();
    }, 90);
  }
  function finishOnboarding() {
    prefs.lang = onboardLang;
    prefs.onboarded = true;
    savePrefs();
    $('#onboardOverlay').hidden = true;
    applyLanguage();
    syncLock();
    restoreFocus();
  }

  function parseM3U(text, pl) {
    const out = [];
    let current = null;
    const lines = String(text || '').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^#EXTINF/i.test(line)) {
        const attrs = {};
        line.replace(/([\w-]+)="([^"]*)"/g, (m, k, v) => { attrs[k.toLowerCase()] = v; return ''; });
        const comma = line.lastIndexOf(',');
        const rawName = (comma >= 0 ? line.slice(comma + 1) : attrs['tvg-name'] || '').trim();
        const name = rawName || t('channel.unnamed');
        current = { name, attrs };
      } else if (/^#EXTGRP:/i.test(line) && current) {
        current.attrs['group-title'] = line.split(':').slice(1).join(':').trim();
      } else if (/^#/.test(line)) {
        continue;
      } else if (current) {
        const url = safeHttp(line);
        if (url) {
          const group = (current.attrs['group-title'] || '').trim();
          const isRadio = /\bradio\b/i.test(group) || /^(true|1|yes)$/i.test(current.attrs.radio || '') ||
            /\b(audio|radio)\b/i.test(current.attrs['tvg-type'] || current.attrs['media-type'] || '');
          const tvgId = current.attrs['tvg-id'] || '';
          const logo = safeHttp(current.attrs['tvg-logo'] || '');
          const cc = (current.attrs['tvg-country'] || '').toUpperCase();
          const country = /^[A-Z]{2}$/.test(cc) ? cc : '';
          out.push({
            id: 'pl:' + pl.id + ':' + hash((tvgId || current.name) + '|' + url),
            name: current.name,
            logo,
            urls: [url],
            type: isRadio ? 'radio' : 'tv',
            cats: isRadio ? ['radio', group ? 'g:' + group : 'g:__other'] : [group ? 'g:' + group : 'g:__other'],
            country,
            countryName: '',
            langs: normalizeLangList(current.attrs['tvg-language']),
            source: pl.id,
            sourceName: pl.name
          });
        }
        current = null;
      }
    }
    return out;
  }

  async function fetchJSON(name) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(API + name + '.json', { signal: ctrl.signal, cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadBuiltin() {
    const freeTvPromise = fetchPlaylistText(FREE_TV_M3U)
      .then(text => parseM3U(text, { id: 'free-tv', name: 'Free TV/IPTV' }))
      .catch(error => {
        state.catalogSourceError = error.message || 'network';
        console.warn('Free TV/IPTV catalog unavailable', error);
        return [];
      });
    const [channels, streams, logos, countries] = await Promise.all(
      ['channels', 'streams', 'logos', 'countries'].map(fetchJSON)
    );
    const freeTvChannels = await freeTvPromise;

    const countryMap = new Map(countries.map(c => [c.code, { name: c.name || c.code, flag: c.flag || '' }]));
    const urlsByChannel = new Map();
    const extraStreams = [];

    for (const s of streams) {
      const url = safeHttp(s.url);
      if (!url) continue;
      if (s.channel) {
        if (!urlsByChannel.has(s.channel)) urlsByChannel.set(s.channel, new Set());
        urlsByChannel.get(s.channel).add(url);
      } else {
        extraStreams.push({ title: s.title, url });
      }
    }

    const logoByChannel = new Map();
    for (const l of logos) {
      if (!l.channel) continue;
      const url = safeHttp(l.url);
      if (!url) continue;
      const prev = logoByChannel.get(l.channel);
      if (!prev || (l.in_use && !prev.inUse)) logoByChannel.set(l.channel, { url, inUse: !!l.in_use });
    }

    const list = [];
    const seenUrls = new Set();

    for (const c of channels) {
      if (c.closed) continue;
      const set = urlsByChannel.get(c.id);
      if (!set || !set.size) continue;
      const urls = Array.from(set);
      urls.forEach(u => seenUrls.add(u));
      const logo = logoByChannel.get(c.id);
      const meta = countryMap.get(c.country);
      list.push({
        id: c.id,
        name: (c.name || c.id).trim(),
        logo: logo ? logo.url : '',
        urls,
        cats: (c.categories && c.categories.length) ? c.categories.slice() : ['other'],
        country: c.country || '',
        countryName: meta ? meta.name : '',
        langs: [],
        source: 'iptv-org',
        sourceName: 'iptv-org'
      });
    }

    for (const s of extraStreams) {
      if (seenUrls.has(s.url)) continue;
      seenUrls.add(s.url);
      list.push({
        id: 'x:' + hash(s.url).toString(36),
        name: (s.title || hostOf(s.url) || t('channel.unnamed')).trim(),
        logo: '', urls: [s.url], cats: ['other'], country: '', countryName: '',
        langs: [], source: 'iptv-org', sourceName: 'iptv-org'
      });
    }

    list.sort((a, b) => a.name.localeCompare(b.name, window.I18N.locale(), { sensitivity: 'base' }));
    freeTvChannels.sort((a, b) => a.name.localeCompare(b.name, window.I18N.locale(), { sensitivity: 'base' }));

    state.countries = countryMap;
    state.builtin = [...list, ...freeTvChannels];
  }

  async function fetchPlaylistText(rawUrl) {
    if (!/^https?:\/\//i.test(String(rawUrl || '').trim())) throw new Error(t('error.invalidUrl'));
    const url = safeHttp(rawUrl);
    if (!url) throw new Error(t('error.invalidLink'));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (!text.trim()) throw new Error(t('error.emptyResponse'));
      return text;
    } catch (err) {
      if (window.ChahinNative && typeof window.ChahinNative.fetchText === 'function') {
        let text;
        try { text = window.ChahinNative.fetchText(url); }
        catch (e) { throw new Error(t('error.download', { msg: e.message || t('error.invalidLink') })); }
        if (typeof text === 'string' && text.startsWith('ERR:')) throw new Error(t('error.download', { msg: text.slice(4) }));
        if (typeof text === 'string' && text.trim()) return text;
      }
      throw new Error(t('error.downloadBlocked'));
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensurePlaylistContents() {
    const pending = state.playlists.filter(pl => !pl.content && pl.url);
    await Promise.allSettled(pending.map(async pl => {
      try {
        const content = await fetchPlaylistText(pl.url);
        pl.content = content;
        pl.count = parseM3U(content, pl).length;
        await writePlaylist(pl);
      } catch (e) {
        console.warn('Playlist indisponible', pl.name, e);
      }
    }));
  }

  function mergeChannels() {
    const parsed = [];
    for (const pl of state.playlists) {
      if (!pl.content) { pl.count = 0; continue; }
      const chans = parseM3U(pl.content, pl);
      pl.count = chans.length;
      parsed.push(...chans);
    }
    state.playlistChannels = parsed;

    const seen = new Set();
    const merged = [];
    for (const c of [...state.playlistChannels, ...state.builtin]) {
      const key = c.urls[0];
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
    state.all = merged;
    state.byId = new Map(merged.map(c => [c.id, c]));
    state.radioStations.forEach(c => state.byId.set(c.id, c));

    for (const c of state.playlistChannels) {
      if (c.country && state.countries.has(c.country)) {
        const meta = state.countries.get(c.country);
        c.countryName = meta.name;
      }
    }
  }

  function categoryList() {
    const keys = new Set();
    for (const c of state.all) {
      if (c.type === 'radio') continue;
      c.cats.forEach(k => keys.add(k));
    }
    const out = [{ key: '', label: t('common.all') }];
    for (const key of Object.keys(CATS)) {
      if (key === 'other') continue;
      if (keys.has(key)) out.push({ key, label: t('cat.' + key) });
    }
    [...keys].filter(k => k.startsWith('g:')).sort((a, b) => catLabel(a).localeCompare(catLabel(b), window.I18N.locale(), { sensitivity: 'base' }))
      .forEach(k => out.push({ key: k, label: catLabel(k) }));
    [...keys].filter(k => !CATS[k] && !k.startsWith('g:')).sort()
      .forEach(k => out.push({ key: k, label: k }));
    if (keys.has('other')) out.push({ key: 'other', label: t('cat.other') });
    return out;
  }

  function rebuildFacets() {
    state.cats = categoryList();
    const langSet = new Set();
    for (const c of state.all) (c.langs || []).forEach(code => { if (code) langSet.add(code); });
    state.langs = Array.from(langSet)
      .sort((a, b) => langName(a).localeCompare(langName(b), window.I18N.locale(), { sensitivity: 'base' }));
    const codes = new Set(state.all.map(c => c.country).filter(Boolean));
    const items = Array.from(codes).map(code => {
      const meta = state.countries.get(code) || { name: code, flag: '' };
      return { code, name: countryName(code, meta.name), flag: meta.flag };
    }).sort((a, b) => a.name.localeCompare(b.name, window.I18N.locale(), { sensitivity: 'base' }));
    $('#chCountry').innerHTML = `<option value="">${esc(t('channels.countryAll'))}</option>` + items.map(x =>
      `<option value="${esc(x.code)}">${esc((x.flag ? x.flag + ' ' : '') + x.name)}</option>`
    ).join('');
  }

  function chipsHTML(list, active) {
    return list.map(c => `<button type="button" class="chip focusable${c.key === active ? ' on' : ''}" data-cat="${esc(c.key)}">${esc(c.label)}</button>`).join('');
  }

  function cardHTML(c) {
    const fav = state.favs.has(c.id);
    const sub = [countryLabel(c), catLabel(c.cats[0] || '')].filter(Boolean).join(' · ');
    return `<article class="card" data-id="${esc(c.id)}" tabindex="0" role="button" aria-label="${esc(t('aria.view', { name: c.name }))}">
      <div class="card-logo" style="background:${tint(c.id)}">
        <span class="ph" aria-hidden="true">${esc(initials(c.name))}</span>
        ${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.parentNode.classList.add('has-logo')" onerror="this.remove()">` : ''}
        <span class="card-play"><svg class="ic fill"><use href="#i-play"/></svg></span>
        <button type="button" class="card-fav${fav ? ' on' : ''}" data-fav="${esc(c.id)}" aria-label="${esc(t(fav ? 'aria.favRemove' : 'aria.favAdd'))}" aria-pressed="${fav}"><svg class="ic${fav ? ' fill' : ''}"><use href="#i-heart"/></svg></button>
      </div>
      <span class="card-name">${esc(c.name)}</span>
      <span class="card-sub">${esc(sub || t('common.international'))}</span>
    </article>`;
  }

  function continueCardHTML(c, at) {
    return `<button type="button" class="cw focusable" data-play="${esc(c.id)}">
      <span class="cw-logo" style="background:${tint(c.id)}"><span class="ph" aria-hidden="true">${esc(initials(c.name))}</span>${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onload="this.parentNode.classList.add('has-logo')" onerror="this.remove()">` : ''}</span>
      <span class="cw-info"><b>${esc(c.name)}</b><small>${esc(timeAgo(at))}</small></span>
      <span class="cw-play"><svg class="ic fill"><use href="#i-play"/></svg></span>
    </button>`;
  }

  function renderSkeletons() {
    const skel = Array.from({ length: 6 }, () => '<div class="card skel"><div class="card-logo"></div><div class="bar"></div><div class="bar short"></div></div>').join('');
    $('#featuredGrid').innerHTML = skel;
    $('#homeGrid').innerHTML = skel;
  }

  function renderHero() {
    const pool = state.all.filter(c => c.type !== 'radio' && c.logo);
    if (!pool.length) { $('#hero').innerHTML = ''; return; }
    const day = new Date().toISOString().slice(0, 10);
    const c = pool[hash('hero-' + day) % pool.length];
    const meta = [countryLabel(c), catLabel(c.cats[0] || '')].filter(Boolean).join(' · ');
    $('#hero').innerHTML = `
      <div class="hero-bg" style="background:${tint(c.id)}">${c.logo ? `<img src="${esc(c.logo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
      <span class="hero-mark" aria-hidden="true">${esc(initials(c.name))}</span>
      <div class="hero-shade"></div>
      <div class="hero-content">
        <span class="eyebrow"><span class="dot"></span> ${esc(t('hero.featured'))}</span>
        <h1>${esc(c.name)}</h1>
        <p class="hero-meta">${esc(meta || t('hero.international'))}</p>
        <div class="hero-actions">
          <button type="button" class="btn primary focusable" data-play="${esc(c.id)}"><svg class="ic fill"><use href="#i-play"/></svg> ${esc(t('hero.watch'))}</button>
          <button type="button" class="btn ghost focusable" data-info="${esc(c.id)}"><svg class="ic"><use href="#i-info"/></svg> ${esc(t('hero.details'))}</button>
        </div>
      </div>`;
  }

  function renderContinueRow() {
    const items = state.history
      .map(h => ({ c: state.byId.get(h.id), at: h.at }))
      .filter(x => x.c)
      .slice(0, 12);
    $('#continueBlock').hidden = items.length === 0;
    $('#continueRow').innerHTML = items.map(x => continueCardHTML(x.c, x.at)).join('');
  }

  function renderCategoryShelves() {
    const groups = new Map();
    for (const c of state.all) {
      if (c.type === 'radio') continue;
      for (const key of c.cats) {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
      }
    }
    $('#categoryShelves').innerHTML = state.cats
      .filter(cat => cat.key && groups.has(cat.key))
      .map(cat => {
        const channels = groups.get(cat.key);
        return `<section class="block category-shelf">
          <div class="block-head"><h2>${esc(t('home.category', { category: cat.label }))}</h2>
            <button class="link-btn focusable" type="button" data-home-category="${esc(cat.key)}">${esc(t('common.seeAll'))}</button>
          </div>
          <div class="hscroll category-row" aria-label="${esc(cat.label)}">
            ${channels.slice(0, 18).map(cardHTML).join('')}
          </div>
        </section>`;
      }).join('');
  }

  function renderHome() {
    renderHero();
    renderContinueRow();
    $('#homeCats').innerHTML = chipsHTML(state.cats, state.cat);
    const channels = state.all.filter(c => c.type !== 'radio');
    const featured = channels.filter(c => c.logo).slice(0, 12);
    $('#featuredGrid').innerHTML = featured.map(cardHTML).join('');
    renderCategoryShelves();
    const list = channels.slice(0, state.limit);
    $('#homeGrid').innerHTML = list.map(cardHTML).join('');
    $('#homeMore').hidden = channels.length <= state.limit;
    $('#homeEmpty').hidden = state.loading || channels.length > 0;
    $('#catalogCount').textContent = channels.length ? tn('count.channels', channels.length) : '';
    $('#homeTotal').textContent = channels.length ? t('home.of', { a: nf(list.length), b: nf(channels.length) }) : '';
  }

  function filteredChannels() {
    const q = state.query.trim().toLowerCase();
    const langFilter = prefs.content.channelLangs;
    return state.all.filter(c => {
      if (c.type === 'radio') return false;
      if (state.cat && !c.cats.includes(state.cat)) return false;
      if (state.country && c.country !== state.country) return false;
      if (langFilter.length) {
        const langs = c.langs || [];
        if (langs.length && !langs.some(code => langFilter.includes(code))) return false;
      }
      if (q) {
        const hay = (c.name + ' ' + (c.countryName || '') + ' ' + c.country + ' ' + c.cats.map(catLabel).join(' ')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderChannels() {
    $('#chCats').innerHTML = chipsHTML(state.cats, state.cat);
    renderChannelLangChips();
    const note = $('#chLangNote');
    if (note) {
      const active = availableLangs().length > 0 && prefs.content.channelLangs.length > 0;
      note.hidden = !active;
      if (active) note.textContent = t('language.filterActive');
    }
    const list = filteredChannels();
    $('#chGrid').innerHTML = list.slice(0, state.limit).map(cardHTML).join('');
    $('#chCount').textContent = list.length ? tn('count.channels', list.length) : '';
    $('#chEmpty').hidden = list.length > 0;
    $('#chMore').hidden = list.length <= state.limit;
  }

  function renderFavorites() {
    const list = Array.from(state.favs).map(id => state.byId.get(id)).filter(Boolean);
    $('#favGrid').innerHTML = list.map(cardHTML).join('');
    $('#favEmpty').hidden = list.length > 0;
    $('#favCount').textContent = list.length ? tn('count.channels', list.length) : '';
  }

  function renderHistoryView() {
    const list = state.history.map(h => state.byId.get(h.id)).filter(Boolean);
    $('#historyGrid').innerHTML = list.map(cardHTML).join('');
    $('#historyEmpty').hidden = list.length > 0;
    $('#historyCount').textContent = list.length ? tn('count.channels', list.length) : '';
  }

  function renderRadioTags() {
    const allLabel = t('common.all');
    $('#radioTags').innerHTML = `<button type="button" class="chip focusable${state.radioTag ? '' : ' on'}" data-radio-tag="">${esc(allLabel)}</button>` +
      state.radioTags.map(tag => `<button type="button" class="chip focusable${tag === state.radioTag ? ' on' : ''}" data-radio-tag="${esc(tag)}">${esc(tag)}</button>`).join('');
  }

  function renderRadio() {
    renderRadioTags();
    const query = state.radioQuery.toLowerCase();
    const localStations = state.all.filter(c => c.type === 'radio' && c.source !== 'radio-browser')
      .filter(c => !query || (c.name + ' ' + c.cats.map(catLabel).join(' ')).toLowerCase().includes(query))
      .filter(c => !state.radioTag || c.cats.some(cat => catLabel(cat).toLowerCase() === state.radioTag.toLowerCase()));
    const stations = [...localStations, ...state.radioItems];
    $('#radioGrid').innerHTML = stations.map(cardHTML).join('');
    $('#radioCount').textContent = stations.length
      ? tn('radio.loaded', stations.length)
      : '';
    $('#radioEmpty').hidden = state.radioLoading || stations.length > 0;
    $('#radioLoading').hidden = !state.radioLoading;
    $('#radioMore').hidden = state.radioLoading || !state.radioHasMore || (!state.radioItems.length && !!state.radioError);
    const error = state.radioError || state.radioTagsError;
    $('#radioErrorText').textContent = error || t('radio.error');
    $('#radioError').hidden = !error;
  }

  async function fetchRadioJSON(path, signal) {
    const url = RADIO_API + path;
    let release;
    const queued = new Promise(resolve => { release = resolve; });
    const previous = radioRequestQueue;
    radioRequestQueue = previous.then(() => queued);
    await previous;
    try {
      const delay = Math.max(0, 1000 - (Date.now() - radioLastRequestAt));
      if (delay) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            if (signal) signal.removeEventListener('abort', abort);
            resolve();
          }, delay);
          const abort = () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          };
          if (signal) {
            if (signal.aborted) abort();
            else signal.addEventListener('abort', abort, { once: true });
          }
        });
      }
      if (signal && signal.aborted) throw new Error('Aborted');
      radioLastRequestAt = Date.now();
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } catch (error) {
      if ((signal && signal.aborted) || !window.ChahinNative || typeof window.ChahinNative.fetchText !== 'function') throw error;
      const text = window.ChahinNative.fetchText(url);
      if (typeof text !== 'string' || text.startsWith('ERR:')) {
        throw new Error(typeof text === 'string' ? text.slice(4) : t('error.downloadBlocked'));
      }
      try { return JSON.parse(text); }
      catch (parseError) { throw new Error('Invalid radio directory response'); }
    } finally {
      release();
    }
  }

  async function loadRadioTags() {
    if (state.radioTagsLoaded) return;
    try {
      const tags = await fetchRadioJSON('tags?hidebroken=true&order=stationcount&reverse=true&limit=50');
      state.radioTags = Array.isArray(tags)
        ? tags.map(item => String(item.name || '').trim()).filter(Boolean)
        : [];
      state.radioTagsLoaded = true;
      state.radioTagsError = '';
    } catch (error) {
      state.radioTagsError = t('radio.tagsError', { msg: error.message || 'network' });
      console.error('Radio categories unavailable', error);
    }
    if (state.view === 'radio') renderRadio();
  }

  function radioPath() {
    const params = new URLSearchParams({
      hidebroken: 'true',
      limit: String(RADIO_PAGE),
      offset: String(state.radioOffset),
      order: 'clickcount',
      reverse: 'true'
    });
    if (state.radioQuery) params.set('name', state.radioQuery);
    if (state.radioTag) params.set('tag', state.radioTag);
    return 'stations/search?' + params.toString();
  }

  function normalizeRadioStation(station) {
    const url = safeHttp(station.url_resolved || station.url);
    const id = String(station.stationuuid || '').trim();
    if (!url || !id) return null;
    const country = /^[A-Z]{2}$/.test(String(station.countrycode || '').toUpperCase())
      ? String(station.countrycode).toUpperCase()
      : '';
    const langs = normalizeLangList(station.languagecodes || station.language || '');
    const tags = String(station.tags || '').split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 8);
    return {
      id: 'radio:' + id,
      name: String(station.name || '').trim() || t('channel.unnamed'),
      type: 'radio',
      logo: safeHttp(station.favicon || ''),
      urls: [url],
      cats: ['radio', ...tags.map(tag => 'rt:' + tag)],
      country,
      countryName: String(station.country || ''),
      langs,
      source: 'radio-browser',
      sourceName: 'Radio Browser'
    };
  }

  async function loadRadioPage(reset) {
    if (reset) {
      if (radioAbort) radioAbort.abort();
      radioRequestToken++;
      state.radioItems = [];
      state.radioOffset = 0;
      state.radioHasMore = true;
      state.radioError = '';
      state.radioLoading = false;
      state.radioLoaded = false;
    }
    if (state.radioLoading || !state.radioHasMore) return;

    radioAbort = new AbortController();
    const token = ++radioRequestToken;
    const signal = radioAbort.signal;
    state.radioLoading = true;
    renderRadio();
    try {
      const stations = await fetchRadioJSON(radioPath(), signal);
      if (token !== radioRequestToken) return;
      const page = Array.isArray(stations) ? stations : [];
      const seen = new Set(state.radioItems.map(c => c.id));
      for (const station of page) {
        const channel = normalizeRadioStation(station);
        if (!channel || seen.has(channel.id)) continue;
        seen.add(channel.id);
        state.radioItems.push(channel);
        state.radioStations.set(channel.id, channel);
        state.byId.set(channel.id, channel);
      }
      state.radioOffset += page.length;
      state.radioHasMore = page.length === RADIO_PAGE;
      state.radioLoaded = true;
      persistRadioStations();
    } catch (error) {
      if (token !== radioRequestToken) return;
      state.radioError = t('radio.loadingError', { msg: error.message || 'network' });
      console.error('Radio stations unavailable', error);
    } finally {
      if (token === radioRequestToken) {
        state.radioLoading = false;
        renderRadio();
      }
    }
  }

  function persistRadioStations() {
    const pinned = new Set([...state.favs, ...state.history.map(item => item.id)]);
    const stations = Array.from(state.radioStations.values());
    const saved = stations.filter(item => pinned.has(item.id)).slice(-400);
    const recent = stations.filter(item => !pinned.has(item.id)).slice(-200);
    writeJSON(LS.radioStations, [...saved, ...recent]);
  }

  function mediaRegion() {
    if (/^[A-Z]{2}$/.test(prefs.region)) return prefs.region;
    const localeRegion = (navigator.language || '').split('-')[1];
    return /^[A-Za-z]{2}$/.test(localeRegion || '') ? localeRegion.toUpperCase() : 'US';
  }

  function mediaLocale() {
    const lang = uiLang();
    return lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : 'fr-FR';
  }

  function mediaApiUrl(path, params) {
    const url = new URL(path, TMDB_API);
    url.searchParams.set('api_key', prefs.media.tmdbApiKey);
    url.searchParams.set('language', mediaLocale());
    url.searchParams.set('region', mediaRegion());
    Object.keys(params || {}).forEach(key => url.searchParams.set(key, String(params[key])));
    return url.href;
  }

  async function fetchMediaJSON(url, signal) {
    try {
      const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.json();
          detail = body.status_message || '';
        } catch (e) { /* response may not be JSON */ }
        const error = new Error(response.status === 401 ? t('media.invalidKey') : detail || 'HTTP ' + response.status);
        error.httpStatus = response.status;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.httpStatus) throw error;
      if ((signal && signal.aborted) || !window.ChahinNative || typeof window.ChahinNative.fetchText !== 'function') throw error;
      const text = window.ChahinNative.fetchText(url);
      if (typeof text !== 'string' || text.startsWith('ERR:')) {
        throw new Error(typeof text === 'string' ? text.slice(4) : t('error.downloadBlocked'));
      }
      try { return JSON.parse(text); }
      catch (parseError) { throw new Error('Invalid TMDB response'); }
    }
  }

  function mediaRequests(kind, page) {
    const query = state.mediaQuery.trim();
    if (kind === 'movies') {
      return [mediaApiUrl(query ? 'search/movie' : 'discover/movie', query
        ? { query, page, include_adult: false }
        : { page, sort_by: 'popularity.desc', include_adult: false })];
    }
    if (kind === 'series') {
      return [mediaApiUrl(query ? 'search/tv' : 'discover/tv', query
        ? { query, page, include_adult: false }
        : { page, sort_by: 'popularity.desc', include_adult: false })];
    }
    if (query) {
      const search = { query, page, include_adult: false };
      return [mediaApiUrl('search/movie', search), mediaApiUrl('search/tv', search)];
    }
    return [
      mediaApiUrl('discover/movie', { page, sort_by: 'popularity.desc', include_adult: false, with_genres: 16, with_original_language: 'ja' }),
      mediaApiUrl('discover/tv', { page, sort_by: 'popularity.desc', include_adult: false, with_genres: 16, with_original_language: 'ja', with_origin_country: 'JP' })
    ];
  }

  function isAnimeResult(item) {
    return item && ['movie', 'tv'].includes(item.media_type || (item.title ? 'movie' : 'tv')) &&
      item.original_language === 'ja' && Array.isArray(item.genre_ids) && item.genre_ids.includes(16);
  }

  function renderMediaCard(item) {
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const id = Number(item.id);
    if (!Number.isInteger(id) || id < 1 || !['movie', 'tv'].includes(type)) return '';
    const title = String(item.title || item.name || t('media.untitled')).trim();
    const date = String(item.release_date || item.first_air_date || '').slice(0, 4);
    const rating = Number(item.vote_average);
    const posterPath = typeof item.poster_path === 'string' && /^\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png)$/i.test(item.poster_path)
      ? TMDB_IMAGE + item.poster_path
      : '';
    const watchPath = type === 'movie' ? 'movie' : 'tv';
    const watchUrl = `https://www.themoviedb.org/${watchPath}/${id}/watch?locale=${encodeURIComponent(mediaRegion())}`;
    return `<article class="media-card">
      <a class="media-poster" href="${watchUrl}" target="_blank" rel="noopener" aria-label="${esc(t('media.watchOptionsFor', { title }))}">
        ${posterPath ? `<img src="${esc(posterPath)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="ph">${esc(initials(title))}</span>`}
      </a>
      <div class="media-info">
        <b class="media-title">${esc(title)}</b>
        <small class="media-meta">${esc([date, rating > 0 ? '★ ' + rating.toFixed(1) : ''].filter(Boolean).join(' · ') || t('media.noDetails'))}</small>
        <a class="btn small ghost focusable" href="${watchUrl}" target="_blank" rel="noopener">${esc(t('media.watchOptions'))}</a>
      </div>
    </article>`;
  }

  function renderMedia() {
    const items = state.mediaItems[state.mediaKind];
    const hasKey = !!prefs.media.tmdbApiKey;
    $('#mediaSetup').hidden = hasKey;
    $('#mediaSearch').disabled = !hasKey;
    $('#mediaKinds').querySelectorAll('[data-media-kind]').forEach(button => {
      const active = button.dataset.mediaKind === state.mediaKind;
      button.classList.toggle('on', active);
      button.setAttribute('aria-selected', String(active));
    });
    $('#mediaGrid').innerHTML = items.map(renderMediaCard).join('');
    $('#mediaCount').textContent = items.length ? tn('media.loaded', items.length) : '';
    $('#mediaLoading').hidden = !state.mediaLoading;
    $('#mediaEmpty').hidden = !hasKey || state.mediaLoading || !!state.mediaError || items.length > 0;
    $('#mediaError').hidden = !state.mediaError;
    $('#mediaErrorText').textContent = state.mediaError || t('media.error');
    $('#mediaMore').hidden = !hasKey || state.mediaLoading || !items.length ||
      state.mediaPage[state.mediaKind] > state.mediaTotalPages[state.mediaKind];
  }

  async function loadMediaPage(reset) {
    const kind = state.mediaKind;
    if (reset) {
      if (mediaAbort) mediaAbort.abort();
      mediaRequestToken++;
      state.mediaItems[kind] = [];
      state.mediaPage[kind] = 1;
      state.mediaTotalPages[kind] = 1;
      state.mediaLoaded[kind] = false;
      state.mediaError = '';
      state.mediaLoading = false;
    }
    if (!prefs.media.tmdbApiKey || state.mediaLoading ||
      (state.mediaLoaded[kind] && state.mediaPage[kind] > state.mediaTotalPages[kind])) {
      renderMedia();
      return;
    }

    mediaAbort = new AbortController();
    const token = ++mediaRequestToken;
    const signal = mediaAbort.signal;
    const page = state.mediaPage[kind];
    state.mediaLoading = true;
    state.mediaError = '';
    renderMedia();
    try {
      const responses = await Promise.all(mediaRequests(kind, page).map(url => fetchMediaJSON(url, signal)));
      if (token !== mediaRequestToken) return;
      let results = responses.flatMap(response => Array.isArray(response.results) ? response.results : []);
      if (kind === 'anime') results = results.filter(isAnimeResult);
      const seen = new Set(state.mediaItems[kind].map(item => item.media_type + ':' + item.id));
      for (const item of results) {
        const type = item.media_type || (item.title ? 'movie' : 'tv');
        const key = type + ':' + item.id;
        if (seen.has(key)) continue;
        seen.add(key);
        state.mediaItems[kind].push(Object.assign({}, item, { media_type: type }));
      }
      state.mediaTotalPages[kind] = Math.max(1, ...responses.map(response => Number(response.total_pages) || 1));
      state.mediaPage[kind] = page + 1;
      state.mediaLoaded[kind] = true;
    } catch (error) {
      if (token !== mediaRequestToken) return;
      state.mediaError = error.message || t('media.error');
      console.error('Media catalog unavailable', error);
    } finally {
      if (token === mediaRequestToken) {
        state.mediaLoading = false;
        renderMedia();
      }
    }
  }

  function renderPlaylists() {
    const wrap = $('#playlistList');
    if (!state.playlists.length) {
      wrap.innerHTML = `<div class="pl-empty">${esc(t('settings.playlistsEmpty'))}</div>`;
      return;
    }
    wrap.innerHTML = state.playlists.map(pl => {
      const count = Number(pl.count || 0);
      const countLabel = tn('count.channels', count);
      const origin = pl.url ? ' · ' + esc(hostOf(pl.url)) : ' · ' + esc(t('settings.playlistImported'));
      return `<div class="pl-row">
        <span class="pl-icon"><svg class="ic"><use href="#i-list"/></svg></span>
        <span class="pl-main"><b>${esc(pl.name)}</b><span>${esc(countLabel)}${origin}</span></span>
        ${pl.url ? `<button type="button" class="icon-btn focusable" data-pl-refresh="${esc(pl.id)}" aria-label="${esc(t('aria.refreshPlaylist', { name: pl.name }))}"><svg class="ic"><use href="#i-refresh"/></svg></button>` : ''}
        <button type="button" class="icon-btn danger focusable" data-pl-del="${esc(pl.id)}" aria-label="${esc(t('aria.deletePlaylist', { name: pl.name }))}"><svg class="ic"><use href="#i-trash"/></svg></button>
      </div>`;
    }).join('');
  }

  function renderSettings() {
    renderPlaylists();
    $('#tmdbApiKey').value = prefs.media.tmdbApiKey;
    $('#favCountSettings').textContent = nf(state.favs.size);
    $('#historyCountSettings').textContent = nf(state.history.length);
    $('#verLabel').textContent = t('common.version', { v: VERSION });
    $('#catalogUpdated').textContent = state.updatedAt ? timeAgo(state.updatedAt) : '—';
  }

  function renderCurrentView() {
    if (state.loading) return;
    if (state.view === 'home') renderHome();
    else if (state.view === 'channels') renderChannels();
    else if (state.view === 'radio') {
      renderRadio();
      if (!state.radioLoaded && !state.radioLoading) {
        loadRadioTags();
        loadRadioPage(false);
      }
    }
    else if (state.view === 'media') {
      renderMedia();
      if (prefs.media.tmdbApiKey && !state.mediaLoaded[state.mediaKind] && !state.mediaLoading) loadMediaPage(false);
    }
    else if (state.view === 'favorites') renderFavorites();
    else if (state.view === 'history') renderHistoryView();
    else if (state.view === 'settings') renderSettings();
  }

  function renderAll() {
    if (state.view === 'channels') {
      $('#chSearch').value = state.query;
      $('#chCountry').value = state.country;
    }
    renderContinueRow();
    renderCurrentView();
    renderSettings();
    renderAppearance();
    renderLanguageSettings();
  }

  function setView(view) {
    if (!['home', 'channels', 'radio', 'media', 'favorites', 'history', 'settings'].includes(view)) view = 'home';
    state.view = view;
    state.limit = PAGE;
    $$('.view').forEach(el => { el.hidden = el.dataset.view !== view; });
    $$('[data-view].rail-btn, .top-nav [data-view], .tabbar [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'channels') {
      $('#chSearch').value = state.query;
      $('#chCountry').value = state.country;
    }
    renderCurrentView();
    window.scrollTo(0, 0);
    if (state.tv && $('#onboardOverlay').hidden) setTimeout(() => { const el = $('.rail-btn.active'); if (el) el.focus(); }, 60);
  }

  function syncLock() {
    const locked = !$('#player').hidden || !$('#detail').hidden || !$('#searchOverlay').hidden ||
      !$('#playlistModal').hidden || !$('#onboardOverlay').hidden;
    document.body.classList.toggle('locked', locked);
  }

  function rememberFocus() {
    const el = document.activeElement;
    if (el && el !== document.body && typeof el.focus === 'function') state.lastFocus = el;
  }
  function restoreFocus() {
    if (!state.tv) return;
    const el = state.lastFocus;
    state.lastFocus = null;
    if (el && document.contains(el) && el.offsetParent !== null) {
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      return;
    }
    const fallback = $('.rail-btn.active') || $('.view:not([hidden]) .card[data-id]') || $('.tabbar button.active');
    if (fallback) { try { fallback.focus({ preventScroll: true }); } catch (e) { fallback.focus(); } }
  }

  function toggleFav(id) {
    if (!id) return;
    if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
    writeJSON(LS.favs, Array.from(state.favs));
    if (state.radioStations.has(id)) persistRadioStations();
    const on = state.favs.has(id);
    $$('[data-fav]').forEach(b => {
      if (b.dataset.fav !== id) return;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', t(on ? 'aria.favRemove' : 'aria.favAdd'));
      const icon = b.querySelector('.ic');
      if (icon) icon.classList.toggle('fill', on);
    });
    if (state.view === 'favorites') renderFavorites();
    if (state.detail && state.detail.id === id) updateDetailFav();
    if (state.player && state.player.id === id) updatePlayerFav();
    $('#favCountSettings').textContent = nf(state.favs.size);
    toast(t(on ? 'toast.favAdded' : 'toast.favRemoved'));
  }

  function addHistory(id) {
    state.history = [{ id, at: Date.now() }, ...state.history.filter(h => h.id !== id)].slice(0, 40);
    writeJSON(LS.history, state.history);
    if (state.radioStations.has(id)) persistRadioStations();
    renderContinueRow();
    if (state.view === 'history') renderHistoryView();
    $('#historyCountSettings').textContent = nf(state.history.length);
  }

  function updateDetailFav() {
    if (!state.detail) return;
    const on = state.favs.has(state.detail.id);
    const btn = $('#dFav');
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-label', t(on ? 'aria.favRemove' : 'aria.favAdd'));
    btn.style.color = on ? 'var(--pink)' : '';
    btn.setAttribute('aria-pressed', String(on));
    const icon = btn.querySelector('.ic');
    if (icon) icon.classList.toggle('fill', on);
  }

  function renderDetailSources(c) {
    $('#dSrcCount').textContent = `(${c.urls.length})`;
    $('#dSources').innerHTML = c.urls.map((u, i) => `<button type="button" class="src-row focusable" data-src="${i}">
      <span class="src-num">${i + 1}</span>
      <span class="host">${esc(hostOf(u))}</span>
      ${u.startsWith('http:') ? '<span class="badge warn">http</span>' : ''}
      <svg class="ic"><use href="#i-play"/></svg>
    </button>`).join('');
  }

  function refreshDetail() {
    const c = state.detail;
    if (!c) return;
    $('#dName').textContent = c.name;
    $('#dMeta').textContent = [countryLabel(c), c.cats.map(catLabel).join(' · '), c.sourceName].filter(Boolean).join(' · ');
    $('#dCats').innerHTML = c.cats.map(k => `<span class="chip static">${esc(catLabel(k))}</span>`).join('');
    updateDetailFav();
    renderDetailSources(c);
    const allHttp = c.urls.length > 0 && c.urls.every(u => u.startsWith('http:'));
    $('#dNote').textContent = allHttp && location.protocol === 'https:' ? t('detail.httpNote') : '';
  }

  function openDetail(id) {
    const c = state.byId.get(id);
    if (!c) return;
    if ($('#detail').hidden) rememberFocus();
    state.detail = c;
    const logo = $('#dLogo');
    logo.style.background = tint(c.id);
    logo.innerHTML = c.logo ? `<img src="${esc(c.logo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="ph">${esc(initials(c.name))}</span>`;
    refreshDetail();
    $('#detail').hidden = false;
    syncLock();
    if (state.tv) setTimeout(() => $('#dPlay').focus(), 60);
  }

  function closeDetail() {
    $('#detail').hidden = true;
    state.detail = null;
    syncLock();
    restoreFocus();
  }

  function openSearch() {
    rememberFocus();
    $('#searchOverlay').hidden = false;
    syncLock();
    const input = $('#searchInput');
    input.value = '';
    renderSearch('');
    setTimeout(() => input.focus(), 50);
  }

  function closeSearch() {
    $('#searchOverlay').hidden = true;
    syncLock();
    restoreFocus();
  }

  function matches(c, query) {
    const hay = (c.name + ' ' + (c.countryName || '') + ' ' + c.country + ' ' + c.cats.map(catLabel).join(' ')).toLowerCase();
    return hay.includes(query);
  }

  function renderSearch(query) {
    const term = String(query || '').trim().toLowerCase();
    let list;
    if (!term) {
      list = state.all.filter(c => c.logo).slice(0, 24);
      $('#searchHint').textContent = t('search.featured');
    } else {
      list = state.all.filter(c => matches(c, term)).slice(0, 60);
      $('#searchHint').textContent = list.length ? tn('count.results', list.length) : t('channels.emptyTitle');
    }
    state.searchResults = list;
    $('#searchResults').innerHTML = list.map(cardHTML).join('');
    $('#searchEmpty').hidden = list.length > 0;
  }

  function updatePlayerFav() {
    const on = !!(state.player && state.favs.has(state.player.id));
    const btn = $('#pFav');
    btn.classList.toggle('fav-on', on);
    btn.setAttribute('aria-label', t(on ? 'aria.favRemove' : 'aria.favAdd'));
    btn.setAttribute('aria-pressed', String(on));
    const icon = btn.querySelector('.ic');
    if (icon) icon.classList.toggle('fill', on);
  }

  function updatePlayerMeta() {
    const c = state.player;
    if (!c) return;
    const url = c.urls[state.srcIndex] || '';
    $('#pMeta').textContent = [countryLabel(c), hostOf(url), `${state.srcIndex + 1}/${c.urls.length}`].filter(Boolean).join(' · ');
  }

  function refreshPlayerText() {
    if (!state.player) return;
    updatePlayerFav();
    updatePlayerMeta();
    updatePlayerToggle();
  }

  function destroyHls() {
    if (hls) {
      try { hls.destroy(); } catch (e) { /* ignore */ }
      hls = null;
    }
  }

  function setUse(el, id) {
    if (!el) return;
    el.setAttribute('href', '#' + id);
    try { el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id); } catch (e) { /* ignore */ }
  }

  function updatePlayerToggle() {
    const paused = video.paused;
    const icon = $('#pToggle .ic');
    if (icon) {
      icon.classList.toggle('fill', paused);
      const use = icon.querySelector('use');
      setUse(use, paused ? 'i-play' : 'i-pause');
    }
    $('#pToggle').setAttribute('aria-label', t(paused ? 'aria.play' : 'aria.pause'));
  }

  function updatePlayerTime() {
    $('#pTime').textContent = fmtTime(video.currentTime) + ' / ' + fmtTime(video.duration);
  }

  function hidePlayerError() {
    $('#pError').hidden = true;
    $('#pLoading').hidden = false;
  }

  function showPlayerError() {
    destroyHls();
    $('#pLoading').hidden = true;
    $('#pError').hidden = false;
    const c = state.player;
    $('#pErrorText').textContent = c
      ? t('player.errorBodyNamed', { name: c.name })
      : t('player.errorBodyNo');
    if (state.tv) setTimeout(() => $('#pRetry').focus(), 60);
  }

  function startPlayback(index) {
    if (!state.player) return;
    playToken++;
    playIndex(index, playToken);
  }

  function playIndex(index, token) {
    if (token !== playToken || !state.player) return;
    const c = state.player;
    if (index >= c.urls.length) {
      state.srcIndex = Math.max(0, c.urls.length - 1);
      showPlayerError();
      return;
    }
    state.srcIndex = index;
    updatePlayerMeta();
    destroyHls();
    clearTimeout(srcTimer);
    video.onplaying = null;
    video.onerror = null;
    try { video.pause(); } catch (e) { /* ignore */ }
    video.removeAttribute('src');
    video.load();
    hidePlayerError();

    let settled = false;
    const finish = fn => {
      if (settled) return;
      settled = true;
      clearTimeout(srcTimer);
      fn();
    };
    srcTimer = setTimeout(() => finish(() => playIndex(index + 1, token)), 14000);
    video.onplaying = () => finish(() => {
      $('#pLoading').hidden = true;
      $('#pError').hidden = true;
      addHistory(c.id);
    });
    video.onerror = () => finish(() => playIndex(index + 1, token));

    const url = c.urls[index];
    const isHlsUrl = /\.m3u8(?:[?#]|$)/i.test(url);
    if (isHlsUrl && window.Hls && window.Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.on(Hls.Events.ERROR, (evt, data) => { if (data && data.fatal) finish(() => playIndex(index + 1, token)); });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyMediaTracks();
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, applyMediaTracks);
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, applyMediaTracks);
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
      video.load();
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  function openPlayer(id, index = 0) {
    const c = state.byId.get(id);
    if (!c) return;
    if ($('#player').hidden) rememberFocus();
    state.player = c;
    state.srcIndex = index;
    $('#pName').textContent = c.name;
    const audioOnly = c.type === 'radio';
    $('#player').classList.toggle('audio-only', audioOnly);
    $('#radioCoverName').textContent = c.name;
    const coverImage = $('#radioCoverImage');
    coverImage.onerror = () => coverImage.removeAttribute('src');
    if (c.logo) coverImage.src = c.logo;
    else coverImage.removeAttribute('src');
    $('#pError').hidden = true;
    $('#pLoading').hidden = false;
    $('#pSourceSheet').hidden = true;
    $('#player').hidden = false;
    video.controls = !state.tv && !audioOnly;
    $('#pControls').hidden = !state.tv && !audioOnly;
    updatePlayerFav();
    updatePlayerMeta();
    updatePlayerTime();
    syncLock();
    startPlayback(index);
    if (state.tv) setTimeout(() => $('#pBack').focus(), 80);
  }

  function closePlayer() {
    playToken++;
    clearTimeout(srcTimer);
    destroyHls();
    video.onplaying = null;
    video.onerror = null;
    try { video.pause(); } catch (e) { /* ignore */ }
    video.removeAttribute('src');
    video.load();
    $('#player').hidden = true;
    $('#pSourceSheet').hidden = true;
    $('#pError').hidden = true;
    $('#pLoading').hidden = true;
    $('#player').classList.remove('audio-only');
    state.player = null;
    syncLock();
    if (state.view === 'home') renderContinueRow();
    if (state.view === 'history') renderHistoryView();
    restoreFocus();
  }

  function renderSourceSheet() {
    const c = state.player;
    if (!c) { $('#pSourceList').innerHTML = ''; return; }
    $('#pSourceList').innerHTML = c.urls.map((u, i) => `<button type="button" class="src-row focusable${i === state.srcIndex ? ' on' : ''}" data-psrc="${i}">
      <span class="src-num">${i + 1}</span>
      <span class="host">${esc(hostOf(u))}</span>
      ${i === state.srcIndex ? `<span class="badge">${esc(t('common.current'))}</span>` : ''}
    </button>`).join('');
  }

  function openSourceSheet() {
    if (!state.player) return;
    renderSourceSheet();
    $('#pSourceSheet').hidden = false;
    if (state.tv) setTimeout(() => { const el = $('#pSourceList .src-row'); if (el) el.focus(); }, 60);
  }

  function closeTopLayer() {
    if (!$('#onboardOverlay').hidden) return true;
    if (!$('#pSourceSheet').hidden) { $('#pSourceSheet').hidden = true; return true; }
    if (!$('#player').hidden) { closePlayer(); return true; }
    if (!$('#playlistModal').hidden) { closePlaylistModal(); return true; }
    if (!$('#detail').hidden) { closeDetail(); return true; }
    if (!$('#searchOverlay').hidden) { closeSearch(); return true; }
    if (state.view !== 'home') { setView('home'); return true; }
    return false;
  }

  function setPlTab(tab) {
    plTab = tab;
    $$('#plTabs .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#plUrlField').hidden = tab !== 'url';
    $('#plPasteField').hidden = tab !== 'paste';
    $('#plFileField').hidden = tab !== 'file';
  }

  function openPlaylistModal() {
    rememberFocus();
    $('#playlistModal').hidden = false;
    syncLock();
    setPlTab('url');
    $('#plName').value = '';
    $('#plUrl').value = '';
    $('#plText').value = '';
    $('#plFile').value = '';
    $('#plError').hidden = true;
    $('#plSave').disabled = false;
    $('#plSave').textContent = t('common.add');
    setTimeout(() => $('#plName').focus(), 60);
  }

  function closePlaylistModal() {
    $('#playlistModal').hidden = true;
    syncLock();
    restoreFocus();
  }

  function readFileText(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error(t('error.fileRead')));
      reader.readAsText(file);
    });
  }

  async function savePlaylistFromForm() {
    const errorEl = $('#plError');
    const showError = message => { errorEl.textContent = message; errorEl.hidden = false; };
    errorEl.hidden = true;

    const nameInput = $('#plName');
    let name = nameInput.value.trim();
    let content = '';
    let url = '';

    try {
      if (plTab === 'url') {
        const raw = $('#plUrl').value.trim();
        url = /^https?:\/\//i.test(raw) ? safeHttp(raw) : '';
        if (!url) return showError(t('error.m3uLink'));
        if (!name) name = hostOf(url);
      } else if (plTab === 'paste') {
        content = $('#plText').value.trim();
        if (!content) return showError(t('error.m3uEmpty'));
        if (!name) name = t('settings.playlistDefaultName', { n: nf(state.playlists.length + 1) });
      } else {
        const file = $('#plFile').files[0];
        if (!file) return showError(t('error.m3uFile'));
        content = await readFileText(file);
        if (!name) name = file.name.replace(/\.(m3u8?|txt)$/i, '');
      }

      if (plTab === 'url') {
        $('#plSave').disabled = true;
        $('#plSave').textContent = t('settings.playlistDownloading');
        content = await fetchPlaylistText(url);
      }

      if (!/^#EXTM3U/i.test(content.trim()) && !/^#EXTINF/im.test(content)) {
        return showError(t('error.notM3u'));
      }

      const pl = {
        id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name.slice(0, 60),
        url,
        content,
        addedAt: Date.now(),
        count: 0
      };
      const channels = parseM3U(content, pl);
      if (!channels.length) return showError(t('error.noChannels'));

      pl.count = channels.length;
      await writePlaylist(pl);
      state.playlists.push(pl);
      mergeChannels();
      rebuildFacets();
      renderAll();
      closePlaylistModal();
      toast(tn('toast.playlistAdded', channels.length));
    } catch (e) {
      showError(e && e.message ? e.message : t('error.addPlaylist'));
    } finally {
      $('#plSave').disabled = false;
      $('#plSave').textContent = t('common.add');
    }
  }

  async function refreshPlaylist(id, btn) {
    const pl = state.playlists.find(p => p.id === id);
    if (!pl || !pl.url) return;
    if (btn) btn.disabled = true;
    try {
      const content = await fetchPlaylistText(pl.url);
      const channels = parseM3U(content, pl);
      if (!channels.length) throw new Error(t('error.playlistEmpty'));
      pl.content = content;
      pl.count = channels.length;
      await writePlaylist(pl);
      mergeChannels();
      rebuildFacets();
      renderAll();
      toast(t('toast.playlistRefreshed'));
    } catch (e) {
      toast(e && e.message ? e.message : t('error.refresh'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function removePlaylist(id) {
    const pl = state.playlists.find(p => p.id === id);
    if (!pl) return;
    if (!confirm(t('confirm.deletePlaylist', { name: pl.name }))) return;
    state.playlists = state.playlists.filter(p => p.id !== id);
    await deletePlaylist(id);
    mergeChannels();
    rebuildFacets();
    renderAll();
    toast(t('toast.playlistRemoved'));
  }

  async function loadCatalog() {
    if (state.loadingCatalog) return;
    state.loadingCatalog = true;
    state.loading = true;
    state.catalogSourceError = '';
    $('#catalogError').hidden = true;
    let builtinError = null;
    try {
      state.playlists = await readPlaylists().catch(() => []);
      try { await loadBuiltin(); }
      catch (e) { builtinError = e; console.error(e); }
      await ensurePlaylistContents();
      mergeChannels();
      rebuildFacets();
      state.updatedAt = Date.now();
    } catch (e) {
      console.error(e);
    } finally {
      state.loading = false;
      state.loadingCatalog = false;
    }
    renderAll();
    if (builtinError) {
      $('#catalogErrorText').textContent = t('error.catalog', { msg: builtinError.message || 'réseau' });
      $('#catalogError').hidden = false;
    } else if (state.catalogSourceError) {
      $('#catalogErrorText').textContent = t('error.extraCatalog', { msg: state.catalogSourceError });
      $('#catalogError').hidden = false;
    }
    if (state.tv && $('#onboardOverlay').hidden) setTimeout(() => { const el = $('.rail-btn.active'); if (el) el.focus(); }, 150);
  }

  function focusScope() {
    if (!$('#onboardOverlay').hidden) return $('#onboardOverlay');
    if (!$('#pSourceSheet').hidden) return $('#pSourceSheet');
    if (!$('#player').hidden) return $('#player');
    if (!$('#playlistModal').hidden) return $('#playlistModal');
    if (!$('#detail').hidden) return $('#detail');
    if (!$('#searchOverlay').hidden) return $('#searchOverlay');
    return $('.shell');
  }

  function moveFocus(dir) {
    if (!$('#onboardOverlay').hidden) {
      moveWithin($('#onboardOverlay'), dir, document.activeElement);
      return;
    }
    const active = document.activeElement;
    const rail = $('.rail');
    const rtl = document.documentElement.dir === 'rtl';
    const inward = rtl ? -1 : 1;
    if (rail && rail.contains(active) && getComputedStyle(rail).display !== 'none') {
      if (dir[0] === inward) {
        const first = $$('.shell input:not([disabled]), .shell select:not([disabled]), .shell button:not([disabled]), .shell a[href], .shell .card[data-id], .shell .chip')
          .find(el => el.offsetParent !== null && !el.closest('[hidden]'));
        if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); }
        return;
      }
      if (dir[0] === -inward) return;
      moveWithin(rail, dir, active);
      return;
    }
    const root = focusScope();
    if (!root) return;
    const moved = moveWithin(root, dir, active);
    if (moved) return;
    /* Bord du contenu : revenir à la barre latérale (télécommande). */
    if (!rail || getComputedStyle(rail).display === 'none' || dir[0] !== -inward) return;
    const target = $('.rail-btn.active') || $('.rail-btn');
    focusEl(target);
  }

  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function moveWithin(root, dir, active) {
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea, .card[data-id], .chip';
    const els = Array.from(root.querySelectorAll(selector)).filter(el => el.offsetParent !== null && !el.closest('[hidden]'));
    if (!els.length) return false;
    if (!els.includes(active)) { focusEl(els[0]); return true; }
    const ar = active.getBoundingClientRect();
    const ax = ar.left + ar.width / 2;
    const ay = ar.top + ar.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of els) {
      if (el === active) continue;
      const r = el.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - ax;
      const dy = (r.top + r.height / 2) - ay;
      const primary = dx * dir[0] + dy * dir[1];
      if (primary <= 2) continue;
      const ortho = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
      const score = primary + ortho * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (!best) return false;
    focusEl(best);
    best.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    return true;
  }

  function bindEvents() {
    $('#brandHome').addEventListener('click', e => { e.preventDefault(); setView('home'); });
    $('#searchBtn').addEventListener('click', openSearch);
    $('#railSearch').addEventListener('click', openSearch);
    $('#settingsBtn').addEventListener('click', () => setView('settings'));
    $('#searchClose').addEventListener('click', closeSearch);
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(searchTimer);
      const value = e.target.value;
      searchTimer = setTimeout(() => renderSearch(value), 110);
    });

    $('#chSearch').addEventListener('input', debounce(e => {
      state.query = e.target.value;
      state.limit = PAGE;
      renderChannels();
    }, 110));
    $('#chCountry').addEventListener('change', e => {
      state.country = e.target.value;
      state.limit = PAGE;
      renderChannels();
    });
    $('#radioSearch').addEventListener('input', debounce(e => {
      state.radioQuery = e.target.value.trim();
      loadRadioPage(true);
    }, 350));
    $('#radioRetry').addEventListener('click', () => {
      state.radioTagsLoaded = false;
      loadRadioTags();
      loadRadioPage(true);
    });
    $('#radioMore').addEventListener('click', () => loadRadioPage(false));
    $('#mediaSearch').addEventListener('input', debounce(e => {
      state.mediaQuery = e.target.value.trim();
      loadMediaPage(true);
    }, 350));
    $('#mediaRetry').addEventListener('click', () => loadMediaPage(true));
    $('#mediaMore').addEventListener('click', () => loadMediaPage(false));
    $('#saveTmdbKey').addEventListener('click', () => {
      const key = $('#tmdbApiKey').value.trim();
      if (!key) { toast(t('media.keyRequiredToast')); return; }
      prefs.media.tmdbApiKey = key;
      savePrefs();
      state.mediaKind = 'movies';
      state.mediaQuery = '';
      $('#mediaSearch').value = '';
      Object.keys(state.mediaItems).forEach(kind => {
        state.mediaItems[kind] = [];
        state.mediaPage[kind] = 1;
        state.mediaTotalPages[kind] = 1;
        state.mediaLoaded[kind] = false;
      });
      toast(t('media.keySaved'));
      if (state.view === 'media') loadMediaPage(true);
      renderSettings();
    });
    $('#clearTmdbKey').addEventListener('click', () => {
      if (mediaAbort) mediaAbort.abort();
      mediaRequestToken++;
      prefs.media.tmdbApiKey = '';
      savePrefs();
      state.mediaLoading = false;
      state.mediaError = '';
      Object.keys(state.mediaItems).forEach(kind => {
        state.mediaItems[kind] = [];
        state.mediaPage[kind] = 1;
        state.mediaTotalPages[kind] = 1;
        state.mediaLoaded[kind] = false;
      });
      renderSettings();
      renderMedia();
      toast(t('media.keyCleared'));
    });

    $('#homeMore').addEventListener('click', () => { state.limit += PAGE; renderHome(); });
    $('#chMore').addEventListener('click', () => { state.limit += PAGE; renderChannels(); });

    $('#detailClose').addEventListener('click', closeDetail);
    $('#dPlay').addEventListener('click', () => { if (state.detail) openPlayer(state.detail.id, 0); });
    $('#dFav').addEventListener('click', () => { if (state.detail) toggleFav(state.detail.id); });
    $('#dSourcesToggle').addEventListener('click', () => {
      const wrap = $('#dSources');
      wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const first = wrap.querySelector('.src-row');
      if (first) first.focus();
    });

    $('#addPlaylistBtn').addEventListener('click', openPlaylistModal);
    $('#plClose').addEventListener('click', closePlaylistModal);
    $('#plCancel').addEventListener('click', closePlaylistModal);
    $('#plSave').addEventListener('click', savePlaylistFromForm);
    $('#plTabs').addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (btn) setPlTab(btn.dataset.tab);
    });
    $('#plUrl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); savePlaylistFromForm(); } });

    $('#retryCatalog').addEventListener('click', () => loadCatalog());
    $('#refreshCatalogBtn').addEventListener('click', async () => {
      const btn = $('#refreshCatalogBtn');
      btn.disabled = true;
      try { await loadCatalog(); toast(t('toast.catalogRefreshed')); }
      finally { btn.disabled = false; }
    });
    $('#clearHistoryBtn').addEventListener('click', () => {
      if (!state.history.length) { toast(t('toast.historyEmpty')); return; }
      if (!confirm(t('confirm.clearHistory'))) return;
      state.history = [];
      writeJSON(LS.history, []);
      renderContinueRow();
      renderHistoryView();
      renderSettings();
      toast(t('toast.historyCleared'));
    });
    $('#clearFavoritesBtn').addEventListener('click', () => {
      if (!state.favs.size) { toast(t('toast.noFavorites')); return; }
      if (!confirm(t('confirm.clearFavorites'))) return;
      state.favs.clear();
      writeJSON(LS.favs, []);
      renderCurrentView();
      renderSettings();
      toast(t('toast.favsCleared'));
    });

    $('#pBack').addEventListener('click', closePlayer);
    $('#pErrorBack').addEventListener('click', closePlayer);
    $('#pRetry').addEventListener('click', () => { if (!state.player) return; playToken++; playIndex(state.srcIndex, playToken); });
    $('#pNextBtn').addEventListener('click', () => { if (!state.player) return; playToken++; playIndex(state.srcIndex + 1, playToken); });
    $('#pFav').addEventListener('click', () => { if (state.player) toggleFav(state.player.id); });
    $('#pSourcesBtn').addEventListener('click', openSourceSheet);
    $('#pSourceClose').addEventListener('click', () => { $('#pSourceSheet').hidden = true; });
    $('#pToggle').addEventListener('click', () => {
      if (video.paused) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
      else video.pause();
    });
    $('#pRewind').addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
    $('#pForward').addEventListener('click', () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); });
    $('#pMute').addEventListener('click', () => { video.muted = !video.muted; $('#pMute').style.opacity = video.muted ? '.55' : ''; });
    $('#pFull').addEventListener('click', () => {
      if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); return; }
      const el = $('#player');
      if (el.requestFullscreen) { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    });

    /* Apparence */
    $('#themeSeg').addEventListener('click', e => {
      const btn = e.target.closest('[data-theme-choice]');
      if (!btn) return;
      prefs.theme.manual = btn.dataset.themeChoice;
      prefs.theme.source = 'manual';
      savePrefs();
      renderAppearance();
    });
    $('#themeSourceSeg').addEventListener('click', e => {
      const btn = e.target.closest('[data-theme-source]');
      if (!btn) return;
      prefs.theme.source = btn.dataset.themeSource;
      savePrefs();
      renderAppearance();
    });
    $('#nightScheduleSeg').addEventListener('click', e => {
      const btn = e.target.closest('[data-schedule]');
      if (!btn) return;
      prefs.theme.schedule = btn.dataset.schedule;
      savePrefs();
      renderAppearance();
    });
    $('#nightStart').addEventListener('change', e => {
      prefs.theme.nightStart = e.target.value || '22:00';
      savePrefs();
      applyTheme();
    });
    $('#nightEnd').addEventListener('change', e => {
      prefs.theme.nightEnd = e.target.value || '07:00';
      savePrefs();
      applyTheme();
    });
    $('#geoBtn').addEventListener('click', requestLocation);
    const bindRange = (inputSel, valueSel, key) => {
      const input = $(inputSel);
      const label = $(valueSel);
      const paint = () => {
        const value = Math.max(0, Math.min(100, Number(input.value) || 0));
        prefs.theme[key] = value;
        label.textContent = nf(value) + '%';
        applyTheme();
      };
      input.addEventListener('input', paint);
      input.addEventListener('change', () => { paint(); savePrefs(); });
    };
    bindRange('#nightIntensity', '#nightIntensityVal', 'intensity');
    bindRange('#panelAlpha', '#panelAlphaVal', 'panelAlpha');
    $('#motionSwitch').addEventListener('click', () => {
      prefs.theme.motion = !prefs.theme.motion;
      savePrefs();
      renderAppearance();
    });
    $('#contrastSwitch').addEventListener('click', () => {
      prefs.theme.contrast = prefs.theme.contrast === 'high' ? 'normal' : 'high';
      savePrefs();
      renderAppearance();
    });

    /* Langue et région */
    $('#langSelect').addEventListener('change', e => {
      prefs.lang = e.target.value;
      savePrefs();
      applyLanguage();
    });
    $('#regionSelect').addEventListener('change', e => {
      prefs.region = e.target.value || '';
      savePrefs();
      applyLanguage();
    });
    $('#timeFormatSelect').addEventListener('change', e => {
      prefs.timeFormat = e.target.value;
      savePrefs();
      applyLanguage();
    });
    $('#audioPref').addEventListener('change', e => {
      prefs.content.audio = e.target.value;
      savePrefs();
      applyMediaTracks();
    });
    $('#subsPref').addEventListener('change', e => {
      prefs.content.subtitles = e.target.value;
      savePrefs();
      applyMediaTracks();
    });
    $('#metaPref').addEventListener('change', e => {
      prefs.content.metadata = e.target.value;
      savePrefs();
    });

    /* Première ouverture */
    $('#onboardOverlay').addEventListener('click', e => {
      const btn = e.target.closest('[data-onboard-lang]');
      if (btn) {
        onboardLang = btn.dataset.onboardLang;
        prefs.lang = onboardLang;
        applyLanguage();
        renderOnboardText();
        return;
      }
      if (e.target.closest('#onboardContinue')) finishOnboarding();
    });

    video.addEventListener('loadedmetadata', applyMediaTracks);
    video.addEventListener('timeupdate', updatePlayerTime);
    video.addEventListener('play', updatePlayerToggle);
    video.addEventListener('pause', updatePlayerToggle);

    document.addEventListener('click', e => {
      const mediaKind = e.target.closest('[data-media-kind]');
      if (mediaKind) {
        e.preventDefault();
        const kind = mediaKind.dataset.mediaKind;
        if (kind && kind !== state.mediaKind) {
          state.mediaKind = kind;
          loadMediaPage(true);
        }
        return;
      }
      const fav = e.target.closest('[data-fav]');
      if (fav) { e.preventDefault(); e.stopPropagation(); toggleFav(fav.dataset.fav); return; }

      const play = e.target.closest('[data-play]');
      if (play) { e.preventDefault(); openPlayer(play.dataset.play, 0); return; }

      const info = e.target.closest('[data-info]');
      if (info) { e.preventDefault(); openDetail(info.dataset.info); return; }

      const src = e.target.closest('[data-src]');
      if (src && state.detail) {
        e.preventDefault();
        openPlayer(state.detail.id, Number(src.dataset.src));
        return;
      }

      const psrc = e.target.closest('[data-psrc]');
      if (psrc) {
        e.preventDefault();
        playToken++;
        playIndex(Number(psrc.dataset.psrc), playToken);
        $('#pSourceSheet').hidden = true;
        return;
      }

      const refresh = e.target.closest('[data-pl-refresh]');
      if (refresh) { e.preventDefault(); refreshPlaylist(refresh.dataset.plRefresh, refresh); return; }

      const del = e.target.closest('[data-pl-del]');
      if (del) { e.preventDefault(); removePlaylist(del.dataset.plDel); return; }

      const langChip = e.target.closest('[data-lang]');
      if (langChip) {
        e.preventDefault();
        const code = langChip.dataset.lang;
        if (!code) {
          prefs.content.channelLangs = [];
        } else {
          const current = prefs.content.channelLangs;
          prefs.content.channelLangs = current.includes(code)
            ? current.filter(x => x !== code)
            : current.concat(code);
        }
        savePrefs();
        renderLanguageSettings();
        renderChannelLangChips();
        if (state.view === 'channels') { state.limit = PAGE; renderChannels(); }
        else renderCurrentView();
        return;
      }

      const cat = e.target.closest('[data-cat]');
      if (cat) {
        e.preventDefault();
        state.cat = cat.dataset.cat;
        state.limit = PAGE;
        if (state.view !== 'channels') setView('channels');
        else renderChannels();
        return;
      }

      const radioTag = e.target.closest('[data-radio-tag]');
      if (radioTag) {
        e.preventDefault();
        state.radioTag = radioTag.dataset.radioTag;
        loadRadioPage(true);
        return;
      }

      const homeCategory = e.target.closest('[data-home-category]');
      if (homeCategory) {
        e.preventDefault();
        state.cat = homeCategory.dataset.homeCategory;
        state.query = '';
        state.country = '';
        state.limit = PAGE;
        setView('channels');
        return;
      }

      const goto = e.target.closest('[data-goto]');
      if (goto) { e.preventDefault(); setView(goto.dataset.goto); return; }

      const nav = e.target.closest('.rail-btn[data-view], .top-nav [data-view], .tabbar [data-view]');
      if (nav) { e.preventDefault(); setView(nav.dataset.view); return; }

      if (e.target.id === 'detail') { closeDetail(); return; }
      if (e.target.id === 'playlistModal') { closePlaylistModal(); return; }
      if (e.target.id === 'pSourceSheet') { $('#pSourceSheet').hidden = true; return; }

      const card = e.target.closest('.card[data-id]');
      if (card) {
        if (!$('#searchOverlay').hidden) closeSearch();
        openDetail(card.dataset.id);
      }
    });

    document.addEventListener('keydown', e => {
      const key = e.key;
      const onRange = e.target.matches && e.target.matches('input[type="range"]');
      const typing = !onRange && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (key === 'Escape' || key === 'GoBack' || (key === 'Backspace' && state.tv && !typing)) {
        if (closeTopLayer()) { e.preventDefault(); return; }
      }
      if (!state.tv) return;

      if ((key === 'Enter' || key === 'OK') && !typing) {
        const active = document.activeElement;
        if (active && active.matches('.card[data-id]')) {
          e.preventDefault();
          if (!$('#searchOverlay').hidden) closeSearch();
          openDetail(active.dataset.id);
        } else if (active && active.matches('button, a[href], .chip')) {
          e.preventDefault();
          active.click();
        }
        return;
      }

      if (onRange && (key === 'ArrowLeft' || key === 'ArrowRight')) return;

      if (typing) {
        if (key === 'ArrowDown') {
          const first = e.target.id === 'searchInput'
            ? $('#searchResults .card')
            : e.target.id === 'chSearch' ? $('#chGrid .card')
              : e.target.id === 'mediaSearch' ? $('#mediaGrid .media-poster') : null;
          if (first) { e.preventDefault(); first.focus(); }
        }
        return;
      }

      const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const dir = dirs[key];
      if (!dir) return;
      e.preventDefault();
      moveFocus(dir);
    });
  }

  function init() {
    state.favs = new Set(readJSON(LS.favs, []).filter(x => typeof x === 'string'));
    state.history = readJSON(LS.history, []).filter(h => h && typeof h.id === 'string').slice(0, 40);
    const cachedRadio = readJSON(LS.radioStations, []);
    if (Array.isArray(cachedRadio)) {
      cachedRadio.forEach(channel => {
        if (!channel || typeof channel.id !== 'string' || !channel.id.startsWith('radio:') || channel.type !== 'radio' ||
          !Array.isArray(channel.urls) || !safeHttp(channel.urls[0])) return;
        state.radioStations.set(channel.id, Object.assign({}, channel, {
          name: String(channel.name || t('channel.unnamed')),
          logo: safeHttp(channel.logo || ''),
          urls: [safeHttp(channel.urls[0])],
          cats: Array.isArray(channel.cats) ? channel.cats : ['radio'],
          langs: Array.isArray(channel.langs) ? channel.langs : []
        }));
      });
    }
    state.radioItems = Array.from(state.radioStations.values()).slice(-RADIO_PAGE);
    bindEvents();
    applyLanguage();
    state.loading = true;
    renderSkeletons();
    $$('[data-view].rail-btn, .top-nav [data-view], .tabbar [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'home'));
    renderSettings();
    setupThemeWatch();
    if (!prefs.onboarded) openOnboard();
    else if (state.tv) setTimeout(() => { const el = $('.rail-btn.active'); if (el) el.focus(); }, 120);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
    }
    loadCatalog();
  }

  window.chahinBack = () => closeTopLayer();
  window.chahinPause = () => { if (!$('#player').hidden) { try { video.pause(); } catch (e) { /* ignore */ } } };
  window.chahinSystemTheme = () => { if (prefs.theme.source === 'system') applyTheme(); };
  window.chahinSystemLang = () => { if (prefs.lang === 'system') applyLanguage(); };

  init();
})();
