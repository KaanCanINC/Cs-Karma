// Hermes-safe HTTP helper'lar: sadece fetch, URL sinifi yok.
export const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
};
export const DEFAULT_TIMEOUT_MS = 15000;

export function timeoutSignal(ms = DEFAULT_TIMEOUT_MS) {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
  } catch { /* ignore */ }
  try {
    if (typeof AbortController === 'function' && typeof setTimeout === 'function') {
      const c = new AbortController();
      const t = setTimeout(() => { try { c.abort(); } catch { /* ignore */ } }, ms);
      if (t && typeof t.unref === 'function') t.unref();
      return c.signal;
    }
  } catch { /* ignore */ }
  return undefined;
}

export function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = '') {
  if (typeof setTimeout !== 'function') return Promise.resolve(promise);
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms${label ? ` (${label})` : ''}`)), ms);
  });
  return Promise.race([promise, timeout]).then(
    v => { if (timer) clearTimeout(timer); return v; },
    e => { if (timer) clearTimeout(timer); throw e; }
  );
}

export async function fetchText(url, referer, extraHeaders) {
  return await withTimeout((async () => {
    const headers = { ...DEFAULT_HEADERS, ...(extraHeaders || {}) };
    if (referer) headers['Referer'] = referer;
    const res = await fetch(url, { headers, signal: timeoutSignal(DEFAULT_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  })(), DEFAULT_TIMEOUT_MS, url);
}

export async function fetchJson(url, referer) {
  const text = await fetchText(url, referer, { 'Accept': 'application/json,text/plain,*/*' });
  return JSON.parse(text);
}

// Hermes'te URL yok: origin'i regex ile cikar.
export function originOf(url) {
  const m = String(url || '').match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : '';
}

export function absolutize(href, base) {
  const h = String(href || '').trim();
  if (!h) return '';
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith('//')) {
    const m = String(base || '').match(/^(https?:)/i);
    return (m ? m[1] : 'https:') + h;
  }
  const o = originOf(base);
  if (h.startsWith('/')) return o + h;
  return o + '/' + h;
}
