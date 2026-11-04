# Gestión de Pendientes — SGLSN · Versión estable 8/8

PWA offline-first para uso personal. Datos exclusivamente locales en IndexedDB; no utiliza nube ni cuentas.

## Instalación y arranque
1. Descomprimir el ZIP íntegro.
2. Publicar los archivos en un servidor HTTPS o servir la carpeta desde localhost (por ejemplo `python3 -m http.server 8000`). No abrir `index.html` directamente como archivo.
3. Abrir la URL, esperar la primera carga completa con conexión y, si el navegador lo permite, instalar desde su menú.
4. Comprobar el funcionamiento sin conexión tras la primera carga. El modo offline depende de que todos los recursos se hayan almacenado.

## Uso y respaldos
- En Configuración → Respaldo JSON, pulsar «Exportar respaldo JSON completo» y **comprobar en Descargas/Archivos que el JSON realmente existe**. Conservar una copia fuera del dispositivo.
- Para recuperar, elegir el JSON y revisar los conteos antes de confirmar. «Fusionar» actualiza registros con IDs coincidentes y agrega los nuevos; «Reemplazar» sustituye las colecciones locales. Ambas opciones requieren confirmación.
- Antes de restaurar, exportar un respaldo actualizado. Evitar editar datos entre la vista previa y la confirmación.
- Excel permite exportar todos los pendientes activos o los filtrados; el XLSX no sirve para restaurar datos.
- Para actualizaciones, publicar los archivos nuevos en la misma ruta y usar Configuración → Buscar actualizaciones. Una nueva versión de `sw.js` activa el proceso de actualización; «Aplicar actualización» aparece cuando hay un trabajador en espera. No borrar datos del navegador ni IndexedDB.

## Changelog final
- Versión de aplicación y caché PWA elevadas a 8.0.0 / v8.
- Búsqueda de actualizaciones del service worker durante navegaciones online, sin eliminar IndexedDB.
- Bloqueo preventivo de importación si el contenido local cambió desde la vista previa.
- Mejoras de enfoque visible, área táctil, movimiento reducido y contención horizontal.
- Documentación de recuperación, instalación y límites de pruebas.

## Validaciones ejecutadas
- Inspección estática de archivos y estructura del ZIP.
- `node --check` de todos los archivos JavaScript.
- Comprobación estática de referencias a recursos y manifiesto, estructura del ZIP y cambios de versión.

## Pruebas manuales pendientes (no se simularon ni se atribuyen resultados inexistentes)
- Safari real en iPad vertical y horizontal, instalación PWA y rotación; escritorio en navegadores de destino.
- Flujo interactivo completo con creación/edición de pendientes, gestiones, filtros, catálogos, avance, vencimientos y arrastre anual.
- Exportación XLSX total/filtrada y apertura en Excel/Numbers.
- JSON válido, corrupto, duplicados, fusionar dos veces, reemplazar, referencias y reintentos; comparar conteos antes/después.
- Prueba de actualización con dos despliegues reales, recarga offline, cierre/reapertura y persistencia de IndexedDB.
- Pruebas de rendimiento con numerosos registros, consola y accesibilidad con teclado/VoiceOver.

**Importante:** Esta entrega es un paquete final de código revisado estáticamente, no una certificación de estabilidad en dispositivos reales.
# gestiongm

## Recordatorios · Etapa 1 (9.0.0)
- Módulo antes de Configuración: captura rápida, edición, eliminación con confirmación y marcado como resuelto.
- El Tablero muestra todos los recordatorios pendientes, sin filtro por año, con acceso al módulo y acciones.
- Los resueltos se conservan en el módulo. No incluye prioridades, búsqueda ni avisos programados.
- IndexedDB se actualiza a esquema 2 sin borrar las colecciones existentes. Los respaldos JSON incluyen recordatorios y aceptan archivos anteriores de esquema 1 (sin recordatorios).

## Recordatorios · Etapa 2 (9.1.0)
- Búsqueda por texto, sin distinguir mayúsculas ni acentos, en pendientes e historial. Buscar conserva el borrador de captura rápida.
- Prioridades Crítica, Alta, Media y Baja; las notas anteriores sin prioridad se muestran como Media. Pendientes ordenados por prioridad y fecha en el módulo y el Tablero.
- Historial ordenado por fecha de resolución con opción Reabrir. Los reabiertos vuelven al Tablero y conservan su nota y prioridad.
- Respaldos compatibles con recordatorios de la etapa 1.

## Recordatorios · Etapa 3 (9.2.0)
- Fecha y hora opcionales al crear o editar, según el horario local del dispositivo. Se guardan como instante UTC y se muestran en hora local. Borrar la fecha cancela el aviso.
- Avisos vencidos visibles en todas las pantallas; comprobación cada 15 segundos con la app ejecutándose, al recuperar foco y al volver a abrir. Resolver o eliminar retira el aviso en la siguiente comprobación.
- Activación explícita de notificaciones del navegador. Sin soporte o permiso, se conserva el aviso dentro de la app. Una notificación por fecha programada; cambiar la fecha permite un nuevo aviso.
- Pulsar una notificación abre Recordatorios. No hay servidor push: no se garantiza entrega con la app cerrada o suspendida; se comprueba al regresar.
- Prueba automatizada en Chrome: vencidos, futuros, resueltos, deduplicación, conversión de fecha y regresión de búsqueda, prioridades, reapertura, persistencia y respaldos. Entrega del sistema simulada; pendiente validación en dispositivo real.

## Preparación para pasar a Pendientes · Etapa 1 (9.3.0)
- El campo Nota se llama Descripción al crear y editar; los registros anteriores conservan su contenido.
- Categoría opcional desde el catálogo existente, visible en el módulo y el Tablero. Se conservan categorías inactivas ya asignadas; las nuevas selecciones usan categorías activas.
- Los respaldos conservan descripción, prioridad y categoría, validando su referencia al catálogo. Se aceptan recordatorios anteriores sin categoría.
- Prueba en Chrome: crear y editar categoría, conservarla tras recarga y en respaldo; regresión de búsqueda, prioridades, avisos, reapertura e historial.

## Pasar a Pendientes · Etapa 2 (9.4.0)
- Botón Pasar a Pendientes en el módulo y el Tablero; abre el formulario de alta con descripción, prioridad y categoría precargadas. La descripción admite hasta 5000 caracteres para conservar íntegros los recordatorios.
- Cancelar no crea registros ni resuelve el recordatorio. Guardar crea el pendiente y resuelve/vincula el recordatorio en una única transacción.
- Se impiden traslados repetidos, incluso con formularios abiertos en varias pestañas. El historial ofrece Ver pendiente; el vínculo persiste en los respaldos.
- Prueba en Chrome: precarga, cancelación, guardado, bloqueo de duplicados, consulta vinculada, recarga y validación del respaldo.

## Exportación individual al calendario · Etapas 1–3
- Cada fila de Pendientes ofrece «Agregar al calendario»: descarga un `.ics` para abrir o importar en el calendario elegido. No guarda directamente en el calendario ni sincroniza cambios posteriores.
- Fecha Límite obligatoria y válida; evento de todo el día con final exclusivo al día siguiente. Título: primera línea de Descripción, hasta 120 caracteres. Detalles: descripción completa, nombre del responsable (incluidos inactivos) y prioridad. Sin responsable: «Sin asignar».
- Prioridad y color sugerido: Crítica/morado, Alta/rojo, Media/amarillo y Baja/verde. Se incluyen `PRIORITY`, `CATEGORIES` y `COLOR`; el calendario receptor decide si utiliza el color. Apple indica que importar un `.ics` elimina el color personalizado: https://support.apple.com/en-euro/guide/calendar/icl1023/mac. La prioridad escrita se conserva aunque el color no se aplique.
- Validado en Chrome de escritorio con perfil aislado: botón real y descarga de las cuatro prioridades, responsable inactivo/sin asignar, rechazo sin fecha, conservación de datos y exportación tras recarga sin conexión. Los cuatro archivos descargados se analizaron con el lector independiente Python `icalendar` 6.3.2: fechas de todo el día, año nuevo, año bisiesto, descripción, acentos, emoji y caracteres escapados correctos.
- Prueba reproducible: `NODE_PATH=/ruta/a/node_modules CHROME_PATH=/ruta/al/ejecutable/chrome node tests/calendar-export.smoke.cjs` (requiere Playwright). Sin `CHROME_PATH`, usa el Chromium de Playwright. Crea datos solo en el perfil temporal del navegador y archivos de descarga en el directorio temporal del sistema.
- Pendiente de validación manual: apertura/importación en Apple Calendar, Google Calendar y Outlook reales, y flujo de descarga/importación en iPhone, iPad y Android. No se han creado eventos en calendarios personales. La reimportación del mismo archivo puede comportarse de distinta manera según la aplicación; no se garantiza evitar duplicados.

## Seguimiento de pendientes · Etapa 1 (9.5.0)
- Próxima acción (texto opcional, hasta 2000 caracteres) y Fecha de seguimiento (fecha opcional) en alta, edición, consulta y matriz. La fecha de seguimiento es independiente de la Fecha Límite; cualquiera de los dos campos puede dejarse vacío o borrarse. Buscar incluye ambos campos y se puede ordenar por fecha de seguimiento.
- Tablero: conteos de seguimientos vencidos (antes de hoy) y próximos (hoy y los siguientes 7 días). Se calculan sobre asuntos abiertos —Pendiente, En proceso y En espera— sin archivados y respetando el alcance histórico del tablero. Sin fecha no se cuentan. No se generan avisos del sistema para estas fechas en esta etapa.
- Excel: dos columnas adicionales al final de Pendientes, Fecha de seguimiento como fecha numérica con formato `dd/mm/yyyy`, filtro ampliado a las 13 columnas y conteos de seguimiento en Resumen Ejecutivo. Los conteos corresponden exclusivamente a los registros exportados, tanto en modalidad total como filtrada. El texto mantiene la protección contra fórmulas y el escapado XML existentes.
- JSON: exportación y restauración conservan ambos campos; se validan sus tipos, longitud y fecha real. Los respaldos anteriores de esquemas 1 y 2 sin estos campos siguen admitidos; no se requiere migrar IndexedDB. Versiones anteriores de la app pueden ignorar estos campos en su interfaz.
- Calendario: se incluyen próxima acción y fecha de seguimiento en los detalles cuando existen. El evento sigue usando exclusivamente la Fecha Límite.
- Validado con `tests/followup-stage1.smoke.cjs` en Chrome con perfil aislado: alta, consulta, edición y borrado de campos, recarga, búsqueda y orden, compatibilidad con registros anteriores, conteos con fechas en los límites, exclusión de cerrados/archivados, XLSX total/filtrado y fecha numérica, exportación JSON y restauración real por la interfaz. Revisados los campos en vistas de escritorio y móvil de Chrome. Regresión `tests/calendar-export.smoke.cjs` aprobada, incluida descarga sin conexión.
- Ejecución: `NODE_PATH=/ruta/a/node_modules CHROME_PATH=/ruta/al/ejecutable/chrome node tests/followup-stage1.smoke.cjs` (Playwright y JSZip). No se ha probado la apertura de estos XLSX en Excel/Numbers ni Safari/iPhone reales.

## Historial de cambios · Etapa 2 (9.6.0)
- La ficha del pendiente muestra el historial, con fecha y hora local, campo, valor anterior y nuevo. Registra cambios posteriores a esta versión en Responsable, Prioridad, Estado, Fecha Registro, Fecha Límite, Fecha de seguimiento, Próxima acción y condición Archivado. No reconstruye cambios anteriores ni genera entradas por guardar sin cambios. La creación inicial y la Última Gestión calculada no generan cambios de historial; las gestiones conservan su sección propia.
- Pendiente e historial se guardan en la misma transacción de IndexedDB. El historial se toma del registro vigente al guardar para conservar entradas de otras pestañas; cada cambio refleja los valores realmente sustituidos. Esto no bloquea la edición simultánea: guardar un formulario antiguo puede sustituir campos con sus valores anteriores y ese cambio queda registrado. Los nombres de responsables se capturan en el momento del cambio. No se atribuye autor porque la app no tiene usuarios autenticados.
- Excel incorpora ID Pendiente al final de la hoja Pendientes y una hoja Historial de cambios (ID Cambio, ID Pendiente, descripción, fecha/hora local, campo, anterior y nuevo). Solo incluye historias de los pendientes exportados. Fechas y horas se exportan como valores numéricos con formato; los textos mantienen protección contra fórmulas y escapado XML. El libro conserva las tres hojas aun si el conjunto exportado está vacío.
- Respaldo JSON esquema 3, compatible con importaciones de esquemas 1 y 2 y registros sin historial. Se validan IDs únicos, campos permitidos, fecha/hora UTC real, valores y longitudes. Fusionar combina historiales por ID sin duplicar ni descartar las entradas locales cuando un respaldo antiguo carece de ellas; rechaza el mismo ID con contenido contradictorio. Reemplazar restaura exactamente el historial del archivo, como las demás colecciones. La importación restaura datos e historial: no inventa entradas correspondientes a modificaciones del respaldo ni reconstruye cambios ausentes. Los respaldos de esquema 3 requieren esta versión o posterior; el esquema de IndexedDB permanece en 2.
- Prueba `tests/history-stage2.smoke.cjs`: edición real, guardado sin cambios, instantánea del nombre, guardados concurrentes, reversión ante fallo, consulta tras recarga, JSON 1/2/3, validación de historial corrupto, fusión repetida sin duplicados, detección de conflictos y restauración real por la interfaz. XLSX total/filtrado/vacío: relaciones de hojas, XML válido, IDs, filas, fechas numéricas y protección del texto. Revisado el historial en capturas de Chrome escritorio y móvil.
- Regresiones de seguimiento E1 y calendario aprobadas, incluida descarga de calendario offline. No se ha comprobado apertura del nuevo Excel en Excel/Numbers ni ejecución en Safari/dispositivos físicos.
- Ejecución: `NODE_PATH=/ruta/a/node_modules CHROME_PATH=/ruta/al/ejecutable/chrome node tests/history-stage2.smoke.cjs` (Playwright y JSZip, datos en un perfil temporal).

## Cierre y reapertura · Etapa 3 (9.7.0)
- Al cambiar a Finalizado se requieren Fecha de cierre y Resultado del cierre; al cambiar a Cancelado se requieren fecha y Motivo de cancelación. Fecha sugerida: hoy, editable entre Fecha Registro y hoy; textos de hasta 2000 caracteres. Los campos pertinentes aparecen según el estado. Los pendientes cerrados de versiones anteriores pueden conservarse sin inventar fechas ni resultados; completar esos datos crea un registro de cierre.
- Se añaden columnas de cierre en la matriz, búsqueda por sus campos y consulta en la ficha. Al reabrir mediante un estado abierto se limpian los campos del cierre actual, conservando los cierres anteriores en «Cierres y reaperturas». Las correcciones generan otra instantánea; guardar sin cambios no duplica cierres. Cada registro conserva el plazo y la fecha de registro vigentes al cerrar. Editar posteriormente el plazo no cambia retroactivamente el cumplimiento del cierre; las correcciones y reaperturas conservan la referencia del cierre original. Un nuevo cierre tras reabrir captura las fechas vigentes en ese nuevo cierre.
- Los campos de cierre y el estado también quedan en Historial de cambios. Pendiente, historiales y cierre se escriben en una sola transacción; las actualizaciones automáticas de Última Gestión conservan la información del cierre. La creación de pendientes desde Recordatorios admite el cierre con las mismas reglas del formulario.
- Excel: columnas Fecha de cierre, Resultado, Motivo, Días hasta el cierre y Cumplimiento en Pendientes. Duración: días naturales entre Fecha Registro capturada y cierre, cero si es el mismo día; al reabrir, el cierre actual queda sin duración. Finalizados: En plazo si cierre <= Fecha Límite capturada, Fuera de plazo si posterior, Sin Fecha Límite si no existía plazo, Sin datos de cierre para registros anteriores incompletos. Cancelados: cumplimiento No aplica. No se fuerza Avance a 100%.
- Resumen Ejecutivo: finalizados en/fuera de plazo, sin plazo y sin datos de cierre. Cumplimiento = finalizados en plazo / (finalizados en plazo + fuera de plazo), solo dentro del conjunto exportado; cancela­dos, abiertos, finalizados sin plazo o sin datos se excluyen del denominador. Sin casos evaluables se muestra «No evaluable».
- Nueva hoja «Cierres y reaperturas», vinculada por ID, con acción (Cierre, Corrección o Reapertura), estado al cerrar, fechas, resultado/motivo, duración y cumplimiento. Sus filas son eventos históricos: no se suman como pendientes adicionales en el resumen. Se conservan las cuatro hojas en exportaciones vacías. Los filtros y la exclusión de archivados se aplican a todas las hojas.
- JSON esquema 4 conserva campos actuales e historial de cierres. Se admiten esquemas 1, 2 y 3 sin migrar IndexedDB. Se validan fechas reales, tipos, límites, consistencia de resultado/motivo, IDs únicos e instantáneas. Fusionar conserva los historiales locales ausentes en respaldos antiguos, combina por ID sin duplicados y rechaza contenido contradictorio para un mismo ID. Reemplazar restaura exactamente lo incluido en el respaldo. Los respaldos de esquema 4 requieren esta versión o posterior.
- Prueba `tests/closure-stage3.smoke.cjs` en Chrome aislado: cierre sin resultado, fecha anterior al registro, finalización, cancelación, reapertura, cierre posterior, correcciones, guardado sin cambios, persistencia, plazo capturado y casos de duración/cumplimiento (mismo día, año bisiesto, sin plazo y datos antiguos). XLSX total/filtrado/vacío: XML, relaciones de las cuatro hojas, fechas numéricas, protección de texto y denominador del porcentaje. JSON: validación, fusión repetida, conflictos y exportación/restauración real por la interfaz. Revisadas capturas de la ficha y el historial. El reloj de prueba fija solo la fecha, conservando los temporizadores normales del navegador.
- Regresiones E1, E2 y calendario aprobadas. No se ha probado la apertura de los archivos en Excel/Numbers ni Safari/dispositivos físicos. Ejecución: `NODE_PATH=/ruta/a/node_modules CHROME_PATH=/ruta/al/ejecutable/chrome node tests/closure-stage3.smoke.cjs` (Playwright y JSZip).

## Asuntos sin movimiento · Etapa 4 (9.8.0)
- Configuración ofrece un plazo global entre 1 y 365 días naturales, inicialmente 14. Se considera sin movimiento al alcanzar el plazo (`días >= plazo`), exclusivamente en asuntos abiertos: Pendiente, En proceso y En espera; finalizados, cancelados y archivados quedan excluidos.
- Se toma la fecha de la última gestión real del historial; sin gestiones, Fecha Registro. Los cálculos reconcilian las gestiones al consultar, sin confiar en una Última Gestión almacenada que pueda estar desactualizada. Editar un pendiente, su avance o su próxima acción no reinicia la inactividad. Agregar, editar o eliminar gestiones recalcula el indicador y actualiza el detalle de la ficha.
- Matriz: Días sin gestión, indicador Sin movimiento (Sí/No) y filtro específico. Ficha: cálculo, plazo y origen de la fecha base. Tablero: conteo con el alcance histórico existente y lista de hasta 12 asuntos, ordenados de mayor a menor inactividad, con acceso a su ficha. Una fecha base futura se muestra como «Fecha futura»; sin fecha válida, «Sin datos». Estos casos no generan días negativos ni se cuentan como movimiento reciente.
- Excel: columnas numéricas Días sin gestión e indicador Sin movimiento; duración vacía para casos no evaluables o excluidos. Resumen Ejecutivo incluye plazo aplicado, abiertos sin movimiento, con movimiento reciente y sin movimiento evaluable. Conteos, filtro Movimiento y búsqueda de los nuevos valores respetan exclusivamente el conjunto exportado. Se conservan las cuatro hojas y sus vínculos; los archivados siguen fuera hasta E5.
- Plazo guardado en metadatos (`cfg-inactivity-days`) e incluido en JSON, con validación de entero entre 1 y 365. No cambia el esquema JSON 4 ni IndexedDB 2. Fusionar un respaldo antiguo sin ese metadato conserva el plazo local; Reemplazar sin el metadato recupera el valor inicial de 14 días. Restaurar actualiza el campo y su mensaje en Configuración. No se persisten los días calculados ni se crean cambios ficticios en los historiales de cada pendiente al cambiar el plazo.
- Corregido un error previo en el formulario de gestiones: se usaba una variable inexistente al guardar la referencia del pendiente; ahora se guarda `pendienteId: pendingId`. Cubierto mediante alta, edición y eliminación reales por la interfaz.
- Prueba `tests/inactivity-stage4.smoke.cjs`: umbral exacto, último día anterior al umbral, registro sin gestiones, caché de Última Gestión desactualizada, estados excluidos, fecha futura, arrastre entre años, alta/edición/borrado de gestiones, edición sin gestión, configuración persistente, valores inválidos, XLSX total/filtrado/búsqueda/vacío y JSON validación/fusión/restauración con y sin configuración. Cálculos de días naturales, mismo día y año bisiesto. Revisados Configuración en escritorio y lista de inactividad en Chrome móvil.
- Regresiones de E1, E2, E3 y calendario aprobadas, incluida descarga de calendario offline. No se han comprobado los nuevos XLSX en Excel/Numbers ni Safari/dispositivos físicos. No se incorporan notificaciones del sistema por inactividad.
- Ejecución: `NODE_PATH=/ruta/a/node_modules CHROME_PATH=/ruta/al/ejecutable/chrome node tests/inactivity-stage4.smoke.cjs` (Playwright y JSZip, perfiles y descargas temporales).

## Consulta y recuperación de archivados · Etapa 5 (9.9.0)
- Matriz con selector Mostrar: Activos (inicial), Archivados o Todos. Búsqueda y filtros funcionan dentro de la vista elegida. Se muestran condición y fecha de archivo; los archivos antiguos sin fecha se identifican como Sin registro. «Eliminar» pasa a llamarse «Archivar» para describir la operación existente.
- Los archivados se consultan en modo lectura con sus gestiones, cambios y cierres. «Restaurar» los devuelve a Activos con el mismo ID, contenido, estado y relaciones; restaurar un Finalizado no lo reabre. No se modifican ni se borran sus gestiones o cierres. Tras restaurar pueden editarse otra vez; las reglas de inactividad y vencimiento se vuelven a calcular sobre sus fechas originales.
- Archivo/restauración usan el registro vigente dentro de una transacción y solo cambian condición, fecha de archivo y modificación, más el historial correspondiente. Se registran cambios de Archivado y Fecha de archivo. Al restaurar se limpia la fecha actual, quedando la anterior en Historial de cambios. Repetir la misma operación no duplica entradas ni reemplaza la fecha. Un formulario antiguo no puede sobrescribir un pendiente que fue archivado mientras estaba abierto; se bloquean también las escrituras de gestiones de un padre archivado. La consulta no expone botones de edición de gestiones.
- Excel: casilla explícita «Incluir archivados», desactivada inicialmente. En modalidad total incluye todos los años sin filtros; en modalidad filtrada también respeta la vista Activos/Archivados/Todos, búsqueda y filtros de la matriz. Si la vista es Archivados y la casilla está desactivada, se informa que la exportación quedará vacía. Condición y Fecha de archivo se añaden al final de Pendientes (fecha/hora numérica local; vacía para fechas antiguas desconocidas o no archivados). Los historiales de las demás hojas siguen exactamente los IDs exportados.
- Resumen Ejecutivo separa Asuntos exportados, No archivados exportados y Archivados exportados. Estados, avance, vencimientos, seguimientos, inactividad y cumplimiento se calculan solo sobre los no archivados del conjunto exportado; las filas archivadas mantienen sus datos históricos de cierre en las hojas de detalle. Esto evita que incluir archivados altere los indicadores de gestión activa.
- Respaldo JSON esquema 5 por el nuevo campo Fecha de archivo en el historial. Admite esquemas 1–4 y archivos anteriores sin fecha o sin condición explícita. Se valida que Archivado sea booleano y la fecha de archivo, si existe, sea un instante ISO UTC real. Se valida también la fecha anterior/nueva dentro del historial. Fusionar mantiene la unión de historiales por ID; Reemplazar restaura exactamente las condiciones, fechas, relaciones e historiales del archivo. Los nuevos respaldos requieren esta versión o posterior; IndexedDB permanece en esquema 2.
- Prueba `tests/archive-stage5.smoke.cjs`: cancelar archivo, archivar, consulta/búsqueda/vistas, restaurar abiertos y cerrados, archivo antiguo sin fecha, conservar ID/contenido/gestiones/cierres, rechazo de guardados obsoletos y escrituras de gestiones, idempotencia, recarga y rearchivado. Excel: inclusión explícita, conjunto filtrado/vacío, fechas numéricas, relaciones históricas y exclusión de archivados en indicadores. JSON: exportación/restauración real por la interfaz, validación de condición/fecha y fusión sin duplicados. Revisadas capturas móviles de consulta y opciones de Excel.
- Regresiones de E1, E2, E3, E4 y calendario aprobadas, incluida descarga de calendario offline. No se ha probado la apertura del nuevo libro en Excel/Numbers ni Safari/dispositivos físicos. Ejecución: `NODE_PATH=/ruta/a/node_modules CHROME_PATH=/ruta/al/ejecutable/chrome node tests/archive-stage5.smoke.cjs` (Playwright y JSZip, perfiles y descargas temporales).

## Varios apoyos por pendiente (9.10.0)

- El formulario permite marcar varias personas y crear apoyos sin salir del pendiente. Los inactivos ya asignados se conservan y pueden desmarcarse.
- Las asignaciones antiguas de una persona se leen directamente; al guardar, `apoyo` pasa a ser una lista de IDs (vacía si no se asigna nadie).
- La matriz, búsqueda y Excel incluyen todos los nombres. Los respaldos usan esquema 6 y siguen admitiendo los esquemas 1–5.
- Prueba de navegador: `tests/multiple-supports.smoke.cjs`, con Playwright y JSZip disponibles en NODE_PATH; CHROME_PATH permite usar un Chrome instalado.
