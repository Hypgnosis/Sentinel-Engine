/**
 * SENTINEL ENGINE — Xeneta API Adapter (Live Feed)
 * ═══════════════════════════════════════════════════════════
 * Pulls live spot/contract rate data from the Xeneta API.
 *
 * STATUS: STUB — awaiting API key provisioning.
 * Set XENETA_API_KEY in environment variables to activate.
 *
 * Implements:
 *   getSpotContractSpreads() → Array<FreightIndex>
 * ═══════════════════════════════════════════════════════════
 */

const XENETA_API_URL = 'https://api.xeneta.com/v1';
const API_KEY = process.env.XENETA_API_KEY;

export const isAvailable = () => !!API_KEY;

export async function getSpotContractSpreads() {
  if (!API_KEY) {
    throw new Error('[Xeneta] API key not configured. Set XENETA_API_KEY.');
  }

  const response = await fetch(`${XENETA_API_URL}/rates/spot-contract`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[Xeneta] API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return (data.corridors || []).map(c => ({
    source: 'Xeneta',
    route_origin: c.origin,
    route_destination: c.destination,
    rate_usd: c.spotRate,
    week_over_week_change: 0,
    trend: c.spotRate > c.contractRate ? 'rising' : 'stable',
    narrative_context: `${c.origin} → ${c.destination}: Spot $${c.spotRate} vs Contract $${c.contractRate} (spread: $${c.spotRate - c.contractRate}). ${c.analysis || ''}`,
  }));
}
