# Pixomerck

Pixomerck is an Android photo editor that turns a camera or gallery photo into a prompt-driven AI edit. The Android app captures/selects the image, creates a local person mask, then sends the photo, mask, and prompt to a Windows generation server running on this machine.

## What v0.1.0 Includes

- Android app: Jetpack Compose, CameraX capture, Android Photo Picker, local MediaPipe person mask, LAN/tunnel server fallback, invite-key auth, job polling, result save/share.
- Windows server: FastAPI, one-at-a-time generation queue, invite-key auth, ComfyUI adapter, install/start/stop/status/pair scripts.
- Release automation: tag `v0.1.0` publishes a debug-signed APK and Windows server zip with SHA256 files.

## Android Setup

Open the repo in Android Studio or build from PowerShell:

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
```

The first build downloads the MediaPipe selfie segmentation model into Gradle generated assets so it is included in the APK.

## Windows Server Setup

Download `Pixomerck-Windows-Server-v0.1.0.zip` from the GitHub release and extract it. From the extracted folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DownloadComfyUI
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1 -StartComfyUI
powershell -ExecutionPolicy Bypass -File .\scripts\pair.ps1 -BaseUrl http://YOUR-PC-LAN-IP:8765
```

Enter the LAN URL and invite key in the Android app. Add a tunnel URL in the app if you expose the server through Cloudflare Tunnel or another HTTPS tunnel.

## ComfyUI Model

The installer can download ComfyUI. Model files are not bundled in this repository or release. Put a Stable Diffusion 1.5 inpainting-capable checkpoint in:

```text
vendor\ComfyUI\models\checkpoints\
```

Set `PIXOMERCK_MODEL` in `runtime\pixomerck.env.ps1` if the checkpoint filename differs from the default.

## Release

```powershell
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

GitHub Actions publishes:

- `Pixomerck-Android-v0.1.0-debug.apk`
- `Pixomerck-Windows-Server-v0.1.0.zip`
- matching `.sha256` files
