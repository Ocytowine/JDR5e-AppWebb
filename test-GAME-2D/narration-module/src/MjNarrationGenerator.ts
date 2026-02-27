import type {
  AINarrationCandidate,
  AINarrationContractV1,
  AINarrationGeneratorInput,
  AINarrationGeneratorOutput,
  MjNarrationGenerator
} from './types';

declare const process: any;
declare function fetch(input: string, init?: Record<string, unknown>): Promise<any>;

function clampIndex(value: number, maxExclusive: number): number | null {
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value >= maxExclusive) return null;
  return value;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function buildDefaultContract(
  input: AINarrationGeneratorInput,
  selectedIndex: number | null,
  reason: string
): AINarrationContractV1 {
  const selected: AINarrationCandidate | null =
    selectedIndex == null || !input.candidates[selectedIndex] ? null : input.candidates[selectedIndex];

  const scene = selected
    ? `La situation evolue autour de ${selected.command.entityId} (${selected.command.entityType}).`
    : 'Aucune progression narrative retenue pour ce tour.';
  const actionResult = selected ? selected.consequence : 'Aucune transition appliquee.';
  const consequences = selected
    ? `Transition candidate: ${selected.transitionId} (${selected.fromState} -> ${selected.toState}).`
    : 'La scene reste stable.';

  return {
    schemaVersion: '1.0.0',
    intentType: 'story_action',
    commitment: selected ? 'declaratif' : 'informatif',
    target: selected
      ? {
          label: selected.command.entityId,
          entityType: selected.command.entityType,
          entityId: selected.command.entityId,
          trigger: selected.command.trigger
        }
      : {},
    socialFocus: {
      active: false
    },
    worldIntent: selected
      ? {
          type: 'runtime_progress',
          reason,
          targetLabel: selected.command.entityId,
          transitionId: selected.transitionId
        }
      : {
          type: 'none',
          reason
        },
    toolCalls: [],
    mjResponse: {
      scene,
      actionResult,
      consequences,
      options: []
    }
  };
}

function sanitizeContract(
  candidate: unknown,
  input: AINarrationGeneratorInput,
  selectedIndex: number | null,
  reason: string
): AINarrationContractV1 {
  const safe = candidate && typeof candidate === 'object' ? (candidate as Partial<AINarrationContractV1>) : null;
  if (!safe) return buildDefaultContract(input, selectedIndex, reason);

  return {
    schemaVersion: safe.schemaVersion === '1.0.0' ? '1.0.0' : '1.0.0',
    intentType: safe.intentType ?? 'story_action',
    commitment: safe.commitment ?? (selectedIndex == null ? 'informatif' : 'declaratif'),
    target: safe.target && typeof safe.target === 'object' ? safe.target : {},
    socialFocus:
      safe.socialFocus && typeof safe.socialFocus === 'object'
        ? {
            active: Boolean((safe.socialFocus as any).active),
            interlocutorLabel: String((safe.socialFocus as any).interlocutorLabel ?? '').trim() || undefined
          }
        : { active: false },
    worldIntent:
      safe.worldIntent && typeof safe.worldIntent === 'object'
        ? {
            type: (safe.worldIntent as any).type ?? (selectedIndex == null ? 'none' : 'runtime_progress'),
            reason: String((safe.worldIntent as any).reason ?? reason).trim(),
            targetLabel: String((safe.worldIntent as any).targetLabel ?? '').trim() || undefined,
            transitionId: String((safe.worldIntent as any).transitionId ?? '').trim() || undefined
          }
        : selectedIndex == null
          ? { type: 'none', reason }
          : { type: 'runtime_progress', reason },
    toolCalls: Array.isArray(safe.toolCalls)
      ? safe.toolCalls
          .map((entry) => {
            const row = entry && typeof entry === 'object' ? (entry as { name?: unknown; args?: unknown }) : null;
            const name = String(row?.name ?? '').trim().toLowerCase();
            const args = row?.args && typeof row.args === 'object' ? (row.args as Record<string, unknown>) : {};
            return name ? { name, args } : null;
          })
          .filter((row): row is { name: string; args: Record<string, unknown> } => row !== null)
          .slice(0, 6)
      : [],
    mjResponse:
      safe.mjResponse && typeof safe.mjResponse === 'object'
        ? {
            scene: String((safe.mjResponse as any).scene ?? '').trim(),
            actionResult: String((safe.mjResponse as any).actionResult ?? '').trim(),
            consequences: String((safe.mjResponse as any).consequences ?? '').trim(),
            options: Array.isArray((safe.mjResponse as any).options)
              ? (safe.mjResponse as any).options
                  .map((value: unknown) => String(value ?? '').trim())
                  .filter((value: string) => Boolean(value))
                  .slice(0, 6)
              : []
          }
        : buildDefaultContract(input, selectedIndex, reason).mjResponse
  };
}

export class HeuristicMjNarrationGenerator implements MjNarrationGenerator {
  public async generate(input: AINarrationGeneratorInput): Promise<AINarrationGeneratorOutput> {
    if (!input.candidates.length) {
      const reason = 'No applicable narrative candidate';
      return {
        selectedIndex: null,
        reason,
        contract: buildDefaultContract(input, null, reason)
      };
    }

    const query = normalize(input.query);
    const scored = input.candidates.map((candidate, index) => {
      let score = 1;
      if (candidate.impactScope === 'global') score += 4;
      if (candidate.impactScope === 'regional') score += 3;
      if (candidate.impactScope === 'local') score += 2;
      if (query && normalize(candidate.consequence).includes(query)) score += 2;
      if (query && normalize(candidate.command.trigger).includes(query)) score += 2;
      return { index, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const reason = 'Selected by heuristic priority (impact + query overlap)';
    return {
      selectedIndex: best.index,
      reason,
      contract: buildDefaultContract(input, best.index, reason)
    };
  }
}

export interface OpenAIMjNarrationGeneratorOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  temperature?: number;
}

export class OpenAIMjNarrationGenerator implements MjNarrationGenerator {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly temperature: number;

  constructor(options?: OpenAIMjNarrationGeneratorOptions) {
    this.apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.model = options?.model ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
    this.endpoint = options?.endpoint ?? process.env.OPENAI_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions';
    this.temperature = options?.temperature ?? 0.2;
  }

  public async generate(input: AINarrationGeneratorInput): Promise<AINarrationGeneratorOutput> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY manquant pour OpenAIMjNarrationGenerator');
    }

    if (!input.candidates.length) {
      const reason = 'No applicable narrative candidate';
      return {
        selectedIndex: null,
        reason,
        contract: buildDefaultContract(input, null, reason)
      };
    }

    const systemPrompt =
      'You are a strict narrative game master assistant. Return ONLY valid JSON with keys: selectedIndex (number|null), reason (string), and contract (object). contract must include: schemaVersion, intentType, commitment, target, socialFocus, worldIntent, toolCalls, mjResponse. Select one candidate index from candidates when possible.';

    const userPayload = {
      query: input.query,
      facts: input.contextPack.facts,
      anchors: input.contextPack.anchors,
      candidates: input.candidates.map((candidate, index) => ({
        index,
        transitionId: candidate.transitionId,
        entityType: candidate.command.entityType,
        entityId: candidate.command.entityId,
        trigger: candidate.command.trigger,
        fromState: candidate.fromState,
        toState: candidate.toState,
        consequence: candidate.consequence,
        impactScope: candidate.impactScope,
        ruleRef: candidate.ruleRef
      }))
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI call failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned empty content');
    }

    let parsed: { selectedIndex?: number | null; reason?: string; contract?: unknown };
    try {
      parsed = JSON.parse(content) as { selectedIndex?: number | null; reason?: string; contract?: unknown };
    } catch (error) {
      throw new Error(`OpenAI JSON parse error: ${(error as Error).message}`);
    }

    const selectedIndex =
      parsed.selectedIndex == null ? null : clampIndex(parsed.selectedIndex, input.candidates.length);

    const reason = parsed.reason?.trim() || 'Selection produced by OpenAI generator';

    return {
      selectedIndex,
      reason,
      contract: sanitizeContract(parsed.contract, input, selectedIndex, reason)
    };
  }
}
