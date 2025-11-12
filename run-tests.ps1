# EasyPay Kiosk - Run All Tests (Windows)
# This script runs both backend and frontend tests

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "EasyPay Kiosk - Test Suite" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if test database exists
Write-Host "Checking test database..." -ForegroundColor Yellow

$dbExists = psql -U postgres -lqt | Select-String "easypay_test"

if ($dbExists) {
    Write-Host "✓ Test database exists" -ForegroundColor Green
} else {
    Write-Host "Creating test database..." -ForegroundColor Yellow
    createdb -U postgres easypay_test
    psql -U postgres -d easypay_test -f db/schema.sql
    Write-Host "✓ Test database created" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Backend Tests" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Run backend tests
npm test

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend tests passed" -ForegroundColor Green
    $backendSuccess = $true
} else {
    Write-Host "✗ Backend tests failed" -ForegroundColor Red
    $backendSuccess = $false
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Frontend Tests" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Run frontend tests
Set-Location frontend
npm test -- --watchAll=false --coverage

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Frontend tests passed" -ForegroundColor Green
    $frontendSuccess = $true
} else {
    Write-Host "✗ Frontend tests failed" -ForegroundColor Red
    $frontendSuccess = $false
}

Set-Location ..

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if ($backendSuccess -and $frontendSuccess) {
    Write-Host "✓ All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ Some tests failed" -ForegroundColor Red
    if (-not $backendSuccess) {
        Write-Host "  - Backend tests failed" -ForegroundColor Red
    }
    if (-not $frontendSuccess) {
        Write-Host "  - Frontend tests failed" -ForegroundColor Red
    }
    exit 1
}
