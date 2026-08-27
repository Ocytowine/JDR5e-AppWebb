# Checkpoint — regroupement de dialogue après J10-H7

Date : 2026-08-27  
Statut : `CORRECTIF LOCAL CERTIFIÉ`

## Observation

Une recette manuelle aux Archives de Lysenthe a produit deux composantes V8
routables vers `scene.visible-dialogue` : une question au garde, puis une
déclaration destinée au même interlocuteur. Le pont propriétaire V1 acceptait
une composante unique ou une mise en attention suivie d'une communication, mais
pas deux actes de parole. Il abandonnait donc le plan G5 pourtant valide et la
projection historique `UNSUPPORTED_DOMAIN` produisait un handoff générique.

La seconde composante ne répétait pas la référence du garde. Cette absence
n'était pas une ambiguïté du cadre global : la première composante portait
l'unique acteur résolu de la prise de parole.

## Correction

Le sélecteur G5 reconnaît désormais un groupe homogène de dialogue lorsque :

- toutes les étapes sont `ROUTABLE` ou `AWAITING_ATOMIC_GROUP_OWNER`, avec la
  capacité `scene.visible-dialogue` dans le domaine `social` ;
- toutes les composantes sont engagées et sans condition, alternative ou
  remplacement qui gouverne réellement leur exécution ; une hypothèse incluse
  dans une parole `committed` reste du contenu adressé ;
- leurs relations sont indépendantes, successives ou causales sous une
  exécution `ORDERED`, ou leur simultanéité reste entièrement interne au groupe
  sous une exécution `ATOMIC` ;
- leurs dépendances ne pointent que vers des étapes antérieures du groupe ;
- l'ensemble expose exactement une référence `npc:` ou `actor:`.

La cible unique est portée par toute la commande, y compris lorsqu'une étape
suivante ne la répète pas. Les actes structurés restent disponibles dans
`payload.orderedDialogueActs`. Lorsque leurs natures diffèrent, l'adaptateur V1
présente un acte composite `OTHER` dont le `contentGoal` est le sens global ; le
cadre V8 et le reçu de fidélité conservent chaque acte original.

Deux interlocuteurs explicites, deux domaines, une parole réellement
`conditional`, une alternative ou une simultanéité extérieure au groupe restent
suspendus. Aucun texte brut n'est lu pour former le groupe.

## Preuves locales

```text
npm run narration-module:test:open-semantic-owner-routing-g5
npx --yes tsx narration-module/tests/scene/verify-open-semantic-ui-owner-adapters-g7.ts
npm run narration-module:test:j10h3-fidelity
npm run narration-module:test:j10h4-resilience
npm run narration-module:test:j10h5-diagnostics
npm run build
```

Les fixtures intégrées couvrent `ASK_QUESTION` suivi, justifié ou accompagné de
`MAKE_STATEMENT`, sous relations `THEN`, `CONDITION_RESULT` et `SIMULTANEOUS`,
ainsi que la continuité de cible. Elles obtiennent `COMMIT_APPLIED`, une commande
sociale vers le même acteur, une performance PNJ unique et aucun texte de
handoff propriétaire. Une question engagée contenant « si le garde ne sait pas
ou ne souhaite pas répondre » est opposée à une révélation réellement différée
avec `commitment=conditional`, qui reste `AWAITING_CONDITION`.
Aucun appel OpenAI réel n'a été exécuté pour cette correction.
