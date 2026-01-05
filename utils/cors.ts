// Allowed CORS origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://chat-warmup.vercel.app",
  "https://chatwarmup.com",
  "https://www.chatwarmup.com",
  "https://dc.chatwarmup.com",
  "https://founder.chatwarmup.com",
  "https://date.chatwarmup.com",
  "https://senior-staff.chatwarmup.com",
];

// Allowed origin patterns (for subdomains)
const allowedOriginPatterns = [/^https:\/\/[a-z0-9-]+\.chatwarmup\.com$/];

// Normalize origin by removing trailing slash
const normalizeOrigin = (origin: string | null): string | null => {
  if (!origin) return null;
  return origin.replace(/\/$/, "");
};

// Check if origin is allowed
export const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);

  // Check exact matches first
  const exactMatch = allowedOrigins.some(
    (allowed) => normalizeOrigin(allowed) === normalized
  );
  if (exactMatch) return true;

  // Check pattern matches (for subdomains like learnsales.chatwarmup.com)
  return allowedOriginPatterns.some((pattern) =>
    pattern.test(normalized ?? "")
  );
};

// Get CORS headers for allowed origin
export const getCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
};
