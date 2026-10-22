# Deploying Senlo on VPS (Docker Compose)

This guide provides step-by-step instructions to deploy Senlo on a virtual private server using Docker and Docker Compose.

## Prerequisites

- Docker and Docker Compose. Everything else (Node.js, pnpm, dependencies) is installed inside the image during the build.
- A domain (or subdomain) pointing at the server, for HTTPS.
- A reverse proxy on the server: Caddy or nginx (step 5). It is required, not a nice-to-have, see [Why a reverse proxy](#why-a-reverse-proxy).

```bash
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
```

## Deployment Steps

### 1. Clone the repository
```bash
git clone https://github.com/IgorFilippov3/senlo.git
cd senlo
```

### 2. Configure environment variables
Go to the deployment directory, create a `.env` file and generate the two secrets:
```bash
cd deploy/vps
cp env.example .env
sed -i.bak "s|YOUR_AUTH_SECRET_HERE|$(openssl rand -base64 32)|" .env && rm .env.bak
sed -i.bak "s|^SECRETS_KEY=\"\"|SECRETS_KEY=\"$(openssl rand -base64 32)\"|" .env && rm .env.bak
```

- `AUTH_SECRET` signs sessions and the unsubscribe and tracking links in outgoing mail.
- `SECRETS_KEY` encrypts provider credentials (API keys, SMTP passwords) in the database. **Set it now and never change it**, and keep a copy wherever you back up the database: a credential encrypted with one key cannot be read with another. See [Encryption key](#encryption-key).

Then set `APP_URL` in `.env` to the address users will open: your domain, with `https`. Links in outgoing mail point there:
```
APP_URL="https://mail.example.com"
```

Every variable is read when the containers start, so changing one needs a restart (`docker compose up -d`), not a rebuild. If a required value is missing, the app and the worker refuse to start and print what to fix. An existing `.env` with `NEXT_PUBLIC_APP_URL` keeps working.

The remaining required values already have working defaults in `env.example`:
- `AUTH_TRUST_HOST`: `true`, needed to authenticate behind the proxy.
- `DATABASE_URL`: points at the included Postgres container.
- `REDIS_URL`: points at the included Redis container.

Change them only if you run Postgres or Redis outside of this Compose file.

### 3. Advanced Configuration (Optional)
Senlo provides several environment variables to control how the instance behaves:

#### Registration Control
By default, anyone who finds your instance can register.
- `ALLOW_REGISTRATION`: Set to `false` to disable the registration page.

#### Initial User Provisioning
If you disable registration or want to create an admin account automatically during the first deployment:
- `INITIAL_USERS`: A JSON array of users to be created.
  - **Important**: Use double quotes for JSON keys/values and wrap the whole thing in single quotes for the shell.
  - Example: `INITIAL_USERS='[{"name": "Admin", "email": "admin@example.com", "password": "secure_password", "role": "ADMIN"}]'`

When `INITIAL_USERS` are created, they automatically receive a set of example projects and templates.

### 4. Start the application
```bash
docker compose up -d --build
```

The first build compiles the app from source and takes several minutes. The app listens on `127.0.0.1:3000`: reachable from the server itself (`curl -I http://127.0.0.1:3000`), not from outside. The proxy in the next step makes it public.

### 5. Put a reverse proxy in front

#### Caddy (recommended: HTTPS certificates are automatic)
Install Caddy on the server ([caddyserver.com/docs/install](https://caddyserver.com/docs/install)), then put this in `/etc/caddy/Caddyfile`, with your domain:
```
mail.example.com {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Real-IP {remote_host}
    }
}
```
```bash
sudo systemctl reload caddy
```

#### nginx
```nginx
server {
    server_name mail.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Add HTTPS with certbot: `sudo certbot --nginx -d mail.example.com`.

Whichever you use, the `X-Real-IP` line matters: it overwrites whatever a client sent in that header with the address the connection really came from.

Open the web ports in the firewall:
```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

The application is now available at `https://mail.example.com`.

## Why a reverse proxy

Senlo limits sign-in attempts, registrations and API calls per client IP, and takes that IP from the `X-Real-IP` / `X-Forwarded-For` headers a proxy sets. Without a proxy nothing sets them: a client can write any value there and spread its attempts over as many "IPs" as it likes, and a client that sends neither header is not limited by IP at all. That is why the Compose file publishes the app on `127.0.0.1` only. `APP_BIND=0.0.0.0:3000` in `.env` publishes it directly, as older versions did; don't, except for a quick local try-out.

The proxy also gives you HTTPS, which session cookies and the links in your mail should have.

## Encryption key

Provider credentials are stored encrypted with `SECRETS_KEY`. Left empty, it falls back to `LINK_SIGNING_SECRET`, then `AUTH_SECRET`.

- **Changing the key** (or `AUTH_SECRET`, while `SECRETS_KEY` is empty) makes the stored credentials unreadable. Senlo keeps working and marks each affected provider on the Providers page: "Credentials can't be decrypted". Re-enter them there, or re-encrypt everything with the old key (below).
- **Installed before `SECRETS_KEY` existed?** Your credentials are encrypted with `AUTH_SECRET`. To give them their own key, so `AUTH_SECRET` can be rotated later without touching them:
  1. Add `SECRETS_KEY` to `.env` (`openssl rand -base64 32`) and restart: `docker compose up -d`.
  2. Re-encrypt with the old key, which is your `AUTH_SECRET` (or `LINK_SIGNING_SECRET` if you set one):
     ```bash
     docker compose exec -e OLD_SECRETS_KEY="<your AUTH_SECRET>" app pnpm db:reseal-secrets
     ```
  3. The Providers page shows no warnings any more.

The same command rotates `SECRETS_KEY` itself: set the new value, restart, and pass the previous one as `OLD_SECRETS_KEY`.

## Management & Troubleshooting

### View logs
To see what's happening inside the application, worker, or database:
- **Main App**: `docker compose logs -f app`
- **Email Worker**: `docker compose logs -f worker`
- **Database**: `docker compose logs -f db`
- **Redis**: `docker compose logs -f redis`

### Monitoring Queues
To check the status of the email queues on the server:
1. Access Redis CLI: `docker exec -it senlo-redis redis-cli`
2. Run `keys *` to see BullMQ keys or `ping` to check connection.

### Common Issues

#### 1. Authentication Error: "Host must be trusted"
If you see an `UntrustedHost` error when logging in, ensure `AUTH_TRUST_HOST=true` is set in your `.env` and correctly passed in `docker-compose.yml`.

#### 2. Permission Denied (EACCES) in Docker
If the app fails to start with `EACCES: permission denied`, it's usually a Corepack/pnpm cache issue. Our Dockerfile is configured to use a non-root user with a home directory to avoid this. Ensure you are using the latest version of the Dockerfile.

#### 3. Database Connection Issues
Wait a few seconds for the database to become "healthy". The `app` service is configured to wait for the `db` healthcheck before starting.

#### 4. The site does not open
- `curl -I http://127.0.0.1:3000` on the server answers: the app is up, look at the proxy (`journalctl -u caddy` or `/var/log/nginx/error.log`) and at ports 80/443 in the firewall.
- It does not answer: look at `docker compose logs app`.
- Port 3000 does not need to be open in the firewall, and should not be.

#### 5. "Credentials can't be decrypted" on the Providers page
`SECRETS_KEY` (or `AUTH_SECRET`, if `SECRETS_KEY` is empty) differs from the one the credentials were saved with. See [Encryption key](#encryption-key).

## Updates
To update the application to the latest version:
```bash
git pull
docker compose up -d --build
```

**Updating an install from before the reverse proxy requirement:** the app is now published on `127.0.0.1:3000` only, so `http://your-server-ip:3000` stops answering after the update. Set up the proxy (step 5) and point `APP_URL` at its address. Only if you cannot do that right away, add `APP_BIND=0.0.0.0:3000` to `.env` to keep the old behavior for now.
