---
name: ai-factory-memory
description: >
  Persistent semantic memory via AI Factory API (Postgres + Qdrant). Use at
  heartbeat start for context preflight, after every fix/decision/discovery to
  store memories, and before modifying config/metadata to search existing
  knowledge. Enforces the nuclear memory rule: store immediately, never batch.
---

# AI Factory Memory

Persistent memory system backed by Postgres + Qdrant vector search. Every agent in the AI App Factory MUST use this skill to maintain cross-session knowledge.

## Authentication

**Required.** `auth_middleware.py` (APIKeyAuthMiddleware) enforces an API key on every `/v1/*` path except the public inspectrly paths. A keyless request returns `401 {"error":"Missing API key"}` — and because callers use `curl -s`, the failure is **silent** (you'll think the memory stored when it didn't). This is exactly what broke the memory store after 2026-05-26. ALWAYS send the header.

Set these once at the start of your shell session (no key is stored in this repo - it must already be in your environment):

```bash
export AI_FACTORY_API_URL="${AI_FACTORY_API_URL:-https://api.aiappnation.com}"
export FACTORY_API_KEY="${FACTORY_API_KEY:?not set - run: source ~/.zshenv}"
```

Then add `-H "X-API-Key: $FACTORY_API_KEY"` to every curl below. (`X-Factory-Key` and `Authorization: Bearer <key>` also work.)

## Heartbeat Memory Protocol

Integrate with the Paperclip heartbeat procedure at these points:

### Step 1 — Preflight (with Identity)

Immediately after `GET /api/agents/me`, load memory context:

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/preflight?project=<project-slug>"
```

Returns: `critical_memories`, `preferences`, `recent_sessions`, `project` context. Read the critical memories — these are hard constraints that must never be violated.

Also load critical rules:

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/critical"
```

### Step 7 — Store During Work (NUCLEAR RULE)

**!! THIS IS THE #1 RULE. ZERO TOLERANCE. !!**

After EVERY one of these events, you MUST store a memory BEFORE doing ANYTHING else:

- Fixed a bug → `store` IMMEDIATELY
- Made a decision → `store` IMMEDIATELY
- Discovered a fact → `store` IMMEDIATELY
- Completed a feature → `store` IMMEDIATELY
- Deployed something → `store` IMMEDIATELY
- Received a correction → `store` with `priority: "critical"` IMMEDIATELY

**SELF-CHECK after every action:** "Did I just fix/decide/discover/complete/deploy something? If YES → store is my NEXT action. No exceptions. No batching. No 'I'll do it later.'"

```bash
curl -s -X POST "$AI_FACTORY_API_URL/v1/memory" \
  -H "X-API-Key: $FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "fix",
    "title": "Short descriptive title (2-8 words)",
    "content": "Detailed content with IDs, commands, configs",
    "tags": ["project-slug", "topic"],
    "priority": "normal"
  }'
```

### Before Step 8 — Search Before Modifying

Before modifying metadata, config, copyright, URLs, legal fields, or anything that has been corrected before:

```bash
curl -s -H "X-API-Key: $FACTORY_API_KEY" "$AI_FACTORY_API_URL/v1/memory/search?q=<query>&limit=3"
```

Returns an array of matching memories ranked by semantic similarity.

### After Step 9 — Session Log on Exit

Before exiting the heartbeat, log what was accomplished:

```bash
curl -s -X POST "$AI_FACTORY_API_URL/v1/sessions" \
  -H "X-API-Key: $FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "What was accomplished (2-3 sentences)",
    "project_path": "/path/to/working/directory",
    "tasks_completed": ["task 1", "task 2"],
    "tags": ["project-slug"]
  }'
```

## Memory Categories

| Category | When to Use |
|----------|-------------|
| `fact` | Project facts, infrastructure details, access credentials |
| `fix` | Bug fixes with root cause and solution |
| `preference` | User preferences, workflow choices |
| `decision` | Architecture or design decisions with rationale |
| `discovery` | New findings about systems, APIs, or tools |
| `process` | Workflow patterns, deployment steps |
| `architecture` | System design, data models, integration patterns |

## Priority Levels

| Priority | When to Use |
|----------|-------------|
| `critical` | Hard rules from corrections. Surfaced every session. NEVER violate. |
| `important` | Key facts. Surfaced at session start. |
| `normal` | Standard memories. Found via search. |

**Upgrade rule:** When corrected on something → store as `critical`. When something is repeated → upgrade to `important`.

## Memory Hygiene

1. **Search before storing** — don't create duplicates
2. **Be specific** — "Fixed 401 on website-ingest — ES256 JWT incompatible" not "Fixed a bug"
3. **Tag consistently** — use project slugs: `agentsource`, `scoresnap`, `servcall`, `tryanai`
4. **Include IDs and commands** — future agents need exact details, not vague summaries
5. **Never speculate** — if you haven't verified by reading code, say "let me check"

## Key Endpoints Reference

| Action | Method | Endpoint |
|--------|--------|----------|
| Session preflight | GET | `/v1/memory/preflight?project=<slug>` |
| Critical memories | GET | `/v1/memory/critical` |
| Search memories | GET | `/v1/memory/search?q=<query>&limit=<n>` |
| Store memory | POST | `/v1/memory` |
| Delete memory | DELETE | `/v1/memory/<id>` |
| List memories | GET | `/v1/memory?limit=<n>&category=<cat>&tag=<tag>` |
| Log session | POST | `/v1/sessions` |
| List sessions | GET | `/v1/sessions?limit=<n>` |

🛑 **THERE IS NO READ-BY-ID. `GET /v1/memory/<id>` returns `{"detail":"Method Not Allowed"}`** — and that is VALID JSON, so a verification loop that json-parses the reply and prints on a successful parse reports **OK for every row while having read nothing**. (Only `DELETE /v1/memory/<id>` exists.) To confirm a write landed, use **`GET /v1/memory?limit=<n>`** and match on the id prefix, or `search` with a distinctive phrase from the memory's own text.

🛑 **AND THE POST RESPONSE IS AN ECHO OF YOUR REQUEST, NOT A READ OF THE STORED ROW — re-read the field you set.** Of 8 memories written in one session (2026-08-25), seven kept the priority sent and **one did not**: `5e5e3273` was sent `priority: important`, the POST echoed back `"priority": "important"`, and the list endpoint shows it as `normal`. Sibling known behaviour: POST also silently DROPS `project_slug` and `memory_type`. So after a batch of writes, spend one call — `GET /v1/memory?limit=60`, match your ids, compare what you sent against what came back.

⚠️ **A search that returns nothing is NOT proof the write failed.** Same session: a semantic query with poorly-overlapping terms returned five OLDER rows and none of the eight just written, which reads exactly like a storage failure and was not. Re-query with a distinctive phrase from the memory itself, then fall back to the list endpoint, before concluding anything.

For full request/response schemas and worked examples, see [references/api-reference.md](references/api-reference.md).
