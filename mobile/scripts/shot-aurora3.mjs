// Round-3 checks: radial depth-change anchors the focus node (no reset, only
// rings move, lines fade→glide→redraw), starfield strip 6× (840 stars @140),
// shooting-star wiring, aurora glow-colour setting.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(4000);
const email = page.locator('input[type="email"], input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(7000);
}

// 1) star strip density: 140 × 6 = 840
const starCount = await page.evaluate(() => {
  const vw = window.innerWidth;
  let n = 0;
  for (const el of document.querySelectorAll('div')) {
    const w = parseFloat(el.style?.width || '0');
    if (w > vw * 4) n += el.querySelectorAll('circle').length;
  }
  return n;
});
console.log(`stars on strip: ${starCount} ${starCount === 840 ? 'OK' : 'CHECK (expected 840)'}`);

// 2) shooting-star wiring: the streak views exist in the DOM (opacity-animated)
const shooters = await page.evaluate(() =>
  [...document.querySelectorAll('div')].filter((d) => d.style?.width === '72px' && d.style?.height === '2px').length);
console.log(`shooting stars mounted: ${shooters} ${shooters === 3 ? 'OK' : 'FAIL'}`);

// 3) radial: zoom in, change depth — focus card must NOT move; spokes redraw
await page.getByText('Radial', { exact: true }).first().click();
await page.waitForTimeout(4000);
const zoomIn = page.getByRole('button', { name: 'zoom in', exact: true }).first();
await zoomIn.click(); await zoomIn.click();
await page.waitForTimeout(1200);

const focusBox = async () => {
  const b = await page.getByText('Rohan', { exact: true }).first().boundingBox();
  return b ? { x: Math.round(b.x), y: Math.round(b.y) } : null;
};
const before = await focusBox();
const spokesBefore = await page.evaluate(() => document.querySelectorAll('svg path[stroke-linecap="round"]').length);

// depth slider sits right of the "Depth" label in the floating pill
const lbl = await page.getByText('Depth', { exact: true }).first().boundingBox();
await page.mouse.click(lbl.x + lbl.width + 10 + 86, lbl.y + lbl.height / 2); // near track max
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/a3-radial-mid.png` });
await page.waitForTimeout(2600);
const after = await focusBox();
const spokesAfter = await page.evaluate(() => document.querySelectorAll('svg path[stroke-linecap="round"]').length);
const anchored = before && after && Math.abs(before.x - after.x) <= 3 && Math.abs(before.y - after.y) <= 3;
console.log(`focus anchor: ${JSON.stringify(before)} -> ${JSON.stringify(after)} ${anchored ? 'OK' : 'FAIL'}`);
console.log(`spokes: ${spokesBefore} -> ${spokesAfter} ${spokesAfter > spokesBefore ? 'OK (deeper rings drawn)' : 'CHECK'}`);
await page.screenshot({ path: `${out}/a3-radial-deep.png` });

// depth back down — anchor again
await page.mouse.click(lbl.x + lbl.width + 10 + 4, lbl.y + lbl.height / 2);
await page.waitForTimeout(2600);
const back = await focusBox();
console.log(`anchor after depth down: ${JSON.stringify(back)} ${back && Math.abs(back.x - before.x) <= 3 ? 'OK' : 'FAIL'}`);

// 4) aurora glow colour setting
await page.getByRole('button', { name: 'settings', exact: true }).first().click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'glow gold', exact: true }).click();
await page.waitForTimeout(900);
const stops = await page.evaluate(() => [...document.querySelectorAll('stop')].map((s) => s.getAttribute('stop-color')));
const goldOn = stops.some((s) => (s ?? '').toLowerCase() === '#ffce6b');
console.log(`aurora gold applied: ${goldOn ? 'OK' : 'FAIL'} (stops: ${[...new Set(stops)].slice(0, 6).join(', ')})`);
await page.screenshot({ path: `${out}/a3-aurora-gold.png` });
await page.getByRole('button', { name: 'glow violet', exact: true }).click(); // restore default
await page.waitForTimeout(500);

console.log('console/page errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
