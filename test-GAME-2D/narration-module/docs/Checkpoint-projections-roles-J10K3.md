# Checkpoint J10-K3 — projections minimales des rôles IA

Statut : `FERMÉ`

Date : 2026-09-02

## Livré

- préparateur commun `prepareNarrativeRoleContextV1` ;
- manifeste local validé avant chaque appel migré ;
- `roleContextPack` réduit à un pointeur pour les paquets qui transportaient
  déjà leur contexte dans `task` ;
- projections déclarées avec propriétaire, sources, classification, cohérence,
  dépendances, taille sérialisée et caractère requis ou facultatif ;
- carnet joueur et secrets MJ déclarés `FORBIDDEN_FOR_AI` dans chaque manifeste ;
- cinq profils couverts : performer PNJ, writer de scène, creator de lieu,
  création factuelle et coherence critic ;
- création et critique d'intrigue raccordées aux mêmes frontières.

## Changements par rôle

### `npc_performer`

- reçoit l'acte résolu, l'acteur visible assigné, sa situation visible, son
  profil conversationnel, sa mémoire bornée et ses seules connaissances
  autorisées ;
- ne reçoit plus la saisie brute du joueur ;
- ne reçoit plus une deuxième copie de l'acteur et du contexte spatial dans
  `roleContextPack` ;
- les croyances et perspectives d'intrigue restent `ROLE_PRIVATE`, limitées à
  cet acteur ;
- la divulgation factuelle reste une projection séparée et propriétaire.

### `scene_writer`

- reçoit le résultat résolu, l'autorité de rendu et une projection publique de
  la scène active ;
- ne reçoit plus la saisie brute ni le plan MJ complet ;
- la capsule de scène ne recopie plus tout le brief dans son dernier bloc ;
- la présence recherchée provient de
  `semanticIntent.perception.informationKind=PRESENCE`, sans analyse lexicale
  locale des mots du joueur.

### `scene_creator`

- le lieu reçoit uniquement brief, influences de lore, contexte épistémique et
  politique de création ;
- l'intrigue reçoit uniquement acteurs, lieux, signaux publics, sources et
  contraintes de création ;
- ces données sont présentes une seule fois sous `task.context` ;
- les validateurs TypeScript et serveur lisent cette projection, avec
  compatibilité temporaire pour les anciennes fixtures.

### Création factuelle

- reçoit uniquement la propriété publique manquante, son sujet, sa politique de
  création et les faits publics d'appui ;
- le propriétaire local conserve la validation et le commit atomique ;
- aucune autre propriété, identité, mécanique ou donnée secrète n'est exposée.

### `coherence_critic`

- reçoit une sortie candidate, les preuves de résolution et les invariants
  strictement nécessaires au contrôle ;
- les critiques de dialogue ne reçoivent plus la saisie brute ;
- le contrôle d'expression compare le candidat au but sémantique structuré ;
- les preuves d'intrigue sont limitées au candidat concerné et à ses sources.

## Autorités conservées

Aucun manifeste ni rôle IA ne gagne d'autorité de commit, temps, succès,
mutation d'inventaire, création durable, connaissance PNJ ou divulgation. Les
validations métier existantes continuent de relire les sorties avant toute
action propriétaire.

La gate vérifie aussi qu'aucun constructeur migré ne recrée un payload complet
dans `roleContextPack`, et que les sentinelles carnet privé et secret MJ ne
figurent ni dans les manifestes ni dans les pointeurs réseau.

## Vérification

```powershell
npm run narration-module:test:j10k3-role-projections
```

La commande couvre les cinq profils, treize tours de conversation avec deux
PNJ, la mémoire par acteur, les lieux guidés par le lore, les intrigues, la
création factuelle atomique, les transitions, la route serveur, K0 à K2, la
dette lexicale et le build TypeScript du module. Aucun appel OpenAI live n'est
effectué.

Le build global et la recette `scene-playable-quality` passent également. La
recette historique `vertical-quality` conserve un écart distinct : elle attend
qu'une réponse méta sans matière fictionnelle ne soit pas marquée comme
enrichie, contrairement au contrat actuel de l'adaptateur d'expression. Cet
écart est reporté dans `TASKS.md` et ne provient pas des projections K3.

## Limite et reprise

K3 garantit la sélection et l'unicité structurelles. Il ne prétend pas encore
que le plafond déclaré couvre instructions, schéma et surcharge fournisseur.
J10-K4 doit mesurer le corps final avant envoi, appliquer une politique
déterministe et produire un incident explicite plutôt qu'un dépassement ou une
troncature silencieuse.
