# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Backend with frontend static files
FROM python:3.11-slim
WORKDIR /app

# Install CPU-only PyTorch (saves ~2GB)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy built frontend into backend/static
COPY --from=frontend-build /app/frontend/dist ./static

# Railway provides PORT env var
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001} --ws-max-size 20971520
