/**
 * Middleware that invokes a global error handler when a request fails and
 * then re-throws the error. Used for surfacing toasts or triggering logout
 * on any failed request. Applied by createApiFetcher when onError is provided.
 */
import type { ApiResponse, Middleware } from 'openapi-typescript-fetch';

/**
 * Creates a middleware that calls `onError` with the rejection from any failed
 * request, after which the error is re-thrown.
 */
export function createErrorReporterMiddleware(
  onError: (error: unknown) => void,
): Middleware {
  return async (url, init, next): Promise<ApiResponse> => {
    try {
      return await next(url, init);
    } catch (error) {
      onError(error);
      throw error;
    }
  };
}