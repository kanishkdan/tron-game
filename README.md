# Tron-Game - Multiplayer Light Cycle Game

A browser-based multiplayer light cycle game inspired by Tron. Built with Three.js, Cannon.js, FastAPI, and WebSocket technology.

## Features

- 3D physics-based light cycle gameplay
- Real-time multiplayer grid racing
- Light trail generation and collision system
- Cross-platform support (mobile and desktop)
- Responsive controls and UI
- Tron-inspired visual effects

## Tech Stack

- Frontend:
  - Three.js for 3D rendering
  - Cannon.js for physics
  - TypeScript
  - Vite for build tooling

- Backend:
  - FastAPI
  - WebSocket support
  - RabbitMQ for message queue
  - Python 3.9+

## Getting Started

### Prerequisites

- Node.js 16+
- Python 3.9+
- RabbitMQ server
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tron-game.git
cd tron-game
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd ../backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Development

1. Start the backend server:
```bash
cd backend
uvicorn app.main:app --reload
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
tron-game/
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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Three.js community for 3D rendering
- FastAPI team for the excellent web framework
- Tron franchise for inspiration 