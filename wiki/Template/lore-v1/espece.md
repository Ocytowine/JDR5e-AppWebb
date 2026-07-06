---
schema_version: 1
type: espece
id: elfes
nom: Elfes
aliases:
  - peuple elfique
resume: Peuple ancien présent dans plusieurs régions de Dunia.
mots_cles:
  - longévité
  - magie

jouable: true
rencontrable: true
classification: humanoide
catalogue_mecanique:
  entry_kind: race
  entry_id: elf

apparence_observable:
  - silhouette généralement élancée
  - oreilles pointues
biologie:
  maturite: 20
  esperance_vie: 700
  particularites:
    - sommeil méditatif selon les lignées

langues:
  - elfique
cultures_associees:
  - culture_elfique_ylssea
regions_presence:
  - region: ylssea
    importance: MAJEURE

informations:
  - id: longevite_commune
    niveau: COMMUN
    texte: Les elfes vivent généralement beaucoup plus longtemps que les humains.
    sujets:
      - longévité elfique
    entites_liees: []
  - id: memoire_des_lignees
    niveau: SPECIALISE
    texte: Certaines communautés confient leur mémoire à des gardiens de lignée.
    sujets:
      - traditions elfiques
    entites_liees:
      - culture_elfique_ylssea
---

## [SPECIALISE] Variations documentées

Décrire ici les nuances biologiques ou historiques qui demandent plus d'espace. Ne pas attribuer automatiquement les valeurs d'une culture à tous les membres de l'espèce.
