# TZAHU CRM — MCP Architecture

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [MCP Server](#2-mcp-server)
3. [Resource URIs](#3-resource-uris)
4. [Tools](#4-tools)
5. [Tool Definitions](#5-tool-definitions)
6. [Tool Execution Flow](#6-tool-execution-flow)
7. [Prompt Templates as MCP Resources](#7-prompt-templates-as-mcp-resources)
8. [Authentication](#8-authentication)
9. [Client Support](#9-client-support)
10. [Registry](#10-registry)
11. [Security](#11-security)

---

## 1. Overview

The Model Context Protocol (MCP) server exposes TZAHU CRM capabilities as standardized resources and tools that any MCP-compatible client can discover and invoke. This enables AI assistants, custom UIs, Slack bots, VS Code extensions, and other clients to interact with CRM data securely.

MCP follows the client-server model:
- **MCP Server** (TZAHU AI Gateway): Exposes CRM resources and tools
- **MCP Clients**: LLM hosts (Claude Desktop), custom applications, IDE extensions
- **Transport**: JSON-RPC over HTTP/SSE (Server-Sent Events) or stdio

### 1.1 Architecture

```
┌──────────────────┐     ┌─────────────────────────────────────┐
│  MCP Client       │     │        TZAHU MCP Server             │
│                   │     │                                     │
│  Claude Desktop ──┼─────┼──► Resource Handler ──► CRM API    │
│  VS Code Ext ─────┼─────┼──► Tool Executor ────► Django API  │
│  Slack Bot ───────┼─────┼──► Prompt Provider ──► AI Gateway  │
│  Custom UI ───────┼─────┼──► Auth Validator ──► JWT Check   │
│                   │     │                                     │
└──────────────────┘     └─────────────────────────────────────┘
```

### 1.2 Transport Protocol

```json
// JSON-RPC 2.0 over HTTP POST
// Endpoint: /v1/mcp

// Request:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_contacts",
    "arguments": {
      "query": "Acme Corp",
      "limit": 10
    }
  }
}

// Response:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 contacts at Acme Corp:\n1. John Doe (CEO)\n2. Jane Smith (CTO)\n..."
      }
    ],
    "isError": false
  }
}
```

---

## 2. MCP Server

### 2.1 FastAPI Implementation

```python
# ai_gateway/mcp/server.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/v1/mcp")

class MCPRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: int | str
    method: str
    params: dict | None = None

class MCPResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: int | str
    result: dict | None = None
    error: dict | None = None

@router.post("")
async def handle_mcp(
    request: MCPRequest,
    auth: AuthContext = Depends(verify_jwt),
):
    if request.method == "resources/list":
        return MCPResponse(id=request.id, result={
            "resources": await resource_registry.list(auth)
        })
    elif request.method == "resources/read":
        return MCPResponse(id=request.id, result={
            "contents": await resource_registry.read(
                request.params["uri"], auth
            )
        })
    elif request.method == "tools/list":
        return MCPResponse(id=request.id, result={
            "tools": await tool_registry.list(auth)
        })
    elif request.method == "tools/call":
        return MCPResponse(id=request.id, result={
            "content": await tool_executor.execute(
                request.params["name"],
                request.params.get("arguments", {}),
                auth,
            )
        })
    elif request.method == "prompts/list":
        return MCPResponse(id=request.id, result={
            "prompts": await prompt_registry.list(auth)
        })
    elif request.method == "prompts/get":
        return MCPResponse(id=request.id, result={
            "prompt": await prompt_registry.get(
                request.params["name"],
                request.params.get("arguments", {}),
                auth,
            )
        })
    else:
        return MCPResponse(
            id=request.id,
            error={"code": -32601, "message": f"Method not found: {request.method}"},
        )
```

---

## 3. Resource URIs

### 3.1 URI Scheme

```
crm://{entity_type}/{id}
crm://{entity_type}/                        (list/collection)
crm://{entity_type}/{id}/{sub_resource}
crm://org/{org_id}/settings
crm://users/me
```

### 3.2 Resource Catalog

| URI Pattern | Description | Access |
|-------------|-------------|--------|
| `crm://leads/{id}` | Single lead details | org-scoped |
| `crm://leads/` | List leads (paginated) | org-scoped |
| `crm://contacts/` | List contacts (paginated) | org-scoped |
| `crm://contacts/{id}` | Single contact details | org-scoped |
| `crm://opportunities/{id}` | Single opportunity | org-scoped |
| `crm://opportunities/` | List opportunities | org-scoped |
| `crm://accounts/{id}` | Single account | org-scoped |
| `crm://accounts/` | List accounts | org-scoped |
| `crm://pipelines/{id}` | Pipeline definition | org-scoped |
| `crm://pipelines/{id}/stages` | Pipeline stages | org-scoped |
| `crm://reports/{id}` | Report definition and data | org-scoped |
| `crm://reports/` | List available reports | org-scoped |
| `crm://users/me` | Current user profile | user-scoped |
| `crm://users/{id}` | User details | org-scoped |
| `crm://org/{id}` | Organization details | org-scoped |
| `crm://org/{id}/settings` | Org settings | admin-scoped |
| `crm://workflows/{id}` | Workflow definition | org-scoped |
| `crm://workflows/` | List workflows | org-scoped |

### 3.3 Resource Representation

```json
// crm://leads/lead_uuid_123
{
  "uri": "crm://leads/lead_uuid_123",
  "name": "Lead: John Doe (Acme Corp)",
  "description": "Lead #123 - VP of Engineering at Acme Corp",
  "mimeType": "application/json",
  "text": "Lead: John Doe\nCompany: Acme Corp\nTitle: VP of Engineering\nScore: 85\nStatus: Qualified\n...",
  "metadata": {
    "entity_type": "lead",
    "entity_id": "lead_uuid_123",
    "organization_id": "org_uuid",
    "updated_at": "2026-07-27T10:30:00Z"
  }
}
```

### 3.4 Resource Templates

```json
{
  "uriTemplate": "crm://leads/{id}",
  "name": "Lead by ID",
  "description": "Access individual lead details",
  "mimeType": "application/json",
  "variables": [
    {
      "name": "id",
      "description": "Lead UUID",
      "required": true
    }
  ]
}
```

---

## 4. Tools

### 4.1 Tool Catalog

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `search_contacts` | Search contacts by name, email, company | query, limit, offset |
| `get_lead` | Get lead details by ID | lead_id |
| `create_lead` | Create a new lead | first_name, last_name, email, company, phone |
| `update_lead` | Update lead fields | lead_id, field_updates |
| `create_opportunity` | Create an opportunity | lead_id, name, amount, pipeline_stage |
| `get_pipeline_stage` | Get pipeline stage details | stage_id |
| `update_deal_stage` | Move opportunity to a new stage | opportunity_id, stage_id |
| `send_email` | Send an email to a contact | to, subject, body, cc |
| `schedule_meeting` | Schedule a meeting/event | title, start_time, end_time, attendees |
| `get_forecast` | Get sales forecast for a period | period, pipeline_id |
| `run_report` | Execute a report | report_id, parameters |
| `get_user_info` | Get current user info | none |
| `list_pipelines` | List available pipelines | none |
| `get_org_settings` | Get organization settings | none |
| `add_note` | Add a note to an entity | entity_type, entity_id, content |

### 4.2 Tool Example

```json
{
  "name": "search_contacts",
  "description": "Search for contacts by name, email, or company name. Returns matching contacts with their details.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (name, email, or company)"
      },
      "limit": {
        "type": "integer",
        "description": "Maximum results to return (1-50)",
        "default": 10,
        "minimum": 1,
        "maximum": 50
      },
      "offset": {
        "type": "integer",
        "description": "Result offset for pagination",
        "default": 0
      }
    },
    "required": ["query"]
  }
}
```

### 4.3 Tool Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 contacts matching 'Acme Corp':\n\n1. **John Doe** - CEO\n   Email: john@acme.com\n   Phone: +1-555-0123\n   Company: Acme Corp\n\n2. **Jane Smith** - CTO\n   Email: jane@acme.com\n   Phone: +1-555-0124\n   Company: Acme Corp\n\n3. **Bob Wilson** - VP Sales\n   Email: bob@acme.com\n   Phone: +1-555-0125\n   Company: Acme Corp"
    }
  ],
  "metadata": {
    "total_results": 3,
    "query_time_ms": 45,
    "tool_version": "1.2.0"
  },
  "isError": false
}
```

---

## 5. Tool Definitions

### 5.1 Tool Schema

```python
@dataclass
class ToolDefinition:
    """Complete definition of an MCP tool."""

    name: str                       # Unique tool name
    description: str                # Human-readable description
    input_schema: dict              # JSON Schema for parameters
    required_permission: str        # Permission required (e.g., "contacts.read")
    execution_url: str              # Internal API endpoint
    cache_ttl: int                  # Cache TTL in seconds (0 = no cache)
    timeout: int                    # Execution timeout in seconds
    idempotent: bool                # Safe to retry without side effects
    version: str                    # Semantic version
    enabled: bool                   # Whether tool is active
    category: str                   # Functional category

    def to_mcp_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
        }
```

### 5.2 Tool Registry Configuration

```python
TOOL_REGISTRY = {
    "search_contacts": ToolDefinition(
        name="search_contacts",
        description="Search contacts by name, email, or company",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "limit": {"type": "integer", "default": 10, "maximum": 50},
            },
            "required": ["query"],
        },
        required_permission="contacts.read",
        execution_url="http://django:8000/api/v1/contacts/search/",
        cache_ttl=60,
        timeout=10,
        idempotent=True,
        version="1.0.0",
        enabled=True,
        category="crm",
    ),
    "create_lead": ToolDefinition(
        name="create_lead",
        description="Create a new lead in the CRM",
        input_schema={
            "type": "object",
            "properties": {
                "first_name": {"type": "string", "description": "First name"},
                "last_name": {"type": "string", "description": "Last name"},
                "email": {"type": "string", "format": "email"},
                "company": {"type": "string"},
                "phone": {"type": "string"},
            },
            "required": ["first_name", "last_name", "email"],
        },
        required_permission="leads.create",
        execution_url="http://django:8000/api/v1/leads/",
        cache_ttl=0,  # No cache for mutations
        timeout=15,
        idempotent=False,
        version="1.0.0",
        enabled=True,
        category="crm",
    ),
    "send_email": ToolDefinition(
        name="send_email",
        description="Send an email to a contact",
        input_schema={
            "type": "object",
            "properties": {
                "to": {"type": "string", "format": "email"},
                "subject": {"type": "string", "maxLength": 998},
                "body": {"type": "string"},
                "cc": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["to", "subject", "body"],
        },
        required_permission="email.send",
        execution_url="http://django:8000/api/v1/email/send/",
        cache_ttl=0,
        timeout=30,
        idempotent=True,
        version="1.0.0",
        enabled=True,
        category="communication",
    ),
}
```

---

## 6. Tool Execution Flow

### 6.1 Execution Pipeline

```
LLM Request ──► 1. Validate JSON-RPC
                     │
                     ▼
                 2. Parse tool name + params
                     │
                     ▼
                 3. Check tool exists + enabled
                     │
                     ▼
                 4. Validate params against JSON Schema
                     │
                     ▼
                 5. Check permission (requires JWT)
                     │
                     ▼
                 6. Check rate limit (per-org, per-tool)
                     │
                     ▼
                 7. Execute via internal API
                     │
                     ▼
                 8. Transform response to MCP format
                     │
                     ▼
                 9. Log execution (audit)
                     │
                     ▼
                 10. Return to client
```

### 6.2 Execution Implementation

```python
class ToolExecutor:
    """Executes MCP tool calls with validation, permission, and audit."""

    async def execute(
        self,
        tool_name: str,
        arguments: dict,
        auth: AuthContext,
    ) -> list[ContentItem]:
        # 1. Lookup tool
        tool = tool_registry.get(tool_name)
        if not tool:
            raise ToolNotFoundError(tool_name)
        if not tool.enabled:
            raise ToolDisabledError(tool_name)

        # 2. Validate params
        try:
            validate_json_schema(tool.input_schema, arguments)
        except ValidationError as e:
            return [ContentItem(type="text", text=f"Invalid parameters: {e}")]

        # 3. Check permission
        if not auth.has_permission(tool.required_permission):
            return [ContentItem(type="text", text=f"Permission denied: {tool.required_permission}")]

        # 4. Rate limit check
        await rate_limiter.check(f"mcp:{auth.org_id}:{tool.name}", limit=100, window=60)

        # 5. Execute
        start_time = time.monotonic()
        try:
            response = await self.http_client.post(
                tool.execution_url,
                json=arguments,
                headers={
                    "Authorization": f"Bearer {auth.jwt}",
                    "X-Organization-ID": str(auth.org_id),
                },
                timeout=tool.timeout,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error("tool_execution_failed", tool=tool_name, error=str(e))
            return [ContentItem(type="text", text=f"Execution failed: {str(e)}")]

        # 6. Transform and log
        duration = int((time.monotonic() - start_time) * 1000)
        await self.audit_log.log(
            tool_name=tool_name,
            arguments=arguments,
            result=data,
            duration_ms=duration,
            auth=auth,
        )

        return [ContentItem(type="text", text=self._format_response(tool, data))]

    def _format_response(self, tool: ToolDefinition, data: dict) -> str:
        """Format API response as human-readable text."""
        if tool.name == "search_contacts":
            contacts = data.get("results", [])
            lines = [f"Found {len(contacts)} contacts:"]
            for c in contacts:
                lines.append(f"- **{c['name']}** ({c['title']})")
                lines.append(f"  Email: {c['email']}, Phone: {c.get('phone', 'N/A')}")
            return "\n".join(lines)
        # Default: return JSON
        return json.dumps(data, indent=2)
```

---

## 7. Prompt Templates as MCP Resources

### 7.1 Prompt Resource Schema

```json
{
  "name": "lead-scoring",
  "description": "Template for scoring leads based on fit and engagement",
  "arguments": [
    {
      "name": "lead_data",
      "description": "JSON object with lead information",
      "required": true
    },
    {
      "name": "org_context",
      "description": "Organization industry and scoring preferences",
      "required": false
    }
  ]
}
```

### 7.2 Available Prompt Templates

| Prompt Name | Description | Use Case |
|-------------|-------------|----------|
| `lead-scoring` | Score leads 0-100 with explanation | Lead qualification |
| `next-best-action` | Recommend next action for a lead | Sales workflow |
| `conversation-summary` | Summarize email/call conversation | Activity log |
| `sales-coach` | Provide coaching on call transcripts | Manager review |
| `deal-insights` | Analyze opportunity health and risks | Pipeline review |
| `email-compose` | Compose email based on context | Communication |
| `sentiment-analyze` | Analyze sentiment of text | Support tickets |

### 7.3 Prompt Retrieval

```python
# Client requests a prompt:
{
  "method": "prompts/get",
  "params": {
    "name": "lead-scoring",
    "arguments": {
      "lead_data": {
        "name": "John Doe",
        "title": "VP Engineering",
        "company": "Acme Corp",
        "company_size": 500,
        "source": "referral"
      },
      "org_context": {
        "industry": "SaaS",
        "min_score_for_qualification": 70
      }
    }
  }
}

# Server response:
{
  "description": "Score a lead based on fit and engagement signals",
  "messages": [
    {
      "role": "system",
      "content": {
        "type": "text",
        "text": "You are a lead scoring AI...\nOrganization Industry: SaaS\nScoring Criteria:\n- Title Seniority: CEO/VP +20, Manager +10\n..."
      }
    },
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "Score this lead:\nName: John Doe\nTitle: VP Engineering\nCompany: Acme Corp\n..."
      }
    }
  ]
}
```

---

## 8. Authentication

### 8.1 JWT Validation

```python
class MCPAuth:
    """Validates JWT tokens for MCP requests."""

    async def verify(self, request: Request) -> AuthContext:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid token")

        token = auth_header[7:]
        try:
            payload = await self._verify_jwt(token)
            return AuthContext(
                user_id=UUID(payload["sub"]),
                org_id=UUID(payload["org"]),
                roles=payload.get("roles", []),
                permissions=set(payload.get("permissions", [])),
                tenant_tier=payload.get("tier", "free"),
            )
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    async def _verify_jwt(self, token: str) -> dict:
        """Verify JWT against Django's public key."""
        # Fetch JWKS from Django (cached for 1 hour)
        jwks = await self.cache.get_or_set(
            "jwks",
            lambda: self.http_client.get("http://django:8000/api/v1/auth/jwks/"),
            timeout=3600,
        )
        public_key = self._get_key_from_jwks(jwks, token)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_exp": True, "verify_aud": False},
        )
        return payload
```

### 8.2 Scoping

Every tool execution is scoped to the authenticated user's organization:

```
JWT Claims:
  sub: user_uuid          (User ID)
  org: organization_uuid  (Organization ID)
  roles: ["admin"]        (Role list)
  permissions: ["contacts.read", "leads.create"]
  tier: "growth"          (Subscription tier)

Scope enforcement:
  1. All queries filter by org_id from JWT
  2. All mutations verify org_id matches JWT
  3. Permission check: requested_action in permissions
  4. Rate limit: applied per (org_id, tool_name)
```

---

## 9. Client Support

### 9.1 MCP Client Configuration

```json
// Claude Desktop configuration
{
  "mcpServers": {
    "tzahu-crm": {
      "command": "npx",
      "args": ["@tzahu/mcp-client"],
      "env": {
        "TZAHU_API_URL": "https://api.tzahu.com",
        "TZAHU_API_KEY": "sk-xxx"
      }
    }
  }
}
```

### 9.2 Supported Clients

| Client | Transport | Authentication | Features |
|--------|-----------|---------------|----------|
| Claude Desktop | stdio | API key | All tools + resources |
| VS Code Extension | stdio | OAuth | Contacts, leads, tasks |
| Slack Bot | HTTP/SSE | Bot token | Search, notifications |
| Custom Web UI | HTTP/SSE | JWT | Full CRM interface |
| API Clients | HTTP/SSE | API key | Programmatic access |
| LangChain Agent | Python SDK | API key | Agent tool integration |

### 9.3 Python SDK Example

```python
from tzahu_mcp import TZAHUClient

client = TZAHUClient(api_key="sk-xxx", base_url="https://api.tzahu.com")

# List tools
tools = await client.list_tools()
for tool in tools:
    print(f"{tool.name}: {tool.description}")

# Call a tool
result = await client.call_tool("search_contacts", {
    "query": "Acme Corp",
    "limit": 5,
})
print(result.text)

# Read a resource
lead = await client.read_resource("crm://leads/lead_uuid_123")
print(lead.text)

# Get a prompt template
prompt = await client.get_prompt("lead-scoring", {
    "lead_data": {"name": "John Doe", "title": "CEO"}
})
```

---

## 10. Registry

### 10.1 Dynamic Tool Discovery

Tools are auto-discovered via a registry that scans registered tools:

```python
class ToolRegistry:
    """Central registry for MCP tools with versioning and deprecation."""

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def unregister(self, name: str) -> None:
        if name in self._tools:
            self._tools[name].enabled = False

    def get(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def list(self, auth: AuthContext) -> list[dict]:
        return [
            t.to_mcp_dict()
            for t in self._tools.values()
            if t.enabled and auth.has_permission(t.required_permission)
        ]

    def register_from_module(self, module: str) -> None:
        """Register all tools defined in a Python module."""
        tools = importlib.import_module(module).TOOLS
        for tool in tools:
            self.register(tool)
```

### 10.2 Tool Versioning

```python
@dataclass
class ToolVersion:
    name: str
    version: str  # semver
    deprecated: bool = False
    deprecation_message: str | None = None
    sunset_date: datetime | None = None
    migration_tool: str | None = None  # Name of replacement tool

# Version history example
TOOL_VERSIONS = {
    "search_contacts": [
        ToolVersion("search_contacts", "1.0.0", deprecated=True,
                     deprecation_message="Use v2 with company filter",
                     migration_tool="search_contacts_v2"),
        ToolVersion("search_contacts_v2", "2.0.0"),
    ]
}
```

### 10.3 Tool Deprecation Flow

1. Tool version N is marked `deprecated=True`
2. Client receives deprecation notice in tool metadata
3. After 90 days (configurable), the tool is disabled
4. Tool is removed from registry after sunset date
5. Migration tool is available during the deprecation window

---

## 11. Security

### 11.1 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Security Layers                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Transport Security (TLS 1.3)                      │
│  Layer 2: Authentication (JWT validation)                   │
│  Layer 3: Authorization (permission check)                  │
│  Layer 4: Tenant Scoping (org_id enforced)                   │
│  Layer 5: Rate Limiting (per-org, per-tool)                 │
│  Layer 6: Input Validation (JSON Schema)                    │
│  Layer 7: Output Sanitization (no PII leakage)              │
│  Layer 8: Audit Logging (every execution)                   │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 Tenant-Scoped Execution

```python
class TenantScopeEnforcer:
    """Ensures all operations are scoped to the authenticated tenant."""

    def enforce(self, tool_name: str, arguments: dict, auth: AuthContext):
        # For resource reads, validate org ownership
        if "lead_id" in arguments:
            lead = leads_repo.get(arguments["lead_id"])
            if lead.organization_id != auth.org_id:
                raise PermissionDenied("Cross-tenant access denied")

        # For mutations, verify org context
        if tool_name in ["create_lead", "send_email"]:
            arguments.setdefault("organization_id", str(auth.org_id))

        # For queries, filter by org
        if tool_name in ["search_contacts"]:
            arguments["organization_id"] = str(auth.org_id)
```

### 11.3 Permission-Checked Execution

```python
class PermissionChecker:
    """Validates that the user has required permissions."""

    PERMISSION_MAP = {
        "search_contacts": "contacts.read",
        "get_lead": "leads.read",
        "create_lead": "leads.create",
        "update_lead": "leads.update",
        "create_opportunity": "opportunities.create",
        "update_deal_stage": "opportunities.update",
        "send_email": "email.send",
        "schedule_meeting": "calendar.write",
        "get_forecast": "reports.read",
        "run_report": "reports.read",
        "get_user_info": "users.read_self",
        "get_org_settings": "settings.read",
    }

    def check(self, tool_name: str, auth: AuthContext) -> bool:
        required = self.PERMISSION_MAP.get(tool_name)
        if not required:
            return False
        return required in auth.permissions
```

### 11.4 Rate Limited Execution

```python
# Rate limits per tool category
RATE_LIMITS = {
    "crm": {"requests": 500, "window": 60},       # 500 req/min
    "communication": {"requests": 50, "window": 60},  # 50 req/min
    "reports": {"requests": 20, "window": 60},    # 20 req/min
    "admin": {"requests": 100, "window": 60},     # 100 req/min
}

async def check_rate_limit(tool: ToolDefinition, auth: AuthContext):
    category = tool.category
    limits = RATE_LIMITS.get(category, {"requests": 100, "window": 60})
    key = f"mcp:rate:{auth.org_id}:{category}"
    await redis_rate_limiter.check(key, limits["requests"], limits["window"])
