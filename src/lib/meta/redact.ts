/** Remove credentials before recording Meta diagnostics on either client. */
export function redactMetaDiagnostics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMetaDiagnostics);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /^(authorization|authorizationCode|authorization_code|code|accessToken|access_token|client_secret|appSecret|registrationPin|pin)$/i.test(key)
        ? "[redacted]" : redactMetaDiagnostics(item),
    ]));
  }
  if (typeof value === "string") {
    return value.replace(/([?&](?:access_token|client_secret|code)=)[^&\s]+/gi, "$1[redacted]")
      .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]");
  }
  return value;
}
