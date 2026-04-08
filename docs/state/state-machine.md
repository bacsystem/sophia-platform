# State Machine — Proyecto

Máquina de estados del campo `projects.status`.

```mermaid
---
title: State Machine — Proyecto (projects.status)
---
stateDiagram-v2
    [*] --> idle : Proyecto creado

    idle --> running : POST /generate<br/>Encola job BullMQ
    running --> paused : POST /pause<br/>Pausa entre capas
    running --> done : Capa 6 completada<br/>taskComplete
    running --> error : Error en agente<br/>3 reintentos fallidos

    paused --> running : POST /resume<br/>Continúa siguiente capa

    error --> running : POST /retry<br/>Reintentar desde capa fallida

    done --> [*]

    state running {
        [*] --> layer1
        layer1 : 🗄️ Layer 1 — DBA
        layer2 : 🔧 Layer 2 — Backend
        layer3 : 📱 Layer 3 — Frontend
        layer4 : 🧪 Layer 4 — QA
        layer5 : 📖 Layer 5 — Docs
        layer6 : 🚀 Layer 6 — Deploy

        layer1 --> layer2 : taskComplete
        layer2 --> layer3 : taskComplete
        layer3 --> layer4 : taskComplete
        layer4 --> layer5 : taskComplete
        layer5 --> layer6 : taskComplete
        layer6 --> [*] : taskComplete
    }

    note right of idle
        current_layer = 0
        Sin agentes ejecutados
    end note

    note right of done
        current_layer = 6
        Todos los agentes done
    end note

    note right of error
        current_layer = N (capa fallida)
        agent.status = error
        error_message presente
    end note
```

## Transiciones permitidas

| Desde | Hacia | Trigger | Endpoint |
|-------|-------|---------|----------|
| `idle` | `running` | Usuario inicia generación | `POST /projects/:id/generate` |
| `running` | `paused` | Usuario pausa entre capas | `POST /projects/:id/pause` |
| `running` | `done` | Capa 6 completa exitosamente | Automático (Worker) |
| `running` | `error` | Agente falla tras 3 reintentos | Automático (Worker) |
| `paused` | `running` | Usuario reanuda | `POST /projects/:id/resume` |
| `error` | `running` | Usuario reintenta | `POST /projects/:id/retry` |
