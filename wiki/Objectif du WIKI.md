Objectif du wiki

L'objectif est de fournir une base de connaissance complète et structurée afin d'appuyer certaine mécanique du jeu.

Structure attendue :

/lore
  /canon
    /meta
      world.json
      settings.json
    /regions
      /region_id/
        region.json
        lieux/
          lieu_id.json
        pnj/
          pnj_id.json
        factions/
          faction_id.json
        objets/
          objet_id.json
        events/
          event_id.json

  /graph_scripts
    generate_cypher.js
    import_all.js
    /output/
      full_graph.cypher


méthode : 

créer un monde canon à partir du script précédent,
et générer une instance joueur clonée automatiquement (sur action “nouvelle partie”)




exemple en neo4j :

```Cypher
CREATE (:Lieu {
  id: "loc_evermere",
  type: "ville",
  nom: "Evermere",
  population: 12000,
  gouvernement: "Conseil des Anciens",
  biome: "forêt ancienne",
  resume: "Ancienne cité elfique isolée au cœur des bois.",
  description: """
Evermere est une cité elfique millénaire, bâtie dans les arbres
géants de la Forêt d’Émeraude. On y trouve encore des traces
du Premier Âge, dissimulées derrière la perfection architecturale
de ses ponts suspendus. Les voyageurs y découvrent un peuple
érudit mais méfiant, obsédé par la préservation du savoir ancien.
""",
  secret: """
Sous la ville dort un ancien artefact, scellé par le Premier Conseil,
que seuls les érudits connaissent sous le nom de "Cœur de Verre".
""",
  tags: ["elfe", "forêt", "ruines", "ancienne_cité"]
});
```