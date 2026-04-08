# Agent Execution Flow — Tool Use Loop

Flujo completo desde que BullMQ Worker recibe un job hasta que se completan las 6 capas.

```mermaid
---
title: Agent Execution Flow — Tool Use Loop
---
flowchart TD
    Start([Job recibido por Worker]) -->|Carga datos| GetProject[Cargar proyecto + spec de BD]
    GetProject --> InitAgents[Crear 6 registros agents en BD<br/>status: pending]
    InitAgents --> Layer1

    subgraph Loop["Para cada capa 1 a 6"]
        Layer1[/Layer 1: DBA Agent/]
        Layer2[/Layer 2: Backend Agent/]
        Layer3[/Layer 3: Frontend Agent/]
        Layer4[/Layer 4: QA Agent/]
        Layer5[/Layer 5: Docs Agent/]
        Layer6[/Layer 6: Deploy Agent/]
    end

    Layer1 --> AgentExec
    Layer2 --> AgentExec
    Layer3 --> AgentExec
    Layer4 --> AgentExec
    Layer5 --> AgentExec
    Layer6 --> AgentExec

    subgraph AgentExec["Ejecucion de Agente"]
        UpdateRunning[agent.status = running<br/>WS: agent:started] --> BuildPrompt
        BuildPrompt[Construir prompt<br/>system.md + task.md + contexto<br/>+ archivos de capas previas] --> CallClaude
        CallClaude[Llamar Anthropic API<br/>Claude con Tool Use] --> CheckResponse{Tipo de respuesta}

        CheckResponse -->|tool_use| ExecuteTool[Ejecutar tool<br/>createFile / readFile / listFiles]
        ExecuteTool -->|tool_result| SendResult[Enviar resultado a Claude] --> CallClaude

        CheckResponse -->|taskComplete| AgentDone[agent.status = done<br/>Guardar tokens_input + tokens_output<br/>WS: agent:completed]

        CheckResponse -->|end_turn sin taskComplete| ForceComplete[Forzar completado<br/>Mensaje de warning]
    end

    AgentDone --> NextLayer{Hay mas capas}
    ForceComplete --> NextLayer

    NextLayer -->|Si| Loop
    NextLayer -->|No| ProjectDone

    subgraph ErrorHandling["Manejo de Errores"]
        APIError[Error Anthropic API] --> Retry{Reintentos menor a 3}
        Retry -->|Si| CallClaude
        Retry -->|No| AgentError[agent.status = error<br/>WS: agent:error]
        AgentError --> ProjectError[project.status = error<br/>WS: generation:error]
    end

    ProjectDone[project.status = done<br/>WS: generation:completed<br/>current_layer = 6]
```

## Herramientas disponibles para agentes

| Tool | Descripción | Parámetros |
|------|-------------|------------|
| `createFile` | Crea/sobrescribe archivo en filesystem | `path`, `content` |
| `readFile` | Lee archivo existente del proyecto | `path` |
| `listFiles` | Lista archivos en directorio | `path` (opcional) |
| `taskComplete` | Señala finalización del agente | `summary` |
