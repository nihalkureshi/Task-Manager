export function getApiUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");

  // Explicit override (e.g. separate Flask server during local dev)
  if (fromEnv) {
    return fromEnv;
  }

  // Default: same-origin Next.js API routes (Vercel + local `npm run dev`)
  return "/api";
}
