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
  await page.clock.install({time:new Date('2026-11-04T18:00:00Z')});
  await page.goto(`http://127.0.0.1:${server.address().port}/#pendientes`);
  await page.waitForFunction(()=>document.getElementById('pAdd'));


  const JSZip=require('jszip');
  await page.evaluate(async()=>{
   await new Promise((resolve,reject)=>{const tx=db.transaction('catalogos','readwrite');for(const [id,nombre] of [['person-a','María Pérez'],['person-b','Juan López']])tx.objectStore('catalogos').put({id,nombre,tipo:'responsables',activo:true});tx.oncomplete=resolve;tx.onerror=reject;});
   const base={fechaRegistro:'2026-01-01',prioridad:'Media',categoria:'',descripcion:'Asunto histórico',responsable:'person-a',apoyo:'',fechaLimite:'2026-12-31',estado:'Pendiente',avance:0,ultimaGestion:'',observaciones:'',archivado:false};
   // Simulates a record saved before history existed.
   await new Promise((resolve,reject)=>{const tx=db.transaction('pendientes','readwrite');tx.objectStore('pendientes').put({...base,id:'legacy'});tx.oncomplete=resolve;tx.onerror=reject;});
   await pSave({...base,id:'other',descripcion:'Otro asunto'});await renderPending();
  });
  await page.locator('[data-pedit="legacy"]').click();
  await page.locator('[name=responsable]').selectOption('person-b');
  await page.locator('[name=prioridad]').selectOption('Alta');
  await page.locator('[name=estado]').selectOption('En proceso');
  await page.locator('[name=fechaRegistro]').fill('2026-01-02');
  await page.locator('[name=fechaLimite]').fill('2027-01-15');
  await page.locator('[name=proximaAccion]').fill('=Consultar <acta> con María');
  await page.locator('[name=fechaSeguimiento]').fill('2026-11-11');
  await page.locator('#pForm [type=submit]').click();await page.locator('#pDialog').waitFor({state:'hidden'});
  const saved=await page.evaluate(async()=>(await pAll()).find(p=>p.id==='legacy'));
  assert.equal(saved.historialCambios.length,7);
  assert.equal(saved.historialCambios.find(h=>h.campo==='responsable').anteriorTexto,'María Pérez');
  assert.equal(saved.historialCambios.find(h=>h.campo==='responsable').nuevoTexto,'Juan López');
  assert.equal(saved.historialCambios.find(h=>h.campo==='estado').anterior,'Pendiente');
  await page.locator('[data-pedit="legacy"]').click();await page.locator('#pForm [type=submit]').click();await page.locator('#pDialog').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(async()=>(await pAll()).find(p=>p.id==='legacy').historialCambios.length),7);
  // Catalog renaming must not rewrite the name captured by history.
  await page.evaluate(async()=>{
   await new Promise((resolve,reject)=>{const tx=db.transaction('catalogos','readwrite');tx.objectStore('catalogos').put({id:'person-a',nombre:'Nombre cambiado',tipo:'responsables',activo:true});tx.oncomplete=resolve;tx.onerror=reject;});
   // Overlapping saves append to the current history, not the stale caller copy.
   const item=(await pAll()).find(p=>p.id==='legacy');
   await Promise.all([pSave({...item,prioridad:'Crítica'}),pSave({...item,prioridad:'Baja'})]);
   await gSync('legacy');await renderPending();
  });
  const latest=await page.evaluate(async()=>(await pAll()).find(p=>p.id==='legacy'));
  assert.equal(latest.historialCambios.length,9);
  assert.equal(latest.historialCambios[8].anterior,'Crítica');assert.equal(latest.historialCambios[8].nuevo,'Baja');
  // Failure while creating the audit entry must roll back the whole save.
  assert.equal(await page.evaluate(async()=>{
   const item=(await pAll()).find(p=>p.id==='legacy'),original=pHistoryChanges;pHistoryChanges=()=>{throw Error('Fallo simulado');};
   try{await pSave({...item,prioridad:'Media'});return false;}catch{return true;}finally{pHistoryChanges=original;}
  }),true);
  assert.deepEqual(await page.evaluate(async()=>(await pAll()).find(p=>p.id==='legacy')),latest);
  await page.reload();await page.locator('[data-pview="legacy"]').click();
  assert.equal(await page.locator('#pHistory .gestion-entry').count(),9);
  assert.ok((await page.locator('#pHistory').innerText()).includes('María Pérez'));
  assert.ok((await page.locator('#pHistory').innerText()).includes('=Consultar <acta> con María'));
  await page.locator('#pHistory').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'history-desktop.png')});
  await page.locator('#pCancel').click();
  // Validate JSON, reject malformed history, support legacy schema and merge without duplicates.
  const backupEvent=page.waitForEvent('download');await page.locator('.nav[data-page=configuracion]').click();await page.locator('#cfgExport').click();
  const backup=await backupEvent;const backupPath=path.join(out,'history.json');await backup.saveAs(backupPath);
  const payload=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(payload.esquema,5);
  const checks=await page.evaluate(payload=>{
   const old=structuredClone(payload);old.esquema=2;for(const p of old.datos.pendientes)delete p.historialCambios;
   const older=structuredClone(old);older.esquema=1;delete older.datos.recordatorios;delete older.conteos.recordatorios;
   const current=cfgValidate(payload),legacy=cfgValidate(old);cfgValidate(older);
   const merged=cfgMerge(current,legacy,'fusionar'),twice=cfgMerge(merged,current,'fusionar');cfgValidateMerged(twice);
   const count=twice.pendientes.find(p=>p.id==='legacy').historialCambios.length;
   const reject=modify=>{const copy=structuredClone(payload);modify(copy.datos.pendientes.find(p=>p.id==='legacy').historialCambios);try{cfgValidate(copy);return false;}catch{return true;}};
   const invalid=[reject(h=>h.push(h[0])),reject(h=>h[0].campo='__proto__'),reject(h=>h[0].fecha='2026-02-30T12:00:00.000Z'),reject(h=>h[0].anterior={}),reject(h=>h[0].nuevo='x'.repeat(2001))];
   const conflict=structuredClone(current);conflict.pendientes.find(p=>p.id==='legacy').historialCambios[0].anteriorTexto='Conflicto';let conflictRejected=false;try{cfgMerge(current,conflict,'fusionar');}catch{conflictRejected=true;}
   return {count,invalid,conflictRejected};
  },payload);
  assert.deepEqual(checks,{count:9,invalid:[true,true,true,true,true],conflictRejected:true});
  // Replace from a real downloaded backup restores the exact history.
  await page.evaluate(async()=>{const item=(await pAll()).find(p=>p.id==='legacy');await pSave({...item,estado:'En espera'});});
  await page.locator('#cfgFile').setInputFiles(backupPath);await page.locator('#cfgMode').selectOption('reemplazar');
  page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?'REEMPLAZAR':undefined));
  await page.locator('#cfgCommit').click();await page.waitForFunction(()=>document.getElementById('cfgStatus').textContent.includes('Importación completada'));
  assert.deepEqual(await page.evaluate(async()=>(await pAll()).find(p=>p.id==='legacy').historialCambios),latest.historialCambios);
  // Scope of the history worksheet follows the exported pending IDs, including zero results.
  await page.locator('.nav[data-page=excel]').click();
  const exportExcel=async(name)=>{
   const event=page.waitForEvent('download');await page.locator('#excelDownload').click();const file=await event;
   const target=path.join(out,name);await file.saveAs(target);const zip=await JSZip.loadAsync(fs.readFileSync(target));
   const files={};for(const name of ['xl/workbook.xml','xl/_rels/workbook.xml.rels','[Content_Types].xml','xl/styles.xml','xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml'])files[name]=await zip.file(name).async('string');
   const valid=await page.evaluate(files=>Object.values(files).every(xml=>!new DOMParser().parseFromString(xml,'application/xml').querySelector('parsererror')),files);assert.ok(valid);
   return files;
  };
  const all=await exportExcel('all.xlsx');
  assert.ok(all['xl/workbook.xml'].includes('name="Historial de cambios"'));
  assert.ok(all['xl/_rels/workbook.xml.rels'].includes('Target="worksheets/sheet3.xml"'));
  assert.ok(all['[Content_Types].xml'].includes('/xl/worksheets/sheet3.xml'));
  assert.ok(all['xl/worksheets/sheet2.xml'].includes('ID Pendiente'));
  const history=all['xl/worksheets/sheet3.xml'];
  assert.equal((history.match(/<row /g)||[]).length,10);
  assert.ok(history.includes('María Pérez'));assert.ok(history.includes('&apos;=Consultar &lt;acta&gt; con María'));
  assert.match(history,/<c r="D2" s="5"><v>\d+(?:\.\d+)?<\/v><\/c>/);
  assert.ok(history.includes('<autoFilter ref="A1:G10"/>'));
  await page.evaluate(()=>{pFilters.q='Otro asunto';});await page.locator('[value=filtered]').check();
  const filtered=await exportExcel('filtered.xlsx');assert.equal((filtered['xl/worksheets/sheet3.xml'].match(/<row /g)||[]).length,1);
  assert.ok(!filtered['xl/worksheets/sheet2.xml'].includes('Asunto histórico'));
  await page.evaluate(()=>{pFilters.q='sin coincidencias';});const empty=await exportExcel('empty.xlsx');
  assert.equal((empty['xl/worksheets/sheet2.xml'].match(/<row /g)||[]).length,1);assert.equal((empty['xl/worksheets/sheet3.xml'].match(/<row /g)||[]).length,1);
  await page.locator('.nav[data-page=pendientes]').click();await page.evaluate(async()=>{pFilters.q='';await renderPending();});
  await page.setViewportSize({width:390,height:844});await page.locator('[data-pview="legacy"]').click();await page.locator('#pHistory').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'history-mobile.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: cambios reales/sin cambios, nombres históricos, concurrencia, rollback, consulta, persistencia, JSON esquemas 1/2/3, restauración, fusión sin duplicados/conflictos y XLSX total/filtrado/vacío.');
  console.log('OUTPUT_DIR='+out);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
