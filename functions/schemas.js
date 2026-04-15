/**
 * SENTINEL ENGINE V4.9-RC — Schema Decomposition (Zod)
 * ═══════════════════════════════════════════════════════════
 * Three composable sub-schemas that form the InferenceResponse.
 * Each can be independently validated and retried if generation
 * fails Zod validation.
 *
 * Sub-Schemas:
 *   1. GeographySchema     — Regions, corridors, geospatial data
 *   2. RiskMatrixSchema    — Threats, probabilities, mitigations
 *   3. ExecutiveActionSchema — Narrative, recommendations, metrics
 *
 * Also exports Gemini-compatible JSON Schema objects for use
 * with the `responseSchema` config in generateContent().
 * ═══════════════════════════════════════════════════════════
 */

const { z } = require('zod');

// ─────────────────────────────────────────────────────
//  SUB-SCHEMA 1: Geography
// ─────────────────────────────────────────────────────

const RegionSchema = z.object({
  name: z.string().describe('Region or port name'),
  coordinates: z.string().optional().describe('Lat/Lon if available'),
  congestionLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']).optional(),
  portStatus: z.string().optional().describe('Operational status'),
});

const CorridorSchema = z.object({
  origin: z.string().describe('Origin port or region'),
  destination: z.string().describe('Destination port or region'),
  transitDays: z.number().optional().describe('Average transit time in days'),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

const GeographySchema = z.object({
  regions: z.array(RegionSchema).max(5).default([]).describe('Affected regions/ports'),
  corridors: z.array(CorridorSchema).max(3).default([]).describe('Active trade corridors'),
});

// ─────────────────────────────────────────────────────
//  SUB-SCHEMA 2: Risk Matrix
// ─────────────────────────────────────────────────────

const RiskFactorSchema = z.object({
  name: z.string().describe('Risk factor identifier'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  probability: z.number().min(0).max(1).describe('Probability as float 0-1'),
  impactWindow: z.string().optional().describe('Time horizon for impact'),
  mitigationStrategy: z.string().optional().describe('Recommended mitigation'),
});

const RiskMatrixSchema = z.object({
  factors: z.array(RiskFactorSchema).max(5).default([]).describe('Identified risk factors'),
  overallRisk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

// ─────────────────────────────────────────────────────
//  SUB-SCHEMA 3: Executive Action
// ─────────────────────────────────────────────────────

const RecommendationSchema = z.object({
  action: z.string().describe('Recommended action'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  deadline: z.string().optional().describe('Action deadline or urgency'),
  confidence: z.number().min(0).max(1).optional(),
});

const MetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  trend: z.enum(['up', 'down', 'stable']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const ExecutiveActionSchema = z.object({
  narrative: z.string().min(1).describe('Decision summary. No markdown headers.'),
  recommendations: z.array(RecommendationSchema).max(5).default([]),
  metrics: z.array(MetricSchema).max(3).default([]),
});

// ─────────────────────────────────────────────────────
//  COMPOSITE: Full InferenceResponse
// ─────────────────────────────────────────────────────

const InferenceResponseSchema = z.object({
  geography: GeographySchema.optional().default({ regions: [], corridors: [] }),
  riskMatrix: RiskMatrixSchema.optional().default({ factors: [], overallRisk: 'MEDIUM' }),
  executiveAction: ExecutiveActionSchema,
  confidence: z.number().min(0).max(1).describe('Overall confidence 0.0-1.0'),
  sources: z.array(z.string()).max(3).describe('Data provenance'),
  dataAuthority: z.string().optional(),
});

// ─────────────────────────────────────────────────────
//  GEMINI-COMPATIBLE JSON SCHEMAS
//  Used with responseSchema in generateContent()
// ─────────────────────────────────────────────────────

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    geography: {
      type: 'OBJECT',
      description: 'Geographic context for the decision.',
      properties: {
        regions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              coordinates: { type: 'STRING' },
              congestionLevel: { type: 'STRING' },
              portStatus: { type: 'STRING' },
            },
            required: ['name'],
          },
        },
        corridors: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              origin: { type: 'STRING' },
              destination: { type: 'STRING' },
              transitDays: { type: 'NUMBER' },
              riskLevel: { type: 'STRING' },
            },
            required: ['origin', 'destination'],
          },
        },
      },
    },
    riskMatrix: {
      type: 'OBJECT',
      description: 'Risk assessment matrix.',
      properties: {
        factors: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              severity: { type: 'STRING' },
              probability: { type: 'NUMBER', minimum: 0, maximum: 1 },
              impactWindow: { type: 'STRING' },
              mitigationStrategy: { type: 'STRING' },
            },
            required: ['name', 'severity', 'probability'],
          },
        },
        overallRisk: { type: 'STRING' },
      },
    },
    executiveAction: {
      type: 'OBJECT',
      description: 'Executive decision summary.',
      properties: {
        narrative: { type: 'STRING', description: 'Decision summary in under 150 words. No markdown headers.' },
        recommendations: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING' },
              priority: { type: 'STRING' },
              deadline: { type: 'STRING' },
              confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            },
            required: ['action'],
          },
        },
        metrics: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              label: { type: 'STRING' },
              value: { type: 'STRING' },
              trend: { type: 'STRING' },
              confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['narrative'],
    },
    confidence: { type: 'NUMBER', minimum: 0, maximum: 1, description: 'Overall confidence as float 0.0-1.0.' },
    sources: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Maximum 3 data sources.' },
    dataAuthority: { type: 'STRING' },
  },
  required: ['executiveAction', 'confidence', 'sources'],
};

// ─────────────────────────────────────────────────────
//  MODULE NAME MAPPING — For recursive retry targeting
// ─────────────────────────────────────────────────────

const SUB_SCHEMA_MAP = {
  geography: GeographySchema,
  riskMatrix: RiskMatrixSchema,
  executiveAction: ExecutiveActionSchema,
};

/**
 * Validates a full inference response against all sub-schemas.
 * Returns the list of modules that failed validation.
 *
 * @param {object} data - Raw parsed JSON from Gemini
 * @returns {{ valid: boolean, result: object|null, failedModules: string[], errors: object }}
 */
function validateInferenceResponse(data) {
  const parseResult = InferenceResponseSchema.safeParse(data);
  if (parseResult.success) {
    return { valid: true, result: parseResult.data, failedModules: [], errors: {} };
  }

  // Identify which sub-modules failed
  const failedModules = [];
  const errors = {};

  for (const [moduleName, schema] of Object.entries(SUB_SCHEMA_MAP)) {
    const moduleData = data[moduleName];
    const moduleResult = schema.safeParse(moduleData);
    if (!moduleResult.success) {
      failedModules.push(moduleName);
      errors[moduleName] = moduleResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    }
  }

  // Check top-level fields
  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
    failedModules.push('confidence');
    errors.confidence = ['Must be a number between 0 and 1'];
  }
  if (!Array.isArray(data.sources)) {
    failedModules.push('sources');
    errors.sources = ['Must be an array of strings'];
  }

  return { valid: false, result: null, failedModules, errors };
}

module.exports = {
  // Zod schemas
  GeographySchema,
  RiskMatrixSchema,
  ExecutiveActionSchema,
  InferenceResponseSchema,
  MetricSchema,
  // Gemini schema
  GEMINI_RESPONSE_SCHEMA,
  // Mapping
  SUB_SCHEMA_MAP,
  // Validator
  validateInferenceResponse,
};
