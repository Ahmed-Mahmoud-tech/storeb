// Helper class for handling form data parsing
export class FormDataHelper {
  /**
   * Parse JSON strings in form-data to JavaScript objects
   * @param input The form data value that might be a JSON string
   */
  static parseIfJSON<T>(input: unknown, defaultValue: T): T {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input) as T;
      } catch (error) {
        console.error('Failed to parse JSON string:', error);
        return defaultValue;
      }
    }

    // Return input if it's defined (including empty arrays/objects), otherwise return defaultValue
    return input !== undefined && input !== null ? (input as T) : defaultValue;
  }

  /**
   * Convert string boolean values ('true'/'false') to actual booleans
   */
  static parseBoolean(input: unknown): boolean {
    if (typeof input === 'string') {
      return input.toLowerCase() === 'true';
    }
    return !!input;
  }

  /**
   * Safely trim string values and handle non-string inputs
   */
  static parseString(input: unknown, defaultValue: string = ''): string {
    if (typeof input === 'string') {
      return input.trim();
    }
    return defaultValue;
  }

  /**
   * Parse string or other values to number
   */
  static parseNumber(input: unknown): number {
    if (typeof input === 'string') {
      const num = parseFloat(input);
      return isNaN(num) ? 0 : num;
    } else if (typeof input === 'number') {
      return input;
    }
    return 0;
  }
}
