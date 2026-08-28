# Contrat de divulgation d'information PNJ J10-I5

Statut : `ACTIF`

Contrat : `npc-information-disclosure/1`

## But

La divulgation répond à une question distincte : parmi les informations
résolues et connues de l'acteur, lesquelles peuvent devenir le contenu d'une
réponse ? Elle ne recherche aucun fait, n'accorde aucune connaissance, ne
formule aucune réplique et ne commite rien.

```text
faits résolus I2/I4 + connaissance I3
                  +
perspectives, croyances et résolutions propriétaires
                  │
                  ▼
       décision de divulgation I5
                  │
     ┌────────────┼──────────────┐
     ▼            ▼              ▼
fait autorisé   refus scellé   orientation crédible
```

## Décisions

- `ANSWER_DIRECTLY` : fait objectif public connu ;
- `ANSWER_QUALIFIED` : croyance ou incertitude attribuée à l'acteur ;
- `WITHHOLD_PROTECTED` : fait connu mais protégé par son propriétaire ;
- `REDIRECT_CREDIBLY` : l'acteur ignore la réponse, mais une alternative
  structurée couvre exactement la propriété et la forme demandées ;
- `ACTOR_DOES_NOT_KNOW` : ignorance réelle ou aucune information résolue.

Chaque décision possède une cause stable : fait public connu, croyance,
incertitude, protection propriétaire, ignorance, absence de fait ou alternative
crédible. Une limite de rôle n'est jamais une cause de refus. Si I3 établit une
autre base de connaissance, notamment `ACQUIRED`, le fait public reste
répondable.

## Raccord aux propriétaires existants

Le contexte privé I5 consomme directement :

- `ActorClaimPerspectiveV1` pour `BELIEVED` et `UNCERTAIN` ;
- `DurableSocialBeliefV1` pour les croyances sociales héritées ;
- `ObjectiveClaimResolutionV1` pour sceller les `factRefs` dont la visibilité
  est `ACTOR_SCOPED` ou `SYSTEM_PRIVATE` ;
- des alternatives explicites avec acteur, propriétés, formes de réponse et
  référence publique justifiant l'orientation.

`loadNpcDisclosureOwnerContextV1` compose ces données depuis les registres
persistants de perspectives, d'état social et de résolution objective. Une
erreur de lecture propriétaire n'est jamais transformée en ignorance du PNJ.

Le paquet historique réservé au performer n'est pas détourné en autorité de
divulgation. Les perspectives `INTENDS_TO_DECEIVE` ne deviennent pas une
permission de mentir dans I5.

## Étanchéité

La projection expose uniquement les faits autorisés. Pour un secret retenu,
elle publie un compteur et une référence de politique générique, jamais :

- la valeur secrète ;
- le `factRef` protégé ;
- une preuve privée ;
- la cause privée du secret.

Une croyance autorisée porte `QUALIFIED_BELIEF` et une incertitude
`QUALIFIED_UNCERTAINTY`; aucune des deux ne devient vérité objective.

## Limites

`applyNpcInformationDisclosureV1` reporte la décision dans le reçu factuel et
ne sélectionne que les candidats autorisés. La projection complète reste
nécessaire à J10-I6 pour construire le paquet performer, le fallback local et
le témoignage. I5 ne produit encore aucun texte destiné au joueur.
