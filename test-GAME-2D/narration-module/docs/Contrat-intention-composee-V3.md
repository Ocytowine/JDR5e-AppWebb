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

## Correction de frontière V3–V5

Correction livrée le 2026-07-30 après un test joueur aux Archives : une
composante `communication.mode=SPEECH` valide pouvait être accompagnée d'un
`kind` principal incohérent. La route serveur rejetait alors l'enveloppe avant
que la dérivation locale prévue par ce contrat puisse s'exécuter.

La route OpenAI canonicalise désormais les champs principaux dérivables depuis
la composition avant sa validation croisée. Le validateur TypeScript applique
la même lecture. Cette correction ne relit pas les mots du joueur et ne
transforme pas une composante absente ou invalide en parole.

La gate réaliste couvre maintenant deux tours supplémentaires au niveau de la
frontière concernée : contact avec le clerc visible, puis demande d'accès aux
documents de naissance afin de rechercher ses parents. Elle vérifie
`REQUEST_ACTION`, la conservation du clerc focalisé et l'absence de
clarification artificielle.

## Continuité explicite de l'interlocuteur

Le test live suivant a montré une seconde limite : après une prise de contact
correctement résolue, le modèle pouvait classer la demande suivante comme une
question de contexte lorsque celle-ci ne répétait pas le métier du PNJ.

Le paquet d'interprétation expose maintenant `activeDialogueTarget`, dérivé du
dernier échange validé et non libéré. Ce champ ne force pas toute saisie à
devenir une parole : il indique seulement au modèle que les demandes, questions
et déclarations qui poursuivent naturellement l'échange restent adressées à cet
interlocuteur. Un changement explicite de cible, une fin d'échange ou une action
physique distincte ne sont pas absorbés par ce contexte.

Cette continuité est structurelle : aucune liste de formulations comme
« accéder à des documents » ou de métiers comme « clerc » n'est recherchée dans
le texte joueur.
