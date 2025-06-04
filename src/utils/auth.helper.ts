export class AuthHelper {
  /**
   * Extracts user ID from authorization token
   *
   * @param authHeader Authorization header string (Bearer token)
   * @returns User ID from token payload or undefined if not available
   */
  static extractUserIdFromToken(
    authHeader?: string
  ): { userId: string } | undefined {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    try {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const tokenParts = token.split('.');

      if (tokenParts.length !== 3) {
        return undefined; // Not a valid JWT format
      }

      // Decode the payload (second part of the JWT)
      const payload = Buffer.from(tokenParts[1], 'base64').toString('utf-8');
      const parsedPayload = JSON.parse(payload);
      console.log(parsedPayload, 'parsedPayload');

      // Return the user ID from the payload
      return parsedPayload || undefined;
    } catch (error) {
      console.error('Error extracting user ID from token:', error);
      return undefined;
    }
  }
}
