#!/bin/bash

# EasyPay Kiosk - Run All Tests
# This script runs both backend and frontend tests

echo "=================================="
echo "EasyPay Kiosk - Test Suite"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if test database exists
echo -e "${YELLOW}Checking test database...${NC}"
if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw easypay_test; then
    echo -e "${GREEN}✓ Test database exists${NC}"
else
    echo -e "${YELLOW}Creating test database...${NC}"
    createdb -U postgres easypay_test
    psql -U postgres -d easypay_test -f db/schema.sql
    echo -e "${GREEN}✓ Test database created${NC}"
fi

echo ""
echo "=================================="
echo "Backend Tests"
echo "=================================="
echo ""

# Run backend tests
npm test

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
    BACKEND_SUCCESS=1
else
    echo -e "${RED}✗ Backend tests failed${NC}"
    BACKEND_SUCCESS=0
fi

echo ""
echo "=================================="
echo "Frontend Tests"
echo "=================================="
echo ""

# Run frontend tests
cd frontend
npm test -- --watchAll=false --coverage

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
    FRONTEND_SUCCESS=1
else
    echo -e "${RED}✗ Frontend tests failed${NC}"
    FRONTEND_SUCCESS=0
fi

cd ..

echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="
echo ""

if [ $BACKEND_SUCCESS -eq 1 ] && [ $FRONTEND_SUCCESS -eq 1 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    [ $BACKEND_SUCCESS -eq 0 ] && echo -e "${RED}  - Backend tests failed${NC}"
    [ $FRONTEND_SUCCESS -eq 0 ] && echo -e "${RED}  - Frontend tests failed${NC}"
    exit 1
fi
