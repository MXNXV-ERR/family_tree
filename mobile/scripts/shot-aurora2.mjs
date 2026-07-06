// Verify the aurora follow-up batch: star density ×STRIP, layout-tab PAN (not
// zoom-pulse), persistent star zoom on zoom inputs, radial spoke draw-in paths,
// network fit+center, timeline row entrance, master delete confirm wiring.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));
// Auto-dismiss any confirm() — lets us probe the master delete button without deleting.
const dialogs = [];
page.on('dialog', (d) => { dialogs.push(d.message().slice(0, 120)); d.dismiss().catch(() => {}); });

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

// The star filmstrip layers are the only divs 4x wider than the viewport.
const starLayers = () => page.evaluate(() => {
  const vw = window.innerWidth;
  const out = [];
  for (const el of document.querySelectorAll('div')) {
    const w = parseFloat(el.style?.width || '0');
    if (w > vw * 4) {
      const t = getComputedStyle(el).transform;
      const m = /matrix\(([-\d.e]+), [-\d.e]+, [-\d.e]+, [-\d.e]+, ([-\d.e]+),/.exec(t ?? '');
      out.push({ scale: m ? +(+m[1]).toFixed(3) : null, tx: m ? Math.round(+m[2]) : null, stars: el.querySelectorAll('circle').length });
    }
  }
  return out;
});

// 1) star density: strip should carry ~stars×4.5 circles (default 140 → ~630)
let layers = await starLayers();
const totalStars = layers.reduce((s, l) => s + l.stars, 0);
console.log(`stars on strip: ${totalStars} across ${layers.length} layers ${totalStars > 450 ? 'OK' : 'FAIL (expected ~630)'}`);

// 2) layout tabs PAN the strip (translateX changes, scale does not pulse)
await page.getByText('Tree', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2500);
const beforeTab = await starLayers();
await page.getByText('Hourglass', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1200);
const afterTab = await starLayers();
const txMoved = beforeTab[0] && afterTab[0] && beforeTab[0].tx !== afterTab[0].tx;
console.log(`layout tab: tx ${beforeTab.map((l) => l.tx)} -> ${afterTab.map((l) => l.tx)} ${txMoved ? 'OK (panned)' : 'FAIL'}`);
await page.waitForTimeout(1000);
const settled = await starLayers();
console.log(`layout tab settle: scale ${settled.map((l) => l.scale)} (persistent pan, no pulse-back expected; tx ${settled.map((l) => l.tx)})`);
await page.screenshot({ path: `${out}/a2-tree-hourglass.png` });
await page.getByText('Pyramid', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1500);

// 3) zoom buttons nudge the star scale persistently
const beforeZoom = await starLayers();
const zoomIn = page.getByRole('button', { name: 'zoom in', exact: true }).first();
await zoomIn.click(); await page.waitForTimeout(300);
await zoomIn.click(); await page.waitForTimeout(1200);
const afterZoom = await starLayers();
const zoomed = beforeZoom[0] && afterZoom[0] && afterZoom[0].scale > beforeZoom[0].scale;
console.log(`zoom nudge: near scale ${beforeZoom.map((l) => l.scale)} -> ${afterZoom.map((l) => l.scale)} ${zoomed ? 'OK' : 'FAIL'}`);
const fitBtn = page.getByRole('button', { name: 'zoom fit', exact: true }).first();
await fitBtn.click(); await page.waitForTimeout(1100);
const afterFit = await starLayers();
console.log(`fit resets: scale ${afterFit.map((l) => l.scale)} ${afterFit.every((l) => Math.abs((l.scale ?? 1) - 1) < 0.02) ? 'OK' : 'FAIL'}`);

// 4) radial: spokes are now PATHs that draw in; cards stagger
await page.getByText('Radial', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/a2-radial-entering.png` });
await page.waitForTimeout(2500);
const spokes = await page.evaluate(() => document.querySelectorAll('svg path[stroke-linecap="round"]').length);
console.log(`radial spokes as draw-paths: ${spokes} ${spokes > 3 ? 'OK' : 'FAIL'}`);
await page.screenshot({ path: `${out}/a2-radial.png` });

// 5) network: fit + centered on focus
await page.getByText('Network', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/a2-network-entering.png` });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/a2-network.png` });

// 6) timeline rows rise in
await page.getByText('Timeline', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/a2-timeline-entering.png` });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/a2-timeline.png` });

// 7) master screen: trash button + confirm dialog (dismissed — nothing deleted)
await page.evaluate(() => { window.location.hash = ''; });
const fam = page.getByRole('button', { name: 'users', exact: true }).first();
// open the family switcher via the toolbar (family pill is the first toolbar item)
await page.goto(BASE + '/home', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(4000);
// Find a Combined row by its "families" mono subtitle in the switcher panel.
const pill = page.locator('div').filter({ hasText: /^Mehta/ }).first();
try {
  // The desktop family switcher opens from the toolbar family button.
  await page.mouse.click(120, 24);
  await page.waitForTimeout(1200);
  const combined = page.getByText(/\d+ families$/).first();
  if (await combined.count()) {
    await combined.click();
    await page.waitForTimeout(5000);
    const trash = page.getByRole('button', { name: 'trash', exact: true }).first();
    const has = await trash.count();
    console.log(`master trash button present: ${has ? 'OK' : 'FAIL'}`);
    if (has) {
      await trash.click();
      await page.waitForTimeout(800);
      console.log(`delete confirm dialog: ${dialogs.length ? `OK ("${dialogs[0]}")` : 'FAIL (no dialog)'}`);
    }
    await page.screenshot({ path: `${out}/a2-master.png` });
  } else {
    console.log('master: no combined family in account — skipped trash check');
  }
} catch (e) {
  console.log('master check error:', String(e).slice(0, 200));
}

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
