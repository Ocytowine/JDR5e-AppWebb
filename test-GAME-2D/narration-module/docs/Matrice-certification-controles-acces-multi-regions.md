# Matrice de certification des contrôles d'accès multi-régions

Statut : `CERTIFIE_LOCAL_2026-08-04`

## Périmètre certifié

La campagne jouable installe deux contrôles persistants dans un même registre,
sans dupliquer le contrôleur narratif :

| Région | Seuil concret | Nature | Approches certifiées |
|---|---|---|---|
| Ylsséa | Caserne centrale → Château Tharqual | contrôle militaire | inventaire, social, perception, règles, tactique |
| Ardherne | Passage éboulé → Hameau du Torrent-Froid | obstacle naturel | refus d'inventaire, Force/Athlétisme, traversée |

Le second seuil est sourcé par le lore d'Ardherne : éboulements, route
forestière, tronc et blocs visibles. Il n'invente ni autorité politique ni
permission sociale absente du wiki.

## Recette déterministe du lot F

`campaign-access-lot-f.spec.ts` vérifie depuis la vraie surface React :

1. création de campagne et installation simultanée des deux contrôles ;
2. arrivée au passage éboulé, les deux seuils restant `CONTROLLED` ;
3. reconnaissance de l'épée réellement détenue, puis refus explicite par
   `inventory.access-policy-rejected`, sans commit, tentative ni temps ;
4. solution alternative par Force/Athlétisme, avec proposition `DD 15` ;
5. rechargement pendant le test en attente ;
6. réussite déterministe, satisfaction de l'exigence physique, bruit
   `AUDIBLE`, 60 secondes et ouverture persistante ;
7. maintien du contrôle de Tharqual, preuve d'absence de contamination entre
   régions ;
8. traversée séparée vers le Hameau du Torrent-Froid, 8 secondes de déplacement
   puis restauration de la scène après rechargement.

La condition préalable est portée par l'exigence physique active et par le test
en attente : l'ouverture n'est jamais déduite de la phrase du joueur. Les lots
B à E conservent en parallèle les preuves de refus, condition sociale,
perception, règles et issue tactique sur le seuil militaire.

## Commandes de preuve

```text
npm run narration-module:test:campaign-access-lot-f
npm run narration-module:test:campaign-access-lot-b
npm run narration-module:test:campaign-access-lot-c
npm run narration-module:test:campaign-access-lot-d
npm run narration-module:test:campaign-access-lot-e
npm run build
```

Cette certification est locale et déterministe. Aucun appel OpenAI live n'est
nécessaire pour prouver l'autorité, la persistance ou la transition. Une recette
OpenAI ultérieure ne pourra certifier que la compréhension et la qualité du
rendu.
