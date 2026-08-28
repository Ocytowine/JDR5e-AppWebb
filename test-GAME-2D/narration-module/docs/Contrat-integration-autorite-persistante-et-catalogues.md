# Contrat d'intégration d'une autorité persistante et des catalogues

Statut : `ACTIF`

Portée : tout nouveau registre propriétaire qui complète ou remplace une
information issue du wiki, d'un catalogue de règles ou d'un autre contenu
compilé.

## Problème évité

Écrire un agrégat dans `CampaignRepository` ne suffit pas. Un propriétaire est
réellement intégré seulement si son état peut être retrouvé par les lecteurs
métier qui construisent le tour suivant. Sans ce raccord, la sauvegarde est
valide mais invisible au jeu.

## Chaîne obligatoire

```text
source authored
  → catalogue généré et validé
  → références canoniques
  → validation des ancres
  → commande propriétaire
  → commit atomique dans CampaignRepository
  → lecteur propriétaire borné par campaignRevision
  → adaptateur du consommateur
  → règle explicite de priorité
  → projection connaissance/divulgation/présentation
```

## Invariants

### Source et identité

- Le contenu authored reste immuable ; une campagne le complète dans un
  agrégat séparé.
- Les sujets utilisent la référence canonique du catalogue. Deux préfixes pour
  la même entité sont interdits.
- Les propriétés utilisent un chemin canonique stable.
- Toute référence `lore-fact:` ou `lore-fragment:` est vérifiée dans le
  catalogue injecté avant le commit.
- Une source privée ne peut soutenir une valeur publique.

### Écriture

- Un domaine possède le contrat, la cardinalité et le cycle de vie.
- L'opération porte empreinte, idempotence, révision observée et lease.
- Les agrégats liés sont écrits dans un seul commit.
- Un type d'agrégat générique ne demande pas de nouvelle table IndexedDB. Une
  nouvelle table ou un changement de payload existant exige une migration.

### Lecture

- Le propriétaire expose un port de lecture ; les consommateurs ne lisent pas
  directement le payload de l'agrégat.
- La lecture reçoit `campaignRevision` et exclut tout état futur.
- Assertion et clôture conservent leurs révisions afin de reconstruire la
  valeur effective à un snapshot antérieur.
- Le consommateur déclare la priorité. Ordre par défaut : état propriétaire,
  fait libre de campagne, projection de campagne, lore initial.
- Lorsque plusieurs lecteurs sont obligatoires, une composition de production
  unique les injecte tous. Les call sites ne doivent pas pouvoir reconstruire
  facilement une variante « catalogue seul » qui oublierait l'état durable.
- Une valeur prioritaire remplace celle du même slot ; elle ne s'ajoute pas
  comme contradiction concurrente.

### Gate minimale

Un nouveau propriétaire n'est pas fermé sans prouver :

1. ancre authored existante et ancre inventée refusée ;
2. commit et rejeu sans doublon ;
3. concurrence et cardinalité ;
4. fermeture puis réouverture réelle d'IndexedDB ;
5. relecture par le consommateur final, pas seulement par le loader ;
6. priorité sur le catalogue initial ;
7. cohérence à plusieurs `campaignRevision` ;
8. génération du catalogue, tests du domaine adjacent et build global.

## Référence J10-I4

- `campaignFactAuthority.ts` valide ancres, slots et cycle de vie ;
- `campaignFactRuntime.ts` écrit puis expose le lecteur propriétaire ;
- `targetedLoreInformationLookup.ts` adapte les faits au reçu factuel et donne
  priorité à `CAMPAIGN_FACT` ;
- `campaignInformationLookupRuntime.ts` est la composition de production
  obligatoire : faits libres + projections de campagne + lore initial ;
- `verify-campaign-fact-authority-j10i4.ts` couvre mémoire, historique et
  priorité ;
- `indexeddb-specific.ts` couvre commit, fermeture, réouverture, lookup et
  rejeu dans Chromium.

Ce modèle doit être repris pour les futurs propriétaires d'état politique,
économique, social, géographique, temporel ou de règles. Copier uniquement la
partie commit est explicitement insuffisant.
