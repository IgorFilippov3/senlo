<p align="center">
  <img src="https://github.com/user-attachments/assets/be7f4f59-3180-4a03-b016-b85311a22b19" alt="Senlo logo" width="280" />
</p>

# Senlo — Infrastructure for Transactional & Lifecycle Emails

Senlo is an open-source, developer-first email infrastructure designed to handle the entire lifecycle of your product's emails. It provides the tools to build, manage, and deliver transactional and lifecycle emails without being locked into a specific delivery provider.

## Quick Start

Run a full Senlo instance locally. Docker is the only requirement.

```bash
git clone https://github.com/IgorFilippov3/senlo.git
cd senlo/deploy/vps
cp env.example .env
sed -i.bak "s|YOUR_AUTH_SECRET_HERE|$(openssl rand -base64 32)|" .env && rm .env.bak
docker compose up -d --build
```

The first build compiles the app from source and takes a few minutes. When it finishes, open **http://localhost:3000** and create an account — you land in an example project with four ready-made templates you can open in the visual editor right away.

To start sending, add your email provider credentials (Resend or Postmark) on the **Providers** page. The interactive API reference lives at **`/api-docs`** on your own instance.

For a production setup on a server, see the [VPS Deployment Guide](./deploy/vps/README.md).

## Why Senlo?

Most email platforms are built for marketing teams, bundling editing, sending, and analytics into closed ecosystems. Senlo is built for **developers and product teams** who need:

- **Full Control**: Self-host your email infrastructure and keep your data on your own servers.
- **Provider Agnostic**: Switch between AWS SES, Resend, Mailgun, or SMTP without changing your code.
- **Visual & Code**: A powerful drag-and-drop builder for designers, with a clean API for developers.
- **Lifecycle Management**: Manage everything from password resets to complex automated onboarding sequences.

## Key Capabilities

- **Visual Drag-and-Drop Editor**: Build beautiful, responsive templates without writing HTML/MJML.
- **API-First Approach**: Trigger emails, manage contacts, and track events via a robust REST API.
- **Dynamic Personalization**: Use merge tags and conditional logic to tailor content for every recipient.
- **Template Versioning**: Track changes and roll back to previous versions of your email designs.
- **Multi-Project Isolation**: Manage multiple products or environments (Staging/Production) from a single instance.

## Use Cases

- **Transactional Emails**: Reliable delivery for password resets, receipts, and verification codes.
- **Product Lifecycle**: Automated onboarding series, feature announcements, and re-engagement campaigns.
- **Embedded Editor**: Integrate the visual builder directly into your own SaaS product.

## Status

Senlo is currently in active development (MVP stage). We are stabilizing the API and adding core features. Contributions and feedback are welcome!

Check out our [Roadmap](ROADMAP.md) for planned features and upcoming improvements.

## Author

**Igor Filippov**

- GitHub: [@IgorFilippov3](https://github.com/IgorFilippov3)
