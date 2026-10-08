import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/meta/redact.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { redactMetaDiagnostics } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

test("Meta diagnostics redact nested credentials and URL parameters", () => {
  const input = { accountId: "123", accessToken: "secret", response: [{ code: "one-time", headers: { Authorization: "Bearer token" } }], url: "https://example.com/?code=private&client_secret=secret&state=public" };
  const output = redactMetaDiagnostics(input);
  assert.equal(output.accountId, "123");
  assert.equal(output.accessToken, "[redacted]");
  assert.equal(output.response[0].code, "[redacted]");
  assert.equal(output.response[0].headers.Authorization, "[redacted]");
  assert.equal(output.url, "https://example.com/?code=[redacted]&client_secret=[redacted]&state=public");
  assert.equal(input.accessToken, "secret");
});
