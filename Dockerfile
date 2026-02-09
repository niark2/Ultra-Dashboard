FROM node:20-bookworm

# Install system dependencies
# ffmpeg: For media conversion and processing
# libgl1: Required for OpenCV (used by some python scripts)
# python3 & pip: For running AI services
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libgl1 \
    curl \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Run build to bundle CSS/JS
RUN npm run build || echo "Build failed, but continuing..."

# Install Python dependencies for AI services
# Optimization: Force CPU-only version of PyTorch to save space and avoid CUDA bloat
RUN pip3 install --no-cache-dir --break-system-packages torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining requirements
RUN pip3 install --no-cache-dir -r server/python/requirements.txt || \
    pip3 install --no-cache-dir --break-system-packages -r server/python/requirements.txt

# Create necessary directories
RUN mkdir -p uploads public/databank data

# Expose the main port
EXPOSE 3000

# Start command: cleanup lock file and start server
CMD ["sh", "-c", "rm -f server.lock && npm start"]
