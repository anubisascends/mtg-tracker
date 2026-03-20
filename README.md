# MTG Event Tracker

A full-stack web application for running Magic: The Gathering tournaments. Supports Swiss and elimination formats, manual match pairings, deck registration with Scryfall card search, live round timers, and a public event status board.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start — Docker (Recommended)](#quick-start--docker-recommended)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Default Credentials](#default-credentials)
- [Application Walkthrough](#application-walkthrough)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)

---

## Features

### For Players
- Register for upcoming events
- Submit match results directly from your device
- Drop from or undrop from an in-progress event
- **Deck Registration** — build and save personal decks using Scryfall autocomplete, card image previews, and paste-import from Arena / MTGO / Moxfield format
- **My Decks** — maintain a personal deck library and load any saved deck when registering for an event
- View standings and match history

### For Admins
- Create events with configurable format, elimination type (Swiss / Single / Double Elimination), max players, and deck registration requirements
- Manually pair players each round (BYE support)
- Drop / undrop players from active events
- Advance or reverse event phases (Initializing → Drafting → Deck Building → Playing → Completed)
- Round timer with presets
- View all submitted decklists per event
- Manage player registrations

### Public
- Live event status page with standings, match results, and dropped player indicators — no login required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, React Router 7, Axios |
| Backend | ASP.NET Core 9 Web API |
| Database | SQLite via Entity Framework Core 9 |
| Auth | JWT Bearer tokens, BCrypt password hashing |
| Card data | [Scryfall REST API](https://scryfall.com/docs/api) (no key required) |
| Container | Docker + Docker Compose, Nginx |

---

## Prerequisites

### Docker (recommended)
| Tool | Minimum Version |
|---|---|
| Docker Desktop | 4.x |
| Docker Compose | v2 (included with Docker Desktop) |

### Local development
| Tool | Minimum Version | Download |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| .NET SDK | 9.0 | https://dotnet.microsoft.com/download |
| Git | any | https://git-scm.com |

---

## Quick Start — Docker (Recommended)

This is the easiest way to run the full application with a single command.

**1. Clone the repository**
```bash
git clone https://github.com/anubisascends/mtg-tracker.git
cd mtg-tracker
```

**2. Create your environment file**
```bash
cp .env.example .env
```

Open `.env` and set your values:
```env
JWT_SECRET=some-random-32-character-string-here
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=YourSecurePassword123!
ADMIN_USERNAME=admin
```

> **Important:** Use a strong, random `JWT_SECRET` — at least 32 characters. Never commit your `.env` file.

**3. Build and start**
```bash
docker compose up --build
```

**4. Open the app**

| URL | Description |
|---|---|
| `http://localhost` | Main application |
| `http://localhost/status` | Public event status board |

The admin account defined in your `.env` is created automatically on first startup.

---

## Local Development Setup

Run the frontend and backend separately for hot-reload development.

### Backend

```bash
cd backend
dotnet restore
dotnet run
```

The API starts at `http://localhost:5000`. Swagger UI is available at `http://localhost:5000/swagger`.

The SQLite database file `mtg-dev.db` is created automatically in the `backend/` folder on first run. All migrations are applied automatically at startup.

**Development credentials** (from `appsettings.Development.json`):
```
Admin email:    admin@mtg.local
Admin password: Admin123!
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies all `/api` requests to the backend at `http://localhost:5000`.

---

## Environment Variables

These are set in `.env` for Docker, or in `appsettings.json` / `appsettings.Development.json` for local runs.

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | JWT signing key. Must be ≥ 32 characters. |
| `ADMIN_EMAIL` | Yes | Email for the auto-created admin account. |
| `ADMIN_PASSWORD` | Yes | Password for the auto-created admin account. |
| `ADMIN_USERNAME` | No | Username for admin (default: `admin`). |
| `ConnectionStrings__DefaultConnection` | No | SQLite path (default: `/app/data/mtg.db`). |

---

## Default Credentials

### Docker
Credentials are whatever you set in your `.env` file.

### Local Development
| Role | Username | Email | Password |
|---|---|---|---|
| Admin | `admin` | `admin@mtg.local` | `Admin123!` |

> Change these before deploying to any shared or public environment.

---

## Application Walkthrough

### Public Status Board — `/status`
No login required. Shows all active events, standings, current round pairings, and dropped players (shown in red with strikethrough).

### Player Portal

**Events — `/events`**
Browse upcoming and in-progress events. Register for open events. A proxy policy notice is shown for events that require deck registration.

**Event Detail — `/events/:id`**
- Submit your match result for the current round
- Drop from or undrop from the event
- Open the deck submission page (for events requiring deck registration)

**Deck Submission — `/events/:id/deck`**
*Only available for events with deck registration enabled.*

Two ways to add cards:
- **Search & Add** — type a card name, select from Scryfall autocomplete, see a card image preview, set quantity/section, press Enter or click Add
- **Paste Import** — paste a full decklist from Arena, MTGO, Moxfield, or plain `4 Card Name` format; preview the parsed list, then merge into or replace the current deck

Load from a saved deck using the dropdown at the top of the page.

**My Decks — `/my-decks`**
Personal deck library independent of any event. Build, edit, and delete decks. Saved decks appear in the load dropdown on any event's deck submission page.

### Admin Portal

**Manage Events — `/admin/events`**
- Create / edit events (name, format, date, max players, elimination type, deck registration settings)
- Advance or reverse event status (Planning → Upcoming → In Progress) and run phase (Initializing → Playing → Completed)
- Open the **Matches** panel to create pairings, record results, manage the round timer, and view standings
- Open the **Players** panel to register or remove players
- Open the **Decks** panel to view all submitted decklists for events requiring deck registration

**Creating a pairing**
In the Matches panel, select Player 1 and Player 2 (or BYE) from the unpaired players list and click Pair. Delete a pending pairing with the ✕ button before results are recorded.

---

## API Documentation

Swagger UI is available when the backend is running:

- **Local:** `http://localhost:5000/swagger`
- **Docker:** `http://localhost/api/swagger` *(if exposed)*

All endpoints except `/api/auth/login`, `/api/auth/register`, and `/api/events/*/status` require a `Bearer` token in the `Authorization` header.

---

## Project Structure

```
mtg-tracker/
├── backend/                   # ASP.NET Core 9 Web API
│   ├── Controllers/           # API route handlers
│   ├── Data/
│   │   ├── Migrations/        # EF Core migration files
│   │   └── AppDbContext.cs
│   ├── DTOs/                  # Request / response shapes
│   ├── Models/                # EF Core entity models
│   ├── Services/              # Business logic
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── Dockerfile
│   └── Program.cs
│
├── frontend/                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── api/               # Axios API clients (events, decks, matches…)
│   │   ├── components/        # Shared UI (Layout, PrivateRoute…)
│   │   ├── context/           # AuthContext (JWT storage)
│   │   ├── hooks/             # useIsMobile, useTimer
│   │   └── pages/
│   │       ├── admin/         # ManageEventsPage, EventFormPage…
│   │       ├── player/        # EventDetailPage, MyDecksPage, DeckSubmissionPage…
│   │       └── public/        # EventStatusPage, EventStatusListPage
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
│
├── .env.example               # Environment variable template
├── docker-compose.yml
└── README.md
```

---

## Screenshots

> Screenshots coming soon. To add your own, run the app and capture the following pages:
> - Public event status board (`/status/:id`)
> - Player event detail with active match card (`/events/:id`)
> - Deck submission page with card search and paste import (`/events/:id/deck`)
> - My Decks library (`/my-decks`)
> - Admin event management with match panel (`/admin/events`)
