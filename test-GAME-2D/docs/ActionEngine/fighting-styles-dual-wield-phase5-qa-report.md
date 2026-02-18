# Phase 5 - QA + Documentation (fighting styles / dual wield / wm)

Date: 2026-02-18
Scope: cloture du plan `fighting-styles-dual-wield-correctif-plan.md`

## 1) Verifications techniques executees

1. `npm run validate:content` (OK)
2. `npm run build` (OK)
3. `npx --yes tsx scripts/verify-action-economy.ts` (OK, trace ci-dessous).
4. Verification code: suppression de la branche hardcodee `coup-double` dans `src/game/engine/core/actionExecute.ts`.
5. Verification doc: mise a jour de `engine-progress.md` pour reflecter le comportement runtime reel.

### Trace d'execution (horodatee)

Horodatage: 2026-02-18 11:03:43 +01:00

Commande:

```bash
npx --yes tsx scripts/verify-action-economy.ts
```

Sortie observee:

```text
[OK] action-surge.json -> grantMainAction amount=1
[OK] cycle action de base: 1 action autorisee puis blocage
[OK] action-surge: action supplementaire accordee puis blocage
[OK] cycle bonus de base: 1 bonus autorisee puis blocage
[OK] rollback bonus: compteur restaure correctement
[OK] dual-wield: 1 arme=ineligible, 2 armes=eligible (si bonus dispo)

Verification de bout en bout reussie.
```

## 2) Matrice QA ciblee (phase 5)

### Cas A - Dual wield avec 2 armes light (petit couteau)

Data:
1. `src/data/items/armes/simple/petit-couteau.json`
2. `src/data/characters/features/shared/fighting-style-two-weapon-fighting.json`

Resultat:
1. Le resolver de mains est unifie via `resolveEquippedHandsLoadout` (utilise par `equipmentHands.ts` et `weaponPairingRules.ts`).
2. La validation dual wield n'exige plus `twoHanded=yes`; elle bloque uniquement les vrais conflits (arme two-handed, bouclier, absence de seconde arme, regle Light si non ignoree par policy).
3. Les tags dual-wield sont normalises de facon canonique (`dual-wield`, `offhand-attack`, `secondary-attack`).

Statut: OK (audit code + pipeline compile/build)

### Cas B - Extra Attack (gating action d'attaque)

Resultat:
1. Le contexte economie injecte `usedAttackActionCount`.
2. Le calcul `maxPerTurnPerActionUsed` peut se baser sur `requiresTurnAttackActionUsed`.
3. Les logs runtime exposent explicitement l'etat du gate: `hasTurnAttackActionUsed` + compteur d'attaques action.

Statut: OK (audit code + pipeline compile/build)

### Cas C - Action Surge (budget action principale)

Data:
1. `src/data/supports/action-surge.json`
2. `src/data/characters/features/fighter/action-surge.json`

Resultat:
1. L'action `action-surge` existe cote data actions (support) et depense la ressource.
2. L'effet runtime `grantMainAction` ajoute une action principale au pool du tour.
3. Les logs runtime rendent visible le delta de pool (`before -> after`) et les couts effectifs consommes.

Statut: OK (audit code + pipeline compile/build)

### Cas D - Weapon Mastery `wm-coup-double`

Data:
1. `src/data/actions/weapon-mastery/wm-coup-double.json`

Resultat:
1. `wm-coup-double` est pilote par emission d'event data (`weaponMastery:coup-double`).
2. Pas de branche speciale `coup-double` dans `actionExecute.ts`.
3. Limites par tour attendues via couche data/rules (usage keys/modifiers), pas via hardcode local.

Statut: OK (audit code + pipeline compile/build)

## 3) Observabilite UI (LogPanel)

1. `src/ui/LogPanel.tsx` supporte les tags: `economy`, `feature`, `dual-wield`, `wm`, `pipeline`.
2. Le filtrage par tag est actif, permettant un diagnostic rapide en UI.
3. Les messages runtime sont suffisamment verbeux pour expliquer un refus/action sans inspection directe du code.

Statut: OK

## 4) Risques residuels

1. Une validation manuelle en combat reel reste recommandee pour couvrir les enchainements multi-actions sur plusieurs tours (scenario joueur complet + IA), meme si les chemins critiques sont maintenant traces.
2. Le schema global `weapon-properties-progress-schema.md` conserve des items QA ouverts qui depassent ce correctif cible.

## 5) Conclusion phase 5

Phase 5 cloturee pour le correctif Fighting Styles / Dual Wield / WM:
1. QA technique executee (content + build + audit chemins critiques)
2. Documentation runtime alignee
3. Plan de correctif marque termine
