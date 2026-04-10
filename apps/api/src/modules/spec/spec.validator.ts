/** Spec output validator — checks that generated documents contain required sections. */

export type DocType = 'spec' | 'dataModel' | 'apiDesign';

export interface ValidationResult {
  valid: boolean;
  missingRequirements: string[];
}

/**
 * @description Validates that a spec.md document contains all required sections.
 * Required: general description >100 chars, ≥3 RF-XX requirements,
 * ≥2 RNF-XX requirements, ≥2 HU with Como/Quiero/Para, checkboxes.
 */
function validateSpec(content: string): ValidationResult {
  const missing: string[] = [];

  // Description > 100 chars total
  if (content.trim().length < 100) {
    missing.push('Descripción general (mínimo 100 caracteres)');
  }

  // At least 3 RF-XX
  const rfMatches = content.match(/RF-\d+/gi) ?? [];
  if (new Set(rfMatches).size < 3) {
    missing.push('Requerimientos Funcionales (mínimo 3 RF-XX numerados)');
  }

  // At least 2 RNF-XX
  const rnfMatches = content.match(/RNF-\d+/gi) ?? [];
  if (new Set(rnfMatches).size < 2) {
    missing.push('Requerimientos No Funcionales (mínimo 2 RNF-XX)');
  }

  // At least 2 HU with Como/Quiero/Para pattern
  // Strip markdown bold/italic markers so **Como** / **Quiero** / **Para** still match
  const strippedContent = content.replace(/\*/g, '');
  const huMatches = strippedContent.match(/Como\s.+\s+Quiero\s.+\s+Para\s.+/gi) ?? [];
  if (huMatches.length < 2) {
    missing.push('Historias de Usuario (mínimo 2 con Como/Quiero/Para)');
  }

  // At least 1 checkbox (criteria)
  if (!/- \[[ xX]\]/m.test(content)) {
    missing.push('Criterios de aceptación (checkboxes en HUs)');
  }

  return { valid: missing.length === 0, missingRequirements: missing };
}

/**
 * @description Validates that a data-model.md document contains required sections.
 * Required: ≥2 tables with columns, FK relationships, indexes.
 */
function validateDataModel(content: string): ValidationResult {
  const missing: string[] = [];

  // At least 2 distinct tables — look for markdown table rows with |
  const tableMatches = content.match(/^\|.+\|$/gm) ?? [];
  if (tableMatches.length < 4) {
    // 2 tables × min 2 rows (header + data)
    missing.push('Al menos 2 entidades documentadas con tablas markdown');
  }

  // FK relationships mentioned
  if (!/FK|foreign key|referencia/i.test(content)) {
    missing.push('Relaciones (FK) documentadas');
  }

  // Indexes mentioned
  if (!/indice|index|índice/i.test(content)) {
    missing.push('Índices definidos');
  }

  return { valid: missing.length === 0, missingRequirements: missing };
}

/**
 * @description Validates that an api-design.md contains required sections.
 * Required: ≥3 endpoints with method+path, request/response schemas, error codes.
 */
function validateApiDesign(content: string): ValidationResult {
  const missing: string[] = [];

  // At least 3 HTTP method+path combinations
  const endpointMatches =
    content.match(/\b(GET|POST|PUT|PATCH|DELETE)\s+\/[^\s]*/gi) ?? [];
  if (new Set(endpointMatches).size < 3) {
    missing.push('Al menos 3 endpoints documentados (método + path)');
  }

  // Request/response schemas present
  if (!/request|response|body|schema/i.test(content)) {
    missing.push('Request/response schemas documentados');
  }

  // Error codes
  if (!/4\d\d|5\d\d|error/i.test(content)) {
    missing.push('Códigos de error documentados');
  }

  return { valid: missing.length === 0, missingRequirements: missing };
}

/**
 * @description Validates a generated document against section requirements for its doc type.
 * Returns a ValidationResult indicating pass/fail with specific missing requirements listed.
 */
export function validateSpecOutput(
  content: string,
  docType: DocType,
): ValidationResult {
  switch (docType) {
    case 'spec':
      return validateSpec(content);
    case 'dataModel':
      return validateDataModel(content);
    case 'apiDesign':
      return validateApiDesign(content);
  }
}
