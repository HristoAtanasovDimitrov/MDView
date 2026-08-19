!macro customInstall
  ; Explicit friendly name so the "Open with" menu never falls back to a
  ; cached or embedded file description.
  WriteRegStr HKCU "Software\Classes\Applications\MDView.exe" "FriendlyAppName" "MDView"
  WriteRegStr HKCU "Software\Classes\Applications\MDView.exe\shell\open\command" "" '"$INSTDIR\MDView.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\Applications\MDView.exe"
!macroend
