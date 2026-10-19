const HEADER = {
  alg: "HS256",
  typ: "JWT",
};

const encoder = new TextEncoder();

function getTokenSecret() {
  return process.env.SESSION_SECRET?.trim() || "e88656903145ee2ad75187d3bbf95733183e298552269a01bbf81616b69f1bde";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(encoder.encode(value));
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getTokenSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(value: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(session: {
  userId: string;
  email?: string;
  phone?: string;
  displayName?: string;
  role: string;
  tenantId: string;
  [key: string]: unknown;
}) {
  const header = stringToBase64Url(JSON.stringify(HEADER));
  const payload = stringToBase64Url(
    JSON.stringify({
      ...session,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const signature = await sign(unsignedToken);
  return `${unsignedToken}.${signature}`;
}
