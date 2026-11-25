// Smoke test: serves the built game from dist/, opens every area with ?area=...,
// starts a new game from the title screen and fails if any page throws.
//
//   npm run test:smoke          (builds first)
//   SMOKE_AREAS=market,cave node tests/smoke/smoke.mjs   (just some areas, using the existing dist/)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
// Every area GameScene lets ?area= start in ('home' is where a new game starts anyway).
// 'tavern-room' has no ?area= switch (it needs a room taken first), so it isn't here.
const ALL_AREAS = [
  'home', 'world', 'market', 'cave', 'hut', 'plains', 'northwoods', 'watchtower', 'greyfells', 'monastery', 'abbey', 'chapel', 'infirmary', 'scriptorium',
  'refectory', 'den', 'deepden', 'tavern', 'tavern-hall', 'cellar', 'smithy', 'bakery', 'garrison', 'jail', 'residence', 'jetty', 'blackrose', 'blackrose-back', 'blackrose-upstairs', 'warren', 'broodhall',
  'gloomhaven', 'tollhouse', 'tollhouse-strong', 'tollhouse-upstairs',
];
const AREAS = process.env.SMOKE_AREAS ? process.env.SMOKE_AREAS.split(',') : ALL_AREAS;
/** How many areas load at once. */
const PARALLEL = Number(process.env.SMOKE_PARALLEL ?? 3);
/**
 * How long each step of loading an area gets (the title screen, then the game), and how long it then runs
 * before it counts as fine. CI's software-rendered browsers, three at once, take over a minute to draw all
 * the art, so a minute was cutting it fine: a different area or two missed it on most runs.
 */
const LOAD_TIMEOUT = 120_000;
const SETTLE_MS = 3_000;

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.md': 'text/plain',
};

function serve() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) return res.writeHead(403).end();
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function checkArea(browser, base, area) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e)));
  page.on('console', (m) => m.type() === 'error' && warnings.push(m.text()));
  page.on('requestfailed', (r) => warnings.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
  page.on('response', (r) => r.status() >= 400 && warnings.push(`HTTP ${r.status()}: ${r.url()}`));
  const started = Date.now();
  try {
    await page.goto(`${base}/?smoke&area=${area}`);
    // Wait for the title screen, then press Enter for a new game (a fresh browser has no save).
    await page.waitForFunction(() => window.game?.scene.isActive('MainMenu'), null, { timeout: LOAD_TIMEOUT });
    await page.waitForFunction(() => window.game.scene.getScene('MainMenu').input.enabled, null, { timeout: LOAD_TIMEOUT });
    await page.keyboard.press('Enter');
    // A new game first asks whether the hero needs to eat and rest: answer "no" (2).
    await page.waitForFunction(() => window.game.scene.isActive('Confirm'), null, { timeout: LOAD_TIMEOUT });
    await page.waitForTimeout(250);
    await page.keyboard.press('2');
    await page.waitForFunction(
      (want) => {
        const game = window.game.scene.getScene('Game');
        return window.game.scene.isActive('Game') && game.area === want && !!game.player;
      },
      area,
      { timeout: LOAD_TIMEOUT },
    );
    // Let it run for a moment, walking a step so the update loop does some real work.
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(SETTLE_MS / 2);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(SETTLE_MS / 2);
    const now = await page.evaluate(() => window.game.scene.getScene('Game').area);
    if (now !== area && !errors.length) warnings.push(`moved on to "${now}" while settling`);
  } catch (e) {
    errors.push(`did not reach the game: ${e.message.split('\n')[0]}`);
  }
  await context.close();
  return { area, errors, warnings, seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

/**
 * The ?debug panel: it opens, the new-game switches take, and its buttons work on the game going on
 * (a teleport, a flag, coins). Skipped with SMOKE_DEBUG=0.
 */
async function checkDebugPanel(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e)));
  page.on('console', (m) => m.type() === 'error' && warnings.push(m.text()));
  const started = Date.now();
  try {
    await page.goto(`${base}/?smoke&debug`);
    await page.waitForSelector('#eldermoor-debug', { timeout: LOAD_TIMEOUT });
    await page.waitForFunction(() => window.game?.scene.isActive('MainMenu') && window.game.scene.getScene('MainMenu').input.enabled, null, { timeout: LOAD_TIMEOUT });
    // Pick the switches on the title screen, then begin: the game starts where they say.
    await page.selectOption('#dbg-area', 'world');
    await page.fill('#dbg-hour', '21');
    await page.click('#eldermoor-debug button:text("Start a new game with these")');
    if (!(await page.evaluate(() => location.search.includes('area=world') && location.search.includes('hour=21')))) throw new Error('switches not written to the address');
    await page.keyboard.press('Enter');
    // A new game first asks whether the hero needs to eat and rest: answer "no" (2).
    await page.waitForFunction(() => window.game.scene.isActive('Confirm'), null, { timeout: LOAD_TIMEOUT });
    await page.waitForTimeout(250);
    await page.keyboard.press('2');
    await page.waitForFunction(() => window.game.scene.getScene('Game')?.area === 'world' && !!window.game.scene.getScene('Game').player, null, { timeout: LOAD_TIMEOUT });
    const hour = await page.evaluate(() => window.game.scene.getScene('Game').clock.hour);
    if (Math.floor(hour) !== 21) throw new Error(`started at hour ${hour}, not 21`);
    // Teleport, a flag, coins.
    await page.selectOption('#eldermoor-debug .row:has(label:text("Teleport")) select', 'market');
    await page.click('#eldermoor-debug .row:has(label:text("Teleport")) button');
    await page.waitForFunction(() => window.game.scene.getScene('Game').area === 'market' && !!window.game.scene.getScene('Game').player, null, { timeout: LOAD_TIMEOUT });
    await page.fill('#eldermoor-debug .row:has(label:text("Flag")) input', 'smoke-flag');
    await page.click('#eldermoor-debug .row:has(label:text("Flag")) button:text("Set")');
    await page.waitForFunction(() => document.querySelector('#eldermoor-debug .flags')?.textContent.includes('smoke-flag'), null, { timeout: 5000 });
    const coins = () => page.evaluate(() => Number(/(\d+)c\b/.exec(document.querySelector('#eldermoor-debug .status').textContent)?.[1]));
    const before = await coins();
    await page.click('#eldermoor-debug button:text("+100")');
    await page.waitForFunction((was) => document.querySelector('#eldermoor-debug .status').textContent.includes(`${was + 100}c`), before, { timeout: 5000 });
    await page.waitForTimeout(SETTLE_MS);
  } catch (e) {
    errors.push(`debug panel: ${e.message.split('\n')[0]}`);
  }
  await context.close();
  return { area: 'debug panel', errors, warnings, seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const queue = [...AREAS];
await Promise.all(
  Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    while (queue.length) {
      const r = await checkArea(browser, base, queue.shift());
      results.push(r);
      console.log(`${r.errors.length ? 'FAIL' : 'ok  '} ${r.area.padEnd(12)} ${r.seconds}s`);
      for (const e of r.errors) console.log(`       error: ${e}`);
      for (const w of r.warnings) console.log(`       warning: ${w}`);
    }
  }),
);
if (process.env.SMOKE_DEBUG !== '0') {
  const r = await checkDebugPanel(browser, base);
  results.push(r);
  console.log(`${r.errors.length ? 'FAIL' : 'ok  '} ${r.area.padEnd(12)} ${r.seconds}s`);
  for (const e of r.errors) console.log(`       error: ${e}`);
  for (const w of r.warnings) console.log(`       warning: ${w}`);
}
await browser.close();
server.close();

const failed = results.filter((r) => r.errors.length);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed without errors.`);
process.exit(failed.length ? 1 : 0);
