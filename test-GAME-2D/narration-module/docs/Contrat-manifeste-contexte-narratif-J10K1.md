# Contrat du manifeste de contexte narratif J10-K1

Statut : `ACTIF — PASSIF JUSQU'À J10-K2`

Version : `narrative-context-manifest/1`

## But

Le manifeste décrit les projections disponibles pour un tour narratif sans
recopier leur contenu. Il permet de décider explicitement :

- quelle source reste propriétaire ;
- quelle version de contrat est exposée ;
- à quelle révision elle appartient ;
- quels rôles peuvent la consommer ;
- si elle est publique, privée pour un rôle ou interdite à toute IA ;
- combien de caractères sa projection sérialisée représente ;
- quelles autres projections doivent provenir du même contexte cohérent.

Le manifeste est construit en mémoire. Il n'est ni un agrégat de campagne, ni
un cache de faits, ni un nouveau registre persistant.

## Autorité

Le contrat porte obligatoirement :

- `authority=READ_ONLY_CONTEXT_MANIFEST` ;
- `noCommit=true` ;
- `noGameTime=true`.

Il ne produit aucun paquet IA et n'accorde aucun droit d'exécution. J10-K1 ne
modifie pas les appels existants. J10-K2 sera le premier consommateur éventuel.

## Snapshot commun

Un manifeste référence un unique :

- `snapshotId` ;
- `campaignRevision`, si une campagne révisionnée est concernée ;
- couple `sceneId` et `sceneVersion`, si une scène est concernée.

Une projection déclare sa cohérence :

- `STATIC_VERSIONED` pour un catalogue versionné indépendant du tour ;
- `CAMPAIGN_REVISION` pour une lecture liée à la révision de campagne ;
- `SCENE_REVISION` pour une lecture liée à la scène active.

Une projection de scène est invalide si le manifeste ne porte pas les deux
éléments de la révision de scène. Une projection de campagne est invalide sans
révision de campagne.

## Descripteur de projection

Chaque entrée possède :

- `projectionId`, unique dans le manifeste ;
- `kind`, nature fonctionnelle ouverte par le contrat ;
- `contractVersion` et `ownerId` ;
- `sourceRefs` et `sourceVersion` ;
- `classification` ;
- `allowedRoles` ;
- `consistency` ;
- `dependencyProjectionIds` ;
- `transport` ;
- `serializedCharacters`.

Aucun champ `payload`, texte narratif, valeur de lore, état d'inventaire ou
secret n'appartient au descripteur.

Les dépendances doivent exister, ne peuvent pas se référencer elles-mêmes et
doivent former un graphe sans cycle.

## Classification et transport

| Classification | Sens | Transport autorisé |
|---|---|---|
| `PUBLIC` | information déjà projetée publiquement par son propriétaire | `INLINE_ELIGIBLE` ou `REFERENCE_ONLY` |
| `ROLE_PRIVATE` | information non publique, nécessaire uniquement à un rôle explicitement autorisé | `INLINE_ELIGIBLE` ou `REFERENCE_ONLY` |
| `FORBIDDEN_FOR_AI` | donnée qui ne doit franchir aucune frontière IA | uniquement `FORBIDDEN` |

Une projection interdite doit avoir `allowedRoles=[]`. Une projection
consommable doit autoriser au moins un rôle et ne peut pas utiliser le transport
`FORBIDDEN`.

`REFERENCE_ONLY` signifie que le futur paquet devra pointer vers la projection
canonique ou en produire une vue compacte sans recopier une seconde source
concurrente. Il ne donne toujours aucune autorité métier.

## Profils de rôle actifs

La matrice `NARRATIVE_CONTEXT_ROLE_REQUIREMENTS_V1` déclare sept usages :

| Profil | Rôle | Besoin directeur |
|---|---|---|
| `player-intent-v8` | `player_intent_interpreter` | saisie, scène unique, sélecteurs d'information et capacités ; contexte incarné facultatif selon disponibilité |
| `npc-dialogue-performance` | `npc_performer` | tour résolu, scène, profil public et divulgation ; saisie brute interdite |
| `resolved-scene-render` | `scene_writer` | tour résolu et changements visibles ; aucune réinterprétation du joueur |
| `lore-guided-place-creation` | `scene_creator` | brief, influences et politique de création |
| `missing-public-fact-creation` | `scene_creator` | propriété manquante, politique et sources publiques, sans scène complète |
| `narrative-coherence-review` | `coherence_critic` | candidat, preuves de résolution et invariants |
| `destination-plausibility` | `destination_arbiter` | brief, scène et influences publiques nécessaires à l'arbitrage |

Un même rôle technique peut avoir plusieurs profils, car ses besoins dépendent
du contrat exécuté. Le profil, et non le seul nom du rôle, gouverne la sélection.

Les rôles historiques ou non actifs qui ne possèdent pas encore de profil ne
peuvent pas consommer automatiquement le manifeste. Leur raccord exige une
extension documentée de la matrice.

## Données interdites communes

Les profils actifs interdisent explicitement :

- `PLAYER_PRIVATE_NOTEBOOK` ;
- `GM_SECRETS`.

Les contextes privés de PNJ sont également interdits à l'interpréteur, au
writer, au creator, au critic et au destination arbiter. Le performer peut
recevoir une projection `ROLE_PRIVATE` de son propre acteur uniquement lorsque
son descripteur l'autorise.

La saisie brute est requise uniquement par `player_intent_interpreter`. Elle est
interdite au performer, writer, creator, critic et destination arbiter.

## Politiques par instance

Le manifeste contient des `rolePolicies` qui relient un profil concret aux
`projectionId` présents :

- `requiredProjectionIds` ;
- `optionalProjectionIds` ;
- `forbiddenProjectionIds`.

Une même projection ne peut appartenir à deux catégories dans une politique.
Une projection requise ou facultative doit exister, autoriser le rôle et ne pas
être interdite. Une projection déclarée interdite ne peut simultanément
autoriser ce rôle.

## Déterminisme et isolation

Le constructeur :

- clone snapshot, descripteurs et politiques ;
- trie les projections, profils et listes de références ;
- ne déduplique pas silencieusement une entrée invalide ;
- ne conserve aucune référence mutable vers son entrée.

La validation refuse les doublons au lieu de les masquer. Une mutation de la
source après construction ne modifie pas le manifeste.

## Vérification

```powershell
npm run narration-module:test:j10k1-context-manifest
```

La gate couvre contrat nominal, matrice des rôles, classifications, transports,
propriétaires, snapshot, dépendances inconnues et cycliques, conflits de
politique, interdictions, isolation des entrées, K0, dette lexicale et build du
module.

## Limites jusqu'à J10-K2

- aucun constructeur de requête IA ne consomme encore le manifeste ;
- les tailles sont déclarées par les projecteurs de test, pas recalculées par
  le serveur ;
- aucune projection actuelle n'est supprimée ou compactée ;
- aucun budget n'est appliqué ;
- aucune recette OpenAI live n'est nécessaire à ce contrat passif.
