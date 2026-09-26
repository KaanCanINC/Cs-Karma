// Sema kontrolu: providers/*.js exports + manifest tutarliligi
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
let fail = 0;

for (const s of manifest.scrapers) {
  const f = path.join(root, s.filename);
  if (!fs.existsSync(f)) { console.error(`YOK: ${s.id} -> ${s.filename}`); fail++; continue; }
  const mod = require(f);
  if (typeof mod.getStreams !== 'function') { console.error(`getStreams yok: ${s.id}`); fail++; continue; }
  const need = ['id', 'name', 'version', 'filename', 'supportedTypes'];
  for (const k of need) {
    if (s[k] === undefined) { console.error(`${s.id}: manifest alani eksik: ${k}`); fail++; }
  }
  console.log(`ok ${s.id} (${s.filename})`);
}
if (fail > 0) { console.error(`${fail} hata`); process.exit(1); }
console.log('schema ok');
