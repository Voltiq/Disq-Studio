/*
 * French, addressing the reader as "vous", as Windows does. The key is the
 * English text as it stands in the source; a key that is missing here
 * shows in English. src/lib/i18n.test.ts reports the ones without a
 * translation.
 *
 * Terms, as in Windows: the Recycle Bin is the "Corbeille", on disk is
 * "sur le disque", a snapshot is an "instantané", sizes are in octets
 * (Ko, Mo, Go). The cleanup basket is the "panier", so it isn't confused
 * with the Corbeille.
 */
export const fr: Record<string, string> = {
  // ----- Window and toolbar -----
  "Minimise": "Réduire",
  "Maximise": "Agrandir",
  "Restore": "Niveau inférieur",
  "Close window": "Fermer la fenêtre",
  "Running as administrator: every folder can be read": "Exécuté en tant qu’administrateur : tous les dossiers peuvent être lus",
  "Admin": "Admin",
  "Theme: dark": "Thème : sombre",
  "Theme: light": "Thème : clair",
  "Theme: follow Windows": "Thème : comme Windows",
  "Something went wrong": "Un problème est survenu",
  "Scanning": "Analyse en cours",
  "No scan yet": "Aucune analyse",
  "Measure sizes by": "Mesurer les tailles par",
  "How long each file is, like Explorer's Size column": "La longueur de chaque fichier, comme la colonne Taille de l’Explorateur",
  "Space actually used on the drive: whole clusters, after compression, without online-only cloud files":
    "Espace réellement utilisé sur le lecteur : clusters entiers, après compression, sans les fichiers cloud disponibles uniquement en ligne",
  "Scan this location again": "Analyser à nouveau cet emplacement",
  "Rescan": "Réanalyser",
  "History: earlier scans, and what changed since": "Historique : analyses précédentes et ce qui a changé depuis",
  "Export a report of the folder in view": "Exporter un rapport du dossier affiché",
  "Cleanup basket: {0}": "Panier de nettoyage : {0}",
  "Cleanup basket": "Panier de nettoyage",
  "Hide details": "Masquer les détails",
  "Show details": "Afficher les détails",
  "Settings": "Paramètres",
  "Resize the folder list": "Redimensionner la liste des dossiers",
  "Drag to resize; double-click to reset": "Faites glisser pour redimensionner ; double-cliquez pour réinitialiser",
  "Location": "Emplacement",
  "Back": "Précédent",
  "Up one level": "Niveau supérieur",
  "Chart": "Graphique",
  "Treemap": "Carte proportionnelle",
  "Treemap: blocks sized by space used": "Carte proportionnelle : des blocs à la taille de l’espace utilisé",
  "Sunburst": "Anneaux",
  "Sunburst: rings out from this folder, one per level": "Anneaux : depuis ce dossier vers l’extérieur, un par niveau",
  "Map options": "Options de la carte",
  "Refreshing…": "Actualisation…",
  "Showing {0}": "Affiché : {0}",
  "Stop": "Arrêter",
  "Colours by when files last changed": "Couleurs selon la dernière modification des fichiers",
  "Free space": "Espace libre",
  "File types: click one to show only that type": "Types de fichiers : cliquez sur l’un d’eux pour n’afficher que ce type",
  "Stop showing only {0}": "Ne plus afficher uniquement {0}",
  "Show only {0}": "Afficher uniquement {0}",
  "Online only": "En ligne uniquement",
  "Report exported": "Rapport exporté",
  "{0} in {1}": "{0} en {1}",
  "Dismiss": "Ignorer",
  "Close": "Fermer",
  "View": "Affichage",
  "Map": "Carte",
  "Duplicates": "Doublons",
  "Cleanup": "Nettoyage",
  "Changes": "Modifications",
  "Not for a snapshot: scan again to look for duplicates":
    "Indisponible pour un instantané : réanalysez pour rechercher des doublons",
  "Not for a snapshot: scan again to clean up": "Indisponible pour un instantané : réanalysez pour nettoyer",
  "A filter is on: the map, lists and totals only count matching files":
    "Un filtre est actif : la carte, les listes et les totaux ne comptent que les fichiers correspondants",
  "Filtered · {0} in {1}": "Filtré · {0} en {1}",
  "An earlier scan, opened from History. Nothing can be deleted from it; Rescan to see the drive as it is now.":
    "Une analyse précédente, ouverte depuis l’Historique. Rien ne peut y être supprimé ; réanalysez pour voir le lecteur tel qu’il est maintenant.",
  "Snapshot · {0}": "Instantané · {0}",
  "Online-only cloud files (OneDrive and similar). Their data isn't on this drive; switch to On disk to leave them out.":
    "Fichiers cloud disponibles uniquement en ligne (OneDrive et similaires). Leurs données ne sont pas sur ce lecteur ; passez à « Sur le disque » pour les exclure.",
  "{0} online only": "{0} en ligne uniquement",
  "Folders left out by Settings › Folders to skip": "Dossiers exclus dans Paramètres › Dossiers ignorés",
  "Read from the drive's file table in one go. Includes NTFS's own files ($MFT and others) and System Volume Information.":
    "Lu en une seule fois depuis la table des fichiers du lecteur. Comprend les fichiers propres à NTFS ($MFT et autres) et System Volume Information.",
  "File table": "Table des fichiers",
  "Folders Windows didn't allow to be read, even as administrator. Their sizes aren't counted.":
    "Dossiers que Windows n’a pas permis de lire, même en tant qu’administrateur. Leur taille n’est pas comptée.",
  "Folders your account isn't allowed to read; their sizes aren't counted. Click to restart as administrator and read them too.":
    "Dossiers que votre compte n’a pas le droit de lire ; leur taille n’est pas comptée. Cliquez pour redémarrer en tant qu’administrateur et les lire aussi.",
  "Restart as administrator": "Redémarrer en tant qu’administrateur",

  // ----- Messages -----
  "Disq Studio {0} is available": "Disq Studio {0} est disponible",
  "It installs in a moment, then Disq Studio starts again. Or later, from Settings › Updates.":
    "La mise à jour s’installe dans un instant, puis Disq Studio redémarre. Ou plus tard, depuis Paramètres › Mises à jour.",
  "Install and restart": "Installer et redémarrer",
  "Refreshed {0}": "Actualisé : {0}",
  "Still {0}.": "Toujours {0}.",
  "Now {0}, {1} more than before.": "Maintenant {0}, soit {1} de plus qu’avant.",
  "Now {0}, {1} less than before.": "Maintenant {0}, soit {1} de moins qu’avant.",
  "Still running normally": "Toujours exécuté normalement",
  "Windows didn't get permission to restart Disq Studio as administrator.":
    "Windows n’a pas obtenu l’autorisation de redémarrer Disq Studio en tant qu’administrateur.",
  "Choose a folder to scan": "Choisissez un dossier à analyser",
  "{0}. A folder goes as a whole only when everything in it matches; elsewhere just the matching files go, and nothing that doesn't match is touched.":
    "{0}. Un dossier n’est supprimé en entier que si tout son contenu correspond ; ailleurs, seuls les fichiers correspondants sont supprimés, et rien de ce qui ne correspond pas n’est touché.",
  "Added {0} to the basket": "Ajouté au panier : {0}",
  "Already in the basket": "Déjà dans le panier",
  "The basket holds {0}, {1} on disk.": "Le panier contient {0}, {1} sur le disque.",
  "Open basket": "Ouvrir le panier",
  "Restored {0}": "Restauré : {0}",
  "Nothing was restored": "Rien n’a été restauré",
  "{0} in the Recycle Bin any more.": "{0} dans la Corbeille.",
  "Everything is back where it was.": "Tout est revenu à sa place.",
  "{0} freed once the Recycle Bin is emptied.": "{0} libérés une fois la Corbeille vidée.",
  "{0} freed.": "{0} libérés.",
  "{0} deleted permanently, as you chose.": "{0} définitivement, comme vous l’avez choisi.",
  "1 item was kept: Windows would have deleted it permanently.":
    "1 élément a été conservé : Windows l’aurait supprimé définitivement.",
  "{0} items were kept: Windows would have deleted them permanently.":
    "{0} éléments ont été conservés : Windows les aurait supprimés définitivement.",
  "1 item was skipped, most likely because a program is using it: {0}":
    "1 élément a été ignoré, probablement parce qu’un programme l’utilise : {0}",
  "{0} items were skipped, most likely because a program is using them: {1}{2}":
    "{0} éléments ont été ignorés, probablement parce qu’un programme les utilise : {1}{2}",
  "Moved {0} to the Recycle Bin": "Déplacé dans la Corbeille : {0}",
  "Deleted {0} permanently": "Supprimé définitivement : {0}",
  "Nothing was removed": "Rien n’a été supprimé",
  "Undo": "Annuler",
  "Replaced {0} with links": "Remplacé par des liens : {0}",
  "Nothing was replaced": "Rien n’a été remplacé",
  "{0} freed. Every file still opens under its own name.": "{0} libérés. Chaque fichier s’ouvre toujours sous son propre nom.",
  "{0} skipped: {1}{2}": "{0} : {1}{2}",
  "Nothing in the basket is in the scan any more.": "Plus rien dans le panier ne fait partie de l’analyse.",
  "What goes is taken out of the basket.": "Ce qui est supprimé est retiré du panier.",

  // ----- Words counted with plural() -----
  "file": "fichier",
  "files": "fichiers",
  "matching file": "fichier correspondant",
  "matching files": "fichiers correspondants",
  "folder": "dossier",
  "folders": "dossiers",
  "item": "élément",
  "items": "éléments",
  "item selected": "élément sélectionné",
  "items selected": "éléments sélectionnés",
  "item was": "élément supprimé",
  "items were": "éléments supprimés",
  "item wasn't": "élément n’était plus",
  "items weren't": "éléments n’étaient plus",
  "copy": "copie",
  "copies": "copies",
  "copy was": "copie ignorée",
  "copies were": "copies ignorées",
  "group": "groupe",
  "groups": "groupes",
  "hash": "empreinte",
  "hashes": "empreintes",
  "row": "ligne",
  "rows": "lignes",

  // ----- Selection and context menu -----
  "Copy paths": "Copier les chemins",
  "Clear selection": "Effacer la sélection",
  "Add to basket": "Ajouter au panier",
  "Move {0} to Recycle Bin": "Déplacer {0} dans la Corbeille",
  "Zoom in": "Zoom avant",
  "Refresh this folder": "Actualiser ce dossier",
  "Try reading it again": "Essayer de le relire",
  "Open": "Ouvrir",
  "Show in Explorer": "Afficher dans l’Explorateur",
  "Copy path": "Copier le chemin",
  "Move to Recycle Bin": "Déplacer dans la Corbeille",
  "Colour files by": "Colorer les fichiers par",
  "File type": "Type de fichier",
  "Age (last changed)": "Âge (dernière modification)",
  "Cushion shading": "Ombrage en relief",
  "All drives": "Tous les lecteurs",

  // ----- Basket -----
  "The basket is empty": "Le panier est vide",
  "Add things from the map (right-click › Add to basket), from Duplicates or from Cleanup, then recycle them all here in one go.":
    "Ajoutez des éléments depuis la carte (clic droit › Ajouter au panier), depuis Doublons ou depuis Nettoyage, puis envoyez-les tous ici dans la Corbeille en une seule fois.",
  "{0}, about {1} on disk. Nothing is removed until you recycle them.":
    "{0}, environ {1} sur le disque. Rien n’est supprimé tant que vous ne les envoyez pas dans la Corbeille.",
  "Take {0} out of the basket": "Retirer {0} du panier",
  "Empty the basket": "Vider le panier",
  "Recycle all": "Tout mettre dans la Corbeille",

  // ----- Changes -----
  "Folder by folder": "Dossier par dossier",
  "Grew": "Agrandi",
  "Shrank": "Réduit",
  "New": "Nouveau",
  "Gone": "Disparu",
  "on disk": "sur le disque",
  "size": "taille",
  "Changes since a snapshot": "Modifications depuis un instantané",
  "Changes in {0} since": "Modifications dans {0} depuis",
  "Stop comparing": "Arrêter la comparaison",
  "Then": "Avant",
  "Now": "Maintenant",
  "Change": "Écart",
  "By {0}. Files: {1} then, {2} now. Items are matched by path.":
    "Par {0}. Fichiers : {1} avant, {2} maintenant. Les éléments sont associés par leur chemin.",
  "Show": "Afficher",
  "Folder": "Dossier",
  "Comparing": "Comparaison en cours",
  "Nothing here": "Rien ici",
  "This folder is empty in both scans.": "Ce dossier est vide dans les deux analyses.",
  "No items of this kind changed.": "Aucun élément de ce type n’a changé.",
  "Show on the map": "Afficher sur la carte",
  "The largest new or gone items; a new folder is listed once, not every file in it.":
    "Les plus grands éléments nouveaux ou disparus ; un nouveau dossier est listé une fois, pas chacun de ses fichiers.",
  "Up to 150 files that changed most. Folders are compared on the Folder by folder tab.":
    "Jusqu’à 150 fichiers qui ont le plus changé. Les dossiers sont comparés dans l’onglet « Dossier par dossier ».",

  // ----- Cleanup -----
  "Cleanup suggestions": "Suggestions de nettoyage",
  "Cleanup suggestions in": "Suggestions de nettoyage dans",
  "Caches, temp files and build output that apps rebuild on their own":
    "Caches, fichiers temporaires et résultats de compilation que les applications recréent d’elles-mêmes",
  "Look again": "Rechercher à nouveau",
  "Looking for junk": "Recherche de fichiers inutiles",
  "Nothing to clean up here": "Rien à nettoyer ici",
  "No caches, temp files or build output of 1 MB or more were found in this scan.":
    "Aucun cache, fichier temporaire ou résultat de compilation de 1 Mo ou plus n’a été trouvé dans cette analyse.",
  "Safe to remove": "Suppression sans risque",
  "Review first": "À vérifier d’abord",
  "Selected": "Sélectionné",
  "Select everything safe": "Sélectionner tout ce qui est sûr",
  "Clear": "Effacer",
  "Select all {0}": "Sélectionner les {0}",
  "Safe": "Sûr",
  "For information": "Pour information",
  "Select {0}": "Sélectionner {0}",
  "Show fewer": "Afficher moins",
  "Show all {0}": "Afficher les {0}",
  " (largest {0} of {1})": " (les {0} plus grands sur {1})",
  "{0} selected · frees about {1}": "{0} sélectionnés · libère environ {1}",
  "Tick what you want gone. Nothing is removed until you confirm.":
    "Cochez ce que vous voulez supprimer. Rien n’est supprimé tant que vous n’avez pas confirmé.",
  "Collect them in the basket and recycle everything there in one go":
    "Les rassembler dans le panier et tout y envoyer dans la Corbeille en une seule fois",
  "Files a program is still using are skipped and listed afterwards.":
    "Les fichiers encore utilisés par un programme sont ignorés et listés ensuite.",
  // Categories from the Rust side (junk.rs)
  "Temporary files": "Fichiers temporaires",
  "Files programs leave behind in the temp folders. Anything still in use is skipped.":
    "Fichiers laissés par les programmes dans les dossiers temporaires. Ce qui est encore utilisé est ignoré.",
  "Browser and app caches": "Caches des navigateurs et des applications",
  "Copies of web pages, images and scripts kept to load faster. They refill as you browse.":
    "Copies de pages web, d’images et de scripts conservées pour un chargement plus rapide. Elles se remplissent à nouveau pendant la navigation.",
  "Graphics shader caches": "Caches de shaders graphiques",
  "Compiled shaders from graphics drivers and games. Rebuilt the next time each game runs.":
    "Shaders compilés par les pilotes graphiques et les jeux. Recréés au prochain lancement de chaque jeu.",
  "Crash dumps and error reports": "Vidages sur incident et rapports d’erreurs",
  "Memory dumps and reports written when programs crash. Only useful for debugging.":
    "Vidages mémoire et rapports écrits lors du plantage de programmes. Utiles seulement pour le débogage.",
  "Windows Update downloads": "Téléchargements de Windows Update",
  "Update packages that were already installed. Removing them may need administrator rights.":
    "Paquets de mise à jour déjà installés. Les supprimer peut nécessiter des droits d’administrateur.",
  "Developer build output": "Résultats de compilation",
  "node_modules, Rust target folders and Python caches. Rebuilt by npm install, cargo build and so on.":
    "node_modules, dossiers target de Rust et caches Python. Recréés par npm install, cargo build, etc.",
  "Package manager caches": "Caches des gestionnaires de paquets",
  "Downloaded packages kept by npm, pip, Cargo, NuGet, Gradle and Yarn. Downloaded again when needed.":
    "Paquets téléchargés conservés par npm, pip, Cargo, NuGet, Gradle et Yarn. Téléchargés à nouveau si nécessaire.",
  "Teams and Slack caches": "Caches de Teams et Slack",
  "Cached messages, pictures and web pages of Microsoft Teams and Slack. Quit them first; they may ask you to sign in again.":
    "Messages, images et pages web en cache de Microsoft Teams et Slack. Quittez-les d’abord ; ils peuvent vous demander de vous reconnecter.",
  "Large log files": "Fichiers journaux volumineux",
  "Log files of 1 MB or more. Usually safe, but check none is a log you need.":
    "Fichiers journaux de 1 Mo ou plus. Généralement sans risque, mais vérifiez qu’aucun n’est un journal dont vous avez besoin.",
  "Old installers in Downloads": "Anciens programmes d’installation dans Téléchargements",
  "Setup files in Downloads not changed for 30 days or more. Usually no longer needed once installed.":
    "Fichiers d’installation dans Téléchargements non modifiés depuis 30 jours ou plus. Généralement inutiles une fois installés.",
  "Big files not opened in a year": "Gros fichiers non ouverts depuis un an",
  "Files of 100 MB or more that nobody has opened or changed for a year. Check each one: some are kept on purpose, like backups.":
    "Fichiers de 100 Mo ou plus que personne n’a ouverts ni modifiés depuis un an. Vérifiez-les un par un : certains sont conservés exprès, comme les sauvegardes.",
  "Your rules": "Vos règles",
  "Matches for the rules in Settings › Cleanup rules.": "Correspondances avec les règles de Paramètres › Règles de nettoyage.",
  "WSL and Docker disk images": "Images disque de WSL et Docker",
  "Virtual disks of Linux distributions and Docker. Deleting one erases everything in it, so they can't be selected here. To shrink them, use docker system prune or wsl --manage <distro> --set-sparse true.":
    "Disques virtuels des distributions Linux et de Docker. En supprimer un efface tout son contenu, ils ne peuvent donc pas être sélectionnés ici. Pour les réduire, utilisez docker system prune ou wsl --manage <distro> --set-sparse true.",

  // ----- Confirmations -----
  "Delete {0} permanently?": "Supprimer définitivement {0} ?",
  "Move {0} to the Recycle Bin?": "Déplacer {0} dans la Corbeille ?",
  "This can't be undone": "Cette action est irréversible",
  "Nothing goes to the Recycle Bin: 1 item ({0}) will be deleted for good, with no way to restore it.":
    "Rien ne va dans la Corbeille : 1 élément ({0}) sera supprimé définitivement, sans possibilité de le restaurer.",
  "Nothing goes to the Recycle Bin: {0} items ({1}) will be deleted for good, with no way to restore them.":
    "Rien ne va dans la Corbeille : {0} éléments ({1}) seront supprimés définitivement, sans possibilité de les restaurer.",
  "This frees about {0} once the Recycle Bin is emptied, and you can restore anything from there until then.":
    "Cela libère environ {0} une fois la Corbeille vidée, et vous pouvez tout restaurer depuis celle-ci jusque-là.",
  "Delete permanently": "Supprimer définitivement",
  "Delete permanently…": "Supprimer définitivement…",
  "Cancel": "Annuler",
  "Delete permanently?": "Supprimer définitivement ?",
  "Move to Recycle Bin?": "Déplacer dans la Corbeille ?",
  "It won't go to the Recycle Bin: it will be deleted for good, with no way to restore it.":
    "Il n’ira pas dans la Corbeille : il sera supprimé définitivement, sans possibilité de le restaurer.",

  // ----- Recycle Bin check -----
  "Couldn't check the Recycle Bin": "Impossible de vérifier la Corbeille",
  "Checking the Recycle Bin…": "Vérification de la Corbeille…",
  "about {0}": "environ {0}",
  "These can't go to the Recycle Bin": "Ceux-ci ne peuvent pas aller dans la Corbeille",
  "{0} can't go to the Recycle Bin": "{0} ne peut pas aller dans la Corbeille",
  "Windows would delete it permanently, with no way to restore it: {0}.":
    "Windows le supprimerait définitivement, sans possibilité de le restaurer : {0}.",
  "Windows would delete them permanently, with no way to restore them.":
    "Windows les supprimerait définitivement, sans possibilité de les restaurer.",
  "Windows would delete these permanently, with no way to restore them.":
    "Windows supprimerait ceux-ci définitivement, sans possibilité de les restaurer.",
  "and {0} more": "et {0} de plus",
  "Delete it permanently ({0})": "Le supprimer définitivement ({0})",
  "Delete these {0} permanently ({1})": "Supprimer ces {0} définitivement ({1})",
  "Left unticked, they're skipped and everything else goes to the Recycle Bin.":
    "S’ils restent décochés, ils sont ignorés et tout le reste va dans la Corbeille.",
  "The Recycle Bin will make room": "La Corbeille va faire de la place",
  "The Recycle Bin on {0} holds {1} and already has {2}. Windows will permanently remove about {3} of the oldest things in it to fit these.":
    "La Corbeille de {0} peut contenir {1} et en contient déjà {2}. Windows supprimera définitivement environ {3} de ses éléments les plus anciens pour faire de la place à ceux-ci.",
  "Online-only OneDrive files skip the Recycle Bin": "Les fichiers OneDrive en ligne uniquement ne passent pas par la Corbeille",
  "This holds {0} of files that are only in the cloud.": "Ceci contient {0} de fichiers qui ne sont que dans le cloud.",
  "1 of these holds {0} of files that are only in the cloud.": "1 d’entre eux contient {0} de fichiers qui ne sont que dans le cloud.",
  "{0} of these hold {1} of files that are only in the cloud.": "{0} d’entre eux contiennent {1} de fichiers qui ne sont que dans le cloud.",
  "Deleting them removes them from OneDrive on all your devices. They can be restored from the OneDrive recycle bin on the web for 30 days (93 for work or school accounts), but not from Windows' Recycle Bin, and Undo can't bring them back.":
    "Les supprimer les retire de OneDrive sur tous vos appareils. Ils peuvent être restaurés depuis la corbeille OneDrive sur le web pendant 30 jours (93 pour les comptes professionnels ou scolaires), mais pas depuis la Corbeille de Windows, et « Annuler » ne peut pas les récupérer.",
  "Everything fits in the Recycle Bin on {0} ({1} of {2} used), so it can all be restored.":
    "Tout tient dans la Corbeille de {0} ({1} utilisés sur {2}), tout peut donc être restauré.",
  "Everything fits in the Recycle Bin on {0}, so it can all be restored.":
    "Tout tient dans la Corbeille de {0}, tout peut donc être restauré.",
  "Nothing can be recycled": "Rien ne peut aller dans la Corbeille",
  "Recycle and delete the rest": "Corbeille et supprimer le reste",
  "Recycle {0}, skip {1}": "{0} dans la Corbeille, ignorer {1}",
  // Reasons from the Rust side (recyclebin.rs)
  "{0} has no Recycle Bin": "{0} n’a pas de Corbeille",
  "the Recycle Bin on {0} is set to delete files right away":
    "la Corbeille de {0} est configurée pour supprimer les fichiers immédiatement",
  "bigger than the Recycle Bin on {0}, which holds {1}": "plus grand que la Corbeille de {0}, qui peut contenir {1}",

  // ----- Duplicates -----
  "Duplicate files": "Fichiers en double",
  "Find duplicates in": "Rechercher des doublons dans",
  "Only files that match the filter are compared": "Seuls les fichiers correspondant au filtre sont comparés",
  "Files from": "Fichiers à partir de",
  "Smallest file to check": "Plus petit fichier à vérifier",
  "Search again": "Rechercher à nouveau",
  "Find duplicates": "Rechercher des doublons",
  "Comparing whole files": "Comparaison des fichiers entiers",
  "Comparing the start and end of same-size files": "Comparaison du début et de la fin des fichiers de même taille",
  "{0} of {1} files": "{0} fichiers sur {1}",
  "Starting…": "Démarrage…",
  " · {0} read · {1}": " · {0} lus · {1}",
  "Duplicate search progress": "Progression de la recherche de doublons",
  "Find files that are stored more than once": "Trouvez les fichiers enregistrés plusieurs fois",
  "Disq Studio compares files of the same size, first by their start and end, then by their whole contents. Online-only cloud files are skipped, so nothing gets downloaded, and files that haven't changed since an earlier search aren't read again.":
    "Disq Studio compare les fichiers de même taille, d’abord par leur début et leur fin, puis par leur contenu entier. Les fichiers cloud disponibles uniquement en ligne sont ignorés, donc rien n’est téléchargé, et les fichiers inchangés depuis une recherche précédente ne sont pas relus.",
  "Can be freed": "Peut être libéré",
  "Extra copies": "Copies en trop",
  "Groups": "Groupes",
  "In {0}: checked {1} with a same-size twin in {2}.": "Dans {0} : {1} ayant un jumeau de même taille vérifiés en {2}.",
  " {0} remembered from earlier searches.": " {0} repris de recherches précédentes.",
  " {0} couldn't be read.": " {0} illisibles.",
  " Showing the {0} groups that waste the most.": " Affichage des {0} groupes qui gaspillent le plus.",
  " The scan has changed since; search again for current results.":
    " L’analyse a changé depuis ; relancez la recherche pour des résultats à jour.",
  "No duplicates found": "Aucun doublon trouvé",
  "No two files of {0} or more have the same contents here.": "Ici, aucun fichier de {0} ou plus n’a le même contenu qu’un autre.",
  "Only groups with a copy in… (path or *pattern)": "Seulement les groupes avec une copie dans… (chemin ou *motif)",
  "Show only groups with a copy whose path matches": "Afficher seulement les groupes avec une copie dont le chemin correspond",
  "All types": "Tous les types",
  "Highlight the extra copies (all but the oldest of each) on the map":
    "Mettre en évidence sur la carte les copies en trop (toutes sauf la plus ancienne de chaque groupe)",
  "{0} of duplicate files": "{0} de fichiers en double",
  "Show on map": "Afficher sur la carte",
  "Select extra copies in the groups shown:": "Sélectionner les copies en trop dans les groupes affichés :",
  "Select extra copies:": "Sélectionner les copies en trop :",
  "Keep oldest": "Garder la plus ancienne",
  "Keep newest": "Garder la plus récente",
  "Keep shortest path": "Garder le chemin le plus court",
  "No groups match": "Aucun groupe ne correspond",
  "No duplicate group has a copy matching that path and type.":
    "Aucun groupe de doublons n’a de copie correspondant à ce chemin et à ce type.",
  "Keep at least one copy": "Gardez au moins une copie",
  "Select every copy in {0}": "Sélectionner toutes les copies dans {0}",
  "Show {0} more groups": "Afficher {0} groupes de plus",
  "{0} selected · frees {1}": "{0} sélectionnées · libère {1}",
  "Select the copies you don't need. One copy in each group always stays.":
    "Sélectionnez les copies dont vous n’avez pas besoin. Une copie de chaque groupe est toujours conservée.",
  "Keep every name, but store the data once: each selected copy becomes a hard link to the copy that stays":
    "Garder chaque nom, mais stocker les données une seule fois : chaque copie sélectionnée devient un lien physique vers la copie conservée",
  "Replace with links": "Remplacer par des liens",
  "Replace {0} with links?": "Remplacer {0} par des liens ?",
  "Every file stays where it is and opens as before, but the data is stored once, freeing about {0}. Each selected copy becomes a hard link: another name for the copy that stays.":
    "Chaque fichier reste où il est et s’ouvre comme avant, mais les données ne sont stockées qu’une fois, ce qui libère environ {0}. Chaque copie sélectionnée devient un lien physique : un autre nom pour la copie conservée.",
  "Linked names share one file": "Les noms liés partagent un seul fichier",
  "Editing a linked file changes it under every name. Use this for files you only keep, like photos, music, installers or downloads, not for copies you mean to edit separately. Copies that changed since the search, or are on another drive, are skipped.":
    "Modifier un fichier lié le modifie sous tous ses noms. Utilisez ceci pour des fichiers que vous ne faites que conserver, comme des photos, de la musique, des programmes d’installation ou des téléchargements, pas pour des copies que vous comptez modifier séparément. Les copies modifiées depuis la recherche, ou situées sur un autre lecteur, sont ignorées.",
  // Errors from the Rust side (dupes.rs)
  "{0} changed since the search": "{0} a changé depuis la recherche",
  "already the same file": "déjà le même fichier",
  "the contents differ now": "le contenu est maintenant différent",

  // ----- Export -----
  "Web page": "Page web",
  "A report to read or share: totals, contents with bars, file types, largest files.":
    "Un rapport à lire ou à partager : totaux, contenu avec barres, types de fichiers, plus gros fichiers.",
  "One row per item, for Excel or another spreadsheet.": "Une ligne par élément, pour Excel ou un autre tableur.",
  "One object per item, for scripts and other tools.": "Un objet par élément, pour les scripts et autres outils.",
  "1 level": "1 niveau",
  "2 levels": "2 niveaux",
  "3 levels": "3 niveaux",
  "Everything": "Tout",
  "Any size": "Toute taille",
  "64 KB": "64 Ko",
  "1 MB": "1 Mo",
  "10 MB": "10 Mo",
  "100 MB": "100 Mo",
  "1 MB or more": "1 Mo ou plus",
  "100 MB or more": "100 Mo ou plus",
  "1 GB or more": "1 Go ou plus",
  "Disk": "Disque",
  "Export a report": "Exporter un rapport",
  "{0} - Disq Studio report.{1}": "{0} - Rapport Disq Studio.{1}",
  "Export": "Exporter",
  "Format": "Format",
  "How deep": "Profondeur",
  "Levels of folders below {0}.": "Niveaux de dossiers sous {0}.",
  "Leave out items smaller than": "Exclure les éléments de moins de",
  "Include files": "Inclure les fichiers",
  "Off: folders only.": "Désactivé : dossiers uniquement.",
  "Every item, of any size: for a whole drive that's a file with millions of rows.":
    "Chaque élément, de toute taille : pour un lecteur entier, c’est un fichier de plusieurs millions de lignes.",
  "A filter is on, so only matching files are counted, as on screen.":
    "Un filtre est actif, seuls les fichiers correspondants sont donc comptés, comme à l’écran.",
  "Export…": "Exporter…",

  // ----- Filter -----
  "Any time": "N’importe quand",
  "Changed in the last 30 days": "Modifié ces 30 derniers jours",
  "Not changed for 1 year": "Non modifié depuis 1 an",
  "Not changed for 3 years": "Non modifié depuis 3 ans",
  "This search is saved": "Cette recherche est enregistrée",
  "Save this search": "Enregistrer cette recherche",
  "Saved searches": "Recherches enregistrées",
  "Forget this search": "Oublier cette recherche",
  "Search names: node_modules *.js, *.mp4|*.mkv, -*.log, Users\\Me\\Videos…":
    "Rechercher des noms : node_modules *.js, *.mp4|*.mkv, -*.log, Users\\Moi\\Videos…",
  "Search file and folder names. Separate terms with spaces; all must match. a|b matches either, -term leaves matches out, a term with a backslash matches the full path.":
    "Rechercher des noms de fichiers et de dossiers. Séparez les termes par des espaces ; tous doivent correspondre. a|b correspond à l’un ou l’autre, -terme exclut des résultats, un terme avec une barre oblique inverse correspond au chemin complet.",
  "Terms separated by spaces must all match a name or a folder above it. a|b: either. -term: leave out. A term with \\ matches the full path. Quotes keep spaces.":
    "Les termes séparés par des espaces doivent tous correspondre à un nom ou à un dossier parent. a|b : l’un ou l’autre. -terme : exclure. Un terme avec \\ correspond au chemin complet. Les guillemets conservent les espaces.",
  "Ctrl+F": "Ctrl+F",
  "File types": "Types de fichiers",
  "Minimum file size": "Taille minimale des fichiers",
  "Last changed": "Dernière modification",
  "Filtering": "Filtrage en cours",

  // ----- Folder list -----
  "Folder contents": "Contenu du dossier",
  "List": "Liste",
  "Matches": "Résultats",
  "This folder": "Ce dossier",
  "Move every match to the Recycle Bin, after a check of what the Recycle Bin can take":
    "Déplacer tous les résultats dans la Corbeille, après avoir vérifié ce qu’elle peut accueillir",
  "Contents of {0}": "Contenu de {0}",
  "Loading": "Chargement",
  "Nothing in this folder matches": "Rien dans ce dossier ne correspond",
  "This folder is empty": "Ce dossier est vide",
  " · {0} online only": " · {0} en ligne uniquement",
  "{0} · couldn't be read": "{0} · illisible",
  "{0} · skipped by Settings › Folders to skip, so its size isn't counted":
    "{0} · ignoré dans Paramètres › Dossiers ignorés, sa taille n’est donc pas comptée",
  "{0} · hard link, counted once under its other name": "{0} · lien physique, compté une fois sous son autre nom",
  "Columns": "Colonnes",
  " (needs a wider list)": " (nécessite une liste plus large)",
  "Sort by {0}": "Trier par {0}",
  "Resize {0}": "Redimensionner {0}",
  "Nothing matches": "Aucun résultat",
  "Try fewer terms or conditions, or part of a name instead of all of it.":
    "Essayez moins de termes ou de conditions, ou une partie d’un nom plutôt que le nom entier.",
  "Showing the largest {0} of {1} matches": "Affichage des {0} plus grands résultats sur {1}",
  "Name": "Nom",
  "Share": "Part",

  // ----- History -----
  "Save this scan as a snapshot": "Enregistrer cette analyse comme instantané",
  "Disq Studio snapshot.dss": "Instantané Disq Studio.dss",
  "Compare with a snapshot": "Comparer avec un instantané",
  "Open a snapshot": "Ouvrir un instantané",
  "History": "Historique",
  " of {0}": " de {0}",
  "Each finished scan is kept as a snapshot (the newest 8 of each location), so you can see what changed since. Compare one with the scan in view, or open it to look around as it was.":
    "Chaque analyse terminée est conservée comme instantané (les 8 plus récents de chaque emplacement), pour voir ce qui a changé depuis. Comparez-en un avec l’analyse affichée, ou ouvrez-le pour explorer l’état d’alors.",
  "Show snapshots of every location": "Afficher les instantanés de tous les emplacements",
  "Reading the history": "Lecture de l’historique",
  "No snapshots yet": "Aucun instantané",
  "Save one now, or it'll be saved after the next scan.": "Enregistrez-en un maintenant, sinon il sera enregistré après la prochaine analyse.",
  "Scan a drive or folder to start the history.": "Analysez un lecteur ou un dossier pour commencer l’historique.",
  "{0} on disk · {1}": "{0} sur le disque · {1}",
  " · {0} since": " · {0} depuis",
  "Compare": "Comparer",
  "Delete this snapshot": "Supprimer cet instantané",
  "{0} of snapshots.": "{0} d’instantanés.",
  "Show folder": "Afficher le dossier",
  "Open a file…": "Ouvrir un fichier…",
  "Compare with a file…": "Comparer avec un fichier…",
  "Save as…": "Enregistrer sous…",
  "Save snapshot now": "Enregistrer un instantané maintenant",

  // ----- Home -----
  "See what's filling your drive.": "Voyez ce qui remplit votre lecteur.",
  "Pick a drive or folder. Disq Studio reads it on every core, then draws each file as a block sized by the space it takes, so the biggest things are impossible to miss.":
    "Choisissez un lecteur ou un dossier. Disq Studio le lit sur tous les cœurs, puis dessine chaque fichier comme un bloc à la taille de l’espace qu’il occupe : impossible de rater les plus gros.",
  "Refresh drives": "Actualiser les lecteurs",
  "Looking for drives": "Recherche des lecteurs",
  "Local Disk": "Disque local",
  "Drive": "Lecteur",
  "Unknown": "Inconnu",
  "{0}% used": "{0} % utilisés",
  "{0} free of {1}": "{0} libres sur {1}",
  "Choose a folder…": "Choisir un dossier…",
  "Scan just one folder and what's inside it": "Analyser un seul dossier et son contenu",

  // ----- Details -----
  "Takes {0} more on disk than its size. Many small files waste the unused end of each cluster.":
    "Occupe {0} de plus sur le disque que sa taille. Beaucoup de petits fichiers gaspillent la fin inutilisée de chaque cluster.",
  "Online only: the data is in the cloud, not on this drive. Opening it downloads it.":
    "En ligne uniquement : les données sont dans le cloud, pas sur ce lecteur. L’ouvrir le télécharge.",
  "Takes no space of its own: it's small enough to live in the file table.":
    "N’occupe pas d’espace propre : il est assez petit pour tenir dans la table des fichiers.",
  "Takes {0} less on disk than its size, because {1} of it is online only.":
    "Occupe {0} de moins sur le disque que sa taille, car {1} sont en ligne uniquement.",
  "Takes {0} less on disk than its size: {1} is online only, the rest is saved by compression or sparse files.":
    "Occupe {0} de moins sur le disque que sa taille : {1} sont en ligne uniquement, le reste est économisé par la compression ou les fichiers partiellement alloués.",
  "Takes {0} less on disk than its size, from compression or sparse files.":
    "Occupe {0} de moins sur le disque que sa taille, grâce à la compression ou aux fichiers partiellement alloués.",
  "Details": "Détails",
  "Selection": "Sélection",
  "Adding up the selection": "Calcul de la sélection",
  "matching the filter, on disk": "correspondant au filtre, sur le disque",
  "matching the filter, size": "correspondant au filtre, taille",
  "Size": "Taille",
  "On disk": "Sur le disque",
  "Files": "Fichiers",
  "Inside others": "Dans d’autres",
  "Selected items that are inside another selected folder; they're counted with it":
    "Éléments sélectionnés situés dans un autre dossier sélectionné ; ils sont comptés avec lui",
  "Recycle": "Mettre dans la Corbeille",
  "Recycle {0}": "{0} dans la Corbeille",
  "Ctrl+click adds or removes an item; Shift+click in the list selects a range.":
    "Ctrl+clic ajoute ou retire un élément ; Maj+clic dans la liste sélectionne une plage.",
  "Current folder": "Dossier actuel",
  "File": "Fichier",
  "Hard links here that point at data counted under another name":
    "Liens physiques ici qui pointent vers des données comptées sous un autre nom",
  "Hard links": "Liens physiques",
  "counted once": "comptés une fois",
  "Of parent folder": "Du dossier parent",
  "Of whole scan": "De toute l’analyse",
  "Folders": "Dossiers",
  "Modified": "Modifié",
  "Bytes": "Octets",
  "Hard link": "Lien physique",
  "The same {0} of data also has another name, and it's counted there so it isn't counted twice. Recycling only this name frees no space.":
    "Les mêmes {0} de données ont aussi un autre nom, et sont comptés là-bas pour ne pas l’être deux fois. Mettre seulement ce nom dans la Corbeille ne libère aucun espace.",
  "Select the counted name": "Sélectionner le nom compté",
  "Skipped because it's in Settings › Folders to skip, so its size isn't counted.":
    "Ignoré car il figure dans Paramètres › Dossiers ignorés, sa taille n’est donc pas comptée.",
  "Windows didn't allow this folder to be read, so its size isn't counted.":
    "Windows n’a pas permis de lire ce dossier, sa taille n’est donc pas comptée.",
  "File types in {0}": "Types de fichiers dans {0}",
  "Counting file types": "Décompte des types de fichiers",
  "No files here.": "Aucun fichier ici.",
  "Share of space by file type": "Part de l’espace par type de fichier",
  "Top extensions": "Extensions principales",
  "no extension": "sans extension",
  "Largest files": "Plus gros fichiers",
  "Finding the largest files": "Recherche des plus gros fichiers",

  // ----- Scan -----
  "Scan progress": "Progression de l’analyse",
  " · {0} folders skipped": " · {0} dossiers ignorés",

  // ----- Settings -----
  "Dark": "Sombre",
  "Light": "Clair",
  "Follow Windows": "Comme Windows",
  "Downloading…": "Téléchargement…",
  "Downloading… {0}%": "Téléchargement… {0} %",
  "Export settings": "Exporter les paramètres",
  "Disq Studio settings.json": "Paramètres Disq Studio.json",
  "Saved to {0}.": "Enregistré dans {0}.",
  "Import settings": "Importer les paramètres",
  "Choose a folder Disq Studio should skip": "Choisissez un dossier que Disq Studio doit ignorer",
  "Appearance": "Apparence",
  "Theme": "Thème",
  "Language": "Langue",
  "Applies when Disq Studio starts again.": "S’applique au prochain démarrage de Disq Studio.",
  "Restart now": "Redémarrer maintenant",
  "Accent colour": "Couleur d’accentuation",
  "Sizes": "Tailles",
  "Measure by": "Mesurer par",
  "Size is how long files are; on disk is the space they really take.":
    "La taille est la longueur des fichiers ; sur le disque est l’espace qu’ils occupent réellement.",
  "Units": "Unités",
  "Matches Explorer: a 500 GB drive shows as about 466 GB.": "Comme l’Explorateur : un lecteur de 500 Go s’affiche comme environ 466 Go.",
  "Matches the box: a 500 GB drive shows as 500 GB.": "Comme sur la boîte : un lecteur de 500 Go s’affiche comme 500 Go.",
  "Like Windows (1,024)": "Comme Windows (1 024)",
  "Decimal (1,000)": "Décimal (1 000)",
  "Folders to skip": "Dossiers ignorés",
  "These are never read. They show up as skipped, with no size, in every scan that would include them. Add a folder, or a name to skip wherever it is: {0} skips every folder of that name, {1} any with \"cache\" in it, {2} that path ending.":
    "Ils ne sont jamais lus. Ils apparaissent comme ignorés, sans taille, dans chaque analyse qui les inclurait. Ajoutez un dossier, ou un nom à ignorer où qu’il soit : {0} ignore tous les dossiers de ce nom, {1} tous ceux qui contiennent « cache », {2} cette fin de chemin.",
  "Stop skipping {0}": "Ne plus ignorer {0}",
  "Nothing is skipped.": "Rien n’est ignoré.",
  "Add folder…": "Ajouter un dossier…",
  "or a name: node_modules, *cache*…": "ou un nom : node_modules, *cache*…",
  "Folder name or pattern to skip everywhere": "Nom de dossier ou motif à ignorer partout",
  "Add": "Ajouter",
  "Rescan now to apply": "Réanalysez pour appliquer",
  "Cleanup rules": "Règles de nettoyage",
  "Your own suggestions for the Cleanup tab, under \"Your rules\". Write them like a search: a name such as {0}, or a path such as {1} (a matching folder is suggested whole).":
    "Vos propres suggestions pour l’onglet Nettoyage, sous « Vos règles ». Écrivez-les comme une recherche : un nom comme {0}, ou un chemin comme {1} (un dossier correspondant est suggéré en entier).",
  "Remove the rule {0}": "Supprimer la règle {0}",
  "No rules of your own yet.": "Aucune règle personnelle pour l’instant.",
  "*.bak, Renders\\scratch…": "*.bak, Renders\\brouillon…",
  "New cleanup rule": "Nouvelle règle de nettoyage",
  "Add rule": "Ajouter la règle",
  "Deleting": "Suppression",
  "Offer \"Delete permanently\"": "Proposer « Supprimer définitivement »",
  "Adds a button to delete confirmations that skips the Recycle Bin. Everything it deletes is gone for good, so it always asks a second time.":
    "Ajoute aux confirmations un bouton qui ne passe pas par la Corbeille. Tout ce qu’il supprime l’est définitivement, il demande donc toujours une seconde fois.",
  "Permanent delete is on.": "La suppression définitive est activée.",
  "Keep a snapshot of every scan": "Conserver un instantané de chaque analyse",
  "The newest 8 of each drive or folder, about 30 MB each for a full C: drive. History compares them with the scan in view.":
    "Les 8 plus récents de chaque lecteur ou dossier, environ 30 Mo chacun pour un lecteur C: plein. L’Historique les compare avec l’analyse affichée.",
  "Daily check": "Vérification quotidienne",
  "Reading…": "Lecture…",
  "Check my drives once a day": "Vérifier mes lecteurs une fois par jour",
  "Runs without opening a window, through Windows' Task Scheduler, and sends a notification when a drive is getting full. A check missed while the PC was off runs at the next sign-in.":
    "S’exécute sans ouvrir de fenêtre, via le Planificateur de tâches de Windows, et envoie une notification quand un lecteur se remplit. Une vérification manquée pendant que le PC était éteint s’exécute à la prochaine connexion.",
  "At": "À",
  "Time of the daily check": "Heure de la vérification quotidienne",
  "Warn when a drive has less free than": "Avertir quand un lecteur a moins d’espace libre que",
  "{0}% of its size": "{0} % de sa taille",
  "Also scan and keep history of": "Analyser aussi et garder l’historique de",
  "Takes a snapshot each day, and says when a drive grew {0} GB or more since the last one.":
    "Prend un instantané chaque jour et signale quand un lecteur a grossi de {0} Go ou plus depuis le précédent.",
  "Check now": "Vérifier maintenant",
  "Scheduled in Task Scheduler.": "Programmée dans le Planificateur de tâches.",
  "Not scheduled yet.": "Pas encore programmée.",
  "Off.": "Désactivée.",
  "Nothing to report: every drive has room to spare.": "Rien à signaler : chaque lecteur a de la place.",
  "Settings file": "Fichier de paramètres",
  "Everything set here, saved searches and list columns, in one file: to keep a copy, or to set up another PC the same way.":
    "Tout ce qui est réglé ici, les recherches enregistrées et les colonnes des listes, dans un seul fichier : pour en garder une copie, ou configurer un autre PC de la même façon.",
  "Import…": "Importer…",
  "Administrator": "Administrateur",
  "Running as administrator": "Exécuté en tant qu’administrateur",
  "Running normally": "Exécuté normalement",
  "Every folder can be read, and whole NTFS drives are read from their file table in a few seconds.":
    "Tous les dossiers peuvent être lus, et les lecteurs NTFS entiers sont lus depuis leur table des fichiers en quelques secondes.",
  "As administrator, Disq Studio can read folders your account can't, and reads whole NTFS drives from their file table in a few seconds.":
    "En tant qu’administrateur, Disq Studio peut lire les dossiers que votre compte ne peut pas lire, et lit les lecteurs NTFS entiers depuis leur table des fichiers en quelques secondes.",
  "Updates": "Mises à jour",
  "Disq Studio is up to date": "Disq Studio est à jour",
  "Installing the update…": "Installation de la mise à jour…",
  "Checks for a new version once a day": "Recherche une nouvelle version une fois par jour",
  "It installs on its own and Disq Studio starts again, where you were.":
    "Elle s’installe toute seule et Disq Studio redémarre là où vous étiez.",
  "New versions come from the project's releases on GitHub, signed so only real ones install.":
    "Les nouvelles versions proviennent des publications du projet sur GitHub, signées pour que seules les authentiques s’installent.",
  "About": "À propos",
  "Disq Studio {0}. Everything stays on this PC: Disq Studio doesn't send your files, folder names or usage anywhere.":
    "Disq Studio {0}. Tout reste sur ce PC : Disq Studio n’envoie nulle part vos fichiers, noms de dossiers ni données d’utilisation.",
  "Done": "Terminé",
  "That file isn't Disq Studio settings.": "Ce fichier ne contient pas de paramètres Disq Studio.",

  // ----- Map and chart -----
  "{0}, {1}, {2} of view{3}": "{0}, {1}, {2} de la vue{3}",
  ", folder": ", dossier",
  "Sunburst of the current folder. Left and Right move along a ring, Down goes out a ring, Up comes back, Enter zooms in.":
    "Anneaux du dossier actuel. Gauche et Droite se déplacent le long d’un anneau, Bas passe à l’anneau extérieur, Haut revient, Entrée zoome.",
  "Drawing the chart": "Dessin du graphique",
  "{0} · online only": "{0} · en ligne uniquement",
  "Treemap of the current folder. Arrow keys move between blocks, ] goes into a folder, [ goes back out, Enter zooms in.":
    "Carte proportionnelle du dossier actuel. Les flèches passent d’un bloc à l’autre, ] entre dans un dossier, [ en ressort, Entrée zoome.",
  "Drawing the map": "Dessin de la carte",
  "Many small items": "Nombreux petits éléments",
  "Folder · access denied": "Dossier · accès refusé",
  "Online only, not on this drive": "En ligne uniquement, pas sur ce lecteur",
  "{0} free on this drive": "{0} libres sur ce lecteur",
  "{0} · {1} of view · {2}": "{0} · {1} de la vue · {2}",
  "Changed {0}": "Modifié : {0}",
  "Online only: stored in the cloud, not on this drive": "En ligne uniquement : stocké dans le cloud, pas sur ce lecteur",

  // ----- File type groups and ages -----
  "Video": "Vidéo",
  "Images": "Images",
  "Audio": "Audio",
  "Archives & disk images": "Archives et images disque",
  "Code & data": "Code et données",
  "Documents": "Documents",
  "Programs": "Programmes",
  "System & cache": "Système et cache",
  "Other": "Autres",
  "changed in 30 days": "modifié en 30 jours",
  "unchanged 1 year": "inchangé depuis 1 an",
  "unchanged 3 years": "inchangé depuis 3 ans",

  // ----- Units -----
  "0 bytes": "0 octet",
  "1 byte": "1 octet",
  "{0} bytes": "{0} octets",
  "{0} min {1} s": "{0} min {1} s",
  "no change": "aucun changement",

  // ----- Errors from the Rust side (lib.rs, snapshot.rs, admin.rs) -----
  "Nothing has been scanned yet.": "Rien n’a encore été analysé.",
  "That item is no longer in the scan.": "Cet élément ne fait plus partie de l’analyse.",
  "There's nothing to undo.": "Il n’y a rien à annuler.",
  "Only folders can be refreshed.": "Seuls les dossiers peuvent être actualisés.",
  "{0} is no longer there.": "{0} n’existe plus.",
  "{0} is not a folder that can be opened.": "{0} n’est pas un dossier qui peut être ouvert.",
  "The refresh was cancelled.": "L’actualisation a été annulée.",
  "The scan was cancelled.": "L’analyse a été annulée.",
  "This is an opened snapshot; it's already saved.": "C’est un instantané ouvert ; il est déjà enregistré.",
  "Only snapshots in the history can be deleted here.": "Seuls les instantanés de l’historique peuvent être supprimés ici.",
  "That snapshot is of {0}, not {1}": "Cet instantané concerne {0}, pas {1}",
  "Nothing is being compared.": "Rien n’est comparé.",
  "Settings are saved as a .json file.": "Les paramètres sont enregistrés dans un fichier .json.",
  "Pick a .json settings file.": "Choisissez un fichier de paramètres .json.",
  "That file is too big to be Disq Studio settings.": "Ce fichier est trop volumineux pour contenir des paramètres Disq Studio.",
  "Not a Disq Studio snapshot, or a damaged one: {0}": "Pas un instantané Disq Studio, ou un instantané endommagé : {0}",
  "This snapshot was saved by a newer Disq Studio. Update to open it.":
    "Cet instantané a été enregistré par une version plus récente de Disq Studio. Mettez à jour pour l’ouvrir.",
  "Restarting as administrator is only available on Windows.": "Le redémarrage en tant qu’administrateur n’est possible que sous Windows.",

  // ----- Mixed text -----
  "in {0}": "en {0}",
  "{0} excluded": "{0} exclus",
  "{0} skipped": "{0} ignorés",
  "Scanning {0}…": "Analyse de {0}…",
  "{0} of {1}": "{0} sur {1}",
  "{0} extra": "{0} en trop",
  "oldest": "plus ancienne",
  "{0} selected": "{0} sélectionnés",
  "{0} used": "{0} utilisés",
  "fixed": "fixe",
  "removable": "amovible",
  "network": "réseau",
  "optical": "optique",
  "RAM disk": "disque RAM",
};
