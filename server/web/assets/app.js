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
    backgroundPreset: document.querySelector("#backgroundPreset"),
    bodyPreset: document.querySelector("#bodyPreset"),
    cameraButton: document.querySelector("#cameraButton"),
    cameraPreview: document.querySelector("#cameraPreview"),
    captureButton: document.querySelector("#captureButton"),
    environmentPreset: document.querySelector("#environmentPreset"),
    fileInput: document.querySelector("#fileInput"),
    galleryButton: document.querySelector("#galleryButton"),
    generateButton: document.querySelector("#generateButton"),
    healthText: document.querySelector("#healthText"),
    itemPreset: document.querySelector("#itemPreset"),
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
    {
        label: "Executive Editorial Portrait",
        prompt: "premium executive editorial portrait, precision-tailored navy suit, crisp shirt, subtle luxury accessories, preserve exact facial identity, expression, hands, posture, body proportions, and any held objects, natural skin texture, 85mm commercial photography",
    },
    {
        label: "Cyberpunk Techwear Campaign",
        prompt: "premium cyberpunk fashion campaign, tailored matte-black techwear jacket with subtle reflective piping, preserve same face, beard if present, hands, pose, body shape, and held objects, realistic fabric engineering, controlled neon rim light, high-end commercial photography",
    },
    {
        label: "Sci-Fi Mission Commander",
        prompt: "cinematic sci-fi mission commander portrait, off-white technical field suit with clean panel seams and mission patches, preserve facial identity, expression, hands, pose, and any held object, realistic fabric folds, premium production-design lighting",
    },
    {
        label: "Red Carpet Luxury",
        prompt: "luxury red-carpet wardrobe transformation, custom deep burgundy velvet dinner jacket, crisp black shirt, refined grooming, preserve identity, expression, hands, and posture, soft studio flash, polished magazine-cover realism",
    },
    {
        label: "Chrome Couture Armor",
        prompt: "high-fashion chrome armor concept, lightweight polished graphite and brushed-metal panels over realistic clothing, preserve identity and natural anatomy, dramatic rim lighting, believable reflections, couture magazine shoot",
    },
    {
        label: "Heritage Denim Campaign",
        prompt: "heritage denim campaign look, dark selvedge denim jacket over a clean white tee, authentic stitching and texture, preserve face and hands, realistic casual portrait, Kodak Portra color, shallow depth of field",
    },
    {
        label: "Luxury Streetwear Lookbook",
        prompt: "premium streetwear lookbook edit, layered oversized bomber jacket, textured hoodie, designer sneakers if visible, preserve identity, pose, body shape, and held object, soft urban night lighting, photorealistic fashion catalog",
    },
    {
        label: "Outdoor Adventure Catalog",
        prompt: "outdoor adventure catalog styling, weatherproof olive technical jacket with subtle gear details, preserve facial identity and hand placement, realistic fabric wear, crisp natural light, professional lifestyle photography",
    },
    {
        label: "Classic Rock Promo",
        prompt: "classic rock performer wardrobe, black leather jacket, charcoal shirt, understated silver accessories, preserve face, beard, hands, and pose, dramatic stage backlight, realistic concert-promo portrait",
    },
    {
        label: "Cinematic Noir Portrait",
        prompt: "cinematic noir wardrobe edit, tailored black trench coat and dark shirt, preserve the same person and realistic facial details, moody contrast lighting, restrained film grain, premium photoreal portrait",
    },
];

const BODY_PRESETS = [
    {
        label: "Identity + Hands Locked",
        prompt: "preserve the same facial identity, expression, beard or hair if present, natural hands, original pose, body proportions, and realistic anatomy",
    },
    {
        label: "Refined Grooming",
        prompt: "subtle professional grooming, clean facial detail, natural skin texture, realistic eyes, believable hair and beard texture, no plastic retouching",
    },
    {
        label: "Executive Tailoring",
        prompt: "perfectly fitted tailored suit silhouette, crisp collar, realistic shoulder structure, natural arm placement, premium wool fabric detail",
    },
    {
        label: "Techwear Silhouette",
        prompt: "structured technical jacket, matte utility panels, functional seams, subtle reflective accents, realistic fabric weight and folds",
    },
    {
        label: "Leather Jacket Fit",
        prompt: "premium black leather jacket, natural creasing, charcoal undershirt, realistic shoulder fit, preserve original posture and hand placement",
    },
    {
        label: "Outdoor Layering",
        prompt: "weatherproof outdoor layers, insulated jacket, practical collar and cuffs, realistic stitching, preserve natural body shape and stance",
    },
    {
        label: "Formal Ceremony Coat",
        prompt: "tailored ceremonial coat with tasteful embroidery, structured chest and shoulders, premium fabric texture, preserve face, hands, and anatomy",
    },
    {
        label: "Athletic Campaign Fit",
        prompt: "modern fitted performance jacket, technical shirt, clean athletic styling, realistic fabric stretch, preserve natural proportions and pose",
    },
    {
        label: "Creator Utility Vest",
        prompt: "modern black utility vest over a refined tee, subtle pockets and tool details, realistic fabric, preserve identity, hands, and held objects",
    },
    {
        label: "Studio Portrait Wardrobe",
        prompt: "clean charcoal and cream wardrobe styling, understated premium layers, natural body proportions, commercial portrait polish",
    },
];

const BACKGROUND_PRESETS = [
    {
        label: "Preserve Original Location",
        prompt: "keep the original background composition mostly intact, remove visual distractions, subtly improve lighting and color without changing the location",
    },
    {
        label: "Clean Photo Studio",
        prompt: "minimal modern photo studio background, soft shadows, clean floor-to-wall transition, premium commercial portrait setting",
    },
    {
        label: "Rainy Neon Street",
        prompt: "rainy neon city street background, wet pavement reflections, cinematic depth, realistic urban atmosphere",
    },
    {
        label: "Luxury Hotel Lobby",
        prompt: "luxury hotel lobby background, warm architectural lighting, polished stone, refined editorial atmosphere",
    },
    {
        label: "Moonbase Interior",
        prompt: "sleek moonbase interior background, soft white panels, distant window glow, believable sci-fi production design",
    },
    {
        label: "Concert Stage",
        prompt: "professional concert stage background, controlled haze, backlights, dark performance atmosphere, realistic depth of field",
    },
    {
        label: "Snow Mountain",
        prompt: "snowy mountain overlook background, crisp cold daylight, clean horizon, realistic outdoor catalog atmosphere",
    },
    {
        label: "Desert Sunset",
        prompt: "desert sunset background, warm golden sky, distant dunes, cinematic travel editorial realism",
    },
    {
        label: "Classic Car Garage",
        prompt: "classic car garage background, warm work lights, tasteful retro details, cinematic lifestyle photography",
    },
    {
        label: "Palace Interior",
        prompt: "grand palace interior background, dark wood, tasteful gold accents, dramatic portrait depth and realistic scale",
    },
];

const ITEM_PRESETS = [
    {
        label: "Preserve Held Object",
        prompt: "preserve any object already in the hands, keep hand contact natural, avoid adding unrelated props",
    },
    {
        label: "No Extra Props",
        prompt: "do not add new props or accessories, keep the edit focused on the person, wardrobe, and scene",
    },
    {
        label: "Futuristic Tablet",
        prompt: "add or refine a slim futuristic tablet or compact keyboard-like device, realistic scale, natural hand grip, subtle screen glow",
    },
    {
        label: "Camera Rig",
        prompt: "add a professional camera or compact cinema rig if hands are available, believable hand placement and realistic lens reflections",
    },
    {
        label: "Studio Microphone",
        prompt: "add a premium studio microphone or broadcast mic as a tasteful prop, realistic metal texture, natural placement",
    },
    {
        label: "Arcade Controller",
        prompt: "add a refined arcade controller or retro gaming prop, realistic buttons and surface wear, natural hand interaction",
    },
    {
        label: "Travel Duffel",
        prompt: "add a premium travel duffel or technical gear bag near the subject, realistic fabric, grounded shadows",
    },
    {
        label: "Coffee Cup",
        prompt: "add a simple ceramic coffee cup or takeaway cup where appropriate, realistic hand grip and scale",
    },
    {
        label: "Chef Tools",
        prompt: "add subtle chef-owner props such as a folded towel or knife roll, safe placement, premium restaurant realism",
    },
    {
        label: "Musician Guitar",
        prompt: "add a classic electric guitar or guitar case as a tasteful music-promo prop, realistic scale and reflections",
    },
];

const ENVIRONMENT_PRESETS = [
    {
        label: "Editorial Softbox",
        prompt: "large softbox key light, gentle fill, controlled shadows, professional editorial portrait color",
    },
    {
        label: "Neon Rim Light",
        prompt: "controlled neon rim lighting, cool edge highlights, balanced face exposure, cinematic commercial finish",
    },
    {
        label: "Golden Hour",
        prompt: "warm golden-hour key light, soft natural contrast, realistic skin tones, tasteful lens depth",
    },
    {
        label: "Cinematic Noir",
        prompt: "moody noir lighting, restrained contrast, dark wardrobe detail, realistic film grain and clean face visibility",
    },
    {
        label: "Magazine Cover",
        prompt: "premium magazine-cover lighting, polished color grade, high-end retouching while preserving natural skin texture",
    },
    {
        label: "Sports Ad",
        prompt: "crisp sports-ad lighting, clean highlights, energetic contrast, realistic fabric texture, professional poster finish",
    },
    {
        label: "Restaurant Editorial",
        prompt: "warm restaurant editorial lighting, amber practicals, natural skin tones, tasteful commercial food-magazine color",
    },
    {
        label: "Clinical Sci-Fi",
        prompt: "clean clinical sci-fi lighting, soft blue accents, bright controlled exposure, realistic white surfaces",
    },
    {
        label: "Film Photography",
        prompt: "Kodak Portra inspired color, soft highlight rolloff, subtle grain, realistic 85mm portrait lens depth",
    },
    {
        label: "High Fashion Flash",
        prompt: "controlled high-fashion flash, crisp garment texture, clean specular highlights, couture editorial polish",
    },
];

const PROMPT_GROUPS = [
    { key: "promptPreset", items: PROMPT_PRESETS },
    { key: "bodyPreset", items: BODY_PRESETS },
    { key: "backgroundPreset", items: BACKGROUND_PRESETS },
    { key: "itemPreset", items: ITEM_PRESETS },
    { key: "environmentPreset", items: ENVIRONMENT_PRESETS },
];

let sourceBlob = null;
let maskBlob = null;
let cameraStream = null;
let authenticated = false;
let lastBuiltPrompt = "";

init();

async function init() {
    els.apiOrigin.value = localStorage.getItem("pixomerck.apiOrigin") || "";
    els.prompt.value = localStorage.getItem("pixomerck.prompt") || "";
    els.negativePrompt.value = localStorage.getItem("pixomerck.negativePrompt") || els.negativePrompt.value;
    populatePromptBuilder();
    syncPromptBuilder();

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
        if (els.prompt.value !== lastBuiltPrompt) {
            clearPromptBuilderSelection();
        }
        refreshGenerateState();
    });
    PROMPT_GROUPS.forEach((group) => els[group.key].addEventListener("change", onPromptBuilderChange));
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

function populatePromptBuilder() {
    PROMPT_GROUPS.forEach((group) => {
        const fragment = document.createDocumentFragment();
        group.items.forEach((preset, index) => {
            const option = document.createElement("option");
            option.value = preset.prompt;
            option.textContent = `${index + 1}. ${preset.label}`;
            option.title = preset.prompt;
            fragment.append(option);
        });
        els[group.key].append(fragment);
    });
}

function onPromptBuilderChange() {
    const parts = PROMPT_GROUPS.map((group) => els[group.key].value.trim()).filter(Boolean);
    if (parts.length === 0) return;

    const needsBase = !els.promptPreset.value;
    const promptParts = needsBase ? ["professional photorealistic portrait edit"] : [];
    promptParts.push(...parts);
    els.prompt.value = promptParts.join(", ");
    lastBuiltPrompt = els.prompt.value;
    persist();
    refreshGenerateState();
    if (sourceBlob && maskBlob) {
        els.toolbarGenerateButton.focus();
    } else {
        els.galleryButton.focus();
    }
}

function syncPromptBuilder() {
    const prompt = els.prompt.value.trim();
    const matchingPreset = PROMPT_PRESETS.find((preset) => preset.prompt === prompt);
    clearPromptBuilderSelection();
    if (!matchingPreset) return;
    els.promptPreset.value = matchingPreset.prompt;
    lastBuiltPrompt = prompt;
}

function clearPromptBuilderSelection() {
    PROMPT_GROUPS.forEach((group) => {
        els[group.key].value = "";
    });
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
    drawClientMaskPlaceholder(els.maskCanvas, bitmap.width, bitmap.height);
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

function drawClientMaskPlaceholder(canvas, sourceWidth, sourceHeight) {
    const max = 1024;
    const scale = Math.min(max / sourceWidth, max / sourceHeight, 1);
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
