# Senlo — Open-Source Email Marketing Infrastructure

**Senlo** is a modern, self-hosted alternative to Mailchimp and Brevo. A powerful open-source email marketing infrastructure that combines a professional visual editor, campaign management, and real-time analytics — all under your own control.

---

## Why Senlo?

Traditional email platforms are often closed-source, expensive, or tied to a specific provider. Senlo breaks these barriers by offering:

- **Full Control**: Host it yourself and own your data.
- **Modern Editor**: A professional drag-and-drop builder (inspired by tools like BeeFree).
- **Multi-Tenancy**: Built-in support for multiple users and projects with strict data isolation.
- **Provider Agnostic**: Use Resend, Mailgun, or any other provider via our flexible integration layer.
- **Transactional Support**: Send triggered emails (receipts, password resets) via a secure API.

---

## Key Features

### 🎨 Visual Email Editor

- **Drag & Drop Builder**: Create professional layouts with Rows, Columns, and Content Blocks.
- **Rich Content Blocks**: Heading, Paragraph, Button, Image, List, Divider, and Socials.
- **Live Preview**: See how your email looks on Desktop and Mobile instantly.
- **Undo/Redo & History**: Full control over your design process.
- **Image Management**: Direct file uploads to your own server.

### 📧 Campaign Management

- **One-off Campaigns**: Send newsletters to your recipient lists.
- **Triggered Emails (API)**: Power your transactional emails with a secure `/api/triggered` endpoint.
- **Personalization**: Use `{{dynamic_tags}}` and custom JSON variables in your designs.
- **Audience Isolation**: Manage contacts and lists per project.

### 📊 Real-time Tracking & Analytics

- **Open Tracking**: Real-time logging of email opens with IP and User-Agent metadata.
- **Click Tracking**: Track every interaction with proxied link redirection.
- **Campaign Results**: Detailed tables of events (SENT, DELIVERED, OPEN, CLICK, etc.).

### 🔒 Security & Multi-tenancy

- **User Authentication**: Secure login/registration powered by Auth.js (NextAuth v5).
- **Private Mode**: Disable public sign-ups for private self-hosted instances.
- **Data Ownership**: Users only see their own projects, templates, and contacts.

---

## Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS.
- **State Management**: Zustand (Immer for state immutability).
- **Backend**: Next.js Server Actions & API Routes.
- **Database**: PostgreSQL with Drizzle ORM.
- **Communication**: Auth.js, Zod (Validation), Resend/Mailgun (Sending).
- **Package Management**: pnpm workspaces (Monorepo).

---

## Author

**Igor Filippov**
- GitHub: [@IgorFilippov3](https://github.com/IgorFilippov3)

---

## Architecture Overview

```text
apps/
  web/                  # Next.js Application (The Dashboard & API)

packages/
  core/                 # Domain models, MJML/HTML renderers, interfaces
  editor/               # The visual builder engine
  ui/                   # Reusable UI component library (design system)
  db/                   # Database schema, migrations, and repositories
```

---

## Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   pnpm install
   ```
2. **Setup your environment**:
   Copy `.env.example` to `apps/web/.env` and fill in your database URL and secret.
3. **Push the schema**:
   ```bash
   pnpm db:push
   ```
4. **Start the dev server**:
   ```bash
   pnpm dev
   ```

### Production Deployment (Self-hosted)

The easiest way to deploy Senlo is using Docker Compose. Check our [VPS Deployment Guide](./deploy/vps/README.md) for step-by-step instructions.

---

## Status

Senlo is currently in active development (MVP stage). We are stabilizing the API and adding core features. Contributions and feedback are welcome!

Check out our [Roadmap](ROADMAP.md) for planned features and upcoming improvements.
