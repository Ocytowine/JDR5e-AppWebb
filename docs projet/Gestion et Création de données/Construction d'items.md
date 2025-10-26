Voici la trame d'un item

```json
{
  "id": "arc",
  "name": "Arc",
  "type": "arme",
  "subtype" : "simple",
  "description": "Arc en bois artisanal classique",
  "equiped": true,
  "allow_stack": false,
  "harmonisable": false,
  "focalisateur": false,
  "weight": 0.8,
  "size":0.8,
  "value": {
    "gold": 10,
    "silver": 0,
    "copper": 0
  },
  "effect": {
    "mod": "mod.DEX",
    "damage": "1d5",
    "damage_type": "Perforant"
  },
  "properties": 
  {
    "reload": 1,
    "range": {"x": 50, "y": 150},
    "two_handed": true,
    "ammunition": true
  }
}
```
