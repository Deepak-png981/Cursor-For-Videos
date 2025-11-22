#!/bin/bash
echo "Starting Backend..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting Frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Both services started. Press Ctrl+C to stop."
wait $BACKEND_PID $FRONTEND_PID

