# Cohérence des intrigues dynamiques

Dernière mise à jour : `2026-06-30`

Statut : `RETENU` — engagements, solvabilité, indices, perspectives et protocole d'acceptation validés; schémas exécutables à produire avec le runtime.

## Objectif

Permettre à l'IA de créer et faire évoluer des intrigues originales sans improviser rétroactivement leur vérité ni contredire les détails établis dans des scènes antérieures.

Une intrigue cohérente doit rester valide à la fois sur :

- causalité;
- chronologie;
- géographie et accès;
- motivations et capacités des acteurs;
- connaissances, croyances et secrets;
- objets et preuves;
- règles mécaniques;
- événements du monde;
- indices déjà exposés au joueur.

## Engagement narratif

Un engagement narratif est un détail dont la modification future pourrait casser la causalité, une preuve, une révélation ou une préparation narrative.

Tout engagement narratif devient persistant immédiatement, même si :

- le joueur ne l'a pas remarqué;
- il n'est pas encore révélé;
- il n'a été utilisé que dans une seule scène;
- sa fonction future reste cachée.

Sont notamment des engagements :

- vérité centrale et faits cachés;
- responsables, mobiles, moyens et accès;
- chronologie et alibis;
- preuves et traces objectives;
- indices accessibles;
- témoignages, mensonges et fausses pistes;
- connaissances et secrets des acteurs;
- objets, lieux ou détails préparant un effet futur;
- impossibilités nécessaires à la logique de l'intrigue.

La persistance dépend donc de l'importance causale autant que de l'attention du joueur.

## Modèle conceptuel d'une intrigue

```text
Intrigue
 ├─ vérité centrale
 ├─ événements réellement survenus
 ├─ chronologie causale
 ├─ acteurs, mobiles, capacités et accès
 ├─ faits cachés et invariants
 ├─ preuves objectives
 ├─ indices et conditions d'accès
 ├─ témoignages, mensonges et croyances
 ├─ fausses pistes
 ├─ connaissances par acteur
 ├─ révélations déjà produites
 ├─ engagements narratifs
 └─ espaces de variation encore libres
```

Ce modèle est un graphe de contraintes et de causalité, pas un scénario textuel imposant l'ordre des actions du joueur.

## Ce qui est verrouillé et ce qui reste libre

### Verrouillé à la création ou au premier engagement

- vérité centrale;
- causalité principale;
- chronologie nécessaire;
- acteurs indispensables;
- mobiles et moyens indispensables;
- impossibilités structurantes;
- premiers indices nécessaires à la solvabilité;
- toute information déjà exposée ou préparée.

### Libre tant qu'aucun engagement ne le contraint

- mise en scène;
- formulations;
- témoins et figurants secondaires;
- complications compatibles;
- modes d'accès alternatifs aux indices;
- réactions aux actions du joueur;
- conséquences nouvelles ne contredisant pas les invariants.

La liberté diminue localement à mesure que des détails sont établis. Elle ne diminue pas arbitrairement sur les parties de l'intrigue encore ouvertes.

## Vérité, indice et fausse piste

- Une preuve objective est reliée à un fait vrai et à une cause.
- Un indice est une information perceptible permettant une inférence, sans nécessairement révéler toute la vérité.
- Un témoignage est une affirmation attribuée à un acteur avec sa connaissance, sa croyance ou son intention de mentir.
- Une fausse piste est une croyance, un mensonge, une ambiguïté ou une interprétation plausible; elle n'est jamais enregistrée comme fausse vérité objective.
- Une hypothèse du joueur reste subjective jusqu'à confirmation par des faits.

## Flux de création et d'évolution

1. L'IA propose un noyau d'intrigue structuré.
2. Les domaines vérifient les ancres, capacités, accès, temps et faits existants.
3. Le système valide et commit la vérité centrale, les invariants et les premiers engagements cachés.
4. L'IA met en scène uniquement la portion révélable.
5. Chaque nouvelle scène propose ses nouveaux engagements avant affichage.
6. Les engagements sont contrôlés contre le graphe existant.
7. Les mutations et révélations validées sont committées.
8. Le contexte futur reçoit une projection pertinente du graphe, pas l'intégralité de l'intrigue.

Le coupable, la cause ou la vérité ne peuvent pas être choisis rétroactivement après observation des choix du joueur si des engagements antérieurs les contraignent déjà.

## Contrôles de cohérence

### Contrôles structurés

- ordre des causes et effets;
- compatibilité des temps et durées;
- présence, déplacement et accès des acteurs;
- possession et déplacement des objets;
- capacité réelle d'accomplir une action;
- connaissance d'une information avant son utilisation;
- compatibilité avec les faits et événements existants;
- respect des invariants et des droits de révélation.

### Contrôle sémantique

Un passage IA de critique peut rechercher :

- motivations incohérentes;
- contradictions implicites;
- explications artificielles;
- indices sans cause;
- révélations impossibles à déduire;
- fausses pistes injustes ou indiscernables d'une erreur du système.

Ce contrôle complète les validations structurées; il ne les remplace pas et ne modifie rien sans nouvelle proposition validée.

## Correction d'une incohérence

Avant affichage, une proposition incohérente est corrigée ou régénérée localement.

Après affichage et commit :

- l'engagement n'est pas réécrit silencieusement;
- une erreur technique doit être signalée et réparée par une correction tracée;
- une contradiction volontaire dans l'univers doit être représentée comme mensonge, croyance ou information incomplète seulement si cela était encore causalement possible;
- l'IA ne transforme pas automatiquement une erreur en « twist » pour la masquer.

## Projection dans le contexte IA

Une scène liée à une intrigue reçoit :

- invariants concernés;
- faits et événements pertinents;
- connaissances et croyances des acteurs présents;
- indices accessibles dans la situation;
- engagements déjà exposés;
- secrets nécessaires au rôle MJ;
- espaces de variation encore autorisés.

Les secrets non nécessaires et les branches sans rapport restent hors du paquet afin de maîtriser sa taille et le risque de fuite.

## Solvabilité et équité

Une intrigue peut être difficile, urgente ou coûteuse sans devenir insoluble par accident de génération.

### Révélations indispensables

Toute conclusion nécessaire à la compréhension ou à la résolution possède au moins deux voies d'accès indépendantes au moment de la création de l'intrigue.

Deux voies sont indépendantes lorsqu'elles ne dépendent pas toutes les deux du même acteur, objet, lieu inaccessible ou événement unique. Elles peuvent demander des compétences, coûts ou risques différents.

Exemples :

- témoignage d'un docker ou registre de livraison;
- analyse d'une blessure ou découverte de l'arme;
- obtenir un mandat ou gagner l'aide d'un archiviste;
- suivre une piste matérielle ou confronter une contradiction chronologique.

### Effet d'un échec

Échouer peut :

- fermer une voie;
- augmenter son coût;
- retarder l'accès;
- alerter un acteur;
- dégrader une relation;
- faire évoluer le monde;
- transformer la nature de la preuve disponible.

Un échec généré par le système ne supprime pas silencieusement toutes les voies vers une révélation indispensable. Si le joueur détruit volontairement une preuve, élimine un témoin ou ignore durablement l'intrigue, l'insolvabilité éventuelle devient une conséquence causale assumée et traçable.

### Fausses pistes

Une fausse piste doit pouvoir être réfutée ou relativisée par des faits accessibles. Elle ne peut pas reposer sur une contradiction arbitraire dont le système serait seul à connaître la solution.

La réfutation peut être difficile ou tardive, mais ses conditions existent dans le graphe dès que la fausse piste devient un engagement.

### Évolution sans le joueur

Une intrigue ignorée peut évoluer, perdre certaines opportunités ou se résoudre par le monde. Cette évolution respecte la chronologie, les capacités des acteurs et les voies encore existantes. Elle ne suspend pas artificiellement toutes ses conséquences jusqu'au retour du joueur.

### Portée de la garantie

La garantie porte sur la cohérence et l'existence de voies suffisantes, pas sur leur révélation automatique. Le joueur doit toujours observer, raisonner, choisir et accepter les risques de ses actions.

## Traçabilité dans les ateliers

| Atelier | Travail obligatoire sur les intrigues |
|---:|---|
| 4 — Créations dynamiques | Cycle de création, engagements, types de détails et promotion immédiate |
| 5 — Mémoire | Conservation, activation et rappel des engagements anciens |
| 6 — Dossier de scène | Projection du sous-graphe pertinent et séparation des secrets |
| 7 — Pipeline IA | Contrat de proposition, validation et critique sémantique |
| 9 — Temps et monde | Chronologie, évolutions hors écran et conséquences différées |
| 10 — Résilience | Correction sans retcon silencieux et diagnostic des contradictions |
| 12 — Acceptation | Intrigue longue, indices, fausses pistes, retour tardif et contradiction tentée |

## Questions restant à traiter

- Niveau minimal de préparation d'une intrigue simple, standard ou épique.
- Évolution d'une intrigue ignorée ou résolue par le monde.
- Gestion de plusieurs intrigues partageant acteurs, lieux ou preuves.
- Politique d'abandon, clôture et archivage des engagements.
