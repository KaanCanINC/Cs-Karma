// Dean Edwards P.A.C.K.E.R cozucu (Cloudstream getAndUnpack karsiligi, sade).
// vidspeed / turkvearab / engifuosi betiklerindeki eval(...) yukunu acar.
function unpackArgs(p, a, c, k, e) {
  const d = {};
  e = function (x) { return x.toString(a); };
  const dec = function (x) {
    let r = '';
    if (!x) return 0;
    for (let i = 0; i < x.length; i++) {
      const ch = x[i];
      if (d[ch] === undefined) {
        const v = e(d[ch] === undefined ? Object.keys(d).length : d[ch]);
        d[ch] = v;
      }
      r += d[ch] || ch;
    }
    return r;
  };
  // klasik unpack mantigi: c tabaninda sayilari k[] ile degistir
  let out = p;
  const dict = {};
  const encode = (n) => {
    if (a <= 36) return n.toString(a);
    // 36+ taban icin genisletilmis alfabe
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let s = '';
    do { s = chars[n % a] + s; n = Math.floor(n / a); } while (n > 0);
    return s;
  };
  for (let i = c - 1; i >= 0; i--) {
    dict[encode(i)] = k[i] || encode(i);
  }
  out = out.replace(/\b\w+\b/g, (w) => (dict[w] !== undefined ? dict[w] : w));
  return out;
}

export function getAndUnpack(text) {
  const src = String(text || '');
  if (!src.includes('eval(')) return src;
  // eval(function(p,a,c,k,e,d){...}('...',36,..,''.split('|')))
  const m = src.match(/eval\(function\(p,a,c,k,e,(?:r|d)?\)\{[^}]*\}\s*\(\s*'([\s\S]*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/);
  if (!m) return src;
  try {
    const p = m[1].replace(/\\'/g, "'");
    const a = parseInt(m[2], 10);
    const c = parseInt(m[3], 10);
    const k = m[4].split('|');
    return unpackArgs(p, a, c, k);
  } catch { return src; }
}

export function extractFileUrl(unpackedHtml) {
  const s = String(unpackedHtml || '');
  let m = s.match(/file\s*:\s*"([^"]+)"/i);
  if (m && m[1]) return m[1];
  m = s.match(/file\s*:\s*'([^']+)'/i);
  if (m && m[1]) return m[1];
  m = s.match(/source\s*:\s*"([^"]+\.m3u8[^"]*)"/i);
  if (m && m[1]) return m[1];
  m = s.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (m && m[1]) return m[1];
  return '';
}

export function extractHlsList(unpackedHtml) {
  const s = String(unpackedHtml || '');
  const out = [];
  const re = /"hls\d+"\s*:\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}
