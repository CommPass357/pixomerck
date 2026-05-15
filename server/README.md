# Pixomerck Web Server

This FastAPI service serves the Pixomerck browser app from `/`, accepts photo
edit jobs from that web app, queues one generation at a time, and calls ComfyUI
for GPU-heavy image edits.

## Install

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DownloadComfyUI
```

The installer creates:

- `.venv\` for the Pixomerck API service
- `data\invite-key.txt` for scripted API access
- `runtime\pixomerck.env.ps1` for server configuration
- `vendor\ComfyUI\` when `-DownloadComfyUI` is used

## Start

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1 -StartComfyUI
```

Use `-Detached` to run the API in the background.

Open the web app locally:

```text
http://127.0.0.1:8765/
```

## Cloudflare

The intended public hostname is:

```text
https://pix.hoesonly.fans
```

Route that hostname to:

```text
http://127.0.0.1:8765
```

If `cloudflared` is installed and authenticated:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cloudflare-pix.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-cloudflare.ps1
```

## Browser Login

Open the web app and log in with the same email and password used on
`games.hoesonly.fans`. Open registration is enabled, and accounts are stored in
the shared Bored Games database:

```text
D:\boredgames\server\data\db.json
```

Set `PIXOMERCK_GAMES_DB_PATH` when that database lives somewhere else.

The browser exchanges valid credentials for a secure session cookie.

## Environment

Configuration lives in `runtime\pixomerck.env.ps1`:

- `PIXOMERCK_PORT`: API port, default `8765`
- `PIXOMERCK_BACKEND`: `comfyui` or `demo`
- `PIXOMERCK_COMFYUI_URL`: default `http://127.0.0.1:8188`
- `PIXOMERCK_MODEL`: ComfyUI checkpoint filename
- `PIXOMERCK_GAMES_DB_PATH`: shared Bored Games JSON database path
- `PIXOMERCK_TUNNEL_URL`: optional public tunnel URL
- `PIXOMERCK_PUBLIC_HOSTNAME`: browser/public hostname, default `pix.hoesonly.fans`

## API

- `GET /health`
- `POST /v1/session`
- `DELETE /v1/session`
- `POST /v1/jobs`
- `GET /v1/jobs/{id}`
- `GET /v1/jobs/{id}/image`

Protected endpoints accept the secure browser session cookie. Scripted clients
can still send `X-Pixomerck-Key` with the password from `data\invite-key.txt`.
