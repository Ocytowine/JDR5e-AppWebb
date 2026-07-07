# Matrice de preuves I-03

Date de revue : 2026-07-07
Contrat : `temporal-kernel/1`

## Conclusion

I-03 est livré dans son périmètre : horloge unique, échéancier causal, checkpoints de processus, adaptateur monde sur copie, voyage segmenté, rencontre déterministe structurée, position committée et rejeu idempotent.

Le lot ne livre pas de scène IA, de prose de rencontre, de repos jouable, d'interface, de handoff tactique, de mémoire longue ou de création dynamique de PNJ. Ces limites sont conformes au périmètre I-03 et ne doivent pas être contournées par une logique implicite dans le domaine temporel.

## Couverture

| # | Preuve exigée | Statut | Preuve exécutable | Limite |
|---:|---|---|---|---|
| 1 | Horloge de campagne unique | COUVERT | `narration-module:test:time:kernel` et `narration-module:test:time:persistence` vérifient `world.clock.elapsedGameSeconds`, propositions de temps et commits atomiques. | Le calendrier civil reste une projection future. |
| 2 | Question méta sans temps consommé | COUVERT | `narration-module:test:time:travel` couvre NAR-ACC-007 au checkpoint méta : `NO_GAME_TIME`, durée zéro, aucun changement de voyage. | L'interpréteur d'entrée joueur appartient à un lot ultérieur. |
| 3 | Ordre causal stable des échéances | COUVERT | `narration-module:test:time:kernel` couvre dépendances, priorité de frontière, ordre indépendant de l'énumération, cycles et dépendances absentes. | Les règles métier de repos restent hors I-03. |
| 4 | Persistance des échéances et checkpoints | COUVERT | `narration-module:test:time:persistence` valide `world.schedule`, `process.state`, empreintes, cycles et panne sans état partiel. | Les payloads de domaines futurs devront ajouter leurs propres validateurs. |
| 5 | Adaptateur monde sans seconde horloge | COUVERT | `narration-module:test:time:map-adapter` et `narration-module:test:time:persistence` exécutent le moteur carte sur copie pour 1 h et 6 h. | Le moteur carte reste propriétaire de sa simulation interne. |
| 6 | Voyage segmenté et sauvegardable | COUVERT | `narration-module:test:time:travel` produit `TravelProcessV1`, segment, checkpoint et arrêt à frontière/interruption/rencontre. | Pas d'UI de voyage ni de choix affichés. |
| 7 | Rencontre contextuelle reproductible | COUVERT | `narration-module:test:time:travel` vérifie graine stable, pression, candidat structuré et `pendingDecision` observation/évitement/approche. | Le candidat n'est pas encore une scène, un PNJ promu ou une intrigue. |
| 8 | Commit voyage atomique | COUVERT | `narration-module:test:time:persistence` écrit horloge, `process.state`, `world.position` et événement de voyage en une transaction. | Les ressources consommées par un voyage restent hors périmètre. |
| 9 | Rejeu sans double effet | COUVERT | Mémoire et Chromium rejouent le même commit et vérifient un seul événement de voyage. | Les doubles entrées UI seront traitées par l'orchestrateur de tour. |
| 10 | IndexedDB et réouverture | COUVERT | `narration-module:test:indexeddb` exécute les contrats core, bootstrap, temporels et spécifiques dans Chromium. | Pas de benchmark capacité long. |
| 11 | Build et régressions | COUVERT | `npm run narration-module:build`, `npm run narration-module:test:time`, `npm run narration-module:test:indexeddb`, `npm run build`. | `npm audit --omit=dev` conserve la dette transitive `@xmldom/xmldom` déjà suivie. |

## Scénarios

- NAR-ACC-007 : couvert au niveau déterministe par le temps nul méta et les commits temporels; l'évolution narrative perceptible après retour dépendra de mémoire/snapshot/présentation.
- NAR-ACC-010 : couvert au niveau déterministe par durée validée, pression, candidat structuré, liberté d'approche et absence de double rencontre.
- NAR-ACC-020 : couvert au niveau déterministe par l'ordre causal stable, les frontières temporelles et le rejeu de batch/commit.

## Décision de périmètre

I-03 peut être fermé. Le prochain lot ne doit pas ajouter de nouvelles mutations temporelles propriétaires sans passer par `CampaignRepository.commit` ou un contrat explicitement audité.

I-04 doit commencer par AF-R08 et AF-R09 : mémoire, snapshot, contexte, budget et secrets. Les données produites par I-03 deviennent des sources de vérité possibles pour les futurs rappels, mais I-03 ne fournit aucun moteur de rappel.
