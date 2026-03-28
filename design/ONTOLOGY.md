# Ontology

## Core Principle

Every knowledge domain has stable concepts and unstable implementations. The ontology separates them:

- **Primary entities** are stable anchors — they don't change when sources change
- **Container entities** group implementations — they change when sources are amended
- **Secondary entities** (provisions) bridge containers to primaries — they're the mapping layer
- **Authority entities** are the sources that produce containers

## Relationship

```
Authority → Container → Secondary → Primary
```

## Rules

1. Primaries are stable; containers are unstable
2. Prefer relationships over buckets
3. Plain-English naming over jargon
4. IDs are kebab-case slugs
5. Every claim needs a date

## Configuration

The ontology is defined in `project.yml`. Entity names, groups, statuses, and relationships are all configurable. The build script reads this config and generates the site accordingly.

---

## How to Choose Entity Roles

Choosing the right role for each entity is the most important design decision in a Knowledge-as-Code project. Get this wrong and you'll fight the system instead of using it. The decision framework below walks through each role.

### What Makes a Good Primary?

A Primary is a **stable anchor** — a concept that persists even if every source, container, and authority in your knowledge base were replaced.

Ask yourself:
- Would this concept still exist if every regulation/product/standard referencing it disappeared?
- Is this a fundamental idea in the domain, not a specific instance of one?
- Does this concept appear across multiple containers from different authorities?

Good Primaries:
- "Access Control" (exists as a concept regardless of which regulation mandates it)
- "Image Generation" (exists as a capability regardless of which product implements it)
- "Facilitation" (exists as a practice regardless of which platform supports it)

Bad Primaries:
- "GDPR Article 32" (that's a specific provision — a Secondary)
- "ChatGPT" (that's a product — a Container)
- "NIST" (that's an organization — an Authority)

### What Makes a Good Container?

A Container is a **grouping entity** — something that changes over time, has versions or editions, and holds provisions or features that map to Primaries.

Ask yourself:
- Does this thing get updated, amended, or versioned?
- Does it contain sections, clauses, features, or provisions?
- Could it be deprecated or replaced while the underlying concepts persist?

Good Containers:
- Regulations (amended, versioned, eventually superseded)
- Products (updated, features added/removed, eventually discontinued)
- Frameworks (revised, new editions published)

Bad Containers:
- Abstract concepts (those are Primaries)
- Organizations (those are Authorities)

### What's an Authority?

An Authority is a **source entity** — the organization, body, or producer that creates and publishes Containers.

Ask yourself:
- Does this entity produce or publish the containers?
- Is it an organization, vendor, standards body, or publisher?
- Would it appear in a "published by" or "maintained by" field?

Good Authorities:
- EU Commission (publishes regulations)
- OpenAI (publishes products)
- ISO (publishes standards)

### What's a Secondary?

A Secondary is the **mapping layer** — the specific provision, feature, clause, or implementation that connects a Container to a Primary. This is where the granularity lives.

Ask yourself:
- Is this the specific mechanism by which a container relates to a primary?
- Does it carry detail like effective dates, compliance status, or implementation notes?
- Is it meaningless without both a container and a primary to anchor it?

Good Secondaries:
- "Article 32(1)(a) of GDPR requires encryption" (maps GDPR container to Access Control primary)
- "ChatGPT's DALL-E integration" (maps ChatGPT container to Image Generation primary)
- "Zoom's breakout rooms feature" (maps Zoom container to Facilitation primary)

---

## Worked Examples

### AI Capability Reference

Domain: Tracking AI/ML capabilities across commercial products.

| Role | Entity | Why |
|------|--------|-----|
| Primary | Capability | "Image generation" or "code execution" persist as concepts regardless of products |
| Container | Product | ChatGPT, Claude, Gemini — updated frequently, features added/removed |
| Authority | Provider | OpenAI, Anthropic, Google — the vendors who publish the products |
| Secondary | Implementation | How a specific product implements a specific capability, with status and dates |

Relationship chain: **Provider** (OpenAI) publishes **Product** (ChatGPT) which has **Implementation** (DALL-E integration) of **Capability** (image generation).

### AI Regulation Tracker

Domain: Tracking regulatory obligations across AI/data regulations.

| Role | Entity | Why |
|------|--------|-----|
| Primary | Obligation | "Data quality" or "access control" persist regardless of which regulation mandates them |
| Container | Regulation | EU AI Act, NIST CSF — versioned, amended, eventually superseded |
| Authority | Regulator | EU Commission, NIST — the bodies that publish the regulations |
| Secondary | Provision | Specific article or section that creates the mapping, with effective dates |

Relationship chain: **Regulator** (EU Commission) publishes **Regulation** (EU AI Act) which has **Provision** (Article 10) addressing **Obligation** (data quality).

### Meeting Standards Reference

Domain: Tracking meeting facilitation standards across collaboration platforms.

| Role | Entity | Why |
|------|--------|-----|
| Primary | Standard | Facilitation practices that persist regardless of platform |
| Container | Platform | Zoom, Teams — features change with updates |
| Authority | Standards Body | Organizations that define meeting standards |
| Secondary | Feature | Specific platform implementation of a standard |

Relationship chain: **Standards Body** publishes **Platform** support for **Feature** (breakout rooms) implementing **Standard** (small-group facilitation).

---

## Common Anti-Patterns

### Making Unstable Things Primary

If your Primary changes when a source document is updated, you've picked the wrong entity. Primaries should survive the deletion of every container. If you make "GDPR" your Primary, what happens when GDPR is superseded? All your mappings break. Instead, make the underlying obligations Primary — they'll persist across whatever regulation replaces GDPR.

### Skipping the Secondary Layer

It's tempting to map containers directly to primaries. Don't. The Secondary layer carries the granularity: which specific article, which specific feature, what the effective date is, what the compliance status is. Without it, you lose the ability to say "Section 4.2 of ISO 27001 implements Access Control" — you can only say "ISO 27001 relates to Access Control," which is far less useful.

### Over-Nesting Entities

Keep the hierarchy flat: Authority, Container, Secondary, Primary. Don't introduce sub-containers or meta-authorities. If you feel the need to nest, you probably need to split into a second Knowledge-as-Code project or reconsider your entity boundaries.

### Domain-Specific Fields in the Build Script

If you find yourself editing `build.js` to handle domain-specific logic, stop. That logic belongs in `project.yml` configuration. The build script should be domain-agnostic — it reads config and generates output. Domain knowledge lives in the config and data files, not in code.

---

## Questions to Ask When Starting a New Project

Use these questions to guide your ontology design:

1. **What are the fundamental concepts in your domain that won't change even if sources change?** These are your Primaries. They should be abstract enough to survive the replacement of any specific container.

2. **What are the things that group or contain information about those concepts?** These are your Containers. They typically have versions, dates, or change over time.

3. **Who or what produces or publishes those groupings?** These are your Authorities. They're usually organizations, vendors, or standards bodies.

4. **How do the groupings connect to the fundamentals?** These are your Secondaries. They're the specific provisions, features, clauses, or implementations that create the bridge between containers and primaries.
