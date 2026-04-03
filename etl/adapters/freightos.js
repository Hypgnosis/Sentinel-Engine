/**
 * SENTINEL ENGINE — Freightos API Adapter (Live Feed)
 * ═══════════════════════════════════════════════════════════
 * Pulls live freight index data from the Freightos API.
 *
 * STATUS: STUB — awaiting API key provisioning.
 * When ready, set FREIGHTOS_API_KEY in environment variables
 * and this adapter will activate automatically.
 *
 * Implements the same interface as static-feed.js:
 *   getFreightIndices() → { global, routes, airFreight }
 * ═══════════════════════════════════════════════════════════
 */

const FREIGHTOS_API_URL = 'https://api.freightos.com/v1';
const API_KEY = process.env.FREIGHTOS_API_KEY;

export const isAvailable = () => !!API_KEY;

export async function getFreightIndices() {
  if (!API_KEY) {
    throw new Error('[Freightos] API key not configured. Set FREIGHTOS_API_KEY.');
  }

  const response = await fetch(`${FREIGHTOS_API_URL}/indices/fbx`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[Freightos] API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Transform Freightos API response to Sentinel schema
  return {
    global: {
      source: 'Freightos',
      route_origin: 'Global Composite',
      route_destination: 'Global Composite',
      rate_usd: data.globalIndex?.rate || 0,
      week_over_week_change: data.globalIndex?.weekOverWeek || 0,
      trend: data.globalIndex?.trend || 'stable',
      narrative_context: `FBX Global Container Index at $${data.globalIndex?.rate}/FEU, ${data.globalIndex?.weekOverWeek > 0 ? 'up' : 'down'} ${Math.abs(data.globalIndex?.weekOverWeek)}% WoW.`,
    },
    routes: (data.routes || []).map(r => ({
      source: 'Freightos',
      route_origin: r.origin,
      route_destination: r.destination,
      rate_usd: r.rate,
      week_over_week_change: r.weekOverWeek,
      trend: r.trend,
      narrative_context: `${r.origin} → ${r.destination}: $${r.rate}/FEU, ${r.weekOverWeek > 0 ? '▲' : '▼'} ${Math.abs(r.weekOverWeek)}% WoW. Trend: ${r.trend}.`,
    })),
    airFreight: [],
  };
}
