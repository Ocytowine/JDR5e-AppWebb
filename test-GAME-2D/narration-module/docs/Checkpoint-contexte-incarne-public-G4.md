# Checkpoint G4 — contexte incarné public

Date : 2026-08-25  
Statut : `FERMÉ`

## Résultat

Le contrat `interpreter-embodied-public-context/1` fournit à l'interpréteur V8
un contexte unique, reconstruit à chaque tour et inclus dans l'empreinte :

- identité, espèce, historique, biographie, personnalité, objectifs, défauts et
  description physique explicitement publics ;
- langues, actions, sorts, capacités cataloguées et objets nommables, tous
  marqués `REFERENCE_ONLY` sans quantité, contenant ni disponibilité ;
- connaissances acquises avec leur statut épistémique et attribution ;
- scène courante et acteurs visibles ;
- interlocuteur actif, trois focus et quatre intentions récentes ;
- compagnons présents, capacités publiques du runtime et processus de voyage
  actif, notamment une interruption en attente de décision.

Pour V8, les anciens blocs `characterContext`, `playerPublicContext`,
`recentSemanticTurns`, `activeDialogueTarget`, `runtimeContext` et
`activeCompanionRefs` ne sont plus envoyés séparément. Cette absence de
duplication garde le prompt plus lisible et évite des divergences entre deux
projections du même état.

## Bornes et confidentialité

La projection plafonne les références, acteurs, faits, ambiguïtés et souvenirs
récents. Les textes libres publics sont normalisés et tronqués. `knownToPlayer`
n'est jamais copié : seules les quatre clés publiques nommées sont lues.

Restent exclus : caractéristiques et valeurs mécaniques, ressources, charges,
prix, inventaires tiers, secrets de campagne, connaissances privées d'autres
acteurs, pensées ou relations cachées des PNJ, historique non borné, carnet
privé joueur et toute autorité de succès, commit, temps ou routage.

Une capacité issue de `privateMechanical.featureIds` n'est nommable que si un
catalogue public injecté fournit son libellé. Un identifiant non catalogué reste
absent. Le chemin UI installé injecte désormais le catalogue public réel des
aptitudes ; seuls l'identifiant, le libellé et les alias sont projetés, jamais
leurs règles ou valeurs mécaniques.

## Preuve exécutable

```text
npm run narration-module:test:interpreter-embodied-context-g4
```

La gate vérifie le profil public, un sort, un objet rangé, une connaissance
acquise, le dernier interlocuteur, les focus récents, un compagnon et un voyage
interrompu. Quatre canaris — mécanique, intrigue, mémoire récente privée et
carnet — restent absents du contexte puis de la requête IA. Une modification de
l'objectif public change l'empreinte.

Régressions vertes : G1, G3, route OpenAI, interprétation IA, garde de dette
lexicale et build complet. Le test `player-public-context` retrouve le défaut de contrôleur déjà
lié au chemin d'interprétation historique : sa réponse contextuelle attendue est
vide. G4 ne modifie ni le classifieur de cette réponse ni son rendu.

Aucun appel OpenAI réel n'a été exécuté et aucune dépense distante n'a été
engagée.
