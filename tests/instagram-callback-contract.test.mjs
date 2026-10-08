import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const callback = await readFile(new URL("../src/lib/meta/instagram-callback.ts", import.meta.url), "utf8");
const deauthorize = await readFile(new URL("../src/app/api/meta/instagram/deauthorize/route.ts", import.meta.url), "utf8");
const deletion = await readFile(new URL("../src/app/api/meta/instagram/data-deletion/route.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../src/lib/meta/instagram-routes.ts", import.meta.url), "utf8");

test("Instagram callbacks verify signed requests and isolate by external account", () => {
  assert.match(callback, /createHmac\("sha256"/);
  assert.match(callback, /timingSafeEqual/);
  assert.match(callback, /instagramBusinessAccountId, connection\.accountId/);
  assert.match(callback, /updateInstagramConnectionStateFromFile/);
  assert.match(deauthorize, /disconnectInstagramConnection/);
  assert.match(deauthorize, /status: 404/);
  assert.match(deletion, /confirmation_code/);
  assert.match(deletion, /getPublicRequestUrl/);
  assert.match(routes, /INSTAGRAM_DEAUTHORIZE_CALLBACK_PATH/);
  assert.match(routes, /INSTAGRAM_DATA_DELETION_CALLBACK_PATH/);
});
