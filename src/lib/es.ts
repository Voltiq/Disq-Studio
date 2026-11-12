/*
 * Spanish (Spain), addressing the reader as "tú", as Windows does. The key
 * is the English text as it stands in the source; a key that is missing
 * here shows in English. src/lib/i18n.test.ts reports the ones without a
 * translation.
 *
 * Terms, as in Windows: the Recycle Bin is the "Papelera de reciclaje",
 * on disk is "en disco", a snapshot is an "instantánea". The cleanup basket
 * is the "cesta", so it isn't confused with the Papelera.
 */
export const es: Record<string, string> = {
  // ----- Window and toolbar -----
  "Minimise": "Minimizar",
  "Maximise": "Maximizar",
  "Restore": "Restaurar",
  "Close window": "Cerrar ventana",
  "Running as administrator: every folder can be read": "Ejecutándose como administrador: se pueden leer todas las carpetas",
  "Admin": "Admin",
  "Theme: dark": "Tema: oscuro",
  "Theme: light": "Tema: claro",
  "Theme: follow Windows": "Tema: como Windows",
  "Something went wrong": "Algo ha salido mal",
  "Scanning": "Analizando",
  "No scan yet": "Aún no hay análisis",
  "Measure sizes by": "Medir tamaños por",
  "How long each file is, like Explorer's Size column": "Lo que ocupa cada archivo, como la columna Tamaño del Explorador",
  "Space actually used on the drive: whole clusters, after compression, without online-only cloud files":
    "Espacio realmente usado en la unidad: clústeres enteros, tras la compresión, sin los archivos de la nube solo en línea",
  "Scan this location again": "Volver a analizar esta ubicación",
  "Rescan": "Volver a analizar",
  "History: earlier scans, and what changed since": "Historial: análisis anteriores y lo que ha cambiado desde entonces",
  "Export a report of the folder in view": "Exportar un informe de la carpeta que se muestra",
  "Cleanup basket: {0}": "Cesta de limpieza: {0}",
  "Cleanup basket": "Cesta de limpieza",
  "Hide details": "Ocultar detalles",
  "Show details": "Mostrar detalles",
  "Settings": "Configuración",
  "Resize the folder list": "Cambiar el ancho de la lista de carpetas",
  "Drag to resize; double-click to reset": "Arrastra para cambiar el ancho; doble clic para restablecerlo",
  "Location": "Ubicación",
  "Back": "Atrás",
  "Up one level": "Subir un nivel",
  "Chart": "Gráfico",
  "Treemap": "Mapa de árbol",
  "Treemap: blocks sized by space used": "Mapa de árbol: bloques según el espacio usado",
  "Sunburst": "Anillos",
  "Sunburst: rings out from this folder, one per level": "Anillos: desde esta carpeta hacia fuera, uno por nivel",
  "Map options": "Opciones del mapa",
  "Refreshing…": "Actualizando…",
  "Showing {0}": "Se muestra: {0}",
  "Stop": "Detener",
  "Colours by when files last changed": "Colores según la última modificación de los archivos",
  "Free space": "Espacio libre",
  "File types: click one to show only that type": "Tipos de archivo: haz clic en uno para mostrar solo ese tipo",
  "Stop showing only {0}": "Dejar de mostrar solo {0}",
  "Show only {0}": "Mostrar solo {0}",
  "Online only": "Solo en línea",
  "Report exported": "Informe exportado",
  "{0} in {1}": "{0} en {1}",
  "Dismiss": "Descartar",
  "Close": "Cerrar",
  "View": "Vista",
  "Map": "Mapa",
  "Duplicates": "Duplicados",
  "Cleanup": "Limpieza",
  "Changes": "Cambios",
  "Not for a snapshot: scan again to look for duplicates":
    "No disponible en una instantánea: vuelve a analizar para buscar duplicados",
  "Not for a snapshot: scan again to clean up": "No disponible en una instantánea: vuelve a analizar para limpiar",
  "A filter is on: the map, lists and totals only count matching files":
    "Hay un filtro activo: el mapa, las listas y los totales solo cuentan los archivos que coinciden",
  "Filtered · {0} in {1}": "Filtrado · {0} en {1}",
  "An earlier scan, opened from History. Nothing can be deleted from it; Rescan to see the drive as it is now.":
    "Un análisis anterior, abierto desde el Historial. No se puede eliminar nada desde aquí; vuelve a analizar para ver la unidad tal como está ahora.",
  "Snapshot · {0}": "Instantánea · {0}",
  "Online-only cloud files (OneDrive and similar). Their data isn't on this drive; switch to On disk to leave them out.":
    "Archivos de la nube solo en línea (OneDrive y similares). Sus datos no están en esta unidad; cambia a «En disco» para excluirlos.",
  "{0} online only": "{0} solo en línea",
  "Folders left out by Settings › Folders to skip": "Carpetas excluidas en Configuración › Carpetas omitidas",
  "Read from the drive's file table in one go. Includes NTFS's own files ($MFT and others) and System Volume Information.":
    "Leído de una vez desde la tabla de archivos de la unidad. Incluye los archivos propios de NTFS ($MFT y otros) y System Volume Information.",
  "File table": "Tabla de archivos",
  "Folders Windows didn't allow to be read, even as administrator. Their sizes aren't counted.":
    "Carpetas que Windows no ha dejado leer, ni siquiera como administrador. Su tamaño no se cuenta.",
  "Folders your account isn't allowed to read; their sizes aren't counted. Click to restart as administrator and read them too.":
    "Carpetas que tu cuenta no puede leer; su tamaño no se cuenta. Haz clic para reiniciar como administrador y leerlas también.",
  "Restart as administrator": "Reiniciar como administrador",

  // ----- Messages -----
  "Disq Studio {0} is available": "Disq Studio {0} está disponible",
  "It installs in a moment, then Disq Studio starts again. Or later, from Settings › Updates.":
    "Se instala en un momento y Disq Studio se vuelve a abrir. O más tarde, desde Configuración › Actualizaciones.",
  "Install and restart": "Instalar y reiniciar",
  "Refreshed {0}": "Actualizado: {0}",
  "Still {0}.": "Sigue en {0}.",
  "Now {0}, {1} more than before.": "Ahora {0}, {1} más que antes.",
  "Now {0}, {1} less than before.": "Ahora {0}, {1} menos que antes.",
  "Still running normally": "Sigue ejecutándose con normalidad",
  "Windows didn't get permission to restart Disq Studio as administrator.":
    "Windows no ha obtenido permiso para reiniciar Disq Studio como administrador.",
  "Choose a folder to scan": "Elige una carpeta para analizar",
  "{0}. A folder goes as a whole only when everything in it matches; elsewhere just the matching files go, and nothing that doesn't match is touched.":
    "{0}. Una carpeta se elimina entera solo si todo su contenido coincide; en otro caso solo se eliminan los archivos que coinciden, y no se toca nada que no coincida.",
  "Added {0} to the basket": "Añadido a la cesta: {0}",
  "Already in the basket": "Ya está en la cesta",
  "The basket holds {0}, {1} on disk.": "La cesta contiene {0}, {1} en disco.",
  "Open basket": "Abrir la cesta",
  "Restored {0}": "Restaurado: {0}",
  "Nothing was restored": "No se ha restaurado nada",
  "{0} in the Recycle Bin any more.": "{0} en la Papelera de reciclaje.",
  "Everything is back where it was.": "Todo ha vuelto a su sitio.",
  "{0} freed once the Recycle Bin is emptied.": "{0} liberados cuando se vacíe la Papelera de reciclaje.",
  "{0} freed.": "{0} liberados.",
  "{0} deleted permanently, as you chose.": "{0} permanentemente, como elegiste.",
  "1 item was kept: Windows would have deleted it permanently.":
    "Se ha conservado 1 elemento: Windows lo habría eliminado permanentemente.",
  "{0} items were kept: Windows would have deleted them permanently.":
    "Se han conservado {0} elementos: Windows los habría eliminado permanentemente.",
  "1 item was skipped, most likely because a program is using it: {0}":
    "Se ha omitido 1 elemento, seguramente porque un programa lo está usando: {0}",
  "{0} items were skipped, most likely because a program is using them: {1}{2}":
    "Se han omitido {0} elementos, seguramente porque un programa los está usando: {1}{2}",
  "Moved {0} to the Recycle Bin": "Movido a la Papelera de reciclaje: {0}",
  "Deleted {0} permanently": "Eliminado permanentemente: {0}",
  "Nothing was removed": "No se ha quitado nada",
  "Undo": "Deshacer",
  "Replaced {0} with links": "Sustituido por vínculos: {0}",
  "Nothing was replaced": "No se ha sustituido nada",
  "{0} freed. Every file still opens under its own name.": "{0} liberados. Cada archivo sigue abriéndose con su propio nombre.",
  "{0} skipped: {1}{2}": "{0}: {1}{2}",
  "Nothing in the basket is in the scan any more.": "Nada de la cesta sigue en el análisis.",
  "What goes is taken out of the basket.": "Lo que se elimina sale de la cesta.",

  // ----- Words counted with plural() -----
  "file": "archivo",
  "files": "archivos",
  "matching file": "archivo que coincide",
  "matching files": "archivos que coinciden",
  "folder": "carpeta",
  "folders": "carpetas",
  "item": "elemento",
  "items": "elementos",
  "item selected": "elemento seleccionado",
  "items selected": "elementos seleccionados",
  "item was": "elemento eliminado",
  "items were": "elementos eliminados",
  "item wasn't": "elemento ya no estaba",
  "items weren't": "elementos ya no estaban",
  "copy": "copia",
  "copies": "copias",
  "copy was": "copia omitida",
  "copies were": "copias omitidas",
  "group": "grupo",
  "groups": "grupos",
  "hash": "hash",
  "hashes": "hashes",
  "row": "fila",
  "rows": "filas",

  // ----- Selection and context menu -----
  "Copy paths": "Copiar rutas",
  "Clear selection": "Borrar selección",
  "Add to basket": "Añadir a la cesta",
  "Move {0} to Recycle Bin": "Mover {0} a la Papelera de reciclaje",
  "Zoom in": "Acercar",
  "Refresh this folder": "Actualizar esta carpeta",
  "Try reading it again": "Intentar leerla de nuevo",
  "Open": "Abrir",
  "Show in Explorer": "Mostrar en el Explorador",
  "Copy path": "Copiar ruta",
  "Move to Recycle Bin": "Mover a la Papelera de reciclaje",
  "Colour files by": "Colorear archivos por",
  "File type": "Tipo de archivo",
  "Age (last changed)": "Antigüedad (última modificación)",
  "Cushion shading": "Sombreado en relieve",
  "All drives": "Todas las unidades",

  // ----- Basket -----
  "The basket is empty": "La cesta está vacía",
  "Add things from the map (right-click › Add to basket), from Duplicates or from Cleanup, then recycle them all here in one go.":
    "Añade cosas desde el mapa (clic derecho › Añadir a la cesta), desde Duplicados o desde Limpieza, y envíalas todas aquí a la Papelera de una vez.",
  "{0}, about {1} on disk. Nothing is removed until you recycle them.":
    "{0}, unos {1} en disco. No se quita nada hasta que los envíes a la Papelera.",
  "Take {0} out of the basket": "Sacar {0} de la cesta",
  "Empty the basket": "Vaciar la cesta",
  "Recycle all": "Todo a la Papelera",

  // ----- Changes -----
  "Folder by folder": "Carpeta a carpeta",
  "Grew": "Creció",
  "Shrank": "Se redujo",
  "New": "Nuevo",
  "Gone": "Ya no está",
  "on disk": "en disco",
  "size": "tamaño",
  "Changes since a snapshot": "Cambios desde una instantánea",
  "Changes in {0} since": "Cambios en {0} desde",
  "Stop comparing": "Dejar de comparar",
  "Then": "Antes",
  "Now": "Ahora",
  "Change": "Cambio",
  "By {0}. Files: {1} then, {2} now. Items are matched by path.":
    "Por {0}. Archivos: {1} antes, {2} ahora. Los elementos se emparejan por su ruta.",
  "Show": "Mostrar",
  "Folder": "Carpeta",
  "Comparing": "Comparando",
  "Nothing here": "Aquí no hay nada",
  "This folder is empty in both scans.": "Esta carpeta está vacía en los dos análisis.",
  "No items of this kind changed.": "No ha cambiado ningún elemento de este tipo.",
  "Show on the map": "Mostrar en el mapa",
  "The largest new or gone items; a new folder is listed once, not every file in it.":
    "Los elementos nuevos o desaparecidos más grandes; una carpeta nueva aparece una vez, no cada archivo que contiene.",
  "Up to 150 files that changed most. Folders are compared on the Folder by folder tab.":
    "Hasta 150 archivos que más han cambiado. Las carpetas se comparan en la pestaña «Carpeta a carpeta».",

  // ----- Cleanup -----
  "Cleanup suggestions": "Sugerencias de limpieza",
  "Cleanup suggestions in": "Sugerencias de limpieza en",
  "Caches, temp files and build output that apps rebuild on their own":
    "Cachés, archivos temporales y resultados de compilación que las aplicaciones vuelven a crear solas",
  "Look again": "Buscar de nuevo",
  "Looking for junk": "Buscando archivos innecesarios",
  "Nothing to clean up here": "No hay nada que limpiar aquí",
  "No caches, temp files or build output of 1 MB or more were found in this scan.":
    "En este análisis no se han encontrado cachés, archivos temporales ni resultados de compilación de 1 MB o más.",
  "Safe to remove": "Se puede quitar sin riesgo",
  "Review first": "Revisar primero",
  "Selected": "Seleccionado",
  "Select everything safe": "Seleccionar todo lo seguro",
  "Clear": "Borrar",
  "Select all {0}": "Seleccionar los {0}",
  "Safe": "Seguro",
  "For information": "Informativo",
  "Select {0}": "Seleccionar {0}",
  "Show fewer": "Mostrar menos",
  "Show all {0}": "Mostrar los {0}",
  " (largest {0} of {1})": " (los {0} más grandes de {1})",
  "{0} selected · frees about {1}": "{0} seleccionados · libera unos {1}",
  "Tick what you want gone. Nothing is removed until you confirm.":
    "Marca lo que quieras quitar. No se quita nada hasta que lo confirmes.",
  "Collect them in the basket and recycle everything there in one go":
    "Reunirlos en la cesta y enviarlo todo allí a la Papelera de una vez",
  "Files a program is still using are skipped and listed afterwards.":
    "Los archivos que un programa aún está usando se omiten y se enumeran después.",
  // Categories from the Rust side (junk.rs)
  "Temporary files": "Archivos temporales",
  "Files programs leave behind in the temp folders. Anything still in use is skipped.":
    "Archivos que los programas dejan en las carpetas temporales. Lo que aún está en uso se omite.",
  "Browser and app caches": "Cachés de navegadores y aplicaciones",
  "Copies of web pages, images and scripts kept to load faster. They refill as you browse.":
    "Copias de páginas web, imágenes y scripts guardadas para cargar más rápido. Se vuelven a llenar al navegar.",
  "Graphics shader caches": "Cachés de sombreadores gráficos",
  "Compiled shaders from graphics drivers and games. Rebuilt the next time each game runs.":
    "Sombreadores compilados de controladores gráficos y juegos. Se vuelven a crear la próxima vez que se abre cada juego.",
  "Crash dumps and error reports": "Volcados de bloqueo e informes de errores",
  "Memory dumps and reports written when programs crash. Only useful for debugging.":
    "Volcados de memoria e informes que se escriben cuando los programas se bloquean. Solo sirven para depurar.",
  "Windows Update downloads": "Descargas de Windows Update",
  "Update packages that were already installed. Removing them may need administrator rights.":
    "Paquetes de actualización ya instalados. Quitarlos puede requerir permisos de administrador.",
  "Developer build output": "Resultados de compilación",
  "node_modules, Rust target folders and Python caches. Rebuilt by npm install, cargo build and so on.":
    "node_modules, carpetas target de Rust y cachés de Python. Se vuelven a crear con npm install, cargo build, etc.",
  "Package manager caches": "Cachés de gestores de paquetes",
  "Downloaded packages kept by npm, pip, Cargo, NuGet, Gradle and Yarn. Downloaded again when needed.":
    "Paquetes descargados que guardan npm, pip, Cargo, NuGet, Gradle y Yarn. Se vuelven a descargar cuando hace falta.",
  "Teams and Slack caches": "Cachés de Teams y Slack",
  "Cached messages, pictures and web pages of Microsoft Teams and Slack. Quit them first; they may ask you to sign in again.":
    "Mensajes, imágenes y páginas web en caché de Microsoft Teams y Slack. Ciérralos antes; puede que te pidan volver a iniciar sesión.",
  "Large log files": "Archivos de registro grandes",
  "Log files of 1 MB or more. Usually safe, but check none is a log you need.":
    "Archivos de registro de 1 MB o más. Normalmente es seguro, pero comprueba que ninguno sea un registro que necesites.",
  "Old installers in Downloads": "Instaladores antiguos en Descargas",
  "Setup files in Downloads not changed for 30 days or more. Usually no longer needed once installed.":
    "Archivos de instalación en Descargas sin cambios desde hace 30 días o más. Una vez instalados, no suelen hacer falta.",
  "Big files not opened in a year": "Archivos grandes sin abrir en un año",
  "Files of 100 MB or more that nobody has opened or changed for a year. Check each one: some are kept on purpose, like backups.":
    "Archivos de 100 MB o más que nadie ha abierto ni cambiado en un año. Revísalos uno a uno: algunos se guardan a propósito, como las copias de seguridad.",
  "Your rules": "Tus reglas",
  "Matches for the rules in Settings › Cleanup rules.": "Coincidencias con las reglas de Configuración › Reglas de limpieza.",
  "WSL and Docker disk images": "Imágenes de disco de WSL y Docker",
  "Virtual disks of Linux distributions and Docker. Deleting one erases everything in it, so they can't be selected here. To shrink them, use docker system prune or wsl --manage <distro> --set-sparse true.":
    "Discos virtuales de distribuciones Linux y de Docker. Eliminar uno borra todo lo que contiene, así que aquí no se pueden seleccionar. Para reducirlos, usa docker system prune o wsl --manage <distro> --set-sparse true.",

  // ----- Confirmations -----
  "Delete {0} permanently?": "¿Eliminar {0} permanentemente?",
  "Move {0} to the Recycle Bin?": "¿Mover {0} a la Papelera de reciclaje?",
  "This can't be undone": "No se puede deshacer",
  "Nothing goes to the Recycle Bin: 1 item ({0}) will be deleted for good, with no way to restore it.":
    "Nada va a la Papelera de reciclaje: 1 elemento ({0}) se eliminará para siempre, sin forma de restaurarlo.",
  "Nothing goes to the Recycle Bin: {0} items ({1}) will be deleted for good, with no way to restore them.":
    "Nada va a la Papelera de reciclaje: {0} elementos ({1}) se eliminarán para siempre, sin forma de restaurarlos.",
  "This frees about {0} once the Recycle Bin is emptied, and you can restore anything from there until then.":
    "Esto libera unos {0} cuando se vacíe la Papelera de reciclaje, y hasta entonces puedes restaurar cualquier cosa desde allí.",
  "Delete permanently": "Eliminar permanentemente",
  "Delete permanently…": "Eliminar permanentemente…",
  "Cancel": "Cancelar",
  "Delete permanently?": "¿Eliminar permanentemente?",
  "Move to Recycle Bin?": "¿Mover a la Papelera de reciclaje?",
  "It won't go to the Recycle Bin: it will be deleted for good, with no way to restore it.":
    "No irá a la Papelera de reciclaje: se eliminará para siempre, sin forma de restaurarlo.",

  // ----- Recycle Bin check -----
  "Couldn't check the Recycle Bin": "No se ha podido comprobar la Papelera de reciclaje",
  "Checking the Recycle Bin…": "Comprobando la Papelera de reciclaje…",
  "about {0}": "unos {0}",
  "These can't go to the Recycle Bin": "Estos no pueden ir a la Papelera de reciclaje",
  "{0} can't go to the Recycle Bin": "{0} no puede ir a la Papelera de reciclaje",
  "Windows would delete it permanently, with no way to restore it: {0}.":
    "Windows lo eliminaría permanentemente, sin forma de restaurarlo: {0}.",
  "Windows would delete them permanently, with no way to restore them.":
    "Windows los eliminaría permanentemente, sin forma de restaurarlos.",
  "Windows would delete these permanently, with no way to restore them.":
    "Windows eliminaría estos permanentemente, sin forma de restaurarlos.",
  "and {0} more": "y {0} más",
  "Delete it permanently ({0})": "Eliminarlo permanentemente ({0})",
  "Delete these {0} permanently ({1})": "Eliminar estos {0} permanentemente ({1})",
  "Left unticked, they're skipped and everything else goes to the Recycle Bin.":
    "Si no los marcas, se omiten y todo lo demás va a la Papelera de reciclaje.",
  "The Recycle Bin will make room": "La Papelera de reciclaje hará sitio",
  "The Recycle Bin on {0} holds {1} and already has {2}. Windows will permanently remove about {3} of the oldest things in it to fit these.":
    "La Papelera de reciclaje de {0} admite {1} y ya contiene {2}. Windows quitará permanentemente unos {3} de lo más antiguo que hay en ella para que quepan estos.",
  "Online-only OneDrive files skip the Recycle Bin": "Los archivos de OneDrive solo en línea no pasan por la Papelera",
  "This holds {0} of files that are only in the cloud.": "Contiene {0} de archivos que solo están en la nube.",
  "1 of these holds {0} of files that are only in the cloud.": "1 de ellos contiene {0} de archivos que solo están en la nube.",
  "{0} of these hold {1} of files that are only in the cloud.": "{0} de ellos contienen {1} de archivos que solo están en la nube.",
  "Deleting them removes them from OneDrive on all your devices. They can be restored from the OneDrive recycle bin on the web for 30 days (93 for work or school accounts), but not from Windows' Recycle Bin, and Undo can't bring them back.":
    "Eliminarlos los quita de OneDrive en todos tus dispositivos. Se pueden restaurar desde la papelera de OneDrive en la web durante 30 días (93 en cuentas profesionales o educativas), pero no desde la Papelera de reciclaje de Windows, y «Deshacer» no puede recuperarlos.",
  "Everything fits in the Recycle Bin on {0} ({1} of {2} used), so it can all be restored.":
    "Todo cabe en la Papelera de reciclaje de {0} ({1} de {2} usados), así que se puede restaurar todo.",
  "Everything fits in the Recycle Bin on {0}, so it can all be restored.":
    "Todo cabe en la Papelera de reciclaje de {0}, así que se puede restaurar todo.",
  "Nothing can be recycled": "No se puede enviar nada a la Papelera",
  "Recycle and delete the rest": "A la Papelera y eliminar el resto",
  "Recycle {0}, skip {1}": "{0} a la Papelera, omitir {1}",
  // Reasons from the Rust side (recyclebin.rs)
  "{0} has no Recycle Bin": "{0} no tiene Papelera de reciclaje",
  "the Recycle Bin on {0} is set to delete files right away":
    "la Papelera de reciclaje de {0} está configurada para eliminar los archivos al momento",
  "bigger than the Recycle Bin on {0}, which holds {1}": "más grande que la Papelera de reciclaje de {0}, que admite {1}",

  // ----- Duplicates -----
  "Duplicate files": "Archivos duplicados",
  "Find duplicates in": "Buscar duplicados en",
  "Only files that match the filter are compared": "Solo se comparan los archivos que coinciden con el filtro",
  "Files from": "Archivos desde",
  "Smallest file to check": "Archivo más pequeño que se comprueba",
  "Search again": "Buscar de nuevo",
  "Find duplicates": "Buscar duplicados",
  "Comparing whole files": "Comparando archivos completos",
  "Comparing the start and end of same-size files": "Comparando el principio y el final de archivos del mismo tamaño",
  "{0} of {1} files": "{0} de {1} archivos",
  "Starting…": "Iniciando…",
  " · {0} read · {1}": " · {0} leídos · {1}",
  "Duplicate search progress": "Progreso de la búsqueda de duplicados",
  "Find files that are stored more than once": "Encuentra archivos guardados más de una vez",
  "Disq Studio compares files of the same size, first by their start and end, then by their whole contents. Online-only cloud files are skipped, so nothing gets downloaded, and files that haven't changed since an earlier search aren't read again.":
    "Disq Studio compara archivos del mismo tamaño, primero por su principio y su final, luego por todo su contenido. Los archivos de la nube solo en línea se omiten, así que no se descarga nada, y los archivos que no han cambiado desde una búsqueda anterior no se vuelven a leer.",
  "Can be freed": "Se puede liberar",
  "Extra copies": "Copias de más",
  "Groups": "Grupos",
  "In {0}: checked {1} with a same-size twin in {2}.": "En {0}: comprobados {1} con un gemelo del mismo tamaño en {2}.",
  " {0} remembered from earlier searches.": " {0} recordados de búsquedas anteriores.",
  " {0} couldn't be read.": " {0} no se han podido leer.",
  " Showing the {0} groups that waste the most.": " Se muestran los {0} grupos que más espacio desperdician.",
  " The scan has changed since; search again for current results.":
    " El análisis ha cambiado desde entonces; vuelve a buscar para obtener resultados actuales.",
  "No duplicates found": "No se han encontrado duplicados",
  "No two files of {0} or more have the same contents here.": "Aquí no hay dos archivos de {0} o más con el mismo contenido.",
  "Only groups with a copy in… (path or *pattern)": "Solo grupos con una copia en… (ruta o *patrón)",
  "Show only groups with a copy whose path matches": "Mostrar solo grupos con una copia cuya ruta coincida",
  "All types": "Todos los tipos",
  "Highlight the extra copies (all but the oldest of each) on the map":
    "Resaltar en el mapa las copias de más (todas menos la más antigua de cada grupo)",
  "{0} of duplicate files": "{0} de archivos duplicados",
  "Show on map": "Mostrar en el mapa",
  "Select extra copies in the groups shown:": "Seleccionar copias de más en los grupos mostrados:",
  "Select extra copies:": "Seleccionar copias de más:",
  "Keep oldest": "Conservar la más antigua",
  "Keep newest": "Conservar la más reciente",
  "Keep shortest path": "Conservar la ruta más corta",
  "No groups match": "Ningún grupo coincide",
  "No duplicate group has a copy matching that path and type.":
    "Ningún grupo de duplicados tiene una copia que coincida con esa ruta y ese tipo.",
  "Keep at least one copy": "Conserva al menos una copia",
  "Select every copy in {0}": "Seleccionar todas las copias en {0}",
  "Show {0} more groups": "Mostrar {0} grupos más",
  "{0} selected · frees {1}": "{0} seleccionadas · libera {1}",
  "Select the copies you don't need. One copy in each group always stays.":
    "Selecciona las copias que no necesitas. Siempre se queda una copia de cada grupo.",
  "Keep every name, but store the data once: each selected copy becomes a hard link to the copy that stays":
    "Conservar todos los nombres, pero guardar los datos una sola vez: cada copia seleccionada pasa a ser un vínculo físico a la copia que se queda",
  "Replace with links": "Sustituir por vínculos",
  "Replace {0} with links?": "¿Sustituir {0} por vínculos?",
  "Every file stays where it is and opens as before, but the data is stored once, freeing about {0}. Each selected copy becomes a hard link: another name for the copy that stays.":
    "Cada archivo se queda donde está y se abre como antes, pero los datos se guardan una sola vez, lo que libera unos {0}. Cada copia seleccionada pasa a ser un vínculo físico: otro nombre para la copia que se queda.",
  "Linked names share one file": "Los nombres vinculados comparten un archivo",
  "Editing a linked file changes it under every name. Use this for files you only keep, like photos, music, installers or downloads, not for copies you mean to edit separately. Copies that changed since the search, or are on another drive, are skipped.":
    "Editar un archivo vinculado lo cambia con todos sus nombres. Úsalo para archivos que solo guardas, como fotos, música, instaladores o descargas, no para copias que quieras editar por separado. Las copias que han cambiado desde la búsqueda, o que están en otra unidad, se omiten.",
  // Errors from the Rust side (dupes.rs)
  "{0} changed since the search": "{0} ha cambiado desde la búsqueda",
  "already the same file": "ya es el mismo archivo",
  "the contents differ now": "el contenido ahora es distinto",

  // ----- Export -----
  "Web page": "Página web",
  "A report to read or share: totals, contents with bars, file types, largest files.":
    "Un informe para leer o compartir: totales, contenido con barras, tipos de archivo, archivos más grandes.",
  "One row per item, for Excel or another spreadsheet.": "Una fila por elemento, para Excel u otra hoja de cálculo.",
  "One object per item, for scripts and other tools.": "Un objeto por elemento, para scripts y otras herramientas.",
  "1 level": "1 nivel",
  "2 levels": "2 niveles",
  "3 levels": "3 niveles",
  "Everything": "Todo",
  "Any size": "Cualquier tamaño",
  "1 MB or more": "1 MB o más",
  "100 MB or more": "100 MB o más",
  "1 GB or more": "1 GB o más",
  "Disk": "Disco",
  "Export a report": "Exportar un informe",
  "{0} - Disq Studio report.{1}": "{0} - Informe de Disq Studio.{1}",
  "Export": "Exportar",
  "Format": "Formato",
  "How deep": "Profundidad",
  "Levels of folders below {0}.": "Niveles de carpetas por debajo de {0}.",
  "Leave out items smaller than": "Excluir elementos de menos de",
  "Include files": "Incluir archivos",
  "Off: folders only.": "Desactivado: solo carpetas.",
  "Every item, of any size: for a whole drive that's a file with millions of rows.":
    "Todos los elementos, de cualquier tamaño: para una unidad entera es un archivo con millones de filas.",
  "A filter is on, so only matching files are counted, as on screen.":
    "Hay un filtro activo, así que solo se cuentan los archivos que coinciden, como en pantalla.",
  "Export…": "Exportar…",

  // ----- Filter -----
  "Any time": "Cualquier fecha",
  "Changed in the last 30 days": "Modificado en los últimos 30 días",
  "Not changed for 1 year": "Sin cambios desde hace 1 año",
  "Not changed for 3 years": "Sin cambios desde hace 3 años",
  "This search is saved": "Esta búsqueda está guardada",
  "Save this search": "Guardar esta búsqueda",
  "Saved searches": "Búsquedas guardadas",
  "Forget this search": "Olvidar esta búsqueda",
  "Search names: node_modules *.js, *.mp4|*.mkv, -*.log, Users\\Me\\Videos…":
    "Buscar nombres: node_modules *.js, *.mp4|*.mkv, -*.log, Users\\Yo\\Videos…",
  "Search file and folder names. Separate terms with spaces; all must match. a|b matches either, -term leaves matches out, a term with a backslash matches the full path.":
    "Busca nombres de archivos y carpetas. Separa los términos con espacios; todos deben coincidir. a|b coincide con cualquiera de los dos, -término excluye coincidencias, un término con una barra invertida coincide con la ruta completa.",
  "Terms separated by spaces must all match a name or a folder above it. a|b: either. -term: leave out. A term with \\ matches the full path. Quotes keep spaces.":
    "Los términos separados por espacios deben coincidir todos con un nombre o con una carpeta superior. a|b: cualquiera de los dos. -término: excluir. Un término con \\ coincide con la ruta completa. Las comillas mantienen los espacios.",
  "Ctrl+F": "Ctrl+F",
  "File types": "Tipos de archivo",
  "Minimum file size": "Tamaño mínimo de archivo",
  "Last changed": "Última modificación",
  "Filtering": "Filtrando",

  // ----- Folder list -----
  "Folder contents": "Contenido de la carpeta",
  "List": "Lista",
  "Matches": "Coincidencias",
  "This folder": "Esta carpeta",
  "Move every match to the Recycle Bin, after a check of what the Recycle Bin can take":
    "Mover todas las coincidencias a la Papelera de reciclaje, tras comprobar lo que admite",
  "Contents of {0}": "Contenido de {0}",
  "Loading": "Cargando",
  "Nothing in this folder matches": "Nada de esta carpeta coincide",
  "This folder is empty": "Esta carpeta está vacía",
  " · {0} online only": " · {0} solo en línea",
  "{0} · couldn't be read": "{0} · no se ha podido leer",
  "{0} · skipped by Settings › Folders to skip, so its size isn't counted":
    "{0} · omitida en Configuración › Carpetas omitidas, así que su tamaño no se cuenta",
  "{0} · hard link, counted once under its other name": "{0} · vínculo físico, contado una vez con su otro nombre",
  "Columns": "Columnas",
  " (needs a wider list)": " (necesita una lista más ancha)",
  "Sort by {0}": "Ordenar por {0}",
  "Resize {0}": "Cambiar el ancho de {0}",
  "Nothing matches": "Nada coincide",
  "Try fewer terms or conditions, or part of a name instead of all of it.":
    "Prueba con menos términos o condiciones, o con parte de un nombre en vez del nombre entero.",
  "Showing the largest {0} of {1} matches": "Se muestran las {0} más grandes de {1} coincidencias",
  "Name": "Nombre",
  "Share": "Proporción",

  // ----- History -----
  "Save this scan as a snapshot": "Guardar este análisis como instantánea",
  "Disq Studio snapshot.dss": "Instantánea de Disq Studio.dss",
  "Compare with a snapshot": "Comparar con una instantánea",
  "Open a snapshot": "Abrir una instantánea",
  "History": "Historial",
  " of {0}": " de {0}",
  "Each finished scan is kept as a snapshot (the newest 8 of each location), so you can see what changed since. Compare one with the scan in view, or open it to look around as it was.":
    "Cada análisis terminado se guarda como instantánea (las 8 más recientes de cada ubicación), para que veas lo que ha cambiado desde entonces. Compara una con el análisis que se muestra, o ábrela para ver cómo estaba.",
  "Show snapshots of every location": "Mostrar instantáneas de todas las ubicaciones",
  "Reading the history": "Leyendo el historial",
  "No snapshots yet": "Aún no hay instantáneas",
  "Save one now, or it'll be saved after the next scan.": "Guarda una ahora, o se guardará tras el próximo análisis.",
  "Scan a drive or folder to start the history.": "Analiza una unidad o carpeta para empezar el historial.",
  "{0} on disk · {1}": "{0} en disco · {1}",
  " · {0} since": " · {0} desde entonces",
  "Compare": "Comparar",
  "Delete this snapshot": "Eliminar esta instantánea",
  "{0} of snapshots.": "{0} de instantáneas.",
  "Show folder": "Mostrar carpeta",
  "Open a file…": "Abrir un archivo…",
  "Compare with a file…": "Comparar con un archivo…",
  "Save as…": "Guardar como…",
  "Save snapshot now": "Guardar instantánea ahora",

  // ----- Home -----
  "See what's filling your drive.": "Mira qué está llenando tu unidad.",
  "Pick a drive or folder. Disq Studio reads it on every core, then draws each file as a block sized by the space it takes, so the biggest things are impossible to miss.":
    "Elige una unidad o carpeta. Disq Studio la lee con todos los núcleos y dibuja cada archivo como un bloque del tamaño del espacio que ocupa, así que lo más grande salta a la vista.",
  "Refresh drives": "Actualizar unidades",
  "Looking for drives": "Buscando unidades",
  "Local Disk": "Disco local",
  "Drive": "Unidad",
  "Unknown": "Desconocido",
  "{0}% used": "{0} % usado",
  "{0} free of {1}": "{0} libres de {1}",
  "Choose a folder…": "Elegir una carpeta…",
  "Scan just one folder and what's inside it": "Analizar solo una carpeta y su contenido",

  // ----- Details -----
  "Takes {0} more on disk than its size. Many small files waste the unused end of each cluster.":
    "Ocupa {0} más en disco que su tamaño. Muchos archivos pequeños desperdician el final sin usar de cada clúster.",
  "Online only: the data is in the cloud, not on this drive. Opening it downloads it.":
    "Solo en línea: los datos están en la nube, no en esta unidad. Al abrirlo se descarga.",
  "Takes no space of its own: it's small enough to live in the file table.":
    "No ocupa espacio propio: es tan pequeño que cabe en la tabla de archivos.",
  "Takes {0} less on disk than its size, because {1} of it is online only.":
    "Ocupa {0} menos en disco que su tamaño, porque {1} están solo en línea.",
  "Takes {0} less on disk than its size: {1} is online only, the rest is saved by compression or sparse files.":
    "Ocupa {0} menos en disco que su tamaño: {1} están solo en línea, el resto se ahorra por compresión o archivos dispersos.",
  "Takes {0} less on disk than its size, from compression or sparse files.":
    "Ocupa {0} menos en disco que su tamaño, por compresión o archivos dispersos.",
  "Details": "Detalles",
  "Selection": "Selección",
  "Adding up the selection": "Sumando la selección",
  "matching the filter, on disk": "que coinciden con el filtro, en disco",
  "matching the filter, size": "que coinciden con el filtro, tamaño",
  "Size": "Tamaño",
  "On disk": "En disco",
  "Files": "Archivos",
  "Inside others": "Dentro de otros",
  "Selected items that are inside another selected folder; they're counted with it":
    "Elementos seleccionados que están dentro de otra carpeta seleccionada; se cuentan con ella",
  "Recycle": "A la Papelera",
  "Recycle {0}": "{0} a la Papelera",
  "Ctrl+click adds or removes an item; Shift+click in the list selects a range.":
    "Ctrl+clic añade o quita un elemento; Mayús+clic en la lista selecciona un intervalo.",
  "Current folder": "Carpeta actual",
  "File": "Archivo",
  "Hard links here that point at data counted under another name":
    "Vínculos físicos de aquí que apuntan a datos contados con otro nombre",
  "Hard links": "Vínculos físicos",
  "counted once": "contados una vez",
  "Of parent folder": "De la carpeta superior",
  "Of whole scan": "De todo el análisis",
  "Folders": "Carpetas",
  "Modified": "Modificado",
  "Bytes": "Bytes",
  "Hard link": "Vínculo físico",
  "The same {0} of data also has another name, and it's counted there so it isn't counted twice. Recycling only this name frees no space.":
    "Los mismos {0} de datos tienen también otro nombre, y se cuentan allí para no contarlos dos veces. Enviar solo este nombre a la Papelera no libera espacio.",
  "Select the counted name": "Seleccionar el nombre contado",
  "Skipped because it's in Settings › Folders to skip, so its size isn't counted.":
    "Omitida porque está en Configuración › Carpetas omitidas, así que su tamaño no se cuenta.",
  "Windows didn't allow this folder to be read, so its size isn't counted.":
    "Windows no ha dejado leer esta carpeta, así que su tamaño no se cuenta.",
  "File types in {0}": "Tipos de archivo en {0}",
  "Counting file types": "Contando tipos de archivo",
  "No files here.": "Aquí no hay archivos.",
  "Share of space by file type": "Proporción del espacio por tipo de archivo",
  "Top extensions": "Extensiones principales",
  "no extension": "sin extensión",
  "Largest files": "Archivos más grandes",
  "Finding the largest files": "Buscando los archivos más grandes",

  // ----- Scan -----
  "Scan progress": "Progreso del análisis",
  " · {0} folders skipped": " · {0} carpetas omitidas",

  // ----- Settings -----
  "Dark": "Oscuro",
  "Light": "Claro",
  "Follow Windows": "Como Windows",
  "Downloading…": "Descargando…",
  "Downloading… {0}%": "Descargando… {0} %",
  "Export settings": "Exportar configuración",
  "Disq Studio settings.json": "Configuración de Disq Studio.json",
  "Saved to {0}.": "Guardado en {0}.",
  "Import settings": "Importar configuración",
  "Choose a folder Disq Studio should skip": "Elige una carpeta que Disq Studio deba omitir",
  "Appearance": "Apariencia",
  "Theme": "Tema",
  "Language": "Idioma",
  "Applies when Disq Studio starts again.": "Se aplica cuando Disq Studio se vuelve a abrir.",
  "Restart now": "Reiniciar ahora",
  "Accent colour": "Color de énfasis",
  "Sizes": "Tamaños",
  "Measure by": "Medir por",
  "Size is how long files are; on disk is the space they really take.":
    "Tamaño es lo que miden los archivos; en disco es el espacio que realmente ocupan.",
  "Units": "Unidades",
  "Matches Explorer: a 500 GB drive shows as about 466 GB.": "Como el Explorador: una unidad de 500 GB aparece como unos 466 GB.",
  "Matches the box: a 500 GB drive shows as 500 GB.": "Como la caja: una unidad de 500 GB aparece como 500 GB.",
  "Like Windows (1,024)": "Como Windows (1024)",
  "Decimal (1,000)": "Decimal (1000)",
  "Folders to skip": "Carpetas omitidas",
  "These are never read. They show up as skipped, with no size, in every scan that would include them. Add a folder, or a name to skip wherever it is: {0} skips every folder of that name, {1} any with \"cache\" in it, {2} that path ending.":
    "Nunca se leen. Aparecen como omitidas, sin tamaño, en cada análisis que las incluiría. Añade una carpeta, o un nombre que se omita esté donde esté: {0} omite todas las carpetas con ese nombre, {1} cualquiera que contenga «cache», {2} ese final de ruta.",
  "Stop skipping {0}": "Dejar de omitir {0}",
  "Nothing is skipped.": "No se omite nada.",
  "Add folder…": "Añadir carpeta…",
  "or a name: node_modules, *cache*…": "o un nombre: node_modules, *cache*…",
  "Folder name or pattern to skip everywhere": "Nombre de carpeta o patrón que se omite en todas partes",
  "Add": "Añadir",
  "Rescan now to apply": "Vuelve a analizar para aplicarlo",
  "Cleanup rules": "Reglas de limpieza",
  "Your own suggestions for the Cleanup tab, under \"Your rules\". Write them like a search: a name such as {0}, or a path such as {1} (a matching folder is suggested whole).":
    "Tus propias sugerencias para la pestaña Limpieza, en «Tus reglas». Escríbelas como una búsqueda: un nombre como {0} o una ruta como {1} (una carpeta que coincide se sugiere entera).",
  "Remove the rule {0}": "Quitar la regla {0}",
  "No rules of your own yet.": "Aún no tienes reglas propias.",
  "*.bak, Renders\\scratch…": "*.bak, Renders\\borrador…",
  "New cleanup rule": "Nueva regla de limpieza",
  "Add rule": "Añadir regla",
  "Deleting": "Eliminación",
  "Offer \"Delete permanently\"": "Ofrecer «Eliminar permanentemente»",
  "Adds a button to delete confirmations that skips the Recycle Bin. Everything it deletes is gone for good, so it always asks a second time.":
    "Añade a las confirmaciones un botón que no pasa por la Papelera de reciclaje. Todo lo que elimina desaparece para siempre, así que siempre pregunta una segunda vez.",
  "Permanent delete is on.": "La eliminación permanente está activada.",
  "Keep a snapshot of every scan": "Guardar una instantánea de cada análisis",
  "The newest 8 of each drive or folder, about 30 MB each for a full C: drive. History compares them with the scan in view.":
    "Las 8 más recientes de cada unidad o carpeta, unos 30 MB cada una para una unidad C: llena. El Historial las compara con el análisis que se muestra.",
  "Daily check": "Comprobación diaria",
  "Reading…": "Leyendo…",
  "Check my drives once a day": "Comprobar mis unidades una vez al día",
  "Runs without opening a window, through Windows' Task Scheduler, and sends a notification when a drive is getting full. A check missed while the PC was off runs at the next sign-in.":
    "Se ejecuta sin abrir ninguna ventana, mediante el Programador de tareas de Windows, y envía una notificación cuando una unidad se está llenando. Una comprobación perdida con el PC apagado se ejecuta en el siguiente inicio de sesión.",
  "At": "A las",
  "Time of the daily check": "Hora de la comprobación diaria",
  "Warn when a drive has less free than": "Avisar cuando una unidad tenga libre menos de",
  "{0}% of its size": "el {0} % de su tamaño",
  "Also scan and keep history of": "Analizar también y guardar el historial de",
  "Takes a snapshot each day, and says when a drive grew {0} GB or more since the last one.":
    "Guarda una instantánea cada día y avisa cuando una unidad ha crecido {0} GB o más desde la anterior.",
  "Check now": "Comprobar ahora",
  "Scheduled in Task Scheduler.": "Programada en el Programador de tareas.",
  "Not scheduled yet.": "Aún no está programada.",
  "Off.": "Desactivada.",
  "Nothing to report: every drive has room to spare.": "Nada que informar: todas las unidades tienen espacio de sobra.",
  "Settings file": "Archivo de configuración",
  "Everything set here, saved searches and list columns, in one file: to keep a copy, or to set up another PC the same way.":
    "Todo lo que se configura aquí, las búsquedas guardadas y las columnas de las listas, en un archivo: para guardar una copia o configurar otro PC igual.",
  "Import…": "Importar…",
  "Administrator": "Administrador",
  "Running as administrator": "Ejecutándose como administrador",
  "Running normally": "Ejecutándose con normalidad",
  "Every folder can be read, and whole NTFS drives are read from their file table in a few seconds.":
    "Se pueden leer todas las carpetas, y las unidades NTFS enteras se leen desde su tabla de archivos en pocos segundos.",
  "As administrator, Disq Studio can read folders your account can't, and reads whole NTFS drives from their file table in a few seconds.":
    "Como administrador, Disq Studio puede leer carpetas que tu cuenta no puede, y lee unidades NTFS enteras desde su tabla de archivos en pocos segundos.",
  "Updates": "Actualizaciones",
  "Disq Studio is up to date": "Disq Studio está actualizado",
  "Installing the update…": "Instalando la actualización…",
  "Checks for a new version once a day": "Busca una versión nueva una vez al día",
  "It installs on its own and Disq Studio starts again, where you were.":
    "Se instala sola y Disq Studio se vuelve a abrir donde estabas.",
  "New versions come from the project's releases on GitHub, signed so only real ones install.":
    "Las versiones nuevas vienen de las publicaciones del proyecto en GitHub, firmadas para que solo se instalen las auténticas.",
  "About": "Acerca de",
  "Disq Studio {0}. Everything stays on this PC: Disq Studio doesn't send your files, folder names or usage anywhere.":
    "Disq Studio {0}. Todo se queda en este PC: Disq Studio no envía tus archivos, nombres de carpetas ni datos de uso a ninguna parte.",
  "Done": "Listo",
  "That file isn't Disq Studio settings.": "Ese archivo no es una configuración de Disq Studio.",

  // ----- Map and chart -----
  "{0}, {1}, {2} of view{3}": "{0}, {1}, {2} de la vista{3}",
  ", folder": ", carpeta",
  "Sunburst of the current folder. Left and Right move along a ring, Down goes out a ring, Up comes back, Enter zooms in.":
    "Anillos de la carpeta actual. Izquierda y Derecha se mueven por un anillo, Abajo sale un anillo, Arriba vuelve, Entrar acerca.",
  "Drawing the chart": "Dibujando el gráfico",
  "{0} · online only": "{0} · solo en línea",
  "Treemap of the current folder. Arrow keys move between blocks, ] goes into a folder, [ goes back out, Enter zooms in.":
    "Mapa de árbol de la carpeta actual. Las flechas se mueven entre bloques, ] entra en una carpeta, [ vuelve a salir, Entrar acerca.",
  "Drawing the map": "Dibujando el mapa",
  "Many small items": "Muchos elementos pequeños",
  "Folder · access denied": "Carpeta · acceso denegado",
  "Online only, not on this drive": "Solo en línea, no en esta unidad",
  "{0} free on this drive": "{0} libres en esta unidad",
  "{0} · {1} of view · {2}": "{0} · {1} de la vista · {2}",
  "Changed {0}": "Modificado: {0}",
  "Online only: stored in the cloud, not on this drive": "Solo en línea: guardado en la nube, no en esta unidad",

  // ----- File type groups and ages -----
  "Video": "Vídeo",
  "Images": "Imágenes",
  "Audio": "Audio",
  "Archives & disk images": "Archivos comprimidos e imágenes de disco",
  "Code & data": "Código y datos",
  "Documents": "Documentos",
  "Programs": "Programas",
  "System & cache": "Sistema y caché",
  "Other": "Otros",
  "changed in 30 days": "modificado en 30 días",
  "unchanged 1 year": "sin cambios en 1 año",
  "unchanged 3 years": "sin cambios en 3 años",

  // ----- Units -----
  "0 bytes": "0 bytes",
  "1 byte": "1 byte",
  "{0} bytes": "{0} bytes",
  "{0} min {1} s": "{0} min {1} s",
  "no change": "sin cambios",

  // ----- Errors from the Rust side (lib.rs, snapshot.rs, admin.rs) -----
  "Nothing has been scanned yet.": "Aún no se ha analizado nada.",
  "That item is no longer in the scan.": "Ese elemento ya no está en el análisis.",
  "There's nothing to undo.": "No hay nada que deshacer.",
  "Only folders can be refreshed.": "Solo se pueden actualizar carpetas.",
  "{0} is no longer there.": "{0} ya no existe.",
  "{0} is not a folder that can be opened.": "{0} no es una carpeta que se pueda abrir.",
  "The refresh was cancelled.": "Se ha cancelado la actualización.",
  "The scan was cancelled.": "Se ha cancelado el análisis.",
  "This is an opened snapshot; it's already saved.": "Es una instantánea abierta; ya está guardada.",
  "Only snapshots in the history can be deleted here.": "Aquí solo se pueden eliminar instantáneas del historial.",
  "That snapshot is of {0}, not {1}": "Esa instantánea es de {0}, no de {1}",
  "Nothing is being compared.": "No se está comparando nada.",
  "Settings are saved as a .json file.": "La configuración se guarda como archivo .json.",
  "Pick a .json settings file.": "Elige un archivo de configuración .json.",
  "That file is too big to be Disq Studio settings.": "Ese archivo es demasiado grande para ser una configuración de Disq Studio.",
  "Not a Disq Studio snapshot, or a damaged one: {0}": "No es una instantánea de Disq Studio, o está dañada: {0}",
  "This snapshot was saved by a newer Disq Studio. Update to open it.":
    "Esta instantánea se guardó con un Disq Studio más reciente. Actualiza para abrirla.",
  "Restarting as administrator is only available on Windows.": "Reiniciar como administrador solo es posible en Windows.",

  // ----- Mixed text -----
  "in {0}": "en {0}",
  "{0} excluded": "{0} excluidas",
  "{0} skipped": "{0} omitidas",
  "Scanning {0}…": "Analizando {0}…",
  "{0} of {1}": "{0} de {1}",
  "{0} extra": "{0} de más",
  "oldest": "más antigua",
  "{0} selected": "{0} seleccionados",
  "{0} used": "{0} usados",
  "fixed": "fijo",
  "removable": "extraíble",
  "network": "red",
  "optical": "óptico",
  "RAM disk": "disco RAM",
};
