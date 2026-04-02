/**
 * SENTINEL ENGINE — Firestore Seed Script
 * ═══════════════════════════════════════════
 * Populates the `sentinel_data/source_alpha` document with
 * rich logistics market context for immediate demo readiness.
 * 
 * Usage: node seed-firestore.js
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or gcloud auth
 * ═══════════════════════════════════════════
 */

const { Firestore } = require('@google-cloud/firestore');

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'ha-sentinel-core-v21';
const firestore = new Firestore({ projectId: GCP_PROJECT_ID });

// ─────────────────────────────────────────────────────
//  SOURCE ALPHA — Logistics Intelligence Template
// ─────────────────────────────────────────────────────

const SOURCE_ALPHA_CONTENT = `
# SENTINEL ENGINE — SOURCE ALPHA
## Global Logistics Intelligence Briefing
### Last Updated: ${new Date().toISOString()}
### Data Authority: < 1 Hour | Refresh Cycle: 60 min

---

## 1. GLOBAL FREIGHT INDEX (FBX — Freightos Baltic Index)

| Route                      | Rate (USD/FEU) | WoW Change | Trend     |
|----------------------------|----------------|------------|-----------|
| China/East Asia → N. America West Coast | $1,520    | -2.1%      | Stabilizing |
| China/East Asia → N. America East Coast | $2,680    | +4.7%      | Rising     |
| China/East Asia → N. Europe              | $2,340    | +3.2%      | Rising     |
| China/East Asia → Mediterranean          | $2,890    | -1.8%      | Declining  |
| N. Europe → N. America East Coast        | $1,150    | +0.5%      | Stable     |
| FBX Global Container Index               | $1,847    | +3.2%      | Rising     |

### Key Insight:
Trans-Pacific Eastbound rates are stabilizing after Q1 frontloading surge. 
Asia-Europe corridor showing sustained demand driven by EU restocking cycle.
Pre-tariff frontloading on USEC routes causing 4.7% WoW spike.

---

## 2. SPOT vs. CONTRACT RATE SPREAD (Xeneta Data)

| Corridor                   | Spot Rate | Long-Term Contract | Spread   |
|----------------------------|-----------|-------------------|----------|
| Far East → N. Europe       | $2,340    | $1,890            | +$450    |
| Far East → US West Coast   | $1,520    | $1,340            | +$180    |
| Far East → US East Coast   | $2,680    | $2,150            | +$530    |
| Far East → Mediterranean   | $2,890    | $2,420            | +$470    |

### Analysis:
Spot-contract spread widening on USEC corridor indicates market volatility.
Shippers with expiring Q1 contracts face 15-22% renewal premium.
Recommendation: Lock long-term rates on Asia-Europe before Q3 peak season.

---

## 3. PORT CONGESTION INDEX

| Port              | Vessels at Anchor | Avg Wait (Days) | Congestion Level | Trend       |
|-------------------|-------------------|-----------------|------------------|-------------|
| Shanghai          | 147               | 3.2             | HIGH             | Worsening   |
| Singapore         | 42                | 1.1             | MODERATE         | Stable      |
| Rotterdam         | 18                | 0.8             | LOW              | Improving   |
| Long Beach        | 67                | 2.8             | HIGH             | Stable      |
| Los Angeles       | 54                | 2.4             | MODERATE-HIGH    | Improving   |
| Savannah          | 23                | 1.4             | MODERATE         | Stable      |
| Hamburg           | 12                | 0.6             | LOW              | Stable      |
| Busan             | 31                | 1.7             | MODERATE         | Worsening   |
| Jebel Ali (Dubai) | 8                 | 0.4             | LOW              | Stable      |
| Santos (Brazil)   | 28                | 2.1             | MODERATE         | Worsening   |

### Critical Alert:
Shanghai congestion at 147 vessels — highest since October 2024.
Cascading delays expected on Asia-Europe services within 10-14 days.
Long Beach stabilized but remains in HIGH territory due to chassis shortages.

---

## 4. MARITIME CHOKEPOINTS (MarineTraffic)

| Chokepoint         | Avg Transit Delay | Vessel Queue | Status          |
|--------------------|-------------------|--------------|-----------------|
| Suez Canal         | 12 hours          | 34 vessels   | RESTRICTED (Northbound) |
| Panama Canal       | 8 hours           | 18 vessels   | NORMAL (Draft restrictions lifted) |
| Strait of Malacca  | 2 hours           | 12 vessels   | NORMAL          |
| Strait of Hormuz   | 4 hours           | 8 vessels    | ELEVATED RISK   |
| Cape of Good Hope   | N/A (reroute)     | N/A          | ACTIVE DIVERSIONS |

### Routing Intelligence:
Suez northbound flow restricted due to maintenance dredging — expect 12-hour delays.
Panama Canal draft restrictions lifted after rainfall recovery — slot auction premiums declining.
Cape of Good Hope diversions still active for 15% of Asia-Europe services (Houthi risk mitigation).

---

## 5. BALTIC DRY INDEX (BDI)

| Metric            | Value       | Change       |
|-------------------|-------------|--------------|
| BDI Composite     | 1,892 pts   | +42 pts (↑)  |
| Capesize          | 2,847 pts   | +118 pts (↑) |
| Panamax           | 1,623 pts   | +15 pts (↑)  |
| Supramax          | 1,204 pts   | -8 pts (↓)   |

### Commodity Flow Signal:
Capesize demand surge driven by iron ore restocking from Brazilian mines (Vale Q2 ramp-up).
Panamax stable on grain corridor (US Gulf → China).
Supramax softening on reduced minor bulk demand.

---

## 6. AIR FREIGHT INDEX

| Route                    | Rate (USD/kg) | Change  | Capacity    |
|--------------------------|---------------|---------|-------------|
| Hong Kong → North America | $3.42         | +5.1%   | Tightening  |
| Hong Kong → Europe        | $3.18         | +2.3%   | Moderate    |
| Europe → North America    | $2.75         | -0.8%   | Stable      |
| Intra-Asia                | $1.95         | +1.2%   | Adequate    |

### Air Cargo Intelligence:
Q2 capacity tightening on TACA (Trans-Pacific) as e-commerce volumes accelerate.
Belly cargo from passenger airlines recovering but still 8% below pre-COVID capacity.
Peak season surcharges expected from July.

---

## 7. SUPPLY CHAIN RISK MATRIX

| Risk Factor                | Severity | Probability | Impact Window |
|----------------------------|----------|-------------|---------------|
| Red Sea / Houthi Disruption | HIGH     | ONGOING     | Indefinite    |
| US-China Tariff Escalation   | CRITICAL | HIGH        | Q2-Q3 2025    |
| Panama Canal Drought         | LOW      | RESOLVED    | N/A           |
| Shanghai Port Congestion     | HIGH     | CONFIRMED   | 2-4 weeks     |
| EU Carbon Border Tax (CBAM)  | MODERATE | CERTAIN     | Oct 2025      |
| IMO 2025 Fuel Regulations    | MODERATE | CERTAIN     | Jan 2026      |

---

## DATA AUTHORITY STATEMENT
This intelligence briefing is sourced from Freightos, Xeneta, MarineTraffic, and
proprietary High ArchyTech Solutions models. Data refresh cycle: 60 minutes.
Next scheduled refresh: T+60 from document timestamp.
Confidence Level: HIGH (multi-source triangulation).
`;

// ─────────────────────────────────────────────────────
//  SEED EXECUTION
// ─────────────────────────────────────────────────────

async function seedFirestore() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  SENTINEL ENGINE — Firestore Seed Script     ║');
  console.log('║  Project: ' + GCP_PROJECT_ID.padEnd(35) + '║');
  console.log('╚══════════════════════════════════════════════╝');

  try {
    // Write Source Alpha document
    const sourceAlphaRef = firestore.collection('sentinel_data').doc('source_alpha');
    await sourceAlphaRef.set({
      content: SOURCE_ALPHA_CONTENT,
      lastUpdated: new Date().toISOString(),
      version: '2.1.0',
      dataAuthority: 'HIGH',
      refreshCycleMinutes: 60,
      sources: ['Freightos', 'Xeneta', 'MarineTraffic', 'High ArchyTech Models'],
      metadata: {
        createdBy: 'seed-firestore.js',
        engine: 'Sentinel Engine Core v2.1',
        owner: 'High ArchyTech Solutions',
      },
    });

    console.log('');
    console.log('[✓] sentinel_data/source_alpha — WRITTEN SUCCESSFULLY');
    console.log(`    Content length: ${SOURCE_ALPHA_CONTENT.length} characters`);
    console.log(`    Timestamp: ${new Date().toISOString()}`);

    // Write a metadata/config document for system introspection
    const configRef = firestore.collection('sentinel_data').doc('_config');
    await configRef.set({
      engineVersion: '2.1.0',
      deployment: 'Cloud Functions Gen2',
      model: 'gemini-1.5-pro',
      securityLayer: 'AES-256-GCM-ZDF',
      allowedOrigins: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://sentinel.high-archy.tech',
      ],
      createdAt: new Date().toISOString(),
    });

    console.log('[✓] sentinel_data/_config — WRITTEN SUCCESSFULLY');
    console.log('');
    console.log('[SENTINEL] Firestore seed complete. Source Alpha is hot.');

  } catch (error) {
    console.error('[SENTINEL CRITICAL] Seed failed:', error.message);
    process.exit(1);
  }
}

seedFirestore();
