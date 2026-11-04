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
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'gestiongm-closure-'));
  const context=await browser.newContext({acceptDownloads:true,timezoneId:'America/Managua'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-04T18:00:00Z'));
  await page.goto(`http://127.0.0.1:${server.address().port}/#pendientes`);
  await page.waitForFunction(()=>document.getElementById('pAdd'));



  const JSZip=require('jszip');
  await page.evaluate(async()=>{
   const base={fechaRegistro:'2026-11-01',prioridad:'Media',categoria:'',descripcion:'Ciclo de cierre',responsable:'',apoyo:'',fechaLimite:'2026-11-04',estado:'Pendiente',avance:0,ultimaGestion:'',observaciones:'',archivado:false};
   await pSave({...base,id:'cycle'});
   // Preserve real legacy closed records without invented dates/results.
   await new Promise((resolve,reject)=>{const tx=db.transaction('pendientes','readwrite');tx.objectStore('pendientes').put({...base,id:'legacy',descripcion:'Cierre anterior',estado:'Finalizado'});tx.oncomplete=resolve;tx.onerror=reject;});
   await renderPending();
  });
  const record=()=>page.evaluate(async()=>(await pAll()).find(p=>p.id==='cycle'));
  const edit=async()=>{await page.locator('[data-pedit="cycle"]').click();};
  const save=async()=>{await page.locator('#pForm [type=submit]').click();await page.locator('#pDialog').waitFor({state:'hidden'});};
  await edit();await page.locator('[name=estado]').selectOption('Finalizado');
  assert.equal(await page.locator('[name=fechaCierre]').inputValue(),'2026-11-04');assert.equal(await page.locator('[name=motivoCancelacion]').isVisible(),false);
  await page.locator('#pForm [type=submit]').click();
  assert.equal((await record()).estado,'Pendiente');
  await page.locator('[name=resultadoCierre]').fill('=Entregado <informe> a María');
  await page.locator('[name=fechaCierre]').fill('2026-10-31');
  await page.locator('#pForm [type=submit]').click();await page.waitForFunction(()=>document.getElementById('pError').textContent.includes('fecha de cierre válida'));
  assert.equal((await record()).estado,'Pendiente');
  await page.locator('[name=fechaCierre]').fill('2026-11-04');await page.locator('#pClosureFields').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'closure-form.png')});await save();
  let item=await record();assert.equal(item.fechaCierre,'2026-11-04');assert.equal(item.historialCierres.length,1);assert.equal(item.historialCierres[0].accion,'Cierre');
  assert.deepEqual(await page.evaluate(item=>pClosureMetrics(item),item),{dias:3,cumplimiento:'En plazo'});
  // Editing a deadline after closing does not retroactively alter the captured deadline.
  await edit();await page.locator('[name=fechaLimite]').fill('2026-11-02');await save();item=await record();
  assert.equal(item.historialCierres.length,1);assert.equal(await page.evaluate(item=>pClosureMetrics(item).cumplimiento,item),'En plazo');
  // Reopen, cancel, reopen, then finalize late; previous closure records survive.
  await edit();await page.locator('[name=estado]').selectOption('En proceso');await save();item=await record();
  assert.equal(item.fechaCierre,'');assert.equal(item.resultadoCierre,'');assert.equal(item.historialCierres.length,2);assert.equal(item.historialCierres[1].accion,'Reapertura');assert.equal(item.historialCierres[1].fechaLimite,'2026-11-04');
  await edit();await page.locator('[name=estado]').selectOption('Cancelado');
  assert.equal(await page.locator('[name=motivoCancelacion]').isVisible(),true);
  await page.locator('[name=motivoCancelacion]').fill('Acuerdo suspendido');await save();item=await record();
  assert.equal(item.motivoCancelacion,'Acuerdo suspendido');assert.equal(item.resultadoCierre,'');assert.equal(item.historialCierres.length,3);
  await edit();await page.locator('[name=estado]').selectOption('Pendiente');await save();
  await edit();await page.locator('[name=estado]').selectOption('Finalizado');await page.locator('[name=resultadoCierre]').fill('Resultado definitivo');await save();
  item=await record();assert.equal(item.historialCierres.length,5);assert.deepEqual(await page.evaluate(item=>pClosureMetrics(item),item),{dias:3,cumplimiento:'Fuera de plazo'});
  // Corrections are snapshots, not rewrites of earlier closure information.
  await edit();await page.locator('[name=resultadoCierre]').fill('Resultado definitivo corregido');await save();item=await record();
  assert.equal(item.historialCierres.length,6);assert.equal(item.historialCierres[5].accion,'Corrección');assert.equal(item.historialCierres[4].resultadoCierre,'Resultado definitivo');
  await edit();await save();assert.equal((await record()).historialCierres.length,6);
  await page.reload();await page.locator('[data-pview="cycle"]').click();assert.equal(await page.locator('#pClosures .gestion-entry').count(),6);
  await page.locator('#pClosures').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'closures-desktop.png')});await page.locator('#pCancel').click();
  // Independent metrics: same-day, leap year, no deadline, cancellation and legacy exclusions.
  const metrics=await page.evaluate(()=>[
   pClosureMetrics({estado:'Finalizado',fechaRegistro:'2026-11-04',fechaCierre:'2026-11-04',fechaLimite:'2026-11-04'}),
   pClosureMetrics({estado:'Finalizado',fechaRegistro:'2028-02-28',fechaCierre:'2028-03-01',fechaLimite:''}),
   pClosureMetrics({estado:'Cancelado',fechaRegistro:'2026-11-01',fechaCierre:'2026-11-04'}),
   pClosureMetrics({estado:'Finalizado'})
  ]);
  assert.deepEqual(metrics,[{dias:0,cumplimiento:'En plazo'},{dias:2,cumplimiento:'Sin Fecha Límite'},{dias:3,cumplimiento:'No aplica'},{dias:null,cumplimiento:'Sin datos de cierre'}]);
  await page.evaluate(async()=>{
   const item=(await pAll()).find(p=>p.id==='cycle');await pSave({...item,id:'on-time',descripcion:'Finalizado en plazo',historialCierres:[],fechaLimite:'2026-11-04'});
   await pSave({...item,id:'no-deadline',descripcion:'Finalizado sin plazo',historialCierres:[],fechaLimite:''});
   await pSave({...item,id:'cancelled',descripcion:'Cancelado',estado:'Cancelado',resultadoCierre:'',motivoCancelacion:'Cancelación válida'});
   await pSave({...item,id:'archived',descripcion:'No exportar',archivado:true});
  });
  await page.locator('.nav[data-page=excel]').click();
  const exportExcel=async(name)=>{
   const event=page.waitForEvent('download');await page.locator('#excelDownload').click();const file=await event;const target=path.join(out,name);await file.saveAs(target);
   const zip=await JSZip.loadAsync(fs.readFileSync(target)),files={};for(const name of ['xl/workbook.xml','xl/_rels/workbook.xml.rels','[Content_Types].xml','xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml','xl/worksheets/sheet4.xml'])files[name]=await zip.file(name).async('string');
   assert.ok(await page.evaluate(files=>Object.values(files).every(xml=>!new DOMParser().parseFromString(xml,'application/xml').querySelector('parsererror')),files));return files;
  };
  const metric=(xml,label)=>{const row=xml.match(/<row\b[^>]*>.*?<\/row>/g).find(r=>r.includes(label));assert.ok(row,label);return row.match(/<v>([^<]+)<\/v>/)?.[1]||'';};
  const all=await exportExcel('all.xlsx');
  assert.ok(all['xl/workbook.xml'].includes('name="Cierres y reaperturas"'));assert.ok(all['xl/_rels/workbook.xml.rels'].includes('worksheets/sheet4.xml'));assert.ok(all['[Content_Types].xml'].includes('/xl/worksheets/sheet4.xml'));
  assert.equal(metric(all['xl/worksheets/sheet1.xml'],'Finalizados en plazo'),'1');assert.equal(metric(all['xl/worksheets/sheet1.xml'],'Finalizados fuera de plazo'),'1');
  assert.equal(metric(all['xl/worksheets/sheet1.xml'],'Finalizados sin Fecha Límite'),'1');assert.equal(metric(all['xl/worksheets/sheet1.xml'],'Finalizados sin datos de cierre'),'1');
  assert.equal(metric(all['xl/worksheets/sheet1.xml'],'Cumplimiento del plazo (finalizados evaluables)'),'0.5');
  const closures=all['xl/worksheets/sheet4.xml'];assert.ok(closures.includes('Reapertura'));assert.ok(closures.includes('Corrección'));assert.ok(closures.includes('&apos;=Entregado &lt;informe&gt; a María'));assert.ok(!closures.includes('No exportar'));
  assert.match(closures,/<c r="G2" s="3"><v>\d+<\/v><\/c>/);
  assert.ok(all['xl/worksheets/sheet2.xml'].includes('Días hasta el cierre'));assert.ok(all['xl/worksheets/sheet2.xml'].includes('Cumplimiento del plazo'));
  await page.evaluate(()=>{pFilters.q='Ciclo de cierre';});await page.locator('[value=filtered]').check();const filtered=await exportExcel('filtered.xlsx');assert.equal((filtered['xl/worksheets/sheet4.xml'].match(/<row /g)||[]).length,7);
  await page.evaluate(()=>{pFilters.q='sin coincidencias';});const empty=await exportExcel('empty.xlsx');assert.equal((empty['xl/worksheets/sheet4.xml'].match(/<row /g)||[]).length,1);assert.ok(empty['xl/worksheets/sheet1.xml'].includes('No evaluable'));
  // Real backup/restore and closure validation, including merge from old backups.
  await page.locator('.nav[data-page=configuracion]').click();const jsonEvent=page.waitForEvent('download');await page.locator('#cfgExport').click();const file=await jsonEvent;const backupPath=path.join(out,'closures.json');await file.saveAs(backupPath);
  const payload=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(payload.esquema,5);
  const validation=await page.evaluate(payload=>{
   const current=cfgValidate(payload),old=structuredClone(current);for(const p of old.pendientes){delete p.historialCierres;delete p.fechaCierre;delete p.resultadoCierre;delete p.motivoCancelacion;}
   const merged=cfgMerge(current,old,'fusionar');cfgValidateMerged(merged);const twice=cfgMerge(merged,current,'fusionar');cfgValidateMerged(twice);
   const reject=modify=>{const copy=structuredClone(payload);modify(copy.datos.pendientes.find(p=>p.id==='cycle'));try{cfgValidate(copy);return false;}catch{return true;}};
   const rejected=[reject(p=>p.fechaCierre='2026-02-30'),reject(p=>p.resultadoCierre=''),reject(p=>p.historialCierres.push(p.historialCierres[0])),reject(p=>p.historialCierres[0].accion='Inventado'),reject(p=>p.historialCierres[0].fechaLimite=42)];
   const conflict=structuredClone(current);conflict.pendientes.find(p=>p.id==='cycle').historialCierres[0].resultadoCierre='Contradicción';let conflictRejected=false;try{cfgMerge(current,conflict,'fusionar');}catch{conflictRejected=true;}
   return {count:twice.pendientes.find(p=>p.id==='cycle').historialCierres.length,rejected,conflictRejected};
  },payload);
  assert.deepEqual(validation,{count:6,rejected:[true,true,true,true,true],conflictRejected:true});
  await page.evaluate(async()=>{const item=(await pAll()).find(p=>p.id==='cycle');await pSave({...item,estado:'En proceso'});});
  await page.locator('#cfgFile').setInputFiles(backupPath);await page.locator('#cfgMode').selectOption('reemplazar');page.on('dialog',dialog=>{return dialog.accept(dialog.type()==='prompt'?'REEMPLAZAR':undefined);});
  await page.locator('#cfgCommit').click();await page.waitForFunction(()=>/Importación completada|No se importó|Los datos cambiaron|Importación cancelada/.test(document.getElementById('cfgStatus').textContent)).catch(async error=>{console.log('RESTORE STATUS',await page.locator('#cfgStatus').innerText());throw error;});assert.match(await page.locator('#cfgStatus').innerText(),/Importación completada/);
  assert.deepEqual((await record()).historialCierres,item.historialCierres);
  await page.locator('.nav[data-page=pendientes]').click();await page.evaluate(async()=>{pFilters.q='';await renderPending();});await page.setViewportSize({width:390,height:844});await page.locator('[data-pview="cycle"]').click();await page.locator('#pClosures').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'closures-mobile.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: cierre requerido/validado, cancelación, reaperturas/correcciones preservadas, métricas, plazo capturado, registros anteriores, XLSX total/filtrado/vacío y JSON validación/fusión/restauración.');
  console.log('OUTPUT_DIR='+out);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
