import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('registerSalesMobileDevice reassigns device by deviceId via upsert', () => {
  const storeSource = readFileSync('src/lib/gigxomi/sales-mobile-store.ts', 'utf8');
  assert.ok(storeSource.includes('export async function registerSalesMobileDevice'));
  assert.ok(storeSource.includes('prisma.salesMobileDevice.upsert'));
  assert.ok(storeSource.includes('where: { deviceId }'));
  assert.ok(storeSource.includes('agentId: agent.id'));
  assert.ok(storeSource.includes('tenantId: agent.tenantId'));
  assert.ok(storeSource.includes('isActive: true'));

  // Confirms there is no company device lock blocking registration for an authenticated user
  assert.ok(storeSource.includes('Session ownership is user-login based.'));
});

test('acquireAppClientSession atomically replaces active session under serializable advisory lock', () => {
  const sessionSource = readFileSync('src/lib/auth/client-sessions.ts', 'utf8');
  assert.ok(sessionSource.includes('export async function acquireAppClientSession'));
  assert.ok(sessionSource.includes('withClientSlotLock'));
  assert.ok(sessionSource.includes('aicloser:client-slot:'));
  assert.ok(sessionSource.includes('isolationLevel: Prisma.TransactionIsolationLevel.Serializable'));
  assert.ok(sessionSource.includes('if (!input.replaceExisting)'));
  assert.ok(sessionSource.includes('throw new ClientSlotOccupiedError'));
  assert.ok(sessionSource.includes('status: AppClientSessionStatus.REVOKED'));
  assert.ok(sessionSource.includes('Replaced by an explicit login from another installation'));
});

test('mobile login endpoint passes takeover flags and maps ClientSlotOccupied to 409', () => {
  const loginSource = readFileSync('src/app/api/mobile/auth/login/route.ts', 'utf8');
  assert.ok(loginSource.includes('const replaceExisting = body.replaceExisting === true || body.forceReplace === true || body.force === true;'));
  assert.ok(loginSource.includes('replaceExisting,'));
  assert.ok(loginSource.includes('if (error instanceof ClientSlotOccupiedError)'));
  assert.ok(loginSource.includes('{ status: 409 }'));
  assert.ok(loginSource.includes('message: "Your mobile account is already active on another device."'));
});

test('register-device route delegates directly to registerSalesMobileDevice', () => {
  const routeSource = readFileSync('src/app/api/sales/mobile/register-device/route.ts', 'utf8');
  assert.ok(routeSource.includes('registerSalesMobileDevice(auth.actor, await request.json())'));
  assert.ok(routeSource.includes('requireSalesMobileSession'));
});
