#!/usr/bin/env node
// Cs-Karma Nuvio builder: src/<id>/index.js -> providers/<id>.js (esbuild, Hermes-safe)
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const outDir = path.join(__dirname, 'providers');

function getProvidersToBuild() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
  if (args.length > 0) return args;
  if (!fs.existsSync(srcDir)) {
    console.error('src/ yok');
    process.exit(1);
  }
  return fs.readdirSync(srcDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'shared')
    .map(d => d.name);
}

async function buildOne(name) {
  const entry = path.join(srcDir, name, 'index.js');
  const out = path.join(outDir, `${name}.js`);
  if (!fs.existsSync(entry)) {
    console.warn(`skip ${name}: index.js yok`);
    return false;
  }
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: out,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2016',
    minify: false,
    banner: { js: `/** ${name} - Cs-Karma Nuvio port, built ${new Date().toISOString()} */` },
    logLevel: 'warning'
  });
  console.log(`ok ${name}.js (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
  return true;
}

(async () => {
  const list = getProvidersToBuild();
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  let ok = 0, fail = 0;
  for (const p of list) {
    try { (await buildOne(p)) ? ok++ : fail++; }
    catch (e) { console.error(`fail ${p}: ${e.message}`); fail++; }
  }
  console.log(`done: ${ok} ok, ${fail} fail`);
  if (fail > 0) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
