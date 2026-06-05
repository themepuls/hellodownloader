# HelloDownloader

Production-ready AI-powered video downloader SaaS platform.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Next.js 15 │────▶│  NestJS API │────▶│  PostgreSQL      │
│  (apps/web) │     │  (apps/api) │     │  + Prisma ORM    │
└─────────────┘     └──────┬──────┘     └──────────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │   BullMQ    │
                    └──────┬──────┘
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  worker-download   worker-thumbnail   worker-cleanup
         │                 │
         ▼                 ▼
    yt-dlp + FFmpeg    Sharp + Tesseract OCR
         │
         ▼
   Cloudflare R2 / local storage
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, ShadCN-style UI, dark/light mode |
| Backend | NestJS, Prisma, PostgreSQL |
| Queues | Redis + BullMQ |
| Media | yt-dlp, FFmpeg, Sharp, Tesseract OCR |
| Storage | Cloudflare R2 (S3-compatible) |
| Payments | Stripe, Binance Pay, SSLCommerz |

## Monorepo Structure

- `apps/web` — Next.js frontend
- `apps/api` — NestJS REST API
- `apps/worker-*` — BullMQ workers (download, thumbnail, video, cleanup)
- `packages/*` — Shared types, config, database, auth, queue utils
- `storage/` — Local file storage (dev)
- `docker/` — Nginx, Redis, Postgres, worker images

## Features

### Free Plan
- Unlimited downloads, max 720p, ads enabled

### Pro Plan
- 1080p + 4K, thumbnail OCR resize, faster queue, no ads, playlist ZIP, subtitles

### Credit System
| Action | Credits |
|--------|---------|
| Thumbnail resize | 1 |
| 4K export | 3 |
| Playlist ZIP | 5 |

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register |
| POST | `/auth/login` | Public | Login |
| POST | `/auth/refresh` | Public | Refresh token |
| GET | `/auth/me` | JWT | Current user |
| POST | `/downloads/metadata` | Public | Preview video metadata |
| POST | `/downloads` | JWT | Queue download |
| GET | `/downloads` | JWT | Download history |
| POST | `/playlists` | JWT Pro | Queue playlist ZIP |
| POST | `/thumbnails` | JWT Pro | Queue thumbnail resize |
| GET | `/credits` | JWT | Credit balance |
| POST | `/billing/checkout/stripe` | JWT | Stripe checkout |
| POST | `/webhooks/stripe` | Public | Stripe webhooks |
| GET | `/users/dashboard` | JWT | Dashboard stats |
| GET | `/ads/config` | Public | Ad configuration |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16
- Redis 7
- FFmpeg
- yt-dlp

### Setup (local dev — no Docker required)

```bash
# 1. Install dependencies + create SQLite DB
pnpm install
pnpm run setup

# 2. Copy env (defaults work for local dev)
cp .env.example .env

# 3. Start API + Web
pnpm --filter @hellodownloader/api dev    # http://localhost:4000
pnpm --filter @hellodownloader/web dev    # http://localhost:3000
```

Or use the helper script:

```bash
./scripts/dev.sh
```

**Optional:** Redis (faster queues) — `brew install redis && redis-server`  
**Optional:** Docker — `docker compose up -d postgres redis` then set `DATABASE_URL` to PostgreSQL in `.env`

### Docker

```bash
docker compose up -d postgres redis
pnpm db:push
docker compose up api web worker-download worker-thumbnail worker-cleanup
```

## Thumbnail Pipeline

1. Fetch **original** thumbnail via yt-dlp (never AI-generated)
2. OCR text regions with Tesseract
3. Resize to target ratio (16:9, 9:16, 4:5, 1:1) with Sharp
4. Scale text region coordinates proportionally
5. Upscale with Lanczos for upload-ready export
6. Preserve branding and existing text layout

## Payment Integration

- **Stripe**: Subscription checkout + webhook → upgrades user to PRO + credits
- **Binance Pay**: `apps/api/src/payment/binance/` (webhook stub)
- **SSLCommerz**: `apps/api/src/payment/sslcommerz/` (webhook stub)

## Security Best Practices

- JWT access + refresh tokens (bcrypt passwords, 12 rounds)
- Global rate limiting (Throttler)
- Webhook signature verification (Stripe)
- Input validation (class-validator)
- Role-based admin guard
- File retention cron cleanup
- CORS restricted origins

## Environment Variables

See [.env.example](.env.example) for the full list.

## Deployment

1. Provision PostgreSQL, Redis, R2 bucket
2. Set production env vars (strong JWT secrets, Stripe live keys)
3. Run `pnpm build` in CI
4. Deploy API + workers as separate containers
5. Configure Stripe webhook: `https://api.yourdomain.com/api/v1/webhooks/stripe`
6. Point Nginx to web + API upstreams
7. Ensure workers have FFmpeg + yt-dlp installed

## License

MIT — See LICENSE file.
