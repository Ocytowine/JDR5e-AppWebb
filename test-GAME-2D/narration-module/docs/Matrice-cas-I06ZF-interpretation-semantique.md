# Matrice I-06ZF - Cas d'interpretation semantique

Date : 2026-07-16

Statut : `PROPOSITION_A_CONTRACTUALISER`

Reference : [`Cadrage-interpretation-semantique-ouverte.md`](Cadrage-interpretation-semantique-ouverte.md)

## Objectif

Cette matrice sert a figer les attentes du futur contrat unique d'interpretation semantique avant implementation.

Elle ne cherche pas a couvrir des mots-cles. Elle couvre des intentions naturelles que le systeme doit comprendre sans transformer le texte joueur en parseur lexical.

## Regles de lecture

- `Intention semantique attendue` decrit le sens a conserver.
- `Runtime attendu` decrit ce que l'application peut faire dans le perimetre courant.
- `Interdits` decrit ce que l'IA ou le code ne doivent pas ajouter.
- `Diagnostic attendu` s'applique si l'IA d'interpretation echoue, si sa sortie est invalide ou si le runtime ne sait pas traiter l'intention.

En mode test, une panne IA ne doit pas produire de fallback fictionnel. Elle doit produire un diagnostic explicite sans commit ni temps de jeu.

## Schema cible minimal a deduire

Les cas ci-dessous impliquent au minimum ces familles de champs :

- `semanticIntent.kind` : famille semantique large, non reduite a une commande moteur.
- `semanticIntent.playerGoal` : objectif apparent du joueur.
- `semanticIntent.target` : cible probable ou `null` si elle manque.
- `semanticIntent.commitment` : `none`, `hypothetical`, `conditional`, `committed` ou `unclear`.
- `semanticIntent.evidenceFromInput[]` : preuves textuelles de l'interpretation.
- `semanticIntent.uncertainties[]` : ce qui reste reellement incertain.
- `semanticIntent.forbiddenInterpretations[]` : ajouts interdits.
- `runtimeHandling.status` : `SUPPORTED_BY_CURRENT_RUNTIME`, `UNSUPPORTED_DOMAIN`, `NEEDS_CLARIFICATION`, `AI_INTERPRETATION_FAILED` ou equivalent.
- `runtimeHandling.reason` : raison exploitable par developpeur/testeur.
- `runtimeHandling.noCommit` et `runtimeHandling.noGameTime` quand rien n'est applique.

Les noms exacts seront figes par le contrat. La matrice fixe le comportement attendu.

## Cas cibles

| ID | Entree joueur | Contexte minimal | Intention semantique attendue | Runtime attendu | Interdits |
|---|---|---|---|---|---|
| I06ZF-001 | `Je mets la main sur la poignee et pivote le mecanisme.` | Porte du fond visible devant le PJ. | Manipuler le passage visible, probablement tenter d'ouvrir ou d'actionner la porte. Engagement commis. | Supporte si la scene autorise une action locale bornee; enregistrer seulement la tentative/manipulation sans reveler derriere. | Ne pas exiger le mot `ouvrir`; ne pas annoncer que la porte s'ouvre; ne pas changer de scene. |
| I06ZF-002 | `Je colle l'oreille contre le battant.` | Porte du fond visible. | Ecouter a travers ou contre la porte. Engagement commis. | Si domaine perception non ouvert, diagnostic `UNSUPPORTED_DOMAIN` ou resolution locale non committable; aucun fait cache revele. | Ne pas reveler une conversation derriere; ne pas inventer une presence. |
| I06ZF-003 | `Je glisse les doigts sous le couvercle.` | Coffret visible, ferme. | Manipuler ou tenter d'ouvrir un contenant visible. Engagement commis. | Si contenant non modele dans la scene courante, diagnostic cible non supportee ou clarification si cible absente. | Ne pas inventer le contenu; ne pas transformer en vol sans indice. |
| I06ZF-004 | `Je fais mine de contourner le garde.` | Garde visible pres d'un passage. | Tenter une manoeuvre de positionnement/discretion autour du garde. Engagement commis ou tentative prudente. | Domaine social/discretion/tactique non ouvert : diagnostic de domaine non supporte ou handoff futur, sans resultat. | Ne pas accorder la reussite; ne pas declencher combat automatiquement. |
| I06ZF-005 | `Je leve les mains pour montrer que je ne cherche pas le conflit.` | Garde tendu visible. | Geste social d'apaisement, non verbal. Engagement commis. | Peut enregistrer une expression/attitude bornee si social local ouvert; pas de succes social automatique. | Ne pas faire parler le PJ; ne pas rendre le garde convaincu. |
| I06ZF-006 | `Je laisse trainer mon regard sur les etageres.` | Etagere visible dans la scene. | Observation attentive ou recherche visuelle discrete. Engagement commis. | Si observation locale supportee, rendre une perception visible seulement; sinon diagnostic perception non ouverte. | Ne pas decouvrir un indice non fourni; ne pas creer un objet utile. |
| I06ZF-007 | `Je tends la piece vers la serveuse sans rien dire.` | Serveuse visible; piece disponible non verifiee. | Geste social/offre implicite vers la serveuse. Engagement commis, cible PNJ. | Domaine inventaire/economie non ouvert si monnaie reelle requise; sinon parole/gesture bornes sans transfert. | Ne pas debiter l'inventaire; ne pas faire accepter la serveuse. |
| I06ZF-008 | `Je fais un signe discret au garde.` | Garde visible. | Communication non verbale discrete vers le garde. Engagement commis. | Enregistrer une intention de communication bornee; pas de reaction decisive sans PNJ performer/social. | Ne pas determiner ce que le garde comprend; ne pas inventer un code secret. |
| I06ZF-009 | `Je reste immobile et j'ecoute.` | Scene active, bruit de pluie. | Attendre/ecouter l'environnement immediat. Engagement commis. | Peut produire observation locale sans temps significatif ou demander domaine temps si attente prolongee. | Ne pas faire avancer l'horloge sans validation; ne pas reveler des secrets. |
| I06ZF-010 | `Et si je passais derriere lui ?` | Un PNJ masculin visible. | Question de possibilite/hypothese sur un contournement. Engagement hypothetique. | No commit, no game time; reponse de possibilite ou diagnostic si domaine non ouvert. | Ne pas executer le deplacement; ne pas supposer la cible si plusieurs `lui`. |
| I06ZF-011 | `Je pose deux doigts sur mes levres et je designe la porte.` | Porte visible; PNJ ou compagnon potentiellement present. | Geste demandant silence/attention vers la porte. Engagement commis, cible probable porte et/ou interlocuteur visible. | Si destinataire ambigu, clarification; sinon enregistrer geste borne. | Ne pas faire agir les autres; ne pas supposer un accord. |
| I06ZF-012 | `Je prends une inspiration et j'avance d'un pas.` | Situation tendue. | Micro-deplacement volontaire, possiblement approche prudente. Engagement commis mais cible faible. | Clarification si la direction/cible est necessaire; sinon rendu d'attitude sans mutation importante. | Ne pas choisir une destination; ne pas declencher un piege/combat. |
| I06ZF-013 | `Je fais semblant de ne pas avoir remarque la serrure.` | Serrure visible. | Dissimuler son attention, intention sociale/tactique implicite. Engagement commis. | Domaine deception/social non ouvert : diagnostic non supporte. | Ne pas determiner si quelqu'un est dupe; ne pas inventer observateur cache. |
| I06ZF-014 | `Je rapproche la lanterne du symbole.` | Lanterne et symbole visibles. | Examiner/eclairer un element visible. Engagement commis. | Si inventaire/objet porte non verifie, diagnostic precondition; sinon observation locale. | Ne pas traduire le symbole si non fourni; ne pas creer une magie. |
| I06ZF-015 | `Je hoche la tete, mais je garde la main pres de ma dague.` | Conversation avec PNJ; dague possiblement equipee. | Acceptation ou acquiescement prudent avec posture defensive. Engagement mixte. | Peut enregistrer expression/attitude; inventaire/menace mecanique non ouverte si dague non validee. | Ne pas attaquer; ne pas menacer explicitement si le texte reste implicite. |
| I06ZF-016 | `Je recule lentement sans le quitter des yeux.` | Cible masculine visible et scene tendue. | Retrait prudent tout en surveillant une cible. Engagement commis. | Si positionnement non modele, diagnostic ou rendu d'attitude sans mutation spatiale durable. | Ne pas calculer distance; ne pas provoquer reaction decisive. |
| I06ZF-017 | `Je lui tends la main.` | Un seul PNJ recent ou visible. | Geste social d'accueil, aide ou invitation selon contexte. Engagement commis, cible probable PNJ. | Clarification si plusieurs referents; sinon enregistrer geste social borne. | Ne pas supposer poignee acceptee; ne pas transformer en attaque ou sort. |
| I06ZF-018 | `Je verifie si la pluie a masque nos traces.` | Pluie et sol/traces pertinents dans contexte. | Observation/enquete environnementale. Engagement commis. | Domaine investigation/perception non ouvert : diagnostic ou observation limitee aux faits visibles. | Ne pas conclure sans resolution; ne pas inventer des traces. |
| I06ZF-019 | `Je lui demande simplement pourquoi il bloque le passage.` | Garde ou PNJ bloquant visible. | Parole adressee demandant une raison. Engagement commis. | Speech borne; PNJ performer/social complet non ouvert si reaction decisive. | Ne pas faire repondre avec secret; ne pas accorder cooperation. |
| I06ZF-020 | `Je pourrais peut-etre forcer le mecanisme...` | Mecanisme ou porte visible. | Hypothese ou intention incertaine de forcer/manipuler. Engagement unclear/conditional. | Clarification sans commit ni temps. | Ne pas executer l'action; ne pas supposer engagement. |

## Diagnostics attendus en cas d'echec IA

Si `player_intent_interpreter` ne repond pas, retourne un JSON invalide, echoue la validation ou produit une sortie non exploitable, le tour doit produire un paquet de diagnostic avec au minimum :

```json
{
  "schemaVersion": 1,
  "stage": "PLAYER_INTENT_INTERPRETATION",
  "role": "player_intent_interpreter",
  "status": "FAILED",
  "category": "AI_OUTPUT_INVALID",
  "rawInput": "Je mets la main sur la poignee et pivote le mecanisme.",
  "issues": [
    "payload.semanticIntent.target.ref is missing"
  ],
  "noCommit": true,
  "noGameTime": true,
  "developerSummary": "L'interpretation IA a ete rejetee; aucune resolution narrative n'a ete tentee."
}
```

Le texte exact et les categories restent a figer. Le comportement requis est stable : pas de fallback fictionnel, pas de commit, pas de temps de jeu.

## Criteres de passage au code

Avant implementation :

- le contrat actif d'interpretation est mis a jour;
- le format de diagnostic d'echec est defini;
- les champs semantiques minimaux sont nommes;
- le role de `action` est explicitement reduit a un detail d'exploitation;
- les tests cibles sont selectionnes depuis cette matrice;
- les anciens fallback produits sont identifies pour neutralisation ou transformation en outils de test.
