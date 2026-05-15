const els = {
    apiOrigin: document.querySelector("#apiOrigin"),
    appShell: document.querySelector("#appShell"),
    authCreateButton: document.querySelector("#authCreateButton"),
    authEmail: document.querySelector("#authEmail"),
    authForm: document.querySelector("#authForm"),
    authLoginButton: document.querySelector("#authLoginButton"),
    authPassword: document.querySelector("#authPassword"),
    authSplash: document.querySelector("#authSplash"),
    authStatus: document.querySelector("#authStatus"),
    cameraButton: document.querySelector("#cameraButton"),
    cameraPreview: document.querySelector("#cameraPreview"),
    captureButton: document.querySelector("#captureButton"),
    fileInput: document.querySelector("#fileInput"),
    galleryButton: document.querySelector("#galleryButton"),
    generateButton: document.querySelector("#generateButton"),
    healthText: document.querySelector("#healthText"),
    logoutButton: document.querySelector("#logoutButton"),
    maskCanvas: document.querySelector("#maskCanvas"),
    negativePrompt: document.querySelector("#negativePrompt"),
    nextStepText: document.querySelector("#nextStepText"),
    progress: document.querySelector("#progress"),
    prompt: document.querySelector("#prompt"),
    promptPreset: document.querySelector("#promptPreset"),
    resultImage: document.querySelector("#resultImage"),
    size: document.querySelector("#size"),
    sourceCanvas: document.querySelector("#sourceCanvas"),
    statusText: document.querySelector("#statusText"),
    strength: document.querySelector("#strength"),
    toolbarGenerateButton: document.querySelector("#toolbarGenerateButton"),
};

const PROMPT_PRESETS = [
    "turn my outfit into sleek black cyberpunk streetwear, neon city reflections, realistic photo",
    "make me look like a futuristic space explorer in a white suit, cinematic moonbase lighting",
    "change my clothes into elegant red carpet fashion, soft studio flash, polished editorial photo",
    "transform the background into a rainy Tokyo night street, keep my face natural and detailed",
    "make my outfit chrome and glass futuristic armor, dramatic rim light, high fashion portrait",
    "turn the scene into a warm golden hour beach portrait, natural skin, realistic lens blur",
    "make me wear a vintage denim jacket and white tee, 1990s film photography style",
    "change my outfit to a sharp tailored navy suit, luxury hotel lobby background",
    "turn the photo into a fantasy adventurer portrait with leather jacket and forest light",
    "make the background a clean modern photo studio with soft shadows and premium lighting",
    "change my clothes into a bright athletic tracksuit, energetic sports poster lighting",
    "make me look like a rock concert performer, black leather outfit, stage lights behind me",
    "turn the scene into a snowy mountain portrait, warm coat, crisp realistic winter lighting",
    "make my outfit pastel street fashion, colorful mural background, bright editorial photo",
    "change the background to a classic car garage, retro jacket, cinematic warm lights",
    "make me wear a futuristic medical lab coat, clean sci-fi laboratory background",
    "turn my outfit into royal formalwear, grand palace interior, realistic dramatic portrait",
    "make the photo look like a magazine cover shoot, stylish outfit, clean professional lighting",
    "change my clothes into desert explorer gear, sunset dunes background, realistic photo",
    "turn the background into a cozy coffee shop, casual layered outfit, warm natural light",
];

let sourceBlob = null;
let maskBlob = null;
let cameraStream = null;
let authenticated = false;

init();

async function init() {
    els.apiOrigin.value = localStorage.getItem("pixomerck.apiOrigin") || "";
    els.prompt.value = localStorage.getItem("pixomerck.prompt") || "";
    els.negativePrompt.value = localStorage.getItem("pixomerck.negativePrompt") || els.negativePrompt.value;
    populatePromptPresets();
    syncPromptPreset();

    stripLegacyInviteHash();
    els.authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        login();
    });
    els.authCreateButton.addEventListener("click", createAccount);
    els.logoutButton.addEventListener("click", logout);
    els.apiOrigin.addEventListener("input", persist);
    els.prompt.addEventListener("input", () => {
        persist();
        syncPromptPreset();
        refreshGenerateState();
    });
    els.promptPreset.addEventListener("change", onPromptPresetChange);
    els.negativePrompt.addEventListener("input", persist);
    els.galleryButton.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", onFilePicked);
    els.cameraButton.addEventListener("click", startCamera);
    els.captureButton.addEventListener("click", captureCameraFrame);
    els.generateButton.addEventListener("click", generate);
    els.toolbarGenerateButton.addEventListener("click", generate);

    clearCanvas(els.sourceCanvas);
    clearCanvas(els.maskCanvas);
    checkHealth();
    setAuthenticated(false);
    await checkSession();
    refreshGenerateState();
}

function persist() {
    localStorage.setItem("pixomerck.apiOrigin", els.apiOrigin.value.trim());
    localStorage.setItem("pixomerck.prompt", els.prompt.value);
    localStorage.setItem("pixomerck.negativePrompt", els.negativePrompt.value);
}

function stripLegacyInviteHash() {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    if (!hash.has("pixomerck-key")) return;
    url.hash = "";
    window.history.replaceState(null, document.title, url.toString());
}

async function login() {
    const credentials = authCredentials();
    if (!credentials) return;

    setAuthBusy(true);
    setAuthStatus("Logging in");
    try {
        await createSession(credentials.email, credentials.password);
        setStatus("Logged in");
        setAuthStatus("");
    } catch (error) {
        setAuthStatus(error.message || "Login failed");
        setAuthenticated(false);
    } finally {
        setAuthBusy(false);
    }
}

async function createAccount() {
    const credentials = authCredentials();
    if (!credentials) return;

    setAuthBusy(true);
    setAuthStatus("Creating account");
    try {
        const response = await fetch(`${apiBase()}/v1/accounts`, {
            body: JSON.stringify(credentials),
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            method: "POST",
        });
        if (!response.ok) throw new Error(await responseError(response));
        els.authPassword.value = "";
        setAuthenticated(true);
        setStatus("Account created");
        setAuthStatus("");
    } catch (error) {
        setAuthStatus(error.message || "Account creation failed");
        setAuthenticated(false);
    } finally {
        setAuthBusy(false);
    }
}

async function logout() {
    try {
        await fetch(`${apiBase()}/v1/session`, {
            credentials: "same-origin",
            method: "DELETE",
        });
    } catch {
        // Clearing local UI state is enough if the network is already gone.
    }
    setAuthenticated(false);
    setStatus("Logged out");
}

async function createSession(email, password) {
    const response = await fetch(`${apiBase()}/v1/session`, {
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
    });
    if (!response.ok) throw new Error(await responseError(response));
    els.authPassword.value = "";
    setAuthenticated(true);
}

async function checkSession() {
    try {
        const response = await fetch(`${apiBase()}/v1/session`, {
            credentials: "same-origin",
        });
        setAuthenticated(response.ok);
    } catch {
        setAuthenticated(false);
    }
}

function setAuthenticated(value) {
    authenticated = value;
    els.authSplash.hidden = authenticated;
    els.appShell.hidden = !authenticated;
    if (!authenticated) {
        setAuthStatus("Use the same email and password as games.hoesonly.fans.");
    }
    refreshGenerateState();
}

function authCredentials() {
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    if (!email) {
        setAuthStatus("Enter an email address.");
        els.authEmail.focus();
        return null;
    }
    if (password.length < 8) {
        setAuthStatus("Use a password with at least 8 characters.");
        els.authPassword.focus();
        return null;
    }
    return { email, password };
}

function setAuthBusy(busy) {
    els.authLoginButton.disabled = busy;
    els.authCreateButton.disabled = busy;
}

function setAuthStatus(text) {
    els.authStatus.textContent = text;
}

function populatePromptPresets() {
    const fragment = document.createDocumentFragment();
    PROMPT_PRESETS.forEach((prompt, index) => {
        const option = document.createElement("option");
        option.value = prompt;
        option.textContent = `${index + 1}. ${prompt}`;
        fragment.append(option);
    });
    els.promptPreset.append(fragment);
}

function onPromptPresetChange() {
    if (!els.promptPreset.value) return;
    els.prompt.value = els.promptPreset.value;
    persist();
    refreshGenerateState();
    if (sourceBlob && maskBlob) {
        els.toolbarGenerateButton.focus();
    } else {
        els.galleryButton.focus();
    }
}

function syncPromptPreset() {
    const matchingPreset = PROMPT_PRESETS.includes(els.prompt.value.trim());
    els.promptPreset.value = matchingPreset ? els.prompt.value.trim() : "";
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
    setStatus("Loading photo");
    try {
        await setSourceBlob(file);
    } catch (error) {
        sourceBlob = null;
        maskBlob = null;
        clearCanvas(els.sourceCanvas);
        clearCanvas(els.maskCanvas);
        setStatus(error.message || "Unable to load image");
        refreshGenerateState();
    } finally {
        event.target.value = "";
    }
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
    const bitmap = await decodeImage(blob);
    drawContain(els.sourceCanvas, bitmap);
    drawFallbackPersonMask(els.maskCanvas, bitmap.width, bitmap.height);
    maskBlob = await canvasToBlob(els.maskCanvas, "image/png");
    els.resultImage.removeAttribute("src");
    setStatus(els.prompt.value.trim().length >= 8 ? "Photo ready. Generate next." : "Photo ready. Add prompt.");
    refreshGenerateState();
    if (els.prompt.value.trim().length < 8) {
        els.prompt.focus();
    } else {
        els.toolbarGenerateButton.focus();
    }
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
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

function refreshGenerateState() {
    const promptReady = els.prompt.value.trim().length >= 8;
    const photoReady = Boolean(sourceBlob && maskBlob);
    const canGenerate = promptReady && photoReady;
    els.generateButton.disabled = !canGenerate;
    els.toolbarGenerateButton.disabled = !canGenerate;

    const nextStep = nextStepMessage(promptReady, photoReady);
    els.generateButton.title = nextStep;
    els.toolbarGenerateButton.title = nextStep;
    els.nextStepText.textContent = nextStep;
}

async function generate() {
    if (!authenticated) {
        setStatus("Log in first");
        setAuthenticated(false);
        els.authEmail.focus();
        return;
    }
    if (!sourceBlob || !maskBlob) {
        setStatus("Select a photo first");
        return;
    }
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
            credentials: "same-origin",
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
            credentials: "same-origin",
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
        credentials: "same-origin",
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
    return {};
}

async function responseError(response) {
    try {
        const body = await response.json();
        if (response.status === 401) return "Log in again to continue.";
        return body.detail || `HTTP ${response.status}`;
    } catch {
        if (response.status === 401) return "Log in again to continue.";
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

async function decodeImage(blob) {
    try {
        return await createImageBitmap(blob);
    } catch (error) {
        throw new Error("Could not read that image. Try a JPG, PNG, or WebP photo.");
    }
}

function setBusy(busy) {
    els.generateButton.disabled = busy;
    els.toolbarGenerateButton.disabled = busy;
    els.galleryButton.disabled = busy;
    els.cameraButton.disabled = busy;
    els.captureButton.disabled = busy;
    if (!busy) refreshGenerateState();
}

function nextStepMessage(promptReady, photoReady) {
    if (!promptReady && !photoReady) return "Type a prompt, then select a photo.";
    if (!promptReady) return "Type a prompt with at least 8 characters.";
    if (!photoReady) return "Select Image or Camera to add a photo.";
    return "Ready. Tap Generate.";
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
