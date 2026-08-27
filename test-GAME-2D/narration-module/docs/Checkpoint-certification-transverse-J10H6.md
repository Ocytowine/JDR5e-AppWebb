# Checkpoint certification transverse J10-H6

Date : 2026-08-27

Statut : `FERMÉ — SANS APPEL OPENAI LIVE`

## Résultat

Les changements H1 à H5 ne régressent aucune autorité propriétaire certifiée.
La matrice H6 couvre explicitement :

- dialogue vers inventaire ;
- dialogue vers mission/relation ;
- dialogue vers intrigue/connaissance ;
- dialogue vers voyage/temps/monde ;
- dialogue vers handoff tactique.

La campagne locale J9-B enchaîne dans le même contrôleur les dialogues, les
inventaires personnel et externe, les décisions de recrutement, l'intrigue et
le voyage. Sa restauration et ses rejeux critiques restent stables. La
frontière tactique ferme le focus conversationnel, conserve sa graine et ne
résout jamais le combat depuis la narration.

## Invariants certifiés

- les vérités d'intrigue, perspectives PNJ et secrets restent séparés ;
- le carnet privé ne rejoint ni campagne, ni contexte IA, ni réseau ;
- le compagnon reste autonome hors capacité mécanique réelle ;
- inventaire, prix, quantité, possession et ressources restent autoritaires ;
- voyage, repos, monde et tactique n'avancent le temps qu'une fois ;
- commits, checkpoints, reprises et rejeux sont idempotents ;
- le focus local désigne un référent public sans autoriser une conséquence ;
- le diagnostic technique reste hors du fil joueur.

## IndexedDB et navigateur

La gate réelle Chromium valide notamment :

- cinq gestes de double soumission ou de reprise avec une identité unique ;
- vingt contrats cœur et sept contrats bootstrap ;
- commit atomique, panne injectée sans écriture partielle et reprise durable ;
- activation de migration avec sauvegarde ;
- migration invalide, échec après activation et rollback ;
- refus d'une version physique future et reprise des anciennes connexions ;
- campagne J9-C restaurée et rejouée dans IndexedDB ;
- carnet privé sans sortie réseau et récapitulatif strictement consultatif.

J9-C journalise des refus de connexion vers l'API d'enrichissement volontairement
absente. Le test passe par son chemin local prévu ; aucune requête OpenAI réelle
n'est partie.

## Gates

```text
npm run narration-module:test:j10h6-matrix
npm run narration-module:test:j10h6-owners
npm run narration-module:test:j10h6-browser
npm run narration-module:test:j10h6-certification
git diff --check
```

La dernière commande rejoue les propriétaires et Chromium/IndexedDB, puis
exécute le build TypeScript/Vite complet. L'audit de matrice parcourt
récursivement les scripts npm et refuse toute dépendance `openai-live`.

La matrice détaillée est dans
[`Matrice-certification-transverse-J10H6.md`](Matrice-certification-transverse-J10H6.md).

## Suite

J10-H7 est la recette OpenAI live finale. Elle reste interdite sans un nouvel
accord explicite du propriétaire du projet. Son lancement devra mesurer
approche et salutation, reprise pronominale, changement d'interlocuteur et une
transition propriétaire transverse, avec rôles, latences, tokens et fallback.
