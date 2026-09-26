import { withTimeout, timeoutSignal, DEFAULT_TIMEOUT_MS } from './http.js';
import { createTtlCache } from './cache.js';

const tmdbInfoCache = createTtlCache(30 * 60 * 1000, 300);
// turkish-nuvio ile ayni paylasilan topluluk anahtari (kisisel degil).
const DEFAULT_TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

export function getTmdbApiKey() {
  try {
    const s = typeof globalThis !== 'undefined' ? globalThis.SCRAPER_SETTINGS : null;
    const k = s && s.tmdbApiKey ? String(s.tmdbApiKey).trim() : '';
    if (k) return k;
  } catch { /* ignore */ }
  try {
    const inj = typeof globalThis !== 'undefined' ? globalThis.TMDB_API_KEY : '';
    if (inj) return String(inj).trim();
  } catch { /* ignore */ }
  return DEFAULT_TMDB_API_KEY;
}

export function tmdbApiKeySettingsLayout() {
  return [
    { type: 'header', label: 'TMDB API Anahtari (opsiyonel)' },
    {
      type: 'text', key: 'tmdbApiKey', label: 'Kendi TMDB API anahtarin',
      description: 'Bos birakirsan paylasilan varsayilan anahtar kullanilir.',
      defaultValue: ''
    }
  ];
}

export async function getTmdbInfo(tmdbId, mediaType) {
  const empty = { title: '', originalTitle: '', turkishTitle: '', year: '', imdbId: null };
  const apiKey = getTmdbApiKey();
  if (!apiKey) return empty;
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  return await tmdbInfoCache.remember(
    `${type}:${tmdbId}`,
    async () => {
      try {
        const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}&append_to_response=external_ids,translations`;
        const res = await withTimeout((async () => {
          const r = await fetch(url, { signal: timeoutSignal(DEFAULT_TIMEOUT_MS) });
          if (!r.ok) throw new Error(`TMDB ${r.status}`);
          return await r.json();
        })(), DEFAULT_TIMEOUT_MS, 'tmdb');
        let turkishTitle = '';
        const trs = (res.translations && res.translations.translations) || [];
        const tr = trs.find(t => t.iso_3166_1 === 'TR' || t.iso_639_1 === 'tr');
        if (tr) turkishTitle = (tr.data && (tr.data.title || tr.data.name)) || '';
        return {
          title: res.name || res.title || res.original_title || '',
          originalTitle: res.original_title || res.original_name || '',
          turkishTitle,
          year: ((res.release_date || res.first_air_date) || '').slice(0, 4),
          imdbId: (res.external_ids && res.external_ids.imdb_id) || res.imdb_id || null
        };
      } catch { return empty; }
    },
    30 * 60 * 1000,
    v => !!(v && (v.title || v.originalTitle || v.imdbId))
  );
}
