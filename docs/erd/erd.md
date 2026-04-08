# ERD — Sophia Platform

9 tablas, 10 relaciones FK.

```mermaid
---
title: ERD — Sophia Platform (9 tablas, 10 FK)
---
erDiagram
    users {
        uuid id PK
        string name
        string email UK
        string password_hash
        enum role "user | admin"
        boolean email_verified
        timestamp created_at
        timestamp updated_at
    }

    users ||--o{ refresh_tokens : "has many"
    users ||--o{ password_reset_tokens : "has many"
    users ||--o{ projects : "owns many"
    users ||--|| user_settings : "has one"

    refresh_tokens {
        uuid id PK
        uuid user_id FK "references users.id, ON DELETE CASCADE"
        string token UK
        timestamp expires_at
        timestamp created_at
    }

    password_reset_tokens {
        uuid id PK
        uuid user_id FK "references users.id, ON DELETE CASCADE"
        string token UK
        timestamp expires_at
        boolean used
        timestamp created_at
    }

    projects {
        uuid id PK
        uuid user_id FK "references users.id, ON DELETE CASCADE"
        string name
        string description
        enum status "idle | running | paused | done | error"
        jsonb tech_stack
        int current_layer "0-6"
        timestamp started_at
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
    }

    projects ||--o{ project_specs : "has many versions"
    projects ||--o{ agents : "has 6 agents"
    projects ||--o{ generated_files : "produces files"

    project_specs {
        uuid id PK
        uuid project_id FK "references projects.id, ON DELETE CASCADE"
        text content
        int version
        enum status "draft | approved"
        timestamp created_at
        timestamp updated_at
    }

    agents {
        uuid id PK
        uuid project_id FK "references projects.id, ON DELETE CASCADE"
        enum type "dba | backend | frontend | qa | docs | deploy"
        int layer "1-6"
        enum status "pending | running | done | error"
        int tokens_input
        int tokens_output
        int files_generated
        text error_message
        timestamp started_at
        timestamp completed_at
        timestamp created_at
    }

    agents ||--o{ agent_logs : "emits logs"
    agents ||--o{ generated_files : "creates files"

    agent_logs {
        uuid id PK
        uuid agent_id FK "references agents.id, ON DELETE CASCADE"
        enum level "info | warn | error | debug"
        text message
        jsonb metadata
        timestamp created_at
    }

    generated_files {
        uuid id PK
        uuid project_id FK "references projects.id, ON DELETE CASCADE"
        uuid agent_id FK "references agents.id, ON DELETE SET NULL"
        string path
        string language
        int size_bytes
        timestamp created_at
    }

    user_settings {
        uuid id PK
        uuid user_id FK "references users.id, ON DELETE CASCADE"
        text anthropic_api_key_enc
        string anthropic_model
        string theme "light | dark | system"
        boolean email_notifications
        timestamp created_at
        timestamp updated_at
    }
```

## Relaciones FK

| FK | Desde | Hacia | Cardinalidad | ON DELETE |
|----|-------|-------|--------------|----------|
| 1 | `refresh_tokens.user_id` | `users.id` | N:1 | CASCADE |
| 2 | `password_reset_tokens.user_id` | `users.id` | N:1 | CASCADE |
| 3 | `projects.user_id` | `users.id` | N:1 | CASCADE |
| 4 | `user_settings.user_id` | `users.id` | 1:1 | CASCADE |
| 5 | `project_specs.project_id` | `projects.id` | N:1 | CASCADE |
| 6 | `agents.project_id` | `projects.id` | N:1 | CASCADE |
| 7 | `agent_logs.agent_id` | `agents.id` | N:1 | CASCADE |
| 8 | `generated_files.project_id` | `projects.id` | N:1 | CASCADE |
| 9 | `generated_files.agent_id` | `agents.id` | N:1 | SET NULL |
| 10 | `user_settings.user_id` | `users.id` | 1:1 | CASCADE |
