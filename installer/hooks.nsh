; Extra install steps for Disq Studio's NSIS installer (wired up in tauri.conf.json).
;
; Adds "Analyze with Disq Studio" to File Explorer's right-click menu for
; folders, drives and the empty space inside a folder. Everything goes under
; HKCU, so no administrator rights are needed, and the uninstaller removes it.
; Disq Studio scans whatever path it's started with (see `startup_path` in lib.rs).

!define DS_MENU_TEXT "Analyze with Disq Studio"
!define DS_EXE "$INSTDIR\${MAINBINARYNAME}.exe"

!macro DS_ADD_VERB KEY ARG
  WriteRegStr HKCU "Software\Classes\${KEY}\shell\DisqStudio" "" "${DS_MENU_TEXT}"
  WriteRegStr HKCU "Software\Classes\${KEY}\shell\DisqStudio" "Icon" "${DS_EXE},0"
  WriteRegStr HKCU "Software\Classes\${KEY}\shell\DisqStudio\command" "" '"${DS_EXE}" "${ARG}"'
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro DS_ADD_VERB "Directory" "%1"
  !insertmacro DS_ADD_VERB "Drive" "%1"
  !insertmacro DS_ADD_VERB "Directory\Background" "%V"
  ; The app was called Disk Studio before 1.0: drop its menu entry, so it isn't there twice.
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DiskStudio"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\DiskStudio"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DiskStudio"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DisqStudio"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\DisqStudio"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DisqStudio"
!macroend
