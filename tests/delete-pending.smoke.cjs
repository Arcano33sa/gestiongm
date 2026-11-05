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
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'gestiongm-archive-'));
  const context=await browser.newContext({acceptDownloads:true,timezoneId:'America/Managua'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-04T18:00:00Z'));
  await page.goto(`http://127.0.0.1:${server.address().port}/#pendientes`);
  await page.waitForFunction(()=>document.getElementById('pAdd'));





  await page.evaluate(async()=>{
   const base={fechaRegistro:'2026-10-01',prioridad:'Alta',categoria:'',descripcion:'Borrado de prueba',responsable:'',apoyo:[],fechaLimite:'',estado:'Pendiente',avance:0,ultimaGestion:'',observaciones:'',archivado:false};
   await pSave({...base,id:'delete'});await pSave({...base,id:'keep'});
   await gWrite({id:'g-delete',pendienteId:'delete',fecha:'2026-10-10',detalle:'Eliminar'});
   await gWrite({id:'g-keep',pendienteId:'keep',fecha:'2026-10-10',detalle:'Conservar'});
   await rWrite({id:'source',texto:'Origen',resuelto:true,pendienteId:'delete',creado:new Date().toISOString()});
   await renderPending();
  });
  const before=await page.evaluate(()=>cfgSnapshot());
  page.once('dialog',d=>d.dismiss());await page.locator('[data-premove="delete"]').click();
  assert.deepEqual(await page.evaluate(()=>cfgSnapshot()),before);
  page.once('dialog',d=>{assert.match(d.message(),/no se puede deshacer/);return d.accept();});
  await page.locator('[data-premove="delete"]').click();await page.locator('[data-premove="delete"]').waitFor({state:'hidden'});
  const after=await page.evaluate(()=>cfgSnapshot());
  assert.equal(after.pendientes.length,1);assert.equal(after.pendientes[0].id,'keep');
  assert.deepEqual(after.gestiones,before.gestiones.filter(g=>g.pendienteId==='keep'));
  assert.equal(after.recordatorios.length,1);assert.equal(after.recordatorios[0].pendienteId,undefined);assert.equal(after.recordatorios[0].resuelto,true);
  await page.evaluate(()=>pSetArchived('keep',true));await page.selectOption('#pArchiveScope','archivados');
  await page.locator('[data-premove="keep"]').waitFor();
  page.once('dialog',d=>d.accept());await page.locator('[data-premove="keep"]').click();
  await page.locator('[data-premove="keep"]').waitFor({state:'hidden'});
  assert.equal((await page.evaluate(()=>gAll())).length,0);
  assert.deepEqual(errors,[]);console.log('PASS: cancelar, borrar activo y archivado, gestiones asociadas y recordatorio sin enlace roto.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
