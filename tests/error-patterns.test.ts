import { describe, it, expect } from "vitest";
import {
  DEFAULT_ERROR_PATTERNS,
  getAllErrorPatterns,
} from "../src/shared/error-detector.js";

describe("Error Patterns", () => {
  describe("DEFAULT_ERROR_PATTERNS", () => {
    it("should contain basic error patterns", () => {
      expect(DEFAULT_ERROR_PATTERNS.length).toBeGreaterThan(0);
      expect(Array.isArray(DEFAULT_ERROR_PATTERNS)).toBe(true);
    });

    it("should match common error keywords", () => {
      const errorPattern = DEFAULT_ERROR_PATTERNS[0]; // First pattern should match errors
      expect(errorPattern.test("An error occurred")).toBe(true);
      expect(errorPattern.test("ERROR: Database connection failed")).toBe(true);
      expect(errorPattern.test("Error processing request")).toBe(true);
      expect(errorPattern.test("Success message")).toBe(false);
    });

    it("should match HTTP error codes", () => {
      const httpPattern = DEFAULT_ERROR_PATTERNS.find(pattern =>
        pattern.test("404 not found")
      );
      expect(httpPattern).toBeDefined();
      expect(httpPattern!.test("500 internal server error")).toBe(true);
      expect(httpPattern!.test("bad request")).toBe(true);
      expect(httpPattern!.test("200 OK")).toBe(false);
    });
  });

  describe("getAllErrorPatterns", () => {
    it("should return default patterns when no custom patterns provided", () => {
      const patterns = getAllErrorPatterns();
      expect(patterns.length).toBe(DEFAULT_ERROR_PATTERNS.length);
    });

    it("should combine default and custom patterns", () => {
      const customPattern = /TEST_ERROR/;
      const patterns = getAllErrorPatterns([customPattern]);
      expect(patterns.length).toBe(DEFAULT_ERROR_PATTERNS.length + 1);
      expect(patterns).toContain(customPattern);
    });
  });
});
