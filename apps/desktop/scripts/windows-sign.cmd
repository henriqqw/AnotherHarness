@echo off
setlocal DisableDelayedExpansion
set "signTool=%AH_DESKTOP_WINDOWS_SIGNTOOL%"
set "certificateFile=%AH_DESKTOP_WINDOWS_CER_FILE%"
set "tokenPin=%AH_DESKTOP_WINDOWS_TOKEN_PIN%"
set "keyContainer=%AH_DESKTOP_WINDOWS_KEY_CONTAINER%"
set "targetFile=%AH_DESKTOP_WINDOWS_SIGN_TARGET%"
set "appendSignature="
if "%AH_DESKTOP_WINDOWS_SIGN_APPEND%"=="1" set "appendSignature=/as"
set "AH_DESKTOP_WINDOWS_SIGNTOOL="
set "AH_DESKTOP_WINDOWS_CER_FILE="
set "AH_DESKTOP_WINDOWS_TOKEN_PIN="
set "AH_DESKTOP_WINDOWS_KEY_CONTAINER="
set "AH_DESKTOP_WINDOWS_SIGN_TARGET="
set "AH_DESKTOP_WINDOWS_SIGN_APPEND="
set "signTool=" & set "certificateFile=" & set "tokenPin=" & set "keyContainer=" & set "targetFile=" & set "appendSignature=" & "%signTool%" sign /v /fd sha256 /f "%certificateFile%" /kc "[{{%tokenPin%}}]=%keyContainer%" /csp "eToken Base Cryptographic Provider" %appendSignature% "%targetFile%"
exit /b %errorlevel%
