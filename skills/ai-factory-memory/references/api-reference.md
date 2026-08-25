# AI Factory Memory API Reference

Base URL: `$AI_FACTORY_API_URL` (default: `https://api.aiappnation.com`)

**Authentication required.** Send `-H "X-API-Key: $FACTORY_API_KEY"` on every call. `auth_middleware.py` returns `401 {"error":"Missing API key"}` without it, and `curl -s` hides the error (silent failure — this is what stalled the memory store after 2026-05-26). Set the key first (fallback = the same infra key the session hooks use):

```bash
export AI_FACTORY_API_URL="${AI_FACTORY_API_URL:-https://api.aiappnation.com}"
export FACTORY_API_KEY="${FACTORY_API_KEY:?not set - run: source ~/.zshenv}"
```

## POST /v1/memory — Store a Memory

```bash
curl -s -X POST "$AI_FACTORY_API_URL/v1/memory" \
  -H "X-API-Key: $FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "fix",
    "title": "Fixed 401 on ingest endpoint",
    "content": "Root cause: ES256 JWT was incompatible with the middleware. Switched to RS256.",
    "tags": ["agentsource", "auth"],
    "priority": "critical",
    "project": "agentsource"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | yes | One of: `fact`, `fix`, `preference`, `decision`, `discovery`, `process`, `architecture` |
| `title` | string | yes | Short descriptive title (2-8 words) |
| `content` | string | yes | Detailed content with specific IDs, commands, configs |
| `tags` | string[] | no | Tags for filtering (project slugs, topics) |
| `priority` | string | no | `normal` (default), `important`, `critical` |
| `project` | string | no | Project slug for project-scoped storage |

**Response:** Array containing the created memory object with `id`, `category`, `title`, `content`, `tags`, `source`, `priority`, `created_at`.

## GET /v1/memory/preflight — Session Startup Context

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/preflight"
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/preflight?project=agentsource"
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `project` | string | no | Project slug for project-specific context |

**Response:**

```json
{
  "critical_memories": [...],
  "preferences": [...],
  "recent_sessions": [...],
  "project": { ... }
}
```

- `critical_memories`: Hard rules that must never be violated
- `preferences`: User preferences and workflow choices
- `recent_sessions`: Last few session summaries for continuity
- `project`: Project-specific context (if project param provided)

## GET /v1/memory/critical — Critical Memories Only

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/critical"
```

Returns array of all `priority: "critical"` memories. These are hard constraints.

## GET /v1/memory/search — Semantic Search

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/search?q=deploy+agentsource&limit=5"
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/search?q=auth+middleware&limit=3&project=agentsource"
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | yes | Natural language search query |
| `limit` | int | no | Max results (default 5) |
| `project` | string | no | Filter to project-scoped memories only |
| `threshold` | float | no | Min similarity 0-1 (default 0.3) |

**Response:** Array of memory objects ranked by semantic similarity.

## GET /v1/memory — List Memories

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory?limit=10"
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory?category=fix&tag=agentsource&limit=5"
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | int | no | Max results (default 30) |
| `category` | string | no | Filter by category |
| `tag` | string | no | Filter by tag |
| `project` | string | no | Filter by project slug |

## DELETE /v1/memory/{id} — Delete a Memory

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" -X DELETE "$AI_FACTORY_API_URL/v1/memory/<memory-id>"
```

Use to remove duplicates or stale memories. Returns `{"ok": true}`.

## POST /v1/sessions — Log Session Summary

```bash
curl -s -X POST "$AI_FACTORY_API_URL/v1/sessions" \
  -H "X-API-Key: $FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Built ai-factory-memory Paperclip skill. Created SKILL.md and API reference.",
    "project_path": "/Users/cannon/Downloads/LOCAL_APPS/paperclip",
    "tasks_completed": [
      "Created skill SKILL.md with heartbeat integration",
      "Created API reference documentation"
    ],
    "tags": ["paperclip", "infrastructure"]
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | string | yes | What was accomplished (2-3 sentences) |
| `project_path` | string | no | Working directory path |
| `tasks_completed` | string[] | no | List of completed task descriptions |
| `tags` | string[] | no | Session tags (project names, topics) |

**Response:** `{"status": "ok", "id": "<session-id>"}`

## GET /v1/sessions — List Recent Sessions

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/sessions?limit=5"
```

Returns recent session summaries for continuity context.

## Worked Examples

### Example 1: Bug Fix Memory

After fixing a deployment issue:

```bash
curl -s -X POST "$AI_FACTORY_API_URL/v1/memory" \
  -H "X-API-Key: $FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "fix",
    "title": "Docker build fails on IONOS — node version mismatch",
    "content": "Dockerfile used node:18 but package.json engines required node>=20. Updated Dockerfile base to node:20-slim. Also needed to add --max-old-space-size=4096 for the build step due to 4GB RAM on VPS.",
    "tags": ["agentsource", "docker", "ionos"],
    "priority": "important"
  }'
```

### Example 2: Decision Memory

After choosing an approach:

```bash
curl -s -X POST "$AI_FACTORY_API_URL/v1/memory" \
  -H "X-API-Key: $FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "decision",
    "title": "Paperclip replaces MC dashboard, keeps memory API",
    "content": "Paperclip AI handles task management, agent coordination, budgets, heartbeats. AI Factory API keeps handling semantic memory (Qdrant), session logs, deploy tools. Bridge is the ai-factory-memory skill injected into every agent.",
    "tags": ["paperclip", "mission-control", "infrastructure"],
    "priority": "important"
  }'
```

### Example 3: Search Before Modifying

Before changing any config or metadata:

```bash
# Check if there are existing rules about this
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/search?q=supabase+infrastructure+rules&limit=3"

# Response will include the critical memory:
# "NEVER suggest Supabase or Vercel — Cannon has corrected this multiple times"
```

### Example 4: Correction → Critical Memory

When Cannon corrects you:

```bash
curl -s -X POST "$AI_FACTORY_API_URL/v1/memory" \
  -H "X-API-Key: $FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "preference",
    "title": "Never suggest Supabase or Vercel",
    "content": "All projects self-hosted on IONOS VPS. Cannon has corrected this multiple times. Default stack: Next.js + Node.js/Python + Postgres + Qdrant + Caddy — all on VPS.",
    "tags": ["infrastructure"],
    "priority": "critical"
  }'
```
