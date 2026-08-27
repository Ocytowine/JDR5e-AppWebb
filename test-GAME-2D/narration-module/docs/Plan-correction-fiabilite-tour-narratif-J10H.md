# Plan de correction de la fiabilité du tour narratif J10-H

Statut : `FERMÉ — H0 À H7 CERTIFIÉS`

Date : 2026-08-26

Autorité : ce document détaille l'exécution du lot J10-H ouvert dans
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md).
La consolidation reste l'unique feuille de route globale et `TASKS.md` conserve
seulement l'étape immédiate.

## Motif d'ouverture

La recette OpenAI G8 a confirmé que V8 comprend et route maintenant une
micro-séquence telle que « je m'approche du garde pour le saluer ». Elle a aussi
isolé plusieurs défauts indépendants qui se masquent mutuellement :

- une double soumission UI peut créer deux requêtes distinctes avant le rendu de
  l'état `pending` ;
- les référents récents sont reconstruits, mais aucune conversation active
  explicite ne survit comme telle aux tours, rechargements et changements de
  scène ;
- le planner MJ utilise une limite effective d'une seconde malgré la route
  produit configurée à trente secondes ;
- un timeout du performer dégrade une salutation en réaction générique ;
- la frontière V8 vers les contrats historiques perd une partie de l'acte, de
  la cible et de l'expression originale ;
- le writer peut être sauté dès qu'une parole PNJ existe, même lorsque la mise
  en scène finale reste incomplète ;
- plusieurs diagnostics décrivent la projection historique plutôt que la
  décision propriétaire effectivement exécutée ;
- trois recettes historiques de conversation ne fournissent plus
  d'interpréteur depuis le passage produit à OpenAI seul.

J10-H corrige ces raccords sans introduire de second interpréteur lexical et
sans élargir l'autorité de l'IA.

## Résultat produit attendu

Le parcours suivant doit rester cohérent dans la vraie interface, y compris
après rechargement :

```text
je m'approche du garde et je le salue
→ approche et salutation racontées une seule fois
→ conversation locale active avec le garde

je lui demande si tout va bien
→ « lui » est présenté à OpenAI comme le garde de la conversation active
→ le propriétaire social valide encore la cible et la faisabilité
→ une réponse de garde cohérente est affichée une seule fois
```

Le même focus doit pouvoir aider à comprendre « je lui donne la fiole » ou
« je lui parle de mon hypothèse », mais il ne valide ni transfert d'objet, ni
fait d'intrigue, ni mission, ni relation. Il désigne seulement le référent
public probable ; chaque composante reste décidée par son propriétaire.

## Invariants non négociables

1. OpenAI reste l'unique interpréteur du chemin produit. Aucun mot-clé, regex ou
   classifieur local ne redevient une autorité sémantique.
2. Un focus conversationnel est une mémoire publique de continuité, jamais une
   autorité de succès, de commit, de temps, de secret ou de possession.
3. La saisie originale reste l'expression du joueur. Une reformulation IA peut
   expliquer le sens compris, mais ne remplace pas la voix du personnage.
4. Chaque composante V8 conserve son sens, son ordre, sa cible et sa provenance
   jusqu'au propriétaire et au reçu final.
5. Un double clic, un double événement clavier ou un rechargement ne produit
   jamais deux opérations métier pour une seule soumission humaine.
6. Le fil joueur ne montre aucun terme de moteur, capability, commit, fallback
   ou diagnostic. Les détails restent copiables en mode développeur.
7. Le plafond transversal de trois appels OpenAI facturés par tour demeure.
8. Une panne après commit ne rejoue jamais l'action. Elle produit une narration
   immersive dégradée à partir du résultat autorisé.

## Contrat cible du focus local

J10-H introduira un contrat versionné `local-interaction-focus/1`, projeté dans
le contexte public de l'interpréteur :

```ts
interface LocalInteractionFocusV1 {
  schemaVersion: 1;
  contractVersion: "local-interaction-focus/1";
  sceneId: string;
  sceneVersion: number;
  targetRef: string;
  targetDisplayName: string;
  mode: "DIALOGUE" | "LOCAL_ATTENTION";
  publicSummary: string;
  openedByOperationId: string;
  lastConfirmedOperationId: string;
  status: "ACTIVE" | "CLOSED";
  closureReason:
    | "PLAYER_LEFT"
    | "TARGET_CHANGED"
    | "TARGET_LEFT"
    | "SCENE_CHANGED"
    | "PROCESS_INTERRUPTION"
    | "TACTICAL_HANDOFF"
    | null;
}
```

Le champ sera persisté comme projection/reçu public d'une opération narrative
complétée, puis reconstruit par le contrôleur. L'ajout devra rester compatible
avec les anciennes opérations : absence du champ égale `null`, avec une reprise
bornée depuis les référents historiques lorsque leur provenance suffit. Aucun
secret, profil conversationnel privé, score social ou contenu du carnet joueur
n'entre dans ce contrat.

### Ouverture et mise à jour

- une approche seule peut ouvrir `LOCAL_ATTENTION`, sans inventer un dialogue ;
- une parole adressée et acceptée ouvre ou promeut le focus en `DIALOGUE` ;
- une réponse PNJ acceptée actualise `lastConfirmedOperationId` et le résumé ;
- une clarification, un timeout ou un échec avant résolution ne change pas le
  focus ;
- un commit métier utilisant le même acteur peut actualiser le focus sans
  devenir une preuve de conversation si aucune parole n'a été comprise.

### Fermeture et invalidation

Le focus est fermé par une décision sémantique explicite de départ, un nouveau
destinataire confirmé, la disparition de l'acteur, un changement de scène, une
interruption incompatible ou un handoff tactique. Un changement de `sceneId`
le ferme. Un changement de `sceneVersion` force une nouvelle validation de la
présence du référent, mais ne coupe pas une discussion si le même acteur reste
présent. En cas de deux candidats publics également plausibles, OpenAI doit
demander une clarification ; le runtime ne choisit pas arbitrairement.

## Architecture d'orchestration cible

Le contrôleur distinguera quatre objets au lieu de les confondre :

1. le cadre V8 original, autorité de compréhension ;
2. la projection propriétaire effective, autorité de routage ;
3. les reçus de résolution, autorité des conséquences ;
4. la projection de présentation finale, autorité de ce qui a été affiché.

Le diagnostic devra présenter ces quatre niveaux séparément. Une projection
historique `unclear_intent` ne pourra plus faire croire qu'un tour effectivement
routé et committé était unsupported.

La stratégie de rôles restera dans la limite de trois appels :

| Famille de tour | Séquence cible maximale |
|---|---|
| clarification | interpréteur |
| action locale sans PNJ | interpréteur → planner si nécessaire → writer |
| dialogue simple | interpréteur → performer final |
| dialogue nécessitant une mise en scène planifiée | interpréteur → planner → performer final |
| dialogue avec continuité complexe | interpréteur → performer → critique conditionnel |
| mutation propriétaire puis narration | interpréteur → propriétaire local → writer |

Le choix de la séquence dépendra des capacités et reçus structurés, jamais de
mots présents dans la saisie. Pour un dialogue, le performer final devra pouvoir
produire la réaction et la réplique dans une enveloppe permettant une mise en
scène cohérente. Le `scene_writer` ne sera pas appelé en quatrième position.
Si le performer échoue, le fallback utilisera l'acte structuré, la cible et le
résultat autorisé ; une salutation ne retombera plus sur un `OTHER` vide de sens.

## Impacts anticipés par module

| Module propriétaire | Modification anticipée | Invariant protégé | Régressions obligatoires |
|---|---|---|---|
| UI React | verrou synchrone de soumission, requête stable pendant le vol, fusion par opération | une intention humaine, une opération | double clic, Entrée répétée, Entrée + clic, rechargement pendant le vol |
| Contrôleur/persistance | champ de focus optionnel, reconstruction et fermeture versionnées | reprise compatible et aucun second commit | ancienne sauvegarde, reprise IndexedDB, changement de scène, rejeu |
| Interpréteur V8 | projection `activeInteraction` publique avec provenance et statut | contexte précis sans décision locale du sens | pronom, ellipse, cible explicite concurrente, ambiguïté réelle |
| Social/PNJ | préservation de l'acte, de la cible et du résumé public ; performer cohérent | parole non équivalente à engagement durable | salutation, question, déclaration, refus, changement d'acteur |
| Mission/relation | le focus fournit seulement le destinataire | acceptation, condition et relation restent propriétaires | proposition, refus, condition, reprise sans double mission |
| Compagnons | interlocuteur actif distinct du compagnon contrôlable | autonomie J7 et frontière J8 inchangées | demande, refus, séparation, réunion, départ |
| Inventaire | cible conversationnelle utilisable comme candidat de receveur, puis validation complète J3 | instance, quantité, possession, accès, prix et commit restent inventaire | donner, recevoir, commerce, objet absent, PNJ non autorisé, rejeu |
| Intrigues/connaissances | acteur cible transmis avec sa seule perspective publique | aucun secret ni vérité promue depuis une parole | hypothèse, témoignage, fausse piste, révélation autorisée, changement de témoin |
| Voyage | fermeture ou suspension du focus à la transition ; interaction locale permise pendant une interruption | temps, position, ressources et reprise restent au processus | départ en discussion, interruption, reprise, arrivée, aucun double temps |
| Repos/progression | un processus actif prime sur un ancien focus quand les domaines sont incompatibles | segment, bénéfice et progression restent propriétaires | interruption de repos, reprise, demande sociale sans avancement indu |
| Monde vivant | disparition/déplacement d'acteur invalide le focus | aucune référence vers un acteur absent | évolution hors écran, rafraîchissement de scène, acteur retiré |
| Tactique | fermeture au handoff ; aucune conversion d'un interlocuteur en participant | graine, carte, placement et contrôle restent tactiques | handoff, restauration, compagnon non contrôlable, aucun acteur injecté |
| Récapitulatif/carnet | le focus actif peut apparaître comme situation publique ; carnet toujours exclu | aucune fuite de note ou de contexte privé | récap public, canari carnet, ancienne conversation fermée |

## Lots d'exécution

### J10-H0 — Baseline et tests fiables

- adapter les trois recettes historiques rouges à un fournisseur sémantique V8
  simulé explicitement injecté ;
- ajouter les captures nécessaires pour distinguer cadre V8, projection
  propriétaire, reçus et rendu ;
- figer les reproductions des doublons, timeouts et pertes de cible ;
- ne modifier encore aucun comportement produit.

Sortie : toutes les gates historiques pertinentes sont soit vertes, soit rouges
pour une cause produit nommée et reproductible.

Fermeture du 2026-08-26 : les trois recettes historiques injectent maintenant
une fixture V8 exacte et redeviennent vertes. La gate
`narration-module:test:j10h0-baseline` fige séparément la course UI, le timeout
planner, l'absence d'interlocuteur actif après reload et les contradictions de
projection, sans modifier le code produit ni appeler OpenAI. La preuve est dans
[`Checkpoint-baseline-fiabilite-J10H0.md`](Checkpoint-baseline-fiabilite-J10H0.md).

### J10-H1 — Idempotence de soumission UI

- installer un verrou synchrone avant la création de la requête ;
- conserver l'identité d'une soumission jusqu'à sa terminaison ;
- rendre restauration et erreur post-commit insensibles au rejeu ;
- certifier les quatre gestes de double soumission.

Dépendance : H0.

Fermeture du 2026-08-26 : le formulaire ne crée plus d'identifiant. Un
coordinateur synchrone de surface verrouille d'abord la soumission, persiste le
payload exact jusqu'au rendu final et reprend la même identité après erreur ou
rechargement. Les cinq scénarios navigateur et le build global passent sans
appel OpenAI. La preuve est dans
[`Checkpoint-idempotence-soumission-J10H1.md`](Checkpoint-idempotence-soumission-J10H1.md).

### J10-H2 — Focus local persistant

- figer et valider `local-interaction-focus/1` ;
- le produire uniquement depuis un tour confirmé ;
- le restaurer et le projeter dans le contexte incarné public ;
- implémenter les règles de fermeture et la compatibilité des sauvegardes.

Dépendances : H0 et H1, afin qu'un doublon ne puisse ouvrir deux focus.

Fermeture du 2026-08-26 : `local-interaction-focus/1` est produit depuis les
capacités V8 confirmées, persisté dans le résultat du tour, restauré avec les
anciennes sauvegardes et projeté comme contexte public vers OpenAI. Les
fermetures par cible, présence, scène, départ, processus incompatible et
handoff tactique sont certifiées. La preuve est dans
[`Checkpoint-focus-local-J10H2.md`](Checkpoint-focus-local-J10H2.md).

### J10-H3 — Fidélité V8 jusqu'aux propriétaires

- exposer distinctement le cadre original et la projection effective ;
- conserver l'expression brute pour le bloc personnage ;
- transporter cible, acte, composantes et ordre dans les reçus ;
- remplacer les cibles génériques de scène par la cible validée lorsque le
  contrat l'autorise.

Dépendance : H2 pour utiliser une provenance de cible stable.

Fermeture du 2026-08-26 : `open-semantic-fidelity-receipt/1` distingue le
cadre V8 original de la projection propriétaire effective et conserve
composantes, ordre, cible, acte et provenance. La saisie brute est rattachée au
bloc personnage seulement après la décision propriétaire et ne lui est jamais
transmise. Les nouvelles sorties V8 structurent l'acte de parole sans reprise
lexicale ; les anciennes données restent compatibles. La preuve est dans
[`Checkpoint-fidelite-V8-J10H3.md`](Checkpoint-fidelite-V8-J10H3.md).

### J10-H4 — Orchestration et résilience IA

- supprimer la limite planner d'une seconde et utiliser la politique de route ;
- mesurer et réduire les paquets du performer avant d'augmenter un timeout ;
- définir la séquence de rôles par famille de tour sous le plafond de trois ;
- rendre les fallbacks immersifs et fidèles aux actes structurés ;
- garantir une présentation finale cohérente sans writer en quatrième appel.

Dépendance : H3 pour ne pas optimiser un paquet sémantiquement incomplet.

Fermeture du 2026-08-26 : le planner suit les limites de sa route et n'est plus
dupliqué après un plan V8/G5. `narrative-ai-role-strategy/1` réserve au plus
trois rôles distants par famille. Le paquet performer est mesuré, borné à cinq
tours par acteur et accompagné de `npc-performer-packet-receipt/1`. Toute sortie
PNJ indisponible ou rejetée reçoit un fallback immersif fondé sur l'acte
structuré, séparé d'une performance acceptée et de la mémoire durable. La preuve
est dans
[`Checkpoint-orchestration-resilience-J10H4.md`](Checkpoint-orchestration-resilience-J10H4.md).

### J10-H5 — Diagnostics exacts et non intrusifs

- afficher séparément interprétation, routage, résolution et présentation ;
- attribuer les échecs au bon acteur et au bon rôle ;
- inclure la télémétrie planner ;
- distinguer budget déclaré, tokens réels et limite de sortie ;
- conserver le fil joueur entièrement fictionnel.

Dépendance : H4.

Fermeture du 2026-08-26 : `narrative-technical-diagnostic/1` sépare désormais
le cadre compris, le routage effectif, les reçus de résolution et la
présentation finale. Les échecs sont attribués au rôle et, pour le performer,
à l'acteur concerné. La télémétrie planner traverse le contrôleur et distingue
budgets configurés, usages fournisseur et plafond de sortie. L'ancien ajout de
trace technique dans un bloc du fil a été supprimé ; le diagnostic reste
consultable et copiable uniquement dans le panneau développeur. La preuve est
dans [`Checkpoint-diagnostics-J10H5.md`](Checkpoint-diagnostics-J10H5.md).

### J10-H6 — Certification transverse des propriétaires

- rejouer les gates J3 à J10 concernées ;
- ajouter une matrice composée dialogue → inventaire, dialogue → mission,
  dialogue → intrigue, dialogue → voyage et dialogue → tactique ;
- vérifier secrets, autonomie, temps, ressources, commits et idempotence ;
- exécuter le build complet et les migrations IndexedDB.

Dépendances : H1 à H5.

Fermeture du 2026-08-27 : la matrice composée dialogue vers inventaire,
mission, intrigue, voyage et tactique réunit les preuves propriétaires sans
modifier leurs autorités. Les gates locales et Chromium certifient secrets,
autonomie des compagnons, temps, ressources, commits, idempotence, reprise et
migrations IndexedDB. La commande `narration-module:test:j10h6-certification`
rejoue l'ensemble puis le build complet ; un audit récursif interdit toute
dépendance OpenAI live. Les preuves sont dans
[`Matrice-certification-transverse-J10H6.md`](Matrice-certification-transverse-J10H6.md)
et
[`Checkpoint-certification-transverse-J10H6.md`](Checkpoint-certification-transverse-J10H6.md).

### J10-H7 — Recette OpenAI live finale

- ne la lancer qu'après toutes les gates locales et un nouvel accord explicite ;
- tester approche + salutation, reprise pronominale, changement
  d'interlocuteur et une interaction propriétaire transverse ;
- consigner rôles, latences, tokens, fallbacks, rendu et reprise après reload.

Dépendance : H6. Aucun appel live n'est autorisé par l'approbation du présent
plan seule.

Fermeture du 2026-08-27 : l'accord explicite a été donné et les quatre parcours
passent dans Chromium avec OpenAI réel. La recette a aussi corrigé le plafond
serveur du performer, son effort de raisonnement implicite, la séparation des
statuts du diagnostic, l'orientation sémantique vers un acteur visible et un
doublon de réaction PNJ. Les preuves sont dans
[`Checkpoint-recette-OpenAI-live-J10H7.md`](Checkpoint-recette-OpenAI-live-J10H7.md).

## Risques de migration et retours arrière

- Le champ de focus doit être optionnel dans les anciennes opérations ; aucune
  réécriture globale de la base ne sera exigée.
- Une reconstruction incertaine produit `null`, jamais un interlocuteur inventé.
- Le verrou UI ne doit pas bloquer définitivement la saisie après une erreur ;
  sa libération appartient à un `finally` testé.
- Une réponse distante tardive après timeout ne doit ni écraser la projection
  affichée ni committer une seconde fois.
- Le changement d'orchestration peut modifier la forme des paquets IA ; les
  empreintes, schémas stricts, validateurs serveur et fixtures devront évoluer
  dans le même sous-lot.
- Les contrats J3 à J8 ne changent pas d'autorité. Toute régression exige le
  retrait du changement transversal, pas un assouplissement du propriétaire.

## Définition de terminé

J10-H est fermé lorsque :

- une soumission UI ne peut produire qu'une opération ;
- le focus de conversation survit au rechargement et se ferme sans fuite de
  scène ;
- une salutation puis une question pronominale conservent cible et acte ;
- l'expression joueur, les reçus et les diagnostics ne se contredisent plus ;
- une panne IA après commit donne un rendu immersif sans rejeu ;
- les gates conversation, intrigue, mission, compagnon, inventaire, voyage,
  repos et tactique restent vertes ;
- le plafond de trois appels, l'absence de secrets et les autorités
  propriétaires sont certifiés ;
- `npm run build` et `git diff --check` passent ;
- la recette live finale, si autorisée, est consignée séparément.
