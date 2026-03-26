# LivAround — Property Management Platform

Full-stack monorepo: Node.js backend API + Next.js host dashboard.

## Structure

```
livaround/
├── backend/        Node.js + TypeScript + Express + Prisma + PostgreSQL
└── dashboard/      Next.js 14 + TypeScript + Tailwind CSS
```

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- npm 9+

## Setup

### 1. Start the database

```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:generate      # generate Prisma client
npm run db:push          # push schema to DB
npm run db:seed          # seed demo data
npm run dev              # start API on :3001
```

### 3. Dashboard

```bash
cd dashboard
npm install
npm run dev              # start dashboard on :3000
```

Open http://localhost:3000

**Demo login:** `host@livaround.com` / `password123`

## API Overview

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Register host |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET/POST | /api/properties | List / create properties |
| GET/PUT/DELETE | /api/properties/:id | Get / update / delete |
| GET/POST | /api/bookings | List / create bookings |
| POST | /api/bookings/:id/checkin | Check in guest |
| POST | /api/bookings/:id/checkout | Check out guest |
| GET/POST | /api/workers | List / create workers |
| GET/POST | /api/jobs | List / create jobs |
| POST | /api/jobs/:id/dispatch | Dispatch to worker |
| POST | /api/jobs/:id/complete | Mark complete |
| GET/POST | /api/inventory | List / create items |
| GET | /api/inventory/low-stock | Low stock alerts |
| GET/POST | /api/inventory/cabinets | QR-coded supply cabinets |
| GET | /api/analytics/dashboard | Dashboard stats |

## What's Built

### Dashboard pages
- **Overview** — stats, revenue chart, booking sources, upcoming jobs, low stock alerts
- **Properties** — add/edit/delete properties with amenities, Airbnb URL
- **Bookings** — manage bookings, check-in/check-out, multi-source support
- **Jobs** — create cleaning/cooking/driving/maintenance jobs, dispatch to workers, checklists
- **Workers** — gig worker profiles, skills, availability toggle, ratings

- ## License

LivAround is open source under the [AGPL-3.0 license](LICENSE). 
You're free to use, modify, and self-host. If you offer it as a 
hosted service, you must open-source your modifications.
- **Inventory** — per-property stock tracking, low stock alerts, restock modal, QR cabinet support

### Next: Mobile apps (React Native / Expo)
- **Guest App** — request services, concierge chat
- **Worker App** — job notifications (Swiggy-style), accept/decline, property briefings, checklist completion, issue reporting
