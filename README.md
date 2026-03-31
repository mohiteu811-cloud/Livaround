<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/built%20with-Claude%20Code-blueviolet" alt="Built with Claude Code" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
</p>

<h1 align="center">LivAround</h1>
<p align="center"><strong>The open-source operating system for short-term rental operations.</strong></p>
<p align="center">Manage properties, dispatch workers, communicate with guests, track inventory, resolve issues, and report revenue — all from one platform with AI-powered insights.</p>

<p align="center">
  <a href="https://app.livaround.com">Hosted Version</a> ·
  <a href="#self-hosting">Self-Host</a> ·
  <a href="#features">Features</a> ·
  <a href="CONTRIBUTING.md">Contribute</a> ·
  <a href="https://livaround.com">Website</a>
</p>

---

## What is LivAround?

LivAround is a property operations platform built for short-term rental hosts and property managers who oversee multiple properties. Unlike booking-focused tools like Guesty or Hostaway, LivAround covers the **operational layer** — the stuff that happens between bookings: worker dispatch, cleaning checklists, inventory management, issue reporting, maintenance workflows, real-time messaging, and AI-powered analysis.

**Built entirely with AI.** The entire platform was developed by a solo founder using [Claude Code](https://claude.ai/code). This project proves that AI-assisted development enables a single person to build enterprise-grade software.

## Features

### Core Modules

| Module | What it does |
|--------|-------------|
| **Dashboard** | 8 KPI cards, revenue trends, booking source breakdown, recent activity |
| **Properties** | Property profiles with amenities, WiFi/access codes, owner linkage, room-by-room documentation |
| **Bookings** | Multi-channel log (Airbnb, Booking.com, VRBO, Direct) with guest stay links |
| **Jobs & Dispatch** | Create jobs, attach checklists, dispatch to workers, track status through completion |
| **Workers** | Roster with skills, availability, property assignments, supervisor roles, and ratings |
| **Inventory** | Per-property stock tracking with thresholds, low-stock alerts, and supply cabinet QR codes |
| **Issues** | Worker-submitted reports with photos, severity levels, AI analysis, and resolution tracking |
| **Maintenance** | Request workflow with approval, trade role assignment, tradesman database, and scheduling |
| **Revenue Reports** | Owner statements with gross/net breakdowns, CSV import, commissions, and expense tracking |
| **Operations Guide** | Per-property knowledge base with room-by-room docs, photo galleries, and QR labels |
| **Live Tracking** | Real-time GPS map with 15-second worker location updates |

### 3-Way Messaging System

LivAround includes a real-time messaging system that connects guests, hosts, and workers in a unified experience:

- **Guest-Host conversations** — Guests message hosts through their stay link; hosts respond from the host app or dashboard
- **3-way visibility** — When a guest messages, both the host and assigned workers see it. Workers can respond directly, and the host can intervene at any time
- **Internal Notes (Team Only)** — Hosts and workers can send messages marked "Team Only" that are invisible to the guest — like Intercom/Zendesk internal notes. This lets the team coordinate privately within the same conversation thread
- **Host-Worker & Supervisor-Worker channels** — Separate internal conversation types for team communication
- **Voice messages** — Record and send audio with automatic duration tracking
- **Image & video sharing** — Camera capture and gallery upload with inline previews

### AI-Powered Analysis

Every guest and worker message is analyzed by Claude AI to help hosts take action:

- **Auto-categorization** — Messages are tagged as MAINTENANCE, CLEANING, SAFETY, APPLIANCE, PEST, NOISE, AMENITY, CHECKOUT, or GENERAL
- **Urgency detection** — LOW, MEDIUM, HIGH, or CRITICAL urgency levels
- **Sentiment analysis** — POSITIVE, NEUTRAL, NEGATIVE, or DISTRESSED
- **Suggested actions** — AI proposes actions like CREATE_ISSUE, CREATE_JOB, DISPATCH_WORKER, or AUTO_REPLY with pre-built payloads
- **Suggested replies** — Context-aware draft responses the host can send with one tap
- **Smart filtering** — Trivial messages (greetings, one-word replies) are skipped; analysis is debounced and rate-limited to avoid noise
- **Issue report analysis** — When workers submit issue reports with photos or voice notes, AI analyzes the content and provides suggestion cards to the host

### Voice Translation

Voice messages are automatically transcribed and translated:

- **Speech-to-Text** — Google Cloud Speech-to-Text transcribes audio in the original language
- **Translation** — Transcripts are translated to the host's language via Google Cloud Translate
- **AI pipeline** — Translated text feeds into AI analysis for actionable insights
- **Async processing** — All processing happens in the background without blocking the conversation

### Mobile Apps

**Host App** (React Native / Expo)
- Guest conversation management with AI suggestion cards
- Internal notes toggle for team-only messages
- Worker loop-in — assign workers to guest conversations mid-thread
- Voice message recording and playback
- Push notifications for new messages and jobs
- Property and booking management

**Worker App** (React Native / Expo)
- Unified messages list — all conversations (guest and team) in a single sorted list with colored badges
- Job dispatch with interactive checklists
- Issue reporting with camera, voice notes, and AI analysis
- GPS location sharing for live tracking
- Internal notes toggle for team coordination in guest conversations
- Push notifications for job assignments and messages

**Guest App** (Web — accessible via unique stay link)
- Stay details and check-in/check-out info
- Direct messaging with the host (and workers behind the scenes)
- ID document upload (passport, national ID, driver's license)
- Visitor registration
- Service requests (housekeeping, cooking, driver, car rental)
- Property emergency contacts (police, ambulance, fire — 20+ countries)
- WiFi info, house rules, and operations guide access

### Shift Marketplace (B2B)

A gig-economy module for businesses that need on-demand staffing:

- Client accounts for restaurants, hotels, villas, retail, and events
- Venue management with multiple locations per client
- Shift creation with role, date, time, hourly rate, and headcount
- Worker shift applications with confirmation workflow
- Check-in/check-out tracking and post-shift ratings
- Shift statuses: OPEN, PARTIALLY_FILLED, FILLED, IN_PROGRESS, COMPLETED

## Why LivAround?

| | LivAround | Guesty | Hostaway | Lodgify |
|---|:---:|:---:|:---:|:---:|
| Worker dispatch | Yes | No | No | No |
| 3-way messaging | Yes | No | No | No |
| AI message analysis | Yes | No | No | No |
| Voice translation | Yes | No | No | No |
| Internal notes | Yes | No | No | No |
| Inventory tracking | Yes | No | No | No |
| Live GPS tracking | Yes | No | No | No |
| Issue reporting | Yes | No | No | No |
| Maintenance workflow | Yes | No | No | No |
| Ops guide / QR codes | Yes | No | No | No |
| Shift marketplace | Yes | No | No | No |
| Open source | Yes | No | No | No |
| **Pricing (30 properties)** | **$100/mo** | $480-810 | $600-1,200 | $500+ |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Express.js, TypeScript, Prisma ORM, PostgreSQL |
| **Dashboard** | Next.js 14 (App Router), React, Tailwind CSS, Recharts, Leaflet |
| **Host App** | React Native, Expo SDK 55, Expo Router, Socket.IO |
| **Worker App** | React Native, Expo SDK 55, Expo Router, Socket.IO |
| **Guest App** | Next.js (served from dashboard) |
| **Real-time** | Socket.IO with `/host`, `/guest`, `/worker` namespaces |
| **AI** | Anthropic Claude (Haiku for text, Sonnet for images) |
| **Voice** | Google Cloud Speech-to-Text, Google Cloud Translate |
| **Push Notifications** | Expo Push + Firebase Cloud Messaging |
| **File Storage** | Firebase, Supabase Storage, or AWS S3 (configurable) |
| **Payments** | PayPal, Stripe, Razorpay |
| **Deployment** | Railway (backend), Vercel (dashboard), EAS (mobile) |
| **Auth** | JWT (mobile apps), NextAuth.js (dashboard) |

## Project Structure

```
Livaround/
├── backend/                        # Express.js API server
│   ├── src/
│   │   ├── routes/                 # 27 REST API route files
│   │   ├── middleware/             # Auth, rate limiting
│   │   └── lib/                    # Prisma client, push notifications, billing
│   ├── prisma/
│   │   ├── schema.prisma           # 61 database models
│   │   ├── seed.ts                 # Sample data seeder
│   │   └── seed-contacts.js        # Property contacts seeder
│   └── start.sh                    # Railway startup script
├── commercial/
│   ├── backend-extensions/src/
│   │   ├── routes/                 # Messaging, AI suggestions, host-app endpoints
│   │   └── lib/
│   │       ├── socket.ts           # Socket.IO setup (3 namespaces)
│   │       ├── ai-analyzer.ts      # Claude AI message analysis
│   │       └── voice-translator.ts # Speech-to-text + translation
│   └── host-app/                   # Host mobile app (Expo)
│       └── app/                    # Expo Router pages
├── worker-app/                     # Worker mobile app (Expo)
│   └── app/
│       ├── (tabs)/                 # Tab navigation (properties, jobs, messages, profile)
│       └── conversation/           # Chat screen with internal notes
├── dashboard/                      # Next.js web dashboard
│   └── app/
│       ├── (auth)/                 # Login/registration
│       ├── (dashboard)/            # All module pages
│       └── api/                    # API routes
├── .env.example                    # Environment variable template
├── docker-compose.yml              # Docker setup for self-hosting
├── railway.json                    # Railway deployment config
├── CONTRIBUTING.md                 # Contribution guidelines
└── LICENSE                         # AGPL-3.0
```

## Self-Hosting

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL](https://www.postgresql.org/) 15+

### Quick Start with Docker

```bash
git clone https://github.com/mohiteu811-cloud/Livaround.git
cd Livaround
cp .env.example .env      # Edit with your database credentials
docker compose up -d
```

The app will be running at `http://localhost:3000`.

### Manual Setup

```bash
git clone https://github.com/mohiteu811-cloud/Livaround.git
cd Livaround

# Install dependencies
npm install

# Set up environment
cp .env.example .env      # Edit with your values

# Set up database
npx prisma db push
npx prisma db seed        # Optional: seed with sample data

# Start development server
npm run dev
```

### Environment Variables

See [`.env.example`](.env.example) for all configuration options. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT token signing |
| `NEXTAUTH_SECRET` | Yes | Secret for dashboard session encryption |
| `NEXTAUTH_URL` | Yes | Dashboard URL (e.g., `http://localhost:3000`) |
| `ANTHROPIC_API_KEY` | For AI | Anthropic API key for message analysis |
| `AI_ANALYSIS_ENABLED` | For AI | Set to `true` to enable AI features |
| `GOOGLE_CLOUD_CREDENTIALS` | For voice | Google Cloud service account JSON |
| `GOOGLE_CLOUD_PROJECT_ID` | For voice | Google Cloud project ID |
| `STORAGE_PROVIDER` | For uploads | `firebase`, `supabase`, or `s3` |
| `PAYPAL_CLIENT_ID` | For billing | PayPal app client ID |
| `PAYPAL_CLIENT_SECRET` | For billing | PayPal app secret |

## Hosted Version

Don't want to manage infrastructure? Use our managed cloud at **[app.livaround.com](https://app.livaround.com)**.

| Plan | Price | Best for |
|------|-------|----------|
| **Community** | Free (self-hosted) | Developers, tinkerers, single hosts |
| **Pro** | $10/property/month | Growing hosts — adds messaging, AI, owner reports, shift marketplace |
| **Agency** | $100/month (unlimited) | Property management companies — adds white-label, multi-org |

## API Overview

The backend exposes 27 REST route groups and 3 Socket.IO namespaces:

**Core REST Routes** — `/api/properties`, `/api/bookings`, `/api/jobs`, `/api/workers`, `/api/inventory`, `/api/issues`, `/api/maintenance`, `/api/revenue`, `/api/guide`, `/api/analytics`, `/api/stay`

**Commercial Routes** — `/api/conversations`, `/api/internal-conversations`, `/api/guest-messaging`, `/api/ai-suggestions`

**B2B Routes** — `/api/clients`, `/api/venues`, `/api/shifts`

**Billing Routes** — `/api/billing`, `/api/partners`, `/api/admin`

**Socket.IO Namespaces:**
- `/host` — JWT-authenticated host connections for real-time messaging
- `/guest` — Guest-code-authenticated connections
- `/worker` — JWT-authenticated worker connections

All namespaces support `join_conversation`, `leave_conversation`, `send_message`, `mark_read`, and `typing` events.

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

Ways to contribute:

- **Bug reports** — Found a bug? [Open an issue](https://github.com/mohiteu811-cloud/Livaround/issues/new?template=bug_report.md)
- **Feature requests** — Have an idea? [Start a discussion](https://github.com/mohiteu811-cloud/Livaround/discussions/new?category=ideas)
- **Code** — Pick up an issue and submit a PR
- **Docs** — Improve documentation, add guides, fix typos
- **Translations** — Help translate the platform to your language

## Roadmap

See our [public roadmap](docs/ROADMAP.md) for upcoming features. Key priorities:

- **Q2 2026:** Plugin architecture, GitHub open-source launch, iOS worker app
- **Q3 2026:** Airbnb/Booking.com sync, plugin marketplace, white-label system
- **Q4 2026:** AI auto-scheduling, predictive inventory, smart lock integrations
- **Q1 2027:** Multi-org dashboard, dynamic pricing, expanded guest app

## Community

- [GitHub Discussions](https://github.com/mohiteu811-cloud/Livaround/discussions) — Ask questions, share ideas
- [Issue Tracker](https://github.com/mohiteu811-cloud/Livaround/issues) — Report bugs, request features
- [Website](https://livaround.com) — Learn more about the project
- Email — hello@livaround.com

## Partner Program

Earn recurring commissions by referring property managers to LivAround:

- **Referral Partners:** 15-20% recurring commission
- **Channel Partners:** 25-30% + override commissions
- **Strategic Partners:** Regional distribution rights

Learn more at [livaround.com/#partners](https://livaround.com/#partners).

## License

LivAround is open source under the [AGPL-3.0 license](LICENSE).

You're free to use, modify, and self-host LivAround. If you offer it as a hosted service, you must open-source your modifications. See the [LICENSE](LICENSE) file for details.

## Star History

If LivAround is useful to you, please consider giving it a star — it helps others discover the project.

---

<p align="center">
  <strong>Built with AI from Goa, India</strong><br>
  <a href="https://livaround.com">livaround.com</a> · <a href="https://app.livaround.com">app.livaround.com</a>
</p>
