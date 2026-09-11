@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo OPDesk Mobile - Release Build
echo ========================================
echo.

where flutter >nul 2>&1
if errorlevel 1 (
  echo ERROR: Flutter was not found in PATH.
  echo Install Flutter and reopen this terminal.
  exit /b 1
)

echo [1/3] Getting packages...
call flutter pub get
if errorlevel 1 exit /b 1

echo.
echo [2/3] Analyzing project...
call flutter analyze
if errorlevel 1 exit /b 1

echo.
echo [3/3] Building production APK...
call flutter build apk --release --dart-define=API_BASE_URL=https://bharat-infotechs-opdesk.vercel.app
if errorlevel 1 exit /b 1

echo.
echo ========================================
echo BUILD COMPLETE
echo ========================================
echo APK:
echo %CD%\build\app\outputs\flutter-apk\app-release.apk
echo.
pause
