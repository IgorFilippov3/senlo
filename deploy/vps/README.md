# Deploying Senlo on VPS (Docker Compose)

This guide provides step-by-step instructions to deploy Senlo on a virtual private server using Docker and Docker Compose.

## Prerequisites

Before you begin, ensure your VPS has the following installed:

1.  **Docker & Docker Compose**: 
    ```bash
    curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
    ```
2.  **Node.js & pnpm** (on the host machine to prepare dependencies):
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    corepack enable
    corepack prepare pnpm@latest --activate
    ```

## Deployment Steps

### 1. Clone the repository
```bash
git clone https://github.com/your-username/senlo.git
cd senlo
```

### 2. Prepare dependencies
It's recommended to run install on the host to ensure `pnpm-lock.yaml` is up to date:
```bash
pnpm install
```

### 3. Configure environment variables
Go to the deployment directory and create a `.env` file:
```bash
cd deploy/vps
cp env.example .env
```

Edit the `.env` file and set the following required values:
- `AUTH_SECRET`: Generate one with `openssl rand -base64 32`.
- `AUTH_TRUST_HOST`: Set to `true` to allow authentication from your server's IP.
- `NEXT_PUBLIC_APP_URL`: Set to `http://your-server-ip:3000`.
- `DATABASE_URL`: Keep the default if using the included Postgres container.

### 4. Advanced Configuration (Optional)
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

### 5. Start the application
```bash
docker compose up -d --build
```

The application will be available at `http://your-server-ip:3000`.

## Management & Troubleshooting

### View logs
To see what's happening inside the application (migrations, user provisioning, errors):
```bash
docker compose logs -f app
```

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
pnpm install
docker compose up -d --build
```
