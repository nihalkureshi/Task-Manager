export function getApiUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const isLocalEnv = !fromEnv || /localhost|127\.0\.0\.1/.test(fromEnv);
    const isLanAccess = hostname !== "localhost" && hostname !== "127.0.0.1";

    // LAN/mobile access: talk to backend on the same host, not device-local localhost.
    if (isLocalEnv && isLanAccess) {
      return `${protocol}//${hostname}:5000`;
    }

    if (fromEnv) {
      return fromEnv;
    }

    return `${protocol}//${hostname}:5000`;
  }

  return fromEnv || "http://localhost:5000";
}
