# Contrat d'invariance sémantique

Version : `semantic-invariance-family/1`  
Date : 2026-07-17  
Lot : I-06ZQ

## Principe

Une famille regroupe cinq formulations différentes qui doivent exprimer la même intention canonique. L'oracle ne recherche aucun mot dans la phrase. Il compare une empreinte système composée de :

- famille et objectif sémantiques;
- engagement;
- emplacement de cible canonique;
- statut et domaine runtime;
- type de commande ou absence de commande;
- politique et autorité de commit;
- politique temporelle;
- résultats interdits.

`coreMeaning`, les preuves textuelles, l'ordre des propositions et le rendu sont exclus de l'empreinte. Ils peuvent varier sans changer l'action du système.

## Suite déterministe

La suite `narration-module:test:semantic-invariance` injecte une sortie sémantique structurée certifiée. Elle vérifie la transmission après interprétation, et non la performance linguistique d'un fournisseur. Elle couvre sept familles : parole, approche, manipulation implicite, observation, possibilité, clarification et domaine fermé.

Chaque famille contient cinq formulations, notamment des formulations sans verbe canonique, des inversions de propositions et une variante pronominale alimentée par un référent récent. Les 35 formulations sont exécutées sur trois registres de scène, soit 105 empreintes.

Une cible propre à chaque scène est normalisée en `$TARGET:<kind>` uniquement pour comparer les scènes. Son existence et sa capacité sont d'abord validées dans le registre réel. Dans une scène donnée, la référence canonique exacte reste obligatoire.

## Ambiguïté

Une intention insuffisamment déterminée appartient à la famille `clarification`. Son oracle exige `NEEDS_CLARIFICATION`, aucune commande et aucune autorité de commit. Elle ne peut pas être comparée ou forcée vers l'empreinte d'une manipulation engagée.

## Certification OpenAI live

Les essais live sont séparés de la suite déterministe et ne bloquent pas un build hors réseau. Une certification doit :

1. utiliser les 35 formulations, dans l'ordre aléatoire, sur au moins deux passages;
2. conserver modèle, prompt, registre et paramètres dans le rapport;
3. comparer les sorties à la même empreinte, sans noter le style du rendu;
4. exiger 100 % sur engagement, autorité de commit, temps et résultats interdits;
5. exiger au moins 95 % de convergence globale sur sens, cible et routage;
6. classer chaque écart en `SENS`, `CIBLE`, `ROUTAGE` ou `RENDU`;
7. considérer toute exécution d'une possibilité, clarification ou domaine fermé comme bloquante, indépendamment du score global.

Une divergence `RENDU` seule ne remet pas en cause l'invariance système. Toute divergence de sens, cible ou routage doit produire une fixture de reproduction avant correction; elle ne justifie pas l'ajout d'un dictionnaire lexical dans le runtime.
