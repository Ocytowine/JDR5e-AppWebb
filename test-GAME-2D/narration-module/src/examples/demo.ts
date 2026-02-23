import { ContextPackBuilder } from '../ContextPackBuilder';
import { TransitionEngine } from '../TransitionEngine';
import type { NarrativeTransition } from '../types';

const transitions: NarrativeTransition[] = [
  {
    id: 'quest.detectee.to.acceptee',
    entityType: 'quest',
    fromState: 'Détectée',
    trigger: 'Le joueur accepte explicitement',
    toState: 'Acceptée',
    consequence: 'Ajout au journal et suivi activable',
    impactScope: 'local',
    ruleRef: 'local.narration.quest.accept',
    loreAnchors: [
      { type: 'lieu', id: 'ville.capitale.marche', label: 'Marché de la place' },
      { type: 'acteur', id: 'pnj.roland', label: 'Roland' }
    ],
    timeBlock: { unit: 'hour', value: 0 }
  }
];

const engine = new TransitionEngine(transitions);
const result = engine.apply({
  entityType: 'quest',
  fromState: 'Détectée',
  trigger: 'Le joueur accepte explicitement'
});

const contextBuilder = new ContextPackBuilder();
const contextPack = contextBuilder.build({
  query: 'contrat au marché et faction locale',
  activeZoneId: 'ville.capitale.marche',
  records: [
    {
      id: 'ville.capitale.marche',
      type: 'lieu',
      title: 'Marché de la place',
      summary: 'Centre commercial de la capitale',
      zoneId: 'ville.capitale.marche'
    },
    {
      id: 'faction.guilde-archivistes',
      type: 'faction',
      title: 'Guilde des Archivistes',
      summary: 'Organisation érudite influente'
    }
  ]
});

console.log('[DEMO] Transition ->', result);
console.log('[DEMO] ContextPack anchors ->', contextPack.anchors);
