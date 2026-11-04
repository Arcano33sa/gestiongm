'use strict';
// Run with NODE_PATH pointing to a Playwright installation, using an isolated browser profile.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.join(root,pathname==='/'?'index.html':pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'gestiongm-history-'));
  const context=await browser.newContext({acceptDownloads:true,timezoneId:'America/Managua'});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(`http://127.0.0.1:${server.address().port}/#pendientes`);
  await page.waitForFunction(()=>document.getElementById('pAdd'));


  const JSZip=require('jszip');
  await page.evaluate(async()=>{
   await new Promise((resolve,reject)=>{const tx=db.transaction('catalogos','readwrite');for(const [id,nombre,activo] of [['a','Ana',false],['b','Beatriz',true],['c','Carlos',true]])tx.objectStore('catalogos').put({id,nombre,activo,tipo:'apoyos'});tx.oncomplete=resolve;tx.onerror=reject;});
   await pSave({id:'legacy',descripcion:'Apoyos múltiples',fechaRegistro:'2026-11-01',fechaLimite:'',ultimaGestion:'',prioridad:'Media',estado:'Pendiente',avance:0,apoyo:'a',categoria:'',responsable:'',observaciones:''});await renderPending();
  });
  await page.locator('[data-pedit="legacy"]').click();
  assert.equal(await page.locator('[name=apoyo]:checked').inputValue(),'a');
  await page.locator('[name=apoyo][value=b]').check();
  await page.locator('[name=apoyo][value=c]').check();
  await page.locator('#pSupportNew').click();
  await page.locator('.catalog-dialog [name=nombre]').fill('Diana');
  await page.locator('.catalog-dialog [type=submit]').click();
  await page.locator('.catalog-dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('[name=apoyo]:checked').count(),4);
  await page.locator('#pForm [type=submit]').click();await page.locator('#pDialog').waitFor({state:'hidden'});
  console.log('Saved multiple supports');await page.reload();await page.locator('[data-pview="legacy"]').click();
  assert.equal(await page.locator('[name=apoyo]:checked').count(),4);
  assert.equal(await page.locator('[name=apoyo]:enabled').count(),0);
  await page.setViewportSize({width:390,height:844});
  await page.locator('.support-picker').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'supports-mobile.png')});
  await page.locator('#pCancel').click();
  const checks=await page.evaluate(async()=>{
   const datos=await cfgSnapshot();const payload={formato:'SGLSN-RESPALDO',esquema:BACKUP_SCHEMA,creado:new Date().toISOString(),datos,conteos:Object.fromEntries(BACKUP_STORES.map(s=>[s,datos[s].length]))};
   cfgValidate(JSON.parse(JSON.stringify(payload)));
   const legacy=structuredClone(payload);legacy.esquema=5;legacy.datos.pendientes[0].apoyo='a';cfgValidate(legacy);
   const invalid=[['a','a'],['missing'],[4],{},['']].map(value=>{const copy=structuredClone(payload);copy.datos.pendientes[0].apoyo=value;try{cfgValidate(copy);return false;}catch{return true;}});
   const labels=new Map(datos.catalogos.map(x=>[x.id,x.nombre]));
   return {invalid,search:pSearchText(datos.pendientes[0],labels,14),ids:datos.pendientes[0].apoyo};
  });
  assert.deepEqual(checks.invalid,[true,true,true,true,true]);assert.ok(checks.search.includes('beatriz'));assert.equal(checks.ids.length,4);
  await page.locator('.nav[data-page=excel]').click();
  const downloadEvent=page.waitForEvent('download');await page.locator('#excelDownload').click();const download=await downloadEvent;
  const target=path.join(out,'supports.xlsx');await download.saveAs(target);
  const zip=await JSZip.loadAsync(fs.readFileSync(target));const xml=await zip.file('xl/worksheets/sheet2.xml').async('string');
  assert.ok(xml.includes('Ana, Beatriz, Carlos, Diana'));
  await page.locator('.nav[data-page=pendientes]').click();await page.locator('[data-pedit="legacy"]').click();
  while(await page.locator('[name=apoyo]:checked').count())await page.locator('[name=apoyo]:checked').first().uncheck();
  await page.locator('#pForm [type=submit]').click();await page.locator('#pDialog').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(async()=>(await pAll())[0].apoyo),[]);
  await page.locator('[data-pedit="legacy"]').click();assert.equal(await page.locator('[name=apoyo][value=a]').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: legacy, multiple supports, inline creation, persistence, readonly, mobile, backup validation, search, XLSX, clearing and inactive supports.');console.log('OUTPUT_DIR='+out);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
