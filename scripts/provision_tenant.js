const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize with Application Default Credentials
admin.initializeApp();

async function provisionTenant() {
  const args = process.argv.slice(2);
  const companyName = args[0] || 'Rose Rocket';
  const email = args[1] || 'ops@roserocket.com';
  
  const tenantId = companyName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const tempPassword = crypto.randomBytes(8).toString('hex');

  try {
    console.log(`[1] Provisioning Operator Identity for ${companyName}...`);
    const userRecord = await admin.auth().createUser({
      email: email,
      password: tempPassword,
      displayName: `${companyName} Operator`,
    });

    console.log(`[2] Injecting Zero-Trust Tenant ID Claim: ${tenantId}...`);
    await admin.auth().setCustomUserClaims(userRecord.uid, { tenant_id: tenantId });

    console.log(`[3] Seeding Initial Logistics Data Moat...`);
    const db = admin.firestore();
    await db.collection('sentinel_data').doc(tenantId).set({
      content: "DATA MOAT INITIALIZED",
      schema: "sentinel_logistics_v4",
      provisionedAt: new Date().toISOString()
    });

    console.log('\n✅ TENANT PROVISIONED SUCCESSFULLY');
    console.log('════════════════════════════════════════');
    console.log(`Email:      ${email}`);
    console.log(`Password:   ${tempPassword}`);
    console.log(`Tenant ID:  ${tenantId}`);
    console.log(`UID:        ${userRecord.uid}`);
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    console.error('Error provisioning tenant:', error);
  }
}

provisionTenant();
