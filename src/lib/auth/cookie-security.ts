/**
 * Keep auth cookies secure on HTTPS deployments while allowing the local UI
 * to authenticate over http://localhost during live-API development.
 */
export function shouldUseSecureCookies() {
  const explicit = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  return process.env.NODE_ENV === "production" && /^https:\/\//i.test(process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "");
}
