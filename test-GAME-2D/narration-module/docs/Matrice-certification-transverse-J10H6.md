# Matrice de certification transverse J10-H6

Date : 2026-08-27

Statut : `GATE LOCALE — AUCUN APPEL OPENAI LIVE`

## Objet

Cette matrice réunit les preuves dispersées des propriétaires après les
changements transverses H1 à H5. Elle ne donne aucune autorité supplémentaire
au focus conversationnel ou à l'interprétation : chaque conséquence reste
validée, committée et rejouée par son module propriétaire.

## Compositions certifiées

| Transition depuis un dialogue | Propriétaire suivant | Preuve composée | Invariants certifiés |
|---|---|---|---|
| `dialogue → inventaire` | inventaire | `j9b-full-local`, `inventory-access`, `inventory-commerce-j3` | cible sociale sans preuve de possession ; instances, quantités, conteneurs, prix et commit restent propriétaires ; rejeu sans double transfert |
| `dialogue → mission` | mission/relation | `j9b-full-local`, `mission-dialogue-j4`, `mission-relation-authority` | proposition distincte de l'acceptation ; refus et condition conservés ; aucune relation implicite ; rejeu sans double mission |
| `dialogue → intrigue` | intrigue/connaissance | `j9b-full-local`, `knowledge-claims`, `plot-authority`, `plot-candidate-j5` | hypothèse neutre, perspective bornée, aucun secret promu, résolution et événements idempotents |
| `dialogue → voyage` | voyage/temps/monde | `j9b-full-local`, `j10b-travel`, `world-scene-events` | fermeture du focus à la transition ; temps, position, provisions, interruption et reprise atomiques |
| `dialogue → tactique` | handoff tactique | `j10h2-focus`, `tactical-access`, `tactical-rest-handoff`, `tactical-checkpoint` | focus fermé au handoff ; aucun combat inventé ; graine, issue, temps et intégration rejouables |

La gate `j9b-full-local` commence par deux dialogues, puis enchaîne dans le
même contrôleur et la même campagne les mutations d'inventaire, les décisions
de recrutement et mission, l'intrigue et le voyage. Elle restaure ensuite le
contrôleur et rejoue les identifiants critiques. Le passage tactique demeure un
handoff spécialisé : H6 certifie sa frontière, pas la refonte future de carte
et de placement reportée par J8.

## Couverture des invariants

| Invariant H6 | Preuves |
|---|---|
| secrets et perspectives | `j10a-boundaries`, `knowledge-claims`, contexte incarné G4, carnet privé J10-D, récapitulatif J10-E |
| autonomie des compagnons | `companion-j7`, `j10c-companions`, `j9b-full-local` |
| temps et monde | `j10b-travel`, `narrative-rest-runtime`, `world-scene-events`, `tactical-rest-handoff` |
| ressources et inventaires | `inventory-access`, `inventory-commerce-j3`, `j9b-full-local` |
| commits et rejeux | `j9b-full-local`, `j9c-browser`, `tactical-rest-handoff`, contrats IndexedDB |
| idempotence de soumission | `j10h1-submission` en logique pure et dans Chromium |
| migrations | `indexeddb` : activation, sauvegarde, échec, rollback, version future et connexions antérieures |
| diagnostics hors du fil | `j10h5-diagnostics` et surface immersive J10-F |

## Commandes

```text
npm run narration-module:test:j10h6-owners
npm run narration-module:test:j10h6-browser
npm run narration-module:test:j10h6-certification
```

`j10h6-certification` réunit les deux gates puis le build complet. Un audit
exécutable parcourt récursivement leurs dépendances npm et échoue si une
commande `openai-live` entre dans cette fermeture locale.

## Limites explicites

- la qualité sémantique réelle du modèle distant appartient à H7 ;
- H6 n'exécute ni benchmark ni recette OpenAI live ;
- le contrôle direct d'un compagnon, la génération de carte et le placement
  multi-acteurs restent fermés hors capacité tactique autoritaire ;
- les erreurs de proxy attendues dans J9-C indiquent que l'API distante est
  absente ; elles ne constituent pas un appel OpenAI et le fallback local est
  la sortie certifiée de cette recette.
