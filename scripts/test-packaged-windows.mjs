import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
const temporary = await mkdtemp(join(tmpdir(), 'anime-cursor-packaged-qa-'));
const development=process.argv.includes('--development');
const executableArgument = process.argv.find(argument => argument.startsWith('--executable='))?.slice('--executable='.length);
const executable = resolve(executableArgument ?? (development?'node_modules/electron/dist/electron.exe':'release/AnimeCursor-win32-x64/AnimeCursor.exe'));
const profile = join(temporary, 'profile'); await mkdir(profile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async check => { const end=Date.now()+20000; while(!await check()){if(Date.now()>end)throw new Error('Packaged QA timed out');await delay(80);} };
async function launch() {
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(executable,[...(development?['.','--development']:[]),`--inspect-brk=127.0.0.1:${port}`],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
  const exited=new Promise(resolve=>child.on('exit',code=>resolve(code)));
  let socket;
  try {
    await until(async()=>/ws:\/\/127\.0\.0\.1:[^\s]+/.test(output));
    socket=new WebSocket(output.match(/ws:\/\/127\.0\.0\.1:[^\s]+/)[0]);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    let id=0;let paused=null;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Debugger.paused')paused=message.params;const callback=pending.get(message.id);if(callback){pending.delete(message.id);message.error?callback.reject(new Error(JSON.stringify(message.error))):callback.resolve(message.result);}});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(new Error('Inspector command timed out: '+method)),15000);pending.set(key,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id:key,method,params}));});
    const evaluate=async (expression,awaitPromise=true)=>{const result=await send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
    console.info('[packaged-qa] inspector connected');await send('Runtime.enable'); await send('Debugger.enable');
    const breakpoint=await send('Debugger.setBreakpointByUrl',{lineNumber:0,urlRegex:'main\\.cjs$'});
    await send('Runtime.runIfWaitingForDebugger');
    await until(async()=>paused!==null);
    while(!paused.hitBreakpoints.includes(breakpoint.breakpointId)){paused=null;await send('Debugger.resume');await until(async()=>paused!==null);}

    console.info('[packaged-qa] paused at application entry');
    // External Node inspector pauses the unchanged packaged app before startup. This
    // supplies an isolated profile and offline sessions; no production QA backdoor.
    await evaluate(`globalThis.qaElectron=process.getBuiltinModule('module').createRequire(${JSON.stringify(executable)})('electron');qaElectron.app.setPath('userData',${JSON.stringify(profile)});qaElectron.app.whenReady().then(()=>{if(${JSON.stringify(development)})return;qaElectron.session.defaultSession.enableNetworkEmulation({offline:true});qaElectron.session.fromPartition('anime-cursor-overlay').enableNetworkEmulation({offline:true});});globalThis.qaMain=()=>qaElectron.BrowserWindow.getAllWindows().find(w=>w.getTitle()!=='Anime Cursor Companion');true`,false);
    console.info('[packaged-qa] profile configured');await send('Debugger.resume');
    await until(async()=>await evaluate(`!!qaMain()&&!qaMain().webContents.isLoading()`));
    const render=code=>evaluate(`qaMain().webContents.executeJavaScript(${JSON.stringify(code)})`);
    await until(async()=>await render(`!!document.querySelector('[data-app-ready]')`));
    assert.equal(await evaluate('qaElectron.app.isPackaged'),!development);
    assert.equal(await evaluate('qaElectron.app.getPath("userData")'),profile);
    assert.match(await evaluate('qaMain().webContents.getURL()'),development?/^http:\/\/127\.0\.0\.1:5173/:/^file:/);
    const quit=async()=>{await evaluate(`void qaMain().webContents.executeJavaScript('window.animeCursor.companion.quit()').catch(()=>{});true`);socket.close();const code=await Promise.race([exited,delay(10000).then(()=>{throw new Error('Packaged Quit timed out');})]);assert.equal(code,0);};
    return {child,socket,evaluate,render,quit,output:()=>output};
  }catch(error){socket?.close();child.kill();throw error;}
}
let running;
try {
  const results=[];
  for(const phase of ['fresh','restart']) {
    console.info('[packaged-qa] launching '+phase);running=await launch();console.info('[packaged-qa] isolated packaged window ready');const {render,evaluate}=running;
    const click=async text=>{await until(async()=>await render(`Array.from(document.querySelectorAll('button')).some(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute("aria-label")===${JSON.stringify(text)})&&!b.disabled)`));await render(`Array.from(document.querySelectorAll('button')).find(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute("aria-label")===${JSON.stringify(text)})&&!b.disabled).click()`);await delay(100);};
    if(phase==='fresh') {
      assert.equal(await render(`document.querySelector('[data-onboarding-step]').dataset.onboardingStep`),'1');
      await click('Get Started');assert.equal(await render(`document.querySelector('[data-onboarding-step]').dataset.onboardingStep`),'2');
      await click('Continue');assert.equal(await render(`document.querySelector('[data-onboarding-step]').dataset.onboardingStep`),'3');
      await click('Start Companion');
      await until(async()=>await render(`!!document.querySelector('main[data-current-page="home"]')`));
      await render(`window.animeCursor.flow.preferences({characterSize:120,cursorOffset:{x:32,y:18},opacity:.8,smoothing:.3})`);
    } else {
      assert.equal(await render(`!!document.querySelector('[data-onboarding-step]')`),false);
      assert.equal(await render(`document.querySelector('main').dataset.currentPage`),'home');
    }
    const snapshot=await render(`window.animeCursor.flow.getSnapshot()`);
    assert.equal(snapshot.settings.activeCharacterId,'aiko');assert.equal(snapshot.settings.characterSize,120);assert.equal(snapshot.settings.opacity,.8);assert.deepEqual(snapshot.settings.cursorOffset,{x:32,y:18});assert.equal(snapshot.settings.smoothing,.3);assert.equal(snapshot.companion.status,'running');
    assert.equal(snapshot.debugEnabled,development);
    const overlay=await evaluate(`(()=>{const w=qaElectron.BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Anime Cursor Companion');return {count:qaElectron.BrowserWindow.getAllWindows().length,visible:w.isVisible(),focusable:w.isFocusable(),onTop:w.isAlwaysOnTop(),url:w.webContents.getURL(),bounds:w.getBounds()};})()`);
    assert.equal(overlay.count,2);assert.equal(overlay.visible,true);assert.equal(overlay.focusable,false);assert.equal(overlay.onTop,true);assert.match(overlay.url,development?/^http:\/\/127\.0\.0\.1:5173/:/^file:/);
    const pack=JSON.parse(await readFile('src/assets/characters/aiko/manifest.json','utf8'));
    for(const state of Object.keys(pack.states)) {
      const asset=await render(`window.animeCursor.characters.getStateAsset('aiko',${JSON.stringify(state)})`);
      assert.equal(asset.resolvedState,state);assert.equal(asset.fallback,false);
      assert.equal(asset.dataUrl,'data:image/png;base64,'+(await readFile(join('src/assets/characters/aiko',pack.states[state]))).toString('base64'));
    }
    await render(`window.animeCursor.flow.navigate('store')`);await until(async()=>await render(`!!document.querySelector('.store-page')`));
    await until(async()=>await render(`document.querySelectorAll('[data-state-preview] img').length===16`));
    await click('Buy');await until(async()=>await render(`document.querySelector('.purchase-notice')?.open===true`));await click('Got it');
    const native=[];
    await evaluate(`qaMain().show();qaMain().focus()`);
    for(const [css,state] of [['default','normal'],['text','text'],['pointer','link'],['ew-resize','horizontal'],['ns-resize','vertical']]) {
      await render(`(()=>{let f=document.querySelector('#pack-cursor-fixture');if(!f){f=document.createElement('div');f.id='pack-cursor-fixture';Object.assign(f.style,{position:'fixed',inset:'60px 20px 20px',zIndex:999999,background:'#1a2033'});document.body.append(f);}f.style.cursor=${JSON.stringify(css)};})()`);
      const point=await evaluate(`(()=>{const b=qaMain().getContentBounds();return qaElectron.screen.dipToScreenPoint({x:b.x+100,y:b.y+100});})()`);
      const {execFile}=await import('node:child_process');
      await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class PackPointer{[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);}';[PackPointer]::SetCursorPos(${Math.round(point.x)},${Math.round(point.y)})`],{windowsHide:true},error=>error?reject(error):resolve()));
      await until(async()=> (await render('window.animeCursor.flow.getSnapshot()')).companion.state===state);
      native.push({css,state});
    }
    await render(`document.querySelector('#pack-cursor-fixture').remove()`);
    await render(`window.animeCursor.close()`);await until(async()=>await evaluate('!qaMain().isVisible()'));
    await evaluate('qaMain().show()');
    let performance=null;
    if(phase==='fresh'&&!development) {
      console.info('[packaged-qa] recording 60-second performance observation');
      await evaluate('qaMain().hide()');
      await evaluate(`globalThis.qaReloads=0;qaElectron.BrowserWindow.getAllWindows().forEach(w=>w.webContents.on('did-finish-load',()=>qaReloads++));true`);
      const before=await readFile(join(profile,'settings/settings.json'),'utf8');
      const samples=[];
      for(let sample=0;sample<4;sample++) {
        if(sample)await delay(20000);
        samples.push(await evaluate(`({time:Date.now(),windows:qaElectron.BrowserWindow.getAllWindows().map(w=>w.id),reloads:qaReloads,metrics:qaElectron.app.getAppMetrics().map(m=>({type:m.type,cpu:m.cpu.percentCPUUsage,memory:m.memory.workingSetSize}))})`));
        console.info('[packaged-qa] performance sample '+sample);
      }
      assert.equal(await readFile(join(profile,'settings/settings.json'),'utf8'),before,'No cursor/runtime settings writes');
      for(const sample of samples){assert.deepEqual(sample.windows,samples[0].windows);assert.equal(sample.reloads,0);}
      performance={durationSeconds:60,samples,settingsUnchanged:true};
    }
    results.push({phase,packaged:!development,offline:!development,settings:snapshot.settings,overlay,native,assets:16,store:true,closeToTray:true,performance});
    console.info('[packaged-qa] checks finished '+phase);await running.quit();running=null;
  }
  await writeFile(development?'dist/validation/development-windows-result.json':'dist/validation/packaged-windows-result.json',JSON.stringify({passed:true,results},null,2));
  console.info(`PASS: ${development?'development Windows build':'actual packaged Windows executable'}, clean onboarding, persisted relaunch, 16 original assets, ${development?'local':'offline'} Store, real native state transitions, overlay and explicit Quit`);
} finally {
  if(running){running.socket.close();running.child.kill();}
  if(!resolve(temporary).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe QA cleanup');
  await rm(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
