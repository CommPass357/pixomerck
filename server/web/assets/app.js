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

const LEGACY_NEGATIVE_PROMPT = "blurred face, distorted hands, low quality, extra fingers";
const DEFAULT_NEGATIVE_PROMPT =
    "blurred face, distorted hands, warped fingers, melted held objects, gray silhouette, fake text, gibberish text, misspelled words, distorted signage, brand logos, watermark, extra people, background faces, portraits of people, television screens, monitors, framed pictures, wall art, display panels, wall mounted displays, black rectangles, framed artwork, flat lighting, dull colors, washed out, low contrast, pasted cutout, amateur composite, mismatched lighting, low quality, extra fingers";

const PROMPT_PRESETS = [
    {
        label: "Mythic Pegasus Rider",
        prompt: "mythic fantasy key art, the same person as a noble rider on a white winged horse, medieval travel cloak, carved staff, distant castle skyline, rolling storm clouds, preserve exact facial identity, beard or hair, expression, natural hands, and believable body proportions, cinematic poster lighting, atmospheric depth, rich painterly realism",
    },
    {
        label: "Deep-Space Explorer",
        prompt: "professional sci-fi key art, the same person as a deep-space explorer in a detailed armored astronaut suit, starfield and glowing nebula background, reflective helmet details without covering the face, preserve exact facial identity, expression, natural anatomy, and realistic hands, cinematic rim light, high-detail materials, vivid commercial color grade",
    },
    {
        label: "Monumental Desert Legends",
        prompt: "epic desert monument key art, the same person sculpted into a monumental sandstone mountain portrait with heroic scale, warm golden sunset, dust haze, distant mountains, preserve recognizable face, beard or hair, strong facial structure, and natural expression, cinematic poster composition, dramatic contrast, premium fantasy realism",
    },
    {
        label: "Arcade Cyber Champion",
        prompt: "high-end cyberpunk arcade champion poster, same person wearing premium black techwear armor with subtle neon accents, futuristic arcade command deck background, preserve exact face, beard or hair, expression, body proportions, hands, and held object if present, cinematic neon rim light, glossy commercial contrast, sharp subject detail",
    },
    {
        label: "Castle Guardian Poster",
        prompt: "cinematic medieval guardian portrait, same person in layered leather-and-steel adventurer armor, dramatic castle courtyard background, grounded shadows, preserve exact facial identity, beard or hair, expression, realistic hands, natural anatomy, detailed fabric and metal materials, moody fantasy key-art lighting",
    },
    {
        label: "Starship Captain",
        prompt: "premium space-opera captain portrait, same person in tailored command jacket with subtle armor panels, starship bridge environment, volumetric light through panoramic windows, preserve exact facial identity, expression, hands, posture, and body proportions, high-budget production design, vivid but realistic color grade",
    },
    {
        label: "Luxury Magazine Cover",
        prompt: "award-winning magazine cover portrait, same person in precision-tailored luxury wardrobe, premium studio set with clean architectural depth, preserve exact face, beard or hair, expression, hands, posture, and body shape, sculpted softbox lighting, crisp fabric texture, professional editorial retouching",
    },
    {
        label: "Stormlit Comic Hero",
        prompt: "cinematic comic-book hero key art, same person in practical graphite-and-gold hero armor, stormlit city skyline background, preserve exact facial identity, beard or hair, expression, believable hands, and natural proportions, dramatic backlight, high-contrast poster finish, realistic materials",
    },
    {
        label: "Fantasy Tavern Hero",
        prompt: "premium fantasy tavern hero portrait, same person in refined adventurer wardrobe with leather straps and cloak, warm candlelit tavern background, preserve exact face, beard or hair, expression, hand placement, and any held object, rich amber lighting, cinematic depth, professional painterly realism",
    },
    {
        label: "Retro Future Explorer",
        prompt: "retro-futurist adventure poster, same person in detailed silver-and-charcoal exploration suit, glowing alien landscape background, preserve exact facial identity, beard or hair, expression, natural anatomy, hands, and original pose, vibrant cinematic color, atmospheric haze, high-end commercial key art",
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
    const savedNegativePrompt = localStorage.getItem("pixomerck.negativePrompt");
    els.negativePrompt.value = shouldUpgradeNegativePrompt(savedNegativePrompt) ? DEFAULT_NEGATIVE_PROMPT : savedNegativePrompt;
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

function shouldUpgradeNegativePrompt(value) {
    if (!value || value === LEGACY_NEGATIVE_PROMPT) return true;
    return !value.includes("pasted cutout") || !value.includes("flat lighting");
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
        const editTarget = currentEditTarget();
        form.append("strength", currentStrength(editTarget));
        form.append("size", els.size.value);
        form.append("edit_target", editTarget);

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

function currentEditTarget() {
    const promptIntent = promptEditIntent();
    const hasBackground = Boolean(els.backgroundPreset.value) || promptIntent.hasBackground;
    const hasSubject = Boolean(els.promptPreset.value || els.bodyPreset.value || els.itemPreset.value) || promptIntent.hasSubject;
    if (hasBackground && hasSubject) return "scene";
    if (hasBackground) return "background";
    return "subject";
}

function currentStrength(editTarget) {
    const value = Number.parseFloat(els.strength.value) || 0.48;
    if (editTarget === "background") return Math.max(value, 0.82).toFixed(2);
    if (editTarget === "scene") return Math.max(value, 0.72).toFixed(2);
    return value.toFixed(2);
}

function promptEditIntent() {
    const prompt = els.prompt.value.toLowerCase();
    const backgroundTerms = [
        "background",
        "backdrop",
        "scene",
        "environment",
        "location",
        "lobby",
        "studio",
        "street",
        "city",
        "hotel",
        "palace",
        "mountain",
        "desert",
        "garage",
        "stage",
        "moonbase",
        "bar",
        "restaurant",
        "castle",
        "space",
        "starfield",
        "nebula",
        "galaxy",
        "starship",
        "tavern",
        "skyline",
        "poster",
        "key art",
        "monument",
        "pegasus",
        "horse",
    ];
    const subjectTerms = [
        "outfit",
        "wardrobe",
        "clothing",
        "jacket",
        "shirt",
        "suit",
        "coat",
        "armor",
        "body",
        "hair",
        "beard",
        "hands",
        "prop",
        "keyboard",
    ];
    return {
        hasBackground: backgroundTerms.some((term) => prompt.includes(term)),
        hasSubject: subjectTerms.some((term) => prompt.includes(term)),
    };
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
