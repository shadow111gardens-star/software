import type { BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import type { LocalAppFlow } from '../../services/app/local-app-flow';
import { filterProducts } from '../../services/catalog/local-catalog';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export async function validateStore(main: BrowserWindow, flow: LocalAppFlow): Promise<void> {
  const execute = (code: string) => main.webContents.executeJavaScript(code);
  const until = async (check: () => Promise<boolean>) => { const end=Date.now()+15000; while (!await check()) { if(Date.now()>end)throw new Error('Store validation timed out');await delay(40); } };
  const click = async (selector: string) => { await until(()=>execute(`!!document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`)); await execute(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(60); };
  let requests=0; let windows=0;
  const session=main.webContents.session;
  session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>{requests++;callback({cancel:true});});
  const popup=()=>{windows++;}; main.webContents.on('did-create-window',popup);
  const products=flow.getProducts(); const settings=JSON.stringify(flow.getSnapshot().settings);
  try {
    assert.equal(await execute(`document.querySelector('h1').textContent`),'Character Store');
    for (const filter of ['all','featured','free','premium','installed'] as const) {
      await execute(`Array.from(document.querySelectorAll('.filters button')).find(b=>b.textContent.toLowerCase()===${JSON.stringify(filter)}).click()`);
      await delay(60);
      const ids=await execute(`Array.from(document.querySelectorAll('.store-grid [data-product]')).map(p=>p.dataset.product).sort()`);
      assert.deepEqual(ids,filterProducts(products,filter).map(p=>p.id).sort());
    }
    await click('.filters button:first-child');
    for (const [query,expected] of [['AIKO','aiko'],['nEkO','concept-neko'],['no-such-product',null],['','all']] as const) {
      await execute(`(()=>{const i=document.querySelector('input[type="search"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(query)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`); await delay(70);
      const ids=await execute(`Array.from(document.querySelectorAll('.store-grid [data-product]')).map(p=>p.dataset.product)`);
      if(expected==='all')assert.equal(ids.length,products.length);else assert.deepEqual(ids,expected?[expected]:[]);
      if(!expected)assert.equal(await execute(`document.querySelector('.empty-state h2').textContent`),'No characters found');
    }
    await click('[data-product="aiko"] .card-open');
    await until(()=>execute(`document.querySelector('[data-detail-product="aiko"] [aria-busy]').getAttribute('aria-busy')==='false' && document.querySelectorAll('[data-detail-product="aiko"] [data-state-preview] img').length===16`));
    const manifest=JSON.parse(await readFile('dist/assets/characters/aiko/manifest.json','utf8'));
    assert.deepEqual(await execute(`Array.from(document.querySelectorAll('.product-detail [data-state-preview]')).map(b=>b.dataset.statePreview)`),CURSOR_STATES);
    for(const state of CURSOR_STATES) {
      const selector=`.product-detail [data-state-preview="${state}"]`;
      await execute(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
      await click(selector);
      const preview=await execute(`(()=>{const i=document.querySelector('.selected-state img');return {src:i.src,state:document.querySelector('.selected-state>span').textContent,decoded:i.complete&&i.naturalWidth>0};})()`);
      assert.equal(preview.state,state);assert.equal(preview.decoded,true);
      assert.equal(preview.src,'data:image/png;base64,'+(await readFile(join('dist/assets/characters/aiko',manifest.states[state]))).toString('base64'));
    }
    await click('.product-detail [data-action="activate"]');
    await until(async()=>flow.getSnapshot().settings.activeCharacterId==='aiko');
    await until(()=>execute(`!document.querySelector('.product-detail [data-action="activate"]').disabled`));
    for(const product of products.filter(p=>!p.isFree&&!p.installed)) {
      await click(`[data-product="${product.id}"] [data-action="buy"]`);
      await until(()=>execute(`document.querySelector('.purchase-notice')?.open===true`));
      assert.equal(await execute(`document.querySelector('#purchase-title').textContent`),'Purchases coming soon');
      assert.equal(await execute(`document.querySelector('#purchase-description').textContent`),'Premium character purchases will be available in a future update.');
      await click('.purchase-notice button');
      await click(`[data-product="${product.id}"] .card-open`);
      assert.equal(await execute(`document.querySelector('.product-detail .installation-status').textContent`),'Locked - Not installed');
      assert.equal(await execute(`document.querySelectorAll('.product-detail [data-state-preview]').length`),16);
      assert.equal(await execute(`document.querySelectorAll('.product-detail [data-state-preview] img').length`),0);
      await click('.product-detail [data-action="buy"]');
      await until(()=>execute(`document.querySelector('.purchase-notice')?.open===true`));
      await click('.purchase-notice button');
    }
    assert.deepEqual(flow.getProducts(),products); assert.equal(requests,0); assert.equal(windows,0);
    const after=JSON.parse(settings);after.activeCharacterId='aiko';assert.deepEqual(flow.getSnapshot().settings,after);
    await click('[data-product="aiko"] .card-open');
    await until(()=>execute(`document.querySelector('.product-detail [aria-busy]').getAttribute('aria-busy')==='false' && document.querySelectorAll('.product-detail [data-state-preview] img').length===16`));
    await execute(`document.querySelector('.product-detail').scrollTop=0;document.querySelector('main').scrollTop=0`);
    const layouts=[];
    for(const [width,height] of [[1280,800],[1440,900],[1920,1080]]) {
      main.setContentSize(width,height);await delay(120);
      const layout=await execute(`(()=>{const p=document.querySelector('.product-detail'),g=document.querySelector('.state-thumbnails'),search=document.querySelector('input[type="search"]');const r=p.getBoundingClientRect();return {overflow:p.scrollWidth>p.clientWidth||document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth,detailFits:r.bottom<=innerHeight,previewScrollable:g.scrollHeight>=g.clientHeight,searchVisible:search.getBoundingClientRect().right<=innerWidth};})()`);
      assert.equal(layout.overflow,false);assert.equal(layout.detailFits,true);assert.equal(layout.searchVisible,true);layouts.push({width,height,...layout});
      await writeFile(`dist/validation/store-${width}.png`,(await main.webContents.capturePage()).toPNG());
    }
    await writeFile('dist/validation/store-result.json',JSON.stringify({passed:true,offline:true,networkRequests:requests,checkoutWindows:windows,states:CURSOR_STATES,allPremiumButtonsTested:true,layouts},null,2));
    console.info('[store-check] PASS: filters/search, original 16 Aiko previews, activation, all mock Buy buttons, no HTTP requests/windows, and responsive detail');
  } finally { session.webRequest.onBeforeRequest(null);main.webContents.removeListener('did-create-window',popup); }
}
