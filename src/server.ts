import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import contentModerateRoutes from './routes/content-moderate';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', contentModerateRoutes);

app.get('/', (req, res) => {
  res.json({
    service: 'Content Moderation API',
    version: '1.0.0',
    endpoints: {
      moderation: 'POST /api/content-moderate',
      health: 'GET /api/health'
    }
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`Content Moderation API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Moderation endpoint: http://localhost:${PORT}/api/content-moderate`);
});