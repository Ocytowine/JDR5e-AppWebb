---
schema_version: 1
type: evenement_historique
id: incendie_des_archives
nom: Incendie des Archives
aliases:
  - grand incendie des Archives
resume: Sinistre ayant détruit une partie des registres maritimes de Lysenthe.
mots_cles:
  - incendie
  - registres
  - sabotage

periode: age_des_registres
date:
  calendar_id: dunia
  annee: 842
  mois: null
  jour: null
  precision: ANNEE
lieux:
  - archives_de_lysenthe
participants:
  - archivistes_de_lysenthe
  - garnison_de_lysenthe
causes:
  - evenement: tensions_du_port
    certitude: CONTESTEE
consequences:
  - perte d'une partie des registres maritimes
  - renforcement de la sécurité des Archives

informations:
  - id: version_publique
    niveau: COMMUN
    texte: L'incendie fut officiellement attribué à un accident.
    sujets:
      - cause de l'incendie
    entites_liees:
      - archives_de_lysenthe
  - id: enquete_archivistes
    niveau: RESTREINT
    texte: Les Archivistes soupçonnent un sabotage destiné à détruire certains registres.
    sujets:
      - enquête sur l'incendie
    entites_liees:
      - archivistes_de_lysenthe
  - id: cause_reelle
    niveau: MJ_SECRET
    texte: Le feu fut commandité afin de détruire un registre précis.
    sujets:
      - commanditaire de l'incendie
    entites_liees: []
---

## [SPECIALISE] Témoignages et interprétations

Ajouter les récits concurrents dans des blocs distincts. Une version publique, un soupçon et une vérité cachée ne doivent jamais partager le même niveau de certitude.
