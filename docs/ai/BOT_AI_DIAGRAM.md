# Diagrama de Funcionamiento de la IA de Bots

## Flujo Principal de Decisión (`calculateAction`)

```mermaid
flowchart TD
    Start([Inicio: calculateAction]) --> CalcFuture[Calcular posición futura<br/>LOOK_AHEAD_DISTANCE = 180px]
    CalcFuture --> CheckBoundary1{¿Colisión<br/>inminente<br/>con borde?}
    
    CheckBoundary1 -->|Sí| EvadeBoundary1[Girar hacia el centro<br/>getDirectionAwayFromBoundary]
    EvadeBoundary1 --> End([Retornar acción])
    
    CheckBoundary1 -->|No| CheckTrailCollision{¿Colisión directa<br/>con trail de<br/>otros jugadores?}
    
    CheckTrailCollision -->|Sí| CheckGap{¿Hay gap<br/>cercano<br/>disponible?}
    CheckGap -->|Sí| TryGap[Intentar pasar por gap<br/>getDirectionToGap]
    TryGap --> End
    CheckGap -->|No| EvadeTrail[Girar hacia dirección segura<br/>getSafeDirection]
    EvadeTrail --> End
    
    CheckTrailCollision -->|No| CheckSelfTrail{¿Colisión con<br/>propio trail?}
    
    CheckSelfTrail -->|Sí| EvadeSelf[Girar hacia dirección segura<br/>getSafeDirection]
    EvadeSelf --> End
    
    CheckSelfTrail -->|No| CheckSelfProximity{¿Muy cerca del<br/>propio trail?<br/>< 75px}
    
    CheckSelfProximity -->|Sí| EvadeSelfProx[Girar hacia dirección segura<br/>getSafeDirection]
    EvadeSelfProx --> End
    
    CheckSelfProximity -->|No| CheckBoundary2{¿Cerca de borde?<br/>< 300px<br/>BOUNDARY_AVOIDANCE}
    
    CheckBoundary2 -->|Sí| EvadeBoundary2[Alejarse del borde<br/>getDirectionAwayFromBoundary]
    EvadeBoundary2 --> End
    
    CheckBoundary2 -->|No| CheckTrailProximity{¿Trail cercano?<br/>< 90px<br/>Detección preventiva}
    
    CheckTrailProximity -->|Sí| EvadeTrailProx[Girar hacia dirección segura<br/>getSafeDirection]
    EvadeTrailProx --> End
    
    CheckTrailProximity -->|No| StrategicMove[Comportamiento estratégico<br/>findOpenAreaDirection]
    StrategicMove --> End
    
    style Start fill:#e1f5ff
    style End fill:#c8e6c9
    style CheckBoundary1 fill:#fff9c4
    style CheckTrailCollision fill:#fff9c4
    style CheckSelfTrail fill:#fff9c4
    style CheckSelfProximity fill:#fff9c4
    style CheckBoundary2 fill:#fff9c4
    style CheckTrailProximity fill:#fff9c4
    style StrategicMove fill:#f3e5f5
```

## Funciones Auxiliares

### 1. `getDirectionAwayFromBoundary`
```mermaid
flowchart LR
    Start([Calcular ángulo hacia centro]) --> CalcAngle[Calcular diferencia<br/>angleToCenter - bot.angle]
    CalcAngle --> Normalize[Normalizar a [-π, π]]
    Normalize --> Decision{angleDiff > 0?}
    Decision -->|Sí| Right[Girar RIGHT]
    Decision -->|No| Left[Girar LEFT]
    Right --> End([Retornar dirección])
    Left --> End
```

### 2. `getSafeDirection`
```mermaid
flowchart TD
    Start([Evaluar izquierda y derecha]) --> EvalLeft[Evaluar giro LEFT<br/>leftAngle = angle - π/30]
    Start --> EvalRight[Evaluar giro RIGHT<br/>rightAngle = angle + π/30]
    
    EvalLeft --> CheckLeft{¿LEFT seguro?<br/>Sin colisión borde<br/>Sin colisión trail}
    EvalRight --> CheckRight{¿RIGHT seguro?<br/>Sin colisión borde<br/>Sin colisión trail}
    
    CheckLeft -->|Sí| LeftSafe[LEFT seguro]
    CheckLeft -->|No| LeftUnsafe[LEFT inseguro]
    CheckRight -->|Sí| RightSafe[RIGHT seguro]
    CheckRight -->|No| RightUnsafe[RIGHT inseguro]
    
    LeftSafe --> Decision{Ambas seguras?}
    RightSafe --> Decision
    LeftUnsafe --> Decision
    RightUnsafe --> Decision
    
    Decision -->|Solo LEFT| ReturnLeft[Retornar LEFT]
    Decision -->|Solo RIGHT| ReturnRight[Retornar RIGHT]
    Decision -->|Ambas| Random[Elegir aleatoriamente<br/>o hacia el centro]
    Decision -->|Ninguna| ToCenter[getDirectionAwayFromBoundary]
    
    ReturnLeft --> End([Retornar dirección])
    ReturnRight --> End
    Random --> End
    ToCenter --> End
```

### 3. `findOpenAreaDirection`
```mermaid
flowchart TD
    Start([Evaluar 3 direcciones]) --> EvalLeft[LEFT: angle - π/20]
    Start --> EvalRight[RIGHT: angle + π/20]
    Start --> EvalStraight[STRAIGHT: angle actual]
    
    EvalLeft --> ScoreLeft[evaluateDirectionScore<br/>para LEFT]
    EvalRight --> ScoreRight[evaluateDirectionScore<br/>para RIGHT]
    EvalStraight --> ScoreStraight[evaluateDirectionScore<br/>para STRAIGHT]
    
    ScoreLeft --> Sort[Ordenar por score<br/>mayor = mejor]
    ScoreRight --> Sort
    ScoreStraight --> Sort
    
    Sort --> CheckDiff{¿Mejor score ><br/>segundo + 10?}
    
    CheckDiff -->|Sí| ReturnBest[Retornar mejor dirección]
    CheckDiff -->|No| CheckCenter{¿Alguna dirección<br/>va hacia el centro?}
    
    CheckCenter -->|Sí| ReturnCenter[Preferir dirección<br/>hacia el centro]
    CheckCenter -->|No| ReturnNull[Retornar null<br/>mantener dirección actual]
    
    ReturnBest --> End([Retornar dirección])
    ReturnCenter --> End
    ReturnNull --> End
```

### 4. `evaluateDirectionScore`
```mermaid
flowchart TD
    Start([Iniciar score = 100]) --> Loop[Para cada paso<br/>1 a 5 pasos<br/>40px por paso]
    
    Loop --> CheckBoundary{¿Cerca de borde?}
    CheckBoundary -->|Sí| PenalizeBoundary[Penalizar score<br/>-5 a -100 según distancia]
    CheckBoundary -->|No| CheckCenter{¿Cerca del centro?}
    
    CheckCenter -->|Sí| BonusCenter[Bonus score<br/>+3 a +40 según ratio]
    CheckCenter -->|No| CheckTrail{¿Cerca de trail?}
    
    PenalizeBoundary --> CheckCenter
    BonusCenter --> CheckTrail
    
    CheckTrail -->|Sí| PenalizeTrail[Penalizar score<br/>-10 a -25 según distancia]
    CheckTrail -->|No| CheckCollision{¿Colisión directa<br/>en paso 1?}
    
    PenalizeTrail --> CheckCollision
    CheckCollision -->|Sí| PenalizeCollision[Penalizar score -50]
    CheckCollision -->|No| CheckAlignment{¿Alineado con centro?}
    
    PenalizeCollision --> CheckAlignment
    CheckAlignment -->|Sí| BonusAlignment[Bonus score<br/>+3 a +25 según alineación]
    CheckAlignment -->|No| CheckAway{¿Alejándose del centro?}
    
    BonusAlignment --> CheckAway
    CheckAway -->|Sí| PenalizeAway[Penalizar score -15]
    CheckAway -->|No| NextStep{¿Más pasos?}
    
    PenalizeAway --> NextStep
    NextStep -->|Sí| Loop
    NextStep -->|No| Return[Retornar score final]
```

## Prioridades de Decisión

La IA sigue un orden de prioridad estricto:

1. **Máxima Prioridad**: Colisión inminente con borde
2. **Alta Prioridad**: Colisión directa con trail de otros
3. **Alta Prioridad**: Colisión con propio trail
4. **Media Prioridad**: Proximidad al propio trail (< 75px)
5. **Media Prioridad**: Cerca de bordes (< 300px) - **Tiene prioridad sobre trails cercanos**
6. **Baja Prioridad**: Proximidad a trails de otros (< 90px)
7. **Baja Prioridad**: Comportamiento estratégico (moverse hacia áreas abiertas)

## Parámetros Clave

- **LOOK_AHEAD_DISTANCE**: 180px (aumentado 50% para velocidad mayor)
- **BOUNDARY_AVOIDANCE_DISTANCE**: 300px (aumentado 50%)
- **Detección preventiva de trails**: 90px (aumentado 50%)
- **Detección propio trail**: 75px (aumentado 50%)
- **MAX_GAP_DISTANCE**: 180px (aumentado 50%)
- **MIN_GAP_SIZE**: 60px

## Sistema de Scoring

El sistema de scoring en `evaluateDirectionScore` evalúa:
- **Penalizaciones por bordes**: Graduales según distancia (50px = -100, 400px = -5)
- **Bonos por centro**: Graduales según ratio (0.8+ = +40, 0.1+ = +3)
- **Penalizaciones por trails**: 60px = -25, 120px = -10
- **Bonos por lejanía de trails**: >150px = +5
- **Penalizaciones por colisiones**: -50
- **Bonos por alineación con centro**: Graduales según ángulo
- **Penalizaciones por alejarse del centro**: -15

## Notas Importantes

1. **Los bordes tienen prioridad sobre trails cercanos**: Esto evita que los bots se queden atrapados en esquinas
2. **Siempre se envía input**: Incluso si no hay acción, se envía input para mantener movimiento continuo
3. **Búsqueda de gaps**: Los bots intentan pasar por gaps en trails cuando es posible
4. **Comportamiento estratégico**: Cuando no hay amenazas inmediatas, los bots se mueven hacia áreas abiertas y el centro del mapa

