// @ts-nocheck
/*
  Validation runtime sans dépendance externe pour les transitions narratives v1.
  Usage:
    npm run validate:transitions-runtime
    npm run validate:transitions-runtime -- <schemaPath> <dataPath>
*/

const fs = require('node:fs');
const path = require('node:path');

function resolveFromCandidates(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const DEFAULT_SCHEMA_PATH = resolveFromCandidates([
  path.resolve(__dirname, '..', '..', 'runtime', 'Transitions-v1-runtime.schema.json'),
  path.resolve(__dirname, '..', 'runtime', 'Transitions-v1-runtime.schema.json'),
  path.resolve(__dirname, '..', '..', 'docs', 'Evolution', 'Transitions-v1-runtime.schema.json'),
  path.resolve(__dirname, '..', 'docs', 'Evolution', 'Transitions-v1-runtime.schema.json')
]);
const DEFAULT_DATA_PATH = resolveFromCandidates([
  path.resolve(__dirname, '..', '..', 'runtime', 'Transitions-v1-runtime.example.json'),
  path.resolve(__dirname, '..', 'runtime', 'Transitions-v1-runtime.example.json'),
  path.resolve(__dirname, '..', '..', 'docs', 'Evolution', 'Transitions-v1-runtime.example.json'),
  path.resolve(__dirname, '..', 'docs', 'Evolution', 'Transitions-v1-runtime.example.json')
]);

const ENTITY_TYPES = new Set(['quest', 'trama', 'companion', 'trade']);
const IMPACT_SCOPES = new Set(['local', 'regional', 'global', 'none']);
const LORE_ANCHOR_TYPES = new Set(['lieu', 'faction', 'histoire', 'acteur']);
const TIME_UNITS = new Set(['hour', 'day', 'special']);
const TRANSITION_ID_REGEX = /^[a-z0-9][a-z0-9._:-]{2,}$/;

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Impossible de lire/parsers JSON: ${filePath}\n${String(error.message || error)}`);
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushError(errors, pathRef, message) {
  errors.push(`${pathRef}: ${message}`);
}

function validateTransition(transition, index, errors) {
  const p = `transitions[${index}]`;

  if (typeof transition !== 'object' || transition === null || Array.isArray(transition)) {
    pushError(errors, p, 'doit être un objet');
    return;
  }

  const requiredFields = [
    'id',
    'entityType',
    'fromState',
    'trigger',
    'toState',
    'consequence',
    'ruleRef',
    'loreAnchors',
    'timeBlock'
  ];

  for (const field of requiredFields) {
    if (!(field in transition)) {
      pushError(errors, `${p}.${field}`, 'champ obligatoire manquant');
    }
  }

  if (isNonEmptyString(transition.id) && !TRANSITION_ID_REGEX.test(transition.id)) {
    pushError(errors, `${p}.id`, 'format invalide (regex ^[a-z0-9][a-z0-9._:-]{2,}$)');
  }

  if (!ENTITY_TYPES.has(transition.entityType)) {
    pushError(errors, `${p}.entityType`, `valeur invalide (${String(transition.entityType)})`);
  }

  const stringFields = ['fromState', 'trigger', 'toState', 'consequence', 'ruleRef'];
  for (const field of stringFields) {
    if (!isNonEmptyString(transition[field])) {
      pushError(errors, `${p}.${field}`, 'doit être une chaîne non vide');
    }
  }

  if (transition.impactScope != null && !IMPACT_SCOPES.has(transition.impactScope)) {
    pushError(errors, `${p}.impactScope`, `valeur invalide (${String(transition.impactScope)})`);
  }

  if (!Array.isArray(transition.loreAnchors)) {
    pushError(errors, `${p}.loreAnchors`, 'doit être un tableau');
  } else {
    if (transition.loreAnchors.length < 2) {
      pushError(errors, `${p}.loreAnchors`, 'doit contenir au moins 2 ancres lore');
    }

    transition.loreAnchors.forEach((anchor, anchorIndex) => {
      const ap = `${p}.loreAnchors[${anchorIndex}]`;
      if (typeof anchor !== 'object' || anchor === null || Array.isArray(anchor)) {
        pushError(errors, ap, 'doit être un objet');
        return;
      }
      if (!LORE_ANCHOR_TYPES.has(anchor.type)) {
        pushError(errors, `${ap}.type`, `valeur invalide (${String(anchor.type)})`);
      }
      if (!isNonEmptyString(anchor.id)) {
        pushError(errors, `${ap}.id`, 'doit être une chaîne non vide');
      }
      if (anchor.label != null && typeof anchor.label !== 'string') {
        pushError(errors, `${ap}.label`, 'doit être une chaîne si présent');
      }
    });
  }

  const tb = transition.timeBlock;
  if (typeof tb !== 'object' || tb === null || Array.isArray(tb)) {
    pushError(errors, `${p}.timeBlock`, 'doit être un objet');
  } else {
    if (!TIME_UNITS.has(tb.unit)) {
      pushError(errors, `${p}.timeBlock.unit`, `valeur invalide (${String(tb.unit)})`);
    }
    if (!Number.isInteger(tb.value) || tb.value < 0) {
      pushError(errors, `${p}.timeBlock.value`, 'doit être un entier >= 0');
    }
  }

  if (transition.playerFacingReason != null && typeof transition.playerFacingReason !== 'string') {
    pushError(errors, `${p}.playerFacingReason`, 'doit être une chaîne si présent');
  }

  if (transition.notes != null && typeof transition.notes !== 'string') {
    pushError(errors, `${p}.notes`, 'doit être une chaîne si présent');
  }
}

function validateRuntimePayload(payload) {
  const errors = [];

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return ['root: doit être un objet'];
  }

  if (payload.version !== '1.0.0') {
    pushError(errors, 'version', `doit valoir "1.0.0" (actuel: ${String(payload.version)})`);
  }

  if (!isNonEmptyString(payload.generatedAt) || Number.isNaN(Date.parse(payload.generatedAt))) {
    pushError(errors, 'generatedAt', 'doit être une date ISO valide');
  }

  if (!Array.isArray(payload.transitions)) {
    pushError(errors, 'transitions', 'doit être un tableau');
    return errors;
  }

  if (payload.transitions.length < 1) {
    pushError(errors, 'transitions', 'doit contenir au moins 1 transition');
  }

  const ids = new Set();
  payload.transitions.forEach((transition, index) => {
    validateTransition(transition, index, errors);
    if (transition && typeof transition.id === 'string') {
      if (ids.has(transition.id)) {
        pushError(errors, `transitions[${index}].id`, `id dupliqué (${transition.id})`);
      }
      ids.add(transition.id);
    }
  });

  return errors;
}

function main() {
  const schemaPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SCHEMA_PATH;
  const dataPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_DATA_PATH;

  if (!fs.existsSync(schemaPath)) {
    console.error(`[ERREUR] Schéma introuvable: ${schemaPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(dataPath)) {
    console.error(`[ERREUR] Données introuvables: ${dataPath}`);
    process.exit(1);
  }

  const schema = readJson(schemaPath);
  const payload = readJson(dataPath);

  console.log(`[INFO] Schéma chargé: ${schema.title || schemaPath}`);
  console.log(`[INFO] Données chargées: ${dataPath}`);

  const errors = validateRuntimePayload(payload);

  if (errors.length > 0) {
    console.error(`\n[INVALID] ${errors.length} erreur(s) détectée(s):`);
    errors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  }

  console.log(`\n[OK] Validation réussie (${payload.transitions.length} transition(s)).`);
}

main();
