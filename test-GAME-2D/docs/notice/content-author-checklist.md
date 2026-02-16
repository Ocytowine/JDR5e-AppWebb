# Checklist Auteur de Contenu

Checklist rapide pour ajouter ou modifier du contenu (`race`, `background`, `class`, `subclass`) sans casser le pipeline Creator -> Sheet -> GameBoard.

## 1) Structure de base

- Definir un `id` stable et unique.
- Renseigner les champs metier principaux (`label`, `description`, etc.).
- Garder les ids referentiels coherents avec les index du projet.

## 2) Gains fixes et gains de progression

- Mettre les gains de base dans `grants`.
- Mettre les gains par niveau dans `progression.<niveau>.grants`.
- Utiliser uniquement des `grant.kind` supportes:
- `feature`, `action`, `reaction`, `resource`, `passif`, `spell`, `bonus`.

## 3) Regle d evaluation des niveaux

- `race` et `background`:
- progression evaluee sur `niveauGlobal`.
- `class`:
- progression evaluee sur le niveau de la classe.
- `subclass`:
- progression evaluee sur le niveau de la classe parente.

## 4) References de donnees

- Verifier que chaque id existe dans son index:
- `src/data/features/index.json`
- `src/data/actions/index.json`
- `src/data/reactions/index.json`
- autres index concernes (`passifs`, `spells`, etc.).

## 5) Regles anti-hardcode

- Ne pas ajouter de logique metier dediee a une classe (`if classId`).
- Si une mecanique manque, etendre un schema generique (`feature.rules`, resolver generique).

## 6) Verification dans le CharacterCreator

- Les gains de progression sont visibles dans la fiche (Sheet), ordonnes par niveau.
- Les categories restent lisibles:
- features vs actions vs reactions vs ressources.
- Les choix utilisateurs (ASI, options de features, outils/langues, etc.) sont bien reflétés.

## 7) Verification de la projection de sauvegarde

- `derived.grants.*` contient bien les gains attendus.
- `progressionHistory` contient les entrees attendues (choix + grants).

## 8) Verification runtime combat

- Les actions/reactions attendues sont disponibles en combat.
- Les ressources derivees sont initialisees correctement.
- Les effets de features passent par la mecanique generique (pas de branche speciale).

## 9) Validation technique

- Executer au minimum:
- `npm run build`
- Si pertinent:
- `npm run validate:content`

## 10) Mise a jour documentaire

- Mettre a jour la notice concernee en cas de nouveau champ/regle.
- References principales:
- `docs/characterCreator/progression-schema.md`
- `docs/notice/player-character-creator-design-notice.md`
- `docs/notice/race-design-notice.md`
- `docs/notice/background-design-notice.md`
- `docs/notice/class-design-notice.md`
- `docs/notice/subclass-design-notice.md`

## 11) Navigation rapide

- Point d'entree par scenario: `docs/notice/notice-navigation.md`
