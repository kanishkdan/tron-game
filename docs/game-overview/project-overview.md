# Project Overview

## What is Girgaya?
Girgaya is a browser-based multiplayer obstacle course elimination game inspired by Fall Guys. The game features 3D physics-based gameplay with multiple mini-games and real-time multiplayer functionality.

## Core Features
- Real-time multiplayer gameplay
- 3D physics-based obstacles
- Multiple mini-games
- Player elimination system
- Real-time synchronization
- Cross-platform compatibility

## Technical Stack
- Frontend: Three.js + Cannon.js for 3D rendering and physics
- Backend: FastAPI with WebSocket support
- Message Queue: RabbitMQ for game event handling
- Build Tool: Vite for frontend development

## Project Structure
```
girgaya/
├── frontend/           # Three.js + Vite frontend
│   ├── src/
│   │   ├── game/      # Game logic and components
│   │   ├── network/   # WebSocket and API clients
│   │   └── assets/    # 3D models and textures
│   └── public/        # Static assets
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   ├── game/     # Game logic
│   │   └── models/   # Data models
│   └── tests/        # Backend tests
└── docs/             # Project documentation
``` 