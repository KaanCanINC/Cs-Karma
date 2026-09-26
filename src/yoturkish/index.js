// YoTurkish Nuvio portu (BETA). Kaynak: YoTurkish.kt + TukiPasti/Engifuosi extractor.
// WebView YOK: optitabs/iframe'lar fetch ile parse edilir.
// Akis: TMDB -> /?s= -> detay div#episodes a.episod (Episode N) ->
//       bolum sayfasi: .dl-contenti a + #player/.play iframe + tokvoy/sora regex ->
//       tukipasti data-hash | engifuosi unpack file | direkt m3u8 passthrough
import { fetchText, originOf } from '../shared/http.js';
import { getTmdbInfo, tmdbApiKeySettingsLayout } from '../shared/tmdb.js';
import { getAndUnpack, extractFileUrl } from '../shared/unpack.js';
import { normKey, scoreCandidate } from '../shared/html.js';
import { MAIN_URL, DOMAIN_CANDIDATES, PROVIDER_ID } from './constants.js';

function abs(href, base) {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('//')) return 'https:' + href;
  return base.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href);
}

function parseSearch(html, base) {
  const out = [];
  const re = /<div\b[^>]*class=["'][^"']*item[^"']*tooltipstered[^"']*["'][\s\S]*?<a\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? (hm[1] || hm[2]) : '';
    const title = tm ? (tm[1] || tm[2]) : '';
    if (href && title) out.push({ title: title.trim(), url: abs(href, base) });
  }
  return out;
}

function parseEpisodes(html, base) {
  const eps = [];
  const re = /<a\b([^>]*class=["'][^"']*episod[^"']*["'][^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const text = (m[2] || '').replace(/<[^>]+>/g, ' ');
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const href = hm ? (hm[1] || hm[2]) : '';
    const em = text.match(/episode\s*(\d+)/i);
    if (href) eps.push({ url: abs(href, base), episode: em ? parseInt(em[1], 10) : null, text: text.trim() });
  }
  // fallback: episodes blogundaki tum linkler
  if (!eps.length) {
    const block = html.match(/<div\b[^>]*id=["']episodes["'][\s\S]*?<\/div\s*>/i);
    if (block) {
      const re2 = /<a\b([^>]*)>/gi;
      let m2;
      while ((m2 = re2.exec(block[0])) !== null) {
        const hm = m2[1].match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
        if (hm && (hm[1] || hm[2])) eps.push({ url: abs(hm[1] || hm[2], base), episode: null, text: '' });
      }
    }
  }
  return eps;
}

function collectEpisodeLinks(html, base) {
  const urls = new Set();
  const dl = html.match(/<div\b[^>]*class=["'][^"']*dl-contenti[^"']*["'][\s\S]*?<a\b[^>]*href\s*=\s*"([^"]+)"|<div\b[^>]*class=["'][^"']*dl-contenti[^"']*["'][\s\S]*?<a\b[^>]*href\s*=\s*'([^']+)'/i);
  if (dl && (dl[1] || dl[2])) urls.add(abs(dl[1] || dl[2], base));
  const re = /<iframe\b[^>]*src\s*=\s*"([^"]+)"[^>]*>|<iframe\b[^>]*src\s*=\s*'([^']+)'[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const s = m[1] || m[2] || '';
    if (s && !/youtube|sharethis|pubadx|yandex|a-ads/i.test(s)) urls.add(abs(s, base));
  }
  // WebView intercept'ine takilan direkt adaylar (Kotlin: additionalUrls)
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
    while ((mm = p.exec(html)) !== null) urls.add(mm[0]);
  }
  return [...urls];
}

async function resolveTukipasti(url) {
  const page = await fetchText(url, MAIN_URL + '/');
  const m = page.match(/<div\b[^>]*id=["']video_player["'][^>]*data-hash\s*=\s*"([^"]+)"|<div\b[^>]*id=["']video_player["'][^>]*data-hash\s*=\s*'([^']+)'/i);
  const video = m ? (m[1] || m[2]) : '';
  if (!video) return null;
  return { url: video, referer: 'https://tukipasti.com/' };
}

async function resolveEngifuosi(url) {
  const page = await fetchText(url, MAIN_URL + '/');
  const unpacked = getAndUnpack(page);
  const file = extractFileUrl(unpacked);
  if (!file) return null;
  return { url: file, referer: 'https://engifuosi.com/' };
}

async function resolveLink(u) {
  if (/\.m3u8(\?|$)/i.test(u) || /\/sora\//i.test(u)) {
    return { url: u, referer: `${MAIN_URL}/`, label: /tokvoy|sora/i.test(u) ? 'Direct' : 'Stream' };
  }
  if (/tukipasti\./i.test(u)) {
    const r = await resolveTukipasti(u);
    return r ? { ...r, label: 'TukiPasti' } : null;
  }
  if (/engifuosi\./i.test(u)) {
    const r = await resolveEngifuosi(u);
    return r ? { ...r, label: 'Engifuosi' } : null;
  }
  // diger hostlar (rufiiguta/kitraskimisi): generic unpack dene
  try {
    const page = await fetchText(u, `${MAIN_URL}/`);
    const file = extractFileUrl(getAndUnpack(page));
    if (file) {
      const url = /^https?:\/\//i.test(file) ? file : originOf(u) + (file.startsWith('/') ? file : '/' + file);
      return { url, referer: u, label: 'Embed' };
    }
  } catch { /* ignore */ }
  return null;
}

async function getStreams(tmdbId, mediaType = 'tv', season = 1, episode = 1) {
  try {
    const info = await getTmdbInfo(tmdbId, 'tv');
    const targets = [...new Set([info.title, info.originalTitle, info.turkishTitle].filter(Boolean))];
    if (!targets.length) return [];

    for (const domain of DOMAIN_CANDIDATES) {
      let hit = null;
      for (const q of targets) {
        let html = '';
        try { html = await fetchText(`${domain}/?s=${encodeURIComponent(q)}`, `${domain}/`); }
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
      const eps = parseEpisodes(detail, domain);
      if (!eps.length) continue;
      const epNo = episode || 1;
      const ep = eps.find(e => e.episode === epNo) || eps[epNo - 1] || eps[0];
      if (!ep) continue;

      let epPage = '';
      try { epPage = await fetchText(ep.url, hit.url); } catch { continue; }
      const links = collectEpisodeLinks(epPage, domain);
      const out = [];
      for (const u of links.slice(0, 10)) {
        try {
          const r = await resolveLink(u);
          if (!r || !r.url) continue;
          out.push({
            name: `YoTurkish ${r.label || ''}`.trim(),
            title: `${hit.title} S${season || 1}E${epNo}`,
            url: r.url,
            quality: 'Auto',
            provider: PROVIDER_ID,
            type: /\.m3u8/i.test(r.url) || /\/sora\//i.test(r.url) ? 'm3u8' : 'mp4',
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': r.referer, 'Origin': originOf(r.referer) }
          });
        } catch { /* siradaki */ }
      }
      if (out.length) return out;
    }
    return [];
  } catch { return []; }
}

async function onSettings() { return [...tmdbApiKeySettingsLayout()]; }
async function getSubtitles() { return []; }

module.exports = { getStreams, getSubtitles, onSettings };
module.exports.__test = { parseSearch, parseEpisodes, collectEpisodeLinks, normKey };
