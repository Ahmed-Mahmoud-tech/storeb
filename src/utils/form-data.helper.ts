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

    return (input as T) || defaultValue;
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
}
