## Deployment Guide

### Prerequisites
- GitHub account
- Railway.app account

### Deployment Steps

1. **Prepare your repository**
   - Ensure your code is in a GitHub repository
   - Add a `Procfile` to your root directory:
     ```
     web: cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
     frontend: cd frontend && bun run build && bun run preview --host 0.0.0.0 --port $PORT
     ```
   - Add a `railway.json` file:
     ```json
     {
       "services": {
         "backend": {
           "path": "backend",
           "buildCommand": "pip install -r requirements.txt",
           "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
         },
         "frontend": {
           "path": "frontend",
           "buildCommand": "bun install && bun run build",
           "startCommand": "bun run preview --host 0.0.0.0 --port $PORT"
         }
       }
     }
     ```

2. **Deploy to Railway**
   - Go to [Railway.app](https://railway.app/)
   - Click "New Project" > "Deploy from GitHub repo"
   - Select your repository
   - Railway will detect your configuration and deploy both services
   - Configure environment variables in the Railway dashboard

3. **Configure domains**
   - In Railway dashboard, go to each service
   - Click "Settings" > "Domains"
   - Generate a domain for each service
   - Update your frontend code to use the backend domain for WebSocket connections

### Resource Requirements

- **CPU/Memory**: Railway offers autoscaling based on demand
  - Start with 0.5 CPU / 512MB RAM for the backend
  - 0.25 CPU / 256MB RAM is sufficient for the frontend

- **Scaling**: Railway automatically scales for spikes in traffic
  - For cost efficiency, set maximum instance count to control spending

This deployment setup costs approximately $5-15/month depending on traffic.