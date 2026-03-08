# React + Spring Boot Starter

This repository contains a split frontend/backend setup:

- `frontend/`: React + TypeScript app built with Vite
- `backend/`: Spring Boot REST API (Maven), including Hue Bridge proxy endpoints

## Prerequisites

- Node.js 20+
- Java 21+

## Find Your Hue Bridge IP

Use one of these:

- Router DHCP client list (look for Philips Hue Bridge)
- Hue mobile app: `Settings -> My Hue system -> (i) Bridge details`

If you already know it, use that IP directly in config.

## Generate a Hue API Key

1. Press the physical button on top of the Hue Bridge.
2. Within about 30 seconds, run:

```bash
curl -k -X POST https://<bridge-ip>/api \
  -H "Content-Type: application/json" \
  -d '{"devicetype":"philips-hue-app#local-dev"}'
```

3. Copy `success.username` from the response. That is your API key.

## Hue Bridge configuration

Configure Hue in a Spring Boot external config file:

```bash
cd backend
cat > application-secrets.properties <<'EOF'
hue.base-url=https://192.168.1.151
hue.api-key=<your-hue-application-key>
hue.allow-self-signed-cert=true
EOF
```

This file is gitignored.

`hue.allow-self-signed-cert=true` is useful for local Hue Bridge TLS certificates. Set it to `false` if you later import the bridge certificate into your Java truststore.

You can still use environment variables if needed:

```bash
export HUE_BASE_URL=https://192.168.1.151
export HUE_API_KEY=<your-hue-application-key>
```

Backend endpoints used by the frontend:

- `GET /api/hue/devices`
- `GET /api/hue/rooms`
- `GET /api/hue/lights`
- `GET /api/hue/inventory` (merged device + light + zigbee view for troubleshooting)
- `GET /api/hue/diagnostics` (inventory plus `reachable` and firmware update fields)
- `PUT /api/hue/rooms/{roomId}/name` with JSON body `{ "name": "New Room Name" }`
- `GET /api/hue/ping`

## Run the backend

```bash
cd backend
./mvnw spring-boot:run
```

Backend runs on `http://localhost:8080`.

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and calls the backend endpoint.

Optional checks:

```bash
cd frontend
npm run typecheck
npm run lint
```

## Local Startup Order

1. Create `backend/application-secrets.properties` with your bridge IP + API key.
2. Start backend (`./mvnw spring-boot:run`).
3. Start frontend (`npm run dev`).
4. Open `http://localhost:5173`.

## Optional frontend API base URL

By default, frontend uses `http://localhost:8080`.

To override, set:

```bash
VITE_API_BASE_URL=http://localhost:8080
```

## Security note

Keep `HUE_API_KEY` server-side only. Do not put Hue API keys in frontend environment variables or client code.

## Verify Hue connectivity

After setting `hue.api-key` in `backend/application-secrets.properties` and starting backend:

```bash
curl http://localhost:8080/api/hue/ping
```

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
