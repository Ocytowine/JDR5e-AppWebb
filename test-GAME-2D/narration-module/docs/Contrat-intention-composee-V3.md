# Contrat d'intention composée V3

Date : 2026-07-28

Statut : `IMPLEMENTE_GATE_LIVE_VALIDEE`

## Problème traité

`ai-intent-semantic/2` devait choisir un seul `kind`. Une entrée comme « je m'approche de l'archiviste, puis je le salue » pouvait donc perdre soit l'approche, soit l'ouverture de conversation. Renforcer le prompt V2 ne suffisait pas : une sortie `nonverbal_signal` avec `dialogueAct=null` ne laissait au logiciel aucune donnée structurée permettant de récupérer la parole sans relire lexicalement la phrase.

## Contrat

`ai-intent-semantic/3` conserve les champs V2 et ajoute `intent.composition` :

- `spatialLeadIn` décrit une approche réelle vers la cible, ou reste `null` ;
- `communication` décrit une parole ou un signal non verbal, ou reste `null` ;
- `order` conserve l'ordre exprimé lorsque les deux composantes existent ;
- une parole porte un acte de dialogue structuré ;
- un signal non verbal impose `act=null`.

Exemple :

```text
spatialLeadIn: APPROACH_TARGET, ordre 1
communication: SPEECH / INITIATE_CONVERSATION, ordre 2
```

L'adaptateur local dérive ensuite l'intention principale :

- parole présente → `address_visible_actor`, domaine social ;
- signal non verbal présent → `nonverbal_signal`, résolution de scène ;
- approche seule → `move_near_visible_actor`, résolution de scène.

La séquence ordonnée est conservée dans `semanticIntent.composition`. Le planner, le résolveur et le performer PNJ continuent à consommer l'intention principale existante : le changement ne crée pas un second moteur d'exécution et ne modifie pas l'autorité de commit.

## Frontière d'autorité

L'IA comprend les composantes depuis le sens complet de l'entrée. Le logiciel ne recherche ni « salue », ni « approche », ni une liste équivalente dans le texte joueur. Il vérifie le schéma, résout la cible depuis le registre visible, dérive le routage depuis les composantes et refuse toujours d'en déduire succès, réaction, temps ou mutation durable.

V1 à V4 restent acceptés. Depuis le 2026-07-28, la surface OpenAI utilise V5, qui conserve la composition V3, l'orientation V4 et rend les étapes sociales ordonnées; voir `Contrat-execution-composantes-ordonnees-V5.md`.

## Preuves

- `npm run narration-module:test:semantic-intent-v3` : une proposition principale erronée `move_near_visible_actor` est correctement dérivée en interaction sociale depuis `APPROACH_TARGET` puis `SPEECH`, sans perdre l'ordre ;
- `npm run narration-module:test:narrative-openai-route` : schéma OpenAI strict V3 et acceptation de la nouvelle version ;
- `npm run narration-module:test:semantic-intent-v2` : non-régression V2 ;
- `npm run narration-module:test:archives-perception:openai-live` : la phrase « je m'avance vers l'archiviste, puis je le salue » appelle le contrat actif V5, met l'approche en scène, atteint `npc_performer` et produit une réplique de l'archiviste.

Résultat live initial V3 puis validation aval V5 le 2026-07-28 : la compatibilité sémantique est conservée et le renderer consomme désormais l'approche.
