```mermaid
sequenceDiagram
actor PJ
participant MJ
actor PNJ
actor PNJ Compagnon
participant Stockage@{ "type" : "database" }
MJ->>PJ: Alors PJ, que faite vous?
PJ->>MJ: Je vais au centre ville.
loop HealthCheck
    MJ->>PJ: Filtre l'entrée
end
Note right of PJ: Rational thoughts!
PJ-->>MJ: Great!
PJ->>PNJ: How about you?
PNJ-->>PJ: Jolly good!
```
[Docu](https://mermaid.js.org/syntax/sequenceDiagram.html)