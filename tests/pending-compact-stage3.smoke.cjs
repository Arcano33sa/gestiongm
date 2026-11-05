const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;try{b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/#pendientes');await p.waitForSelector('#pAdd');await p.evaluate(async()=>{for(let i=1;i<=12;i++)await pSave({id:'visual-'+i,descripcion:('Descripción extensa del asunto para comprobar la visualización compacta. ').repeat(30)+'FIN COMPLETO',fechaRegistro:'2026-11-04',prioridad:'Alta',estado:'Pendiente',avance:0,apoyo:[],archivado:false});await renderPending();});
assert(!(await p.locator('#pMoreFilters').evaluate(el=>el.open)));
for(const id of ['pQ','pPerson','pState'])assert(await p.locator('#'+id).isVisible());
for(const id of ['pArchiveScope','pPriority','pCategory','pMovement','pSort','pDirection'])assert(!(await p.locator('#'+id).isVisible()));
await p.locator('#pMoreFilters summary').click();await p.locator('#pPriority').selectOption('Alta');await p.waitForFunction(()=>document.querySelector('#pMoreFilters summary').textContent.includes('1 activo'));
assert(await p.locator('#pMoreFilters').evaluate(el=>el.open));
await p.locator('#pMoreFilters summary').click();await p.locator('#pNext').click();await p.waitForFunction(()=>document.querySelector('.pending-pagination').textContent.includes('Página 2 de 2'));
assert(!(await p.locator('#pMoreFilters').evaluate(el=>el.open)));
assert.match(await p.locator('#pMoreFilters summary').innerText(),/1 activo/);
await p.locator('[data-paction]').first().selectOption('ver');await p.waitForSelector('#pForm');assert((await p.locator('[name=descripcion]').inputValue()).endsWith('FIN COMPLETO'));await p.locator('#pCancel').click();
await p.locator('#pPrev').click();await p.waitForFunction(()=>document.querySelectorAll('[data-paction]').length===10);
const screenshots=fs.mkdtempSync(path.join(require('os').tmpdir(),'gestiongm-compact-'));
for(const width of [1440,390]){
 await p.setViewportSize({width,height:900});
 const description=await p.locator('.pending-description').first().evaluate(el=>({height:el.clientHeight,lineHeight:parseFloat(getComputedStyle(el).lineHeight),fullHeight:el.scrollHeight}));
 assert(description.height<=description.lineHeight*2+1);assert(description.fullHeight>description.height);
 const sticky=await p.evaluate(()=>{const wrap=document.querySelector('.pending-wrap');wrap.scrollTop=160;const th=wrap.querySelector('th');return {overflow:wrap.scrollHeight>wrap.clientHeight,top:th.getBoundingClientRect().top,wrapTop:wrap.getBoundingClientRect().top};});
 assert(sticky.overflow);assert(Math.abs(sticky.top-sticky.wrapTop)<3);
 await p.locator('.pending-wrap').evaluate(el=>el.scrollTop=0);
 await p.screenshot({path:path.join(screenshots,width+'.png'),fullPage:true});
}
assert.deepEqual(errors,[]);console.log('PASS: filtros compactos, indicador activo, persistencia de despliegue, paginación, descripción completa en modal, dos líneas y encabezados fijos en escritorio/móvil. Capturas: '+screenshots);
}finally{if(b)await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
