# Contrat d'accès social

Statut : `SOCLE_RUNTIME_CERTIFIE_LOCAL_2026-08-03`

Ce contrat traite une approche adressée à un interlocuteur qui contrôle ou
représente un seuil. Il complète l'enregistrement des paroles : une phrase du
joueur reste une tentative sociale et n'accorde jamais elle-même un succès.

## Résultats autoritaires

Le propriétaire `SOCIAL_ACCESS_DOMAIN` peut produire exactement l'un de ces
résultats :

- `GRANTED` : la permission sociale est satisfaite et l'accès peut devenir
  `OPEN` si aucune autre exigence ne reste active ;
- `DENIED` : la demande est refusée et l'accès reste `CONTROLLED` ;
- `CONDITION_OFFERED` : l'interlocuteur formule une condition référencée, sans
  considérer qu'elle est déjà remplie ;
- `CHECK_REQUIRED` : une proposition de test est référencée, sans inventer son
  jet ni son résultat.

## Séquence

1. Le contrôleur constate une parole engagée devant un seuil social compatible.
2. Le résolveur de cible établit quel acteur répond réellement. Une cible
   absente ou ambiguë arrête la voie sociale.
3. L'autorité sociale relit le contrôle et décide selon la politique de la
   campagne. L'IA ne possède pas cette décision.
4. La parole exacte, l'interlocuteur, le résultat, l'heure et les sources sont
   enregistrés dans le registre des tentatives sociales.
5. Seul `GRANTED` peut modifier les exigences et l'état du contrôle, dans le
   même commit que la tentative.
6. La réponse autorisée de l'interlocuteur est affichée. L'ouverture ne déplace
   pas le personnage ; le franchissement reste une action séparée.

## Garanties

- Un refus, une condition ou un test requis ne modifient pas l'accès.
- L'acteur qui répond doit être exactement celui visé par la commande.
- Une autorisation invalide n'enregistre aucune tentative.
- Les références de résolution sont uniques et le rejeu est idempotent.
- La réponse visible provient de l'autorité sociale ; une prose libre ne peut
  pas convertir un refus en accord.
- L'heure vient de `world.clock` et aucun temps de jeu n'est avancé.
- La voie locale ne crée aucun appel IA et reste sous le plafond transversal de
  trois appels facturés.

## Limites de composition

Le moteur, l'adaptateur de scène et le raccord au contrôleur sont disponibles.
Une campagne doit fournir le mapping seuil/interlocuteur et sa politique
sociale concrète. `CHECK_REQUIRED` conserve une référence propriétaire, mais
le raccord automatique entre le résultat du dé et la reprise de cette
négociation reste un lot séparé ; aucun succès n'est accordé en attendant.

## Preuves

```text
npm run narration-module:test:social-access
npm run narration-module:test:narrative-turn-controller
```
