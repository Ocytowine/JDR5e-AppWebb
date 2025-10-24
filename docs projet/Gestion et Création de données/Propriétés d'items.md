Type de propriété :

Items :

  "id": 
  "name": 
  "type": texte minuscule. arme / armure / munition / bouclier / vêtement / bourse / grimoire / accéssoire
  "subtype"
  "description": texte. description visuel (peut être définie par joueur au début /création)
  "lore": texte. histoire de l'item, ou à t'il était aquis...
  "equiped": équipable (true ou false) (a voir la logique du slot équipable en fonction du type)
  "allow_stack": est ce que l'item est empilable
  "harmonisable": true ou false. peut on l'harmonisé (donner la feature si c'est true)
  "focalisateur": false, ou arcanique, druidique, sacre. peut il etre le focalisateur pour lanceur de sort
  "weight": valeur en kilo. poids de l'item en kilo
  "value": { valeur en argent
    "gold": 20,
    "silver": 0,
    "copper": 0
  },
  "effects": décrires les effets " mécanique " voir Création de données pour exemple

effects : chaque type d'effet à un Payload (charge utile à traiter)

Classes : 

 "payload": {
      "dv": "d10",
      "hit_points": {
        "level_1": "10 + mod.CON",
        "per_level_after_1": "1d10 (ou 6) + mod.CON"
      },
      "proficiency_grant": {
        "armor": ["legere", "intermediaire", "lourde", "boucliers"],
        "weapons": ["simples", "de_guerre"],
        "tools": []

Les propriétées des armes sont leurs mécaniques de fonctionnement. La ligne des fichier json est : "properties": "cumul de propriété"

| Propriété (FR) | Property (EN) | Description simple et claire | Exemples d'armes |
| --- | --- | --- | --- |
| Munitions | `ammunition` | L'arme tire des projectiles (flèches, carreaux...). Il faut en avoir pour tirer. | Arc, arbalète |
| Finesse | `finesse` | Tu peux utiliser ta Dextérité au lieu de ta Force pour toucher et infliger des dégâts. | Dague, rapière |
| Légère | `light` | Permet d'utiliser deux armes légères pour attaquer (attaque bonus avec la seconde). | Dague, cimeterre |
| Lourde | `heavy` | Trop grande pour les petites créatures : elles ont désavantage avec. | Espadon, hache à deux mains |
| Deux mains | `two_handed` | Nécessite les deux mains pour attaquer. | Arc long, espadon |
| Polyvalente | `versatile` | Peut être utilisée à une ou deux mains ; dégâts augmentés à deux mains. | Épée longue, marteau de guerre |
| Allonge | `reach` | Permet d'attaquer jusqu'à 3 mètres (10 ft) au lieu de 1,5 m. | Lance, hallebarde, fouet |
| Jet | `thrown` | Peut être lancée ; tu utilises le même modificateur (Force ou Dextérité) qu'au corps à corps. | Dague, javelot, hachette |
| Portée (x/y) | `range` | L'arme peut être utilisée à distance : x = portée normale, y = portée longue (désavantage). | Arc (150/600), dague (20/60) |
| Rechargement | `loading` | Tu dois recharger après un certain nombre de tirs. Limite souvent le nombre d'attaques. | Arbalète |
| Improvisée | `improvised` | Arme non prévue pour le combat (chaise, bouteille). Dégâts décidés par le MJ. | Objets divers |
| Maîtrise d'arme | `weapon_mastery` | L'arme a un effet spécial (Vex, Push, Nick, etc.), utilisable par les classes qui y ont accès. | Rapière (Vex), épée longue (Push) |
| Argentée | `silvered` | Arme recouverte d'argent, utile contre certaines créatures (loups-garous, vampires...). | Toute arme métallique |
| Spéciale | `special` | L'arme a des règles particulières indiquées dans sa description. | Filet, fouet |
| Propulsée (2024) | `propulsive` | Arme de jet qui utilise Force au lieu de Dextérité (car tu la lances fort). | Javelot, hache de lancer |
| Recharge (1) | `reload_1` | Indique combien de fois tu peux tirer avant de devoir recharger (ex : "Recharge (1)" = 1 tir). | Arbalète à main |
| Maîtrise multiple (rare) | `multiple_mastery` | Certaines armes (comme celles des moines) peuvent avoir deux propriétés de maîtrise. | Bâton, nunchaku |
