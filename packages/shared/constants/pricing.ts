export const ANTHROPIC_PRICING = {
  model: "claude-sonnet-4-20250514",
  inputPerMTok: 3.0,
  outputPerMTok: 15.0,
  lastUpdated: "2026-04-01",
} as const;

export type AnthropicPricing = typeof ANTHROPIC_PRICING;
