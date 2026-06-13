import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 414, height: 896 } });
await p.goto('http://localhost:8082', { timeout: 150000 });
await p.waitForSelector('input', { timeout: 150000 });
await p.locator('input').first().fill('jatin75b@gmail.com');
await p.locator('input[type="password"]').fill('password');
await p.getByText('Sign In', { exact: true }).click();
await p.waitForTimeout(6000);
await p.getByText('Open tree', { exact: false }).click();
await p.waitForTimeout(3000);
// pick the VISIBLE timeline tab etc. — stack keeps home mounted underneath
const vis = async (txt) => {
  for (const el of await p.getByText(txt, { exact: false }).all()) {
    const box = await el.boundingBox();
    if (box) return { el, box };
  }
  return null;
};
await (await vis('timeline')).el.click();
await p.waitForTimeout(2000);
const hit = await vis('Dhirubhai');
console.log('box:', JSON.stringify(hit?.box));
if (hit) await p.mouse.click(hit.box.x + hit.box.width / 2, hit.box.y + hit.box.height / 2);
await p.waitForTimeout(1200);
const body = await p.locator('body').innerText();
const m = body.match(/Dhirubhai[^\n]*·[^\n]*/g);
console.log('tooltip:', m ? m.slice(-1)[0] : '(none)');
console.log('hasYour:', /Your /.test(body), '| relLabels:', (body.match(/\b(son|daughter|partner|child|parent|sibling)\b/gi) || []).slice(0,6));
await p.screenshot({ path: 'scripts/shots/d-timeline-focus.png' });
await b.close();
