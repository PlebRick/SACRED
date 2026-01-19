#!/bin/bash

# SACRED Development Server Startup Script
# Kills any stuck processes and starts both frontend and backend

echo "🔪 Killing any existing processes on ports 3000 and 3001..."

# Kill processes silently (ignore errors if nothing to kill)
lsof -t -i:3000 | xargs kill -9 2>/dev/null
lsof -t -i:3001 | xargs kill -9 2>/dev/null

# Small delay to ensure ports are freed
sleep 1

echo "🚀 Starting SACRED development servers..."
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "----------------------------------------"

# Start both servers concurrently
# Backend in background, frontend in foreground
PORT=3001 node server/index.cjs &
BACKEND_PID=$!

# Start frontend
npm run dev

# When frontend exits (Ctrl+C), kill backend too
kill $BACKEND_PID 2>/dev/null
