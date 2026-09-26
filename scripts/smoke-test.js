// Smoke test: build cikti export + saf regex parser birim testleri (ag bagimsiz).
const assert = require('assert');

const esheaq = require('../providers/esheaq.js');
const krmzy = require('../providers/krmzy.js');
const yoturkish = require('../providers/yoturkish.js');

for (const [name, mod] of [['esheaq', esheaq], ['krmzy', krmzy], ['yoturkish', yoturkish]]) {
  assert(typeof mod.getStreams === 'function', `${name} getStreams`);
  assert(typeof mod.onSettings === 'function', `${name} onSettings`);
}

// esheaq: arama parse
{
  const html = `<div class="load-post"><article><a title="Test Dizi" href="https://esheeq.xyz/dizi/test/">x</a></article></div>`;
  const r = esheaq.__test.searchLinks(html, 'https://esheeq.xyz');
  assert(r.length === 1 && r[0].title === 'Test Dizi', 'esheaq searchLinks');
  const srv = `<div class="secContainer"><ul class="serversList"><li data-src="https://vidspeeds.com/e/abc"></li></ul></div>`;
  assert(esheaq.__test.parseServers(srv).length === 1, 'esheaq servers');
  const ep = `<div id="epiList"><article><a title="B1" href="https://esheeq.xyz/e1/">t</a></article></div>`;
  assert(esheaq.__test.parseEpisodes(ep, 'https://esheeq.xyz').length === 1, 'esheaq episodes');
}

// krmzy: server->embed eslesmesi (Kotlin'deki dallanma)
{
  const t = krmzy.__test.serverToEmbed;
  assert(t({ server: 'abc123', name: 'Pro' }).url === 'https://w.larhu.website/hls/abc123.m3u8', 'krmzy pro direkt');
  assert(t({ server: 'xyz', name: 'Arab' }).url.includes('turkvearab'), 'krmzy arab');
  assert(t({ server: 'https://iplayerhls.com/e/1', name: 'x' }).kind === 'direct-embed', 'krmzy direkt');
  const w = `<a class="fullscreen-clickable" href="https://krmzy.org/watch/1/">w</a><ul class="serversList"><li data-server="abc" data-name="Pro"></li></ul><iframe src="https://x.com/e/1"></iframe>`;
  const pw = krmzy.__test.parseWatch(w);
  assert(pw.servers.length === 1 && pw.fullscreen.includes('watch'), 'krmzy watch parse');
}

// yoturkish: bolum + link toplama
{
  const s = `<div class="item tooltipstered"><a title="Kurulus" href="https://yoturkish.to/series/kurulus/">x</a></div>`;
  assert(yoturkish.__test.parseSearch(s, 'https://yoturkish.to').length === 1, 'yoturkish search');
  const e = `<a class="episod" href="https://yoturkish.to/ep/1/">Episode 12</a>`;
  const eps = yoturkish.__test.parseEpisodes(e, 'https://yoturkish.to');
  assert(eps.length === 1 && eps[0].episode === 12, 'yoturkish episode');
  const ep2 = `<div class="dl-contenti"><a href="https://srv.tokvoy.com/v/1.m3u8">dl</a></div><div id="player"><iframe src="https://tukipasti.com/t/abc"></iframe></div>`;
  const links = yoturkish.__test.collectEpisodeLinks(ep2, 'https://yoturkish.to');
  assert(links.some(u => u.includes('tokvoy')) && links.some(u => u.includes('tukipasti')), 'yoturkish links');
  const dlHtml = `<table class="tbl1"><tr><td><a href="https://tokvoy.com/d/abc_n">Normal quality</a></td></tr></table><input type="hidden" name="op" value="download_orig"><input type="hidden" name="id" value="abc"><input type="hidden" name="mode" value="n"><input type="hidden" name="hash" value="h1">`;
  assert(yoturkish.__test.parseDlRows(dlHtml).length === 1, 'yoturkish dl rows');
  const form = yoturkish.__test.parseDlForm(dlHtml);
  assert(form.op === 'download_orig' && form.id === 'abc' && form.hash === 'h1', 'yoturkish dl form');
}

console.log('smoke ok: 3 provider export + parser testleri gecti');
