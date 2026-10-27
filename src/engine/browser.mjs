// headless chromium plumbing shared by render.mjs and validate.mjs: a local
// server for page.html, a disk cache for samples, a pool of pages with
// strudel loaded, and helpers to evaluate and render code in them

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { cacheDir, packageRoot as root } from '../paths.mjs';

// serves the package root, so the page can import strudel from node_modules
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// samples and sample maps are downloaded once into the cache directory and served
// from disk afterwards, so renders don't depend on the network or on
// a browser profile
async function cachedFetch(route) {
  const url = route.request().url();
  const file = path.join(cacheDir, crypto.createHash('sha1').update(url).digest('hex'));
  if (!fs.existsSync(file)) {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    // pages often ask for the same file at once (every worker loads the same
    // soundfont): each writes its own temporary file, and the last rename wins
    const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(tmp, await response.body());
    fs.renameSync(tmp, file);
  }
  return route.fulfill({ body: fs.readFileSync(file), headers: { 'access-control-allow-origin': '*' } });
}

/**
 * start chromium with `count` pages, each with strudel and the samples loaded.
 * onConsole(type, text) receives the pages' console errors and warnings.
 * one browser context per page: each gets its own renderer process.
 * returns { pages, close }
 */
export async function openPages(count, onConsole) {
  const server = await serve();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const close = async () => {
    await browser.close();
    server.close();
  };
  try {
    const pages = await Promise.all(
      Array.from({ length: count }, async () => {
        const context = await browser.newContext();
        await context.route(/^https:\/\/(raw\.githubusercontent\.com|cdn\.freesound\.org|felixroos\.github\.io)\//, cachedFetch);
        const page = await context.newPage();
        page.on('console', (msg) => ['error', 'warning'].includes(msg.type()) && onConsole?.(msg.type(), msg.text()));
        page.on('pageerror', (err) => onConsole?.('error', String(err.message ?? err)));
        await page.goto(`http://127.0.0.1:${server.address().port}/src/engine/page.html`);
        await page.evaluate(() => window.ready);
        return page;
      }),
    );
    return { pages, close };
  } catch (err) {
    await close();
    throw err;
  }
}

// evaluate the code in the page without playing it, keeping the pattern as
// window.pattern. returns { cps, error }
export async function evaluate(page, code) {
  return page.evaluate(async (code) => {
    window.pattern = await window.repl.evaluate(code, false);
    const error = window.repl.state.evalError;
    return { cps: window.repl.scheduler.cps, error: error ? String(error.message ?? error) : null };
  }, code);
}

// like evaluate, but throws on errors and returns the cps
export async function load(page, code) {
  const { cps, error } = await evaluate(page, code);
  if (error) throw new Error(`evaluation failed: ${error}`);
  return cps;
}

// render the notes starting in [begin, end) cycles, plus tail seconds,
// with the page's window.render. returns interleaved stereo float32 samples
export async function renderChunk(page, { begin, end, cps, tail, rate }) {
  const base64 = await page.evaluate(
    async (args) => {
      const buffer = await window.render(args);
      const [l, r] = [buffer.getChannelData(0), buffer.getChannelData(1)];
      const interleaved = new Float32Array(l.length * 2);
      for (let i = 0; i < l.length; i++) {
        interleaved[2 * i] = l[i];
        interleaved[2 * i + 1] = r[i];
      }
      const url = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(new Blob([interleaved]));
      });
      return url.slice(url.indexOf(',') + 1);
    },
    { begin, end, cps, tail, rate },
  );
  const bytes = Buffer.from(base64, 'base64');
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
}
