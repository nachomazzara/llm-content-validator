import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { LLMService } from '../services/llm-service';
import { ModerationRequest } from '../types';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const llmService = new LLMService();

router.post('/content-moderate', upload.single('image'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { text, model } = req.body as ModerationRequest;
    const imageFile = req.file;

    if (!text && !imageFile) {
      return res.status(400).json({
        error: 'Either text or image must be provided'
      });
    }

    // Resize image if provided
    let processedImageBuffer = imageFile?.buffer;
    if (imageFile) {
      console.log('Resizing image from', imageFile.size, 'bytes');
      processedImageBuffer = await sharp(imageFile.buffer)
        .resize(512, 512, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      console.log('Resized image to', processedImageBuffer?.length || 0, 'bytes');
    }

    console.log('Processing moderation request:', { 
      hasText: !!text, 
      hasImage: !!imageFile,
      textLength: text?.length || 0,
      originalImageSize: imageFile?.size || 0,
      resizedImageSize: processedImageBuffer?.length || 0,
      imageMimetype: imageFile?.mimetype || null,
      startTime: new Date(startTime).toISOString()
    });

    const result = await llmService.moderateContent(
      text,
      processedImageBuffer,
      model
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('Moderation completed:', {
      ...result,
      processingTimeMs: duration,
      processingTimeSec: (duration / 1000).toFixed(2)
    });

    res.json({
      ...result,
      processingTimeMs: duration
    });
  } catch (error) {
    console.error('Content moderation error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const ollamaHealthy = await llmService.healthCheck();
    
    res.json({
      status: ollamaHealthy ? 'healthy' : 'degraded',
      ollama: ollamaHealthy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;