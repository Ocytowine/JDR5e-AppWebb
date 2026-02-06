# Architecture – Gestion des templates JSON et du contenu utilisateur

Objectif : construire une base solide, peu coûteuse et évolutive pour gérer :
- les templates (classes, sorts, armes…)
- le contenu personnalisé des utilisateurs (homebrew, personnages, états de jeu)

---

# 1. Principe général

Séparer **contenu statique** et **contenu vivant**.

- Templates officiels → fichiers JSON statiques (CDN, cache, coût ≈ 0)
- Données utilisateur → base de données (modifiables, sécurisées, liées à un compte)

---

# 2. Organisation des fichiers templates

## Structure conseillée

```
/templates
  /spells
    spells.index.json
    spells.level0.json
    spells.level1.json
    spells.level2.json
  /weapons
    weapons.index.json
    weapons.json
  /classes
    classes.index.json
    classes.json
```

## Règles

- Ne jamais faire un seul gros fichier (20 Mo = mauvais)
- Découper par catégorie ou niveau
- Fournir un **index léger** pour recherche rapide
- Les fichiers doivent être compressés (gzip/brotli)
- Servir avec cache long

---

# 3. Format d’un index

Un index contient seulement les champs utiles pour recherche/affichage rapide.

Exemple : `spells.index.json`

```json
[
  {
    "id": "fireball",
    "name": "Fireball",
    "level": 3,
    "school": "Evocation"
  }
]
```

## Avantages

- Recherche rapide sans charger tout
- Chargement du sort complet seulement à l’ouverture
- Très léger (quelques centaines de Ko)

---

# 4. Chargement côté application

## Stratégie

- Charger l’index au démarrage d’une page
- Filtrer/rechercher dans l’index
- Charger le JSON complet uniquement quand nécessaire

## Exemple logique

```
openSpellList()
  → load spells.index.json
  → search/filter
  → user clique un sort
  → load spells.level3.json
  → afficher fiche
```

---

# 5. Données utilisateur → Base de données

## Types de données en DB

- Personnages
- Inventaires
- États de combat
- Sorts/armes/classes personnalisés (homebrew)
- Variantes de campagne

## Structure simple recommandée

### Table : user_content

| colonne | type | description |
|--------|------|------------|
| id | uuid | identifiant unique |
| user_id | uuid | propriétaire |
| type | text | spell / item / class / etc |
| base_template_id | text | optionnel, lien vers template |
| data_json | jsonb | données complètes |
| created_at | timestamp | création |
| updated_at | timestamp | modification |

## Principe

- Tout contenu modifiable va en DB
- Le champ `data_json` contient l’objet complet
- Permet évolution sans migration lourde

---

# 6. Résolution Template vs User

Quand l’application demande un objet :

1. Chercher dans contenu utilisateur
2. Sinon charger depuis templates

Pseudo logique :

```
function resolveEntity(id):
  if exists in user_content:
    return user version
  else:
    return template version
```

---

# 7. Recherche – Plan évolutif

## Niveau 1 – Client simple

- Charger index
- Filtrer en JS
- Suffisant pour dataset modéré

## Niveau 2 – Index optimisé (recommandé)

- Plusieurs index spécialisés
- Chargement minimal
- Très bon ratio perf/coût

## Niveau 3 – Recherche DB (si gros volume)

À utiliser seulement si :
- dataset énorme
- filtres complexes
- pagination nécessaire
- tri avancé

---

# 8. Performance et coût – Bonnes pratiques

- Toujours découper les JSON
- Ne jamais charger 20 Mo d’un coup
- Utiliser cache CDN long
- Nettoyer logs DB
- Limiter taille contenu utilisateur
- Compresser réponses API

---

# 9. Sécurité

- Le contenu utilisateur doit être isolé par `user_id`
- Vérifier propriété avant lecture/modification
- Ne jamais faire confiance au JSON client

---

# 10. Évolution future possible

- Versioning des templates (`contentVersion`)
- Support multi‑campagnes
- Marketplace / partage homebrew
- Index global généré automatiquement
- Migration progressive vers recherche DB si nécessaire

---

# 11. Plan d’implémentation recommandé

1. Découper tous les JSON templates
2. Générer index pour chaque catégorie
3. Mettre templates en statique (CDN/cache)
4. Créer table `user_content`
5. Implémenter `resolveEntity()`
6. Ajouter recherche basée index
7. Ajouter contenu homebrew utilisateur

---

# 12. Règle simple à retenir

- Templates stables → JSON statiques
- Données vivantes → DB
- Recherche légère → index
- Recherche lourde → DB seulement si nécessaire

