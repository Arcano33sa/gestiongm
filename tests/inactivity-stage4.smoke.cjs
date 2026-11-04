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
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'gestiongm-inactivity-'));
  const context=await browser.newContext({acceptDownloads:true,timezoneId:'America/Managua'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-04T18:00:00Z'));
  await page.goto(`http://127.0.0.1:${server.address().port}/#pendientes`);
  await page.waitForFunction(()=>document.getElementById('pAdd'));




  const JSZip=require('jszip');
  await page.evaluate(async()=>{
   const base={fechaRegistro:'2026-10-01',prioridad:'Media',categoria:'',descripcion:'',responsable:'',apoyo:'',fechaLimite:'2026-12-31',estado:'Pendiente',avance:0,ultimaGestion:'',observaciones:'',archivado:false};
   for(const [id,fechaRegistro,estado,archivado] of [
    ['never','2026-10-20','Pendiente',false],['edge','2026-10-01','En proceso',false],['recent','2026-10-01','En espera',false],
    ['stale','2026-10-01','Pendiente',false],['future','2026-10-01','Pendiente',false],['older','2025-01-01','Pendiente',false],
    ['closed','2026-10-01','Finalizado',false],['cancelled','2026-10-01','Cancelado',false],['archived','2026-10-01','Pendiente',true]
   ]){
    // Include actual legacy records and a deliberately stale cached ultimaGestion.
    await new Promise((resolve,reject)=>{const tx=db.transaction('pendientes','readwrite');tx.objectStore('pendientes').put({...base,id,descripcion:'Asunto '+id,fechaRegistro,estado,archivado,ultimaGestion:id==='stale'?'2026-11-04':''});tx.oncomplete=resolve;tx.onerror=reject;});
   }
   for(const [id,pendienteId,fecha] of [['g-edge','edge','2026-10-21'],['g-recent','recent','2026-10-22'],['g-future','future','2026-11-05']])await gWrite({id,pendienteId,fecha,detalle:'Gestión '+id,creado:new Date().toISOString()});
   await renderPending();
  });
  const row=id=>page.locator(`[data-pview="${id}"]`).locator('xpath=ancestor::tr');
  const cells=async id=>row(id).locator('td').allTextContents();
  assert.deepEqual((await cells('never')).slice(-3,-1),['15','Sí']);
  assert.deepEqual((await cells('edge')).slice(-3,-1),['14','Sí']);
  assert.deepEqual((await cells('recent')).slice(-3,-1),['13','No']);
  assert.deepEqual((await cells('stale')).slice(-3,-1),['34','Sí']);
  assert.deepEqual((await cells('future')).slice(-3,-1),['','Fecha futura']);
  assert.deepEqual((await cells('closed')).slice(-3,-1),['','No aplica']);
  await page.locator('#pMovement').selectOption('inactive');assert.equal(await page.locator('[data-pview]').count(),4);
  // Derived search values must match Excel's search scope.
  await page.locator('#pMovement').selectOption('');await page.evaluate(async()=>{pFilters.q='Sí';await renderPending();});assert.equal(await page.locator('[data-pview]').count(),4);
  await page.evaluate(async()=>{pFilters.q='';await renderPending();});
  await page.locator('.nav[data-page=tablero]').click();
  const inactiveMetric=()=>page.locator('.dash-metric').filter({hasText:'Sin movimiento'}).locator('strong').innerText();
  assert.equal(await inactiveMetric(),'4');
  await page.locator('#dashYear').selectOption('2026');assert.equal(await inactiveMetric(),'4'); // includes historical carryover
  await page.locator('#dashYear').selectOption('2025');assert.equal(await inactiveMetric(),'1');
  await page.locator('#dashYear').selectOption('Todos');
  // Create, edit and remove a gestion through the actual pending detail.
  await page.locator('.nav[data-page=pendientes]').click();await page.locator('[data-pview="never"]').click();
  await page.locator('#gAdd').click();await page.locator('#gForm [name=fecha]').fill('2026-11-04');await page.locator('#gForm [name=detalle]').fill('Atención reciente');
  await page.locator('#gForm [type=submit]').click();await page.locator('#gList .gestion-entry').waitFor();
  await page.waitForFunction(()=>document.getElementById('pInactivity').textContent.includes('Días sin gestión: 0'));
  await page.locator('[data-gedit]').click();await page.locator('#gForm [name=fecha]').fill('2026-10-20');
  page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?'REEMPLAZAR':undefined));
  await page.locator('#gForm [type=submit]').click();await page.waitForFunction(()=>document.getElementById('pInactivity').textContent.includes('Días sin gestión: 15'));
  await page.locator('[data-gdelete]').click();await page.waitForFunction(()=>document.getElementById('gList').textContent.includes('Todavía no hay gestiones'));
  await page.locator('#pCancel').click();await page.evaluate(()=>renderPending());assert.deepEqual((await cells('never')).slice(-3,-1),['15','Sí']);
  await page.locator('[data-pedit="never"]').click();await page.locator('[name=observaciones]').fill('Edición sin gestión');await page.locator('#pForm [type=submit]').click();await page.locator('#pDialog').waitFor({state:'hidden'});
  assert.deepEqual((await cells('never')).slice(-3,-1),['15','Sí']);
  // Save an inactivity threshold, validate it and retain it after a reload.
  await page.locator('.nav[data-page=configuracion]').click();assert.equal(await page.locator('#cfgInactivityDays').inputValue(),'14');
  await page.locator('#cfgInactivityDays').fill('0');await page.locator('#cfgInactivityForm button').click();assert.equal(await page.evaluate(()=>pInactivityLimit()),14);
  await page.locator('#cfgInactivityDays').fill('20');await page.locator('#cfgInactivityForm button').click();await page.waitForFunction(()=>document.getElementById('cfgInactivityStatus').textContent.includes('20 días'));
  await page.reload();await page.waitForFunction(()=>document.getElementById('cfgInactivityDays')?.value==='20');
  await page.locator('#cfgInactivityDays').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'inactivity-config.png')});
  await page.locator('.nav[data-page=tablero]').click();assert.equal(await inactiveMetric(),'2');
  await page.locator('.nav[data-page=excel]').click();
  const getExcel=async name=>{
   const event=page.waitForEvent('download');await page.locator('#excelDownload').click();const file=await event;const target=path.join(out,name);await file.saveAs(target);
   const zip=await JSZip.loadAsync(fs.readFileSync(target));return {summary:await zip.file('xl/worksheets/sheet1.xml').async('string'),data:await zip.file('xl/worksheets/sheet2.xml').async('string')};
  };
  const metric=(xml,label)=>{const row=xml.match(/<row\b[^>]*>.*?<\/row>/g).find(r=>r.includes(label));assert.ok(row,label);return Number(row.match(/<v>([^<]+)<\/v>/)[1]);};
  const all=await getExcel('all.xlsx');assert.equal(metric(all.summary,'Plazo sin movimiento (días)'),20);assert.equal(metric(all.summary,'Abiertos sin movimiento'),2);assert.equal(metric(all.summary,'Abiertos con movimiento reciente'),3);assert.equal(metric(all.summary,'Abiertos sin movimiento evaluable'),1);
  assert.ok(all.data.includes('Días sin gestión'));assert.ok(all.data.includes('Sin movimiento'));assert.ok(all.data.includes('<autoFilter ref="A1:W9"/>'));
  // Numeric duration and blank duration for non-applicable records.
  const parsed=await page.evaluate(xml=>{
   const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('XML inválido');
   return [...doc.querySelectorAll('sheetData row')].slice(1).map(row=>{const cells=[...row.children];return {id:cells[13].textContent,days:cells[19].textContent,type:cells[19].getAttribute('t'),status:cells[20].textContent};});
  },all.data);
  assert.deepEqual(parsed.find(p=>p.id==='never'),{id:'never',days:'15',type:null,status:'No'});
  assert.equal(parsed.find(p=>p.id==='closed').days,'');assert.equal(parsed.find(p=>p.id==='future').status,'Fecha futura');
  await page.evaluate(()=>{pFilters.movimiento='inactive';});await page.locator('[value=filtered]').check();const filtered=await getExcel('inactive.xlsx');assert.equal(metric(filtered.summary,'Asuntos exportados'),2);assert.equal(metric(filtered.summary,'Abiertos sin movimiento'),2);
  await page.evaluate(()=>{pFilters.movimiento='';pFilters.q='Sí';});const searched=await getExcel('search.xlsx');assert.equal(metric(searched.summary,'Asuntos exportados'),2);
  await page.evaluate(()=>{pFilters.q='sin coincidencias';});const empty=await getExcel('empty.xlsx');assert.equal(metric(empty.summary,'Abiertos sin movimiento'),0);
  // Real JSON restoration updates the configured threshold; older backups use a safe default.
  await page.locator('.nav[data-page=configuracion]').click();const jsonEvent=page.waitForEvent('download');await page.locator('#cfgExport').click();const jsonFile=await jsonEvent;const backupPath=path.join(out,'inactivity.json');await jsonFile.saveAs(backupPath);
  const payload=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(payload.datos.metadatos.find(m=>m.id==='cfg-inactivity-days').value,20);
  const validation=await page.evaluate(payload=>{
   const invalid=[0,366,1.5,'20',null].map(value=>{const copy=structuredClone(payload);copy.datos.metadatos.find(m=>m.id===P_INACTIVITY_KEY).value=value;try{cfgValidate(copy);return false;}catch{return true;}});
   const old=structuredClone(payload);old.datos.metadatos=old.datos.metadatos.filter(m=>m.id!==P_INACTIVITY_KEY);old.conteos.metadatos=old.datos.metadatos.length;const data=cfgValidate(old),current=cfgValidate(payload),merged=cfgMerge(current,data,'fusionar');cfgValidateMerged(merged);
   return {invalid,merged:merged.metadatos.find(m=>m.id===P_INACTIVITY_KEY).value};
  },payload);assert.deepEqual(validation,{invalid:[true,true,true,true,true],merged:20});
  await page.locator('#cfgInactivityDays').fill('30');await page.locator('#cfgInactivityForm button').click();await page.waitForFunction(()=>document.getElementById('cfgInactivityStatus').textContent.includes('30 días'));
  await page.locator('#cfgFile').setInputFiles(backupPath);await page.locator('#cfgMode').selectOption('reemplazar');await page.locator('#cfgCommit').click();await page.waitForFunction(()=>document.getElementById('cfgStatus').textContent.includes('Importación completada'));
  assert.equal(await page.locator('#cfgInactivityDays').inputValue(),'20');assert.equal(await page.evaluate(()=>pInactivityLimit()),20);assert.match(await page.locator('#cfgInactivityStatus').innerText(),/Plazo restaurado: 20 días/);
  const old=structuredClone(payload);old.datos.metadatos=old.datos.metadatos.filter(m=>m.id!=='cfg-inactivity-days');old.conteos.metadatos=old.datos.metadatos.length;
  const oldPath=path.join(out,'old.json');fs.writeFileSync(oldPath,JSON.stringify(old));await page.locator('#cfgFile').setInputFiles(oldPath);await page.locator('#cfgMode').selectOption('reemplazar');await page.locator('#cfgCommit').click();await page.waitForFunction(()=>document.getElementById('cfgInactivityDays').value==='14');assert.equal(await page.evaluate(()=>pInactivityLimit()),14);
  // Calendar-day calculation stays stable through leap years and DST.
  assert.deepEqual(await page.evaluate(()=>[
   pInactivity({estado:'Pendiente',fechaRegistro:'2028-02-28'},'2028-03-01',2),
   pInactivity({estado:'Pendiente',fechaRegistro:'2026-11-04'},'2026-11-04',1),
   pInactivity({estado:'Pendiente',fechaRegistro:'2026-11-05'},'2026-11-04',1)
  ]),[{diasSinGestion:2,sinMovimiento:'Sí'},{diasSinGestion:0,sinMovimiento:'No'},{diasSinGestion:null,sinMovimiento:'Fecha futura'}]);
  await page.locator('.nav[data-page=tablero]').click();await page.setViewportSize({width:390,height:844});await page.locator('.dash-panel').filter({has:page.locator('h3',{hasText:'Asuntos sin movimiento'})}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'inactivity-mobile.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: registro/gestiones reales, umbral y límites, estados excluidos, arrastre, edición/borrado de gestiones, configuración persistente, XLSX total/filtrado/búsqueda/vacío y JSON validación/restauración/compatibilidad.');
  console.log('OUTPUT_DIR='+out);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
