/**
 * Middleware to transform API request body keys from camelCase to snake_case,
 * and to re-serialize nested query objects (carried via the sentinel header)
 * as bracket-style query string params, so Express's extended qs parser can
 * reconstruct them server-side. Otherwise openapi-typescript-fetch stringifies
 * nested objects into the literal `[object Object]`.
 */
import type { ApiResponse, Middleware } from 'openapi-typescript-fetch';

/**
 * Sentinel header that carries a URL-encoded JSON map of nested query values.
 * Set by `withNestedQuery` in fetch-utils and read/consumed here.
 */
export const NESTED_QUERY_HEADER = 'x-nested-query';

function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function transformKeysToSnakeCase<T = unknown>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => transformKeysToSnakeCase(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      out[camelToSnakeCase(key)] = transformKeysToSnakeCase(obj[key]);
    }
    return out as unknown as T;
  }
  return value;
}

function appendNestedQuery(url: string, nested: Record<string, unknown>): string {
  const params: string[] = [];
  const collect = (value: unknown, key: string) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        collect(subValue, `${key}[${subKey}]`);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item) => collect(item, `${key}[]`));
    } else {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  };
  for (const [key, value] of Object.entries(nested)) {
    collect(value, key);
  }
  if (params.length === 0) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.join('&')}`;
}

/**
 * Creates a middleware that transforms request body keys to snake_case and
 * expands the nested query header into bracket-style query params.
 */
export function createSnakeCaseRequestMiddleware(): Middleware {
  return async (url, init, next): Promise<ApiResponse> => {
    const headers = new Headers(init.headers);

    let resolvedUrl = url;
    const nestedQueryHeader = headers.get(NESTED_QUERY_HEADER);
    if (nestedQueryHeader) {
      headers.delete(NESTED_QUERY_HEADER);
      try {
        const nested = JSON.parse(decodeURIComponent(nestedQueryHeader)) as Record<
          string,
          unknown
        >;
        resolvedUrl = appendNestedQuery(url, nested);
      } catch {
        // If the header is malformed, ignore it and continue with the original URL.
      }
    }

    let body = init.body;
    const contentType = headers.get('content-type');
    if (
      body &&
      typeof body === 'string' &&
      contentType &&
      contentType.includes('application/json')
    ) {
      try {
        body = JSON.stringify(transformKeysToSnakeCase(JSON.parse(body)));
      } catch {
        // Leave the body untouched if it can't be parsed as JSON.
      }
    }

    return next(resolvedUrl, {
      ...init,
      headers,
      url: resolvedUrl,
      ...(body !== init.body ? { body } : {}),
    });
  };
}