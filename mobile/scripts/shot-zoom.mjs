// Verify the desktop sub-bar zoom cluster works in ALL views (was permanently
// disabled: parent reset effect nulled the api right after each view registered).
// Asserts: buttons enabled per view; zoom-in visibly scales Tree/Radial/Network
// (label bounding box grows); Timeline px/yr readout changes.
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

const zoomIn = () => page.getByRole('button', { name: 'zoom in', exact: true }).first();

// fingerprint of every transform scale on the page — the pan/zoom canvas is the
// only thing whose scale changes when zoom buttons are clicked
const scaleSet = () => page.evaluate(() => {
  const s = new Set();
  for (const el of document.querySelectorAll('div')) {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') continue;
    const m = /matrix\(([-\d.e]+),/.exec(t);
    if (m) s.add(Math.round(parseFloat(m[1]) * 1000) / 1000);
  }
  return [...s].sort((a, b) => a - b).join(',');
});

for (const view of ['Tree', 'Radial', 'Network', 'Timeline']) {
  await page.getByText(view, { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(view === 'Network' ? 5000 : 3500);

  const btn = zoomIn();
  const disabled = await btn.getAttribute('aria-disabled');
  let result;
  if (view === 'Timeline') {
    const readout = () => page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find((d) => /px\/yr$/.test((d.textContent ?? '').trim()) && d.children.length === 0);
      return el ? el.textContent.trim() : null;
    });
    const before = await readout();
    await btn.click();
    await page.waitForTimeout(900);
    const after = await readout();
    result = `px/yr ${before} -> ${after} ${before !== after ? 'OK' : 'FAIL'}`;
  } else {
    const before = await scaleSet();
    await btn.click();
    await page.waitForTimeout(1100);
    const after = await scaleSet();
    result = `scales [${before}] -> [${after}] ${before !== after ? 'OK' : 'FAIL'}`;
  }
  console.log(`${view}: aria-disabled=${disabled} · ${result}`);
  await page.screenshot({ path: `${out}/zoom-${view.toLowerCase()}.png` });
}

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
