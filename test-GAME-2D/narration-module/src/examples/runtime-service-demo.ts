import { NarrativeRuntimeService } from '../NarrativeRuntimeService';

const service = NarrativeRuntimeService.createDefault();

const questId = 'quest.main.contract-roland';
let before = service.loadState();

if (!before.quests[questId]) {
  before.quests[questId] = 'Détectée';
  service.saveState(before);
  before = service.loadState();
}

if (before.quests[questId] === 'Détectée') {
  const outcome = service.applyTransitionAndSave({
    entityType: 'quest',
    entityId: questId,
    trigger: 'Le joueur accepte explicitement',
    strictTrigger: true
  });

  const after = service.loadState();
  console.log('[SERVICE DEMO] transition ->', outcome.result.transitionId);
  console.log('[SERVICE DEMO] quest state ->', after.quests[questId]);
  console.log('[SERVICE DEMO] history size ->', after.history.length);
} else {
  console.log('[SERVICE DEMO] transition skipped (state already progressed) ->', before.quests[questId]);
  console.log('[SERVICE DEMO] history size ->', before.history.length);
}
