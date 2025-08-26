# Content Moderation API

AI-powered content moderation service using Moondream and LLaVA models for analyzing text and images against corporate ethics guidelines.

## Features

- ⚡ Ultra-fast LLMs (Moondream 1.8B, LLaVA 7B) - ~400-800ms response times  
- 🖼️ Multimodal support (text + images)
- 🐳 Single Docker container deployment
- 🚀 Express.js TypeScript API
- ☁️ AWS-ready architecture
- 💰 No external API costs

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and run
docker-compose up --build

# API will be available at http://localhost:3000
```

### Using Docker directly

```bash
# Build
docker build -t content-moderation .

# Run (requires 4-8GB RAM)
docker run -p 3000:3000 content-moderation
```

### Local Development

```bash
npm install
npm run dev
```

## API Usage

### Content Moderation Endpoint

**POST** `/api/content-moderate`

**Content-Type**: `multipart/form-data`

**Body**:
- `text` (optional): Text content to moderate
- `image` (optional): Image file to analyze
- `model` (optional): Model to use ('moondream' | 'llava'). Defaults to 'moondream'

**Supported Image Formats**:
- PNG (`.png`)
- JPEG/JPG (`.jpg`, `.jpeg`)
- GIF (`.gif`)
- WebP (`.webp`)
- BMP (`.bmp`)
- TIFF (`.tiff`)
- SVG (`.svg`)
- Maximum file size: 10MB

**Response**:
```json
{
  "isCompliant": true,
  "confidence": 0.95,
  "reason": "Content appears professional and appropriate",
  "violations": []
}
```

### Health Check

**GET** `/api/health`

```json
{
  "status": "healthy",
  "ollama": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Examples

### Text only (default Moondream model)
```bash
curl -X POST http://localhost:3000/api/content-moderate \
  -F "text=This is a professional business proposal"
```

### Text with LLaVA model
```bash
curl -X POST http://localhost:3000/api/content-moderate \
  -F "text=This is a professional business proposal" \
  -F "model=llava"
```

### Image only (default Moondream model)
```bash
curl -X POST http://localhost:3000/api/content-moderate \
  -F "image=@screenshot.png"
```

### Image with LLaVA model
```bash
curl -X POST http://localhost:3000/api/content-moderate \
  -F "image=@screenshot.png" \
  -F "model=llava"
```

### Text + Image with Moondream
```bash
curl -X POST http://localhost:3000/api/content-moderate \
  -F "text=Check out this design" \
  -F "image=@design.jpg" \
  -F "model=moondream"
```

### Text + Image with LLaVA
```bash
curl -X POST http://localhost:3000/api/content-moderate \
  -F "text=Check out this design" \
  -F "image=@design.jpg" \
  -F "model=llava"
```

## AWS Deployment

### ECS Fargate
- Use `t3.large` or larger instance
- Minimum 4GB RAM, 8GB recommended
- Single container task definition

### EC2
- Instance: `t3.large` minimum
- GPU optional: `g4dn.xlarge` for better performance
- EBS storage: 20GB+ for model files

## Configuration

Edit `ethics-prompt.txt` to customize your organization's ethics guidelines.

## Resource Requirements

- **RAM**: 4-8GB minimum
- **Storage**: 10GB (for model files)
- **CPU**: 2+ cores recommended
- **Network**: Download ~2GB model on first run