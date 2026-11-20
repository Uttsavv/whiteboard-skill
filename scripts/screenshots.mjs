// Regenerate the README images from the example board, in light and dark.
//   python3 skills/whiteboard/scripts/build.py skills/whiteboard/example && node scripts/screenshots.mjs
// Needs Node 22+ and Google Chrome (set CHROME=/path/to/chrome to override). Writes docs/images/*.webp.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = pathToFileURL(resolve(root, 'skills/whiteboard/example/index.html')).href;
const out = resolve(root, 'docs/images');
const chromePath = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chromePath)) throw new Error('Chrome not found; set CHROME=/path/to/chrome');
mkdirSync(out, { recursive: true });

const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, '--hide-scrollbars',
  `--user-data-dir=${mkdtempSync(tmpdir() + '/wb-shots')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); } }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let seq = 0; const pending = {};
ws.onmessage = e => { const m = JSON.parse(e.data); if (pending[m.id]) { pending[m.id](m.result); delete pending[m.id]; } };
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending[id] = r; ws.send(JSON.stringify({ id, method, params })); });
const run = async body => (await send('Runtime.evaluate', {
  expression: `(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));${body}})()`, awaitPromise: true, returnByValue: true })).result?.value;

const W = 1240;
// Page-level shots keep the rail and the notes dock; board shots show one board alone.
const shots = [
  { name: 'overview', height: 720, setup: `scrollTo(0,0)` },
  { name: 'feedback', height: 720, setup: `
      document.getElementById('open').querySelector('.board-head').click(); await sleep(500);
      document.querySelector('#open .opt').click();
      const note = (sel, kind, text) => {
        document.querySelector('.wb-dock [data-act=pick]').click();
        document.querySelector(sel).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        document.querySelector('.wb-panel [data-kind=' + kind + ']').click();
        document.querySelector('.wb-panel textarea').value = text;
        document.querySelector('.wb-panel [data-act=save]').click(); };
      note('#data [data-tag=saved-filters] h3', 'question', 'Why a bool and not a visibility enum? Per-role sharing may come later.');
      note('#api tbody tr td', 'change', 'Return team filters as a separate list so the UI can group them.');
      scrollTo(0, document.getElementById('open').getBoundingClientRect().top + scrollY - 24);
      await sleep(200); document.querySelector('.wb-dock [data-act=tray]').click();` },
  { name: 'system', board: 'system' },
  { name: 'build-order', board: 'build' },
];

for (const theme of ['light', 'dark']) {
  for (const s of shots) {
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: s.height || 900, deviceScaleFactor: 2, mobile: false });
    await send('Page.navigate', { url: page }); await sleep(800);
    await run(`localStorage.clear(); localStorage.setItem('wb-theme', '${theme}');`);
    await send('Page.reload'); await sleep(2500);
    await run(`document.documentElement.style.scrollBehavior = 'auto'`);
    if (s.board) {
      await run(`document.querySelectorAll('nav.rail, .wb-dock').forEach(n => n.style.display = 'none');
                 const sh = document.querySelector('.shell'); sh.style.display = 'block'; sh.style.padding = '24px 24px 100vh'; await sleep(300);`);
      const h = await run(`return Math.ceil(document.getElementById('${s.board}').getBoundingClientRect().height) + 48`);
      await send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: 2, mobile: false });
      await sleep(400);
      await run(`scrollTo(0, document.getElementById('${s.board}').getBoundingClientRect().top + scrollY - 24); await sleep(150);`);
    } else await run(s.setup);
    await sleep(400);
    const shot = await send('Page.captureScreenshot', { format: 'webp', quality: 90 });
    writeFileSync(`${out}/${s.name}-${theme}.webp`, Buffer.from(shot.data, 'base64'));
    console.log(`${s.name}-${theme}.webp`);
  }
}
chrome.kill(); process.exit(0);
