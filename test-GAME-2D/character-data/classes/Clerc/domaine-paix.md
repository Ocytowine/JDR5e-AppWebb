# Clerc — Domaine de la Paix (Peace Domain)
_D&D 5e (2024) – Progression et choix par niveau_

---

## Niveau 1 – Clerc
### Choix à faire
- **Domaine divin** : Domaine de la Paix
- **Compétences** : 2 compétences de clerc
- **Langue / équipement** (selon règles MJ)

### Gains automatiques
- **Incantation divine**
- **Lancement de sorts de clerc**
  - Sorts **préparés chaque jour**
  - Basés sur **Sagesse**

### Domaine de la Paix – Capacités
- **Lien de Paix (Emboldening Bond)**
  - Choisir un nombre d’alliés
  - 1 fois par tour :
    - +1d4 à un jet d’attaque, caractéristique ou sauvegarde
  - ⚠️ Pas de concentration
  - ⚠️ Condition de distance entre alliés

- **Sorts de domaine toujours préparés**
  - Heroism
  - Sanctuary

---

## Niveau 2 – Clerc
### Gains automatiques
- **Canalisation divine (1 utilisation)**

### Domaine de la Paix
- **Baume de Paix**
  - Action
  - Déplacement sans attaques d’opportunité
  - Chaque allié traversé :
    - récupère des PV
    - certaines conditions peuvent être réduites

---

## Niveau 3 – Clerc
### Choix
- **Préparation quotidienne des sorts**
  - Accès aux sorts de **niveau 2**

### Domaine de la Paix
- **Sorts de domaine**
  - Aid
  - Warding Bond

---

## Niveau 4 – Clerc
### Choix
- ASI ou Don (non détaillé)

---

## Niveau 5 – Clerc
### Gains automatiques
- **Destruction des morts-vivants (CR 1/2)**
- Accès aux sorts de **niveau 3**

### Domaine de la Paix
- **Sorts de domaine**
  - Beacon of Hope
  - Sending

---

## Niveau 6 – Clerc
### Gains automatiques
- **Canalisation divine (2 utilisations)**

### Domaine de la Paix
- **Lien Protecteur (Protective Bond)**
  - Quand un allié lié subit des dégâts :
    - un autre allié lié peut utiliser sa **réaction**
    - se téléporter à côté
    - **prendre les dégâts à sa place**

⚠️ Déclencheur réactif critique pour le moteur

---

## Niveau 7 – Clerc
### Choix
- Préparation des sorts
- Accès aux sorts de **niveau 4**

### Domaine de la Paix
- **Sorts de domaine**
  - Aura of Purity
  - Otiluke’s Resilient Sphere

---

## Niveau 8 – Clerc
### Choix
- ASI ou Don (non détaillé)

### Gains automatiques
- **Destruction des morts-vivants (CR 1)**

---

## Niveau 9 – Clerc
### Choix
- Préparation des sorts
- Accès aux sorts de **niveau 5**

### Domaine de la Paix
- **Sorts de domaine**
  - Greater Restoration
  - Rary’s Telepathic Bond

---

## Niveau 10 – Clerc
### Gains automatiques
- **Intervention divine**

---

## Niveau 11 – Clerc
### Choix
- Accès aux sorts de **niveau 6**

---

## Niveau 12 – Clerc
### Choix
- ASI ou Don (non détaillé)

---

## Niveau 13 – Clerc
### Choix
- Accès aux sorts de **niveau 7**

---

## Niveau 14 – Clerc
### Gains automatiques
- **Destruction des morts-vivants (CR 2)**

---

## Niveau 15 – Clerc
### Choix
- Accès aux sorts de **niveau 8**

---

## Niveau 16 – Clerc
### Choix
- ASI ou Don (non détaillé)

---

## Niveau 17 – Clerc
### Gains automatiques
- Accès aux sorts de **niveau 9**
- **Lien suprême (Expansive Bond)**
  - Les alliés liés :
    - ont résistance à tous les dégâts
    - peuvent partager les dégâts encore plus efficacement
  - Le groupe devient un **bloc défensif**

---

## Niveau 18 – Clerc
### Gains automatiques
- **Canalisation divine (3 utilisations)**

---

## Niveau 19 – Clerc
### Choix
- ASI ou Don (non détaillé)

---

## Niveau 20 – Clerc
### Gains automatiques
- **Intervention divine améliorée**
  - Réussit automatiquement

---

# Résumé – Choix critiques

## Sorts
- Le clerc :
  - connaît **toute la liste**
  - prépare chaque jour
- Les **sorts de domaine** sont :
  - toujours préparés
  - ne comptent pas dans la limite

## Support systémique
- Lien persistant
- Réactions conditionnelles
- Redirection de dégâts
- Effets de zone sociale (distance, groupe)

---

# Points clés pour moteur de règles

```txt
PeaceBond {
  linkedEntities: EntityID[]
  oncePerTurnDice: 1d4
  noConcentration: true
  distanceConstraint: true
}

DamageRedirection {
  trigger: onDamage
  reaction: required
  teleport: true
  sharedDamage: true
}
