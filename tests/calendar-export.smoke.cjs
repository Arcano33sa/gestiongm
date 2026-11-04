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
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'gestiongm-calendar-'));
  const context=await browser.newContext({acceptDownloads:true,timezoneId:'America/Managua'});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/#pendientes`);
  await page.waitForFunction(()=>document.getElementById('pAdd'));
  await page.evaluate(async()=>{
   await new Promise((resolve,reject)=>{const tx=db.transaction('catalogos','readwrite');tx.objectStore('catalogos').put({id:'calendar-person',tipo:'responsables',nombre:'María Pérez',activo:false});tx.oncomplete=resolve;tx.onerror=reject;});
   for(const [i,prioridad] of ['Crítica','Alta','Media','Baja'].entries())await pSave({id:'calendar-'+i,fechaRegistro:'2026-11-04',fechaLimite:i===0?'2028-02-29':i===1?'2026-12-31':'2026-11-04',descripcion:'Revisar actas 📅\nAcuerdos, anexos; ruta \\ '+ 'á'.repeat(200),responsable:i===3?'':'calendar-person',prioridad,estado:'Pendiente',avance:0,archivado:false});
   await pSave({id:'calendar-no-date',descripcion:'Sin fecha',prioridad:'Media',estado:'Pendiente',avance:0});await renderPending();
  });
  const before=await page.evaluate(()=>pAll());
  for(let i=0;i<4;i++){
   const event=page.waitForEvent('download');await page.locator(`[data-pcalendar="calendar-${i}"]`).click();
   const download=await event;const target=path.join(out,download.suggestedFilename());await download.saveAs(target);
   const raw=fs.readFileSync(target,'utf8'),content=raw.replace(/\r\n /g,'');
   assert.equal(await download.failure(),null);assert.ok(content.includes('BEGIN:VEVENT\r\n'));assert.ok(content.includes('SUMMARY:Revisar actas 📅'));
   assert.ok(content.includes('Responsable: '+(i===3?'Sin asignar':'María Pérez')));
   assert.ok(content.includes('COLOR:'+['purple','red','yellow','green'][i]));
   for(const line of raw.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
   if(i===0)assert.ok(content.includes('DTEND;VALUE=DATE:20280301'));
   if(i===1)assert.ok(content.includes('DTEND;VALUE=DATE:20270101'));
  }
  const dialogEvent=page.waitForEvent('dialog');const click=page.locator('[data-pcalendar="calendar-no-date"]').click();
  const dialog=await dialogEvent;assert.match(dialog.message(),/Fecha Límite válida/);await dialog.accept();await click;
  assert.deepEqual(await page.evaluate(()=>pAll()),before);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await context.setOffline(true);await page.reload();await page.locator('[data-pcalendar="calendar-0"]').waitFor();
  const offlineDownload=page.waitForEvent('download');await page.locator('[data-pcalendar="calendar-0"]').click();assert.equal(await (await offlineDownload).failure(),null);
  assert.deepEqual(await page.evaluate(()=>pAll()),before);assert.deepEqual(errors,[]);
  console.log('PASS: botón, 4 prioridades, responsable inactivo/sin asignar, fechas, UTF-8, descarga, aviso sin fecha, persistencia y exportación offline.');
  console.log('ICS_DIR='+out);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
