// ==================== CONSTANTS ====================
const DISCO_NAMES = ["13", "cat", "blocks", "chirp", "far", "mall", "mellohi", "stal", "strad", "ward", "11", "wait", "otherside", "5", "pigstep", "relic", "creator", "creator_music_box", "precipice", "tears", "lava_chicken"];
const MAX_FILES = DISCO_NAMES.length;
const PACK_ICON_URL = "https://static.wikia.nocookie.net/minecraft_gamepedia/images/e/ee/Jukebox_JE2_BE2.png";

const DISCO_DURATIONS = {
  "13": 178, "cat": 185, "blocks": 345, "chirp": 185, "far": 174,
  "mall": 197, "mellohi": 96, "stal": 150, "strad": 188, "ward": 251,
  "11": 71, "wait": 237, "otherside": 195, "5": 178, "pigstep": 148,
  "relic": 219, "creator": 176, "creator_music_box": 73, "precipice": 299,
  "tears": 175, "lava_chicken": 135
};

// ==================== STATE ====================
class AppState {
  constructor() {
    this.currentLang = "en";
    this.currentAudio = null;
    this.currentPlayBtn = null;
    this.currentFiles = [];
    this.isPreviewVisible = false;
    this.audioUrls = new Map();
    this.currentOpenSection = null;
    this.selectedIcon = null;
  }

  addFiles(files) {
    this.currentFiles.push(...files);
  }

  removeFile(index) {
    const file = this.currentFiles[index];
    this.cleanupAudioUrl(file);
    this.currentFiles.splice(index, 1);
  }

  cleanupAudioUrl(file) {
    const url = this.audioUrls.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      this.audioUrls.delete(file);
    }
  }

  getOrCreateAudioUrl(file) {
    if (!this.audioUrls.has(file)) {
      this.audioUrls.set(file, URL.createObjectURL(file));
    }
    return this.audioUrls.get(file);
  }

  setSelectedIcon(file) {
    if (this.selectedIcon && this.selectedIcon.url) {
      URL.revokeObjectURL(this.selectedIcon.url);
    }
    this.selectedIcon = file ? {
      file: file,
      url: URL.createObjectURL(file)
    } : null;
  }

  cleanup() {
    for (const url of this.audioUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.audioUrls.clear();
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    if (this.selectedIcon && this.selectedIcon.url) {
      URL.revokeObjectURL(this.selectedIcon.url);
      this.selectedIcon = null;
    }
  }
}

const state = new AppState();

// ==================== DOM ELEMENTS ====================
const elements = {};

function initElements() {
  const ids = [
    'oggInput', 'mcpackInput', 'previewList', 'togglePreviewBtn',
    'createBtn', 'mensaje', 'loader', 'toggleInformationBtn',
    'information', 'toggleFormBtn', 'packForm', 'langToggle',
    'packName', 'packDescription', 'packVersionMajor', 'packVersionMinor', 
    'packVersionPatch', 'packIcon', 'iconPreview', 'removeIconBtn'
  ];
  
  ids.forEach(id => {
    elements[id] = document.getElementById(id);
  });
}

// ==================== TRANSLATIONS ====================
let currentTranslations = {};

function t(key) {
  return currentTranslations[key] || key; 
}

async function fetchTranslations(lang) {
  const url = `language/${lang}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load translations for ${lang}`);
  }
  return response.json();
}

async function loadTranslations() {
  try {
    const userLang = navigator.language || 'en';
    const primaryLang = userLang.split('-')[0];

    try {
      currentTranslations = await fetchTranslations(primaryLang);
      state.currentLang = primaryLang;
    } catch (e) {
      currentTranslations = await fetchTranslations('en');
      state.currentLang = 'en';
    }

    document.documentElement.lang = state.currentLang;
    applyTranslations();
  } catch (error) {
    console.error("Critical error loading translations:", error);
    state.currentLang = 'en';
    document.documentElement.lang = 'en';
    applyTranslations();
  }
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const translation = t(key);
    if (translation) {
      el.innerHTML = translation;
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    const translation = t(key);
    if (translation) {
      el.placeholder = translation;
    }
  });
  
  updateDynamicTexts();
}

function updateDynamicTexts() {
  const infoVisible = elements.information.style.display === "block";
  elements.toggleInformationBtn.innerHTML = `<i class="fas fa-info-circle"></i> ${t(infoVisible ? "hideInfo" : "showInfo")}`;

  elements.togglePreviewBtn.innerHTML = `<i class="fas ${state.isPreviewVisible ? "fa-eye-slash" : "fa-eye"}"></i> ${t(state.isPreviewVisible ? "hideSongs" : "showSongs")}`;

  const formVisible = elements.packForm.style.display === "block";
  elements.toggleFormBtn.innerHTML = `
    <i class="fas ${formVisible ? "fa-times" : "fa-sliders-h"}"></i> 
    <span class="title">${t("packOptions")}</span>
    <span class="subtitle">${t("optional")}</span>
  `;
}

// ==================== AUDIO UTILITIES ====================
function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    
    const cleanup = () => URL.revokeObjectURL(url);
    
    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration);
      cleanup();
    });
    
    audio.addEventListener("error", (e) => {
      cleanup();
      reject(new Error(`Failed to load audio: ${e.message}`));
    });
    
    audio.src = url;
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==================== DISC ASSIGNMENT ====================
async function assignDiscsOptimal(files) {
  const fileDurations = await Promise.all(
    files.map(async (file) => ({
      file,
      duration: await getAudioDuration(file)
    }))
  );

  fileDurations.sort((a, b) => b.duration - a.duration);

  const availableDiscs = Object.entries(DISCO_DURATIONS)
    .map(([name, duration]) => ({ name, duration }))
    .sort((a, b) => b.duration - a.duration);

  const assignments = [];
  const usedDiscs = new Set();

  for (const fileData of fileDurations) {
    let bestDisc = null;
    let bestDiff = Infinity;

    for (const disc of availableDiscs) {
      if (usedDiscs.has(disc.name)) continue;

      const diff = Math.abs(disc.duration - fileData.duration);
      
      if (disc.duration >= fileData.duration && diff < bestDiff) {
        bestDisc = disc.name;
        bestDiff = diff;
      }
    }

    if (!bestDisc) {
      for (const disc of availableDiscs) {
        if (usedDiscs.has(disc.name)) continue;
        
        const diff = Math.abs(disc.duration - fileData.duration);
        if (diff < bestDiff) {
          bestDisc = disc.name;
          bestDiff = diff;
        }
      }
    }

    if (bestDisc) {
      assignments.push({
        file: fileData.file,
        disc: bestDisc,
        userDuration: fileData.duration,
        discDuration: DISCO_DURATIONS[bestDisc],
        difference: bestDiff
      });
      usedDiscs.add(bestDisc);
    }
  }

  return assignments;
}

// ==================== FILE HANDLING ====================
async function handleOggUpload(event) {
  const newFiles = Array.from(elements.oggInput.files)
    .filter(newFile => !state.currentFiles.some(f => f.name === newFile.name));

  const remainingSlots = MAX_FILES - state.currentFiles.length;
  
  if (newFiles.length > remainingSlots) {
    showMessage(t("warningMaxFiles").replace("{slots}", remainingSlots), "warning");
    state.addFiles(newFiles.slice(0, remainingSlots));
  } else {
    state.addFiles(newFiles);
  }

  elements.oggInput.value = '';

  await updateFileList();
  updateCreateButtonState();
}

async function handleMcpackUpload(event) {
  try {
    const files = event.target.files;
    if (!files.length) return;

    const file = files[0];
    const data = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(data);

    // === 1. Extraer los .ogg (tu código actual) ===
    const extractedFiles = [];
    for (const [path, zipFile] of Object.entries(zip.files)) {
      if (path.endsWith(".ogg") && !zipFile.dir) {
        const blob = await zipFile.async("blob");
        const fileName = path.split("/").pop();
        extractedFiles.push(new File([blob], fileName, {type: "audio/ogg"}));
      }
    }

    // === 2. Leer manifest.json para rellenar los campos ===
    const manifestFile = zip.file("manifest.json");
    if (manifestFile) {
      const manifestText = await manifestFile.async("text");
      const manifest = JSON.parse(manifestText);

      // Header (nombre, descripción, versión, uuid no lo mostramos pero está)
      if (manifest.header) {
        if (manifest.header.name) {
          elements.packName.value = manifest.header.name;
        }
        if (manifest.header.description) {
          elements.packDescription.value = manifest.header.description;
        }
        if (Array.isArray(manifest.header.version) && manifest.header.version.length === 3) {
          elements.packVersionMajor.value = manifest.header.version[0];
          elements.packVersionMinor.value = manifest.header.version[1];
          elements.packVersionPatch.value = manifest.header.version[2];
        }
      }

      // Si hay pack_icon.png o texture.png, cargarlo como ícono
      const iconFile = zip.file("pack_icon.png") || zip.file("texture.png");
      if (iconFile) {
        const iconBlob = await iconFile.async("blob");
        const iconFileObj = new File([iconBlob], "pack_icon.png", { type: "image/png" });
        
        // Crear un FileList sintético para que funcione el input type=file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(iconFileObj);
        elements.packIcon.files = dataTransfer.files;

        // Guardar en el estado y mostrar vista previa
        state.setSelectedIcon(iconFileObj);
        updateIconPreview();
      }
    }

    // === 3. Añadir los .ogg extraídos (tu lógica actual) ===
    const newFiles = extractedFiles.filter(newFile =>
      !state.currentFiles.some(f => f.name === newFile.name)
    );

    if (!newFiles.length && !manifestFile) {
      showMessage(t("error"), "warning");
      elements.mcpackInput.value = '';
      return;
    }

    const remainingSlots = MAX_FILES - state.currentFiles.length;
    if (newFiles.length > remainingSlots) {
      showMessage(t("warningMaxFiles").replace("{slots}", remainingSlots), "warning");
      state.addFiles(newFiles.slice(0, remainingSlots));
    } else {
      state.addFiles(newFiles);
    }

    elements.mcpackInput.value = '';
    await updateFileList();
    updateCreateButtonState();

  } catch (err) {
    console.error("Error loading mcpack:", err);
    showMessage(t("error"), "error");
    elements.mcpackInput.value = '';
  }
}

function removeFile(index) {
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio = null;
    if (state.currentPlayBtn) {
      state.currentPlayBtn.innerHTML = `<i class="fas fa-play"></i> ${t("play")}`;
      state.currentPlayBtn.setAttribute('aria-label', t("play"));
      state.currentPlayBtn = null;
    }
  }
  
  state.removeFile(index);
  updateFileList();
  updateCreateButtonState();
}

// ==================== UI UPDATES ====================
function updateCreateButtonState() {
  elements.createBtn.disabled = state.currentFiles.length === 0;
}

async function updateFileList() {
  elements.previewList.innerHTML = "";

  if (!state.currentFiles.length) {
    elements.previewList.style.display = "none";
    elements.togglePreviewBtn.style.display = "none";
    elements.toggleFormBtn.style.display = "none";
    elements.createBtn.disabled = true;
    elements.packForm.style.display = "none";
    elements.information.style.display = "none";
    updateDynamicTexts();
    return;
  }

  elements.toggleFormBtn.style.display = "block";
  elements.previewList.style.display = state.isPreviewVisible ? "block" : "none";
  elements.togglePreviewBtn.style.display = "block";
  updateDynamicTexts();
  elements.createBtn.disabled = false;

  showLoadingMessage();

  try {
    const assignments = await assignDiscsOptimal(state.currentFiles);
    elements.previewList.innerHTML = "";

    assignments.forEach((assignment, index) => {
      const item = createPreviewItem(assignment, index);
      elements.previewList.appendChild(item);
    });

  } catch (error) {
    console.error("Error assigning discs:", error);
    elements.previewList.innerHTML = "";
    showMessage(t("error"), "error");
  }
}

function showLoadingMessage() {
  elements.previewList.innerHTML = `
    <div class="preview-item">
      <div style="text-align: center; padding: 10px; color: #666;">
        <i class="fas fa-spinner fa-spin"></i> ${t("loadingSongs")}
      </div>
    </div>
  `;
}

function createPreviewItem(assignment, index) {
  const item = document.createElement("div");
  item.className = "preview-item";

  const trackInfo = createTrackInfo(assignment);
  const buttonGroup = createButtonGroup(assignment, index);

  item.appendChild(trackInfo);
  item.appendChild(buttonGroup);

  return item;
}

function createTrackInfo(assignment) {
  const trackInfo = document.createElement("div");
  trackInfo.className = "track-info";

  const trackName = document.createElement("span");
  trackName.className = "track-name";
  trackName.textContent = assignment.file.name.replace(/\.ogg$/i, "");

  const diskInfo = document.createElement("span");
  diskInfo.className = "disk-name";
  diskInfo.textContent = `(${assignment.disc})`;

  const durationInfo = document.createElement("div");
  durationInfo.className = "duration-info";
  
  const songTime = formatTime(assignment.userDuration);
  const discTime = formatTime(assignment.discDuration);
  const timeDifference = assignment.discDuration - assignment.userDuration;
  const color = timeDifference < 0 ? "#e61919" : "#FFFFFF";

  durationInfo.innerHTML = `
    <small style="color: ${color}">
      ${t("song")}: ${songTime} | ${t("disc")}: ${discTime}
    </small>
  `;

  trackInfo.appendChild(trackName);
  trackInfo.appendChild(durationInfo);
  trackInfo.appendChild(diskInfo);

  return trackInfo;
}

function createButtonGroup(assignment, index) {
  const buttonGroup = document.createElement("div");
  buttonGroup.className = "button-group";

  const audioUrl = state.getOrCreateAudioUrl(assignment.file);

  const playBtn = createButton(
    "play",
    t("play"),
    `<i class="fas fa-play"></i> ${t("play")}`,
    () => handlePlayPause(audioUrl, playBtn)
  );

  const removeBtn = createButton(
    "remove",
    t("remove"),
    `<i class="fas fa-trash-alt"></i> ${t("remove")}`,
    () => removeFile(index)
  );

  buttonGroup.appendChild(playBtn);
  buttonGroup.appendChild(removeBtn);

  return buttonGroup;
}

function createButton(type, ariaLabel, html, onClick) {
  const button = document.createElement("button");
  button.className = `${type}-btn`;
  button.innerHTML = html;
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onClick);
  return button;
}

function handlePlayPause(audioUrl, button) {
  if (state.currentAudio && state.currentAudio.src !== audioUrl) {
    state.currentAudio.pause();
    if (state.currentPlayBtn) {
      state.currentPlayBtn.innerHTML = `<i class="fas fa-play"></i> ${t("play")}`;
      state.currentPlayBtn.setAttribute('aria-label', t("play"));
    }
  }

  if (!state.currentAudio || state.currentAudio.paused || state.currentAudio.src !== audioUrl) {
    state.currentAudio = new Audio(audioUrl);
    state.currentAudio.play().catch(err => {
      console.error("Error playing audio:", err);
      showMessage(t("error"), "error");
    });
    
    button.innerHTML = `<i class="fas fa-pause"></i> ${t("pause")}`;
    button.setAttribute('aria-label', t("pause"));
    state.currentPlayBtn = button;

    state.currentAudio.addEventListener('ended', () => {
      button.innerHTML = `<i class="fas fa-play"></i> ${t("play")}`;
      button.setAttribute('aria-label', t("play"));
      state.currentAudio = null;
      state.currentPlayBtn = null;
    });
  } else {
    state.currentAudio.pause();
    button.innerHTML = `<i class="fas fa-play"></i> ${t("play")}`;
    button.setAttribute('aria-label', t("play"));
    state.currentAudio = null;
    state.currentPlayBtn = null;
  }
}

function togglePreview() {
  state.isPreviewVisible = !state.isPreviewVisible;
  
  if (state.isPreviewVisible) {
    closeSection('information');
    closeSection('packForm');
    state.currentOpenSection = 'preview';
  } else {
    state.currentOpenSection = null;
  }
  
  elements.previewList.style.display = state.isPreviewVisible ? "block" : "none";
  updateDynamicTexts();
}

function toggleInformation() {
  const isCurrentlyOpen = elements.information.style.display === "block";
  
  if (isCurrentlyOpen) {
    closeSection('information');
    state.currentOpenSection = null;
  } else {
    closeSection('packForm');
    closeSection('preview');
    elements.information.style.display = "block";
    state.currentOpenSection = 'information';
  }
  
  updateDynamicTexts();
}

function togglePackForm() {
  const isCurrentlyOpen = elements.packForm.style.display === "block";
  
  if (isCurrentlyOpen) {
    closeSection('packForm');
    state.currentOpenSection = null;
  } else {
    closeSection('information');
    closeSection('preview');
    elements.packForm.style.display = "block";
    state.currentOpenSection = 'packForm';
  }
  
  updateDynamicTexts();
}

function closeSection(section) {
  if (section === 'information') {
    elements.information.style.display = "none";
  } else if (section === 'packForm') {
    elements.packForm.style.display = "none";
  } else if (section === 'preview') {
    state.isPreviewVisible = false;
    elements.previewList.style.display = "none";
  }
}

function showMessage(text, type = 'info', duration = 4000) {
  elements.mensaje.textContent = text;
  elements.mensaje.style.color = 
    type === 'error' ? 'red' : 
    type === 'warning' ? 'orange' : 
    'SpringGreen';
  
  if (duration > 0) {
    setTimeout(() => { elements.mensaje.textContent = ''; }, duration);
  }
}

// ==================== ICON HANDLING ====================
function handleIconUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  state.setSelectedIcon(file);
  updateIconPreview();
}

function updateIconPreview() {
  if (!state.selectedIcon) {
    elements.iconPreview.style.display = 'none';
    elements.removeIconBtn.style.display = 'none';
    return;
  }

  elements.iconPreview.style.display = 'block';
  elements.removeIconBtn.style.display = 'inline-block';
  
  const img = document.createElement('img');
  img.src = state.selectedIcon.url;

  const fileName = state.selectedIcon.file?.name || "pack_icon";
  img.alt = `${fileName.split('.').slice(0, -1).join('.')} (pack icon preview)`;

  elements.iconPreview.innerHTML = '';
  elements.iconPreview.appendChild(img);
}

function removeIcon() {
  state.setSelectedIcon(null);
  elements.packIcon.value = '';
  updateIconPreview();
}

async function convertImageToPNG(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert image to PNG'));
        }
      }, 'image/png');
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

// ==================== PACK CREATION ====================
async function fetchResourceAsBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return await response.arrayBuffer();
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function crearMod() {
  showMessage("");
  elements.loader.style.display = "block";
  elements.createBtn.disabled = true;

  try {
    if (!state.currentFiles.length) {
      throw new Error("No files selected");
    }

    const name = elements.packName.value.trim() || t("packNamePlaceholder");
    const description = elements.packDescription.value.trim() || t("packDescPlaceholder");
    
    const major = parseInt(elements.packVersionMajor.value) || 1;
    const minor = parseInt(elements.packVersionMinor.value) || 0;
    const patch = parseInt(elements.packVersionPatch.value) || 0;
    const version = [
      Math.max(0, Math.min(99, major)),
      Math.max(0, Math.min(99, minor)),
      Math.max(0, Math.min(99, patch))
    ];

    const zip = new JSZip();
    const soundsFolder = zip.folder("sounds/music/game/records");

    const assignments = await assignDiscsOptimal(state.currentFiles);
    
    for (const assignment of assignments) {
      const buffer = await assignment.file.arrayBuffer();
      soundsFolder.file(`${assignment.disc}.ogg`, buffer);
    }

        let iconBuffer = null;

    try {
      let sourceBlob;

      if (state.selectedIcon) {
        // Ícono subido por el usuario
        sourceBlob = state.selectedIcon.file;
      } else {
        // Ícono por defecto (jukebox)
        const response = await fetch(PACK_ICON_URL);
        if (!response.ok) throw new Error("No se pudo descargar el ícono por defecto");
        sourceBlob = await response.blob();
      }

      // === FORZAR 1080×1080 con fondo TRANSPARENTE ===
      const img = new Image();
      // Necesitamos permitir CORS si la imagen es externa (el ícono por defecto lo es)
      img.crossOrigin = "anonymous";
      const objectUrl = URL.createObjectURL(sourceBlob);
      img.src = objectUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Error cargando imagen del ícono"));
      });

      const TARGET_SIZE = 1080;

      const canvas = document.createElement("canvas");
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;

      const ctx = canvas.getContext("2d");

      // Fondo transparente (no pintamos nada → queda #00000000)
      ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);

      // Escalar y centrar manteniendo proporción
      const scale = Math.max(TARGET_SIZE / img.width, TARGET_SIZE / img.height);
      const scaledWidth  = img.width  * scale;
      const scaledHeight = img.height * scale;
      const offsetX = (TARGET_SIZE - scaledWidth)  / 2;
      const offsetY = (TARGET_SIZE - scaledHeight) / 2;

      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

      // Generar PNG con transparencia
      const pngBlob = await new Promise(resolve => {
        canvas.toBlob(resolve, "image/png"); // PNG siempre conserva transparencia
      });

      URL.revokeObjectURL(objectUrl);
      iconBuffer = await pngBlob.arrayBuffer();

    } catch (err) {
      console.warn("No se pudo procesar el ícono (se creará el pack sin ícono):", err);
    }

    if (iconBuffer) {
      zip.file("pack_icon.png", iconBuffer);
    }

    zip.file("manifest.json", JSON.stringify({
      format_version: 2,
      header: {
        uuid: crypto.randomUUID(),
        name,
        version,
        description,
        min_engine_version: [1, 21, 0],
      },
      modules: [{
        description,
        version,
        uuid: crypto.randomUUID(),
        type: "resources",
      }],
    }, null, 2));

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/x-minecraft-pack",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    downloadFile(blob, `${name}.mcpack`);
    showMessage(t("success"), "success");
  } catch (err) {
    console.error("Error creating pack:", err);
    showMessage(t("error"), "error");
  } finally {
    elements.loader.style.display = "none";
    elements.createBtn.disabled = false;
  }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  // Listeners de carga de archivos
  elements.oggInput.addEventListener('change', handleOggUpload);
  elements.mcpackInput.addEventListener('change', handleMcpackUpload);
  elements.packIcon.addEventListener('change', handleIconUpload);
  
  // Listeners de botones
  elements.togglePreviewBtn.addEventListener('click', togglePreview);
  elements.removeIconBtn.addEventListener('click', removeIcon);
  elements.toggleInformationBtn.addEventListener('click', toggleInformation);
  elements.toggleFormBtn.addEventListener('click', togglePackForm);
  
  // Botón de selección de icono
  document.getElementById('iconBtn')?.addEventListener('click', () => {
    elements.packIcon.click();
  });
  
  // Toggle de idioma
  elements.langToggle?.addEventListener('click', () => {
    state.currentLang = state.currentLang === 'en' ? 'es' : 'en';
    applyTranslations();
  });
  
  // Configurar inputs de versión
  setupVersionInputs();
  
  // Accesibilidad en labels de carga
  setupUploadLabelsAccessibility();
  
  // Limpieza antes de cerrar
  window.addEventListener('beforeunload', () => {
    state.cleanup();
  });
}

// ==================== VERSION INPUTS ====================

function setupVersionInputs() {
  const inputs = [
    elements.packVersionMajor,
    elements.packVersionMinor,
    elements.packVersionPatch
  ];
  
  inputs.forEach((input, index) => {
    // Validación y autonavegación
    input.addEventListener('input', (e) => {
      // Limitar a números y máximo 2 dígitos
      const value = e.target.value.replace(/\D/g, '').slice(0, 2);
      e.target.value = value;
      
      // Autonavegar al siguiente campo si tiene 2 dígitos
      if (value.length === 2 && inputs[index + 1]) {
        inputs[index + 1].focus();
      }
    });
    
    // Navegación hacia atrás con Backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].select();
      }
    });
  });
}

// ==================== ACCESSIBILITY ====================

function setupUploadLabelsAccessibility() {
  document.querySelectorAll('.upload-label').forEach(label => {
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const inputId = label.getAttribute('for');
        document.getElementById(inputId)?.click();
      }
    });
  });
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  elements.loader.style.display = "none";
  elements.createBtn.disabled = true;
  elements.information.style.display = "none";
  setupEventListeners();
  loadTranslations();
});

window.crearMod = crearMod;
