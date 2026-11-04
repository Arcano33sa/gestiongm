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
