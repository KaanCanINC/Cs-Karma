// Regex tabanli mini-HTML helper'lar (cheerio yok, Hermes-safe).
import { absolutize } from './http.js';

export function normTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/[^a-z0-9\u00e7\u011f\u0131\u00f6\u015f\u00fc ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normKey(s) {
  return normTitle(s).replace(/[^a-z0-9]/g, '');
}

// <a ...> listesini cikar: [{href, title, text}]
export function extractAnchors(html, base) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const inner = (m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const hm = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
    const tm = attrs.match(/title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/i);
    const href = hm ? (hm[1] || hm[2] || '') : '';
    const title = tm ? (tm[1] || tm[2] || '') : '';
    if (!href) continue;
    out.push({ href: absolutize(href, base), title: title.trim(), text: inner });
  }
  return out;
}

export function extractIframes(html, base) {
  const out = [];
  const re = /<iframe\b[^>]*src\s*=\s*"([^"]+)"[^>]*>|<iframe\b[^>]*src\s*=\s*'([^']+)'[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1] || m[2] || '';
    if (src) out.push(absolutize(src, base));
  }
  return out;
}

export function attrOfTag(html, tag, attr, contains) {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, 'gi');
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    if (contains && !attrs.toLowerCase().includes(String(contains).toLowerCase())) continue;
    const am = attrs.match(new RegExp(`${attr}\\s*=\\s*"([^"]*)"|${attr}\\s*=\\s*'([^']*)'`, 'i'));
    if (am) return am[1] || am[2] || '';
  }
  return '';
}

// data-src / data-server li ogeleri
export function extractServerLis(html) {
  const out = [];
  const re = /<li\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const get = (n) => {
      const x = attrs.match(new RegExp(`${n}\\s*=\\s*"([^"]*)"|${n}\\s*=\\s*'([^']*)'`, 'i'));
      return x ? (x[1] || x[2] || '') : '';
    };
    const ds = get('data-src') || get('data-server');
    const dn = get('data-name');
    if (ds) out.push({ server: ds.trim(), name: dn.trim() });
  }
  return out;
}

// Basit skor: birebir normalize baslik + yil eslesmesi
export function scoreCandidate(candTitle, targets, candYear, year) {
  const ck = normKey(candTitle);
  let s = 0;
  for (const t of targets) {
    const tk = normKey(t);
    if (!tk) continue;
    if (ck === tk) s += 3;
    else if (tk && (ck.includes(tk) || tk.includes(ck))) s += 1;
  }
  if (year && candYear && String(candYear) === String(year)) s += 1;
  return s;
}
