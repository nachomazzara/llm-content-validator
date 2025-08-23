import axios from 'axios';
import fs from 'fs';
import { ModerationResponse, LLMRequest, OllamaResponse } from '../types';

export class LLMService {
  private ollamaUrl = 'http://localhost:11434/api/generate';
  private defaultModel = 'moondream:1.8b';
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = fs.readFileSync('./ethics-prompt.txt', 'utf8');
  }

  async moderateContent(text?: string, imageBuffer?: Buffer, modelName?: string): Promise<ModerationResponse> {
    try {
      const prompt = this.buildPrompt(text);
      const images = imageBuffer ? [imageBuffer.toString('base64')] : undefined;

      const selectedModel = this.getModelName(modelName);
      
      const request: LLMRequest = {
        model: selectedModel,
        prompt: this.systemPrompt.replace('{user_prompt}', prompt),
        images,
        stream: false,
        options: {
          num_ctx: 2048,
          temperature: 0.1,
          num_predict: 256,
          num_gpu: 1
        }
      };

      const response = await axios.post<OllamaResponse>(this.ollamaUrl, request, {
        timeout: 40000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return this.parseResponse(response.data.response, prompt);
    } catch (error) {
      console.error('LLM Service Error:', error);
      throw new Error(`Failed to moderate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(text?: string): string {
    let prompt = '';
    
    if (text) {
      prompt += `Text: "${text}"`;
    }
    
    if (!text) {
      prompt = 'Please analyze the provided image for compliance with ethics guidelines.';
    }

    return prompt;
  }

  private parseResponse(response: string, originalPrompt?: string): ModerationResponse {
    console.log('Raw response:', response);
    
    // Try 1: Parse as-is
    try {
      const parsed = JSON.parse(response);
      return this.buildResult(parsed, originalPrompt);
    } catch (error) {
      console.log('Direct JSON parse failed, trying cleanup...');
    }
    
    // Try 2: Basic cleanup
    try {
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return this.buildResult(parsed, originalPrompt);
    } catch (error) {
      console.log('Basic cleanup failed, trying extraction...');
    }
    
    // Try 3: Extract JSON object
    try {
      const jsonMatch = response.match(/{[\s\S]*}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.buildResult(parsed, originalPrompt);
      }
    } catch (error) {
      console.log('JSON extraction failed, trying repair...');
    }
    
    // Try 4: Repair truncated JSON
    try {
      let partialJson = response.match(/{[^}]*"isCompliant"[^}]*}/)?.[0];
      if (partialJson && !partialJson.includes('"confidence"')) {
        partialJson = partialJson.replace('}', ',"confidence":0.8,"reason":"Partial response","violations":[]}');
      }
      if (partialJson) {
        const parsed = JSON.parse(partialJson);
        return this.buildResult(parsed, originalPrompt);
      }
    } catch (error) {
      console.log('JSON repair failed, using text analysis fallback');
    }
    
    // Fallback: Text analysis
    return this.textAnalysisFallback(response, originalPrompt);
  }
  
  private buildResult(parsed: any, originalPrompt?: string): ModerationResponse {
    let result = {
      isCompliant: Boolean(parsed.isCompliant),
      confidence: Number(parsed.confidence) || 0,
        reason: String(parsed.reason) || 'No reason provided',
      violations: Array.isArray(parsed.violations) ? parsed.violations : []
    };

    // Double-check with our own validation
    if (originalPrompt && this.hasOffensiveContent(originalPrompt)) {
      result.isCompliant = false;
      result.confidence = Math.max(result.confidence, 0.9);
      result.reason = 'Contains offensive language detected by validation';
      result.violations = ['profanity', 'offensive_language'];
    }
    
    return result;
  }
  
  private getModelName(modelName?: string): string {
    switch(modelName?.toLowerCase()) {
      case 'llava':
        return 'llava:latest';
      case 'moondream':
      default:
        return this.defaultModel;
    }
  }

  private textAnalysisFallback(response: string, originalPrompt?: string): ModerationResponse {
      const lowerResponse = response.toLowerCase();
      const hasOffensiveWords = lowerResponse.includes('bitch') || 
                               lowerResponse.includes('fuck') || 
                               lowerResponse.includes('nigga');
      const hasNegativeIndicators = lowerResponse.includes('inappropriate') ||
                                   lowerResponse.includes('violation') ||
                                   lowerResponse.includes('offensive') ||
                                   lowerResponse.includes('not compliant') ||
                                   lowerResponse.includes('severity') ||
                                   lowerResponse.includes('hitler') ||
                                   lowerResponse.includes('nazi') ||
                                   lowerResponse.includes('fascist') ||
                                   lowerResponse.includes('hate') ||
                                   lowerResponse.includes('discriminat') ||
                                   lowerResponse.includes('racist') ||
                                   lowerResponse.includes('swastika');
      
      const hasViolations = hasOffensiveWords || hasNegativeIndicators;
      
      return {
        isCompliant: !hasViolations,
        confidence: hasViolations ? 0.9 : 0.7,
        reason: hasViolations ? 'Content contains offensive language or inappropriate material' : 'Content appears appropriate for workplace',
        violations: hasOffensiveWords ? ['profanity', 'offensive_language'] : hasNegativeIndicators ? ['policy_violation'] : []
      };
  }

  private hasOffensiveContent(text: string): boolean {
    const lowerText = text.toLowerCase();
    const offensiveWords = ['bitch', 'fuck', 'nigga', 'shit', 'damn', 'ass', 'bastard'];
    const hateTerms = ['hitler', 'nazi', 'fascist', 'racist'];
    
    return offensiveWords.some(word => lowerText.includes(word)) ||
           hateTerms.some(word => lowerText.includes(word));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get('http://localhost:11434/api/tags', {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}