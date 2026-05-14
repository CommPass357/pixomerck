# Pixomerck

Pixomerck is a web photo editor for prompt-driven image edits. The browser app
captures or selects a photo, creates a person-mask preview, sends the job to the
local Windows generation server, then shows the generated result.

The intended public URL is:

```text
https://pix.hoesonly.fans
```

## What It Includes

- Browser web app served from the FastAPI process at `/`
- Open email/password registration backed by a secure browser session cookie
- FastAPI job API with a one-at-a-time generation queue
- ComfyUI adapter for server-side image generation
- Demo backend for UI testing without ComfyUI
- PowerShell scripts for install, start, stop, status, API key lookup, packaging,
  and Cloudflare Tunnel setup

## Windows Setup

From `D:\boredgames\pixomerck\server`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DownloadComfyUI
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1 -StartComfyUI
```

Open the local web app:

```text
http://127.0.0.1:8765/
```

For Cloudflare Tunnel, route:

```text
pix.hoesonly.fans -> http://127.0.0.1:8765
```

## Login

Open the web app and create an account with an email address and password. User
accounts are stored locally in:

```text
server\data\users.json
```

Scripted API clients can still use the server API key in:

```text
server\data\invite-key.txt
```

Use `pair.ps1` to print the local server URL and API key when needed.

## ComfyUI Model

The installer can download ComfyUI. Model files are not bundled in this
repository or release. Put a Stable Diffusion 1.5 inpainting-capable checkpoint
in:

```text
server\vendor\ComfyUI\models\checkpoints\
```

Set `PIXOMERCK_MODEL` in `server\runtime\pixomerck.env.ps1` if the checkpoint
filename differs from the default.

## Tests

```powershell
python -m pytest server\tests
```

## Release

```powershell
git tag v0.1.1
git push origin main
git push origin v0.1.1
```

GitHub Actions publishes:

- `Pixomerck-Windows-Server-v0.1.1.zip`
- `Pixomerck-Windows-Server-v0.1.1.zip.sha256`
