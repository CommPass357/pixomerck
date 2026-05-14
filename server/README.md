# Pixomerck Windows Server

This server accepts an image, person mask, and prompt from the Android app, queues one generation job at a time, and calls ComfyUI for the GPU-heavy image edit.

It also serves the Pixomerck browser app from `/`, so the Cloudflare public
hostname can point at this same process.

## Install

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DownloadComfyUI
```

The installer creates:

- `.venv\` for the Pixomerck API service
- `data\invite-key.txt` for Android pairing
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

That creates or reuses a named `pixomerck` tunnel, writes
`%USERPROFILE%\.cloudflared\pixomerck.yml`, and adds the DNS route for
`pix.hoesonly.fans`.

## Pair Android

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pair.ps1 -BaseUrl http://YOUR-PC-LAN-IP:8765
```

Copy the URL and invite key into the Android app.

## Environment

Configuration lives in `runtime\pixomerck.env.ps1`:

- `PIXOMERCK_PORT`: API port, default `8765`
- `PIXOMERCK_BACKEND`: `comfyui` or `demo`
- `PIXOMERCK_COMFYUI_URL`: default `http://127.0.0.1:8188`
- `PIXOMERCK_MODEL`: ComfyUI checkpoint filename
- `PIXOMERCK_TUNNEL_URL`: optional public tunnel URL shown by `/v1/pairing`
- `PIXOMERCK_PUBLIC_HOSTNAME`: browser/public hostname, default `pix.hoesonly.fans`

## API

- `GET /health`
- `GET /v1/pairing`
- `POST /v1/jobs`
- `GET /v1/jobs/{id}`
- `GET /v1/jobs/{id}/image`

Protected endpoints require `X-Pixomerck-Key`.
