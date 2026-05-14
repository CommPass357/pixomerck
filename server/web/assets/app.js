const els = {
    apiOrigin: document.querySelector("#apiOrigin"),
    cameraButton: document.querySelector("#cameraButton"),
    cameraPreview: document.querySelector("#cameraPreview"),
    captureButton: document.querySelector("#captureButton"),
    fileInput: document.querySelector("#fileInput"),
    galleryButton: document.querySelector("#galleryButton"),
    generateButton: document.querySelector("#generateButton"),
    healthText: document.querySelector("#healthText"),
    inviteKey: document.querySelector("#inviteKey"),
    maskCanvas: document.querySelector("#maskCanvas"),
    negativePrompt: document.querySelector("#negativePrompt"),
    progress: document.querySelector("#progress"),
    prompt: document.querySelector("#prompt"),
    resultImage: document.querySelector("#resultImage"),
    size: document.querySelector("#size"),
    sourceCanvas: document.querySelector("#sourceCanvas"),
    statusText: document.querySelector("#statusText"),
    strength: document.querySelector("#strength"),
};

let sourceBlob = null;
let maskBlob = null;
let cameraStream = null;

init();

function init() {
    els.inviteKey.value = localStorage.getItem("pixomerck.inviteKey") || "";
    els.apiOrigin.value = localStorage.getItem("pixomerck.apiOrigin") || "";
    els.prompt.value = localStorage.getItem("pixomerck.prompt") || "";
    els.negativePrompt.value = localStorage.getItem("pixomerck.negativePrompt") || els.negativePrompt.value;

    els.inviteKey.addEventListener("input", persist);
    els.apiOrigin.addEventListener("input", persist);
    els.prompt.addEventListener("input", () => {
        persist();
        refreshGenerateState();
    });
    els.negativePrompt.addEventListener("input", persist);
    els.galleryButton.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", onFilePicked);
    els.cameraButton.addEventListener("click", startCamera);
    els.captureButton.addEventListener("click", captureCameraFrame);
    els.generateButton.addEventListener("click", generate);

    clearCanvas(els.sourceCanvas);
    clearCanvas(els.maskCanvas);
    checkHealth();
    refreshGenerateState();
}

function persist() {
    localStorage.setItem("pixomerck.inviteKey", els.inviteKey.value.trim());
    localStorage.setItem("pixomerck.apiOrigin", els.apiOrigin.value.trim());
    localStorage.setItem("pixomerck.prompt", els.prompt.value);
    localStorage.setItem("pixomerck.negativePrompt", els.negativePrompt.value);
}

function apiBase() {
    return els.apiOrigin.value.trim().replace(/\/$/, "");
}

async function checkHealth() {
    try {
        const response = await fetch(`${apiBase()}/health`);
        const health = await response.json();
        els.healthText.textContent = health.backend_ready
            ? `Server ready${health.gpu ? `: ${health.gpu}` : ""}`
            : health.message || "Server reachable";
    } catch {
        els.healthText.textContent = "Server offline";
    }
}

async function onFilePicked(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await setSourceBlob(file);
}

async function startCamera() {
    if (cameraStream) {
        stopCamera();
        return;
    }
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
        });
        els.cameraPreview.srcObject = cameraStream;
        els.cameraPreview.hidden = false;
        els.captureButton.hidden = false;
        els.cameraButton.textContent = "Stop Camera";
    } catch (error) {
        setStatus(error.message || "Camera unavailable");
    }
}

async function captureCameraFrame() {
    if (!cameraStream) return;
    const video = els.cameraPreview;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1024;
    canvas.height = video.videoHeight || 768;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    stopCamera();
    await setSourceBlob(blob);
}

function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    els.cameraPreview.hidden = true;
    els.captureButton.hidden = true;
    els.cameraButton.textContent = "Camera";
}

async function setSourceBlob(blob) {
    sourceBlob = blob;
    const bitmap = await createImageBitmap(blob);
    drawContain(els.sourceCanvas, bitmap);
    drawFallbackPersonMask(els.maskCanvas, bitmap.width, bitmap.height);
    maskBlob = await canvasToBlob(els.maskCanvas, "image/png");
    els.resultImage.removeAttribute("src");
    setStatus("Photo ready");
    refreshGenerateState();
}

function drawContain(canvas, bitmap) {
    const max = 1024;
    const scale = Math.min(max / bitmap.width, max / bitmap.height, 1);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
}

function drawFallbackPersonMask(canvas, sourceWidth, sourceHeight) {
    const max = 1024;
    const scale = Math.min(max / sourceWidth, max / sourceHeight, 1);
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";

    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.25, width * 0.16, height * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width * 0.22, height * 0.96);
    ctx.bezierCurveTo(width * 0.25, height * 0.52, width * 0.38, height * 0.38, width * 0.5, height * 0.38);
    ctx.bezierCurveTo(width * 0.62, height * 0.38, width * 0.75, height * 0.52, width * 0.78, height * 0.96);
    ctx.closePath();
    ctx.fill();
}

function clearCanvas(canvas) {
    canvas.width = 640;
    canvas.height = 640;
}

function refreshGenerateState() {
    els.generateButton.disabled = !sourceBlob || !maskBlob || els.prompt.value.trim().length < 8;
}

async function generate() {
    if (!sourceBlob || !maskBlob) return;
    const prompt = els.prompt.value.trim();
    if (prompt.length < 8) {
        setStatus("Prompt needed");
        return;
    }

    persist();
    setBusy(true);
    setStatus("Submitting");
    els.progress.value = 0;

    try {
        const form = new FormData();
        form.append("image", sourceBlob, "source.jpg");
        form.append("person_mask", maskBlob, "person-mask.png");
        form.append("prompt", prompt);
        form.append("negative_prompt", els.negativePrompt.value.trim());
        form.append("strength", els.strength.value);
        form.append("size", els.size.value);

        const response = await fetch(`${apiBase()}/v1/jobs`, {
            method: "POST",
            headers: authHeaders(),
            body: form,
        });
        if (!response.ok) throw new Error(await responseError(response));
        const job = await response.json();
        await pollJob(job.id);
    } catch (error) {
        setStatus(error.message || "Generation failed");
    } finally {
        setBusy(false);
    }
}

async function pollJob(jobId) {
    let attempt = 0;
    while (attempt < 240) {
        const response = await fetch(`${apiBase()}/v1/jobs/${jobId}`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error(await responseError(response));
        const job = await response.json();
        els.progress.value = Math.max(0, Math.min(1, job.progress || 0));
        setStatus(titleCase(job.status || "running"));

        if (job.status === "completed") {
            await showResult(jobId);
            setStatus("Completed");
            return;
        }
        if (job.status === "failed") {
            throw new Error(job.error || "Generation failed");
        }
        await sleep(attempt < 3 ? 1000 : attempt < 10 ? 2000 : 3500);
        attempt += 1;
    }
    throw new Error("Generation timed out");
}

async function showResult(jobId) {
    const response = await fetch(`${apiBase()}/v1/jobs/${jobId}/image`, {
        headers: authHeaders(),
    });
    if (!response.ok) throw new Error(await responseError(response));
    const blob = await response.blob();
    const nextUrl = URL.createObjectURL(blob);
    const previousUrl = els.resultImage.dataset.objectUrl;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    els.resultImage.dataset.objectUrl = nextUrl;
    els.resultImage.src = nextUrl;
}

function authHeaders() {
    const inviteKey = els.inviteKey.value.trim();
    return inviteKey ? { "X-Pixomerck-Key": inviteKey } : {};
}

async function responseError(response) {
    try {
        const body = await response.json();
        return body.detail || `HTTP ${response.status}`;
    } catch {
        return `HTTP ${response.status}`;
    }
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not render image"));
        }, type, quality);
    });
}

function setBusy(busy) {
    els.generateButton.disabled = busy;
    els.galleryButton.disabled = busy;
    els.cameraButton.disabled = busy;
    els.captureButton.disabled = busy;
    if (!busy) refreshGenerateState();
}

function setStatus(text) {
    els.statusText.textContent = text;
}

function titleCase(value) {
    return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
