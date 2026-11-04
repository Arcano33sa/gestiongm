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
