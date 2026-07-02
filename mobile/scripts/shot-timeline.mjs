// Verify timeline: default fit fills the screen width; kin-depth slider widens
// the selection highlight (dimmed-row count drops as depth rises).
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

await page.getByText('Timeline', { exact: true }).first().click();
await page.waitForTimeout(3500);

// 1) fit: rightmost lifespan-SVG edge should sit near the right screen edge
const fit = await page.evaluate(() => {
  let right = 0;
  for (const s of document.querySelectorAll('svg')) {
    const r = s.getBoundingClientRect();
    if (r.width > 300) right = Math.max(right, r.right);
  }
  return { right, win: window.innerWidth };
});
console.log(`fit: content right=${fit.right.toFixed(0)} window=${fit.win} ${fit.right > fit.win * 0.9 && fit.right <= fit.win + 2 ? 'OK' : 'FAIL'}`);

const dimCount = () => page.evaluate(() =>
  [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).opacity === '0.32').length);

// 2) select a row, then push kin depth up
await page.getByText('Rohan', { exact: false }).first().click();
await page.waitForTimeout(900);
const dim1 = await dimCount();
await page.screenshot({ path: `${out}/timeline-kin1.png` });

const kinLbl = await page.getByText(/^kin \d$/).boundingBox();
if (kinLbl) {
  await page.mouse.click(kinLbl.x - 8 - 72 * 0.05, kinLbl.y + kinLbl.height / 2); // sanity: near track start keeps 1
  await page.mouse.click(kinLbl.x - 8 - 72 * 0.02 + 72 * 0.97 - 72, kinLbl.y + kinLbl.height / 2);
  await page.mouse.click(kinLbl.x - 8 - 72 + 72 * 0.97, kinLbl.y + kinLbl.height / 2); // → 5
  await page.waitForTimeout(900);
}
const label = await page.getByText(/^kin \d$/).textContent();
const dim5 = await dimCount();
console.log(`kin slider: ${label} · dimmed rows ${dim1} -> ${dim5} ${dim5 < dim1 ? 'OK' : 'FAIL'}`);
await page.screenshot({ path: `${out}/timeline-kin5.png` });

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
