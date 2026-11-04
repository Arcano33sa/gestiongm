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





  const JSZip=require('jszip');
  await page.evaluate(async()=>{
   const base={fechaRegistro:'2026-10-01',prioridad:'Alta',categoria:'',descripcion:'Archivado <acta> María',responsable:'',apoyo:'',fechaLimite:'2026-10-31',estado:'Pendiente',avance:0,ultimaGestion:'',observaciones:'',proximaAccion:'Consultar acta',fechaSeguimiento:'2026-10-31',archivado:false};
   await pSave({...base,id:'cycle'});await gWrite({id:'g-cycle',pendienteId:'cycle',fecha:'2026-10-10',detalle:'Gestión que se conserva',creado:new Date().toISOString()});await gSync('cycle');
   await pSave({...base,id:'active',descripcion:'Asunto activo'});
   await pSave({...base,id:'closed',descripcion:'Cierre que se conserva',estado:'Finalizado',fechaCierre:'2026-10-30',resultadoCierre:'Entregado'});await pSetArchived('closed',true);
   await new Promise((resolve,reject)=>{const tx=db.transaction('pendientes','readwrite');tx.objectStore('pendientes').put({...base,id:'legacy',descripcion:'Archivo anterior sin fecha',archivado:true});tx.oncomplete=resolve;tx.onerror=reject;});
   await renderPending();
  });
  const read=id=>page.evaluate(async id=>(await pAll()).find(p=>p.id===id),id);
  const before=await read('cycle'),beforeGestiones=await page.evaluate(()=>gAll());
  let acceptDialogs=false;
  page.on('dialog',dialog=>acceptDialogs?dialog.accept(dialog.type()==='prompt'?'REEMPLAZAR':undefined):dialog.dismiss());
  // Canceling archive is a no-op.
  await page.locator('[data-pdelete="cycle"]').click();assert.deepEqual(await read('cycle'),before);
  acceptDialogs=true;await page.locator('[data-pdelete="cycle"]').click();await page.locator('[data-pview="cycle"]').waitFor({state:'hidden'});
  let item=await read('cycle');assert.equal(item.archivado,true);assert.equal(item.archivadoEn,'2026-11-04T18:00:00.000Z');assert.deepEqual(await page.evaluate(()=>gAll()),beforeGestiones);
  assert.deepEqual(item.historialCambios.map(h=>h.campo),['archivado','archivadoEn']);
  await page.locator('#pArchiveScope').selectOption('archivados');assert.equal(await page.locator('[data-prestore]').count(),3);
  assert.equal(await page.locator('[data-pedit]').count(),0);assert.equal(await page.locator('[data-pdelete]').count(),0);
  await page.evaluate(async()=>{pFilters.q='María';await renderPending();});assert.equal(await page.locator('[data-pview]').count(),1);
  await page.locator('[data-pview="cycle"]').click();await page.locator('#gList .gestion-entry').waitFor();
  assert.equal(await page.locator('[name=descripcion]').isDisabled(),true);assert.equal(await page.locator('#gAdd').count(),0);assert.equal(await page.locator('[data-gedit]').count(),0);assert.equal(await page.locator('[data-gdelete]').count(),0);
  assert.ok((await page.locator('#gList').innerText()).includes('Gestión que se conserva'));assert.equal(await page.locator('#pHistory .gestion-entry').count(),2);await page.locator('#pCancel').click();
  // Writes from a form left open in another tab cannot overwrite an archive or implicitly restore it.
  const protection=await page.evaluate(async before=>{
   const result=[];for(const action of [()=>pSave({...before,descripcion:'Cambio obsoleto'}),()=>gWrite({id:'g-stale',pendienteId:'cycle',fecha:'2026-11-04',detalle:'No guardar'}),()=>gWrite({id:'g-cycle',pendienteId:'cycle'},true)]){try{await action();result.push(false);}catch{result.push(true);}}
   await Promise.all([pSetArchived('cycle',true),pSetArchived('cycle',true)]);return result;
  },before);assert.deepEqual(protection,[true,true,true]);assert.deepEqual(await read('cycle'),item);
  await page.evaluate(async()=>{pFilters.q='';await renderPending();});await page.locator('#pArchiveScope').selectOption('todos');assert.equal(await page.locator('[data-pview]').count(),4);
  await page.locator('.nav[data-page=tablero]').click();
  const metricUI=label=>page.locator('.dash-metric').filter({hasText:label}).locator('strong').innerText();
  assert.equal(await metricUI('Total asuntos'),'1');assert.equal(await metricUI('Sin movimiento'),'1');
  // Explicit inclusion controls all sheets; operational metrics exclude archived rows.
  await page.locator('.nav[data-page=excel]').click();
  const getExcel=async name=>{
   const event=page.waitForEvent('download');await page.locator('#excelDownload').click();const file=await event;const target=path.join(out,name);await file.saveAs(target);const zip=await JSZip.loadAsync(fs.readFileSync(target)),files={};
   for(let i=1;i<=4;i++)files[i]=await zip.file('xl/worksheets/sheet'+i+'.xml').async('string');
   assert.ok(await page.evaluate(files=>Object.values(files).every(xml=>!new DOMParser().parseFromString(xml,'application/xml').querySelector('parsererror')),files));return files;
  };
  const metric=(xml,label)=>{const row=xml.match(/<row\b[^>]*>.*?<\/row>/g).find(r=>r.includes(label));assert.ok(row,label);return Number(row.match(/<v>([^<]+)<\/v>/)[1]);};
  const standard=await getExcel('default.xlsx');assert.equal(metric(standard[1],'Asuntos exportados'),1);assert.equal(metric(standard[1],'Archivados exportados'),0);assert.equal((standard[4].match(/<row /g)||[]).length,1);
  await page.locator('#excelIncludeArchived').check();const all=await getExcel('with-archives.xlsx');
  assert.equal(metric(all[1],'Asuntos exportados'),4);assert.equal(metric(all[1],'No archivados exportados'),1);assert.equal(metric(all[1],'Archivados exportados'),3);assert.equal(metric(all[1],'Pendiente'),1);assert.equal(metric(all[1],'Finalizado'),0);assert.equal(metric(all[1],'Vencidos (abiertos)'),1);assert.equal(metric(all[1],'Seguimientos vencidos (abiertos)'),1);assert.equal(metric(all[1],'Abiertos sin movimiento'),1);assert.equal(metric(all[1],'Finalizados en plazo'),0);
  assert.ok(all[2].includes('Condición'));assert.ok(all[2].includes('Fecha de archivo'));assert.ok(all[2].includes('Archivado'));assert.ok(all[3].includes('Fecha de archivo'));assert.ok(all[4].includes('Cierre que se conserva'));
  const archiveCells=await page.evaluate(xml=>{
   const doc=new DOMParser().parseFromString(xml,'application/xml');return [...doc.querySelectorAll('sheetData row')].slice(1).map(row=>{const cells=[...row.children];return {id:cells[13].textContent,condition:cells[21].textContent,date:cells[22].textContent,dateType:cells[22].getAttribute('s')};});
  },all[2]);
  assert.equal(archiveCells.find(p=>p.id==='cycle').condition,'Archivado');assert.equal(archiveCells.find(p=>p.id==='cycle').dateType,'5');assert.equal(Number(archiveCells.find(p=>p.id==='cycle').date)%1,0.5);assert.equal(archiveCells.find(p=>p.id==='legacy').date,'');
  await page.evaluate(()=>{pFilters.archivo='archivados';pFilters.q='María';});await page.locator('[value=filtered]').check();const filtered=await getExcel('filtered-archives.xlsx');assert.equal(metric(filtered[1],'Asuntos exportados'),1);assert.equal(metric(filtered[1],'Archivados exportados'),1);assert.ok(!filtered[2].includes('Cierre que se conserva'));
  await page.locator('#excelIncludeArchived').uncheck();const excluded=await getExcel('excluded.xlsx');assert.equal(metric(excluded[1],'Asuntos exportados'),0);
  // Real restore preserves original ID, state, descriptions, gestiones and closure history.
  await page.locator('.nav[data-page=pendientes]').click();await page.locator('[data-prestore="cycle"]').click();await page.locator('[data-pview="cycle"]').waitFor({state:'hidden'});item=await read('cycle');
  assert.equal(item.id,before.id);assert.equal(item.archivado,false);assert.equal(item.archivadoEn,'');assert.equal(item.estado,before.estado);assert.equal(item.descripcion,before.descripcion);assert.equal(item.proximaAccion,before.proximaAccion);assert.deepEqual(item.historialCierres,before.historialCierres);assert.equal(item.historialCambios.length,4);assert.deepEqual(await page.evaluate(()=>gAll()),beforeGestiones);
  assert.equal(item.historialCambios.find(h=>h.campo==='archivadoEn'&&!h.nuevo).anterior,'2026-11-04T18:00:00.000Z');
  await page.evaluate(async()=>{pFilters.q='';await renderPending();});await page.locator('[data-pview="closed"]').click();assert.equal(await page.locator('#pClosures .gestion-entry').count(),1);await page.locator('#pCancel').click();
  const closedBefore=await read('closed');await page.locator('[data-prestore="closed"]').click();await page.locator('[data-pview="closed"]').waitFor({state:'hidden'});const closedAfter=await read('closed');assert.equal(closedAfter.estado,'Finalizado');assert.equal(closedAfter.resultadoCierre,'Entregado');assert.deepEqual(closedAfter.historialCierres,closedBefore.historialCierres);
  await page.locator('[data-prestore="legacy"]').click();await page.locator('[data-pview="legacy"]').waitFor({state:'hidden'});assert.equal((await read('legacy')).archivado,false);
  await page.locator('#pArchiveScope').selectOption('activos');assert.equal(await page.locator('[data-pview]').count(),4);await page.locator('[data-pedit="cycle"]').click();await page.locator('[name=observaciones]').fill('Editable tras restaurar');await page.locator('#pForm [type=submit]').click();await page.locator('#pDialog').waitFor({state:'hidden'});
  // Archive again, reload, then export/restore the actual JSON backup.
  await page.locator('[data-pdelete="cycle"]').click();await page.locator('[data-pview="cycle"]').waitFor({state:'hidden'});await page.reload();await page.locator('#pArchiveScope').selectOption('archivados');await page.locator('[data-pview="cycle"]').waitFor();
  await page.locator('.nav[data-page=configuracion]').click();const jsonEvent=page.waitForEvent('download');await page.locator('#cfgExport').click();const file=await jsonEvent;const backupPath=path.join(out,'archives.json');await file.saveAs(backupPath);const payload=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(payload.esquema,5);
  const checks=await page.evaluate(payload=>{
   const rejected=['true',42,null].map(value=>{const copy=structuredClone(payload);copy.datos.pendientes.find(p=>p.id==='cycle').archivado=value;try{cfgValidate(copy);return false;}catch{return true;}});
   for(const value of ['2026-02-30T12:00:00.000Z','invalida',42]){const copy=structuredClone(payload);copy.datos.pendientes.find(p=>p.id==='cycle').archivadoEn=value;try{cfgValidate(copy);rejected.push(false);}catch{rejected.push(true);}}
   const current=cfgValidate(payload),legacy=structuredClone(current);for(const p of legacy.pendientes){delete p.archivadoEn;p.historialCambios=[];}
   const merged=cfgMerge(current,legacy,'fusionar');cfgValidateMerged(merged);const twice=cfgMerge(merged,current,'fusionar');cfgValidateMerged(twice);
   return {rejected,count:twice.pendientes.find(p=>p.id==='cycle').historialCambios.length};
  },payload);assert.deepEqual(checks.rejected,[true,true,true,true,true,true]);assert.equal(checks.count,payload.datos.pendientes.find(p=>p.id==='cycle').historialCambios.length);
  await page.evaluate(()=>pSetArchived('cycle',false));await page.locator('#cfgFile').setInputFiles(backupPath);await page.locator('#cfgMode').selectOption('reemplazar');await page.locator('#cfgCommit').click();await page.waitForFunction(()=>document.getElementById('cfgStatus').textContent.includes('Importación completada'));assert.deepEqual(await read('cycle'),payload.datos.pendientes.find(p=>p.id==='cycle'));assert.deepEqual(await page.evaluate(()=>gAll()),beforeGestiones);
  await page.locator('.nav[data-page=pendientes]').click();await page.locator('#pArchiveScope').selectOption('archivados');await page.setViewportSize({width:390,height:844});await page.locator('[data-pview="cycle"]').click();await page.screenshot({path:path.join(out,'archive-mobile.png')});await page.locator('#pCancel').click();await page.locator('.nav[data-page=excel]').click();await page.screenshot({path:path.join(out,'archive-excel.png')});
  assert.deepEqual(errors,[]);console.log('PASS: archivar/cancelar/restaurar, búsqueda/vistas, conservación de datos e historiales, bloqueo de edición obsoleta, XLSX inclusión/filtros/conteos/fechas y JSON validación/restauración.');console.log('OUTPUT_DIR='+out);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
