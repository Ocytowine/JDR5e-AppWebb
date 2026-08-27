# Checkpoint orchestration et résilience J10-H4

Date : 2026-08-26

Statut : `FERMÉ — SANS APPEL OPENAI LIVE`

## Résultat

La stratégie `narrative-ai-role-strategy/1` fixe désormais les séquences
distantes maximales par famille de tour :

- clarification : `player_intent_interpreter` ;
- dialogue V8 : `player_intent_interpreter`, `npc_performer`, puis critique si
  nécessaire ;
- rendu de scène V8 : `player_intent_interpreter`, `scene_writer`, puis critique
  si nécessaire ;
- chemin historique : interpréteur, planner et writer au maximum.

Une interprétation V8 possède déjà le plan d'exécution G5. Le `mj_planner`
n'est donc plus rappelé pour reformuler ce même plan. Le plafond autoritaire
reste `MAX_BILLABLE_AI_CALLS_PER_NARRATIVE_TURN_V1 = 3`.

## Limites et paquets

La requête du planner reprend maintenant les limites d'entrée, de sortie et de
temps de sa route. La limite locale fautive d'une seconde a été supprimée ; la
route produit conserve trente secondes.

Le paquet du performer publie un reçu de mesure
`npc-performer-packet-receipt/1` avec taille sérialisée, estimation de jetons,
budget déclaré et nombre de tours conservés. La mémoire envoyée reste limitée
aux cinq derniers échanges du PNJ concerné ; les textes historiques sont
normalisés et bornés. La fenêtre de lecture peut être plus large uniquement
pour retrouver ces cinq tours malgré les interventions d'autres acteurs.

La route produit du performer accepte jusqu'à 8 000 jetons d'entrée après cette
réduction. Son timeout reste inchangé à trente secondes.

## Fallbacks

Si une sortie du performer est indisponible, invalide ou rejetée par le
critique, le rendu utilise une réaction locale fondée sur le `dialogueAct`
structuré : salutation, question, déclaration, demande d'action ou acte autre.
Cette réaction ne contient aucune notice OpenAI ou runtime.

Le fallback reste séparé de `npcPerformance` : il ne devient ni une performance
acceptée, ni une mémoire durable, ni une révision conversationnelle. Le motif
d'échec reste disponible dans les diagnostics techniques.

## Preuves

```text
npm run narration-module:test:j10h4-resilience
npm run build
```

La gate H4 couvre stratégie de rôles, limites de route, mesure des paquets,
cinq actes de dialogue, absence de vocabulaire technique et toutes les gates
H0 à H3, G5 et G7. La recette des profils éphémères vérifie également qu'un
fallback affiché après rejet n'est jamais promu comme parole acceptée.

## Suite

J10-H5 peut maintenant rendre les diagnostics exacts et attribués à partir des
reçus H3 et H4, tout en les maintenant hors du fil narratif.
