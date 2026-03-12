# ⛳ Golf Trip

A full-stack web platform for planning and tracking golf trips. Built with:

- **Backend**: Node.js + Express
- **Database**: PostgreSQL via [Neon](https://neon.tech) (serverless)
- **ORM**: [Prisma](https://www.prisma.io)
- **Frontend**: React + Vite
- **Hosting**: [Render](https://render.com)

---

## Project Structure

```
golf-trip/
├── server/          # Express API
│   └── src/
│       ├── index.js        # Entry point
│       ├── routes/         # API route handlers
│       ├── middleware/      # Express middleware
│       └── db/             # Prisma client
├── client/          # React + Vite frontend
│   └── src/
│       ├── pages/          # Page components
│       └── components/     # Reusable components
├── prisma/
│   └── schema.prisma       # Database schema
├── render.yaml      # Render deployment config
└── .env.example     # Environment variable template
```

## Data Models

| Model  | Description |
|--------|-------------|
| `Trip` | A golf trip event (name, location, dates) |
| `Player` | A golf player (name, email, handicap) |
| `Round` | A round of golf within a trip (course, date) |
| `Score` | Per-hole score for a player in a round |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trips` | List all trips |
| POST | `/api/trips` | Create a trip |
| GET | `/api/trips/:id` | Get trip details |
| PATCH | `/api/trips/:id` | Update a trip |
| DELETE | `/api/trips/:id` | Delete a trip |
| GET | `/api/players` | List all players |
| POST | `/api/players` | Create a player |
| GET | `/api/players/:id` | Get player details |
| PATCH | `/api/players/:id` | Update a player |
| DELETE | `/api/players/:id` | Delete a player |
| GET | `/api/scores?roundId=` | Get scores (filter by round) |
| POST | `/api/scores` | Record a score |
| PATCH | `/api/scores/:id` | Update a score |
| DELETE | `/api/scores/:id` | Delete a score |

---

## Getting Started

### 1. Clone & Install Dependencies

```bash
git clone <your-repo-url>
cd golf-trip

# Install root dependencies (Prisma)
npm install

# Install server & client dependencies
npm --prefix server install
npm --prefix client install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Neon database connection strings. Get these from your [Neon dashboard](https://console.neon.tech):

- `DATABASE_URL` — pooled connection URL (for runtime queries)
- `DIRECT_URL` — direct connection URL (for Prisma migrations)

### 3. Run Database Migrations

```bash
npm run db:migrate
```

### 4. Start the Development Servers

```bash
npm run dev
```

This starts:
- **API server** at `http://localhost:3001`
- **Frontend** at `http://localhost:5173`

---

## Deploying to Render

This project uses `render.yaml` for [Infrastructure as Code](https://render.com/docs/infrastructure-as-code) deployment.

### Steps

1. Push your code to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect your GitHub repository.
4. Render will detect `render.yaml` and create both services.
5. In the Render dashboard, set the environment variables for the API service:
   - `DATABASE_URL` — your Neon **pooled** connection string
   - `DIRECT_URL` — your Neon **direct** connection string
   - `CLIENT_URL` — the URL of your deployed frontend (e.g., `https://golf-trip-client.onrender.com`)
6. Run your first migration manually or via a one-off job:
   ```bash
   npx prisma migrate deploy
   ```

### Neon PostgreSQL

1. Create a free account at [neon.tech](https://neon.tech).
2. Create a new project and database.
3. Copy the **pooled** and **direct** connection strings from the Neon dashboard.
4. Paste them into your `.env` file and Render environment variables.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and client in dev mode |
| `npm run dev:server` | Start server only |
| `npm run dev:client` | Start client only |
| `npm run build` | Build the frontend |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |