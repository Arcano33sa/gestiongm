const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;try{b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/#pendientes');await p.waitForSelector('#pAdd');await p.evaluate(async()=>{await pSave({id:'layout-only',descripcion:'Mejoramiento de Liturgias',fechaRegistro:'2026-11-04',fechaLimite:'2026-12-31',prioridad:'Media',estado:'Pendiente',avance:30,apoyo:[],archivado:false});await renderPending();});assert.equal(await p.locator('.pending-table th').first().innerText(),'Acciones');assert.equal(await p.locator('.pending-table th').nth(1).innerText(),'Fecha Registro');const select=()=>p.locator('[data-paction="layout-only"]');
assert.deepEqual(await select().locator('option').evaluateAll(xs=>xs.map(x=>x.value)),['','ver','editar','calendario','archivar','borrar']);
await select().selectOption('ver');await p.waitForSelector('#pForm');assert.equal(await select().inputValue(),'');assert(await p.locator('[name=descripcion]').isDisabled());await p.locator('#pCancel').click();
await select().selectOption('editar');await p.waitForSelector('#pForm [type=submit]');assert(!(await p.locator('[name=descripcion]').isDisabled()));await p.locator('#pCancel').click();
p.once('dialog',d=>d.dismiss());await select().selectOption('borrar');assert.equal(await select().inputValue(),'');assert.equal(await select().count(),1);
p.once('dialog',d=>d.accept());await select().selectOption('archivar');await p.waitForFunction(()=>!document.querySelector('[data-paction="layout-only"]'));
await p.locator('#pArchiveScope').selectOption('archivados');await select().waitFor();assert.deepEqual(await select().locator('option').evaluateAll(xs=>xs.map(x=>x.value)),['','ver','restaurar','borrar']);
p.once('dialog',d=>d.accept());await select().selectOption('restaurar');await p.waitForFunction(()=>!document.querySelector('[data-paction="layout-only"]'));
await p.locator('#pArchiveScope').selectOption('activos');await select().waitFor();
const downloadPromise=p.waitForEvent('download');await select().selectOption('calendario');const download=await downloadPromise;
assert(download.suggestedFilename().endsWith('.ics'));const ics=fs.readFileSync(await download.path(),'utf8');assert(ics.includes('DTSTART;VALUE=DATE:20261231'));assert(ics.includes('Mejoramiento de Liturgias'));assert.equal(await select().inputValue(),'');
const screenshots=fs.mkdtempSync(path.join(require('os').tmpdir(),'gestiongm-selector-'));
for(const width of [1440,390]){
 await p.setViewportSize({width,height:900});
 const layout=await p.evaluate(()=>{const select=document.querySelector('[data-paction]'),wrap=document.querySelector('.pending-wrap');return {viewport:innerWidth,selectorWidth:select.offsetWidth,rowHeight:select.closest('tr').offsetHeight,visible:select.getBoundingClientRect().right<=innerWidth,horizontalScroll:wrap.scrollWidth>wrap.clientWidth};});
 assert(layout.visible);assert(layout.horizontalScroll);assert(layout.rowHeight<80);console.log(layout);await p.screenshot({path:path.join(screenshots,width+'.png'),fullPage:true});
}
await p.evaluate(async()=>{await gWrite({id:'linked-gestion',pendienteId:'layout-only',fecha:'2026-11-04',detalle:'Gestión de prueba'});});
p.once('dialog',d=>{assert(d.message().includes('definitivamente'));return d.accept();});await select().selectOption('borrar');await p.waitForFunction(()=>!document.querySelector('[data-paction="layout-only"]'));
assert(await p.evaluate(async()=>!(await pAll()).some(p=>p.id==='layout-only')&&!(await gAll()).some(g=>g.pendienteId==='layout-only')));
assert.equal(await p.locator('.pending-table tbody td').getAttribute('colspan'),'21');await p.reload();await p.waitForSelector('#pAdd');assert.equal(await select().count(),0);assert.deepEqual(errors,[]);
console.log('PASS: acciones, calendario, borrado y gestiones vinculadas, recarga, escritorio y móvil. Capturas: '+screenshots);
}finally{if(b)await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
