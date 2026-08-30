# Deploying Senlo on VPS (Docker Compose)

This guide provides step-by-step instructions to deploy Senlo on a virtual private server using Docker and Docker Compose.

## Prerequisites

Docker and Docker Compose are the only requirements. Everything else — Node.js, pnpm, dependencies — is installed inside the image during the build.

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
Go to the deployment directory, create a `.env` file and generate an auth secret:
```bash
cd deploy/vps
cp env.example .env
sed -i.bak "s|YOUR_AUTH_SECRET_HERE|$(openssl rand -base64 32)|" .env && rm .env.bak
```

Then set `NEXT_PUBLIC_APP_URL` in `.env` to the address users will open, including the port:
```
NEXT_PUBLIC_APP_URL="http://your-server-ip:3000"
```

The remaining required values already have working defaults in `env.example`:
- `AUTH_TRUST_HOST` — `true`, needed to authenticate from your server's IP.
- `DATABASE_URL` — points at the included Postgres container.
- `REDIS_URL` — points at the included Redis container.

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

The first build compiles the app from source and takes several minutes. Once it finishes, the application is available at `http://your-server-ip:3000`.

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

#### 4. Firewall (UFW)
If you can't access the site, make sure the port is open:
```bash
ufw allow 3000/tcp
```

## Updates
To update the application to the latest version:
```bash
git pull
docker compose up -d --build
```
