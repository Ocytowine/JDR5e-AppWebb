# Moteur de Monde Vivant pour JDR Narratif

Ce document décrit une architecture simple et évolutive permettant de créer un monde qui évolue **sans intervention du joueur**.
L'objectif est de générer **du mouvement crédible** à partir de données existantes comme les villes, les quartiers, les factions et les lieux structurants.

Le système repose sur trois piliers :

* **structure du monde**
* **états dynamiques**
* **simulation d'événements**

---

# 1. Principe général

Un monde vivant fonctionne selon une boucle :

```text
Pression → Décision → Événement → Conséquence
```

Exemple :

```text
pauvreté élevée
→ faction criminelle agit
→ extorsion
→ peur dans le quartier
→ commerce diminue
→ nouvelles tensions
```

Cette boucle produit du mouvement naturel.

---

# 2. Structure du monde (données écrites)

Certaines données doivent être définies manuellement pour garantir la cohérence.

## Géographie

Exemple :

```json
{
  "ville": "Capitale",
  "quartiers": [
    "quartier_port",
    "quartier_est",
    "quartier_artisans",
    "quartier_noble"
  ]
}
```

Ces éléments structurent les événements possibles.

## Institutions et pouvoir

Exemple dans un système féodal :

```json
{
  "autorites": [
    "couronne",
    "milice",
    "guilde_marchande",
    "culte_du_soleil"
  ]
}
```

Ces acteurs créent des conflits et des décisions.

## Lieux structurants

Chaque quartier devrait contenir quelques lieux clés :

* marché
* temple
* caserne
* atelier
* taverne
* entrepôt

Exemple :

```json
{
  "quartier_port": {
    "lieux": [
      "marche_du_port",
      "taverne_du_sel",
      "entrepots_du_quai"
    ]
  }
}
```

---

# 3. États dynamiques

Le monde doit contenir des valeurs qui changent.
Ces valeurs alimentent les événements.

## Ville

```json
{
  "ordre": 70,
  "commerce": 85,
  "peur": 25,
  "corruption": 40,
  "approvisionnement": 90
}
```

## Quartier

```json
{
  "quartier_est": {
    "danger": 70,
    "richesse": 30,
    "surveillance": 20,
    "agitation": 60,
    "influence_guilde_noire": 65
  }
}
```

## Faction

```json
{
  "guilde_noire": {
    "richesse": 20,
    "puissance": 45,
    "influence": 60,
    "cohesion": 70,
    "objectif": "augmenter_revenus"
  }
}
```

---

# 4. Pressions

Les pressions apparaissent lorsque certaines valeurs dépassent des seuils.

Exemples :

```text
si danger > 60 → risque criminel élevé
si pauvreté > 70 → agitation sociale
si surveillance < 30 → opportunités illégales
```

---

# 5. Décisions d'acteurs

Les factions agissent en fonction de leurs objectifs et du contexte.

Exemple :

```json
{
  "acteur": "guilde_noire",
  "contexte": {
    "richesse": 20,
    "danger_quartier": 70,
    "surveillance": 20
  },
  "action": "extorsion"
}
```

---

# 6. Génération d'événements

Un événement est la manifestation visible d'une action.

Structure simple :

```json
{
  "type": "extorsion",
  "lieu": "quartier_est",
  "acteurs": ["guilde_noire"],
  "impact": {
    "peur": 5,
    "danger": 3,
    "richesse_commercants": -4
  }
}
```

---

# 7. Conséquences

Chaque événement modifie l'état du monde.

Exemple :

```text
extorsion
→ peur +5
→ commerces ferment
→ activité diminue
→ quartier plus dangereux
```

Ces changements créent de nouvelles pressions.

---

# 8. Diffusion de l'information

Tous les événements ne sont pas visibles directement.
Ils peuvent apparaître sous forme de :

* rumeurs
* ambiance
* traces visibles
* changements économiques

Exemple :

```json
{
  "rumeur": "Des hommes font payer la protection dans le quartier est."
}
```

---

# 9. Tick de simulation

Le monde avance par cycles.

Un tick peut être déclenché :

* après une action importante du joueur
* après un certain temps
* après un déplacement majeur

Pipeline :

```text
1. mise à jour des états
2. détection des pressions
3. décisions des acteurs
4. génération d'événements
5. application des conséquences
6. diffusion des rumeurs
```

---

# 10. Niveaux de simulation

Tout le monde ne doit pas être simulé avec la même précision.

## Niveau actif

* quartier du joueur
* factions proches
* PNJ importants

## Niveau résumé

* autres quartiers
* factions secondaires

## Niveau abstrait

* régions éloignées
* économie globale
* guerre ou politique

---

# 11. Événements calmes

Le monde ne doit pas produire uniquement des crises.

Exemples :

* marché animé
* travaux sur une rue
* procession religieuse
* arrivée d'une caravane
* fête locale

Ces événements créent de la texture.

---

# 12. Génération procédurale d'événements

Un événement peut être construit à partir de briques :

```text
acteur
cible
motivation
lieu
méthode
visibilité
impact
```

Exemple :

```json
{
  "acteur": "bande_locale",
  "cible": "marchand_de_fer",
  "motivation": "dette",
  "lieu": "quai_nord",
  "methode": "intimidation",
  "impact": {
    "peur": 6
  }
}
```

---

# 13. Historique d'événements

Pour éviter la répétition, conserve les événements récents :

```json
{
  "quartier_est": {
    "evenements_recents": [
      "extorsion",
      "bagarre"
    ]
  }
}
```

Cela permet de limiter les répétitions.

---

# 14. Exemple complet

État initial :

```json
{
  "quartier_est": {
    "danger": 70,
    "surveillance": 20,
    "commerce": 30
  }
}
```

Tick :

```text
danger élevé + surveillance faible
→ opportunité criminelle
```

Action faction :

```text
guilde noire lance une extorsion
```

Événement :

```text
deux échoppes rackettées
```

Conséquences :

```text
peur +10
commerce -5
rumeur criminelle
```

Le joueur arrive plus tard et ressent ces changements.

---

# 15. Ratio contenu écrit / généré

Un bon équilibre :

```text
30% monde écrit
70% monde généré et simulé
```

Le monde écrit comprend :

* géographie
* factions
* institutions
* lieux importants
* culture

Le reste peut émerger.

---

# 16. Résumé

Un monde vivant nécessite :

* **structure fixe**
* **états dynamiques**
* **acteurs avec objectifs**
* **pressions**
* **simulation d'événements**
* **conséquences persistantes**

Ce système permet de générer un monde qui évolue même lorsque le joueur n'agit pas.
