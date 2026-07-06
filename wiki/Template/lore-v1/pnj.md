---
schema_version: 1
type: pnj
id: maelis_varenne
nom: Maelis Varenne
aliases:
  - maîtresse des archives
resume: Conservatrice elfe chargée d'une partie des collections des Archives de Lysenthe.
mots_cles:
  - archives
  - conservatrice

espece: elfes
culture: culture_elfique_ylssea
role_public: Conservatrice des Archives de Lysenthe
lieu_initial: archives_de_lysenthe
factions:
  - archivistes_de_lysenthe
apparence:
  - cheveux argentés attachés
  - robe bleu sombre portant le sceau des Archivistes
expression:
  registre: précis
  rythme: posé
  habitudes:
    - reformule les questions imprécises
motivations_initiales:
  - préserver l'indépendance des Archives
objectifs_initiaux:
  - identifier les documents disparus lors de l'incendie
relations_initiales: []
connaissances_initiales:
  - entity: incendie_des_archives
    information_id: enquete_archivistes
croyances_initiales:
  - sujet: cause de l'incendie des Archives
    texte: Le sinistre était destiné à détruire un registre précis.
    confiance: 70
importance: MAJEUR

informations:
  - id: reputation_locale
    niveau: LOCAL
    texte: Maelis aide volontiers les chercheurs capables de présenter une demande précise.
    sujets:
      - réputation de Maelis
    entites_liees:
      - archives_de_lysenthe
  - id: dette_secrete
    niveau: MJ_SECRET
    texte: Maelis doit une faveur au Cercle du Commerce maritime.
    sujets:
      - dette de Maelis
    entites_liees:
      - cercle_du_commerce_maritime
---

## [LOCAL] Présence en scène

Décrire ici des détails d'interprétation non mécaniques. Après le bootstrap, position, objectifs, relations et connaissances courantes proviennent des agrégats de campagne.
