#!/bin/bash

# Setup script for The All Thing Project
# Run this after cloning the repo on a new machine

set -e

echo "🚀 Setting up The All Thing Project..."
echo ""

# Backend setup
echo "📦 Setting up backend..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env from template"
    echo "⚠️  Edit backend/.env with your local database/redis credentials"
else
    echo "ℹ️  backend/.env already exists, skipping"
fi

# Frontend setup
echo ""
echo "🎨 Setting up frontend..."
if [ ! -f frontend/.env.local ]; then
    cp frontend/.env.local.example frontend/.env.local
    echo "✅ Created frontend/.env.local from template"
    echo "⚠️  Edit frontend/.env.local with your API URL"
else
    echo "ℹ️  frontend/.env.local already exists, skipping"
fi

# Install dependencies
echo ""
echo "📥 Installing dependencies..."

echo "  Backend (Python)..."
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

echo "  Frontend (Node)..."
cd frontend
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env with your database credentials"
echo "  2. Edit frontend/.env.local with your API URL"
echo "  3. Start the backend: cd backend && uvicorn app.main:app --reload"
echo "  4. Start the frontend: cd frontend && npm run dev"
echo ""
