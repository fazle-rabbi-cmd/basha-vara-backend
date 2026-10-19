# Basha Vara — Backend Implementation Plan

> **Status:** Planning & Execution Blueprint
> **Stack:** NestJS + TypeScript | PostgreSQL (Docker) | Prisma ORM | Next.js (`../frontend`)

---

## 1. Purpose & Working Rules
This document serves as the implementation blueprint for the Basha Vara backend and frontend integration.

- Work incrementally; preserve working code and established conventions.
- Never claim a test, build, migration, or check passed unless verified.
- Use Prisma migrations for all schema updates (no destructive synchronization).
- Keep secrets in `.env` (gitignored) and maintain `.env.example`.

---

## 2. MVP Scope

### Public Visitors
- Browse published property listings.
- Search/filter by location, rent range, property type, bedrooms, and amenities.
- View listing details and photo galleries.
- Register and log in.

### Tenants
- Manage basic profile.
- Add/remove favourite listings.
- Submit, track, and cancel property visit requests.
- Submit, track, and withdraw rental applications.

### Landlords
- Manage landlord profile.
- Create, edit, preview, publish, pause, archive, or mark listings as rented.
- Manage property photo metadata and amenity associations.
- Review visit requests (accept/decline).
- Review rental applications (shortlist, reject, select final tenant).
- *Note:* Shortlisting is distinct from final tenant selection.

### Out of Scope for Initial MVP
Rent collection, payments, utility billing, leases, deposit settlement, maintenance tickets, chat/messaging, advanced AI recommendations, and complex payroll/ERP features.

---

## 3. Technology & Architecture

- **Architecture:** NestJS + TypeScript (Modular Monolith).
- **Database:** PostgreSQL running in Docker Compose.
- **ORM:** Prisma ORM with versioned migrations.
- **API Standard:** REST endpoints under `/api/v1` documented via Swagger/OpenAPI.
- **Validation:** Class-validator & Class-transformer on DTOs.
- **Security:** Argon2id / bcrypt password hashing; HttpOnly cookie or secure access/refresh token sessions; server-side RBAC & resource ownership authorization guards.

---

## 4. Proposed Data Model

### Identity & Access
- `users`: `id` (UUID), `email` (unique), `phone` (unique), `passwordHash`, `fullName`, `avatarUrl`, `status` (`ACTIVE`, `SUSPENDED`, `PENDING_VERIFICATION`), timestamps.
- `user_roles`: `id`, `userId`, `role` (`TENANT`, `LANDLORD`, `ADMIN`). Unique `(userId, role)`.
- `tenant_profiles`: `id`, `userId` (unique), occupation, move-in date preference, household size, bio, timestamps.
- `landlord_profiles`: `id`, `userId` (unique), display name, contact preference, bio, timestamps.

### Property Catalog
- `properties`: `id`, `landlordId`, `title`, `description`, `propertyType`, `rentAmount`, `depositAmount`, `bedrooms`, `bathrooms`, `areaSqft`, `addressLine` (private), `area`, `city`, `district`, `availableFrom`, `status` (`DRAFT`, `PUBLISHED`, `PAUSED`, `RENTED`, `ARCHIVED`), timestamps.
- `property_photos`: `id`, `propertyId`, `url`, `storageKey`, `altText`, `sortOrder`, timestamps.
- `amenities`: `id`, `name` (unique), `slug`, icon key.
- `property_amenities`: Composite key `(propertyId, amenityId)`.

### Engagement
- `favourites`: `id`, `tenantId`, `propertyId`, timestamps. Unique `(tenantId, propertyId)`.
- `visit_requests`: `id`, `propertyId`, `tenantId`, `requestedSlot`, `message`, `status` (`PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `COMPLETED`), timestamps.
- `rental_applications`: `id`, `propertyId`, `tenantId`, `coverNote`, `status` (`SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED`, `REJECTED`, `WITHDRAWN`, `SELECTED`), timestamps.

---

## 5. Proposed REST API Routes (`/api/v1`)

### Health & Auth
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `PATCH /users/me/tenant-profile`
- `PATCH /users/me/landlord-profile`

### Properties
- `GET /properties` (Public filters: location, rent range, type, amenities)
- `GET /properties/:id`
- `POST /properties` (Landlord only)
- `PATCH /properties/:id` (Owner only)
- `POST /properties/:id/publish`
- `POST /properties/:id/mark-rented`

### Favourites, Visits & Applications
- `GET /me/favourites` | `POST /me/favourites/:propertyId` | `DELETE /me/favourites/:propertyId`
- `POST /properties/:propertyId/visits` | `GET /me/visits` | `GET /landlord/visits` | `PATCH /visits/:id/status`
- `POST /properties/:propertyId/applications` | `GET /me/applications` | `GET /landlord/applications` | `PATCH /applications/:id/status`

---

## 6. Implementation Phases

- **Phase 0:** Docker Compose setup, PostgreSQL container configuration, NestJS setup, Prisma initialization, `.env.example`.
- **Phase 1:** Prisma schema migrations, global validation pipe, exception filters, Swagger, `/health` endpoint.
- **Phase 2:** Auth authentication logic (JWT/Cookie), registration, login, profile management, NestJS Guards for RBAC and Ownership.
- **Phase 3:** Properties module, public filtering, landlord listing lifecycle, photo metadata, amenities association.
- **Phase 4:** Favourites, visit requests, and rental applications state management and transitions.
- **Phase 5:** Integration with Next.js frontend in `../frontend` using typed API client, handling loading/error states.
- **Phase 6:** Automated testing, security checks, environment validation, and final report generation.