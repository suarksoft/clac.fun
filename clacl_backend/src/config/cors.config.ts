const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

export function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
