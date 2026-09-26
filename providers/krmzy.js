/** krmzy - Cs-Karma Nuvio port, built 2026-09-26T10:46:30.859Z */
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
function extractHlsList(unpackedHtml) {
  const s = String(unpackedHtml || "");
  const out = [];
  const re = /"hls\d+"\s*:\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[1])
      out.push(m[1]);
  }
  return out;
}

// src/shared/html.js
function normTitle(s) {
  return String(s || "").toLowerCase().replace(/&amp;/g, "&").replace(/&#\d+;/g, " ").replace(/[^a-z0-9\u00e7\u011f\u0131\u00f6\u015f\u00fc ]/gi, " ").replace(/\s+/g, " ").trim();
}
function normKey(s) {
  return normTitle(s).replace(/[^a-z0-9]/g, "");
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

// src/krmzy/constants.js
var MAIN_URL = "https://krmzy.org";
var DOMAIN_CANDIDATES = ["https://krmzy.org"];
var PROVIDER_ID = "krmzy";

// src/krmzy/index.js
var QESEN = "https://qesen.net/";
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
  const re = /<div\b[^>]*class=["'][^"']*block-post[^"']*["'][\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    const inner = m[2] || "";
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? hm[1] || hm[2] : "";
    let title = tm ? tm[1] || tm[2] : "";
    if (!title)
      title = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (href && title)
      out.push({ title: title.trim(), url: abs(href, base) });
  }
  return out;
}
function parseEpisodes(html, base) {
  if (!/postEp/i.test(html))
    return [];
  const eps = [];
  const re = /<div\b[^>]*class=["'][^"']*block-post[^"']*["'][\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    const inner = (m[0] || "") + m[2];
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? hm[1] || hm[2] : "";
    const em = inner.match(/episodeNum[\s\S]{0,300}?<span[^>]*>\s*<\/span>\s*<span[^>]*>\s*(\d+)\s*<\/span>/i);
    if (href)
      eps.push({ title: tm ? tm[1] || tm[2] : "", url: abs(href, base), episode: em ? parseInt(em[1], 10) : null });
  }
  return eps;
}
function parseWatch(html) {
  const fs = html.match(/<a\b[^>]*class=["'][^"']*fullscreen-clickable[^"']*["'][^>]*href\s*=\s*"([^"]+)"|<a\b[^>]*class=["'][^"']*fullscreen-clickable[^"']*["'][^>]*href\s*=\s*'([^']+)'/i);
  const full = fs ? fs[1] || fs[2] : "";
  const servers = [];
  const re = /<li\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    if (!/serversList/i.test(html.slice(Math.max(0, m.index - 2e3), m.index)) && !/data-(server|src)/i.test(attrs))
      continue;
    const ds = attrs.match(/data-server\s*=\s*"([^"]*)"|data-server\s*=\s*'([^']*)'|data-src\s*=\s*"([^"]*)"|data-src\s*=\s*'([^']*)'/i);
    const dn = attrs.match(/data-name\s*=\s*"([^"]*)"|data-name\s*=\s*'([^']*)'/i);
    const server = ds ? ds[1] || ds[2] || ds[3] || ds[4] || "" : "";
    if (server)
      servers.push({ server: server.trim(), name: dn ? dn[1] || dn[2] || "" : "" });
  }
  const iframeM = html.match(/<iframe\b[^>]*src\s*=\s*"([^"]+)"|<iframe\b[^>]*src\s*=\s*'([^']+)'/i);
  return { fullscreen: full || "", servers, iframe: iframeM ? iframeM[1] || iframeM[2] : "" };
}
function resolveTurkveArab(embedUrl, hostLabel) {
  return __async(this, null, function* () {
    const page = yield fetchText(embedUrl, QESEN);
    const unpacked = getAndUnpack(page);
    const hls = extractHlsList(unpacked);
    if (hls.length) {
      const main2 = originOf(embedUrl);
      return hls.slice(0, 3).map((u) => ({
        url: /^https?:\/\//i.test(u) ? u : main2 + (u.startsWith("/") ? u : "/" + u),
        referer: main2 + "/"
      }));
    }
    const file = extractFileUrl(unpacked);
    if (!file)
      return [];
    const main = originOf(embedUrl);
    const url = /^https?:\/\//i.test(file) ? file : main + (file.startsWith("/") ? file : "/" + file);
    return [{ url, referer: main + "/" }];
  });
}
function resolveGenericEmbed(embedUrl) {
  return __async(this, null, function* () {
    const page = yield fetchText(embedUrl, MAIN_URL + "/");
    const unpacked = getAndUnpack(page);
    const file = extractFileUrl(unpacked);
    if (!file)
      return null;
    const url = /^https?:\/\//i.test(file) ? file : originOf(embedUrl) + (file.startsWith("/") ? file : "/" + file);
    return { url, referer: embedUrl };
  });
}
function serverToEmbed(s) {
  const v = s.server, n = (s.name || "").toLowerCase();
  if (/^https?:\/\//i.test(v))
    return { kind: "direct-embed", url: v };
  if (/ok/i.test(n))
    return { kind: "skip-ok", url: `https://ok.ru/videoembed/${v}` };
  if (/arab/i.test(n))
    return { kind: "turkvearab", url: `https://v.turkvearab.com/embed-${v}.html` };
  if (/red/i.test(n))
    return { kind: "generic", url: `https://iplayerhls.com/e/${v}` };
  if (/pro/i.test(n))
    return { kind: "larhu", url: `https://w.larhu.website/hls/${v}.m3u8` };
  return { kind: "turkvearab", url: `https://arabveturk.com/embed-${v}.html` };
}
function getStreams(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const type = String(mediaType).toLowerCase() === "tv" ? "tv" : "movie";
      const info = yield getTmdbInfo(tmdbId, type);
      const targets = [...new Set([info.title, info.originalTitle, info.turkishTitle].filter(Boolean))];
      if (!targets.length)
        return [];
      for (const domain of DOMAIN_CANDIDATES) {
        let hit = null;
        for (const q of targets) {
          let html = "";
          try {
            html = yield fetchText(`${domain}/search/${encodeURIComponent(q)}/`, `${domain}/`);
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
        let watchUrl = "";
        let dispTitle = hit.title;
        if (type === "tv") {
          const eps = parseEpisodes(detail, domain);
          if (!eps.length)
            continue;
          const epNo = episode || 1;
          let ep = eps.find((e) => e.episode === epNo) || eps[epNo - 1] || eps[0];
          watchUrl = ep.url;
          dispTitle = `${hit.title} S${season || 1}E${epNo}`;
        } else {
          watchUrl = hit.url.replace(/\/$/, "") + "/see/";
        }
        let watchPage = "";
        try {
          watchPage = yield fetchText(watchUrl, hit.url);
        } catch (e) {
          continue;
        }
        let { fullscreen, servers, iframe } = parseWatch(watchPage);
        if (fullscreen) {
          try {
            const fp = yield fetchText(abs(fullscreen, domain), `${domain}/`);
            const inner = parseWatch(fp);
            if (inner.servers.length)
              servers = inner.servers;
            if (inner.iframe)
              iframe = iframe || inner.iframe;
          } catch (e) {
          }
        }
        const out = [];
        const push = (url, referer, label) => {
          if (!url || !/^https?:\/\//i.test(url))
            return;
          out.push({
            name: `${PROVIDER_ID} ${label}`,
            title: dispTitle,
            url,
            quality: "Auto",
            provider: PROVIDER_ID,
            type: /\.m3u8/i.test(url) ? "m3u8" : "mp4",
            headers: { "User-Agent": "Mozilla/5.0", "Referer": referer, "Origin": originOf(referer) }
          });
        };
        for (const s of servers.slice(0, 8)) {
          try {
            const e = serverToEmbed(s);
            if (e.kind === "larhu") {
              push(e.url, "https://qesen.net/", "Pro HLS");
              continue;
            }
            if (e.kind === "skip-ok")
              continue;
            if (e.kind === "turkvearab") {
              const rs = yield resolveTurkveArab(e.url, s.name);
              rs.forEach((r) => push(r.url, r.referer, s.name || "HLS"));
              continue;
            }
            if (e.kind === "direct-embed" || e.kind === "generic") {
              const r = yield resolveGenericEmbed(e.url);
              if (r)
                push(r.url, r.referer, s.name || "HLS");
            }
          } catch (e) {
          }
        }
        if (iframe && out.length === 0) {
          try {
            const r = yield resolveGenericEmbed(abs(iframe, domain));
            if (r)
              push(r.url, r.referer, "iframe");
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
module.exports.__test = { parseSearch, parseEpisodes, parseWatch, serverToEmbed, normKey };
