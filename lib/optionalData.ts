const DEFAULT_OPTIONAL_SOURCE_TIMEOUT_MS = 2_500;

/**
 * Prevent optional homepage panels from holding up the full page when a
 * cache or external source is slow. The source may finish independently,
 * but the homepage uses its fallback after the timeout.
 */
export async function withOptionalFallback<T, F>(
  label: string,
  source: Promise<T>,
  fallback: () => F,
  timeoutMs = DEFAULT_OPTIONAL_SOURCE_TIMEOUT_MS
): Promise<T | F> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return await Promise.race([source, timeout]);
  } catch (error) {
    console.error(
      `Optional source failed or timed out (${label}); using fallback.`,
      error
    );
    return fallback();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
