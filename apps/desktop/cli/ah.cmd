@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\..\..\AnotherHarness.exe" --expose-internals "%~dp0..\..\..\app.asar\ah\node_modules\@anotherharness\ah-desktop-host\lib\cli.js" %*
exit /b %errorlevel%
