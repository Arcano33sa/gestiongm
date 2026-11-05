const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;try{b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/#pendientes');await p.waitForSelector('#pAdd');await p.evaluate(async()=>{for(let i=1;i<=23;i++)await pSave({id:'page-'+i,descripcion:'Asunto '+String(i).padStart(2,'0'),fechaRegistro:'2026-11-'+String(i).padStart(2,'0'),prioridad:i<=12?'Alta':'Media',estado:'Pendiente',avance:0,apoyo:[],archivado:false});await renderPending();});
const rows=()=>p.locator('[data-paction]');
const status=()=>p.locator('.pending-pagination [role=status]');
const ids=()=>rows().evaluateAll(xs=>xs.map(x=>x.dataset.paction));
assert.equal(await rows().count(),10);assert(await p.locator('#pPrev').isDisabled());assert(!(await p.locator('#pNext').isDisabled()));
assert.match(await status().innerText(),/1–10 de 23.*Página 1 de 3/);
const first=await ids();await p.locator('#pNext').click();await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('Página 2 de 3'));
const second=await ids();assert.equal(second.length,10);assert(second.every(id=>!first.includes(id)));
await p.locator('#pNext').click();await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('Página 3 de 3'));
assert.equal(await rows().count(),3);assert(await p.locator('#pNext').isDisabled());assert.match(await status().innerText(),/21–23 de 23/);
// La consulta abre el registro correcto de la última página.
await rows().first().selectOption('ver');await p.waitForSelector('#pForm');assert.equal(await p.locator('[name=descripcion]').inputValue(),'Asunto 03');await p.locator('#pCancel').click();
await p.locator('#pPrev').click();await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('Página 2 de 3'));
await p.locator('#pMoreFilters summary').click();await p.locator('#pPriority').selectOption('Alta');await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('Página 1 de 2'));
assert.equal(await rows().count(),10);assert.match(await status().innerText(),/1–10 de 12/);
await p.locator('#pNext').click();await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('Página 2 de 2'));
assert.equal(await rows().count(),2);
// Reducir resultados desde la última página ajusta la página vigente.
await p.evaluate(async()=>{await pDelete('page-1');await pDelete('page-2');await renderPending();});
assert.match(await status().innerText(),/1–10 de 10.*Página 1 de 1/);assert(await p.locator('#pNext').isDisabled());
await p.locator('#pQ').fill('inexistente');await p.waitForFunction(()=>document.querySelector('.pending-pagination [role=status]').textContent.startsWith('0 resultados'));
assert.equal(await rows().count(),0);assert.equal(await p.locator('.pending-table tbody td').getAttribute('colspan'),'5');assert(await p.locator('#pPrev').isDisabled());assert(await p.locator('#pNext').isDisabled());
await p.locator('#pQ').fill('');await p.waitForFunction(()=>document.querySelectorAll('[data-paction]').length===10);
await p.locator('#pPriority').selectOption('');await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('de 21 resultados'));
await p.locator('#pNext').click();await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('Página 2 de 3'));
await p.locator('#pDirection').selectOption('asc');await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('Página 1 de 3'));
assert.equal((await ids())[0],'page-3');
const screenshots=fs.mkdtempSync(path.join(require('os').tmpdir(),'gestiongm-pagination-'));
for(const width of [1440,390]){await p.setViewportSize({width,height:900});assert(await p.locator('#pNext').isVisible());assert(await p.locator('#pPrev').isVisible());assert(await p.locator('.pending-pagination').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await p.screenshot({path:path.join(screenshots,width+'.png'),fullPage:true});}
await p.reload();await p.waitForSelector('#pAdd');assert.equal(await rows().count(),10);assert.match(await status().innerText(),/Página 1 de 3/);assert.deepEqual(errors,[]);
console.log('PASS: paginación 10/10/3, navegación, filtros, búsqueda vacía, orden, ajuste tras borrado, ficha, recarga y móvil. Capturas: '+screenshots);
}finally{if(b)await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
