'use strict';
function rAll(){return new Promise((resolve,reject)=>{const request=db.transaction('recordatorios').objectStore('recordatorios').getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error);});}
function rWrite(record,remove=false){return new Promise((resolve,reject)=>{const tx=db.transaction('recordatorios','readwrite'),store=tx.objectStore('recordatorios');if(remove)store.delete(record.id);else store.put(record);tx.oncomplete=()=>{resolve();rCheckDue();};tx.onerror=tx.onabort=()=>reject(tx.error||Error('No se pudo guardar el recordatorio.'));});}
const rPriority=r=>PRIORITIES.includes(r.prioridad)?r.prioridad:'Media';
const rPriorityOptions=value=>PRIORITIES.map(p=>`<option value="${p}" ${p===value?'selected':''}>${p}</option>`).join('');
let rSearch='',rHistoryOpen=false;
const rSorted=items=>[...items].sort((a,b)=>PRIORITIES.indexOf(rPriority(a))-PRIORITIES.indexOf(rPriority(b))||b.creado.localeCompare(a.creado));
function rRows(items){return items.map(r=>`<article class="reminder-item"><div><p class="reminder-text">${escapeHtml(r.texto)}</p><small><span class="reminder-priority">${escapeHtml(rPriority(r))}</span> · ${escapeHtml(cfgDate(r.creado))}${r.resuelto?' · Resuelto'+(r.resueltoEn?' el '+escapeHtml(cfgDate(r.resueltoEn)):''):''}</small></div>${r.when?`<p class="reminder-schedule">Aviso: ${escapeHtml(cfgDate(r.when))}${!r.resuelto&&Date.parse(r.when)<=Date.now()?' · Vencido':''}</p>`:''}<div class="reminder-actions">${r.resuelto?`<button type="button" data-r-reopen="${escapeHtml(r.id)}">Reabrir</button>`:`<button type="button" data-r-resolve="${escapeHtml(r.id)}">Marcar resuelto</button><button type="button" data-r-edit="${escapeHtml(r.id)}">Editar</button>`}<button type="button" data-r-delete="${escapeHtml(r.id)}">Eliminar</button></div></article>`).join('');}
function rDashboard(items){const pending=rSorted(items.filter(r=>!r.resuelto));return `<section class="dash-panel reminder-panel" aria-label="Recordatorios pendientes"><div class="catalog-head"><h2>Recordatorios pendientes (${pending.length})</h2><a href="#recordatorios">Abrir Recordatorios</a></div><p class="dash-muted">Notas rápidas por atender · Todos los años</p>${pending.length?rRows(pending):'<p class="dash-muted">No hay recordatorios pendientes.</p>'}</section>`;}
function rBindActions(root,items,refresh){
 const run=async(button,action)=>{button.disabled=true;try{await action();await refresh();}catch(error){alert('No se pudo guardar el cambio: '+error.message);}finally{if(button.isConnected)button.disabled=false;}};
 root.querySelectorAll('[data-r-resolve]').forEach(b=>b.onclick=()=>{const r=items.find(x=>x.id===b.dataset.rResolve);if(r)run(b,()=>rWrite({...r,resuelto:true,resueltoEn:new Date().toISOString(),modificado:new Date().toISOString()}));});
 root.querySelectorAll('[data-r-reopen]').forEach(b=>b.onclick=()=>{const r=items.find(x=>x.id===b.dataset.rReopen);if(r)run(b,()=>{const reopened={...r,resuelto:false,modificado:new Date().toISOString()};delete reopened.resueltoEn;return rWrite(reopened);});});
 root.querySelectorAll('[data-r-delete]').forEach(b=>b.onclick=()=>{const r=items.find(x=>x.id===b.dataset.rDelete);if(r&&confirm('¿Eliminar este recordatorio definitivamente?'))run(b,()=>rWrite(r,true));});
 root.querySelectorAll('[data-r-edit]').forEach(b=>b.onclick=()=>{const r=items.find(x=>x.id===b.dataset.rEdit);if(r)rEdit(r,refresh);});
}
function rEdit(record,refresh){const dialog=document.createElement('dialog');dialog.className='catalog-dialog';dialog.innerHTML=`<form><h3>Editar recordatorio</h3><label>Nota<textarea name="texto" rows="5" maxlength="5000" required>${escapeHtml(record.texto)}</textarea></label><label>Fecha y hora del aviso (opcional)<input name="when" type="datetime-local" value="${escapeHtml(rLocalDate(record.when))}"></label><label>Prioridad<select name="prioridad">${rPriorityOptions(rPriority(record))}</select></label><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button">Cancelar</button><button class="primary" type="submit">Guardar</button></div></form>`;document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('button[type=button]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const texto=dialog.querySelector('textarea').value.trim(),button=dialog.querySelector('[type=submit]');if(!texto){dialog.querySelector('.form-error').textContent='Escribe una nota.';return;}button.disabled=true;try{const when=rDateValue(dialog.querySelector('[name=when]').value);await rWrite({...record,texto,when,notificado:when===record.when?record.notificado||'':'',prioridad:dialog.querySelector('[name=prioridad]').value,modificado:new Date().toISOString()});dialog.close();await refresh();}catch(error){dialog.querySelector('.form-error').textContent='No se pudo guardar: '+error.message;button.disabled=false;}};dialog.showModal();dialog.querySelector('textarea').focus();}
async function renderReminders(){
 const root=document.getElementById('view');if(!db)return;
 try{
  const all=await rAll();if(document.querySelector('.nav.active')?.dataset.page!=='recordatorios')return;
  root.innerHTML=`<section class="card"><h2>Apuntar algo rápido</h2><p>Guarda una idea ahora y atiéndela con calma después.</p><form id="reminderForm" class="reminder-form"><label for="reminderText">Nota</label><textarea id="reminderText" rows="3" maxlength="5000" placeholder="¿Qué necesitas recordar?" required></textarea><label for="reminderPriority">Prioridad</label><select id="reminderPriority">${rPriorityOptions('Media')}</select><label for="reminderWhen">Fecha y hora del aviso (opcional)</label><input id="reminderWhen" type="datetime-local"><div><button class="primary" type="submit">Guardar recordatorio</button></div><p id="reminderError" class="form-error" role="alert"></p></form></section><section class="card reminder-panel"><h3>Avisos</h3><p>Se revisan con la app abierta y al regresar. Con la app cerrada o suspendida, los vencidos se avisan al volver. Horario local del dispositivo.</p><button type="button" id="rEnableNotifications">Activar notificaciones del navegador</button><p id="rNotificationStatus" role="status">${escapeHtml(rPermissionText())}</p></section><label class="search-label reminder-search">Buscar recordatorios<input id="reminderSearch" type="search" placeholder="Buscar en notas pendientes y resueltas…" value="${escapeHtml(rSearch)}"></label><p class="dash-muted">Pendientes por prioridad y luego por fecha, más recientes primero.</p><div id="reminderLists"></div>`;
  const paintLists=()=>{
   const q=normalizeName(rSearch),filtered=all.filter(r=>normalizeName(r.texto).includes(q));
   const pending=rSorted(filtered.filter(r=>!r.resuelto)),resolved=filtered.filter(r=>r.resuelto).sort((a,b)=>(b.resueltoEn||b.modificado||b.creado).localeCompare(a.resueltoEn||a.modificado||a.creado));
   const lists=root.querySelector('#reminderLists');
   lists.innerHTML=`<section class="dash-panel reminder-panel"><h2>Pendientes (${pending.length})</h2>${pending.length?rRows(pending):`<p class="dash-muted">${q?'No hay pendientes que coincidan con la búsqueda.':'No hay recordatorios pendientes.'}</p>`}</section><details class="dash-panel reminder-panel" ${rHistoryOpen||q?'open':''}><summary>Resueltos (${resolved.length})</summary><p class="dash-muted">Historial por fecha de resolución, más recientes primero.</p>${resolved.length?rRows(resolved):`<p class="dash-muted">${q?'No hay resueltos que coincidan con la búsqueda.':'Todavía no hay recordatorios resueltos.'}</p>`}</details>`;
   lists.querySelector('details').addEventListener('toggle',e=>{if(e.target.isConnected)rHistoryOpen=e.target.open;});
   rBindActions(lists,all,renderReminders);
  };
  root.querySelector('#rEnableNotifications').onclick=rEnableNotifications;paintLists();root.querySelector('#reminderSearch').oninput=e=>{rSearch=e.target.value;paintLists();};
  root.querySelector('#reminderForm').onsubmit=async e=>{
   e.preventDefault();const input=root.querySelector('#reminderText'),texto=input.value.trim(),button=e.target.querySelector('button');
   if(!texto){root.querySelector('#reminderError').textContent='Escribe una nota.';input.focus();return;}
   button.disabled=true;
   try{const now=new Date().toISOString();await rWrite({id:makeId(),texto,when:rDateValue(root.querySelector('#reminderWhen').value),prioridad:root.querySelector('#reminderPriority').value,resuelto:false,creado:now,modificado:now});rSearch='';await renderReminders();document.getElementById('reminderText')?.focus();}
   catch(error){root.querySelector('#reminderError').textContent='No se pudo guardar: '+error.message;button.disabled=false;}
  };
 }catch(error){if(document.querySelector('.nav.active')?.dataset.page==='recordatorios')root.innerHTML='<p class="notice" role="alert">No se pudieron cargar los recordatorios. Intenta abrir el módulo nuevamente.</p>';console.error(error);}
}

function rLocalDate(value){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')+'T'+[String(d.getHours()).padStart(2,'0'),String(d.getMinutes()).padStart(2,'0')].join(':');}
function rDateValue(value){if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime())||rLocalDate(date.toISOString())!==value)throw Error('Fecha y hora inválidas.');return date.toISOString();}
function rPermissionText(){if(!('Notification' in window)||!isSecureContext)return 'Este navegador no admite notificaciones aquí. Los avisos seguirán visibles dentro de la app.';return Notification.permission==='granted'?'Notificaciones autorizadas.':Notification.permission==='denied'?'Notificaciones bloqueadas. Puedes habilitarlas en los permisos del navegador.':'Puedes autorizar notificaciones con el botón.';}
async function rEnableNotifications(){const status=document.getElementById('rNotificationStatus');try{if('Notification' in window&&isSecureContext&&Notification.permission!=='denied')await Notification.requestPermission();status.textContent=rPermissionText();await rCheckDue();}catch(error){status.textContent='No se pudieron activar las notificaciones: '+error.message;}}
let rChecking=false;
async function rCheckDue(){if(!db||rChecking)return;rChecking=true;try{
 const items=await rAll(),due=rSorted(items.filter(r=>!r.resuelto&&r.when&&Date.parse(r.when)<=Date.now()));
 let banner=document.getElementById('rDueBanner');if(!banner){banner=document.createElement('aside');banner.id='rDueBanner';banner.className='notice';banner.setAttribute('role','status');document.querySelector('main').insertBefore(banner,document.getElementById('view'));}
 banner.hidden=!due.length;banner.innerHTML=due.length?`<strong>${due.length} recordatorio${due.length===1?'':'s'} con aviso vencido</strong><p>${escapeHtml(due[0].texto)}</p><a href="#recordatorios">Revisar recordatorios</a>`:'';
 if(!('Notification' in window)||Notification.permission!=='granted')return;
 const reg=await navigator.serviceWorker?.getRegistration('./');
 for(const item of due){if(item.notificado===item.when)continue;
  try{const options={body:item.texto,tag:'recordatorio-'+item.id,icon:'icons/icon-192.png',data:{url:'./#recordatorios'}};
   if(reg?.active)await reg.showNotification('Recordatorio · SGLSN',options);else{const notification=new Notification('Recordatorio · SGLSN',options);notification.onclick=()=>{window.focus();location.hash='recordatorios';notification.close();};}
   // Releer antes de guardar para conservar cambios de edición o resolución concurrentes.
   const current=(await rAll()).find(r=>r.id===item.id);if(current&&!current.resuelto&&current.when===item.when)await rWrite({...current,notificado:item.when});
  }catch(error){console.warn('Aviso no entregado:',error);}
 }
 }catch(error){console.warn('No se pudieron comprobar los avisos:',error);}finally{rChecking=false;}}
setInterval(rCheckDue,15000);
window.addEventListener('focus',rCheckDue);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')rCheckDue();});
window.addEventListener('load',rCheckDue);
