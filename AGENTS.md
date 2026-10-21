# AGENTS.md

## Project Overview

The product description for this project is located at:

`/Cloudroom_Product_Development_Plan.md`

This document is the primary source of truth for business requirements, architecture decisions, and implementation priorities.

---

## Mandatory Discovery Process

Before implementing any feature, component, service, database schema, API, or infrastructure setup:

1. Read and analyze `/Cloudroom_Product_Development_Plan.md`.
2. Review all documented architecture decisions.
3. Do **not** immediately start implementation.
4. Validate the architecture with the user through multiple discovery sessions.
5. Ask questions in batches of **4–5 questions per session**.
6. Continue until all relevant architectural assumptions are validated.
7. After all questions have been answered:
   - Create an `ARCHITECTURE.md` file.
   - Document:
     - Confirmed architecture decisions
     - User-provided clarifications
     - Technical tradeoffs
     - Final implementation approach
     - Open risks and constraints

Implementation may only begin after the discovery process is completed and documented.

---

## Architecture Documentation

Create and maintain:

`/ARCHITECTURE.md`

The file must contain:

- System overview
- Frontend architecture
- Backend architecture
- Database architecture
- Authentication strategy
- API design decisions
- AI integration strategy
- Infrastructure decisions
- Deployment strategy
- Known limitations
- Future considerations

---

## Database

### Primary Database

- PostgreSQL
- Runs locally in Docker

Requirements:

- Use Prisma as the ORM
- All schema changes must be managed through Prisma migrations
- Avoid raw SQL unless a clear performance or capability requirement exists
- Design schemas for maintainability and scalability

---

## Technology Stack

### Frontend

- Next.js
- TypeScript
- TanStack Query
- Zod

### Backend

- Python
- FastAPI

### Database

- PostgreSQL
- Prisma ORM

### AI Integration

Use current Vercel AI SDK documentation and provider documentation as the primary reference when implementing AI-related functionality.

---

## Development Principles

### General Principles

- Prefer existing, proven libraries over building custom solutions.
- Minimize custom utility code when a maintained library exists.
- Prioritize:
  - Simplicity
  - Maintainability
  - Type safety
  - Developer experience
  - Testability

### Code Quality

- Strong TypeScript typing.
- Runtime validation with Zod.
- Clear separation of concerns.
- Consistent naming conventions.
- Self-documenting code whenever possible.

### Architecture

- Keep modules loosely coupled.
- Keep business logic separate from UI.
- Avoid premature optimization.
- Design for feature evolution and extensibility.

---

## Library Selection Policy

The agent may introduce additional libraries when they provide clear value by:

- Reducing custom implementation effort
- Improving reliability
- Increasing maintainability
- Providing industry-standard solutions

Examples include:

- Authentication libraries
- Form management libraries
- Validation tooling
- Logging solutions
- Monitoring solutions
- Caching solutions
- UI component libraries
- Background job frameworks

The agent should document any added dependency and explain its purpose.

---

## Implementation Workflow

### Phase 1: Understanding

- Read `/Cloudroom_Product_Development_Plan.md`
- Identify architectural decisions
- Identify ambiguities
- Prepare discovery questions

### Phase 2: Validation

- Conduct multiple question sessions
- Ask 4–5 questions per session
- Record all answers

### Phase 3: Architecture Definition

- Create `/ARCHITECTURE.md`
- Consolidate all confirmed decisions
- Resolve ambiguities
- Document rationale

### Phase 4: Implementation

- Implement according to:
  - Product plan
  - Confirmed architecture
  - Documented decisions

### Phase 5: Review

Verify:

- Requirements alignment
- Architectural consistency
- Type safety
- Validation coverage
- Database consistency
- Documentation completeness

---

## Output Expectations

Before implementing:

- Product plan reviewed
- Architecture validated with user
- Discovery sessions completed
- `ARCHITECTURE.md` created

After implementing:

- Code is documented
- Architecture remains aligned with decisions
- Added libraries are justified
- Changes remain maintainable and scalable
