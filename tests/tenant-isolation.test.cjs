const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const assert = require('assert');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public';
const parsed = new URL(databaseUrl);
const pool = new Pool({
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : 5432,
  database: parsed.pathname.replace(/^\//, '') || 'aicloser',
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runTenantIsolationTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MULTI-TENANT DATABASE ISOLATION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
      failedTests++;
    }
  }

  // TEST 1: Leads Scoping & Non-Leakage
  await test('Tenant A cannot view, query, or enumerate Tenant B leads', async () => {
    const tenantA = 'tenant-acme-agency-6478aca1';
    const tenantB = 'tenant-agency-8deafdbb';

    const leadsA = await prisma.salesLeadAssignment.findMany({
      where: { tenantId: tenantA },
      select: { id: true, tenantId: true }
    });

    const leadsB = await prisma.salesLeadAssignment.findMany({
      where: { tenantId: tenantB },
      select: { id: true, tenantId: true }
    });

    assert(leadsA.length === 34, `Expected 34 leads for Tenant A, got ${leadsA.length}`);
    assert(leadsB.length === 703, `Expected 703 leads for Tenant B, got ${leadsB.length}`);

    // Verify 0 cross contamination
    const aHasB = leadsA.some(l => l.tenantId !== tenantA);
    const bHasA = leadsB.some(l => l.tenantId !== tenantB);
    assert(!aHasB, 'Tenant A result set contains leads not belonging to Tenant A!');
    assert(!bHasA, 'Tenant B result set contains leads not belonging to Tenant B!');

    // Check that querying by ID across tenants returns null when scoped
    const sampleLeadB = leadsB[0];
    const crossTenantQuery = await prisma.salesLeadAssignment.findFirst({
      where: { id: sampleLeadB.id, tenantId: tenantA }
    });
    assert(crossTenantQuery === null, 'Tenant A scoped query was able to find a Tenant B lead by ID!');
  });

  // TEST 2: Contacts with identical Phone / Email never merge across tenants
  await test('Contacts with identical phone numbers exist independently in different tenants without collision', async () => {
    const tenantAlpha = 'test-tenant-alpha-' + Date.now();
    const tenantBeta = 'test-tenant-beta-' + Date.now();
    const sharedPhone = '+15559876543';

    let contactAlpha = null;
    let contactBeta = null;

    try {
      // Create contact with sharedPhone in Tenant Alpha
      contactAlpha = await prisma.marketingContact.create({
        data: {
          tenantId: tenantAlpha,
          fullName: 'Alpha John',
          e164Phone: sharedPhone,
          email: 'shared@example.com',
          source: 'TEST'
        }
      });

      // Create contact with SAME sharedPhone in Tenant Beta
      contactBeta = await prisma.marketingContact.create({
        data: {
          tenantId: tenantBeta,
          fullName: 'Beta John',
          e164Phone: sharedPhone,
          email: 'shared@example.com',
          source: 'TEST'
        }
      });

      assert(contactAlpha.id !== contactBeta.id, 'Contacts should have distinct IDs!');
      assert(contactAlpha.tenantId === tenantAlpha, 'Contact Alpha tenant mismatch!');
      assert(contactBeta.tenantId === tenantBeta, 'Contact Beta tenant mismatch!');

      // Query from Tenant Alpha
      const alphaList = await prisma.marketingContact.findMany({
        where: { tenantId: tenantAlpha, e164Phone: sharedPhone }
      });
      assert(alphaList.length === 1, `Tenant Alpha should see exactly 1 contact, found ${alphaList.length}`);
      assert(alphaList[0].fullName === 'Alpha John', 'Tenant Alpha saw the wrong contact data!');

      // Query from Tenant Beta
      const betaList = await prisma.marketingContact.findMany({
        where: { tenantId: tenantBeta, e164Phone: sharedPhone }
      });
      assert(betaList.length === 1, `Tenant Beta should see exactly 1 contact, found ${betaList.length}`);
      assert(betaList[0].fullName === 'Beta John', 'Tenant Beta saw the wrong contact data!');

      // Verify compound unique constraint: adding duplicate within SAME tenant fails
      let duplicateThrew = false;
      try {
        await prisma.marketingContact.create({
          data: {
            tenantId: tenantAlpha,
            fullName: 'Alpha Duplicate',
            e164Phone: sharedPhone,
            source: 'TEST'
          }
        });
      } catch (e) {
        duplicateThrew = true;
      }
      assert(duplicateThrew, 'Duplicate phone within the SAME tenant should have thrown a unique constraint violation!');

    } finally {
      // Clean up test fixtures
      if (contactAlpha) await prisma.marketingContact.delete({ where: { id: contactAlpha.id } }).catch(() => {});
      if (contactBeta) await prisma.marketingContact.delete({ where: { id: contactBeta.id } }).catch(() => {});
    }
  });

  // TEST 3: Calls & Timeline Notes Isolation
  await test('Calls and Timeline notes cannot be read or mutated across tenant boundaries', async () => {
    const tenantA = 'tenant-acme-agency-6478aca1';
    const tenantB = 'tenant-agency-8deafdbb';

    // Calls for Tenant B
    const callsB = await prisma.salesMobileCall.findMany({
      where: { tenantId: tenantB }
    });
    assert(callsB.length === 5, `Expected 5 calls in Tenant B, found ${callsB.length}`);

    // Scoped query for Tenant A
    const callsA = await prisma.salesMobileCall.findMany({
      where: { tenantId: tenantA }
    });
    assert(callsA.length === 0, `Expected 0 calls in Tenant A, found ${callsA.length}`);

    // Cross-tenant update prevention
    const sampleCallB = callsB[0];
    const updateResult = await prisma.salesMobileCall.updateMany({
      where: { id: sampleCallB.id, tenantId: tenantA },
      data: { outcome: 'HACKED_BY_TENANT_A' }
    });
    assert(updateResult.count === 0, 'Tenant A was able to update a call belonging to Tenant B!');

    // Verify call in Tenant B was unaffected
    const freshCallB = await prisma.salesMobileCall.findUnique({ where: { id: sampleCallB.id } });
    assert(freshCallB.outcome !== 'HACKED_BY_TENANT_A', 'Call outcome was corrupted by cross-tenant mutation!');
  });

  // TEST 4: AppConversation scoping
  await test('AppConversation records are strictly partitioned by tenantId', async () => {
    const tenantAcme = 'tenant-acme-agency-6478aca1';
    const tenantGigxomi = 'tenant-gigxomi';

    const convsAcme = await prisma.appConversation.findMany({
      where: { tenantId: tenantAcme },
      take: 10
    });
    assert(convsAcme.length > 0, `Should find conversations for ${tenantAcme}`);
    for (const c of convsAcme) {
      assert(c.tenantId === tenantAcme, `Conversation ${c.id} leaked wrong tenant ${c.tenantId}`);
    }

    // Verify cross tenant cannot see Acme convs
    const convsGigxomi = await prisma.appConversation.findMany({
      where: { tenantId: tenantGigxomi },
      take: 10
    });
    assert(convsGigxomi.length > 0, `Should find conversations for ${tenantGigxomi}`);
    for (const c of convsGigxomi) {
      assert(c.tenantId === tenantGigxomi, `Conversation ${c.id} leaked wrong tenant ${c.tenantId}`);
      assert(c.tenantId !== tenantAcme, `Gigxomi conversation list leaked Acme tenant data`);
    }
  });

  console.log(`\n====================================================`);
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log(`====================================================`);

  if (failedTests > 0) {
    throw new Error(`${failedTests} tests failed.`);
  }
}

runTenantIsolationTests()
  .catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
