# Contributing to LivAround

Thanks for your interest in contributing to LivAround! This guide will help you get started.

## Code of Conduct

Be kind, respectful, and constructive. We're building software to help property managers — let's keep the community welcoming for everyone.

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/mohiteu811-cloud/Livaround/issues) first to avoid duplicates
2. Open a new issue using the **Bug Report** template
3. Include: what you expected, what happened, steps to reproduce, and your environment (browser, OS, Node version)
4. Screenshots or screen recordings are extremely helpful

### Suggesting Features

1. Check [Discussions](https://github.com/mohiteu811-cloud/Livaround/discussions/categories/ideas) first — someone may have already suggested it
2. Open a new discussion in the **Ideas** category
3. Describe the problem you're solving, not just the feature you want
4. The community votes on ideas — popular ones get prioritized

### Submitting Code

#### First time? Start here:

1. **Fork** the repository
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Livaround.git
   cd Livaround
   ```
3. **Set up** the development environment:
   ```bash
   cp .env.example .env    # Edit with your local database credentials
   npm install
   npx prisma migrate deploy
   npm run dev
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Making changes:

- Keep PRs focused — one feature or fix per PR
- Write clear commit messages (e.g., `feat: add bulk restock action to inventory`, `fix: booking date picker timezone issue`)
- Add or update tests if your change affects functionality
- Run the linter before committing: `npm run lint`
- Run tests before pushing: `npm run test`

#### Submitting a PR:

1. Push your branch to your fork
2. Open a Pull Request against `main`
3. Fill in the PR template — describe what changed and why
4. Link any related issues (e.g., "Closes #42")
5. Wait for review — we aim to review PRs within 48 hours

### Improving Documentation

Documentation improvements are always welcome and don't require setting up the dev environment:

- Fix typos, improve clarity, add examples
- Add self-hosting guides for different platforms
- Write tutorials or how-to guides
- Translate docs to other languages

### Building Plugins

LivAround has a plugin API for extending the platform. If you want to build an integration:

1. Read the [Plugin Development Guide](docs/plugins/README.md)
2. Plugins can hook into events (booking created, job completed, issue reported)
3. Plugins can add UI panels and register API endpoints
4. Share your plugin on the marketplace or keep it private

## Development Guidelines

### Code Style

- **TypeScript** — Use strict mode, avoid `any` types
- **React** — Functional components with hooks, no class components
- **Tailwind CSS** — Use utility classes, avoid custom CSS files
- **Naming** — Use descriptive names. `getAvailableWorkers()` not `getAW()`
- **Files** — One component per file. Name files after the component they export

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add weekly job calendar view
fix: resolve timezone offset in booking dates
docs: add self-hosting guide for Railway
chore: update Prisma to v5.x
refactor: simplify worker dispatch algorithm
test: add integration tests for revenue module
```

### Branch Naming

```
feature/plugin-api
fix/booking-timezone
docs/self-hosting-guide
chore/dependency-update
```

### Database Changes

- All schema changes must go through Prisma migrations
- Run `npx prisma migrate dev --name your_migration_name` to create a migration
- Never modify existing migrations — create new ones
- Include seed data updates if your migration adds required fields

### Testing

- Write tests for new features and bug fixes
- Integration tests go in `__tests__/`
- Use Playwright for end-to-end tests
- Use Vitest for unit tests
- Run the full suite before submitting: `npm run test`

## Project Structure

```
app/              → Next.js pages and API routes
components/       → Reusable UI components
lib/              → Shared utilities, database client, auth
prisma/           → Database schema, migrations, seeds
public/           → Static assets
docs/             → Documentation and specs
__tests__/        → Test files
```

## Getting Help

- **Questions?** Open a [Discussion](https://github.com/mohiteu811-cloud/Livaround/discussions)
- **Stuck on setup?** Check the README or ask in Discussions
- **Found a security issue?** Email security@livaround.com — do NOT open a public issue

## Recognition

All contributors are recognized in our README and on the LivAround website. Active contributors may be invited to the **Contributor Program** with perks like free Pro hosting and early access to new features.

---

Thank you for helping make LivAround better for property managers everywhere! 🏠
