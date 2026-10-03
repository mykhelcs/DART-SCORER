@echo off
title Darts Scorer
setlocal

:: Determine project directory: local repo or absolute path
if exist "%~dp0package.json" (
    set "PROJECT_DIR=%~dp0"
) else (
    set "PROJECT_DIR=C:\Users\ghjgjhgjgjg\Documents\SCHOOL\DART SCORER"
)

if not exist "%PROJECT_DIR%" (
    echo [ERROR] Project directory not found at:
    echo "%PROJECT_DIR%"
    echo.
    echo Please verify the location of your DART SCORER project.
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"

echo ========================================================
echo               INTRAMURALS DARTS SCORER
echo ========================================================
echo.

:: 1. Verify Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js from https://nodejs.org to run the application.
    pause
    exit /b 1
)

:: 2. Verify pnpm
set "PKG_CMD=pnpm"
where pnpm.cmd >nul 2>&1
if not errorlevel 1 (
    set "PKG_CMD=pnpm.cmd"
) else (
    where pnpm >nul 2>&1
    if errorlevel 1 (
        echo [INFO] pnpm not found in PATH, using npx pnpm...
        set "PKG_CMD=npx pnpm"
    )
)

:: 3. Check dependencies
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call %PKG_CMD% install
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting Darts Scorer services...
echo   - Backend SQLite API : http://localhost:3001
echo   - Web App UI        : http://localhost:5173
echo.
echo Opening browser at http://localhost:5173 in 3 seconds...
echo Keep this window open while using the app. Press Ctrl+C to stop.
echo ========================================================
echo.

:: 4. Background browser trigger (opens default browser at localhost:5173)
start "" /B cmd /c "ping 127.0.0.1 -n 4 >nul & start http://localhost:5173"

:: 5. Start all services (Backend + Frontend)
call %PKG_CMD% run dev:all

if errorlevel 1 (
    echo.
    echo [INFO] Server stopped.
)

pause
