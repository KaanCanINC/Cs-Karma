// Esheaq Nuvio portu. Kaynak: Esheaq.kt load/loadLinks + VidSpeedExtractor.kt
// Akis: TMDB -> site aramasi -> detay (dizi: epiList / film: url+see/) ->
//       serversList[data-src] -> iframe -> vidspeed unpack file:"..." -> m3u8
import { fetchText, originOf } from '../shared/http.js';
import { getTmdbInfo, tmdbApiKeySettingsLayout } from '../shared/tmdb.js';
import { getAndUnpack, extractFileUrl } from '../shared/unpack.js';
import { normKey, scoreCandidate } from '../shared/html.js';
import { MAIN_URL, DOMAIN_CANDIDATES, PROVIDER_ID } from './constants.js';

const REF = `${MAIN_URL}/`;

function searchLinks(html, base) {
  // div.load-post article > a[title+href]
  const out = [];
  const re = /<article\b[\s\S]*?<a\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? (hm[1] || hm[2]) : '';
    const title = tm ? (tm[1] || tm[2]) : '';
    if (href && title) {
      const abs = href.startsWith('http') ? href : base.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href);
      out.push({ title: title.trim(), url: abs });
    }
  }
  return out;
}

function parseEpisodes(html, base) {
  const eps = [];
  const re = /<article\b[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? (hm[1] || hm[2]) : '';
    if (!href || !href.includes(base.replace('https://', '').split('/')[0]) && !href.startsWith('http') && !href.startsWith('/')) {
      // yine de dene
    }
    const em = inner.match(/episodeNum[\s\S]*?<span[^>]*>\s*<\/span>\s*<span[^>]*>\s*(\d+)\s*<\/span>/i)
      || inner.match(/(\d+)\s*\.?\s*(b[oö]l[uü]m|episode)/i);
    const epNum = em ? parseInt(em[1], 10) : null;
    if (hm && href) {
      const abs = href.startsWith('http') ? href : base.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href);
      eps.push({ title: tm ? (tm[1] || tm[2]) : '', url: abs, episode: epNum });
    }
  }
  // sadece epiList blogu varsa gecerli
  if (!/id=["']epiList["']/i.test(html)) return [];
  return eps;
}

function parseServers(html) {
  const out = [];
  const re = /<li\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const d = attrs.match(/data-src\s*=\s*"([^"]*)"|data-src\s*=\s*'([^']*)'/i);
    if (d && (d[1] || d[2])) out.push((d[1] || d[2]).trim());
  }
  return out;
}

function parseIframe(html, base) {
  const m = html.match(/<iframe\b[^>]*src\s*=\s*"([^"]+)"[^>]*>|<iframe\b[^>]*src\s*=\s*'([^']+)'[^>]*>/i);
  const src = m ? (m[1] || m[2]) : '';
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('//')) return 'https:' + src;
  return base.replace(/\/$/, '') + (src.startsWith('/') ? src : '/' + src);
}

async function resolveVidspeed(iframeUrl) {
  const page = await fetchText(iframeUrl, REF);
  const scriptM = page.match(/<script[^>]*>([\s\S]*?eval\(function[\s\S]*?)<\/script\s*>/i);
  const unpacked = getAndUnpack(scriptM ? scriptM[1] : page);
  const file = extractFileUrl(unpacked);
  if (!file) return null;
  const url = file.startsWith('http') ? file : originOf(iframeUrl) + (file.startsWith('/') ? file : '/' + file);
  return { url, referer: iframeUrl };
}

async function searchBest(domain, targets, year) {
  let best = null;
  for (const q of targets) {
    let html = '';
    try { html = await fetchText(`${domain}/?s=${encodeURIComponent(q)}`, `${domain}/`); }
    catch { continue; }
    const links = searchLinks(html, domain);
    for (const l of links) {
      const s = scoreCandidate(l.title, targets, '', year);
      if (!best || s > best.score) best = { ...l, score: s };
    }
    if (best && best.score >= 3) break;
  }
  return best && best.score > 0 ? best : null;
}

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
  try {
    const type = String(mediaType).toLowerCase() === 'tv' ? 'tv' : 'movie';
    const info = await getTmdbInfo(tmdbId, type);
    const targets = [...new Set([info.title, info.originalTitle, info.turkishTitle].filter(Boolean))];
    if (!targets.length) return [];

    for (const domain of DOMAIN_CANDIDATES) {
      const hit = await searchBest(domain, targets, info.year);
      if (!hit) continue;
      let detail = '';
      try { detail = await fetchText(hit.url, `${domain}/`); }
      catch { continue; }

      let watchUrl = '';
      let dispTitle = hit.title;
      if (type === 'tv') {
        const eps = parseEpisodes(detail, domain);
        if (!eps.length) continue;
        const epNo = episode || 1;
        let ep = eps.find(e => e.episode === epNo);
        if (!ep) ep = eps[epNo - 1] || eps[0];
        if (!ep) continue;
        watchUrl = ep.url.endsWith('see/') ? ep.url : ep.url.replace(/\/$/, '') + '/see/';
        dispTitle = `${hit.title} S${season || 1}E${epNo}`;
      } else {
        watchUrl = hit.url.replace(/\/$/, '') + '/see/';
      }

      let watch = '';
      try { watch = await fetchText(watchUrl, hit.url); }
      catch { continue; }
      const servers = parseServers(watch);
      if (!servers.length) continue;

      const out = [];
      for (const srv of servers.slice(0, 6)) {
        try {
          const srvPage = await fetchText(srv, `${domain}/`);
          const iframe = parseIframe(srvPage, originOf(srv) || domain);
          if (!iframe) continue;
          const r = await resolveVidspeed(iframe);
          if (!r || !r.url) continue;
          out.push({
            name: `${PROVIDER_ID} ${/\.m3u8/i.test(r.url) ? 'HLS' : 'Video'}`,
            title: dispTitle,
            url: r.url,
            quality: 'Auto',
            provider: PROVIDER_ID,
            type: /\.m3u8/i.test(r.url) ? 'm3u8' : 'mp4',
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': r.referer, 'Origin': originOf(r.referer) }
          });
        } catch { /* siradaki server */ }
      }
      if (out.length) return out;
    }
    return [];
  } catch { return []; }
}

async function onSettings() { return [...tmdbApiKeySettingsLayout()]; }
async function getSubtitles() { return []; }

module.exports = { getStreams, getSubtitles, onSettings };
// test-hook (build disi birakilir, esbuild ile gomulmez kaygisi yok: regex saf)
module.exports.__test = { searchLinks, parseEpisodes, parseServers, parseIframe, normKey };
