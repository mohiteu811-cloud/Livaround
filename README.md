<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/built%20with-Claude%20Code-blueviolet" alt="Built with Claude Code" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
</p>

<h1 align="center">🏠 LivAround</h1>
<p align="center"><strong>The open-source operating system for short-term rental operations.</strong></p>
<p align="center">Manage properties, dispatch workers, track inventory, resolve issues, and report revenue — all from one platform.</p>

<p align="center">
  <a href="https://app.livaround.com">☁️ Hosted Version</a> · 
  <a href="#self-hosting">🐳 Self-Host</a> · 
  <a href="#features">✨ Features</a> · 
  <a href="CONTRIBUTING.md">🤝 Contribute</a> · 
  <a href="https://livaround.com">🌐 Website</a>
</p>

---

## What is LivAround?

LivAround is a property operations platform built for short-term rental hosts and property managers who oversee multiple properties. Unlike booking-focused tools like Guesty or Hostaway, LivAround covers the **operational layer** — the stuff that happens between bookings: worker dispatch, cleaning checklists, inventory management, issue reporting, maintenance workflows, and live GPS tracking.

**Built entirely with AI.** The entire platform was developed by a solo founder using [Claude Code](https://claude.ai/code). This project proves that AI-assisted development enables a single person to build enterprise-grade software.

## Features

LivAround ships with **10 integrated modules** and a **worker mobile app**:

| Module | What it does |
|--------|-------------|
| **Dashboard** | 8 KPI cards, revenue trends, booking source breakdown, recent activity |
| **Properties** | Property profiles with amenities, WiFi/access codes, owner linkage |
| **Bookings** | Multi-channel log (Airbnb, Booking.com, VRBO, Direct) with guest stay links |
| **Jobs & Dispatch** | Create jobs, attach checklists, dispatch to workers, track status |
| **Workers** | Roster with skills, availability, property assignments, and ratings |
| **Inventory** | Per-property stock tracking with thresholds and low-stock alerts |
| **Issues** | Worker-submitted reports with photos, severity levels, resolution tracking |
| **Maintenance** | Request workflow with approval, tradesperson assignment, scheduling |
| **Revenue Reports** | Owner statements with gross/net breakdowns, CSV import, commissions |
| **Operations Guide** | Per-property knowledge base with room-by-room docs and QR labels |
| **Live Tracking** | Real-time GPS map with 15-second worker location updates |
| **Worker Mobile App** | Android app with push notifications, checklists, issue reporting, GPS |

## Why LivAround?

| | LivAround | Guesty | Hostaway | Lodgify |
|---|:---:|:---:|:---:|:---:|
| Worker dispatch | ✅ | ❌ | ❌ | ❌ |
| Inventory tracking | ✅ | ❌ | ❌ | ❌ |
| Live GPS tracking | ✅ | ❌ | ❌ | ❌ |
| Issue reporting | ✅ | ❌ | ❌ | ❌ |
| Maintenance workflow | ✅ | ❌ | ❌ | ❌ |
| Ops guide / QR codes | ✅ | ❌ | ❌ | ❌ |
| Open source | ✅ | ❌ | ❌ | ❌ |
| **Pricing (30 properties)** | **$100/mo** | $480–810 | $600–1,200 | $500+ |

## Self-Hosting

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL](https://www.postgresql.org/) 15+
- [Redis](https://redis.io/) 7+ (optional, for real-time features)

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
npx prisma migrate deploy
npx prisma db seed        # Optional: seed with sample data

# Start development server
npm run dev
```

### Environment Variables

See [`.env.example`](.env.example) for all available configuration options. At minimum you need:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — Random secret for session encryption
- `NEXTAUTH_URL` — Your app URL (e.g., `http://localhost:3000`)

## Hosted Version

Don't want to manage infrastructure? Use our managed cloud at **[app.livaround.com](https://app.livaround.com)**.

| Plan | Price | Best for |
|------|-------|----------|
| **Community** | Free (self-hosted) | Developers, tinkerers, single hosts |
| **Pro** | $10/property/month | Growing hosts who want managed cloud |
| **Agency** | $100/month (unlimited) | Property management companies |

## Project Structure

```
Livaround/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Authentication pages
│   ├── (dashboard)/        # Dashboard and module pages
│   ├── api/                # API routes
│   └── layout.tsx          # Root layout
├── components/             # Reusable UI components
│   ├── ui/                 # Base components (buttons, inputs, cards)
│   └── modules/            # Module-specific components
├── lib/                    # Shared utilities and helpers
│   ├── db.ts               # Database client
│   ├── auth.ts             # Authentication config
│   └── utils.ts            # Utility functions
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Migration files
│   └── seed.ts             # Seed data
├── public/                 # Static assets
├── docs/                   # Documentation
│   ├── ROADMAP.md          # Product roadmap
│   └── specs/              # Feature specifications
├── .env.example            # Environment variable template
├── docker-compose.yml      # Docker setup for self-hosting
├── CONTRIBUTING.md         # Contribution guidelines
├── LICENSE                 # AGPL-3.0 license
└── CLAUDE.md               # Claude Code project instructions
```

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL
- **Authentication:** NextAuth.js
- **Real-time:** WebSockets / Supabase Realtime
- **Mobile:** React Native / Expo (worker app)
- **Hosting:** Vercel (web), Railway/Supabase (database)

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

Ways to contribute:

- 🐛 **Bug reports** — Found a bug? [Open an issue](https://github.com/mohiteu811-cloud/Livaround/issues/new?template=bug_report.md)
- 💡 **Feature requests** — Have an idea? [Start a discussion](https://github.com/mohiteu811-cloud/Livaround/discussions/new?category=ideas)
- 🔧 **Code** — Pick up an issue and submit a PR
- 📝 **Docs** — Improve documentation, add guides, fix typos
- 🌍 **Translations** — Help translate the platform to your language
- 🧩 **Plugins** — Build integrations using our plugin API

## Roadmap

See our [public roadmap](docs/ROADMAP.md) for upcoming features. Key priorities:

- **Q2 2026:** Plugin architecture, GitHub open-source launch, iOS worker app
- **Q3 2026:** Airbnb/Booking.com sync, plugin marketplace, white-label system
- **Q4 2026:** AI auto-scheduling, predictive inventory, smart lock integrations
- **Q1 2027:** Multi-org dashboard, dynamic pricing, guest app

## Community

- 💬 [GitHub Discussions](https://github.com/mohiteu811-cloud/Livaround/discussions) — Ask questions, share ideas
- 🐛 [Issue Tracker](https://github.com/mohiteu811-cloud/Livaround/issues) — Report bugs, request features
- 🌐 [Website](https://livaround.com) — Learn more about the project
- 📧 Email — hello@livaround.com

## Partner Program

Earn recurring commissions by referring property managers to LivAround:

- **Referral Partners:** 15–20% recurring commission
- **Channel Partners:** 25–30% + override commissions
- **Strategic Partners:** Regional distribution rights

Learn more at [livaround.com/#partners](https://livaround.com/#partners).

## License

LivAround is open source under the [AGPL-3.0 license](LICENSE).

You're free to use, modify, and self-host LivAround. If you offer it as a hosted service, you must open-source your modifications. See the [LICENSE](LICENSE) file for details.

## Star History

If LivAround is useful to you, please consider giving it a ⭐ — it helps others discover the project.

---

<p align="center">
  <strong>Built with ❤️ and AI from Goa, India</strong><br>
  <a href="https://livaround.com">livaround.com</a> · <a href="https://app.livaround.com">app.livaround.com</a>
</p>
