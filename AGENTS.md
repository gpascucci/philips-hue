# AGENTS.md

## Project Overview
- Monorepo with two apps:
- `frontend/`: React + Vite UI for Hue inventory and room management.
- `backend/`: Spring Boot API proxy to Philips Hue Bridge.

## Source of Truth Docs
- Keep exactly one `README.md` at repo root.
- Do not add nested `README.md` files.

## Run Commands
- Backend:
```bash
cd backend
./mvnw spring-boot:run
```
- Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Build Checks
- Frontend build:
```bash
cd frontend
npm run build
```
- Backend compile/tests:
```bash
cd backend
./mvnw test
```

## Config and Secrets
- Bridge settings live in `backend/application-secrets.properties` (gitignored).
- Never commit API keys.

## API Notes
- Base backend route prefix: `/api/hue`
- Includes inventory and room rename endpoints.
