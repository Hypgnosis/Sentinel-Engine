/**
 * SENTINEL ENGINE — MarineTraffic API Adapter (Live Feed)
 * ═══════════════════════════════════════════════════════════
 * Pulls live port congestion and chokepoint data from
 * the MarineTraffic API.
 *
 * STATUS: STUB — awaiting API key provisioning.
 * Set MARINETRAFFIC_API_KEY in environment variables to activate.
 *
 * Implements:
 *   getPortCongestion() → Array<PortCongestion>
 *   getChokepoints()    → Array<Chokepoint>
 * ═══════════════════════════════════════════════════════════
 */

const MT_API_URL = 'https://services.marinetraffic.com/api';
const API_KEY = process.env.MARINETRAFFIC_API_KEY;

export const isAvailable = () => !!API_KEY;

export async function getPortCongestion() {
  if (!API_KEY) {
    throw new Error('[MarineTraffic] API key not configured. Set MARINETRAFFIC_API_KEY.');
  }

  const response = await fetch(
    `${MT_API_URL}/portcongestion/${API_KEY}/protocol:jsono`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`[MarineTraffic] API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return (data || []).map(p => ({
    source: 'MarineTraffic',
    port_name: p.portName || p.PORT_NAME,
    vessels_at_anchor: parseInt(p.vesselsAtAnchor || p.VESSELS_AT_ANCHOR, 10) || 0,
    avg_wait_days: parseFloat(p.avgWaitDays || p.AVG_WAIT_DAYS) || 0,
    severity_level: classifySeverity(parseInt(p.vesselsAtAnchor || p.VESSELS_AT_ANCHOR, 10)),
    narrative_context: `${p.portName}: ${p.vesselsAtAnchor} vessels at anchor, ${p.avgWaitDays}-day average wait.`,
  }));
}

export async function getChokepoints() {
  if (!API_KEY) {
    throw new Error('[MarineTraffic] API key not configured. Set MARINETRAFFIC_API_KEY.');
  }

  // MarineTraffic doesn't have a direct chokepoint API — this would
  // be assembled from vessel density and AIS transit data
  const response = await fetch(
    `${MT_API_URL}/chokepoints/${API_KEY}/protocol:jsono`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`[MarineTraffic] Chokepoint API error: ${response.status}`);
  }

  const data = await response.json();

  return (data || []).map(c => ({
    source: 'MarineTraffic',
    chokepoint_name: c.name,
    status: c.status || 'NORMAL',
    vessel_queue: parseInt(c.vesselQueue, 10) || null,
    transit_delay_hours: parseFloat(c.transitDelayHours) || null,
    narrative_context: `${c.name}: Status ${c.status}. ${c.detail || ''}`,
  }));
}

function classifySeverity(vesselCount) {
  if (vesselCount >= 100) return 'HIGH';
  if (vesselCount >= 40)  return 'MODERATE';
  return 'LOW';
}
