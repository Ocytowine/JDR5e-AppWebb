# Cadrage - Interpretation semantique ouverte

Date : 2026-07-16

Statut : `RETENU_A_CONTRACTUALISER`

## Objet

Ce cadrage reprend l'ecart constate apres I-06X a I-06ZE : le module vise une comprehension libre de la saisie joueur, mais l'implementation actuelle tend encore a transformer trop vite cette comprehension en categories systeme etroites.

La cible produit reste celle de `Pipeline-et-contrats-IA.md` et du journal NAR-009 : le joueur saisit naturellement une parole, une action ou une question; l'IA comprend le sens; le logiciel valide les autorites et les consequences.

## Constat

Les documents fondateurs ne sont pas contradictoires avec une interpretation ouverte :

- `Pipeline-et-contrats-IA.md` separe interpretation, proposition, resolution, commit et affichage.
- `Contrat-interpretation-ia-intention.md` indique que les variations de formulation doivent etre traitees par une interpretation IA structuree, pas par des mots-cles.
- `Cadrage-I06ZE-referents-locaux.md` interdit explicitement le hard code de type `si texte contient porte`.

La tension vient de l'etat prototype :

- `action` sert a la fois de resume semantique et de categorie systeme exploitable;
- les categories canoniques actuelles (`ask`, `open`, `force`, `observe`, `act`) sont trop pauvres pour porter une intention libre;
- le fallback local et certains validateurs restent lexicaux;
- la scene de reference et les referents visibles sont encore relies a des identifiants fixes;
- les tests prouvent surtout des familles de formulations prevues, pas une generalisation semantique ouverte.

## Decision de conception

L'interpretation doit avoir un seul contrat actif, centre sur l'intention semantique libre.

Ce contrat peut contenir plusieurs champs, mais il ne doit pas installer deux chemins conceptuels concurrents ou une version "principale" doublee d'un mode secondaire.

L'interpretation porte :

- ce que le joueur semble vouloir faire, demander ou exprimer;
- le sens central;
- la cible probable;
- le niveau d'engagement;
- les preuves dans le texte joueur;
- les incertitudes;
- les interpretations interdites;
- le statut d'exploitabilite par le runtime courant.

Le runtime ne doit pas reduire l'interpretation a une petite action canonique. S'il ne sait pas encore traiter une intention comprise, il doit le dire explicitement dans un diagnostic exploitable.

Le code ne doit pas comprendre le langage naturel a la place de l'IA. Il doit valider :

- schema, role, version et correlation;
- cible visible ou reference autorisee;
- absence de resultat, secret, consequence ou succes invente;
- compatibilite avec les domaines ouverts;
- clarification si cible, engagement ou portee restent ambigus;
- handoff si le domaine proprietaire n'est pas ouvert.

## Anti-patterns a eviter

Ne pas corriger les echecs de comprehension en ajoutant des listes de formulations :

```text
poignee -> open
serrure -> force
pivoter -> open
porte -> poi:back-room-door
```

Ces listes peuvent sembler utiles localement, mais elles remplacent progressivement la comprehension IA par un parseur fragile.

Ne pas faire de l'enum `action` le centre du contrat d'interpretation. Une enum canonique peut rester comme detail d'exploitation si elle aide le runtime, mais elle ne doit jamais devenir le sens principal.

Ne pas exposer au modele une liste de "parties" d'objet comme substitut de comprehension. Une scene peut decrire ses objets et contraintes, mais le modele doit deduire l'intention depuis le contexte, pas retrouver un mot attendu.

## Forme cible pressentie

Le prochain contrat devra probablement remplacer le centre de gravite actuel par une structure proche de :

```json
{
  "semanticIntent": {
    "kind": "physical_interaction",
    "playerGoal": "actionner le passage ou tenter de l'ouvrir",
    "targetRef": "poi:back-room-door",
    "commitmentEvidence": [
      "met la main sur la poignee",
      "pivote le mecanisme"
    ],
    "uncertainties": [],
    "confidence": "high"
  },
  "runtimeHandling": {
    "status": "SUPPORTED_BY_CURRENT_RUNTIME",
    "reason": "La cible est visible et le runtime de scene peut enregistrer une tentative locale sans resultat cache.",
    "requiredDomain": "scene_resolution",
    "canonicalActionHint": "open"
  }
}
```

Les noms exacts restent a figer. Le principe important est que l'intention semantique est le coeur du contrat. `canonicalActionHint` ou equivalent n'est qu'une aide d'exploitation, jamais la source du sens.

## Erreurs et absence de fallback narratif

En version de test, une application sans IA n'a pas de valeur produit pour l'interpretation libre. Le systeme ne doit donc pas masquer une panne IA par une phrase generique qui donne l'impression que le tour a fonctionne.

Si l'IA d'interpretation est indisponible, invalide ou rejetee, le resultat attendu est un diagnostic explicite :

- etape echouee;
- role IA concerne;
- cause normalisee;
- issues de schema ou d'autorite;
- entree joueur concernee;
- absence de commit et de temps de jeu;
- action de reprise recommandee pour le developpeur/testeur.

Un fallback local peut exister uniquement comme outil de test contractuel isole, pas comme comportement produit qui continue le tour. Il ne doit pas fabriquer une interpretation, une clarification ou une narration de secours en remplacement d'une comprehension IA manquante.

## Effets sur les tests

Les prochains tests ne doivent pas seulement ajouter des phrases autour de `ouvrir`, `forcer` ou `demander`.

La matrice de depart est [`Matrice-cas-I06ZF-interpretation-semantique.md`](Matrice-cas-I06ZF-interpretation-semantique.md).

Ils doivent prouver :

- qu'une intention semantique claire peut etre conservee meme si aucune projection systeme n'est disponible;
- qu'une intention comprise mais non prise en charge produit un diagnostic clair, pas une phrase de facade;
- qu'une sortie IA riche reste non autoritaire;
- qu'une action implicite contextuelle peut etre comprise sans mot-cle central;
- que le code clarifie sur une vraie ambiguite plutot que sur une formulation inhabituelle.

Cas temoin a conserver :

```text
Le personnage est devant la porte du fond.
Je mets la main sur la poignee et pivote le mecanisme.
```

Attendu cible : l'IA peut proposer une intention semantique de manipulation du passage ou tentative d'ouverture; le code valide seulement cible visible, absence de resultat invente et perimetre de resolution.

## Prochaine etape recommandee

Ouvrir un lot de cadrage contractuel avant tout code runtime :

```text
I-06ZF - Interpretation semantique unique
```

Objectif du lot :

- relire `ai-intent-interpretation/1`;
- definir la seule version active du contrat d'interpretation;
- definir les champs semantiques minimaux;
- declasser `action` en detail d'exploitation non central;
- definir les validations locales qui restent purement autoritaires;
- remplacer le fallback produit par un diagnostic d'echec explicite en mode test;
- selectionner les cas de test depuis la matrice I-06ZF, dont des actions implicites sans verbe canonique.

Hors perimetre du lot :

- pas de `mj_planner`;
- pas de resolution sociale mecanique;
- pas de nouveau domaine inventaire, tactique ou repos;
- pas de creation durable automatique;
- pas de dictionnaire lexical pour compenser l'IA.
