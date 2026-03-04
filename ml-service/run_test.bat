@echo off
chcp 65001 > nul
echo ============================================================
echo   RDD Backend - Full Test Suite
echo ============================================================
echo.

set FAIL=0

echo [1/2] Running ML Service E2E Tests (FastAPI - port 8000)...
echo ============================================================
call venv\Scripts\python test_e2e_apis.py
if %errorlevel% neq 0 set FAIL=1
echo.

echo [2/2] Running Frontend API Tests (Next.js - port 3000)...
echo ============================================================
call venv\Scripts\python test_frontend_apis.py
if %errorlevel% neq 0 set FAIL=1
echo.

echo ============================================================
if %FAIL%==0 (
    echo   ALL TESTS PASSED
) else (
    echo   SOME TESTS FAILED - review output above
)
echo ============================================================
exit /b %FAIL%
