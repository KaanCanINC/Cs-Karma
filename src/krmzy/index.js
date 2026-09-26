// Krmzy Nuvio portu. Kaynak: Krmzy.kt loadLinks + TurkveArabExtractor.kt
// Akis: TMDB -> /search/<q>/ -> detay (postEp varsa dizi) ->
//       fullscreen-clickable -> serversList[data-server/data-name] ->
//       Pro: direkt larhu m3u8 | Arab/else: turkvearab unpack | http: generic
import { fetchText, originOf } from '../shared/http.js';
import { getTmdbInfo, tmdbApiKeySettingsLayout } from '../shared/tmdb.js';
import { getAndUnpack, extractFileUrl, extractHlsList } from '../shared/unpack.js';
import { normKey, scoreCandidate } from '../shared/html.js';
import { MAIN_URL, DOMAIN_CANDIDATES, PROVIDER_ID } from './constants.js';

const QESEN = 'https://qesen.net/';

function abs(href, base) {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('//')) return 'https:' + href;
  return base.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href);
}

function parseSearch(html, base) {
  const out = [];
  const re = /<div\b[^>]*class=["'][^"']*block-post[^"']*["'][\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? (hm[1] || hm[2]) : '';
    let title = tm ? (tm[1] || tm[2]) : '';
    if (!title) title = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (href && title) out.push({ title: title.trim(), url: abs(href, base) });
  }
  return out;
}

function parseEpisodes(html, base) {
  if (!/postEp/i.test(html)) return [];
  const eps = [];
  const re = /<div\b[^>]*class=["'][^"']*block-post[^"']*["'][\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const inner = (m[0] || '') + m[2];
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? (hm[1] || hm[2]) : '';
    const em = inner.match(/episodeNum[\s\S]{0,300}?<span[^>]*>\s*<\/span>\s*<span[^>]*>\s*(\d+)\s*<\/span>/i);
    if (href) eps.push({ title: tm ? (tm[1] || tm[2]) : '', url: abs(href, base), episode: em ? parseInt(em[1], 10) : null });
  }
  return eps;
}

function parseWatch(html) {
  const fs = html.match(/<a\b[^>]*class=["'][^"']*fullscreen-clickable[^"']*["'][^>]*href\s*=\s*"([^"]+)"|<a\b[^>]*class=["'][^"']*fullscreen-clickable[^"']*["'][^>]*href\s*=\s*'([^']+)'/i);
  const full = fs ? (fs[1] || fs[2]) : '';
  const servers = [];
  const re = /<li\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    if (!/serversList/i.test(html.slice(Math.max(0, m.index - 2000), m.index)) && !/data-(server|src)/i.test(attrs)) continue;
    const ds = attrs.match(/data-server\s*=\s*"([^"]*)"|data-server\s*=\s*'([^']*)'|data-src\s*=\s*"([^"]*)"|data-src\s*=\s*'([^']*)'/i);
    const dn = attrs.match(/data-name\s*=\s*"([^"]*)"|data-name\s*=\s*'([^']*)'/i);
    const server = ds ? (ds[1] || ds[2] || ds[3] || ds[4] || '') : '';
    if (server) servers.push({ server: server.trim(), name: dn ? (dn[1] || dn[2] || '') : '' });
  }
  const iframeM = html.match(/<iframe\b[^>]*src\s*=\s*"([^"]+)"|<iframe\b[^>]*src\s*=\s*'([^']+)'/i);
  return { fullscreen: full || '', servers, iframe: iframeM ? (iframeM[1] || iframeM[2]) : '' };
}

async function resolveTurkveArab(embedUrl, hostLabel) {
  const page = await fetchText(embedUrl, QESEN);
  const unpacked = getAndUnpack(page);
  const hls = extractHlsList(unpacked);
  if (hls.length) {
    const main = originOf(embedUrl);
    return hls.slice(0, 3).map(u => ({
      url: /^https?:\/\//i.test(u) ? u : main + (u.startsWith('/') ? u : '/' + u),
      referer: main + '/'
    }));
  }
  const file = extractFileUrl(unpacked);
  if (!file) return [];
  const main = originOf(embedUrl);
  const url = /^https?:\/\//i.test(file) ? file : main + (file.startsWith('/') ? file : '/' + file);
  return [{ url, referer: main + '/' }];
}

async function resolveGenericEmbed(embedUrl) {
  const page = await fetchText(embedUrl, MAIN_URL + '/');
  const unpacked = getAndUnpack(page);
  const file = extractFileUrl(unpacked);
  if (!file) return null;
  const url = /^https?:\/\//i.test(file) ? file : originOf(embedUrl) + (file.startsWith('/') ? file : '/' + file);
  return { url, referer: embedUrl };
}

function serverToEmbed(s) {
  const v = s.server, n = (s.name || '').toLowerCase();
  if (/^https?:\/\//i.test(v)) return { kind: 'direct-embed', url: v };
  if (/ok/i.test(n)) return { kind: 'skip-ok', url: `https://ok.ru/videoembed/${v}` };
  if (/arab/i.test(n)) return { kind: 'turkvearab', url: `https://v.turkvearab.com/embed-${v}.html` };
  if (/red/i.test(n)) return { kind: 'generic', url: `https://iplayerhls.com/e/${v}` };
  if (/pro/i.test(n)) return { kind: 'larhu', url: `https://w.larhu.website/hls/${v}.m3u8` };
  return { kind: 'turkvearab', url: `https://arabveturk.com/embed-${v}.html` };
}

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
  try {
    const type = String(mediaType).toLowerCase() === 'tv' ? 'tv' : 'movie';
    const info = await getTmdbInfo(tmdbId, type);
    const targets = [...new Set([info.title, info.originalTitle, info.turkishTitle].filter(Boolean))];
    if (!targets.length) return [];

    for (const domain of DOMAIN_CANDIDATES) {
      let hit = null;
      for (const q of targets) {
        let html = '';
        try { html = await fetchText(`${domain}/search/${encodeURIComponent(q)}/`, `${domain}/`); }
        catch { continue; }
        for (const l of parseSearch(html, domain)) {
          const s = scoreCandidate(l.title, targets, '', info.year);
          if (!hit || s > hit.score) hit = { ...l, score: s };
        }
        if (hit && hit.score >= 3) break;
      }
      if (!hit || hit.score <= 0) continue;

      let detail = '';
      try { detail = await fetchText(hit.url, `${domain}/`); } catch { continue; }

      let watchUrl = '';
      let dispTitle = hit.title;
      if (type === 'tv') {
        const eps = parseEpisodes(detail, domain);
        if (!eps.length) continue;
        const epNo = episode || 1;
        let ep = eps.find(e => e.episode === epNo) || eps[epNo - 1] || eps[0];
        watchUrl = ep.url;
        dispTitle = `${hit.title} S${season || 1}E${epNo}`;
      } else {
        watchUrl = hit.url.replace(/\/$/, '') + '/see/';
      }

      let watchPage = '';
      try { watchPage = await fetchText(watchUrl, hit.url); } catch { continue; }
      let { fullscreen, servers, iframe } = parseWatch(watchPage);
      if (fullscreen) {
        try {
          const fp = await fetchText(abs(fullscreen, domain), `${domain}/`);
          const inner = parseWatch(fp);
          if (inner.servers.length) servers = inner.servers;
          if (inner.iframe) iframe = iframe || inner.iframe;
        } catch { /* fullscreen opsiyonel */ }
      }

      const out = [];
      const push = (url, referer, label) => {
        if (!url || !/^https?:\/\//i.test(url)) return;
        out.push({
          name: `${PROVIDER_ID} ${label}`,
          title: dispTitle,
          url,
          quality: 'Auto',
          provider: PROVIDER_ID,
          type: /\.m3u8/i.test(url) ? 'm3u8' : 'mp4',
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': referer, 'Origin': originOf(referer) }
        });
      };

      for (const s of servers.slice(0, 8)) {
        try {
          const e = serverToEmbed(s);
          if (e.kind === 'larhu') { push(e.url, 'https://qesen.net/', 'Pro HLS'); continue; }
          if (e.kind === 'skip-ok') continue;
          if (e.kind === 'turkvearab') {
            const rs = await resolveTurkveArab(e.url, s.name);
            rs.forEach(r => push(r.url, r.referer, s.name || 'HLS'));
            continue;
          }
          if (e.kind === 'direct-embed' || e.kind === 'generic') {
            const r = await resolveGenericEmbed(e.url);
            if (r) push(r.url, r.referer, s.name || 'HLS');
          }
        } catch { /* siradaki */ }
      }
      if (iframe && out.length === 0) {
        try {
          const r = await resolveGenericEmbed(abs(iframe, domain));
          if (r) push(r.url, r.referer, 'iframe');
        } catch { /* ignore */ }
      }
      if (out.length) return out;
    }
    return [];
  } catch { return []; }
}

async function onSettings() { return [...tmdbApiKeySettingsLayout()]; }
async function getSubtitles() { return []; }

module.exports = { getStreams, getSubtitles, onSettings };
module.exports.__test = { parseSearch, parseEpisodes, parseWatch, serverToEmbed, normKey };
