# Deploying AI Content Studio to Railway

Railway is an excellent platform for deploying this application because it seamlessly supports monorepos, background workers, and managed databases.

This guide will walk you through deploying the Frontend (Next.js), Backend API (FastAPI), Celery Worker, PostgreSQL, and Redis to Railway.

## Prerequisites
1. Push your code to a GitHub repository.
2. Create a [Railway account](https://railway.app/).

---

## Step 1: Provision the Databases

1. In your Railway Dashboard, click **New Project** -> **Deploy from empty project**.
2. Click **Create** -> **Database** -> **Add PostgreSQL**.
3. Click **Create** -> **Database** -> **Add Redis**.

Railway will automatically provision these databases. Once they are ready, they will inject standard environment variables (like `DATABASE_URL` and `REDIS_URL`) into your project.

---

## Step 2: Deploy the Backend API (FastAPI)

1. In the same project, click **Create** -> **GitHub Repo** and select your `ai-content-studio` repository.
2. Once the service is added, click on it and go to **Settings**.
3. Under **Build**:
   - Set **Root Directory** to `/backend`.
   - Railway will automatically detect Python and use Nixpacks to build it based on `requirements.txt`.
4. Under **Deploy**:
   - Set **Custom Start Command** to: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Under **Variables**:
   - Add a `New Variable` -> `Reference Variable` and select the `DATABASE_URL` from PostgreSQL. (Ensure it uses the `postgresql+asyncpg://` scheme. If Railway provides `postgresql://`, you can manually replace it).
   - Add a `New Variable` -> `Reference Variable` and select the `REDIS_URL` from Redis.
   - Add your secrets (`SECRET_KEY`, `JWT_SECRET_KEY`, `ENCRYPTION_KEY`, etc. See your local `.env`).
   - Set `ENVIRONMENT` to `production`.
   - Set `CORS_ORIGINS` to `*` or your frontend URL.
6. Under **Networking**:
   - Click **Generate Domain** (e.g., `ai-content-backend.up.railway.app`). You will need this URL for the frontend.

---

## Step 3: Deploy the Celery Worker

Since the worker uses the same codebase as the backend, we deploy the repository again but change the start command.

1. Click **Create** -> **GitHub Repo** and select your repository again. (You can also right-click your Backend service and select "Duplicate").
2. Go to **Settings** for this new service.
3. Under **General**:
   - Rename the service to `Celery Worker`.
4. Under **Build**:
   - Set **Root Directory** to `/backend`.
5. Under **Deploy**:
   - Set **Custom Start Command** to: `celery -A app.worker.celery_app worker --loglevel=info`
6. Under **Variables**:
   - Copy the exact same environment variables as the Backend API (especially `DATABASE_URL` and `REDIS_URL`).
7. *Note: The worker does not need a public domain generated in Networking.*

---

## Step 4: Deploy the Frontend (Next.js)

1. Click **Create** -> **GitHub Repo** and select your repository a third time.
2. Go to **Settings** for this new service.
3. Under **General**:
   - Rename the service to `Frontend`.
4. Under **Build**:
   - Set **Root Directory** to `/frontend`.
   - Railway will automatically detect Next.js.
5. Under **Variables**:
   - Set `NEXT_PUBLIC_API_URL` to the public domain you generated for the Backend API in Step 2 (e.g., `https://ai-content-backend.up.railway.app`).
6. Under **Networking**:
   - Click **Generate Domain** (e.g., `ai-content-studio.up.railway.app`).

---

## Step 5: Database Migrations

Before using the app, you need to initialize the production database schema.

1. Go to your **Backend API** service in Railway.
2. Click on the **Deployments** tab.
3. Click the **>_ View Logs** button, and in the bottom right corner, click **Terminal** to open a shell inside your running container.
4. Run the Alembic migration command:
   ```bash
   alembic upgrade head
   ```

## Final Verification

1. Open your Frontend's public Railway URL.
2. Attempt to register a new user and log in.
3. Verify that background tasks (like Digital Human creation) are being successfully picked up by the Celery Worker logs.

Your AI Content Studio is now live in production!
