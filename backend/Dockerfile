FROM python:3.11-slim

WORKDIR /app

# Install CPU-only PyTorch first (saves ~2GB vs full version)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and model checkpoint
COPY . .

# Railway provides PORT env var
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001} --ws-max-size 20971520
