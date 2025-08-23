export interface ModerationRequest {
  text?: string;
  image?: Express.Multer.File;
}

export interface ModerationResponse {
  isCompliant: boolean;
  confidence: number;
  reason: string;
  violations: string[];
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface LLMRequest {
  model: string;
  prompt: string;
  images?: string[];
  stream: boolean;
}