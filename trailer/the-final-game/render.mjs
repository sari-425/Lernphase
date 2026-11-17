import { createRequire } from 'module'; import { execSync } from 'child_process'; const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
import { spawn } from 'child_process';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.cwd();
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : 'text/html'); r.end(d); }); }).listen(8765);
const [,, mode, a, b, fpsArg] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => console.log('[page]', m.text())); page.on('pageerror', e => console.log('[err]', e.message));
await page.goto('http://localhost:8765/scene.html');
await page.waitForFunction(() => window.renderFrame);
await page.evaluate(() => window.ready);
if (mode === 'stills') {
  const times = a.split(',').map(Number);
  for (const t of times) { const d = await page.evaluate(t => window.renderFrame(t), t); fs.writeFileSync(`${process.env.OUT || "stills"}/s_${t.toFixed(2)}.jpg`, Buffer.from(d.split(',')[1], 'base64')); console.log('still', t); }
} else {
  const fps = Number(fpsArg || 24), t0 = Number(a), t1 = Number(b);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', mode], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round((t1 - t0) * fps); const st = Date.now();
  for (let i = 0; i < N; i++) {
    const d = await page.evaluate(t => window.renderFrame(t), t0 + i / fps);
    if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 48 === 0) console.log(`frame ${i}/${N} ${((Date.now() - st) / (i + 1)).toFixed(0)}ms/f`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close(); srv.close();
