import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ERROR_PATTERNS,
  createCustomErrorPattern,
  getAllErrorPatterns,
} from '../src/shared/error-patterns.js';

describe('Error Patterns', () => {
  describe('DEFAULT_ERROR_PATTERNS', () => {
    it('should contain basic error patterns', () => {
      expect(DEFAULT_ERROR_PATTERNS.length).toBeGreaterThan(0);
      
      const patternNames = DEFAULT_ERROR_PATTERNS.map(p => p.name);
      expect(patternNames).toContain('Generic Error');
      expect(patternNames).toContain('Exception');
      expect(patternNames).toContain('HTTP Error');
    });

    it('should match common error keywords', () => {
      const genericErrorPattern = DEFAULT_ERROR_PATTERNS.find(p => p.name === 'Generic Error');
      expect(genericErrorPattern).toBeDefined();
      
      expect(genericErrorPattern!.regex.test('An error occurred')).toBe(true);
      expect(genericErrorPattern!.regex.test('ERROR: Database connection failed')).toBe(true);
      expect(genericErrorPattern!.regex.test('Error processing request')).toBe(true);
      expect(genericErrorPattern!.regex.test('Success message')).toBe(false);
    });

    it('should match HTTP error codes', () => {
      const httpErrorPattern = DEFAULT_ERROR_PATTERNS.find(p => p.name === 'HTTP Error');
      expect(httpErrorPattern).toBeDefined();
      
      expect(httpErrorPattern!.regex.test('404 not found')).toBe(true);
      expect(httpErrorPattern!.regex.test('500 internal server error')).toBe(true);
      expect(httpErrorPattern!.regex.test('bad request')).toBe(true);
      expect(httpErrorPattern!.regex.test('200 OK')).toBe(false);
    });
  });

  describe('createCustomErrorPattern', () => {
    it('should create valid custom pattern', () => {
      const pattern = createCustomErrorPattern(
        'Custom Pattern',
        'CUSTOM_ERROR_\\d+',
        'Matches custom error codes'
      );

      expect(pattern.name).toBe('Custom Pattern');
      expect(pattern.description).toBe('Matches custom error codes');
      expect(pattern.regex.test('CUSTOM_ERROR_123')).toBe(true);
      expect(pattern.regex.test('OTHER_ERROR_123')).toBe(false);
    });

    it('should throw error for invalid regex', () => {
      expect(() => {
        createCustomErrorPattern('Invalid', '[invalid regex', 'Invalid pattern');
      }).toThrow();
    });
  });

  describe('getAllErrorPatterns', () => {
    it('should return default patterns when no custom patterns provided', () => {
      const patterns = getAllErrorPatterns();
      expect(patterns.length).toBe(DEFAULT_ERROR_PATTERNS.length);
    });

    it('should combine default and custom patterns', () => {
      const customPattern = createCustomErrorPattern(
        'Test Pattern',
        'TEST_ERROR',
        'Test pattern'
      );
      
      const patterns = getAllErrorPatterns([customPattern]);
      expect(patterns.length).toBe(DEFAULT_ERROR_PATTERNS.length + 1);
      expect(patterns).toContain(customPattern);
    });
  });
});