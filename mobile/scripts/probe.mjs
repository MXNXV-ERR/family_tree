import { chromium } from 'playwright';
const BASE='http://localhost:8082';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:414,height:896}});
await p.goto(BASE,{waitUntil:'networkidle',timeout:120000});
await p.waitForTimeout(4000);
await p.locator('input').first().fill('jatin75b@gmail.com');
const pw=p.locator('input[type="password"]'); if(await pw.count()) await pw.fill('password');
await p.getByText('Sign In',{exact:true}).click().catch(()=>{});
await p.waitForTimeout(6000);
await p.getByText('🌳',{exact:true}).click().catch(()=>{});
await p.waitForTimeout(4000);
// count occurrences of a known member name in DOM
const cnt = await p.locator('text=Mehta').count();
const diya = await p.getByText('Suresh',{exact:false}).count();
// bounding box of first svg path
const svgPaths = await p.locator('svg path').count();
const info = await p.evaluate(()=>{
  const all=[...document.querySelectorAll('*')].filter(e=>/Mehta/.test(e.textContent||'')&&e.children.length===0);
  const r=all.slice(0,3).map(e=>{const b=e.getBoundingClientRect();return {t:e.textContent.slice(0,20),x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};});
  return {leaf:all.length, sample:r};
});
console.log(JSON.stringify({cnt,diya,svgPaths,info},null,1));
await b.close();
