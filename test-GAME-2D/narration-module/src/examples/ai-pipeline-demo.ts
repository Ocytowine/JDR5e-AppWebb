import { GameNarrationAPI } from '../GameNarrationAPI';
import { HeuristicMjNarrationGenerator } from '../MjNarrationGenerator';
import { NarrativeRuntime } from '../NarrativeRuntime';
import { NarrativeRuntimeService } from '../NarrativeRuntimeService';
import { TransitionRepository } from '../TransitionRepository';

declare const process: any;

const tempStatePath = 'runtime/NarrativeGameState.ai-pipeline-demo.json';
const runtime = new NarrativeRuntime(TransitionRepository.createEngine());
const service = new NarrativeRuntimeService(runtime, tempStatePath);
const api = new GameNarrationAPI(service);
const generator = new HeuristicMjNarrationGenerator();

async function main(): Promise<void> {
  const outcome = await api.tickNarrationWithAI(
    {
      query: 'Pression grandissante autour de Valombre',
      activeZoneId: 'region.valombre',
      parentZoneIds: ['continent.ouest'],
      entityHints: {
        trama: ['trama.region.valombre'],
        quest: ['quest.main.contract-roland']
      },
      records: [
        {
          id: 'region.valombre',
          type: 'lieu',
          title: 'Valombre',
          summary: 'Region sous tension avec escalation politique',
          zoneId: 'region.valombre'
        },
        {
          id: 'faction.ligue-noire',
          type: 'faction',
          title: 'Ligue Noire',
          summary: 'Faction opportuniste qui profite du chaos'
        },
        {
          id: 'trame.valombre.dissension',
          type: 'histoire',
          title: 'Dissension de Valombre',
          summary: 'Trame active avec risques regionaux'
        }
      ]
    },
    generator
  );

  console.log('[AI PIPELINE DEMO] aiReason ->', outcome.aiReason);
  console.log('[AI PIPELINE DEMO] aiContract.schemaVersion ->', outcome.aiContract?.schemaVersion ?? 'none');
  console.log('[AI PIPELINE DEMO] aiContract.commitment ->', outcome.aiContract?.commitment ?? 'none');
  console.log('[AI PIPELINE DEMO] candidatesGenerated ->', outcome.candidatesGenerated);
  console.log('[AI PIPELINE DEMO] selected ->', outcome.selectedCommand);
  console.log('[AI PIPELINE DEMO] applied ->', outcome.appliedOutcome?.result.transitionId ?? 'none');
  console.log('[AI PIPELINE DEMO] guardBlocked ->', outcome.guardBlocked ?? false);
  console.log('[AI PIPELINE DEMO] context anchors ->', outcome.contextPack.anchors);
}

main().catch((error) => {
  console.error('[AI PIPELINE DEMO] error ->', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
