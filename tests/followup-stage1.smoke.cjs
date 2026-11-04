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
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'gestiongm-followup-'));
  const context=await browser.newContext({acceptDownloads:true,timezoneId:'America/Managua'});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-11-04T18:00:00Z')});
  await page.goto(`http://127.0.0.1:${server.address().port}/#pendientes`);
  await page.waitForFunction(()=>document.getElementById('pAdd'));

  const JSZip=require('jszip');
  // Existing records remain valid without the optional fields.
  await page.evaluate(async()=>{
   const base={fechaRegistro:'2026-01-01',prioridad:'Media',categoria:'',descripcion:'Anterior sin seguimiento',responsable:'',apoyo:'',fechaLimite:'2026-12-31',estado:'Pendiente',avance:25,ultimaGestion:'',observaciones:'',archivado:false};
   await pSave({...base,id:'legacy'});
   for(const [id,estado,fechaSeguimiento,archivado] of [
    ['late','En proceso','2026-11-03',false],['today','En espera','2026-11-04',false],
    ['edge','Pendiente','2026-11-11',false],['future','Pendiente','2026-11-12',false],
    ['closed','Finalizado','2026-11-03',false],['cancelled','Cancelado','2026-11-04',false],
    ['archived','Pendiente','2026-11-03',true]
   ])await pSave({...base,id,descripcion:id,estado,fechaSeguimiento,proximaAccion:'Revisar '+id,archivado,...(estado==='Finalizado'?{fechaCierre:'2026-11-03',resultadoCierre:'Concluido'}:estado==='Cancelado'?{fechaCierre:'2026-11-03',motivoCancelacion:'Sin efecto'}:{})});
   await renderPending();
  });
  await page.locator('[data-pedit="legacy"]').click();
  assert.equal(await page.locator('[name=proximaAccion]').inputValue(),'');
  assert.equal(await page.locator('[name=fechaSeguimiento]').inputValue(),'');
  await page.locator('#pCancel').click();
  await page.locator('#pAdd').click();
  await page.locator('[name=descripcion]').fill('Nuevo seguimiento');
  await page.locator('[name=proximaAccion]').fill('  =Llamar a María; revisar <acta>  ');
  await page.locator('[name=fechaSeguimiento]').fill('2026-11-03');
  await page.locator('#pForm [type=submit]').click();
  await page.locator('#pDialog').waitFor({state:'hidden'});
  const created=await page.evaluate(async()=>(await pAll()).find(p=>p.descripcion==='Nuevo seguimiento'));
  assert.equal(created.proximaAccion,'=Llamar a María; revisar <acta>');
  assert.equal(created.fechaSeguimiento,'2026-11-03');
  await page.reload();await page.locator('[data-pview="'+created.id+'"]').click();
  assert.equal(await page.locator('[name=proximaAccion]').inputValue(),created.proximaAccion);
  assert.equal(await page.locator('[name=fechaSeguimiento]').isDisabled(),true);
  await page.screenshot({path:path.join(out,'followup-desktop.png'),fullPage:true});
  await page.locator('#pCancel').click();
  // Search and sorting include follow-up fields; Excel uses the same search data.
  await page.evaluate(async()=>{pFilters.q='Llamar a María';await renderPending();});
  assert.equal(await page.locator('[data-pview]').count(),1);
  await page.evaluate(async()=>{pFilters.q='';pFilters.sort='fechaSeguimiento';pFilters.direction='desc';await renderPending();});
  assert.equal(await page.locator('[data-pview]').first().getAttribute('data-pview'),'future');
  await page.evaluate(async()=>{pFilters.q='Llamar a María';await renderPending();});
  await page.locator('.nav[data-page=excel]').click();await page.locator('[value=filtered]').check();
  const getExcel=async(name)=>{
   const event=page.waitForEvent('download');await page.locator('#excelDownload').click();
   const file=await event;const target=path.join(out,name);await file.saveAs(target);
   const zip=await JSZip.loadAsync(fs.readFileSync(target));
   return {summary:await zip.file('xl/worksheets/sheet1.xml').async('string'),data:await zip.file('xl/worksheets/sheet2.xml').async('string')};
  };
  const filtered=await getExcel('filtered.xlsx');
  assert.ok(filtered.data.includes('Próxima acción'));assert.ok(filtered.data.includes('Fecha de seguimiento'));
  assert.ok(filtered.data.includes("&apos;=Llamar a María; revisar &lt;acta&gt;"));
  assert.ok(filtered.data.includes('<autoFilter ref="A1:W2"/>'));
  assert.match(filtered.data,/<c r="M2" s="3"><v>\d+<\/v><\/c>/);
  const metric=(xml,label)=>{
   const row=xml.match(/<row\b[^>]*>.*?<\/row>/g).find(r=>r.includes(label));
   assert.ok(row,label);return Number(row.match(/<v>([^<]+)<\/v>/)[1]);
  };
  assert.equal(metric(filtered.summary,'Asuntos exportados'),1);
  assert.equal(metric(filtered.summary,'Seguimientos vencidos (abiertos)'),1);
  assert.equal(metric(filtered.summary,'Seguimientos próximos (hoy a 7 días)'),0);
  await page.locator('[value=all]').check();const all=await getExcel('all.xlsx');
  assert.equal(metric(all.summary,'Asuntos exportados'),8);
  assert.equal(metric(all.summary,'Seguimientos vencidos (abiertos)'),2);
  assert.equal(metric(all.summary,'Seguimientos próximos (hoy a 7 días)'),2);
  await page.locator('.nav[data-page=tablero]').click();
  assert.match(await page.locator('.dash-metric').filter({hasText:'Seguimientos vencidos'}).innerText(),/\b2\b/);
  assert.match(await page.locator('.dash-metric').filter({hasText:'Seguimientos próximos'}).innerText(),/\b2\b/);
  // Export a real JSON backup, validate optional-field types, then restore through the UI.
  await page.locator('.nav[data-page=configuracion]').click();
  const jsonEvent=page.waitForEvent('download');await page.locator('#cfgExport').click();
  const jsonFile=await jsonEvent;const jsonPath=path.join(out,'backup.json');await jsonFile.saveAs(jsonPath);
  const payload=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
  assert.equal(payload.datos.pendientes.find(p=>p.id===created.id).proximaAccion,created.proximaAccion);
  const validation=await page.evaluate(payload=>{
   const valid=cfgValidate(payload);const p=valid.pendientes.find(p=>p.id!=='legacy');
   const check=(key,value)=>{const copy=structuredClone(payload);copy.datos.pendientes.find(x=>x.id===p.id)[key]=value;try{cfgValidate(copy);return false;}catch{return true;}};
   return [check('fechaSeguimiento','2026-02-30'),check('fechaSeguimiento',42),check('proximaAccion',{}),check('proximaAccion','x'.repeat(2001)),!!valid.pendientes.find(x=>x.id==='legacy')];
  },payload);
  assert.deepEqual(validation,[true,true,true,true,true]);
  await page.evaluate(async id=>{const item=(await pAll()).find(p=>p.id===id);await pSave({...item,proximaAccion:'Cambió',fechaSeguimiento:''});},created.id);
  await page.locator('#cfgFile').setInputFiles(jsonPath);
  page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?'FUSIONAR':undefined));
  await page.locator('#cfgCommit').click();await page.waitForFunction(()=>document.getElementById('cfgStatus').textContent.includes('Importación completada'));
  assert.equal(await page.evaluate(async id=>(await pAll()).find(p=>p.id===id).proximaAccion,created.id),created.proximaAccion);
  await page.locator('.nav[data-page=pendientes]').click();
  await page.evaluate(async()=>{pFilters.q='';await renderPending();});
  await page.locator('[data-pedit="'+created.id+'"]').click();
  await page.locator('[name=proximaAccion]').fill('');await page.locator('[name=fechaSeguimiento]').fill('');
  await page.locator('#pForm [type=submit]').click();await page.locator('#pDialog').waitFor({state:'hidden'});
  const cleared=await page.evaluate(async id=>(await pAll()).find(p=>p.id===id),created.id);
  assert.equal(cleared.proximaAccion,'');assert.equal(cleared.fechaSeguimiento,'');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-pview="legacy"]').click();
  assert.ok(await page.locator('[name=fechaSeguimiento]').isVisible());
  await page.screenshot({path:path.join(out,'followup-mobile.png'),fullPage:true});await page.locator('#pCancel').click();
  assert.deepEqual(errors,[]);
  console.log('PASS: alta, edición, consulta, persistencia, búsqueda, XLSX total/filtrado y fechas numéricas, conteos, JSON exportación/restauración y compatibilidad anterior.');
  console.log('OUTPUT_DIR='+out);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
