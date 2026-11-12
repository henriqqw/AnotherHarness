!include "LogicLib.nsh"

Var ahFinalDirectory
Var ahNewDirectory
Var ahOldDirectory
Var ahOldMoved
Var ahNewMoved

!macro ahExtractPayload FILE
  !ifmacrodef customInstallerExtract
    !insertmacro customInstallerExtract "${FILE}"
  !else
    nsExec::ExecToStack '"$PLUGINSDIR\ah-7za.exe" x -y -bd -bb0 "-o$INSTDIR" "${FILE}"'
    Pop $R0
    Pop $R1
  !endif
  ${If} $R0 != 0
    DetailPrint $R1
    Call ahRollbackDirectories
    !ifmacrodef customInstallerExtractFailed
      !insertmacro customInstallerExtractFailed "${FILE}"
    !else
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(decompressionFailed)" /SD IDOK
    !endif
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro ahStageApplication
  StrCpy $ahFinalDirectory $INSTDIR
  System::Call 'ole32::CoCreateGuid(g .r0) i .r1'
  ${If} $1 != 0
    SetErrorLevel 2
    Quit
  ${EndIf}
  StrCpy $ahNewDirectory "$INSTDIR.new-$0"
  StrCpy $ahOldDirectory "$INSTDIR.old-$0"
  StrCpy $ahOldMoved ""
  StrCpy $ahNewMoved ""
  ClearErrors
  CreateDirectory $ahNewDirectory
  ${If} ${Errors}
    SetErrorLevel 2
    Quit
  ${EndIf}
  File /oname=$PLUGINSDIR\ah-7za.exe "${AH_SEVENZIP_PATH}"
  StrCpy $INSTDIR $ahNewDirectory
  SetOutPath $INSTDIR
  !insertmacro installApplicationFiles
  !ifdef AH_SEVENZIP_LICENSE_DIR
    File /oname=7zip-installer-LICENSE.txt "${AH_SEVENZIP_LICENSE_DIR}\LICENSE.txt"
    File /oname=7zip-installer-COPYING.txt "${AH_SEVENZIP_LICENSE_DIR}\COPYING"
  !endif
  !ifdef UNINSTALLER_ICON
    File /oname=uninstallerIcon.ico "${UNINSTALLER_ICON}"
  !endif
  StrCpy $INSTDIR $ahFinalDirectory
  SetOutPath $PLUGINSDIR
!macroend

Function .onGUIEnd
  Call ahCleanupDirectories
FunctionEnd

Function ahCleanupDirectories
  ${If} $ahFinalDirectory != ""
    Call ahRollbackDirectories
  ${EndIf}
FunctionEnd

; Only directories created or renamed by this installer are removed during rollback.
Function ahRollbackDirectories
  SetOutPath $PLUGINSDIR
  ${If} $ahNewMoved == "1"
    RMDir /r "\\?\$ahFinalDirectory"
    StrCpy $ahNewMoved ""
  ${EndIf}
  ${If} $ahOldMoved == "1"
    ClearErrors
    Rename $ahOldDirectory $ahFinalDirectory
    ${If} ${Errors}
      ; Leave the complete backup in place if another process prevents restoration.
      DetailPrint $ahOldDirectory
      Return
    ${EndIf}
    StrCpy $ahOldMoved ""
  ${EndIf}
  ${If} $ahNewDirectory != ""
    RMDir /r "\\?\$ahNewDirectory"
  ${EndIf}
  StrCpy $INSTDIR $ahFinalDirectory
FunctionEnd

Function ahPromoteDirectories
  !ifmacrodef InstallerPublishStage
    !insertmacro InstallerPublishStage 2
  !endif
  ; SetOutPath opens a directory handle; release it before either rename.
  SetOutPath $PLUGINSDIR
  ClearErrors
  ${If} ${FileExists} "$ahFinalDirectory\*.*"
    Rename $ahFinalDirectory $ahOldDirectory
    ${If} ${Errors}
      Call ahRollbackDirectories
      SetErrors
      Return
    ${EndIf}
    StrCpy $ahOldMoved "1"
  ${Else}
    ; NSIS can create the destination before the install section starts.
    RMDir $ahFinalDirectory
  ${EndIf}
  ClearErrors
  Rename $ahNewDirectory $ahFinalDirectory
  ${If} ${Errors}
    Call ahRollbackDirectories
    SetErrors
    Return
  ${EndIf}
  StrCpy $ahNewMoved "1"
  SetOutPath $ahFinalDirectory
  !ifmacrodef InstallerPublishStage
    !insertmacro InstallerPublishStage 3
  !endif
  ClearErrors
FunctionEnd

!macro ahFinishDirectories
  StrCpy $ahNewMoved ""
  ${If} $ahOldMoved == "1"
    RMDir /r "\\?\$ahOldDirectory"
    StrCpy $ahOldMoved ""
  ${EndIf}
!macroend
