export async function withOptionalFallback<T>(
  label: string,
  source: Promise<T>,
  fallback: () => T
): Promise<T> {
  try {
    return await source;
  } catch (error) {
    console.error(`Optional source failed (${label}); using fallback.`, error);
    return fallback();
  }
}
