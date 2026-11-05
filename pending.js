'use strict';
const P_FIELDS=['Fecha Registro','Prioridad','Categoría','Descripción','Responsable','Apoyo','Fecha Límite','Estado','Avance','Última Gestión','Observaciones','Próxima acción','Fecha de seguimiento','Fecha de cierre','Resultado del cierre','Motivo de cancelación','Condición','Fecha de archivo','Días sin gestión','Sin movimiento'];
const P_KEYS=['fechaRegistro','prioridad','categoria','descripcion','responsable','apoyo','fechaLimite','estado','avance','ultimaGestion','observaciones','proximaAccion','fechaSeguimiento','fechaCierre','resultadoCierre','motivoCancelacion','archivado','archivadoEn','diasSinGestion','sinMovimiento'];
const P_SUMMARY_FIELDS=['Descripción','Responsable','Prioridad','Estado'];
const P_SUMMARY_KEYS=['descripcion','responsable','prioridad','estado'];
const pFilters={archivo:'activos',movimiento:'',q:'',prioridad:'',categoria:'',responsable:'',estado:'',sort:'fechaRegistro',direction:'desc'};
const pEscape=s=>escapeHtml(s??'');
// Accept legacy single assignments without rewriting existing records.
const pSupportIds=value=>Array.isArray(value)?value:(value?[value]:[]);
const pSupportLabels=(value,labels)=>pSupportIds(value).map(id=>labels.get(id)||'[Referencia no disponible]').join(', ');
const pSupportCheckbox=(helper,selected)=>`<label><input type="checkbox" name="apoyo" value="${pEscape(helper.id)}" ${selected?'checked':''}>${pEscape(helper.nombre)}${helper.activo===false?' (inactivo)':''}</label>`;

const pToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const pDate=s=>s&&/^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'';
const pValidDate=s=>{if(!s)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !Number.isNaN(d.getTime())&&d.getFullYear()===+s.slice(0,4)&&d.getMonth()+1===+s.slice(5,7)&&d.getDate()===+s.slice(8,10);};
const P_INACTIVITY_KEY='cfg-inactivity-days',P_INACTIVITY_DEFAULT=14;
async function pInactivityLimit(){const value=await cfgMeta(P_INACTIVITY_KEY);return Number.isInteger(value)&&value>=1&&value<=365?value:P_INACTIVITY_DEFAULT;}
function pWithLatestGestiones(items,gestiones){
 const latest=new Map();for(const g of gestiones)if(g.fecha&&pValidDate(g.fecha)&&(!latest.has(g.pendienteId)||g.fecha>latest.get(g.pendienteId)))latest.set(g.pendienteId,g.fecha);
 return items.map(p=>({...p,ultimaGestion:latest.get(p.id)||''}));
}
function pInactivity(item,today=pToday(),limit=P_INACTIVITY_DEFAULT){
 if(item.archivado||!['Pendiente','En proceso','En espera'].includes(item.estado))return {diasSinGestion:null,sinMovimiento:'No aplica'};
 const base=item.ultimaGestion||item.fechaRegistro;
 if(!base||!pValidDate(base))return {diasSinGestion:null,sinMovimiento:'Sin datos'};
 if(base>today)return {diasSinGestion:null,sinMovimiento:'Fecha futura'};
 const days=Math.round((new Date(today+'T00:00:00Z')-new Date(base+'T00:00:00Z'))/86400000);
 return {diasSinGestion:days,sinMovimiento:days>=limit?'Sí':'No'};
}
async function pInactivityRender(dialog,item){
 const target=dialog.querySelector('#pInactivity');if(!target)return;
 const sequence=String((Number(target.dataset.sequence)||0)+1);target.dataset.sequence=sequence;
 try{const [gestiones,limit]=await Promise.all([gAll(),pInactivityLimit()]);if(!target.isConnected||target.dataset.sequence!==sequence)return;const current=pWithLatestGestiones([item],gestiones)[0],result=pInactivity(current,pToday(),limit);
 target.textContent=`Movimiento: ${result.sinMovimiento} · Días sin gestión: ${result.diasSinGestion??'No evaluable'} · Plazo: ${limit} días. Base: ${current.ultimaGestion?'última gestión':'Fecha Registro'}.`;
 }catch{target.textContent='No se pudo calcular el movimiento del pendiente.';}
}
const pArchiveMatches=(item,scope='activos')=>scope==='todos'||(scope==='archivados'?!!item.archivado:!item.archivado);
function pSearchText(item,labels,limit,today=pToday()){
 const movement=pInactivity(item,today,limit);
 return [...P_KEYS.map(key=>key==='archivado'?(item.archivado?'Archivado':'Activo'):key==='archivadoEn'?(item.archivado?(item.archivadoEn||'Sin registro'):''):Object.hasOwn(movement,key)?movement[key]:item[key]),...['categoria','responsable','apoyo'].map(key=>key==='apoyo'?pSupportLabels(item[key],labels):labels.get(item[key])||(item[key]?'[Referencia no disponible]':''))].join(' ').toLocaleLowerCase('es');
}
async function pSetArchived(id,archivado){
 await pSave({id,archivado,archivadoEn:archivado?new Date().toISOString():'',modificado:new Date().toISOString()},{fields:['archivado','archivadoEn','modificado']});
}
// Delete related data atomically; keep source reminders without a broken link.
function pDelete(id){return new Promise((resolve,reject)=>{
 const tx=db.transaction(['pendientes','gestiones','recordatorios'],'readwrite');
 tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('No se pudo borrar el pendiente.'));tx.onabort=()=>reject(tx.error||Error('Se canceló el borrado.'));
 tx.objectStore('pendientes').delete(id);
 const gestiones=tx.objectStore('gestiones').openCursor();gestiones.onsuccess=()=>{const cursor=gestiones.result;if(!cursor)return;if(cursor.value.pendienteId===id)cursor.delete();cursor.continue();};
 const reminders=tx.objectStore('recordatorios').openCursor();reminders.onsuccess=()=>{const cursor=reminders.result;if(!cursor)return;if(cursor.value.pendienteId===id){const record={...cursor.value,modificado:new Date().toISOString()};delete record.pendienteId;cursor.update(record);}cursor.continue();};
});}
function pAll(){return new Promise((resolve,reject)=>{const r=db.transaction('pendientes').objectStore('pendientes').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
const P_HISTORY_FIELDS=Object.freeze({responsable:'Responsable',prioridad:'Prioridad',estado:'Estado',fechaRegistro:'Fecha Registro',fechaLimite:'Fecha Límite',fechaSeguimiento:'Fecha de seguimiento',proximaAccion:'Próxima acción',archivado:'Archivado',archivadoEn:'Fecha de archivo',fechaCierre:'Fecha de cierre',resultadoCierre:'Resultado del cierre',motivoCancelacion:'Motivo de cancelación'});
const pHistoryValue=(item,key)=>key==='archivado'?(item[key]?'Sí':'No'):String(item[key]??'');
function pHistoryChanges(previous,next,catalogs,fecha=new Date().toISOString()){
 if(!previous)return [];
 const labels=new Map(catalogs.map(c=>[c.id,c.nombre]));
 const text=(key,value)=>key==='responsable'?(value?(labels.get(value)||'[Referencia no disponible]'):'Sin asignar'):value;
 return Object.keys(P_HISTORY_FIELDS).flatMap(campo=>{
  const anterior=pHistoryValue(previous,campo),nuevo=pHistoryValue(next,campo);
  return anterior===nuevo?[]:[{id:makeId(),fecha,campo,anterior,nuevo,anteriorTexto:text(campo,anterior),nuevoTexto:text(campo,nuevo)}];
 });
}
function pHistoryMerge(current=[],incoming=[]){
 const entries=new Map(current.map(entry=>[entry.id,entry]));
 for(const entry of incoming){const old=entries.get(entry.id);if(old&&['fecha','campo','anterior','nuevo','anteriorTexto','nuevoTexto'].some(key=>old[key]!==entry[key]))throw Error('Conflicto en historial de cambios: '+entry.id);entries.set(entry.id,entry);}
 return [...entries.values()].sort((a,b)=>a.fecha.localeCompare(b.fecha));
}
const pClosed=p=>['Finalizado','Cancelado'].includes(p?.estado);
const P_CLOSURE_KEYS=['estado','fechaCierre','resultadoCierre','motivoCancelacion','fechaRegistro','fechaLimite'];
function pClosureMerge(current=[],incoming=[]){
 const entries=new Map(current.map(entry=>[entry.id,entry]));
 for(const entry of incoming){const old=entries.get(entry.id);if(old&&['registradoEn','accion',...P_CLOSURE_KEYS].some(key=>old[key]!==entry[key]))throw Error('Conflicto en historial de cierres: '+entry.id);entries.set(entry.id,entry);}
 return [...entries.values()].sort((a,b)=>a.registradoEn.localeCompare(b.registradoEn));
}
function pClosureCurrentSnapshot(item){
 return [...(item.historialCierres||[])].reverse().find(h=>h.accion!=='Reapertura'&&['estado','fechaCierre','resultadoCierre','motivoCancelacion'].every(key=>h[key]===String(item[key]??'')))||item;
}
function pClosurePrepare(previous,next){
 const history=[...(previous?.historialCierres||[])];
 const snapshot=(source,accion)=>({id:makeId(),registradoEn:new Date().toISOString(),accion,...Object.fromEntries(P_CLOSURE_KEYS.map(key=>[key,String(source[key]??'')]))});
 const fields=['fechaCierre','resultadoCierre','motivoCancelacion'];
 for(const key of fields)next[key]=String(next[key]??'').trim();
 if(!pClosed(next)){
  if(pClosed(previous)&&previous.fechaCierre)history.push(snapshot(pClosureCurrentSnapshot(previous),'Reapertura'));
  for(const key of fields)next[key]='';
 }else{
  const changed=!previous||previous.estado!==next.estado||fields.some(key=>String(previous[key]??'')!==next[key]);
  // An unchanged legacy closure may retain its missing data until explicitly completed.
  if(changed){
   if(!next.fechaCierre||!pValidDate(next.fechaCierre)||next.fechaCierre<next.fechaRegistro||next.fechaCierre>pToday())throw Error('Indica una fecha de cierre válida, entre la Fecha Registro y hoy.');
   if(next.resultadoCierre.length>2000||next.motivoCancelacion.length>2000)throw Error('El resultado y el motivo admiten hasta 2000 caracteres.');
   if(next.estado==='Finalizado'){
    if(!next.resultadoCierre)throw Error('Indica el resultado para finalizar el pendiente.');
    next.motivoCancelacion='';
   }else{
    if(!next.motivoCancelacion)throw Error('Indica el motivo para cancelar el pendiente.');
    next.resultadoCierre='';
   }
   const correction=pClosed(previous)&&previous.estado===next.estado;
   const original=correction?pClosureCurrentSnapshot(previous):next;
   history.push(snapshot({...next,fechaRegistro:original.fechaRegistro,fechaLimite:original.fechaLimite},correction?'Corrección':'Cierre'));
  }
 }
 next.historialCierres=history;
 return next;
}
function pClosureValidate(item){
 const fail=()=>{throw Error('Datos de cierre o historial de cierres inválidos.');};
 const valid=(p,required=false)=>{
  for(const key of ['fechaCierre','resultadoCierre','motivoCancelacion'])if(p[key]!==undefined&&(typeof p[key]!=='string'||p[key].length>(key==='fechaCierre'?10:2000)))fail();
  if(!p.fechaCierre){if(required||p.resultadoCierre||p.motivoCancelacion)fail();return;}
  if(!pClosed(p)||!pValidDate(p.fechaCierre)||!p.fechaRegistro||!pValidDate(p.fechaRegistro)||p.fechaCierre<p.fechaRegistro)fail();
  if(p.estado==='Finalizado'&&(!p.resultadoCierre?.trim()||p.motivoCancelacion)||p.estado==='Cancelado'&&(!p.motivoCancelacion?.trim()||p.resultadoCierre))fail();
 };
 valid(item);
 if(item.historialCierres!==undefined){
  if(!Array.isArray(item.historialCierres)||item.historialCierres.length>100000)fail();
  const ids=new Set();for(const h of item.historialCierres){
   if(!h||typeof h!=='object'||Array.isArray(h)||typeof h.id!=='string'||!h.id.trim()||h.id.length>250||ids.has(h.id)||!['Cierre','Corrección','Reapertura'].includes(h.accion)||typeof h.registradoEn!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(h.registradoEn)||Number.isNaN(Date.parse(h.registradoEn))||new Date(h.registradoEn).toISOString()!==h.registradoEn||typeof h.fechaLimite!=='string'||!pValidDate(h.fechaLimite))fail();
   valid(h,true);ids.add(h.id);
  }
 }
}
function pClosureMetrics(item){
 if(!pClosed(item))return {dias:null,cumplimiento:'No aplica'};
 if(!item.fechaCierre||!pValidDate(item.fechaCierre))return {dias:null,cumplimiento:'Sin datos de cierre'};
 const snapshot=pClosureCurrentSnapshot(item);
 const days=snapshot.fechaRegistro&&pValidDate(snapshot.fechaRegistro)?Math.round((new Date(item.fechaCierre+'T00:00:00Z')-new Date(snapshot.fechaRegistro+'T00:00:00Z'))/86400000):null;
 return {dias:days,cumplimiento:item.estado==='Cancelado'?'No aplica':!snapshot.fechaLimite?'Sin Fecha Límite':item.fechaCierre<=snapshot.fechaLimite?'En plazo':'Fuera de plazo'};
}
function pClosureRender(dialog,item){
 const target=dialog.querySelector('#pClosures');if(!target)return;
 const entries=[...(item.historialCierres||[])].reverse();
 target.innerHTML='<h3>Cierres y reaperturas</h3>'+(entries.length?entries.map(h=>`<article class="gestion-entry"><div class="gestion-entry-head"><strong>${pEscape(h.accion)} · ${pEscape(h.estado)}</strong><small>${pEscape(cfgDate(h.registradoEn))}</small></div><p><b>Fecha de cierre:</b> ${pEscape(pDate(h.fechaCierre))}</p><p>${pEscape(h.resultadoCierre||h.motivoCancelacion)}</p><p class="pending-note">Fecha Registro: ${pEscape(pDate(h.fechaRegistro))} · Plazo al cerrar: ${pEscape(pDate(h.fechaLimite)||'Sin fecha')}</p></article>`).join(''):'<p class="pending-note">No hay cierres registrados desde la incorporación de esta función.</p>');
}
function pClosureForm(form,item,readonly){
 const sync=()=>{
  const state=form.elements.estado.value,closed=['Finalizado','Cancelado'].includes(state);
  const legacy=item&&item.estado===state&&!item.fechaCierre&&!item.resultadoCierre&&!item.motivoCancelacion;
  form.querySelector('#pClosureFields').hidden=!closed;
  for(const [name,enabled] of [['fechaCierre',closed],['resultadoCierre',state==='Finalizado'],['motivoCancelacion',state==='Cancelado']]){
   const input=form.elements[name];input.closest('label').hidden=!enabled;input.disabled=readonly||!enabled;input.required=!readonly&&enabled&&!legacy;
  }
  if(!readonly&&closed&&(!item||state!==item.estado)&&!form.elements.fechaCierre.value)form.elements.fechaCierre.value=pToday();
 };
 form.elements.estado.addEventListener('change',sync);sync();
}
function pSave(item,{fields=null}={}){return new Promise((resolve,reject)=>{
 const tx=db.transaction(['pendientes','catalogos'],'readwrite'),store=tx.objectStore('pendientes');let failure;
 const request=store.get(item.id);
 request.onsuccess=()=>{
  const previous=request.result,catalogs=tx.objectStore('catalogos').getAll();
  catalogs.onsuccess=()=>{try{
   const archiveOperation=fields&&fields.includes('archivado');
   if(archiveOperation&&!previous)throw Error('El pendiente ya no está disponible.');
   if(archiveOperation&&!!previous.archivado===!!item.archivado)return;
   if(previous?.archivado&&!archiveOperation&&(!fields||fields.some(key=>!['ultimaGestion','modificado'].includes(key))))throw Error('Restaura el pendiente archivado antes de editarlo.');
   const next=fields&&previous?{...previous,...Object.fromEntries(fields.map(key=>[key,item[key]]))}:{...item};
   pClosurePrepare(previous,next);pClosureValidate(next);
   next.historialCambios=[...(previous?.historialCambios||[]),...pHistoryChanges(previous,next,catalogs.result)];
   store.put(next);
  }catch(error){failure=error;tx.abort();}};
 };
 tx.oncomplete=()=>{window.dispatchEvent(new Event('sglsn-data-changed'));resolve();};
 tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error||Error('No se pudo guardar el pendiente.'));
});}
function pHistoryRender(dialog,item){
 const target=dialog.querySelector('#pHistory');if(!target)return;
 const value=(key,text)=>text?(key==='archivadoEn'?cfgDate(text):['fechaRegistro','fechaLimite','fechaSeguimiento','fechaCierre'].includes(key)?pDate(text):text):'Sin valor';
 const entries=[...(item.historialCambios||[])].reverse();
 target.innerHTML='<h3>Historial de cambios</h3><p class="pending-note">Cambios registrados desde la incorporación de esta función · más recientes primero.</p>'+(entries.length?entries.map(entry=>`<article class="gestion-entry"><div class="gestion-entry-head"><strong>${pEscape(P_HISTORY_FIELDS[entry.campo])}</strong><small>${pEscape(cfgDate(entry.fecha))}</small></div><p><b>Anterior:</b> ${pEscape(value(entry.campo,entry.anteriorTexto))}</p><p><b>Nuevo:</b> ${pEscape(value(entry.campo,entry.nuevoTexto))}</p></article>`).join(''):'<p class="pending-note">No hay cambios registrados.</p>');
}

function gAll(){return new Promise((resolve,reject)=>{const r=db.transaction('gestiones').objectStore('gestiones').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
function gWrite(record,remove=false){return new Promise((resolve,reject)=>{
 const tx=db.transaction(['gestiones','pendientes'],'readwrite'),store=tx.objectStore('gestiones');let failure;
 const parent=tx.objectStore('pendientes').get(record.pendienteId);
 parent.onsuccess=()=>{if(!parent.result||parent.result.archivado){failure=Error('Restaura el pendiente antes de modificar sus gestiones.');tx.abort();return;}if(remove)store.delete(record.id);else store.put(record);};
 tx.oncomplete=()=>{window.dispatchEvent(new Event('sglsn-data-changed'));resolve();};tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error||Error('No se pudo guardar la gestión.'));
});}
function gSorted(items){return [...items].sort((a,b)=>(String(b.fecha||'')+'T'+String(b.hora||'')).localeCompare(String(a.fecha||'')+'T'+String(a.hora||''))||String(b.creado||'').localeCompare(String(a.creado||'')));}
function gLatest(items){return gSorted(items)[0]?.fecha||'';}
function gTime(x){return x.hora?' · '+x.hora:'';}
async function gSync(pendingId){const [all,gestiones]=await Promise.all([pAll(),gAll()]);const item=all.find(x=>x.id===pendingId);if(!item)return;const last=gLatest(gestiones.filter(g=>g.pendienteId===pendingId));if(item.ultimaGestion!==last)await pSave({...item,ultimaGestion:last,modificado:new Date().toISOString()},{fields:['ultimaGestion','modificado']});}
// Fecha de seguimiento independiente del plazo final: hoy y los siguientes 7 días son próximos.
function pFollowupStatus(p,today=pToday()){
 if(p.archivado||!['Pendiente','En proceso','En espera'].includes(p.estado)||!p.fechaSeguimiento||!pValidDate(p.fechaSeguimiento))return 'normal';
 if(p.fechaSeguimiento<today)return 'vencido';
 const days=Math.round((new Date(p.fechaSeguimiento+'T12:00:00')-new Date(today+'T12:00:00'))/86400000);
 return days<=7?'proximo':'normal';
}
function pStatus(p){if(p.archivado||['Finalizado','Cancelado'].includes(p.estado)||!p.fechaLimite)return '';const days=Math.ceil((new Date(p.fechaLimite+'T12:00:00')-new Date(pToday()+'T12:00:00'))/86400000);return days<0?'overdue':days<=7?'soon':'';}
// Exportación individual de pendientes como eventos de todo el día.
const P_CALENDAR_PRIORITIES=Object.freeze({
 'Crítica':{number:1,color:'purple'},'Alta':{number:2,color:'red'},
 'Media':{number:5,color:'yellow'},'Baja':{number:9,color:'green'}
});
function pCalendarEscape(value){return String(value??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function pCalendarFold(line){
 const encoder=new TextEncoder();let result='',part='',size=0;
 for(const char of line){const bytes=encoder.encode(char).length;if(size+bytes>75){result+=part+'\r\n';part=' ';size=1;}part+=char;size+=bytes;}
 return result+part;
}
function pCalendarFile(item,responsible,now=new Date()){
 if(!item.fechaLimite||!pValidDate(item.fechaLimite))throw new Error('Completa una Fecha Límite válida antes de agregar el pendiente al calendario.');
 const end=new Date(item.fechaLimite+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
 const endDate=end.toISOString().slice(0,10).replace(/-/g,'');
 if(!/^\d{8}$/.test(endDate))throw new Error('La Fecha Límite está fuera del rango permitido para el calendario.');
 const description=String(item.descripcion||'').trim();
 const title=Array.from(description.split(/\r\n|\r|\n/)[0]||'Pendiente').slice(0,120).join('');
 const priority=P_CALENDAR_PRIORITIES[item.prioridad]||P_CALENDAR_PRIORITIES.Media;
 const details=[description,'','Responsable: '+(responsible||'Sin asignar'),'Prioridad: '+(item.prioridad||'Media'),...(item.proximaAccion?['Próxima acción: '+item.proximaAccion]:[]),...(item.fechaSeguimiento?['Fecha de seguimiento: '+pDate(item.fechaSeguimiento)]:[])].join('\n');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SGLSN//Gestion de Pendientes//ES','CALSCALE:GREGORIAN','BEGIN:VEVENT',
  'UID:'+encodeURIComponent(item.id)+'@pendientes.sglsn',
  'DTSTAMP:'+now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),
  'DTSTART;VALUE=DATE:'+item.fechaLimite.replace(/-/g,''),'DTEND;VALUE=DATE:'+endDate,
  'SUMMARY:'+pCalendarEscape(title),'DESCRIPTION:'+pCalendarEscape(details),
  'PRIORITY:'+priority.number,'CATEGORIES:'+pCalendarEscape(item.prioridad||'Media'),'COLOR:'+priority.color,
  'TRANSP:TRANSPARENT','END:VEVENT','END:VCALENDAR'];
 return lines.map(pCalendarFold).join('\r\n')+'\r\n';
}
function pCalendarDownload(item,people){
 try{
  const responsible=people.find(person=>person.id===item.responsable)?.nombre||(item.responsable?'[Referencia no disponible]':'Sin asignar');
  const content=pCalendarFile(item,responsible);
  const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='Pendiente-'+item.fechaLimite+'-'+String(item.id).replace(/[^a-zA-Z0-9_-]/g,'_')+'.ics';
  document.body.append(link);try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 }catch(error){alert(error.message||'No se pudo preparar el archivo de calendario.');}
}
const P_PAGE_SIZE=10;
let pPage=1,pPageFilterKey='',pMoreFiltersOpen=false,pRenderSequence=0;
async function renderPending(){const sequence=++pRenderSequence;const root=document.getElementById('view');if(!root||!db)return;if(!root.dataset.pendingRoot){root.innerHTML='<div class="empty">Cargando pendientes…</div>';root.dataset.pendingRoot='yes';}const [all,gestiones,cats,people,helpers,inactivityLimit]=await Promise.all([pAll(),gAll(),catalogOptions('categorias',{includeInactive:true}),catalogOptions('responsables',{includeInactive:true}),catalogOptions('apoyos',{includeInactive:true}),pInactivityLimit()]);if(sequence!==pRenderSequence||!root.isConnected||document.querySelector('.nav.active')?.dataset.page!=='pendientes')return;
const reconciled=pWithLatestGestiones(all,gestiones);for(let i=0;i<all.length;i++)all[i].ultimaGestion=reconciled[i].ultimaGestion;const byId=new Map([...cats,...people,...helpers].map(x=>[x.id,x.nombre]));const label=id=>byId.get(id)|| (id?'[Referencia no disponible]':'');const active=all.filter(p=>pArchiveMatches(p,pFilters.archivo)).map(p=>({...p,...pInactivity(p,pToday(),inactivityLimit)}));const option=(items,value)=>'<option value="">Todos</option>'+items.map(x=>`<option value="${pEscape(x.id)}" ${x.id===value?'selected':''}>${pEscape(x.nombre)}</option>`).join('');
let filtered=active.filter(p=>(!pFilters.movimiento||p.sinMovimiento==='Sí')&&(!pFilters.prioridad||p.prioridad===pFilters.prioridad)&&(!pFilters.estado||p.estado===pFilters.estado)&&(!pFilters.categoria||p.categoria===pFilters.categoria)&&(!pFilters.responsable||p.responsable===pFilters.responsable)&&(!pFilters.q||pSearchText(p,byId,inactivityLimit).includes(pFilters.q.toLocaleLowerCase('es'))));const rank=x=>PRIORITIES.indexOf(x);filtered.sort((a,b)=>{let v=0;if(pFilters.sort==='prioridad')v=rank(a.prioridad)-rank(b.prioridad);else v=String(a[pFilters.sort]||'').localeCompare(String(b[pFilters.sort]||''));return (pFilters.direction==='asc'?1:-1)*v;});
const filterKey=JSON.stringify(pFilters);if(filterKey!==pPageFilterKey){pPage=1;pPageFilterKey=filterKey;}
const pageCount=Math.max(1,Math.ceil(filtered.length/P_PAGE_SIZE));pPage=Math.max(1,Math.min(pPage,pageCount));
const pageStart=(pPage-1)*P_PAGE_SIZE,pageItems=filtered.slice(pageStart,pageStart+P_PAGE_SIZE);
const moreFilterCount=[pFilters.archivo!=='activos',!!pFilters.prioridad,!!pFilters.categoria,!!pFilters.movimiento].filter(Boolean).length;
root.innerHTML=`<div class="pending-toolbar"><div><h2>Matriz de pendientes</h2><p class="pending-note">${filtered.length} de ${active.length} asuntos en ${pFilters.archivo==='activos'?'Activos':pFilters.archivo==='archivados'?'Archivados':'Todos'} · Archivar conserva gestiones e historiales.</p></div><button class="primary" id="pAdd">+ Agregar pendiente</button></div><div class="pending-filters pending-main-filters"><label>Buscar<input id="pQ" type="search" placeholder="Descripción, observaciones…" value="${pEscape(pFilters.q)}"></label><label>Responsable<select id="pPerson">${option(people,pFilters.responsable)}</select></label><label>Estado<select id="pState">${option(STATES.map(x=>({id:x,nombre:x})),pFilters.estado)}</select></label></div><details class="pending-more-filters" id="pMoreFilters" ${pMoreFiltersOpen?'open':''}><summary>Más filtros${moreFilterCount?' · '+moreFilterCount+' '+(moreFilterCount===1?'activo':'activos'):''}</summary><div class="pending-filters"><label>Mostrar<select id="pArchiveScope"><option value="activos" ${pFilters.archivo==='activos'?'selected':''}>Activos</option><option value="archivados" ${pFilters.archivo==='archivados'?'selected':''}>Archivados</option><option value="todos" ${pFilters.archivo==='todos'?'selected':''}>Todos</option></select></label><label>Prioridad<select id="pPriority">${option(PRIORITIES.map(x=>({id:x,nombre:x})),pFilters.prioridad)}</select></label><label>Categoría<select id="pCategory">${option(cats,pFilters.categoria)}</select></label><label>Movimiento<select id="pMovement"><option value="">Todos</option><option value="inactive" ${pFilters.movimiento==='inactive'?'selected':''}>Sin movimiento</option></select></label><label>Ordenar<select id="pSort"><option value="fechaRegistro" ${pFilters.sort==='fechaRegistro'?'selected':''}>Fecha registro</option><option value="fechaLimite" ${pFilters.sort==='fechaLimite'?'selected':''}>Fecha límite</option><option value="fechaSeguimiento" ${pFilters.sort==='fechaSeguimiento'?'selected':''}>Fecha seguimiento</option><option value="prioridad" ${pFilters.sort==='prioridad'?'selected':''}>Prioridad</option></select></label><label>Dirección<select id="pDirection"><option value="desc" ${pFilters.direction==='desc'?'selected':''}>Descendente</option><option value="asc" ${pFilters.direction==='asc'?'selected':''}>Ascendente</option></select></label></div></details><p class="pending-note">Selecciona «Ver» en Acciones para consultar la ficha completa. Rojo: vencido · Amarillo: vence en 7 días o menos. Sin movimiento: ${inactivityLimit} días o más sin gestiones; si no hay gestiones, desde Fecha Registro.</p><div class="pending-wrap" tabindex="0" aria-label="Tabla desplazable de pendientes"><table class="pending-table"><thead><tr><th>Acciones</th>${P_SUMMARY_FIELDS.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${filtered.length?pageItems.map(p=>`<tr class="${p.archivado?'pending-archived':pStatus(p)}"><td><select class="pending-action-select" data-paction="${pEscape(p.id)}" aria-label="Acciones del pendiente: ${pEscape(p.descripcion)}"><option value="">Seleccionar acción…</option><option value="ver">Ver</option>${p.archivado?'<option value="restaurar">Restaurar</option>':'<option value="editar">Editar</option><option value="calendario">Agregar al calendario</option><option value="archivar">Archivar</option>'}<option value="borrar">Borrar</option></select></td>${P_SUMMARY_KEYS.map(k=>`<td>${k==='descripcion'?`<span class="pending-description">${pEscape(p[k])}</span>`:pEscape(k==='responsable'?label(p[k]):p[k])}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${P_SUMMARY_FIELDS.length+1}">No hay pendientes que coincidan con los filtros.</td></tr>`}</tbody></table></div><nav class="pending-pagination" aria-label="Paginación de pendientes"><p class="pending-note" role="status">${filtered.length?`Mostrando ${pageStart+1}–${pageStart+pageItems.length} de ${filtered.length} resultados`:'0 resultados'} · Página ${pPage} de ${pageCount}</p><div><button type="button" id="pPrev" ${pPage===1?'disabled':''}>Anterior</button><button type="button" id="pNext" ${pPage===pageCount?'disabled':''}>Siguiente</button></div></nav><dialog class="pending-dialog" id="pDialog"></dialog>`;
const moreFilters=root.querySelector('#pMoreFilters');moreFilters.addEventListener('toggle',()=>{if(moreFilters.isConnected)pMoreFiltersOpen=moreFilters.open;});
const refresh=()=>{pMoreFiltersOpen=moreFilters.open;return renderPending();};
for(const [id,step] of [['pPrev',-1],['pNext',1]])root.querySelector('#'+id).onclick=()=>{pPage=Math.max(1,Math.min(pageCount,pPage+step));root.querySelector('#pPrev').disabled=true;root.querySelector('#pNext').disabled=true;refresh();};
for(const [id,key] of [['pArchiveScope','archivo'],['pMovement','movimiento'],['pPriority','prioridad'],['pCategory','categoria'],['pPerson','responsable'],['pState','estado'],['pSort','sort'],['pDirection','direction']])root.querySelector('#'+id).addEventListener('change',e=>{pFilters[key]=e.target.value;refresh();});let timer;root.querySelector('#pQ').addEventListener('input',e=>{pFilters.q=e.target.value;clearTimeout(timer);timer=setTimeout(()=>{refresh().then(()=>{const q=document.getElementById('pQ');q?.focus();q?.setSelectionRange(q.value.length,q.value.length);});},180);});root.querySelector('#pAdd').onclick=()=>pEditor(null,false,cats,people,helpers);root.querySelectorAll('[data-paction]').forEach(select=>select.onchange=async()=>{
 const action=select.value,item=all.find(p=>p.id===select.dataset.paction);
 select.value='';
 if(!item||!action)return;
 if(action==='ver'){pEditor(item,true,cats,people,helpers);return;}
 if(item.archivado&&!['restaurar','borrar'].includes(action))return;
 if(action==='editar'){pEditor(item,false,cats,people,helpers);return;}
 if(action==='calendario'){pCalendarDownload(item,people);return;}
 const confirmations={
  archivar:'¿Archivar este pendiente? Dejará de aparecer en la matriz activa, pero conservará su historial en IndexedDB.',
  restaurar:'¿Restaurar este pendiente? Volverá a Activos con sus gestiones, estado e historiales.',
  borrar:'¿Borrar definitivamente este pendiente?\n\n'+item.descripcion+'\n\nSe eliminarán también sus gestiones e historiales. Esta acción no se puede deshacer.'
 };
 if(!confirmations[action]||!confirm(confirmations[action]))return;
 select.disabled=true;
 try{
  if(action==='borrar')await pDelete(item.id);
  else await pSetArchived(item.id,action==='archivar');
  await refresh();
 }catch(error){select.disabled=false;alert('No se pudo '+({archivar:'archivar',restaurar:'restaurar',borrar:'borrar'}[action])+': '+error.message);}
});
if(rPendingRequest){const request=rPendingRequest;rPendingRequest=null;if(request.pendienteId){const existing=all.find(p=>p.id===request.pendienteId);if(existing)pEditor(existing,true,cats,people,helpers);else alert('El pendiente vinculado no está disponible.');}else pEditor(null,false,cats,people,helpers,{prefill:{descripcion:request.texto,prioridad:rPriority(request),categoria:request.categoria||''},reminderId:request.id});}
}
function pEditor(item,readonly,cats,people,helpers,options={}){if(item?.archivado)readonly=true;const dialog=document.getElementById('pDialog');if(!dialog)return;const opt=(items,selected,required=false)=>`<option value="">${required?'Seleccionar…':'Sin asignar'}</option>`+items.map(x=>`<option value="${pEscape(x.id)}" ${x.id===selected?'selected':''}>${pEscape(x.nombre)}${x.activo===false?' (inactivo)':''}</option>`).join('');const available=(items,id)=>items.filter(x=>x.activo!==false||x.id===id);const p=item||{fechaRegistro:pToday(),prioridad:'Media',categoria:'',descripcion:'',responsable:'',apoyo:'',fechaLimite:'',estado:'Pendiente',avance:0,ultimaGestion:'',observaciones:'',proximaAccion:'',fechaSeguimiento:'',...options.prefill};const gSectionMarkup=item?'<section class="gestion-section wide" id="gSection"><h3>Historial de Gestiones</h3><p class="pending-note">Gestiones del asunto · más reciente primero</p><div id="gList"></div><div id="gControls"></div></section>':'<p class="pending-note wide">Guarda primero el pendiente para registrar gestiones.</p>';dialog.innerHTML=`<h2>${readonly?'Consultar':item?'Editar':'Agregar'} pendiente</h2>${item?.archivado?`<p class="notice">Archivado · Fecha de archivo: ${pEscape(cfgDate(item.archivadoEn))}. Restaura el asunto desde la matriz para editarlo.</p>`:''}<form id="pForm" class="pending-form"><label>Fecha Registro<input name="fechaRegistro" type="date" required value="${pEscape(p.fechaRegistro)}"></label><label>Prioridad<select name="prioridad" required>${opt(PRIORITIES.map(x=>({id:x,nombre:x})),p.prioridad,true)}</select></label><label>Categoría<select name="categoria">${opt(available(cats,p.categoria),p.categoria)}</select></label><label class="wide">Descripción<textarea name="descripcion" maxlength="5000" required>${pEscape(p.descripcion)}</textarea></label><label>Responsable<select name="responsable">${opt(available(people,p.responsable),p.responsable)}</select></label><fieldset class="support-picker"><legend>Apoyos</legend><p class="pending-note">Puedes seleccionar varias personas.</p><div id="pSupportList">${helpers.filter(x=>x.activo!==false||pSupportIds(p.apoyo).includes(x.id)).map(x=>pSupportCheckbox(x,pSupportIds(p.apoyo).includes(x.id))).join('')||'<p class="pending-note" id="pSupportEmpty">No hay apoyos registrados.</p>'}</div>${readonly?'':'<button type="button" id="pSupportNew">+ Nuevo apoyo</button><select id="pSupportCreate" hidden aria-label="Crear apoyo"><option value=""></option></select>'}</fieldset><label>Fecha Límite<input name="fechaLimite" type="date" value="${pEscape(p.fechaLimite)}"></label><label>Estado<select name="estado" required>${opt(STATES.map(x=>({id:x,nombre:x})),p.estado,true)}</select></label><label>Avance (%)<input name="avance" type="number" min="0" max="100" step="1" required value="${pEscape(p.avance)}"></label><label>Última Gestión (automática)<input type="text" disabled value="${pEscape(pDate(p.ultimaGestion))}" aria-label="Última gestión calculada"></label><label class="wide">Observaciones<textarea name="observaciones" maxlength="6000">${pEscape(p.observaciones)}</textarea></label><label class="wide">Próxima acción<textarea name="proximaAccion" maxlength="2000" placeholder="¿Qué corresponde hacer ahora?">${pEscape(p.proximaAccion)}</textarea></label><label>Fecha de seguimiento<input name="fechaSeguimiento" type="date" value="${pEscape(p.fechaSeguimiento)}"></label><p class="pending-note">Seguimiento opcional e independiente de la Fecha Límite.</p><fieldset id="pClosureFields" class="wide"><legend>Datos de cierre</legend><p class="pending-note">Finalizar requiere resultado; cancelar requiere motivo. Los cierres se conservan al reabrir.</p><label>Fecha de cierre<input name="fechaCierre" type="date" max="${pToday()}" value="${pEscape(p.fechaCierre)}"></label><label>Resultado del cierre<textarea name="resultadoCierre" maxlength="2000">${pEscape(p.resultadoCierre)}</textarea></label><label>Motivo de cancelación<textarea name="motivoCancelacion" maxlength="2000">${pEscape(p.motivoCancelacion)}</textarea></label>${item&&pClosed(item)&&!item.fechaCierre?'<p class="pending-note">Cierre anterior sin datos registrados. Puedes completarlos sin inventar fechas.</p>':''}</fieldset><p class="pending-error" id="pError" role="alert"></p><div class="dialog-actions"><button type="button" id="pCancel">${readonly?'Cerrar':'Cancelar'}</button>${readonly?'':'<button class="primary" type="submit">Guardar pendiente</button>'}</div></form>${item?'<p class="pending-note" id="pInactivity"></p>':''}${gSectionMarkup}${item?'<section class="gestion-section" id="pHistory"></section><section class="gestion-section" id="pClosures"></section>':''}`;dialog.querySelector('#pCancel').onclick=()=>dialog.close();if(item){gRender(dialog,item.id);pHistoryRender(dialog,item);pClosureRender(dialog,item);pInactivityRender(dialog,item);}const form=dialog.querySelector('form');pClosureForm(form,item,readonly);if(!readonly){pCatalogSelect(dialog,form.elements.responsable,'responsables',people);const creator=dialog.querySelector('#pSupportCreate');pCatalogSelect(dialog,creator,'apoyos',helpers,record=>{dialog.querySelector('#pSupportEmpty')?.remove();dialog.querySelector('#pSupportList').insertAdjacentHTML('beforeend',pSupportCheckbox(record,true));creator.value='';});dialog.querySelector('#pSupportNew').onclick=()=>{creator.value='__nuevo__';creator.dispatchEvent(new Event('change'));};}if(readonly)form.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=true);form.onsubmit=async e=>{e.preventDefault();if(readonly)return;const formData=new FormData(form);const data=Object.fromEntries(formData);data.apoyo=formData.getAll('apoyo');const error=dialog.querySelector('#pError');data.descripcion=data.descripcion.trim();data.observaciones=data.observaciones.trim();data.proximaAccion=data.proximaAccion.trim();data.avance=Number(data.avance);if(!data.descripcion||data.descripcion.length>5000||data.proximaAccion.length>2000||!PRIORITIES.includes(data.prioridad)||!STATES.includes(data.estado)||!Number.isInteger(data.avance)||data.avance<0||data.avance>100||!data.fechaRegistro||!['fechaRegistro','fechaLimite','ultimaGestion','fechaSeguimiento'].every(k=>pValidDate(data[k]))){error.textContent='Revisa descripción, próxima acción (máximo 2000 caracteres), prioridad, estado, avance y fechas.';return;}for(const [key,list] of [['categoria',cats],['responsable',people]])if(data[key]&&!list.some(x=>x.id===data[key]&&(x.activo!==false||item?.[key]===data[key]||options.prefill?.[key]===data[key]))){error.textContent='Hay una referencia de catálogo no válida.';return;}if(data.apoyo.some(id=>!helpers.some(x=>x.id===id&&(x.activo!==false||pSupportIds(p.apoyo).includes(id))))){error.textContent='Hay un apoyo no válido.';return;}const save=form.querySelector('[type=submit]');if(save.disabled)return;save.disabled=true;try{const now=new Date().toISOString();const linked=item?(await gAll()).filter(g=>g.pendienteId===item.id):[];const record={...item,...data,ultimaGestion:gLatest(linked),id:item?.id||makeId(),creado:item?.creado||now,modificado:now,archivado:item?.archivado||false};if(options.reminderId)await rTransferSave(options.reminderId,pClosurePrepare(null,record));else await pSave(record);dialog.close();await renderPending();}catch(err){error.textContent='No se pudo guardar: '+err.message;save.disabled=false;}};dialog.showModal();}

async function gRender(dialog,pendingId){
 const section=dialog.querySelector('#gSection');if(!section)return;
 const allGestiones=await gAll(),items=gSorted(allGestiones.filter(g=>g.pendienteId===pendingId));
 const record=(await pAll()).find(p=>p.id===pendingId);if(record)pInactivityRender(dialog,record);
 if(!dialog.open)return;
 section.querySelector('#gList').innerHTML=items.length?items.map(g=>`<article class="gestion-entry"><div class="gestion-entry-head"><strong>${pEscape(pDate(g.fecha))}${pEscape(gTime(g))}</strong>${record?.archivado?'':`<span><button type="button" data-gedit="${pEscape(g.id)}">Editar</button> <button type="button" data-gdelete="${pEscape(g.id)}">Eliminar</button></span>`}</div><p>${pEscape(g.detalle)}</p>${g.observaciones?`<small>${pEscape(g.observaciones)}</small>`:''}</article>`).join(''):'<p class="pending-note">Todavía no hay gestiones registradas.</p>';
 const controls=section.querySelector('#gControls');if(record?.archivado){controls.innerHTML='<p class="pending-note">Restaura el pendiente para agregar o modificar gestiones.</p>';return;}controls.innerHTML='<button type="button" class="primary" id="gAdd">+ Agregar gestión</button><div id="gEditor"></div>';
 section.querySelector('#gAdd').onclick=()=>gEdit(dialog,pendingId,null);
 section.querySelectorAll('[data-gedit]').forEach(b=>b.onclick=()=>gEdit(dialog,pendingId,items.find(g=>g.id===b.dataset.gedit)));
 section.querySelectorAll('[data-gdelete]').forEach(b=>b.onclick=async()=>{const g=items.find(x=>x.id===b.dataset.gdelete);if(!g||!confirm('¿Eliminar esta gestión? Esta acción no se puede deshacer.'))return;try{await gWrite(g,true);await gSync(pendingId);await gRender(dialog,pendingId);}catch(e){alert('No se pudo eliminar la gestión: '+e.message);}});
}
function gEdit(dialog,pendingId,item){const target=dialog.querySelector('#gEditor');if(!target)return;target.innerHTML=`<div class="gestion-editor"><h4>${item?'Editar':'Agregar'} gestión</h4><form id="gForm"><div class="gestion-fields"><label>Fecha<input name="fecha" type="date" required value="${pEscape(item?.fecha||pToday())}"></label><label>Hora (opcional)<input name="hora" type="time" value="${pEscape(item?.hora||'')}"></label><label class="wide">Detalle obligatorio<textarea name="detalle" required maxlength="4000">${pEscape(item?.detalle||'')}</textarea></label><label class="wide">Observaciones (opcional)<textarea name="observaciones" maxlength="6000">${pEscape(item?.observaciones||'')}</textarea></label></div><p id="gError" class="pending-error" role="alert"></p><div class="dialog-actions"><button type="button" id="gCancel">Cancelar</button><button type="submit" class="primary">Guardar gestión</button></div></form></div>`;
 target.querySelector('#gCancel').onclick=()=>target.replaceChildren();
 target.querySelector('#gForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));data.detalle=data.detalle.trim();data.observaciones=data.observaciones.trim();if(!pValidDate(data.fecha)||!data.fecha||!data.detalle||data.hora&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.hora)){target.querySelector('#gError').textContent='Indica una fecha válida y un detalle obligatorio.';return;}if(item&&!confirm('¿Confirmas la modificación de esta gestión?'))return;const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;try{const now=new Date().toISOString();await gWrite({...item,...data,id:item?.id||makeId(),pendienteId:pendingId,creado:item?.creado||now,modificado:now});await gSync(pendingId);await gRender(dialog,pendingId);}catch(err){button.disabled=false;target.querySelector('#gError').textContent='No se pudo guardar: '+err.message;}};
}

// Alta de responsables y apoyos sin abandonar el formulario del pendiente.
function pCatalogSelect(parent,select,tipo,items,onCreated){
 const fresh=document.createElement('option');fresh.value='__nuevo__';fresh.textContent='Nuevo';select.append(fresh);
 let previous=select.value;
 select.addEventListener('change',()=>{
  if(select.value!==fresh.value){previous=select.value;return;}
  select.value=previous;
  const modal=document.createElement('dialog');modal.className='catalog-dialog';
  modal.innerHTML=`<form><h3>${tipo==='responsables'?'Nuevo responsable':'Nuevo apoyo'}</h3><label>Nombre<input name="nombre" maxlength="120" required autocomplete="off"></label><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button">Cancelar</button><button type="submit" class="primary">Guardar</button></div></form>`;
  document.body.append(modal);
  const form=modal.querySelector('form'),input=form.elements.nombre,error=modal.querySelector('.form-error'),save=form.querySelector('[type=submit]');
  const closeWithParent=()=>modal.close();parent.addEventListener('close',closeWithParent,{once:true});
  modal.addEventListener('close',()=>{parent.removeEventListener('close',closeWithParent);modal.remove();if(parent.open)select.focus();},{once:true});
  modal.querySelector('[type=button]').onclick=()=>modal.close();
  form.onsubmit=async e=>{
   e.preventDefault();const nombre=input.value.trim().replace(/\s+/g,' ');
   if(!nombre){error.textContent='El nombre es obligatorio.';return;}
   save.disabled=true;error.textContent='';
   try{
    const record={id:makeId(),tipo,nombre,activo:true,creado:new Date().toISOString()};
    await new Promise((resolve,reject)=>{
     const tx=db.transaction('catalogos','readwrite'),store=tx.objectStore('catalogos'),request=store.getAll();let duplicate=false;
     request.onsuccess=()=>{duplicate=request.result.some(x=>x.tipo===tipo&&normalizeName(x.nombre)===normalizeName(nombre));if(!duplicate)store.put(record);};
     tx.oncomplete=()=>duplicate?reject(new Error('Ya existe un registro con ese nombre (activo o inactivo).')):resolve();
     tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Guardado cancelado.'));
    });
    items.push(record);items.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
    const option=document.createElement('option');option.value=record.id;option.textContent=record.nombre;
    const next=Array.from(select.options).find(x=>x.value&&x!==fresh&&x.textContent.localeCompare(nombre,'es')>0);
    select.insertBefore(option,next||fresh);select.value=record.id;previous=record.id;if(onCreated)onCreated(record);modal.close();
   }catch(err){error.textContent='No se pudo guardar: '+err.message;}finally{save.disabled=false;}
  };
  modal.showModal();input.focus();
 });
}
