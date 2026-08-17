# Passation : prochains lots des contrôles d'accès

Statut : `ARCHIVE — LOTS_A_A_F_TERMINÉS_2026-08-04`

Ce document conserve la méthode et les décisions des lots d'accès désormais
fermés. Il ne définit plus aucune prochaine étape. L'ordre actuel appartient
uniquement à
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md).

## Point de départ historique des lots A à F

Au début de ces lots, la reprise imposait de :

1. lire le `AGENTS.md` racine, `README.md` et `TASKS.md` ;
2. exécuter `git status --short --branch` et préserver toutes les modifications
   locales déjà présentes ;
3. lire cette passation, puis uniquement les contrats du lot choisi ;
4. confronter les documents au code actuel et à `package.json` ;
5. ne créer aucun commit Git sans demande explicite du propriétaire.

Pour comprendre le scénario fonctionnel complet, lire aussi :

- [`Guide-personnel-scenario-fonctionnement-global.md`](Guide-personnel-scenario-fonctionnement-global.md) ;
- [`Recette-transverse-temoignages-lieu-acces.md`](Recette-transverse-temoignages-lieu-acces.md) ;
- [`Contrat-acces-par-inventaire.md`](Contrat-acces-par-inventaire.md) ;
- [`Contrat-acces-social.md`](Contrat-acces-social.md).

## État réellement livré

Le socle distingue désormais cinq choses qui ne doivent plus être fusionnées :

1. l'existence plausible d'un lieu ;
2. sa matérialisation persistante ;
3. l'existence d'une connexion ou d'un seuil ;
4. l'état du contrôle d'accès ;
5. l'approche choisie librement par le joueur.

Les approches inventaire et sociale disposent d'une autorité locale, d'un
adaptateur narratif et de tests. Inventaire vérifie une possession réelle,
conserve ou consomme l'exemplaire et ouvre atomiquement le contrôle. Social
enregistre la parole et produit `GRANTED`, `DENIED`, `CONDITION_OFFERED` ou
`CHECK_REQUIRED`; seule la première décision peut ouvrir le passage.

Fichiers d'entrée principaux :

- `src/application/accessControl.ts` : état du seuil et routage libre ;
- `src/application/accessControlAuthority.ts` : persistance propriétaire du
  contrôle ;
- `src/application/inventoryAccessAuthority.ts` et
  `catalogInventoryAccessRuntime.ts` : approche inventaire ;
- `src/application/socialAccessAuthority.ts` et
  `catalogSocialAccessRuntime.ts` : approche sociale ;
- `src/application/NarrativeTurnController.ts` : composition dans le tour ;
- `tests/scene/verify-inventory-access-authority.ts` ;
- `tests/scene/verify-social-access-authority.ts` ;
- `tests/scene/verify-transverse-testimony-place-access.ts`.

Ces moteurs sont injectables. Ils ne signifient pas que toutes les campagnes
possèdent déjà un mandat, une grille gardée ou une politique sociale. Le
contenu concret doit toujours être fourni par un paquet de campagne ou une
autorité propriétaire.

## Invariants à ne jamais affaiblir

- L'IA comprend et rédige ; elle ne crée ni possession, ni permission, ni
  résultat de dé, ni commit.
- Une parole de joueur ou de PNJ n'est pas une autorisation.
- Un témoignage produit `HEARD`, jamais automatiquement `CONFIRMED`.
- `CONDITION_REQUIRED` ne doit pas redevenir un verdict d'existence. Une
  condition appartient à l'accès ou à un processus propriétaire.
- Atteindre le seuil, l'ouvrir et le franchir sont trois actions différentes.
- Une ouverture ne téléporte jamais le personnage.
- Les exigences privées ne doivent pas apparaître dans le rendu joueur.
- Les approches déclarées ne forment jamais une liste exhaustive.
- Chaque mutation est validée par son domaine, commitée atomiquement et
  rejouable par idempotence.
- Le maximum reste de trois appels OpenAI facturés pour tout l'échange,
  reprises comprises. Les prochains lots doivent être locaux et ne nécessitent
  aucun nouveau rôle IA.
- Un adaptateur spécialisé ne doit pas capturer les actions ordinaires de son
  domaine lorsqu'aucun seuil compatible n'est présent.

## Ordre recommandé des prochains lots

### Lot A — reprendre automatiquement un test social — LIVRÉ LE 2026-08-04

Objectif : lorsqu'une négociation retourne `CHECK_REQUIRED`, proposer le jet,
conserver le lien avec la tentative sociale puis appliquer son résultat sans
demander au joueur de reformuler sa demande.

À lire avant modification :

- [`Contrat-acces-social.md`](Contrat-acces-social.md) ;
- [`Contrat-resolution-tests-competence.md`](Contrat-resolution-tests-competence.md) ;
- `src/application/pendingSkillCheckResume.ts` ;
- `src/application/skillCheckProposal.ts` ;
- `src/application/skillCheckResolution.ts` ;
- `src/application/skillCheckOutcomePreparation.ts` ;
- `src/application/skillCheckOutcomeCommit.ts` ;
- les méthodes `rollPendingSkillCheck` et `restorePendingSkillCheck` du
  contrôleur narratif.

Méthode recommandée : généraliser la reprise aujourd'hui orientée perception
par un contexte propriétaire typé, sans dupliquer le moteur de dés. Le contexte
doit transporter au minimum `resolutionRef`, `accessControlRef`, acteur joueur,
interlocuteur, proposition de test et opération source. Après le jet, le domaine
social transforme le résultat mécanique committé en `GRANTED` ou `DENIED` ; le
dé ne modifie jamais directement le registre d'accès.

Critères de fermeture :

- rechargement possible entre la proposition et le jet ;
- un même jet ne peut être appliqué deux fois ;
- réussite et échec sont tous deux persistés et rendus ;
- aucune reformulation joueur ni second appel IA ;
- l'ouverture et la tentative sociale sont causalement traçables ;
- test navigateur local du bouton de jet si cette surface est modifiée.

Résultat : le contexte en attente est propriétaire, le d20 reste unique et
persistant, puis le domaine social applique `GRANTED` ou `DENIED` dans le même
commit que le temps et l'ouverture éventuelle. Réussite, échec, rechargement
et rejeu sont couverts sans reformulation ni appel IA. La surface du bouton
n'a pas changé.

### Lot B — fournir les catalogues concrets de campagne — TERMINÉ

Objectif : permettre à une vraie campagne d'injecter les politiques et
résolveurs actuellement abstraits.

À produire par contenu concerné :

- contrôle stable attaché à une connexion réelle ;
- mapping entre seuil et acteur habilité à répondre ;
- politique sociale et réponses autorisées ;
- définitions et alias stables des objets acceptés ;
- registre des justificatifs actifs, révoqués, détenteurs et périmètres ;
- sources de lore ou de règles versionnées.

Commencer par un seul parcours jouable dont le lore soutient réellement les
données. Ne pas ajouter artificiellement un mandat aux Archives uniquement
pour faire passer une recette. Un objet absent de `character.state` reste
absent, même si le joueur le nomme.

Critères de fermeture : création ou reprise de campagne, résolution réelle,
rechargement, puis franchissement dans une opération séparée. Ajouter une
recette navigateur déterministe avant toute certification OpenAI facturée.

Résultat : la campagne installe le contrôle stable de la connexion
`lore:caserne_centrale:connection:2`. L'officier de quart est l'acteur social
habilité ; une persuasion difficile peut accorder une audience sous sa
responsabilité. L'autre voie accepte uniquement l'ordre
`obj_ordre_passage_tharqual`, réellement présent et couvert par un justificatif
actif du bon détenteur et du bon périmètre. Le registre installé commence vide
et aucune possession n'est ajoutée au personnage.

La recette `npm run narration-module:test:campaign-access-lot-b` couvre
création, positionnement explicite au seuil lore, objet annoncé mais absent,
test social déterministe, ouverture atomique, rechargement puis traversée dans
un tour séparé. Aucun appel OpenAI facturé n'est utilisé.

### Lot C — approche par perception — TERMINÉ

Objectif : permettre de chercher une autre entrée, observer le dispositif ou
découvrir une propriété pertinente sans décider arbitrairement du succès.

Réutiliser la résolution perceptive et les tests de compétence existants. Une
observation peut révéler un fait, une nouvelle limite visible ou une faiblesse ;
elle n'ouvre le contrôle que si une autorité monde/accès conclut qu'un état
physique a réellement changé. Une « porte secrète » ne doit pas être créée par
la seule prose de perception.

Prévoir au minimum : rien trouvé, information directe, test requis, nouvelle
approche révélée et contradiction avec l'hypothèse du joueur.

Résultat : la scène installée de la Caserne centrale porte maintenant des
indices sourcés sur le seuil vers le Château Tharqual. Le runtime local
distingue regard, examen attentif et recherche active. La réussite du jet peut
révéler que l'officier de quart constitue une approche possible ; elle ne crée
aucune entrée et laisse le contrôle `CONTROLLED`. Les identités de perception
et de reprise ont été compactées de manière déterministe pour respecter les
limites des commits de campagne réels.

Les tests `narration-module:test:access-perception` et
`narration-module:test:campaign-access-lot-c` couvrent les cinq issues, le jet,
le rechargement et l'absence d'ouverture arbitraire, sans appel OpenAI facturé.

### Lot D — approche par règles — TERMINÉ

Objectif : traiter crochetage, force, outil, sort ou autre action mécanique.

La règle propriétaire vérifie le personnage, l'équipement réellement détenu,
le dispositif, le DD et le jet. Son résultat peut laisser le seuil contrôlé,
l'ouvrir, le bloquer davantage, consommer une ressource, produire du bruit ou
faire avancer le temps. Toutes ces conséquences doivent appartenir au même
commit ou à un processus causal explicitement repris.

Ne jamais déduire « serrure crochetée » du verbe *crocheter*. Ne pas coder une
liste fermée de solutions : les règles choisissent le domaine compétent à
partir de l'intention structurée et de l'état de scène.

Résultat : `rules` est maintenant un domaine sémantique et un propriétaire de
résultat de test. La campagne installée propose Force (Athlétisme), DD 20, sur
le dispositif réel de la Caserne. La tentative est persistée avant le jet ; le
résultat committé porte six secondes, un bruit fort et l'ouverture ou le
maintien du contrôle. Le crochetage sans définition concrète d'outils de
voleur est refusé sans tentative, temps ni possession inventée.

Les tests `narration-module:test:rules-access` et
`narration-module:test:campaign-access-lot-d` couvrent échec, équipement
absent, rechargement avant jet, réussite, bruit, temps et restauration, sans
appel OpenAI facturé.

### Lot E — approche tactique — TERMINÉ

Objectif : appliquer à l'accès un résultat terminal déjà committé par le
plateau tactique.

Le texte « j'attaque le garde » déclenche au mieux un handoff tactique. Seul un
outcome tactique restauré et validé peut modifier les acteurs, le contrôle, le
temps et la scène. Réutiliser les autorités de checkpoint et de retour tactique
existantes ; ne pas créer un second mini-moteur de combat dans la narration.

Résultat : le seuil réel Caserne centrale → Château Tharqual accepte maintenant
le domaine `tactical`. L'intention hostile committe uniquement une graine et un
processus de handoff. Le plateau existant produit et restaure son checkpoint,
puis son outcome brut propose séparément les conséquences personnage et accès.
L'autorité du seuil confronte la condition terminale à la politique installée :
la victoire ouvre le passage et lève ses exigences ; la défaite maintient le
contrôle. L'intégration avance le temps, applique les deltas une seule fois et
rend la conséquence dans le fil narratif.

Les tests `narration-module:test:tactical-access` et
`narration-module:test:campaign-access-lot-e` couvrent défaite, absence de
mutation avant outcome, handoff, ouverture réelle de `GameBoard`, checkpoint,
rechargement, victoire, temps, ouverture, projection et rejeu.

### Lot F — certification transverse multi-régions — TERMINÉ

Le catalogue jouable installe désormais le seuil militaire de Tharqual en
Ylsséa et un obstacle naturel canonique en Ardherne. La recette
`narration-module:test:campaign-access-lot-f` couvre l'objet réellement détenu
mais refusé par sa politique, l'alternative Force/Athlétisme, l'exigence
physique et le test en attente, le rechargement, la réussite, l'ouverture sans
téléportation, la traversée séparée et la restauration de la destination. Elle
prouve aussi que l'ouverture d'Ardherne ne modifie pas le contrôle de Tharqual.

La matrice détaillée est
[`Matrice-certification-controles-acces-multi-regions.md`](Matrice-certification-controles-acces-multi-regions.md).
Les lots A à F sont clos localement et de manière déterministe. La recette
navigateur OpenAI suivante est également certifiée en live : ordre, unicité et
plafond des rôles sur action, dialogue, observation, transition et
clarification. Elle reste une preuve de compréhension et de rendu, jamais une
autorité métier. À la fermeture de cette passation, l'étape alors envisagée
était de définir avec chaque propriétaire les commandes joueur absentes de
l'ontologie sémantique : inventaire, progression, bastion et tactique générique.
Cette indication est historique ; elle ne fixe plus l'ordre du développement.

## Méthode commune pour chaque lot

1. Définir ou compléter le contrat près du code avant d'élargir le contrôleur.
2. Nommer le domaine propriétaire et les preuves qu'il doit relire.
3. Écrire les cas négatifs en premier : prose seule, mauvaise cible, preuve
   absente, résultat périmé, rejeu et secret.
4. Implémenter une commande structurée et une autorisation structurée.
5. Préparer les effets hors transaction, puis committer atomiquement sous une
   opération et une empreinte stables.
6. Ajouter un adaptateur `canHandle` étroit au seuil et à la scène active.
7. Rendre uniquement le résultat committé, avec des `sourceRefs` révélables.
8. Tester l'autorité seule, l'adaptateur, le contrôleur, la recette transverse
   et le rechargement.
9. Mettre à jour le contrat, le guide personnel et `TASKS.md` sans déclarer
   disponible une fonction seulement projetée.
10. Exécuter les tests ciblés, `git diff --check`, relire le diff, puis lancer
    `npm run build` depuis `test-GAME-2D/`.

## Conseils à la prochaine conversation ChatGPT

- Traiter un lot à la fois et annoncer clairement sa frontière au propriétaire.
- Faire un audit du code avant de proposer une nouvelle abstraction : plusieurs
  briques nécessaires existent déjà sous des noms spécialisés.
- Préférer un port propriétaire injectable à une décision codée dans le
  contrôleur narratif.
- Ne pas masquer une intégration manquante avec une réponse narrative
  convaincante. Un handoff explicite est plus sûr qu'un faux succès.
- Ne pas multiplier les agrégats si un registre propriétaire existant porte
  déjà la bonne identité ; ne pas fusionner des domaines seulement pour réduire
  le nombre de fichiers.
- Préserver le travail local très étendu de la branche actuelle. Ne jamais
  utiliser de reset destructeur et ne modifier aucun fichier généré à la main.
- Si une recette OpenAI live est envisagée, demander l'accord avant la dépense
  et vérifier d'abord que les tests locaux couvrent l'autorité recherchée.
- À la fin du lot, dire précisément ce qui est fermé et ce qui reste seulement
  injectable, non configuré ou non certifié dans une campagne réelle.

## Commandes de non-régression minimales

```text
npm run narration-module:test:social-access
npm run narration-module:test:inventory-access
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:access-control
npm run narration-module:test:transverse-testimony-place-access
npm run narration-module:test:scene-transition
npm run narration-module:test:ai-call-budget
npm run build
```

Ajouter les tests du domaine traité, notamment compétences, perception ou
tactique, avant de considérer le lot comme fermé.
