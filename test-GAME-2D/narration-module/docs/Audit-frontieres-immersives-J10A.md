# Audit des frontières immersives J10-A

Statut : `AUDIT TERMINÉ — CORRECTIONS PLANIFIÉES`

Date : 2026-08-24

## Périmètre lu

L'audit couvre les constructeurs de contexte et les huit surfaces qui lancent
le pipeline IA dans `narration-module/src/application`, les projections de
scène et connaissances, les registres J4 à J7, le processus de voyage et
`NarrativeAppSurface.tsx`.

## Projections publiques disponibles

| Domaine | État actuel | Décision J10 |
|---|---|---|
| scène et connaissances | `PlayerPublicContextV1` filtre lieu, acteurs visibles, équipement visible et faits acquis | conserver comme socle et exclure explicitement le carnet |
| fil visible | `narrative-rendered-thread/1` restaure les blocs réellement montrés | réutiliser pour la chronique, sans diagnostics |
| personnage/inventaire | `InterpreterCharacterContextV1` fournit des références possédées pour interpréter une saisie | créer une projection d'aide-mémoire distincte ; ne pas réutiliser ce contexte comme résumé |
| compagnon | le registre brut mélange présence publique, politique d'autonomie et sources | projecteur public obligatoire avant récapitulatif |
| mission/relation | résumés, conditions et issues publiques cohabitent avec axes numériques et preuves | projecteur public obligatoire ; aucun score relationnel |
| intrigue | vérité, causalité et perspectives privées cohabitent avec découvertes et hypothèses | projecteur public obligatoire ; lecture brute interdite |
| voyage | le processus brut contient route, danger, graine, jet, seuil et décision | projecteur public borné ; `pendingDecision` reste l'autorité d'interruption |

## Sorties vers les rôles IA

Les appels passent tous par `runAiPipelineCallV1`, mais leurs requêtes sont
assemblées dans huit fichiers distincts : interprétation, planning MJ,
performance PNJ, enrichissement narratif, création d'intrigue, arbitrage de
destination, création de lieu et validation de motivation d'intrigue.

- l'interpréteur reçoit la saisie, les référents visibles, les derniers tours
  sémantiques, les capacités runtime, le contexte personnage borné, le contexte
  public et les compagnons actifs ;
- le planner reçoit la saisie, l'interprétation et la commande de domaine, mais
  son contexte déclare encore une scène de référence fixe : ce raccord doit être
  corrigé avant les voyages et interactions J10 réels ;
- le performer PNJ reçoit uniquement la perspective du PNJ ciblé, ses
  connaissances autorisées, son historique visible et les décisions publiques
  propriétaires ;
- l'adaptateur d'expression et le writer reçoivent le texte joueur, la scène
  active, le résultat déterministe et l'autorité de rendu ;
- les créateurs et critics disposent de contextes spécialisés pouvant contenir
  des éléments privés nécessaires à leur rôle, mais ne doivent jamais devenir
  une source du récapitulatif joueur.

Aucun chemin actuel ne connaît un carnet. Le risque principal est architectural :
il n'existe pas encore d'allowlist centrale d'egress et chaque builder compose
son propre objet. J10-A réserve donc le carnet à un module client séparé et
ajoute une vérification exhaustive des fichiers capables d'appeler le pipeline.

## Traces et immersion

`NarrativeAppSurface.tsx` appelle actuellement `appendNarrativeSystemTrace`
après chaque tour et ajoute au premier bloc `SYSTEM_NOTICE` : identifiants,
mémoire courte, sources, rôles IA, modèles, tokens, latences et temps internes.
Les erreurs affichent aussi messageKey, code, catégorie, stratégie de reprise et
incident.

Ces informations sont utiles pour développer et les valeurs sont déjà bornées,
mais leur affichage permanent rompt l'immersion. J10-F devra séparer :

- un message joueur narratif et récupérable, visible par défaut ;
- une trace technique complète derrière un mode développeur explicite ;
- un diagnostic sûr copiable, sans secret, uniquement lorsque demandé.

Le masquage ne doit pas supprimer la persistance ou l'observabilité nécessaire
aux tests et au support.

## Décisions de migration

- carnet : nouvelle base IndexedDB privée dédiée, aucune migration de campagne ;
- récapitulatif : projection reconstruite, aucun store supplémentaire ;
- interruption : réutiliser `process.state/1` et `pendingDecision` tant qu'aucun
  besoin de version 2 n'est démontré ;
- préférence de mode développeur : préférence UI locale non autoritaire ;
- projecteurs publics : nouveaux contrats applicatifs, aucune mutation des
  agrégats propriétaires.

## Corrections ordonnées

1. garder le carnet hors de toute dépendance applicative serveur ou métier ;
2. créer les projecteurs publics avant le compositeur de récapitulatif ;
3. remplacer la scène fixe du planner par la scène active projetée ;
4. raccorder la décision pendante du voyage à une réponse narrative idempotente ;
5. séparer rendu joueur et trace développeur sans perdre les diagnostics ;
6. certifier une canarie privée à travers chaque egress IA et chaque projection.

Les points 1 et 6 reçoivent un premier garde-fou exécutable en J10-A. Les autres
appartiennent respectivement à J10-B, J10-C, J10-E et J10-F.
