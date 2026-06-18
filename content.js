// content.js — AI Prompt Cat
// three.min.js and GLTFLoader.js are loaded before this via manifest.json

// ─── GUARD: only mount once ───────────────────────────────────────────────────
if (window.__promptCatMounted__) {
  // do nothing — already running
} else {
  window.__promptCatMounted__ = true;
  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let UI = null;
let uiOpen = false;
let catPos = { x: 0, y: 0 };

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  const stale = document.getElementById("prompt-cat");
  if (stale) stale.remove();
  document.body.appendChild(createCat());
  console.log("[Prompt Cat] Mounted. GLB:", chrome.runtime.getURL("models/cartoon_cat.glb"));
}

// ─── CAT CONTAINER + DRAG ─────────────────────────────────────────────────────
function createCat() {
  const cat = document.createElement("div");
  cat.id = "prompt-cat";
  Object.assign(cat.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    width: "110px",
    height: "110px",
    cursor: "grab",
    zIndex: "2147483647",
    userSelect: "none",
    transition: "filter 0.3s ease",
    borderRadius: "50%",
    overflow: "visible",
    background: "transparent",
  });

  mountThreeCanvas(cat);

  let dragging = false, startX, startY, originX, originY;

  cat.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    originX = catPos.x;
    originY = catPos.y;
    cat.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    catPos.x = originX + (e.clientX - startX);
    catPos.y = originY + (e.clientY - startY);
    cat.style.right  = (24 - catPos.x) + "px";
    cat.style.bottom = (24 - catPos.y) + "px";
    if (UI) {
      UI.style.right  = (24 - catPos.x) + "px";
      UI.style.bottom = (24 - catPos.y + 126) + "px";
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    dragging = false;
    cat.style.cursor = "grab";
    if (Math.sqrt(dx * dx + dy * dy) < 6) toggleUI();
  });

  return cat;
}

// ─── THREE.JS GLB RENDERER ───────────────────────────────────────────────────
function mountThreeCanvas(container) {
  if (typeof THREE === "undefined") {
    console.error("[Prompt Cat] THREE not found — check manifest loads three.min.js first");
    showEmojiFallback(container);
    return;
  }

  if (!THREE.GLTFLoader) {
    console.error("[Prompt Cat] THREE.GLTFLoader not found — check manifest loads GLTFLoader.js");
    showEmojiFallback(container);
    return;
  }

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(110, 110);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.borderRadius = "50%";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.5, 3.5);

  scene.add(new THREE.AmbientLight(0xffeedd, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 4, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xaaddff, 0.4);
  fill.position.set(-2, 1, 1);
  scene.add(fill);

  let mixer = null;
  const clock = new THREE.Clock();

  (function animate() {
    requestAnimationFrame(animate);
    if (mixer) mixer.update(clock.getDelta());
    renderer.render(scene, camera);
  })();

  const modelURL = chrome.runtime.getURL("models/cartoon_cat.glb");
  const loader = new THREE.GLTFLoader();

  loader.load(
    modelURL,
    function(gltf) {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.8 / maxDim;
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      scene.add(model);

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        const idleClip =
          gltf.animations.find(function(a) { return /idle/i.test(a.name); }) ||
          gltf.animations[0];
        mixer.clipAction(idleClip).play();
        console.log("[Prompt Cat] Playing animation:", idleClip.name);
      }

      console.log("[Prompt Cat] ✓ 3D cat loaded");
    },
    undefined,
    function(err) {
      console.error("[Prompt Cat] ✗ GLB failed to load:", err);
      console.error("[Prompt Cat] URL tried:", modelURL);
      container.innerHTML = "";
      showEmojiFallback(container);
    }
  );
}

function showEmojiFallback(container) {
  const div = document.createElement("div");
  Object.assign(div.style, {
    width: "110px",
    height: "110px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "56px",
    borderRadius: "50%",
    background: "rgba(120,80,255,0.1)",
    border: "2px solid rgba(120,80,255,0.3)",
    animation: "catBob 2s ease-in-out infinite",
  });
  div.textContent = "🐱";
  container.appendChild(div);
}

// ─── TOGGLE UI ────────────────────────────────────────────────────────────────
function toggleUI() {
  uiOpen = !uiOpen;
  const cat = document.getElementById("prompt-cat");
  if (uiOpen) {
    // Check if user has a Groq key saved
    chrome.storage.local.get("groqApiKey", function(result) {
      if (result.groqApiKey) {
        UI = createMainUI(result.groqApiKey);
      } else {
        UI = createSetupUI();
      }
      document.body.appendChild(UI);
      if (cat) cat.style.filter = "drop-shadow(0 0 14px rgba(120,80,255,0.8))";
    });
  } else {
    if (UI) { UI.remove(); UI = null; }
    if (cat) cat.style.filter = "none";
  }
}

// ─── SETUP UI (first time — no key yet) ──────────────────────────────────────
function createSetupUI() {
  const ui = document.createElement("div");
  ui.id = "cat-ui";
  Object.assign(ui.style, {
    position: "fixed",
    bottom: (24 - catPos.y + 126) + "px",
    right:  (24 - catPos.x) + "px",
    width: "320px",
    background: "rgba(10, 8, 22, 0.97)",
    border: "1px solid rgba(120,80,255,0.4)",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
    backdropFilter: "blur(16px)",
    zIndex: "2147483646",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#e8e4f0",
    fontSize: "13px",
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" });
  const title = document.createElement("span");
  title.textContent = "✦ Prompt Cat Setup";
  Object.assign(title.style, { fontWeight: "700", color: "#a78bfa", fontSize: "14px" });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, { background: "none", border: "none", color: "#6b7280", fontSize: "20px", cursor: "pointer", lineHeight: "1", padding: "0 4px" });
  closeBtn.addEventListener("click", toggleUI);
  header.appendChild(title);
  header.appendChild(closeBtn);
  ui.appendChild(header);

  // Explanation
  const explain = document.createElement("p");
  explain.textContent = "Prompt Cat uses Groq AI to rewrite your prompts. Groq is completely free — no credit card needed.";
  Object.assign(explain.style, { fontSize: "12px", color: "#9ca3af", lineHeight: "1.6", margin: "0 0 16px" });
  ui.appendChild(explain);

  // Step 1 — Sign up button
  const step1Label = document.createElement("p");
  step1Label.textContent = "Step 1 — Get your free Groq API key:";
  Object.assign(step1Label.style, { fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" });
  ui.appendChild(step1Label);

  const groqBtn = document.createElement("button");
  groqBtn.textContent = "🔗 Sign up on Groq (free) →";
  Object.assign(groqBtn.style, {
    width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid rgba(120,80,255,0.4)",
    background: "rgba(120,80,255,0.15)", color: "#a78bfa",
    fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "16px",
  });
  groqBtn.addEventListener("click", function() {
    window.open("https://console.groq.com/keys", "_blank");
  });
  ui.appendChild(groqBtn);

  // Step 2 — Paste key
  const step2Label = document.createElement("p");
  step2Label.textContent = "Step 2 — Paste your API key here:";
  Object.assign(step2Label.style, { fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" });
  ui.appendChild(step2Label);

  const keyInput = document.createElement("input");
  keyInput.type = "password";
  keyInput.placeholder = "gsk_...";
  Object.assign(keyInput.style, {
    width: "100%", padding: "10px", borderRadius: "10px",
    border: "1px solid rgba(120,80,255,0.25)",
    background: "rgba(255,255,255,0.05)", color: "#e8e4f0",
    fontSize: "13px", fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", marginBottom: "12px",
  });
  ui.appendChild(keyInput);

  // Free note
  const freeNote = document.createElement("p");
  freeNote.textContent = "⚠ Groq's free tier has a usage limit. You won't be charged — if you hit the limit, you'll need to wait or sign up for a paid plan on Groq's side.";
  Object.assign(freeNote.style, { fontSize: "10px", color: "#6b7280", lineHeight: "1.5", margin: "0 0 14px" });
  ui.appendChild(freeNote);

  // Save button
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save & Start →";
  Object.assign(saveBtn.style, {
    width: "100%", padding: "10px", borderRadius: "10px", border: "none",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer",
  });
  saveBtn.addEventListener("click", function() {
    const key = keyInput.value.trim();
    if (!key || !key.startsWith("gsk_")) {
      keyInput.style.borderColor = "#ef4444";
      keyInput.placeholder = "Must start with gsk_...";
      setTimeout(function() {
        keyInput.style.borderColor = "rgba(120,80,255,0.25)";
        keyInput.placeholder = "gsk_...";
      }, 2000);
      return;
    }
    chrome.storage.local.set({ groqApiKey: key }, function() {
      UI.remove();
      UI = createMainUI(key);
      document.body.appendChild(UI);
    });
  });
  ui.appendChild(saveBtn);

  setTimeout(function() { keyInput.focus(); }, 60);
  return ui;
}

// ─── MAIN PROMPT UI ───────────────────────────────────────────────────────────
function createMainUI(groqApiKey) {
  const ui = document.createElement("div");
  ui.id = "cat-ui";
  Object.assign(ui.style, {
    position: "fixed",
    bottom: (24 - catPos.y + 126) + "px",
    right:  (24 - catPos.x) + "px",
    width: "320px",
    background: "rgba(10, 8, 22, 0.97)",
    border: "1px solid rgba(120,80,255,0.4)",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
    backdropFilter: "blur(16px)",
    zIndex: "2147483646",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#e8e4f0",
    fontSize: "13px",
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" });

  const title = document.createElement("span");
  title.textContent = "✦ Prompt Cat";
  Object.assign(title.style, { fontWeight: "700", color: "#a78bfa", fontSize: "14px" });

  // Header right — settings + close
  const headerRight = document.createElement("div");
  Object.assign(headerRight.style, { display: "flex", alignItems: "center", gap: "4px" });

  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "⚙";
  settingsBtn.title = "Change API key";
  Object.assign(settingsBtn.style, { background: "none", border: "none", color: "#6b7280", fontSize: "14px", cursor: "pointer", padding: "0 4px" });
  settingsBtn.addEventListener("click", function() {
    chrome.storage.local.remove("groqApiKey", function() {
      UI.remove();
      UI = createSetupUI();
      document.body.appendChild(UI);
    });
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, { background: "none", border: "none", color: "#6b7280", fontSize: "20px", cursor: "pointer", lineHeight: "1", padding: "0 4px" });
  closeBtn.addEventListener("click", toggleUI);

  headerRight.appendChild(settingsBtn);
  headerRight.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(headerRight);
  ui.appendChild(header);

  // Input label
  const inputLabel = document.createElement("label");
  inputLabel.textContent = "Your rough idea";
  Object.assign(inputLabel.style, { fontSize: "11px", color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: "5px" });
  ui.appendChild(inputLabel);

  // Textarea
  const input = document.createElement("textarea");
  input.placeholder = "e.g. so basically can you explain how recursion works...";
  input.rows = 3;
  Object.assign(input.style, {
    width: "100%",
    minHeight: "72px",
    resize: "vertical",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(120,80,255,0.25)",
    borderRadius: "10px",
    color: "#e8e4f0",
    fontSize: "13px",
    fontFamily: "inherit",
    lineHeight: "1.5",
    padding: "10px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  });
  input.addEventListener("focus", function() { input.style.borderColor = "rgba(120,80,255,0.6)"; });
  input.addEventListener("blur",  function() { input.style.borderColor = "rgba(120,80,255,0.25)"; });
  ui.appendChild(input);

  // Optimized output area
  const optimizedWrap = document.createElement("div");
  optimizedWrap.style.display = "none";
  optimizedWrap.style.marginTop = "10px";

  const optimizedLabel = document.createElement("label");
  optimizedLabel.textContent = "Optimized prompt";
  Object.assign(optimizedLabel.style, { fontSize: "11px", color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: "5px" });

  const optimizedBox = document.createElement("div");
  Object.assign(optimizedBox.style, {
    minHeight: "60px",
    background: "rgba(120,80,255,0.07)",
    border: "1px solid rgba(120,80,255,0.3)",
    borderRadius: "10px",
    color: "#c4b5fd",
    fontSize: "13px",
    lineHeight: "1.6",
    padding: "10px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  });

  optimizedWrap.appendChild(optimizedLabel);
  optimizedWrap.appendChild(optimizedBox);
  ui.appendChild(optimizedWrap);

  // Button row
  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "8px", marginTop: "12px" });

  // Mic button
  const micBtn = document.createElement("button");
  micBtn.textContent = "🎤";
  micBtn.title = "Speak your prompt";
  Object.assign(micBtn.style, {
    width: "36px", height: "36px", borderRadius: "50%", border: "none",
    background: "rgba(255,255,255,0.07)", color: "#9ca3af",
    fontSize: "16px", cursor: "pointer", flexShrink: "0",
  });

  // Optimize button
  const optimizeBtn = document.createElement("button");
  optimizeBtn.textContent = "✨ Optimize";
  Object.assign(optimizeBtn.style, {
    flex: "1", padding: "8px 12px", borderRadius: "10px", border: "none",
    background: "rgba(120,80,255,0.2)", color: "#a78bfa",
    fontSize: "13px", fontWeight: "600", cursor: "pointer",
  });

  // Inject button
  const injectBtn = document.createElement("button");
  injectBtn.textContent = "→ Inject";
  Object.assign(injectBtn.style, {
    flex: "1", padding: "8px 12px", borderRadius: "10px", border: "none",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer",
  });

  btnRow.appendChild(micBtn);
  btnRow.appendChild(optimizeBtn);
  btnRow.appendChild(injectBtn);
  ui.appendChild(btnRow);

  // Footer note
  const note = document.createElement("p");
  note.textContent = "Inject fills the textbox — you still press Send";
  Object.assign(note.style, { fontSize: "10px", color: "#4b5563", margin: "9px 0 0", textAlign: "center" });
  ui.appendChild(note);

  // ── Wire up logic ──
  let useOptimized = false;

  optimizeBtn.addEventListener("click", async function() {
    const text = input.value.trim();
    if (!text) {
      input.style.borderColor = "#ef4444";
      setTimeout(function() { input.style.borderColor = "rgba(120,80,255,0.25)"; }, 1200);
      return;
    }
    optimizeBtn.textContent = "✦ Thinking...";
    optimizeBtn.disabled = true;
    optimizedBox.textContent = "Rewriting your prompt...";
    optimizedWrap.style.display = "block";

    try {
      const result = await optimizePrompt(text, groqApiKey);
      optimizedBox.textContent = result;
      useOptimized = true;
    } catch (err) {
      optimizedBox.textContent = "⚠ " + (err.message || "Something went wrong. Check your Groq key.");
      console.error("[Prompt Cat] Optimize error:", err);
    } finally {
      optimizeBtn.textContent = "✨ Optimize";
      optimizeBtn.disabled = false;
    }
  });

  injectBtn.addEventListener("click", function() {
    const text = (useOptimized && optimizedBox.textContent.trim())
      ? optimizedBox.textContent.trim()
      : input.value.trim();
    if (!text) return;
    injectIntoTextbox(text);
    toggleUI();
  });

  // Ctrl/Cmd+Enter shortcut
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      injectBtn.click();
    }
  });

  // Mic — Web Speech API
  let recognition = null;
  micBtn.addEventListener("click", function() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.textContent = "🚫"; return; }
    if (recognition) { recognition.stop(); return; }
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = function(e) {
      const t = Array.from(e.results).map(function(r) { return r[0].transcript; }).join(" ");
      input.value = input.value ? input.value + " " + t : t;
    };
    recognition.onend = function() {
      recognition = null;
      micBtn.textContent = "🎤";
      micBtn.style.color = "#9ca3af";
      micBtn.style.background = "rgba(255,255,255,0.07)";
    };
    recognition.onerror = function() { recognition = null; micBtn.textContent = "🎤"; };
    recognition.start();
    micBtn.textContent = "⏹";
    micBtn.style.color = "#f87171";
    micBtn.style.background = "rgba(239,68,68,0.15)";
  });

  setTimeout(function() { input.focus(); }, 60);
  return ui;
}

// ─── PROMPT OPTIMIZER — Groq API ─────────────────────────────────────────────
async function optimizePrompt(raw, apiKey) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: `You are a prompt compressor. Rewrite user input into a single, concise, high-quality AI prompt.

Rules:
- Extract the core intent and goal
- Remove filler words, hedging, and rambling
- Output ONLY the rewritten prompt — no explanation, no preamble, no quotes
- Keep it under 30 words
- Do NOT add generic phrases like "Be concise", "You are a helpful assistant", or "Answer briefly"
- Do NOT echo the user's input — actually rewrite it

Examples:
Input: "So basically I want to build a website where users upload 3D models and AI analyzes them and gives suggestions."
Output: Build an AI-powered 3D model analysis platform that provides automated quality assessment and improvement recommendations.

Input: "I want a website where students upload resumes and AI tells them what to improve for internships."
Output: Create an AI resume review platform that analyzes student resumes and provides internship-focused improvement suggestions.`
        },
        {
          role: "user",
          content: raw,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || ("Groq API error " + response.status);
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ─── INJECT INTO TEXTBOX ─────────────────────────────────────────────────────
function injectIntoTextbox(text) {
  var selectors = [
    "#prompt-textarea",
    "div.ProseMirror[contenteditable='true']",
    "div[contenteditable='true'].ProseMirror",
    "div[contenteditable='true'][data-placeholder]",
    "div[contenteditable='true']",
    "textarea",
  ];

  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (!el) continue;

    el.focus();

    if (el.tagName === "TEXTAREA") {
      var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      if (setter && setter.set) {
        setter.set.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.innerHTML = "";
      var ok = document.execCommand("insertText", false, text);
      if (!ok || !el.textContent) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      }
    }

    console.log("[Prompt Cat] ✓ Injected into:", selectors[i]);
    return;
  }

  console.warn("[Prompt Cat] ✗ Could not find textbox");
}