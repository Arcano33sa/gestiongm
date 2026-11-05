'use strict';
// NODE_PATH=/path/to/node_modules CHROME_PATH=/path/to/chrome node tests/pwa-update.smoke.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
let release=1,failAssets=false;
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,pathname==='/'?'index.html':pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,bytes)=>{
  if(error){res.writeHead(404).end();return;}
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');
  if(pathname==='/style.css'&&failAssets){res.writeHead(503).end('Simulated download failure');return;}
  let content=bytes;
  if(pathname==='/sw.js')content=bytes.toString().replace(/sglsn-shell-v9-\d+/g,'sglsn-shell-test-'+release);
  if(pathname==='/config.js')content=bytes.toString().replace(/APP_VERSION='[^']+'/,"APP_VERSION='test-"+release+"'");
  if(pathname==='/'||pathname==='/index.html')content=bytes.toString().replace(/Versión [\d.]+/,'Versión test-'+release);
  setTimeout(()=>res.end(content),release>1&&pathname==='/style.css'?1200:0);
 });
});
async function poll(page,fn){
 for(let i=0;i<200;i++){
  try{if(await page.evaluate(fn))return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Timed out waiting for PWA state');
}
const snapshot=page=>page.evaluate(async()=>{
 const data=await cfgSnapshot();
 data.metadatos=data.metadatos.filter(x=>!['cfg-last-search','cfg-last-update'].includes(x.id));
 for(const rows of Object.values(data))rows.sort((a,b)=>a.id.localeCompare(b.id));
 return data;
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const context=await browser.newContext({timezoneId:'America/Managua'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  await page.goto('http://127.0.0.1:'+server.address().port+'/#configuracion');
  await page.waitForSelector('#cfgCheck');
  await poll(page,async()=>!!navigator.serviceWorker.controller&&!!(await navigator.serviceWorker.getRegistration('./'))?.active);
  await page.evaluate(async()=>{
   await pSave({id:'pwa-pending',descripcion:'Conservar durante actualización',fechaRegistro:'2026-11-04',prioridad:'Media',estado:'Pendiente',avance:35,apoyo:[],archivado:false});
   await gWrite({id:'pwa-gestion',pendienteId:'pwa-pending',fecha:'2026-11-04',detalle:'Gestión conservada'});
   await gSync('pwa-pending');
   await rWrite({id:'pwa-reminder',texto:'Recordatorio conservado',prioridad:'Alta',resuelto:false,when:''});
   await cfgSet(P_INACTIVITY_KEY,21);
  });
  const before=await snapshot(page);
  release=2;
  await page.locator('#cfgCheck').click();
  await page.waitForFunction(()=>document.getElementById('cfgPwaStatus').textContent==='Descargando actualización…');
  assert(await page.locator('#cfgCheck').isDisabled());
  assert(await page.locator('#cfgApply').isHidden());
  await poll(page,async()=>!!(await navigator.serviceWorker.getRegistration('./'))?.waiting);
  await page.waitForFunction(()=>!document.getElementById('cfgApply').hidden&&!document.getElementById('cfgApply').disabled);
  assert((await page.locator('#cfgPwaStatus').innerText()).includes('lista para aplicar'));
  // Cancelar conserva la versión y permite volver a aplicar.
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#cfgApply').click();
  assert.equal(await page.evaluate(()=>APP_VERSION),'test-1');
  assert(!(await page.locator('#cfgApply').isDisabled()));
  await page.evaluate(()=>{stagedImport={};});await page.locator('#cfgApply').click();
  assert((await page.locator('#cfgPwaStatus').innerText()).includes('termina la importación'));
  await page.evaluate(()=>{stagedImport=null;});
  page.once('dialog',dialog=>dialog.accept());await page.locator('#cfgApply').click();
  await poll(page,()=>typeof APP_VERSION!=='undefined'&&APP_VERSION==='test-2'&&!!document.getElementById('cfgCheck'));
  await page.waitForFunction(()=>{const el=document.getElementById('cfgUpdateDate');return el&&el.textContent!=='—'&&el.textContent!=='Sin registro';});
  assert.deepEqual(await snapshot(page),before);
  assert((await page.locator('footer').innerText()).includes('test-2'));
  assert.deepEqual(await page.evaluate(()=>caches.keys()),['sglsn-shell-test-2']);
  console.log('PASS: descarga, botón disponible sin segunda búsqueda, cancelación, importación pendiente y actualización con datos intactos');
  await page.locator('#cfgCheck').click();
  await page.waitForFunction(()=>document.getElementById('cfgPwaStatus').textContent.includes('No hay actualizaciones nuevas'));
  // La app debe recargar y guardar sin red después de actualizar.
  await context.setOffline(true);await page.reload();await page.waitForSelector('#cfgCheck');
  await page.locator('#cfgCheck').click();await page.waitForFunction(()=>document.getElementById('cfgPwaStatus').textContent.includes('Necesitas conexión'));
  assert(!(await page.locator('#cfgCheck').isDisabled()));
  assert.deepEqual(await snapshot(page),before);
  await page.locator('[data-page=pendientes]').click();await page.locator('#pAdd').click();
  await page.locator('[name=descripcion]').fill('Creado sin conexión');await page.locator('#pForm [type=submit]').click();
  await page.locator('#pDialog').waitFor({state:'hidden'});await page.reload();
  await page.waitForFunction(()=>document.querySelector('.pending-table')?.textContent.includes('Creado sin conexión'));
  console.log('PASS: sin novedades, búsqueda sin red, recarga y guardado offline');
  await context.setOffline(false);await page.locator('[data-page=configuracion]').click();await page.waitForSelector('#cfgCheck');
  // Un recurso que no descarga debe permitir reintentar.
  failAssets=true;release=3;await page.locator('#cfgCheck').click();
  await page.waitForFunction(()=>document.getElementById('cfgPwaStatus').textContent.includes('No se pudo'));
  await page.waitForFunction(()=>!document.getElementById('cfgCheck').disabled);
  assert.equal(await page.evaluate(()=>APP_VERSION),'test-2');
  assert(await page.locator('#cfgApply').isHidden());
  failAssets=false;release=4;await page.locator('#cfgCheck').click();
  await poll(page,async()=>!!(await navigator.serviceWorker.getRegistration('./'))?.waiting);
  await page.waitForFunction(()=>!document.getElementById('cfgApply').hidden&&!document.getElementById('cfgApply').disabled);
  const preserved=await snapshot(page);
  await page.evaluate(()=>Object.defineProperty(navigator.serviceWorker,'controller',{configurable:true,get:()=>null}));
  page.once('dialog',dialog=>dialog.accept());await page.locator('#cfgApply').click();
  await poll(page,()=>typeof APP_VERSION!=='undefined'&&APP_VERSION==='test-4'&&!!document.getElementById('cfgCheck'));
  assert.deepEqual(await snapshot(page),preserved);assert.deepEqual(errors,[]);
  console.log('PASS: error de descarga, reintento y aplicación sin controlador; datos conservados');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exit(1);});
