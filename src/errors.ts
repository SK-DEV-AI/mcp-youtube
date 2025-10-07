/**
 * Enhanced error handling utilities for YouTube MCP Server
 */

export class YouTubeMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'YouTubeMCPError';
  }
}

export const ErrorCodes = {
  YT_DLP_NOT_FOUND: 'YT_DLP_NOT_FOUND',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  INVALID_URL: 'INVALID_URL',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FORMAT_NOT_AVAILABLE: 'FORMAT_NOT_AVAILABLE',
  SUBTITLES_NOT_AVAILABLE: 'SUBTITLES_NOT_AVAILABLE',
  CACHE_ERROR: 'CACHE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export function createMCPError(
  message: string,
  code: string = ErrorCodes.UNKNOWN_ERROR,
  retryable: boolean = false,
  originalError?: Error
): YouTubeMCPError {
  return new YouTubeMCPError(message, code, retryable, originalError);
}

export function handleYtDlpError(error: Error, url: string): YouTubeMCPError {
  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes('video not found') || errorMessage.includes('404')) {
    return createMCPError(
      `Video not found or unavailable: ${url}`,
      ErrorCodes.VIDEO_NOT_FOUND,
      false,
      error
    );
  }

  if (errorMessage.includes('sign in to confirm') || errorMessage.includes('age')) {
    return createMCPError(
      'Video requires authentication or age verification',
      ErrorCodes.PERMISSION_DENIED,
      false,
      error
    );
  }

  if (errorMessage.includes('no subtitles') || errorMessage.includes('subtitles not available')) {
    return createMCPError(
      'No subtitles available for this video',
      ErrorCodes.SUBTITLES_NOT_AVAILABLE,
      false,
      error
    );
  }

  if (errorMessage.includes('format not available') || errorMessage.includes('requested format')) {
    return createMCPError(
      'Requested format not available for this video',
      ErrorCodes.FORMAT_NOT_AVAILABLE,
      true,
      error
    );
  }

  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return createMCPError(
      'Network error occurred while processing video',
      ErrorCodes.NETWORK_ERROR,
      true,
      error
    );
  }

  // Default to unknown error
  return createMCPError(
    `Unexpected error: ${error.message}`,
    ErrorCodes.UNKNOWN_ERROR,
    true,
    error
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if error is not retryable
      if (error instanceof YouTubeMCPError && !error.retryable) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw createMCPError(
          `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
          ErrorCodes.UNKNOWN_ERROR,
          false,
          lastError
        );
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
}