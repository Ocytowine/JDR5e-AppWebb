# Guerrier (Fighter 2024) - Spec complete + tracker

Ce document sert de reference pour implementer la classe `fighter` et sa sous-classe `eldritch-knight`
dans le pipeline data-driven du projet (PlayerCharacterCreator + runtime combat), sans code special de classe.

## 1) Vision de classe

Le Guerrier est un combattant martial polyvalent:
- maitrise des armes et armures,
- endurance defensive (`Second souffle`),
- acceleration tactique (`Fougue` / Action Surge),
- progression offensive stable (attaques supplementaires),
- robustesse defensive (`Inflexible` / Indomitable),
- personnalisation via sous-classe.

Dans ce repo, la sous-classe cible est:
- `eldritch-knight` (Chevalier Occulte), profil martial + magie de magicien.

## 2) Etat actuel du repo (baseline)

### Data presente
- `src/data/characters/classes/Guerrier/class.json`
- `src/data/characters/classes/Guerrier/eldritch-knight.json`
- action existante: `src/data/supports/second-wind.json`

### Point important
- `fighter` est defini avec ses proficiencies et `subclassLevel=3`.
- `eldritch-knight` est defini avec un bloc `spellcasting` (`casterProgression: "third"`).
- la `progression` de classe est en place; la sous-classe est structuree sur ses niveaux cles.

## 3) Traits de base attendus (cible DnD 2024)

### Classe Guerrier
- caracteristique principale: Force ou DEX.
- de de vie: d10.
- sauvegardes: Force, Constitution.
- competences: 2 parmi la liste Guerrier.
- armes: simples + martiales.
- armures: legeres, intermediaires, lourdes, bouclier.

### Capacites de progression (cible metier)
- N1: Style de combat, Second souffle, Bottes d arme.
- N2: Fougue (Action Surge), Sens tactique.
- N3: Sous-classe.
- N4: ASI/Feat.
- N5: Attaque supplementaire, Decalage tactique.
- N6: ASI/Feat.
- N7: capacite sous-classe.
- N8: ASI/Feat.
- N9: Inflexible, Botte tactique.
- N10+: suite selon table 2024.

## 4) Sous-classe cible: Chevalier Occulte (`eldritch-knight`)

### Identite
- guerrier martial qui ajoute un sous-systeme de magie.
- stat de magie: `INT`.
- progression magique tierce (`third caster`).

### Jalons metier cibles
- N3: acces sous-classe + debut magie.
- N7: Magie de guerre.
- N10: Frappe eldritch (selon interpretation retenue).
- N15: Charge arcanique.
- N18: Maitre de la magie de guerre.

Note:
- les noms exacts/effets peuvent etre ajustes, mais doivent etre portes par JSON (`features/actions/reactions/resources`) et non par branche code speciale.

## 5) Mapping data recommande (projet)

### 5.1 Classe `fighter`

Ajouter un bloc `progression` complet dans:
- `src/data/characters/classes/Guerrier/class.json`

Exemples de grants attendus:
- `feature`: style de combat, second souffle, fougue, sens tactique, attaque supplementaire, inflexible, etc.
- `bonus`: `asi-or-feat` aux niveaux cibles.
- `action` / `reaction` si une capacite doit apparaitre directement en action utilisable.
- `resource` si une capacite utilise des charges (si non derivee via feature).

### 5.2 Sous-classe `eldritch-knight`

Ajouter un bloc `progression` dans:
- `src/data/characters/classes/Guerrier/eldritch-knight.json`

Exemples de grants attendus:
- `feature`: magie de guerre, frappe eldritch, charge arcanique, etc.
- `spell`: sorts imposes si la variante design le demande.
- eventuels `action`/`reaction` selon la modelisation retenue.

### 5.3 Features et actions a creer (si absentes)

Chemins cibles:
- `src/data/features/fighter/*.json` pour les features specifiques Guerrier.
- `src/data/features/shared/fighting-style*.json` pour les styles de combat reutilisables par plusieurs classes.
- `src/data/supports/*.json` ou `src/data/attacks/*.json` si une action active est requise.

Indexer ensuite:
- `src/data/features/index.json`
- `src/data/actions/index.json` (si nouvelles actions)

## 6) Contraintes d architecture (obligatoires)

1. Pas de `if (classId === "fighter")` en mecanique runtime.
2. Toute regle doit passer par grants/feature/action/resource data-driven.
3. Ressources via `id/pool/meta` + ops generiques (`SpendResource`, `RestoreResource`, etc.).
4. Le creator doit afficher les gains via `progression` et projections `derived`.
5. Le runtime doit resoudre les effets via catalogues et resolvers generiques.

## 7) Checklist de livraison Guerrier

- [x] `class.json` Guerrier complete avec `progression`.
- [x] `eldritch-knight.json` complete avec `progression`.
- [x] features Guerrier creees et indexees.
- [x] actions/reactions necessaires creees et indexees.
- [x] ressources (charges) modelisees en data.
- [ ] affichage coherent dans l onglet fiche (`derived.grants`).
- [ ] save/load fiche conserve les projections.
- [ ] combat applique bien actions/reactions/ressources derivees.

## 8) Progress tracker (implementation Guerrier)

```json
{
  "feature": "fighter-and-eldritch-knight",
  "version": 1,
  "phases": [
    {
      "id": "class-progression",
      "status": "done",
      "deliverables": [
        "progression fighter niveaux 1..20",
        "grants feature/bonus coherents"
      ]
    },
    {
      "id": "subclass-progression",
      "status": "done",
      "deliverables": [
        "progression eldritch-knight niveaux cles",
        "integration magie tiers caster"
      ]
    },
    {
      "id": "features-actions",
      "status": "done",
      "deliverables": [
        "features fighter indexees",
        "actions/reactions runtime associees"
      ]
    },
    {
      "id": "resources",
      "status": "done",
      "deliverables": [
        "charges second souffle/fougue/inflexible modelisees",
        "consommation/restauration via ops generiques"
      ]
    },
    {
      "id": "qa",
      "status": "todo",
      "deliverables": [
        "scenario creation->save->combat valide",
        "aucune logique speciale de classe ajoutee"
      ]
    }
  ]
}
```

## 9) Journal d avancement

### 2026-02-12
- Document Guerrier normalise et aligne avec la strategie data-driven du projet.
- Tracker d implementation ajoute (classe + sous-classe + runtime).
- Squelette `progression` ajoute dans `src/data/characters/classes/Guerrier/class.json` (niveaux 1 a 20).
- `second-wind` branche en `grant.kind=action` au niveau 1 pour disponibilite runtime immediate.
- `progression` ajoutee dans `src/data/characters/classes/Guerrier/eldritch-knight.json` (niveaux 3, 7, 10, 15, 18).
- Features `fighter/*` creees et ajoutees a `src/data/features/index.json`.
- Modelisation des ressources de classe ajoutee (Second souffle, Fougue, Inflexible via `grant.kind=resource`).
- Actions de support `action-surge` et `indomitable` ajoutees dans `src/data/supports` et indexees dans `src/data/actions/index.json`.
- `fighting-style` migre vers un choix declaratif (`rules.choices`) pour etre resolu par le flux generique `startClassDefine`.
- Ajout des features de styles (`fighting-style-*`) comme effets choisis, sans code special classe dans les mecaniques.
- Les choix de style sont maintenant persistes dans `choiceSelections.classFeatures`, traces dans `progressionHistory`, et projetes dans `derived.grants`.
- Ajout d un moteur runtime generique de modificateurs de feature (`feature.rules.modifiers`) applique aux stats de combat et aux actions.
- Styles actifs immediatement en combat via data: `Archerie` (+2 attaque distance), `Defense` (+1 CA si armure), `Duel` (+2 degats melee une main sans arme main gauche), `Combat a deux mains` (relance des 1-2 sur des de degats).
- Styles en attente de hooks runtime dedies (pas de hardcode ajoute): `Interception`, `Protection`, `Combat a deux armes` (attaque secondaire).

### 2026-02-13
- Extension du socle data-driven des styles via `feature.rules.reactionModifiers`:
  - `incomingAttack` + `imposeDisadvantage` (Protection).
  - `incomingAttackHit` + `reduceDamage` (Interception).
- Extension du socle via `feature.rules.secondaryAttackPolicy` pour l attaque secondaire:
  - `mode=addAbilityModToDamage`, sans code special de classe.
- Mise a jour des features partagees:
  - `src/data/features/shared/fighting-style-protection.json`
  - `src/data/features/shared/fighting-style-interception.json`
  - `src/data/features/shared/fighting-style-two-weapon-fighting.json`
- Correction generique de detection offhand cote runtime:
  - detection sur equipements armes "portees" (slots ceinture/dos) et fallback `main_gauche`.
- Notice de reference ajoutee:
  - `docs/notice/feature-modifiers-notice.md`

### 2026-02-16
- Extension du runtime feature-modifiers pour les couts d'action:
  - `actionCostOverride` (from/to cost),
  - quotas par tour (`maxPerTurn`) et scaling par action principale deja prise (`maxPerTurnPerActionUsed`),
  - priorites de regles (`priority`),
  - nouvelles conditions runtime (`actionTagsNone`, `requiresTurnSpellCast`, `requiresTurnCantripCast`, `requiresTurnAttackActionUsed`).
- Features Guerrier rendues operationnelles en combat:
  - `extra-attack`, `extra-attack-2`, `extra-attack-3` (attaques gratuites supplementaires sur l'action Attaque),
  - `war-magic`, `improved-war-magic` (attaque d'arme en bonus apres sort/cantrip),
  - `action-surge` (action principale supplementaire),
  - `tactical-shift` (sur `second-wind`: mouvement bonus + immunite OA via statut `disengaging`).
- `tactical-mastery` projete maintenant des `weaponMasteries` additionnelles (`poussee`, `sape`, `ralentissement`) via grants data.
- Hooks eldritch/tactiques branches en runtime:
  - `tactical-mind`: sur `ABILITY_CHECK` echoue, depense `second-wind` et tente conversion en succes (+1d10).
  - `eldritch-strike`: modelise via `rules.runtimeMarkers` (pas de branche feature), pose une marque sur hit melee d'arme; prochain `SAVING_THROW` contre un sort de la source avec desavantage.
  - `action-surge`, `tactical-shift`, `arcane-charge`: modelises via `rules.runtimeEffects` (post-resolution), sans condition codee par feature.
- Fiabilisation marqueurs runtime:
  - cycle moteur generique: `active -> expiring` au debut du prochain tour de la source, puis purge fin de ce tour.
  - le moteur applique/consomme les effets de resolution selon `effect.*` du marker (pas de cas par feature).
