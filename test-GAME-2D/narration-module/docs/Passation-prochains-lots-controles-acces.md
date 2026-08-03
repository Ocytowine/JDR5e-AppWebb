# Passation : prochains lots des contrôles d'accès

Statut : `PASSATION_ACTIVE_2026-08-03`

Ce document est destiné à la prochaine conversation de travail. Il complète
`TASKS.md` sans le remplacer : `TASKS.md` reste le tableau de bord synthétique,
et cette passation explique comment traiter proprement les cases encore
ouvertes autour des accès libres.

## Point de départ obligatoire

Avant toute modification :

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

### Lot A — reprendre automatiquement un test social

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

### Lot B — fournir les catalogues concrets de campagne

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

### Lot C — approche par perception

Objectif : permettre de chercher une autre entrée, observer le dispositif ou
découvrir une propriété pertinente sans décider arbitrairement du succès.

Réutiliser la résolution perceptive et les tests de compétence existants. Une
observation peut révéler un fait, une nouvelle limite visible ou une faiblesse ;
elle n'ouvre le contrôle que si une autorité monde/accès conclut qu'un état
physique a réellement changé. Une « porte secrète » ne doit pas être créée par
la seule prose de perception.

Prévoir au minimum : rien trouvé, information directe, test requis, nouvelle
approche révélée et contradiction avec l'hypothèse du joueur.

### Lot D — approche par règles

Objectif : traiter crochetage, force, outil, sort ou autre action mécanique.

La règle propriétaire vérifie le personnage, l'équipement réellement détenu,
le dispositif, le DD et le jet. Son résultat peut laisser le seuil contrôlé,
l'ouvrir, le bloquer davantage, consommer une ressource, produire du bruit ou
faire avancer le temps. Toutes ces conséquences doivent appartenir au même
commit ou à un processus causal explicitement repris.

Ne jamais déduire « serrure crochetée » du verbe *crocheter*. Ne pas coder une
liste fermée de solutions : les règles choisissent le domaine compétent à
partir de l'intention structurée et de l'état de scène.

### Lot E — approche tactique

Objectif : appliquer à l'accès un résultat terminal déjà committé par le
plateau tactique.

Le texte « j'attaque le garde » déclenche au mieux un handoff tactique. Seul un
outcome tactique restauré et validé peut modifier les acteurs, le contrôle, le
temps et la scène. Réutiliser les autorités de checkpoint et de retour tactique
existantes ; ne pas créer un second mini-moteur de combat dans la narration.

### Lot F — certification transverse multi-régions

Après les raccords locaux : certifier au moins deux régions et plusieurs types
de seuils. La recette doit couvrir refus, solution alternative, condition,
rechargement, réussite, ouverture puis transition. Une recette OpenAI live ne
vient qu'après les tests déterministes et ne sert qu'à certifier compréhension
et qualité de rendu, jamais les autorités.

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
