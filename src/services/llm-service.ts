import axios from 'axios';
import fs from 'fs';
import { ModerationResponse, LLMRequest, OllamaResponse } from '../types';

export class LLMService {
  private ollamaUrl = 'http://localhost:11434/api/generate';
  private model = 'moondream:1.8b';
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = fs.readFileSync('./ethics-prompt-short.txt', 'utf8');
  }

  async moderateContent(text?: string, imageBuffer?: Buffer): Promise<ModerationResponse> {
    try {
      const prompt = this.buildPrompt(text);
      const images = imageBuffer ? [imageBuffer.toString('base64')] : undefined;

      const request: LLMRequest = {
        model: this.model,
        prompt: `${this.systemPrompt}\n\nCONTENT TO ANALYZE: ${prompt}\n\nRespond with JSON only:`,
        images,
        stream: false
      };

      console.log('Sending request to Ollama...');
      const response = await axios.post<OllamaResponse>(this.ollamaUrl, request, {
        timeout: 15000,
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
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
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
    } catch (error) {
      console.error('Failed to parse LLM response:', response);
      
      // Fallback analysis for non-JSON responses
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