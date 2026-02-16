# Navigation des Notices

Point d'entree rapide pour savoir quelle notice consulter selon le besoin.

## 1) Creer une classe ou sous-classe

1. Lire `docs/notice/class-design-notice.md` ou `docs/notice/subclass-design-notice.md`.
2. Verifier la regle de progression dans `docs/characterCreator/progression-schema.md`.
3. Si la classe donne du materiel de depart:
4. Voir `docs/notice/item-design-notice.md`, `docs/notice/weapon-design-notice.md`, `docs/notice/armor-design-notice.md`.
5. Si la classe donne des actions/reactions:
6. Voir `docs/ActionEngine/action-creation-notice.md`.
7. Si la classe donne des features qui modifient le combat:
8. Voir `docs/notice/feature-modifiers-notice.md`.

## 2) Creer une race ou background evolutif

1. Lire `docs/notice/race-design-notice.md` ou `docs/notice/background-design-notice.md`.
2. Confirmer que la progression est sur `niveauGlobal` via `docs/characterCreator/progression-schema.md`.
3. Verifier le rendu creator/runtime dans `docs/notice/player-character-creator-design-notice.md`.

## 3) Ajouter du materiel et des bonus

1. Objets: `docs/notice/item-design-notice.md`.
2. Armes: `docs/notice/weapon-design-notice.md`.
3. Armures: `docs/notice/armor-design-notice.md`.
4. Bonus equipement: `docs/notice/bonus-design-notice.md`.

## 4) Ajouter des sorts ou actions

1. Sorts: `docs/notice/spell-design-notice.md`.
2. Actions: `docs/ActionEngine/action-creation-notice.md`.
3. Taxonomie pipeline: `docs/ActionEngine/action-pipeline-taxonomy.md`.
4. Etat reel moteur (hooks/ops/fonctions): `docs/ActionEngine/engine-progress.md`.
5. Provenance des sorts (plan d'integration): `docs/ActionEngine/spell-source-provenance-integration-plan.md`.

## 5) Valider le pipeline complet

1. Procedure globale: `docs/notice/content-author-checklist.md`.
2. Projection creator -> runtime: `docs/notice/player-character-creator-design-notice.md`.
3. Regles data-driven de features: `docs/notice/feature-modifiers-notice.md`.
4. Etat reel ActionEngine: `docs/ActionEngine/engine-progress.md`.
5. Plan de correction deux armes (DnD 2024): `docs/problemes/plan-correction-deux-armes-dnd2024.md`.
