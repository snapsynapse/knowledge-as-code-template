---
name: ontology-design
description: >
  Interactive guide for designing Knowledge-as-Code ontologies. Walks
  through domain analysis and entity role mapping to produce a draft
  project.yml. Use this skill when starting a new KaC project, when
  the user says "design an ontology", "set up a knowledge base", or
  wants to map a domain to the Primary/Container/Authority/Secondary
  entity model.
metadata:
  skill_bundle: ontology-design
  file_role: skill
  version: 1
  version_date: 2026-03-26
  author: Sam Rogers (snapsynapse.com)
  source: https://github.com/snapsynapse/knowledge-as-code-template
---

# Ontology Design Skill

You are helping a user design the ontology for a new Knowledge-as-Code project. Your goal is to understand their domain and map it to the four entity roles: Primary, Container, Authority, and Secondary.

## Process

### Step 1: Understand the Domain
Ask the user: "What domain or subject area is your knowledge base about? Give me a few examples of the kind of information you want to track."

Listen for:
- What concepts they mention (these are candidate entities)
- What changes frequently vs what stays stable
- Who produces or publishes the information

### Step 2: Identify the Stable Anchors (Primary)
Ask: "What are the fundamental concepts in your domain that would persist even if your sources changed or were replaced?"

Guide them:
- Primaries are like "obligations" in compliance — they exist regardless of which regulation defines them
- Primaries are like "capabilities" in product comparison — they exist regardless of which product implements them
- If you deleted all your containers, primaries should still make sense

### Step 3: Identify the Grouping Entities (Container)
Ask: "What are the specific things that contain or implement those fundamental concepts? These typically have versions, dates, or change over time."

Guide them:
- Containers are like regulations, products, frameworks, standards
- They're unstable — they get updated, deprecated, replaced
- They have provisions, features, or sections that map to primaries

### Step 4: Identify the Source Entities (Authority)
Ask: "Who or what produces the containers? Organizations, vendors, standards bodies?"

### Step 5: Identify the Mapping Layer (Secondary)
Ask: "How do containers connect to primaries? What's the specific provision, feature, or clause that creates the relationship?"

Guide them:
- Secondaries are the bridge — "Section 4.2 of ISO 27001 implements the Access Control requirement"
- They carry the detail: effective dates, status, specific requirements

### Step 6: Suggest Groups and Statuses
Based on the identified entities, suggest:
- Group categories for primaries (e.g., governance/technical/operational)
- Status types for containers (e.g., active/draft/deprecated)
- A scope field if applicable (e.g., jurisdiction, market, platform)

### Step 7: Generate Draft project.yml
Output a draft `entities:` section for project.yml with:
- All four entity roles named and configured
- Group categories with suggested colors
- Status types with colors
- Navigation items
- Bridge page configuration

## Reference Material
See design/ONTOLOGY.md in this repository for the full decision framework, worked examples from three live deployments, and common anti-patterns to avoid.

## Worked Examples

### AI Capability Reference (airef.snapsynapse.com)
- Primary: Capability (stable concept like "image generation", "code execution")
- Container: Product (ChatGPT, Codex, Gemini — changes with updates)
- Authority: Provider (OpenAI, Anthropic, Google)
- Secondary: Implementation (how a specific product implements a capability)

### AI Regulation Tracker (aireg.snapsynapse.com)
- Primary: Obligation (access control, data quality — persist across regulations)
- Container: Regulation (EU AI Act, NIST CSF — versioned, amended)
- Authority: Regulator (EU Commission, NIST)
- Secondary: Provision (specific article or section)

### Meeting Standards Reference (meetings.snapsynapse.com)
- Primary: Standard (facilitation practices that persist)
- Container: Platform (Zoom, Teams — features change with updates)
- Authority: Standards Body (organizations defining meeting standards)
- Secondary: Feature (specific platform implementation of a standard)
