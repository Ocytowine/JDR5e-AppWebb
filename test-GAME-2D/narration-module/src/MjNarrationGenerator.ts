import type {
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

export class HeuristicMjNarrationGenerator implements MjNarrationGenerator {
  public async generate(input: AINarrationGeneratorInput): Promise<AINarrationGeneratorOutput> {
    if (!input.candidates.length) {
      return {
        selectedIndex: null,
        reason: 'No applicable narrative candidate'
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
    return {
      selectedIndex: best.index,
      reason: 'Selected by heuristic priority (impact + query overlap)'
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
      return {
        selectedIndex: null,
        reason: 'No applicable narrative candidate'
      };
    }

    const systemPrompt =
      'You are a strict narrative game master assistant. Return ONLY valid JSON with keys: selectedIndex (number|null) and reason (string). Select one candidate index from candidates when possible.';

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

    let parsed: { selectedIndex?: number | null; reason?: string };
    try {
      parsed = JSON.parse(content) as { selectedIndex?: number | null; reason?: string };
    } catch (error) {
      throw new Error(`OpenAI JSON parse error: ${(error as Error).message}`);
    }

    const selectedIndex =
      parsed.selectedIndex == null ? null : clampIndex(parsed.selectedIndex, input.candidates.length);

    return {
      selectedIndex,
      reason: parsed.reason?.trim() || 'Selection produced by OpenAI generator'
    };
  }
}
