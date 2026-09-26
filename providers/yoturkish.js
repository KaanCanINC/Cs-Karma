/** yoturkish - Cs-Karma Nuvio port, built 2026-09-26T11:22:58.711Z */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/shared/http.js
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
};
var DEFAULT_TIMEOUT_MS = 15e3;
function timeoutSignal(ms = DEFAULT_TIMEOUT_MS) {
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
  } catch (e) {
  }
  try {
    if (typeof AbortController === "function" && typeof setTimeout === "function") {
      const c = new AbortController();
      const t = setTimeout(() => {
        try {
          c.abort();
        } catch (e) {
        }
      }, ms);
      if (t && typeof t.unref === "function")
        t.unref();
      return c.signal;
    }
  } catch (e) {
  }
  return void 0;
}
function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = "") {
  if (typeof setTimeout !== "function")
    return Promise.resolve(promise);
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms${label ? ` (${label})` : ""}`)), ms);
  });
  return Promise.race([promise, timeout]).then(
    (v) => {
      if (timer)
        clearTimeout(timer);
      return v;
    },
    (e) => {
      if (timer)
        clearTimeout(timer);
      throw e;
    }
  );
}
function fetchText(url, referer, extraHeaders) {
  return __async(this, null, function* () {
    return yield withTimeout((() => __async(this, null, function* () {
      const headers = __spreadValues(__spreadValues({}, DEFAULT_HEADERS), extraHeaders || {});
      if (referer)
        headers["Referer"] = referer;
      const res = yield fetch(url, { headers, signal: timeoutSignal(DEFAULT_TIMEOUT_MS) });
      if (!res.ok)
        throw new Error(`HTTP ${res.status} ${url}`);
      return yield res.text();
    }))(), DEFAULT_TIMEOUT_MS, url);
  });
}
function originOf(url) {
  const m = String(url || "").match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : "";
}

// src/shared/cache.js
function createTtlCache(defaultTtlMs = 30 * 60 * 1e3, maxEntries = 300) {
  const map = /* @__PURE__ */ new Map();
  function prune() {
    const now = Date.now();
    for (const [k, v] of map) {
      if (v.exp <= now)
        map.delete(k);
    }
    while (map.size > maxEntries) {
      const first = map.keys().next().value;
      map.delete(first);
    }
  }
  return {
    remember(key, loader, ttlMs, cacheIf) {
      return __async(this, null, function* () {
        const now = Date.now();
        const hit = map.get(key);
        if (hit && hit.exp > now)
          return hit.val;
        const val = yield loader();
        try {
          if (cacheIf && !cacheIf(val))
            return val;
        } catch (e) {
        }
        prune();
        map.set(key, { val, exp: now + (ttlMs || defaultTtlMs) });
        return val;
      });
    }
  };
}

// src/shared/tmdb.js
var tmdbInfoCache = createTtlCache(30 * 60 * 1e3, 300);
var DEFAULT_TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
function getTmdbApiKey() {
  try {
    const s = typeof globalThis !== "undefined" ? globalThis.SCRAPER_SETTINGS : null;
    const k = s && s.tmdbApiKey ? String(s.tmdbApiKey).trim() : "";
    if (k)
      return k;
  } catch (e) {
  }
  try {
    const inj = typeof globalThis !== "undefined" ? globalThis.TMDB_API_KEY : "";
    if (inj)
      return String(inj).trim();
  } catch (e) {
  }
  return DEFAULT_TMDB_API_KEY;
}
function tmdbApiKeySettingsLayout() {
  return [
    { type: "header", label: "TMDB API Anahtari (opsiyonel)" },
    {
      type: "text",
      key: "tmdbApiKey",
      label: "Kendi TMDB API anahtarin",
      description: "Bos birakirsan paylasilan varsayilan anahtar kullanilir.",
      defaultValue: ""
    }
  ];
}
function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const empty = { title: "", originalTitle: "", turkishTitle: "", year: "", imdbId: null };
    const apiKey = getTmdbApiKey();
    if (!apiKey)
      return empty;
    const type = mediaType === "tv" ? "tv" : "movie";
    return yield tmdbInfoCache.remember(
      `${type}:${tmdbId}`,
      () => __async(this, null, function* () {
        try {
          const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}&append_to_response=external_ids,translations`;
          const res = yield withTimeout((() => __async(this, null, function* () {
            const r = yield fetch(url, { signal: timeoutSignal(DEFAULT_TIMEOUT_MS) });
            if (!r.ok)
              throw new Error(`TMDB ${r.status}`);
            return yield r.json();
          }))(), DEFAULT_TIMEOUT_MS, "tmdb");
          let turkishTitle = "";
          const trs = res.translations && res.translations.translations || [];
          const tr = trs.find((t) => t.iso_3166_1 === "TR" || t.iso_639_1 === "tr");
          if (tr)
            turkishTitle = tr.data && (tr.data.title || tr.data.name) || "";
          return {
            title: res.name || res.title || res.original_title || "",
            originalTitle: res.original_title || res.original_name || "",
            turkishTitle,
            year: (res.release_date || res.first_air_date || "").slice(0, 4),
            imdbId: res.external_ids && res.external_ids.imdb_id || res.imdb_id || null
          };
        } catch (e) {
          return empty;
        }
      }),
      30 * 60 * 1e3,
      (v) => !!(v && (v.title || v.originalTitle || v.imdbId))
    );
  });
}

// src/shared/unpack.js
function unpackArgs(p, a, c, k, e) {
  const d = {};
  e = function(x) {
    return x.toString(a);
  };
  const dec = function(x) {
    let r = "";
    if (!x)
      return 0;
    for (let i = 0; i < x.length; i++) {
      const ch = x[i];
      if (d[ch] === void 0) {
        const v = e(d[ch] === void 0 ? Object.keys(d).length : d[ch]);
        d[ch] = v;
      }
      r += d[ch] || ch;
    }
    return r;
  };
  let out = p;
  const dict = {};
  const encode = (n) => {
    if (a <= 36)
      return n.toString(a);
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let s = "";
    do {
      s = chars[n % a] + s;
      n = Math.floor(n / a);
    } while (n > 0);
    return s;
  };
  for (let i = c - 1; i >= 0; i--) {
    dict[encode(i)] = k[i] || encode(i);
  }
  out = out.replace(/\b\w+\b/g, (w) => dict[w] !== void 0 ? dict[w] : w);
  return out;
}
function getAndUnpack(text) {
  const src = String(text || "");
  if (!src.includes("eval("))
    return src;
  const m = src.match(/eval\(function\(p,a,c,k,e,(?:r|d)?\)\{[^}]*\}\s*\(\s*'([\s\S]*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/);
  if (!m)
    return src;
  try {
    const p = m[1].replace(/\\'/g, "'");
    const a = parseInt(m[2], 10);
    const c = parseInt(m[3], 10);
    const k = m[4].split("|");
    return unpackArgs(p, a, c, k);
  } catch (e) {
    return src;
  }
}
function extractFileUrl(unpackedHtml) {
  const s = String(unpackedHtml || "");
  let m = s.match(/file\s*:\s*"([^"]+)"/i);
  if (m && m[1])
    return m[1];
  m = s.match(/file\s*:\s*'([^']+)'/i);
  if (m && m[1])
    return m[1];
  m = s.match(/source\s*:\s*"([^"]+\.m3u8[^"]*)"/i);
  if (m && m[1])
    return m[1];
  m = s.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (m && m[1])
    return m[1];
  return "";
}

// src/shared/html.js
var TR_MAP = { "\xE7": "c", "\u011F": "g", "\u0131": "i", "\xF6": "o", "\u015F": "s", "\xFC": "u", "\xE2": "a", "\xEE": "i", "\xFB": "u" };
function normKey(s) {
  return String(s || "").toLowerCase().replace(/[çğışöüâîû]/g, (c) => TR_MAP[c] || c).replace(/[^a-z0-9]/g, "");
}
function scoreCandidate(candTitle, targets, candYear, year) {
  const ck = normKey(candTitle);
  let s = 0;
  for (const t of targets) {
    const tk = normKey(t);
    if (!tk)
      continue;
    if (ck === tk)
      s += 3;
    else if (tk && (ck.includes(tk) || tk.includes(ck)))
      s += 1;
  }
  if (year && candYear && String(candYear) === String(year))
    s += 1;
  return s;
}

// src/yoturkish/constants.js
var MAIN_URL = "https://yoturkish.to";
var DOMAIN_CANDIDATES = ["https://yoturkish.to"];
var PROVIDER_ID = "yoturkish";

// src/yoturkish/index.js
function abs(href, base) {
  if (!href)
    return "";
  if (/^https?:\/\//i.test(href))
    return href;
  if (href.startsWith("//"))
    return "https:" + href;
  return base.replace(/\/$/, "") + (href.startsWith("/") ? href : "/" + href);
}
function parseSearch(html, base) {
  const out = [];
  const re = /<div\b[^>]*class=["'][^"']*item[^"']*tooltipstered[^"']*["'][\s\S]*?<a\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? hm[1] || hm[2] : "";
    const title = tm ? tm[1] || tm[2] : "";
    if (href && title)
      out.push({ title: title.trim(), url: abs(href, base) });
  }
  return out;
}
function parseEpisodes(html, base) {
  const eps = [];
  const re = /<a\b([^>]*class=["'][^"']*episod[^"']*["'][^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    const text = (m[2] || "").replace(/<[^>]+>/g, " ");
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const href = hm ? hm[1] || hm[2] : "";
    const em = text.match(/episode\s*(\d+)/i);
    if (href)
      eps.push({ url: abs(href, base), episode: em ? parseInt(em[1], 10) : null, text: text.trim() });
  }
  if (!eps.length) {
    const block = html.match(/<div\b[^>]*id=["']episodes["'][\s\S]*?<\/div\s*>/i);
    if (block) {
      const re2 = /<a\b([^>]*)>/gi;
      let m2;
      while ((m2 = re2.exec(block[0])) !== null) {
        const hm = m2[1].match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
        if (hm && (hm[1] || hm[2]))
          eps.push({ url: abs(hm[1] || hm[2], base), episode: null, text: "" });
      }
    }
  }
  return eps;
}
function collectEpisodeLinks(html, base) {
  const urls = /* @__PURE__ */ new Set();
  const dl = html.match(/<div\b[^>]*class=["'][^"']*dl-contenti[^"']*["'][\s\S]*?<a\b[^>]*href\s*=\s*"([^"]+)"|<div\b[^>]*class=["'][^"']*dl-contenti[^"']*["'][\s\S]*?<a\b[^>]*href\s*=\s*'([^']+)'/i);
  if (dl && (dl[1] || dl[2]))
    urls.add(abs(dl[1] || dl[2], base));
  const re = /<iframe\b[^>]*src\s*=\s*"([^"]+)"[^>]*>|<iframe\b[^>]*src\s*=\s*'([^']+)'[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const s = m[1] || m[2] || "";
    if (s && !/youtube|sharethis|pubadx|yandex|a-ads/i.test(s))
      urls.add(abs(s, base));
  }
  const pats = [
    /https?:\/\/srv\.tokvoy\.com\/[^\s"'<>]*\.m3u8[^\s"'<>]*/gi,
    /https?:\/\/[a-z0-9.-]*engifuosi\.[a-z]+\/(?:f|d)\/[^\s"'<>]+/gi,
    /https?:\/\/[a-z0-9.-]*rufiiguta\.[a-z]+\/\?v=[^\s"'<>]+/gi,
    /https?:\/\/[a-z0-9.-]*tukipasti\.[a-z]+\/t\/[^\s"'<>]+/gi,
    /https?:\/\/[a-z0-9.-]*kitraskimisi\.[a-z]+\/e\/[^\s"'<>]+/gi,
    /https?:\/\/sssrr\.org\/sora[^\s"'<>]*/gi
  ];
  for (const p of pats) {
    let mm;
    while ((mm = p.exec(html)) !== null)
      urls.add(mm[0]);
  }
  return [...urls];
}
function resolveTukipasti(url) {
  return __async(this, null, function* () {
    const page = yield fetchText(url, MAIN_URL + "/");
    const m = page.match(/<div\b[^>]*id=["']video_player["'][^>]*data-hash\s*=\s*"([^"]+)"|<div\b[^>]*id=["']video_player["'][^>]*data-hash\s*=\s*'([^']+)'/i);
    const video = m ? m[1] || m[2] : "";
    if (!video)
      return null;
    return { url: video, referer: "https://tukipasti.com/" };
  });
}
function parseDlRows(dlHtml) {
  const rows = [];
  const table = dlHtml.match(/<table\b[^>]*class=["'][^"']*tbl1[^"']*["'][\s\S]*?<\/table\s*>/i);
  const scope = table ? table[0] : dlHtml;
  const re = /<a\b[^>]*href\s*=\s*"([^"]+)"[^>]*>([^<]*)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(scope)) !== null) {
    const href = m[1] || "";
    const label = (m[2] || "").trim();
    if (/\/d\//i.test(href))
      rows.push({ href, label });
  }
  return rows;
}
function parseDlForm(dlHtml) {
  const get = (name) => {
    const m = dlHtml.match(new RegExp(`<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`, "i")) || dlHtml.match(new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`, "i"));
    return m ? m[1] : "";
  };
  return { op: get("op"), id: get("id"), mode: get("mode"), hash: get("hash") };
}
function encodeForm(fields) {
  return Object.keys(fields).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(fields[k])}`).join("&");
}
function postForm(url, referer, fields) {
  return __async(this, null, function* () {
    return yield withTimeout((() => __async(this, null, function* () {
      const res = yield fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "text/html,*/*",
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": referer
        },
        body: encodeForm(fields),
        signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
      });
      if (!res.ok)
        throw new Error(`HTTP ${res.status} POST ${url}`);
      return yield res.text();
    }))(), DEFAULT_TIMEOUT_MS, url);
  });
}
function extractMp4(html) {
  const m = html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
  return m ? m[0].replace(/&amp;/g, "&") : "";
}
function resolveDownloadServer(dlUrl) {
  return __async(this, null, function* () {
    const page = yield fetchText(dlUrl, MAIN_URL + "/");
    const rows = parseDlRows(page);
    const out = [];
    for (const row of rows.slice(0, 4)) {
      try {
        const dlPageUrl = /^https?:\/\//i.test(row.href) ? row.href : originOf(dlUrl) + row.href;
        const dlPage = yield fetchText(dlPageUrl, dlUrl);
        const form = parseDlForm(dlPage);
        if (!form.op || !form.id || !form.hash)
          continue;
        const posted = yield postForm(dlPageUrl, dlPageUrl, form);
        const mp4 = extractMp4(posted);
        if (!mp4)
          continue;
        const q = /1080|fhd|uhd/i.test(row.label) ? "1080p" : /720|hd/i.test(row.label) ? "720p" : /480|normal/i.test(row.label) ? "480p" : "Auto";
        out.push({ url: mp4, referer: originOf(dlPageUrl) + "/", label: `SERVER ${row.label || "mp4"}`, quality: q });
      } catch (e) {
      }
    }
    return out;
  });
}
function resolveLink(u) {
  return __async(this, null, function* () {
    if (/\.m3u8(\?|$)/i.test(u) || /\/sora\//i.test(u)) {
      return { url: u, referer: `${MAIN_URL}/`, label: /tokvoy|sora/i.test(u) ? "Direct" : "Stream" };
    }
    if (/engifuosi\.|tokvoy\.|\/d\//i.test(u)) {
      try {
        const rs = yield resolveDownloadServer(u);
        if (rs.length)
          return { multi: rs };
      } catch (e) {
      }
    }
    if (/tukipasti\./i.test(u)) {
      const r = yield resolveTukipasti(u);
      return r ? __spreadProps(__spreadValues({}, r), { label: "TukiPasti" }) : null;
    }
    try {
      const page = yield fetchText(u, `${MAIN_URL}/`);
      const file = extractFileUrl(getAndUnpack(page));
      if (file) {
        const url = /^https?:\/\//i.test(file) ? file : originOf(u) + (file.startsWith("/") ? file : "/" + file);
        return { url, referer: u, label: "Embed" };
      }
    } catch (e) {
    }
    return null;
  });
}
function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const info = yield getTmdbInfo(tmdbId, "tv");
      const targets = [...new Set([info.title, info.originalTitle, info.turkishTitle].filter(Boolean))];
      if (!targets.length)
        return [];
      for (const domain of DOMAIN_CANDIDATES) {
        let hit = null;
        for (const q of targets) {
          let html = "";
          try {
            html = yield fetchText(`${domain}/?s=${encodeURIComponent(q)}`, `${domain}/`);
          } catch (e) {
            continue;
          }
          for (const l of parseSearch(html, domain)) {
            const s = scoreCandidate(l.title, targets, "", info.year);
            if (!hit || s > hit.score)
              hit = __spreadProps(__spreadValues({}, l), { score: s });
          }
          if (hit && hit.score >= 3)
            break;
        }
        if (!hit || hit.score <= 0)
          continue;
        let detail = "";
        try {
          detail = yield fetchText(hit.url, `${domain}/`);
        } catch (e) {
          continue;
        }
        const eps = parseEpisodes(detail, domain);
        if (!eps.length)
          continue;
        const epNo = episode || 1;
        const ep = eps.find((e) => e.episode === epNo) || eps[epNo - 1] || eps[0];
        if (!ep)
          continue;
        let epPage = "";
        try {
          epPage = yield fetchText(ep.url, hit.url);
        } catch (e) {
          continue;
        }
        const links = collectEpisodeLinks(epPage, domain);
        const out = [];
        const pushStream = (url, referer, label, quality) => {
          if (!url || !/^https?:\/\//i.test(url))
            return;
          out.push({
            name: `YoTurkish ${label || ""}`.trim(),
            title: `${hit.title} S${season || 1}E${epNo}`,
            url,
            quality: quality || "Auto",
            provider: PROVIDER_ID,
            type: /\.m3u8/i.test(url) || /\/sora\//i.test(url) ? "m3u8" : "mp4",
            headers: { "User-Agent": "Mozilla/5.0", "Referer": referer, "Origin": originOf(referer) }
          });
        };
        for (const u of links.slice(0, 10)) {
          try {
            const r = yield resolveLink(u);
            if (!r)
              continue;
            if (r.multi) {
              r.multi.forEach((x) => pushStream(x.url, x.referer, x.label, x.quality));
              continue;
            }
            if (!r.url)
              continue;
            pushStream(r.url, r.referer, r.label, r.quality);
          } catch (e) {
          }
        }
        if (out.length)
          return out;
      }
      return [];
    } catch (e) {
      return [];
    }
  });
}
function onSettings() {
  return __async(this, null, function* () {
    return [...tmdbApiKeySettingsLayout()];
  });
}
function getSubtitles() {
  return __async(this, null, function* () {
    return [];
  });
}
module.exports = { getStreams, getSubtitles, onSettings };
module.exports.__test = { parseSearch, parseEpisodes, collectEpisodeLinks, parseDlRows, parseDlForm, normKey };
