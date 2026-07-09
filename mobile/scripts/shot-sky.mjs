// Round-2 checks: themed sky (night shapes/moon vs day sun/clouds/planes/
// balloons/birds), density slider behaviour, respawning meteors, tree line
// cascade after the generations slider, sibling Order button.
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

// ---- 1) DARK sky inventory ----
const darkSky = await page.evaluate(() => {
  const divs = [...document.querySelectorAll('div')];
  const paths = [...document.querySelectorAll('svg path')];
  return {
    meteors: divs.filter((d) => d.style?.width === '72px' && d.style?.height === '2px').length,
    comet: divs.filter((d) => d.style?.width === '140px' && d.style?.height === '3px').length,
    sats: divs.filter((d) => d.style?.width === '2.5px').length,
    // phase moon: lit-region path, fill #e9e4f6 (near new moon this is 0 — earthshine disc only)
    moon: paths.filter((p) => (p.getAttribute('fill') || '') === '#e9e4f6').length,
    maria: [...document.querySelectorAll('svg circle')].filter((c) => (c.getAttribute('fill') || '') === '#9d94c0').length,
    // shaped stars: white/gold filled paths with fill-opacity 0.75
    shapedStars: paths.filter((p) => p.getAttribute('fill-opacity') === '0.75').length,
    saturnRing: document.querySelectorAll('svg ellipse').length,
    // spinning galaxy: two spiral arms stroke #cfc6ff
    nebulaArms: paths.filter((p) => (p.getAttribute('stroke') || '') === '#cfc6ff').length,
    // constellation joins: 1px-high hairline Views in the shimmer colour
    constSegs: divs.filter((d) => d.style?.height === '1px' && (d.style?.backgroundColor || '') === 'rgb(232, 226, 255)').length,
    // woven constellations: permanent faint SVG lines riding the near star strip
    wovenLines: document.querySelectorAll('svg line[stroke="#cfc6ff"]').length,
  };
});
console.log(`dark: meteors=${darkSky.meteors} (want 2) comet=${darkSky.comet} (want 1) sats=${darkSky.sats} (want 2) moon=${darkSky.moon} (want 1) maria=${darkSky.maria} (want 4) shaped=${darkSky.shapedStars} (want ~42) saturnEllipse=${darkSky.saturnRing} (want>=1) nebulaArms=${darkSky.nebulaArms} (want 2) constSegs=${darkSky.constSegs} (want>=4) wovenLines=${darkSky.wovenLines} (want>=25)`);
await page.screenshot({ path: `${out}/sky-dark.png` });

// ---- 2) meteor respawn randomness: sample left positions over time ----
const meteorPos = async () => page.evaluate(() =>
  [...document.querySelectorAll('div')].filter((d) => d.style?.width === '72px' && d.style?.height === '2px')
    .map((d) => d.parentElement?.style?.left).join(','));
const posA = await meteorPos();
await page.waitForTimeout(9000);
const posB = await meteorPos();
console.log(`meteor respawn: positions changed = ${posA !== posB ? 'OK' : 'FAIL'}\n  A: ${posA}\n  B: ${posB}`);

// ---- 3) LIGHT sky: toggle theme via settings ----
await page.getByRole('button', { name: 'theme', exact: true }).first().click().catch(async () => {
  // fall back: settings drawer theme cards
  await page.getByRole('button', { name: 'settings', exact: true }).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Light', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape').catch(() => {});
});
await page.waitForTimeout(2500);
const lightSky = await page.evaluate(() => {
  const divs = [...document.querySelectorAll('div')];
  const svgs = [...document.querySelectorAll('svg')];
  const stops = [...document.querySelectorAll('stop')].map((s) => (s.getAttribute('stop-color') || '').toLowerCase());
  const paths = [...document.querySelectorAll('svg path')];
  return {
    sun: stops.filter((s) => s === '#e8a54b').length,
    clouds: divs.filter((d) => (d.style?.backgroundColor || '') === 'rgba(120, 100, 60, 0.1)').length,
    balloons: divs.filter((d) => d.style?.width === '10px' && d.style?.height === '11px').length,
    birdsOrPlanes: svgs.filter((s) => (s.getAttribute('width') === '13' && s.getAttribute('height') === '6') || (s.getAttribute('width') === '12' && s.getAttribute('height') === '9')).length,
    // ground band: three ridge paths in the warm-ink fills
    ridges: paths.filter((p) => ['rgba(120,100,60,0.08)', 'rgba(120,100,60,0.13)', 'rgba(110,92,55,0.18)'].includes(p.getAttribute('fill') || '')).length,
    trees: paths.filter((p) => (p.getAttribute('fill') || '') === 'rgba(96,78,44,1)').length,
    oldInkSatellite: divs.filter((d) => (d.style?.backgroundColor || '').includes('rgba(96, 78, 44, 0.5)')).length,
    darkStars: divs.filter((d) => d.style?.width === '72px' && d.style?.height === '2px').length,
  };
});
console.log(`light: sunStops=${lightSky.sun} (want>=1) cloudPills=${lightSky.clouds} (want>=30) balloons=${lightSky.balloons} (want 3) birds/planes=${lightSky.birdsOrPlanes} (want>=1) ridges=${lightSky.ridges} (want 3) treePaths=${lightSky.trees} (want>15) oldSatellite=${lightSky.oldInkSatellite} (want 0) meteors=${lightSky.darkStars} (want 0)`);
await page.screenshot({ path: `${out}/sky-light.png` });

// settings label should say Cloud density in light mode
await page.getByRole('button', { name: 'settings', exact: true }).first().click();
await page.waitForTimeout(1400);
const cloudLabel = await page.getByText('Cloud density', { exact: true }).count();
console.log(`settings label light: 'Cloud density' found = ${cloudLabel > 0 ? 'OK' : 'FAIL'}`);
await page.screenshot({ path: `${out}/sky-settings-light.png` });
// back to dark
await page.getByText('Dark', { exact: true }).first().click();
await page.waitForTimeout(1200);
const starLabel = await page.getByText('Star density', { exact: true }).count();
console.log(`settings label dark: 'Star density' found = ${starLabel > 0 ? 'OK' : 'FAIL'}`);
// close drawer via scrim click
await page.mouse.click(300, 450);
await page.waitForTimeout(800);

// ---- 4) tree cascade: move generations slider, frames ----
await page.getByText('Tree', { exact: true }).first().click();
await page.waitForTimeout(2500);
const lbl = await page.getByText('Generations', { exact: true }).first().boundingBox();
if (lbl) {
  await page.mouse.click(lbl.x + lbl.width + 10 + 20, lbl.y + lbl.height / 2); // slider low
  await page.waitForTimeout(2500);
  await page.mouse.click(lbl.x + lbl.width + 10 + 98, lbl.y + lbl.height / 2); // slider max
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(380);
    await page.screenshot({ path: `${out}/tree-cascade-f${i}.png` });
  }
} else console.log('Generations slider not found');

// ---- 5) sibling Order button on a profile ----
await page.getByText('Radial', { exact: true }).first().click();
await page.waitForTimeout(2500);
// open a profile from focus bar
const profileBtn = page.getByText('Profile →', { exact: true }).first();
if (await profileBtn.count()) {
  await profileBtn.click();
  await page.waitForTimeout(2200);
  const orderBtn = await page.getByText('Order', { exact: true }).count();
  console.log(`profile Order button present: ${orderBtn > 0 ? 'OK' : 'CHECK (needs Siblings group + role)'}`);
  if (orderBtn > 0) {
    await page.getByText('Order', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    const sheet = await page.getByText('Age order', { exact: true }).count();
    const gen1 = await page.getByText(/Generation 1/i).count();
    console.log(`order sheet opens with generation groups: ${sheet > 0 && gen1 > 0 ? 'OK' : 'FAIL'}`);
    await page.screenshot({ path: `${out}/order-sheet.png` });
  }
} else console.log('profile entry (Profile →) not found — skipped order-sheet check');

console.log('console/page errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
