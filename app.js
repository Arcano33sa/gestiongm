'use strict';
const DB_NAME='sglsn-gestion-pendientes', DB_VERSION=2;
let db=null;
function openDatabase(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB no está disponible en este navegador.'));return;}const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const database=req.result;for(const store of ['pendientes','catalogos','gestiones','metadatos','recordatorios']){if(!database.objectStoreNames.contains(store))database.createObjectStore(store,{keyPath:'id'});}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('No se pudo abrir IndexedDB'));req.onblocked=()=>reject(new Error('La base está bloqueada por otra pestaña.'));});}
const sections={tablero:{title:'Tablero',html:`<div class="welcome"><img src="escudo.png" alt="Escudo de la SGLSN"><div><h2>Gestión de Pendientes</h2><p>Espacio de trabajo institucional para organizar y dar seguimiento a los asuntos pendientes de la Soberana Gran Logia Simbólica de Nicaragua.</p></div></div><div class="grid"><article class="card"><h3>Pendientes</h3><p>El registro y seguimiento de pendientes se incorporará en la siguiente etapa.</p></article><article class="card"><h3>Tablero de control</h3><p>Los indicadores aparecerán cuando se implemente su cálculo sobre datos reales.</p></article><article class="card"><h3>Trabajo sin conexión</h3><p>La aplicación está preparada para trabajar localmente tras su primera carga.</p></article></div><p class="notice">Primera versión: todavía no se registran pendientes ni se generan estadísticas.</p>`},pendientes:{title:'Pendientes',html:`<div class="empty"><h2>Sin pendientes registrados</h2><p>El formulario, listado y seguimiento de pendientes se incorporarán en una etapa posterior. No hay registros de demostración.</p></div>`},excel:{title:'Excel',html:`<div class="empty"><h2>Exportación a Excel</h2><p>La exportación se implementará en una etapa posterior. Esta pantalla no genera archivos todavía.</p></div>`},recordatorios:{title:'Recordatorios',html:'<p class="notice">Cargando recordatorios…</p>'},configuracion:{title:'Configuración',html:`<div class="grid"><article class="card"><h3>Almacenamiento local</h3><p id="storageInfo">Comprobando IndexedDB…</p></article></div><section id="cfgPanel"></section><section id="catalogSection" class="catalog-section"></section>`}};
function show(page){const entry=sections[page]||sections.tablero;document.getElementById('heading').textContent=entry.title;document.getElementById('view').innerHTML=entry.html;document.querySelectorAll('.nav').forEach(b=>{const selected=b.dataset.page===page;b.classList.toggle('active',selected);b.setAttribute('aria-current',selected?'page':'false');});if(page==='pendientes'&&db)renderPending();if(page==='recordatorios'&&db)renderReminders();if(page==='excel'&&db)renderExcel();if(page==='tablero'&&db)renderDashboard();if(page==='configuracion'){renderConfig();renderCatalogs();document.getElementById('storageInfo').textContent=db?'IndexedDB disponible · Esquema v2 · Almacenamiento local.':'Almacenamiento no disponible. Revisa la configuración de privacidad del navegador.';}}
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>{show(b.dataset.page);location.hash=b.dataset.page;}));
window.addEventListener('hashchange',()=>show(location.hash.slice(1)));
// Los scripts defer posteriores deben estar listos antes de iniciar la aplicación.
document.addEventListener('DOMContentLoaded',async()=>{
 const badge=document.getElementById('connection');
 try{
  db=await openDatabase();
  badge.textContent='Almacenamiento local listo';
  badge.classList.remove('error');
 }catch(error){
  console.error('Almacenamiento:',error);
  badge.textContent='Error de almacenamiento local';
  badge.classList.add('error');
 }
 try{
  if(db)await initializeCatalogs();
  show(location.hash.slice(1)||'tablero');
  if(db)await rCheckDue();
 }catch(error){
  console.error('Inicio de la aplicación:',error);
  if(db){badge.textContent='Error al iniciar la aplicación';badge.classList.add('error');}
  document.getElementById('view').insertAdjacentHTML('afterbegin','<p class="notice" role="alert">No se pudo completar el inicio de la aplicación. Consulta el error en la consola.</p>');
 }
 if(!db)document.getElementById('view').insertAdjacentHTML('afterbegin','<p class="notice" role="alert">No se pudo acceder al almacenamiento local. Verifica los permisos y evita el modo privado.</p>');
 if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  try{await navigator.serviceWorker.register('./sw.js');}catch(error){console.warn('PWA sin service worker:',error);}
 }
},{once:true});



// Catálogos persistentes. IDs estables: nunca se cambian al renombrar.
const INITIAL_CATEGORIES=['Administrativo','Financiero','Jurídico y Normativo','Relaciones Internacionales','Relaciones Interinstitucionales','Logias Jurisdiccionadas','Ceremonial y Protocolo','Infraestructura','Planificación Estratégica','Otros'];
const PRIORITIES=Object.freeze(['Crítica','Alta','Media','Baja']);
const STATES=Object.freeze(['Pendiente','En proceso','En espera','Finalizado','Cancelado']);
const CATALOG_TYPES=Object.freeze({categorias:'Categorías',responsables:'Responsables',apoyos:'Apoyos'});
const normalizeName=name=>name.trim().replace(/\s+/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const makeId=()=>crypto.randomUUID?crypto.randomUUID():'cat-'+Date.now()+'-'+Math.random().toString(36).slice(2);
function txStore(mode='readonly'){return db.transaction('catalogos',mode).objectStore('catalogos');}
function catalogList(){return new Promise((resolve,reject)=>{if(!db)return resolve([]);const request=txStore().getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error);});}
function putCatalog(record){return new Promise((resolve,reject)=>{const request=txStore('readwrite').put(record);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});}
async function initializeCatalogs(){
 const existing=await catalogList();const names=new Set(existing.filter(x=>x.tipo==='categorias').map(x=>normalizeName(x.nombre)));
 for(const name of INITIAL_CATEGORIES){const norm=normalizeName(name);if(names.has(norm))continue;await putCatalog({id:makeId(),tipo:'categorias',nombre:name,activo:true,creado:new Date().toISOString()});names.add(norm);}
}
// Selectores preparados para el formulario de Pendientes (etapa 3).
async function catalogOptions(tipo,{includeInactive=false}={}){const items=await catalogList();return items.filter(x=>x.tipo===tipo&&(includeInactive||x.activo!==false)).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));}
function fixedOptions(tipo){return tipo==='prioridades'?[...PRIORITIES]:tipo==='estados'?[...STATES]:[];}
function createCatalogSelect(tipo,selected='',includeInactive=false){const select=document.createElement('select');select.dataset.catalog=tipo;const empty=document.createElement('option');empty.value='';empty.textContent='Seleccionar…';select.append(empty);const values=tipo==='prioridades'||tipo==='estados'?fixedOptions(tipo).map(x=>({id:x,nombre:x})):[];const fill=items=>{for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.nombre;option.selected=item.id===selected;select.append(option);}};if(values.length)fill(values);else if(CATALOG_TYPES[tipo])catalogOptions(tipo,{includeInactive}).then(fill);return select;}
let currentCatalog='categorias',catalogSearch='';
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function renderCatalogs(){
 const root=document.getElementById('catalogSection');if(!root)return;
 root.innerHTML='<div class="catalog-head"><div><h2>Catálogos</h2><p>Listas institucionales guardadas en este dispositivo.</p></div></div><p class="catalog-loading">Cargando catálogos…</p>';
 if(!db){root.querySelector('.catalog-loading').textContent='Almacenamiento no disponible. No se pueden administrar catálogos.';return;}
 const all=await catalogList();if(!root.isConnected)return;
 root.innerHTML=`<div class="catalog-head"><div><h2>Catálogos</h2><p>Administración de listas institucionales · Guardado local</p></div><button class="primary" id="newCatalog">+ Agregar</button></div><div class="catalog-tabs" role="group" aria-label="Tipo de catálogo">${Object.entries(CATALOG_TYPES).map(([key,label])=>`<button type="button" class="tab ${currentCatalog===key?'chosen':''}" data-catalog-tab="${key}">${label}</button>`).join('')}</div><label class="search-label">Buscar en ${CATALOG_TYPES[currentCatalog]}<input id="catalogSearch" type="search" placeholder="Buscar por nombre…" value="${escapeHtml(catalogSearch)}"></label><div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th>Nombre</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="catalogRows"></tbody></table></div><div class="fixed-catalogs"><h3>Listas fijas del sistema</h3><div class="fixed-grid"><div><strong>Prioridades</strong><p>${PRIORITIES.join(' · ')}</p></div><div><strong>Estados</strong><p>${STATES.join(' · ')}</p></div></div><p>Estas listas tienen orden fijo y no admiten edición ni duplicados.</p></div><div id="catalogMessage" role="status" aria-live="polite"></div><dialog id="catalogDialog" class="catalog-dialog"><form id="catalogForm"><h3 id="catalogDialogTitle">Agregar</h3><label>Nombre<input id="catalogName" maxlength="120" required autocomplete="off"></label><p id="catalogFormError" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cancelCatalog">Cancelar</button><button type="submit" class="primary">Guardar</button></div></form></dialog>`;
 const rows=root.querySelector('#catalogRows');
 const filtered=all.filter(x=>x.tipo===currentCatalog&&normalizeName(x.nombre).includes(normalizeName(catalogSearch))).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
 rows.innerHTML=filtered.length?filtered.map(x=>`<tr><td>${escapeHtml(x.nombre)}</td><td><span class="cat-status ${x.activo===false?'inactive':''}">${x.activo===false?'Inactivo':'Activo'}</span></td><td class="cat-actions"><button type="button" data-edit="${escapeHtml(x.id)}" aria-label="Editar ${escapeHtml(x.nombre)}">Editar</button><button type="button" data-toggle="${escapeHtml(x.id)}">${x.activo===false?'Activar':'Desactivar'}</button></td></tr>`).join(''):'<tr><td colspan="3" class="no-rows">No hay registros para mostrar.</td></tr>';
 root.querySelectorAll('[data-catalog-tab]').forEach(b=>b.addEventListener('click',()=>{currentCatalog=b.dataset.catalogTab;catalogSearch='';renderCatalogs();}));
 root.querySelector('#catalogSearch').addEventListener('input',e=>{catalogSearch=e.target.value;const focus=e.target.selectionStart;renderCatalogs().then(()=>{const input=document.getElementById('catalogSearch');if(input){input.focus();input.setSelectionRange(focus,focus);}});});
 const dialog=root.querySelector('#catalogDialog'),form=root.querySelector('#catalogForm'),input=root.querySelector('#catalogName');let editing=null;
 const openEditor=item=>{editing=item||null;root.querySelector('#catalogDialogTitle').textContent=item?'Editar '+CATALOG_TYPES[currentCatalog]:'Agregar a '+CATALOG_TYPES[currentCatalog];input.value=item?.nombre||'';root.querySelector('#catalogFormError').textContent='';dialog.showModal();input.focus();};
 root.querySelector('#newCatalog').addEventListener('click',()=>openEditor(null));root.querySelector('#cancelCatalog').addEventListener('click',()=>dialog.close());
 rows.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(all.find(x=>x.id===b.dataset.edit))));
 rows.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',async()=>{const item=all.find(x=>x.id===b.dataset.toggle);if(!item)return;try{await putCatalog({...item,activo:item.activo===false,modificado:new Date().toISOString()});await renderCatalogs();}catch(e){alert('No se pudo guardar el cambio: '+e.message);}}));
 form.addEventListener('submit',async e=>{e.preventDefault();const nombre=input.value.trim().replace(/\s+/g,' '),error=root.querySelector('#catalogFormError');if(!nombre){error.textContent='El nombre es obligatorio.';return;}const list=await catalogList();if(list.some(x=>x.tipo===currentCatalog&&x.id!==editing?.id&&normalizeName(x.nombre)===normalizeName(nombre))){error.textContent='Ya existe un registro con ese nombre (activo o inactivo).';return;}const now=new Date().toISOString();try{await putCatalog(editing?{...editing,nombre,modificado:now}:{id:makeId(),tipo:currentCatalog,nombre,activo:true,creado:now});dialog.close();await renderCatalogs();}catch(err){error.textContent='No se pudo guardar: '+err.message;}});
}
