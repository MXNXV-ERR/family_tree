// Verify the flaws round: dvh viewport, radial node→line order + weighted
// reflow, couple-pill connector endpoints, sky objects, collapsible legend,
// panel scroll, chat input inset (mobile viewport).
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';

const browser = await chromium.launch();

async function login(page) {
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
}

// ---------- desktop ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));
await login(page);

// 1) sky objects mounted (dark mode): 6 shooters (72×2) + comet (140×3) + 2 satellites + 4 motes
const sky = await page.evaluate(() => {
  const divs = [...document.querySelectorAll('div')];
  return {
    shooters: divs.filter((d) => d.style?.width === '72px' && d.style?.height === '2px').length,
    comet: divs.filter((d) => d.style?.width === '140px' && d.style?.height === '3px').length,
    sats: divs.filter((d) => d.style?.width === '2.5px').length,
    motes: divs.filter((d) => ['3px', '4px', '5px', '6px'].includes(d.style?.width) && d.style?.width === d.style?.height && d.style?.borderRadius !== '').length,
  };
});
console.log(`sky: shooters=${sky.shooters} (want 6) comet=${sky.comet} (want 1) sats=${sky.sats} (want>=2) motes=${sky.motes} (want>=4)`);

// 2) radial: depth up — capture early frames for node-before-line order + focus anchor
await page.getByText('Radial', { exact: true }).first().click();
await page.waitForTimeout(4000);
const focusBox = async () => {
  const b = await page.locator('div[style*="translate"]').first().boundingBox().catch(() => null);
  return b ? { x: Math.round(b.x), y: Math.round(b.y) } : null;
};
const lbl = await page.getByText('Depth', { exact: true }).first().boundingBox();
const before = await focusBox();
await page.mouse.click(lbl.x + lbl.width + 10 + 86, lbl.y + lbl.height / 2); // slider near max
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${out}/fl-radial-f${i}.png` });
}
await page.waitForTimeout(1800);
const after = await focusBox();
console.log(`radial focus anchor: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
await page.screenshot({ path: `${out}/fl-radial-deep.png` });

// 3) collapsible legend: click header collapses to chip
const legend = page.getByText('Relationship', { exact: true }).first();
if (await legend.count()) {
  await legend.click();
  await page.waitForTimeout(400);
  const chipOnly = await page.getByText('Parent / grandparent', { exact: true }).count();
  console.log(`legend collapse: rows visible after tap = ${chipOnly} (want 0)`);
  await page.screenshot({ path: `${out}/fl-legend-chip.png` });
  await page.getByText('Relationship', { exact: true }).first().click(); // re-expand
} else console.log('legend not found (focus bar showing?)');

// 4) tree couple connector: shot the tree for pill-border inspection
await page.getByText('Tree', { exact: true }).first().click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/fl-tree.png` });

// 5) settings drawer scrolls to Sign out (desktop drawer clip fix)
await page.getByRole('button', { name: 'settings', exact: true }).first().click();
await page.waitForTimeout(1500);
const scrolled = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 20 && d.clientHeight > 300);
  const sc = els[els.length - 1];
  if (!sc) return null;
  sc.scrollTop = sc.scrollHeight;
  return { scrollH: sc.scrollHeight, clientH: sc.clientHeight };
});
await page.waitForTimeout(600);
const signOut = await page.getByText('Sign out', { exact: true }).first().boundingBox();
const vh = await page.evaluate(() => window.innerHeight);
console.log(`settings scroll: ${JSON.stringify(scrolled)} — Sign out y=${signOut ? Math.round(signOut.y + signOut.height) : 'n/a'} vs viewport ${vh} ${signOut && signOut.y + signOut.height <= vh ? 'OK' : 'FAIL'}`);
await page.screenshot({ path: `${out}/fl-settings-bottom.png` });

console.log('desktop errors:', errors.length ? errors.slice(0, 8) : 'none');
await page.close();

// ---------- mobile viewport ----------
const m = await browser.newPage({ viewport: { width: 390, height: 740 } });
const merrs = [];
m.on('console', (x) => { if (x.type() === 'error') merrs.push(x.text().slice(0, 200)); });
await login(m);

// root fills exactly the visible viewport (dvh)
const dims = await m.evaluate(() => {
  const root = document.getElementById('root');
  return { innerH: window.innerHeight, rootH: root ? root.getBoundingClientRect().height : 0 };
});
console.log(`mobile root height: ${JSON.stringify(dims)} ${Math.abs(dims.rootH - dims.innerH) <= 2 ? 'OK' : 'CHECK'}`);
await m.screenshot({ path: `${out}/fl-mobile-home.png` });

// chat input inside viewport
await m.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await m.waitForTimeout(3500);
const inputBox = await m.locator('textarea, input').last().boundingBox().catch(() => null);
console.log(`chat input bottom: ${inputBox ? Math.round(inputBox.y + inputBox.height) : 'n/a'} vs 740 ${inputBox && inputBox.y + inputBox.height <= 740 ? 'OK' : 'FAIL'}`);
await m.screenshot({ path: `${out}/fl-mobile-chat.png` });

// radial legend chip on mobile (starts collapsed) and inside viewport
await m.goto(`${BASE}/home`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await m.waitForTimeout(3000);
await m.getByText('Radial', { exact: true }).first().click().catch(() => {});
await m.waitForTimeout(3000);
// close the focus bar if present so the legend shows
await m.locator('svg').first(); // noop keep-alive
const closeBtn = m.getByRole('button').filter({ hasText: '' });
await m.screenshot({ path: `${out}/fl-mobile-radial.png` });
const legendChip = await m.getByText('Relationship', { exact: true }).first().boundingBox().catch(() => null);
console.log(`mobile legend: ${legendChip ? `y2=${Math.round(legendChip.y + legendChip.height)} vs 740 ${legendChip.y + legendChip.height <= 740 ? 'OK' : 'FAIL'}` : 'hidden (focus bar showing) — see screenshot'}`);

console.log('mobile errors:', merrs.length ? merrs.slice(0, 6) : 'none');
await browser.close();
