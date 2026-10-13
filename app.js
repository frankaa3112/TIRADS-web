/**
 * TI-RADS Structured Ultrasound Reporting System
 * Application Logic & State Management
 */

// Application State
let appState = {
  template: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)),
  // Selected finding texts from Other Findings checkboxes
  selectedThyroidFindings: [],
  selectedNeckFindings: [],
  // Current active form input state (defaults to 0 pts)
  activeInput: {
    location: "",
    size: "",
    imgNo: "",
    features: {
      composition: "cystic", // 0 pts
      echogenicity: "anechoic", // 0 pts
      shape: "wider", // 0 pts
      margin: "smooth", // 0 pts
      echogenicFoci: ["none"] // 0 pts
    }
  },
  // If editing an existing nodule from list, store its id; null if adding new
  editingNoduleId: null,
  // Currently highlighted / selected row in table
  highlightedNoduleId: null,
  // Current sort mode for Nodule List: null | 'image' | 'level' | 'rec'
  sortState: null,
  // List of saved nodules
  nodules: []
};

// Unique nodule id counter
let noduleIdCounter = 1;

// DOM Elements
const noduleInputContainer = document.getElementById("noduleInputContainer");
const noduleTableBody = document.getElementById("noduleTableBody");
const btnClearAllNodules = document.getElementById("btnClearAllNodules");
const btnResetNoduleOrder = document.getElementById("btnResetNoduleOrder");
const thOrderIndex = document.getElementById("thOrderIndex");
const thSortImage = document.getElementById("thSortImage");
const thSortLevel = document.getElementById("thSortLevel");
const thSortRec = document.getElementById("thSortRec");
const sortIconIndex = document.getElementById("sortIconIndex");
const sortIconImage = document.getElementById("sortIconImage");
const sortIconLevel = document.getElementById("sortIconLevel");
const sortIconRec = document.getElementById("sortIconRec");
const reportPreviewBox = document.getElementById("reportPreviewBox");

const btnCopyReport = document.getElementById("btnCopyReport");
const btnOpenTemplateModal = document.getElementById("btnOpenTemplateModal");
const btnCloseTemplateModal = document.getElementById("btnCloseTemplateModal");
const templateModal = document.getElementById("templateModal");
const btnSaveTemplateChanges = document.getElementById("btnSaveTemplateChanges");
const btnRestoreDefaultTemplate = document.getElementById("btnRestoreDefaultTemplate");
const btnExportTemplate = document.getElementById("btnExportTemplate");
const fileImportTemplate = document.getElementById("fileImportTemplate");
const btnResetToDefault = document.getElementById("btnResetToDefault");
const toastEl = document.getElementById("toastNotification");

// Modal fields
const tplName = document.getElementById("tplName");
const tplExamTitle = document.getElementById("tplExamTitle");
const tplThyroidHeader = document.getElementById("tplThyroidHeader");
const tplParenchymaLeadIn = document.getElementById("tplParenchymaLeadIn");
const tplNeckHeader = document.getElementById("tplNeckHeader");
const tplNoduleItemFormat = document.getElementById("tplNoduleItemFormat");
const tplImpressionItemFormat = document.getElementById("tplImpressionItemFormat");

// Other Findings Quick Options Containers & Add Buttons
const parenchymaQuickOptionsContainer = document.getElementById("parenchymaQuickOptionsContainer");
const neckQuickOptionsContainer = document.getElementById("neckQuickOptionsContainer");
const btnAddThyroidOption = document.getElementById("btnAddThyroidOption");
const btnAddNeckOption = document.getElementById("btnAddNeckOption");

// Chip Context Menu Elements
const chipContextMenu = document.getElementById("chipContextMenu");
const menuItemEditOption = document.getElementById("menuItemEditOption");
const menuItemRemoveOption = document.getElementById("menuItemRemoveOption");

// Option Edit/Add Modal Elements
const optionModal = document.getElementById("optionModal");
const optionModalTitle = document.getElementById("optionModalTitle");
const btnCloseOptionModal = document.getElementById("btnCloseOptionModal");
const btnCancelOptionModal = document.getElementById("btnCancelOptionModal");
const btnSaveOptionModal = document.getElementById("btnSaveOptionModal");
const inputOptionLabel = document.getElementById("inputOptionLabel");
const inputOptionText = document.getElementById("inputOptionText");
const inputOptionImpression = document.getElementById("inputOptionImpression");

// Context state
let activeContextMenuContext = null; // { groupKey, index, opt }
let activeOptionModalState = null;   // { mode: 'edit'|'add', groupKey, index, opt }


/**
 * Initialize Application Data (Default nodule list is empty)
 */
function initializeData(loadSampleNodule = false) {
  // Reset findings selections (empty by default)
  appState.selectedThyroidFindings = [];
  appState.selectedNeckFindings = [];
  
  if (loadSampleNodule) {
    // Sample nodule matching example: TR4, left lower pole, 1.6 cm, Img:17, Suggest FNA
    appState.nodules = [
      {
        id: noduleIdCounter++,
        selected: true,
        location: "left lower pole",
        size: 1.6,
        imgNo: "17",
        features: {
          composition: "solid", // 2 pts
          echogenicity: "hypoechoic", // 2 pts
          shape: "wider", // 0 pts
          margin: "smooth", // 0 pts
          echogenicFoci: ["none"] // 0 pts
        },
        customRecommendation: ""
      }
    ];
  } else {
    // Default nodule list is EMPTY
    appState.nodules = [];
  }

  // Reset active input form to defaults (0 pts)
  resetActiveInput();

  // Reset sorting state
  appState.sortState = null;
  updateSortHeaderUI();

  renderNoduleInput();
  renderNoduleTable();
  renderQuickOptions();
  updateReportPreview();
}

/**
 * Parse multi-line options string into array of { label, text }
 * Supports: "Label | - Report Text" or "- Plain Text"
 */
function parseOptionsText(text) {
  if (!text) return [];
  const lines = text.split("\n");
  const options = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("|")) {
      const parts = trimmed.split("|");
      const label = parts[0].trim();
      const val = parts.slice(1).join("|").trim();
      if (val) {
        options.push({ label: label || val, text: val });
      }
    } else {
      let label = trimmed.replace(/^[-*•\s]+/, "");
      if (label.length > 32) label = label.substring(0, 29) + "...";
      options.push({ label: label || trimmed, text: trimmed });
    }
  }
  return options;
}

/**
 * Format array of { label, text } into multi-line string "label | text"
 */
function formatOptionsToText(options) {
  if (!Array.isArray(options)) return "";
  return options.map(opt => `${opt.label} | ${opt.text}`).join("\n");
}

/**
 * Render Quick Options Checkboxes for Thyroid & Neck findings
 */
function renderQuickOptions() {
  const pOpts = appState.template.parenchymaQuickOptions || DEFAULT_TEMPLATE.parenchymaQuickOptions;
  const nOpts = appState.template.neckQuickOptions || DEFAULT_TEMPLATE.neckQuickOptions;

  renderQuickOptionGroup(parenchymaQuickOptionsContainer, "parenchyma", pOpts, appState.selectedThyroidFindings, () => {
    updateReportPreview();
  });
  renderQuickOptionGroup(neckQuickOptionsContainer, "neck", nOpts, appState.selectedNeckFindings, () => {
    updateReportPreview();
  });
}

/**
 * Render a single quick option group into a container
 */
function renderQuickOptionGroup(container, groupKey, options, selectedList, onChangeCallback) {
  if (!container) return;
  container.innerHTML = "";
  if (!options || options.length === 0) {
    container.innerHTML = `<span style="color: #94a3b8; font-size: 0.75rem;">No options defined. Click "+ Add Option" above to create one.</span>`;
    return;
  }

  options.forEach((opt, index) => {
    const optText = (opt.text || "").trim();
    const isChecked = selectedList.includes(optText);

    const chip = document.createElement("label");
    chip.className = `quick-option-chip ${isChecked ? 'checked' : ''}`;
    chip.title = `${opt.text}\n(Right-click to Edit or Remove)`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isChecked;

    const labelSpan = document.createElement("span");
    labelSpan.textContent = opt.label;

    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        if (!selectedList.includes(optText)) {
          selectedList.push(optText);
        }
      } else {
        const idx = selectedList.indexOf(optText);
        if (idx > -1) {
          selectedList.splice(idx, 1);
        }
      }
      chip.classList.toggle("checked", checkbox.checked);
      if (onChangeCallback) onChangeCallback();
    });

    // Right-click contextmenu event
    chip.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showChipContextMenu(e.clientX, e.clientY, groupKey, index, opt);
    });

    chip.appendChild(checkbox);
    chip.appendChild(labelSpan);
    container.appendChild(chip);
  });
}

/**
 * Show Right-Click Context Menu at mouse coordinates
 */
function showChipContextMenu(x, y, groupKey, index, opt) {
  activeContextMenuContext = { groupKey, index, opt };
  if (!chipContextMenu) return;

  chipContextMenu.style.display = "block";

  const menuWidth = 140;
  const menuHeight = 70;
  const winWidth = window.innerWidth || 1200;
  const winHeight = window.innerHeight || 800;

  let left = x;
  let top = y;
  if (left + menuWidth > winWidth) left = Math.max(0, winWidth - menuWidth - 8);
  if (top + menuHeight > winHeight) top = Math.max(0, winHeight - menuHeight - 8);

  chipContextMenu.style.left = `${left}px`;
  chipContextMenu.style.top = `${top}px`;
}

/**
 * Hide Right-Click Context Menu
 */
function hideChipContextMenu() {
  if (chipContextMenu) {
    chipContextMenu.style.display = "none";
  }
}

/**
 * Open Option Edit / Add Modal
 */
function openOptionModal(mode, groupKey, index = -1, opt = null) {
  activeOptionModalState = { mode, groupKey, index, opt };
  const groupLabel = groupKey === "parenchyma" ? "Thyroid" : "Neck";

  if (!optionModal) return;

  if (mode === "edit" && opt) {
    optionModalTitle.textContent = `Edit Option (${groupLabel})`;
    inputOptionLabel.value = opt.label || "";
    inputOptionText.value = opt.text || "";
    if (inputOptionImpression) inputOptionImpression.value = opt.impressionText || "";
  } else {
    optionModalTitle.textContent = `Add Option (${groupLabel})`;
    inputOptionLabel.value = "";
    inputOptionText.value = "";
    if (inputOptionImpression) inputOptionImpression.value = "";
  }

  optionModal.classList.add("active");
  if (inputOptionLabel) inputOptionLabel.focus();
}

/**
 * Close Option Modal
 */
function closeOptionModal() {
  if (optionModal) {
    optionModal.classList.remove("active");
  }
  activeOptionModalState = null;
}

/**
 * Save Option Modal Changes (Add or Edit)
 */
function saveOptionModal() {
  if (!activeOptionModalState) return;
  const { mode, groupKey, index, opt } = activeOptionModalState;
  const label = inputOptionLabel ? inputOptionLabel.value.trim() : "";
  const text = inputOptionText ? inputOptionText.value.trim() : "";
  const impressionText = inputOptionImpression ? inputOptionImpression.value.trim() : "";

  if (!label) {
    showToast("Please enter an option label", "error");
    if (inputOptionLabel) inputOptionLabel.focus();
    return;
  }
  if (!text) {
    showToast("Please enter report text", "error");
    if (inputOptionText) inputOptionText.focus();
    return;
  }

  const propKey = groupKey === "parenchyma" ? "parenchymaQuickOptions" : "neckQuickOptions";
  if (!appState.template[propKey]) {
    appState.template[propKey] = [];
  }

  const selectedList = groupKey === "parenchyma" ? appState.selectedThyroidFindings : appState.selectedNeckFindings;

  if (mode === "edit") {
    const oldText = (opt && opt.text) ? opt.text.trim() : "";
    appState.template[propKey][index] = { label, text, impressionText };

    // Update selectedList if the edited option was previously checked
    if (oldText && selectedList.includes(oldText)) {
      const selIdx = selectedList.indexOf(oldText);
      selectedList[selIdx] = text;
    }
    showToast(`Option "${label}" updated!`, "success");
  } else {
    // Add mode
    appState.template[propKey].push({ label, text, impressionText });
    showToast(`Option "${label}" added!`, "success");
  }

  // Persist template changes
  localStorage.setItem("tirads_user_template", JSON.stringify(appState.template));

  renderQuickOptions();
  updateReportPreview();
  closeOptionModal();
}

/**
 * Remove an Option from the template and selected list
 */
function removeOption(groupKey, index, opt) {
  const propKey = groupKey === "parenchyma" ? "parenchymaQuickOptions" : "neckQuickOptions";
  if (!appState.template[propKey]) return;

  const optText = (opt && opt.text) ? opt.text.trim() : "";
  const selectedList = groupKey === "parenchyma" ? appState.selectedThyroidFindings : appState.selectedNeckFindings;

  // Remove from template options
  appState.template[propKey].splice(index, 1);

  // If selected, remove from selected findings
  if (optText) {
    const selIdx = selectedList.indexOf(optText);
    if (selIdx > -1) {
      selectedList.splice(selIdx, 1);
    }
  }

  // Persist template changes
  localStorage.setItem("tirads_user_template", JSON.stringify(appState.template));

  renderQuickOptions();
  updateReportPreview();
  showToast(`Option "${opt.label}" removed`, "info");
}



/**
 * Toast Notification Helper
 */
function showToast(message, type = "success") {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  setTimeout(() => {
    toastEl.className = "toast";
  }, 2500);
}

/**
 * Reset active form input back to 0 points and clear editing state
 */
function resetActiveInput() {
  appState.activeInput = {
    location: "",
    size: "",
    imgNo: "",
    features: {
      composition: "cystic",
      echogenicity: "anechoic",
      shape: "wider",
      margin: "smooth",
      echogenicFoci: ["none"]
    }
  };
  appState.editingNoduleId = null;
}

/**
 * Load an existing nodule into the active input form for modification
 */
function loadNoduleForEdit(noduleId) {
  const nodule = appState.nodules.find(n => n.id === noduleId);
  if (!nodule) return;

  appState.editingNoduleId = nodule.id;
  appState.highlightedNoduleId = nodule.id;
  appState.activeInput = {
    location: nodule.location,
    size: nodule.size,
    imgNo: nodule.imgNo,
    features: JSON.parse(JSON.stringify(nodule.features))
  };

  renderNoduleInput();
  renderNoduleTable();
  // Focus location input for convenient editing
  setTimeout(() => {
    const locInput = document.getElementById("inputLocation");
    if (locInput) locInput.focus();
  }, 50);
}

/**
 * Parse nodule size input: supports single dimension (e.g. 1.6) or 3 dimensions (e.g. 1.2x1.5x2.2 or 1.2*1.5*2.2).
 * Returns { displaySize: string, maxDimension: number | null }
 */
function parseNoduleSize(input) {
  if (input === null || input === undefined || input === "") {
    return { displaySize: "", maxDimension: null };
  }

  const str = String(input).trim();
  if (!str) {
    return { displaySize: "", maxDimension: null };
  }

  // Extract all numeric numbers separated by x, X, *, or spaces
  const parts = str.split(/[xX*×\s]+/).filter(p => p.length > 0);
  const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));

  if (numbers.length > 0) {
    const maxVal = Math.max(...numbers);
    return { displaySize: str, maxDimension: maxVal };
  }

  return { displaySize: str, maxDimension: null };
}

/**
 * Save / Update nodule from active input form
 */
function saveActiveNodule() {
  const locInput = document.getElementById("inputLocation");
  const sizeInput = document.getElementById("inputSize");
  const imgInput = document.getElementById("inputImage");

  const location = locInput ? locInput.value.trim() : appState.activeInput.location;
  const rawSize = sizeInput ? sizeInput.value.trim() : String(appState.activeInput.size || "").trim();
  const imgNo = imgInput ? imgInput.value.trim() : appState.activeInput.imgNo;
  const features = JSON.parse(JSON.stringify(appState.activeInput.features));

  if (appState.editingNoduleId !== null) {
    // Update existing nodule
    const existing = appState.nodules.find(n => n.id === appState.editingNoduleId);
    if (existing) {
      existing.location = location;
      existing.size = rawSize;
      existing.imgNo = imgNo;
      existing.features = features;
      const index = appState.nodules.indexOf(existing) + 1;
      showToast(`Updated Nodule #${index}`, "success");
    }
    appState.highlightedNoduleId = appState.editingNoduleId;
    resetActiveInput();
  } else {
    // Add new nodule
    const newNodule = {
      id: noduleIdCounter++,
      selected: true,
      location,
      size: rawSize,
      imgNo,
      features,
      customRecommendation: ""
    };
    appState.nodules.push(newNodule);
    appState.highlightedNoduleId = newNodule.id;
    resetActiveInput();
    showToast(`Added Nodule #${appState.nodules.length} to list`, "info");
  }

  // Re-apply active sort if any
  if (appState.sortState) {
    reapplyCurrentSort();
  }

  renderNoduleInput();
  renderNoduleTable();
  updateReportPreview();
}

/**
 * Calculate Score for a nodule (or active input)
 */
function calculateNoduleScore(nodule) {
  let points = 0;

  // Composition
  const compOpt = TIRADS_CRITERIA.composition.options.find(o => o.id === nodule.features.composition);
  const compPts = compOpt ? compOpt.score : 0;
  const compText = compOpt ? compOpt.text : "cystic";
  points += compPts;

  // Echogenicity
  const echoOpt = TIRADS_CRITERIA.echogenicity.options.find(o => o.id === nodule.features.echogenicity);
  const echoPts = echoOpt ? echoOpt.score : 0;
  const echoText = echoOpt ? echoOpt.text : "anechoic";
  points += echoPts;

  // Shape
  const shapeOpt = TIRADS_CRITERIA.shape.options.find(o => o.id === nodule.features.shape);
  const shapePts = shapeOpt ? shapeOpt.score : 0;
  const shapeText = shapeOpt ? shapeOpt.text : "wider than tall";
  points += shapePts;

  // Margin
  const marginOpt = TIRADS_CRITERIA.margin.options.find(o => o.id === nodule.features.margin);
  const marginPts = marginOpt ? marginOpt.score : 0;
  const marginText = marginOpt ? marginOpt.text : "smooth";
  points += marginPts;

  // Echogenic Foci (Multiple Selection)
  let fociPts = 0;
  let fociTexts = [];
  const selectedFoci = nodule.features.echogenicFoci || ["none"];

  selectedFoci.forEach(fociId => {
    const fOpt = TIRADS_CRITERIA.echogenicFoci.options.find(o => o.id === fociId);
    if (fOpt) {
      fociPts += fOpt.score;
      fociTexts.push(fOpt.text);
    }
  });

  if (fociTexts.length === 0) {
    fociTexts = ["none"];
  }
  points += fociPts;

  // Size evaluation: uses maxDimension if three dimensions (or single dimension) are supplied
  const sizeParsed = parseNoduleSize(nodule.size);
  const numSize = sizeParsed.maxDimension;
  const tiradsEval = calculateTIRADS(points, numSize);
  const finalRecommendation = nodule.customRecommendation ? nodule.customRecommendation : tiradsEval.recommendation;

  return {
    ...tiradsEval,
    totalPoints: points,
    compPts,
    compText,
    echoPts,
    echoText,
    shapePts,
    shapeText,
    marginPts,
    marginText,
    fociPts,
    fociText: fociTexts.join(", "),
    recommendation: finalRecommendation,
    parsedSize: sizeParsed
  };
}

/**
 * Check if a nodule recommendation suggests biopsy / FNA
 */
function isBiopsyRecommended(score) {
  if (!score || !score.recommendation) return false;
  const rec = score.recommendation.toLowerCase();
  if (rec.includes("no fna") || rec.includes("no biopsy")) return false;
  return rec.includes("fna") || rec.includes("biopsy");
}

/**
 * Extract numerical TI-RADS level (e.g. "TR5" -> 5, "TR4" -> 4)
 */
function getTRLevelNumber(levelStr) {
  const match = String(levelStr || "").match(/TR(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Sort nodules for Impression section according to:
 * 1. Needs biopsy lesion first (Suggest FNA / Biopsy)
 * 2. TI-RADS category descending (TR5 > TR4 > TR3 > TR2 > TR1)
 * 3. Size (max dimension) descending
 * 4. Original input order as tie-breaker
 */
function sortNodulesForImpression(nodules) {
  return [...nodules]
    .map((nodule, index) => ({
      nodule,
      score: calculateNoduleScore(nodule),
      originalIndex: index
    }))
    .sort((a, b) => {
      const aBiopsy = isBiopsyRecommended(a.score);
      const bBiopsy = isBiopsyRecommended(b.score);

      // 1. Needs biopsy lesion first
      if (aBiopsy !== bBiopsy) {
        return aBiopsy ? -1 : 1;
      }

      // 2. TI-RADS Level descending (TR5 > TR4 > TR3...)
      const aLevel = getTRLevelNumber(a.score.level);
      const bLevel = getTRLevelNumber(b.score.level);
      if (aLevel !== bLevel) {
        return bLevel - aLevel;
      }

      // 3. Size descending (e.g. 2.5cm > 1.5cm)
      const aSize = a.score.parsedSize.maxDimension || 0;
      const bSize = b.score.parsedSize.maxDimension || 0;
      if (aSize !== bSize) {
        return bSize - aSize;
      }

      // 4. Stable tie-breaker
      return a.originalIndex - b.originalIndex;
    });
}

/**
 * Parse image number (extract first integer from string)
 */
function parseImageNumber(imgStr) {
  if (imgStr === null || imgStr === undefined || imgStr === "") return null;
  const match = String(imgStr).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Get recommendation rank: 1: FNA/Biopsy -> 2: Follow-up -> 3: Nil/No FNA
 */
function getRecRank(score) {
  if (isBiopsyRecommended(score)) {
    return 1;
  }
  const rec = (score.recommendation || "").toLowerCase();
  if (rec.includes("follow-up") || rec.includes("follow up")) {
    return 2;
  }
  return 3;
}

/**
 * Sort nodules in Nodule List by Image (ascending: small to large)
 */
function sortNodulesByImage() {
  appState.nodules.sort((a, b) => {
    const numA = parseImageNumber(a.imgNo);
    const numB = parseImageNumber(b.imgNo);

    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB;
    } else if (numA !== null && numB === null) {
      return -1;
    } else if (numA === null && numB !== null) {
      return 1;
    } else {
      const strA = String(a.imgNo || "").trim();
      const strB = String(b.imgNo || "").trim();
      if (strA || strB) {
        const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
        if (cmp !== 0) return cmp;
      }
    }
    return a.id - b.id;
  });
}

/**
 * Sort nodules in Nodule List by Level (descending: TR5 > TR4 > TR3 > TR2 > TR1)
 */
function sortNodulesByLevel() {
  appState.nodules.sort((a, b) => {
    const scoreA = calculateNoduleScore(a);
    const scoreB = calculateNoduleScore(b);
    const levelA = getTRLevelNumber(scoreA.level);
    const levelB = getTRLevelNumber(scoreB.level);

    if (levelA !== levelB) {
      return levelB - levelA;
    }
    if (scoreA.totalPoints !== scoreB.totalPoints) {
      return scoreB.totalPoints - scoreA.totalPoints;
    }
    const sizeA = scoreA.parsedSize.maxDimension || 0;
    const sizeB = scoreB.parsedSize.maxDimension || 0;
    if (sizeA !== sizeB) {
      return sizeB - sizeA;
    }
    return a.id - b.id;
  });
}

/**
 * Sort nodules in Nodule List by Rec (FNA -> follow up -> nil)
 */
function sortNodulesByRec() {
  appState.nodules.sort((a, b) => {
    const scoreA = calculateNoduleScore(a);
    const scoreB = calculateNoduleScore(b);
    const rankA = getRecRank(scoreA);
    const rankB = getRecRank(scoreB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const levelA = getTRLevelNumber(scoreA.level);
    const levelB = getTRLevelNumber(scoreB.level);
    if (levelA !== levelB) {
      return levelB - levelA;
    }
    const sizeA = scoreA.parsedSize.maxDimension || 0;
    const sizeB = scoreB.parsedSize.maxDimension || 0;
    if (sizeA !== sizeB) {
      return sizeB - sizeA;
    }
    return a.id - b.id;
  });
}

/**
 * Reset nodules back to original creation order (by nodule.id)
 */
function resetNoduleOrder(silent = false) {
  appState.sortState = null;
  appState.nodules.sort((a, b) => a.id - b.id);
  updateSortHeaderUI();
  renderNoduleTable();
  updateReportPreview();
  if (!silent) {
    showToast("已恢復原本新增順序", "info");
  }
}

/**
 * Apply or toggle column sort
 */
function applyColumnSort(type) {
  if (appState.sortState === type) {
    // Click again to cycle back to original order
    resetNoduleOrder();
    return;
  }

  appState.sortState = type;
  if (type === "image") {
    sortNodulesByImage();
    showToast("已依 Image 由小到大排序", "info");
  } else if (type === "level") {
    sortNodulesByLevel();
    showToast("已依 Level 由高到低排序", "info");
  } else if (type === "rec") {
    sortNodulesByRec();
    showToast("已依 Rec (FNA → Follow-up → Nil) 排序", "info");
  }

  updateSortHeaderUI();
  renderNoduleTable();
  updateReportPreview();
}

/**
 * Re-apply current sort if active
 */
function reapplyCurrentSort() {
  if (appState.sortState === "image") {
    sortNodulesByImage();
  } else if (appState.sortState === "level") {
    sortNodulesByLevel();
  } else if (appState.sortState === "rec") {
    sortNodulesByRec();
  }
}

/**
 * Update table header active state and sort arrow icons
 */
function updateSortHeaderUI() {
  const btnReset = document.getElementById("btnResetNoduleOrder");
  const thOrder = document.getElementById("thOrderIndex");
  const thImg = document.getElementById("thSortImage");
  const thLvl = document.getElementById("thSortLevel");
  const thR = document.getElementById("thSortRec");

  const iconIndex = document.getElementById("sortIconIndex");
  const iconImg = document.getElementById("sortIconImage");
  const iconLvl = document.getElementById("sortIconLevel");
  const iconRec = document.getElementById("sortIconRec");

  [thOrder, thImg, thLvl, thR].forEach(th => th && th.classList.remove("active-sort"));
  if (iconIndex) iconIndex.textContent = "";
  if (iconImg) iconImg.textContent = "";
  if (iconLvl) iconLvl.textContent = "";
  if (iconRec) iconRec.textContent = "";

  if (appState.sortState === "image") {
    if (thImg) thImg.classList.add("active-sort");
    if (iconImg) iconImg.textContent = "▲";
    if (btnReset) btnReset.style.display = "inline-flex";
  } else if (appState.sortState === "level") {
    if (thLvl) thLvl.classList.add("active-sort");
    if (iconLvl) iconLvl.textContent = "▼";
    if (btnReset) btnReset.style.display = "inline-flex";
  } else if (appState.sortState === "rec") {
    if (thR) thR.classList.add("active-sort");
    if (iconRec) iconRec.textContent = "▼";
    if (btnReset) btnReset.style.display = "inline-flex";
  } else {
    if (btnReset) btnReset.style.display = "none";
  }
}



/**
 * Render the top 6-box Nodule Input form
 */
function renderNoduleInput() {
  const input = appState.activeInput;
  const scoreResult = calculateNoduleScore(input);
  const isEditing = appState.editingNoduleId !== null;
  const editIndex = isEditing ? appState.nodules.findIndex(n => n.id === appState.editingNoduleId) + 1 : null;

  noduleInputContainer.innerHTML = `
    <!-- Row 1, Col 1: Composition -->
    ${renderRadioBox(input, "composition", "Composition", scoreResult.compPts)}

    <!-- Row 1, Col 2: Echogenicity -->
    ${renderRadioBox(input, "echogenicity", "Echogenicity", scoreResult.echoPts)}

    <!-- Row 1, Col 3: Echogenic Foci (Checkbox) -->
    ${renderCheckboxBox(input, "Echogenic Foci", scoreResult.fociPts)}

    <!-- Row 2, Col 1: Shape -->
    ${renderRadioBox(input, "shape", "Shape", scoreResult.shapePts)}

    <!-- Row 2, Col 2: Margin -->
    ${renderRadioBox(input, "margin", "Margin", scoreResult.marginPts)}

    <!-- Row 2, Col 3: Nodule Information -->
    <div class="tirads-box">
      <div class="tirads-box-title">
        <span>${isEditing ? `Edit Nodule #${editIndex}` : "Nodule Information"}</span>
        ${isEditing ? `<span style="font-size: 0.72rem; color: #d97706; background: #fef3c7; padding: 0.1rem 0.4rem; border-radius: 3px;">Editing</span>` : ""}
      </div>
      <div class="nodule-info-form">
        <div class="nodule-info-row">
          <label>Location:</label>
          <input type="text" id="inputLocation" value="${input.location || ''}">
        </div>
        <div class="nodule-info-row">
          <label>Size (cm):</label>
          <input type="text" id="inputSize" value="${input.size || ''}" placeholder="e.g. 1.6 or 1.2x1.5x2.2">
        </div>
        <div class="nodule-info-row">
          <label>Image:</label>
          <input type="text" id="inputImage" value="${input.imgNo || ''}">
        </div>
        <div class="nodule-btn-row">
          <button type="button" class="btn-form-action btn-add" id="btnAddToList">
            ${isEditing ? "Update Nodule (Enter)" : "Add to List (Enter)"}
          </button>
          <button type="button" class="btn-form-action" id="btnClearForm">
            ${isEditing ? "Cancel Edit" : "Clear Form"}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Radio Button Group Box in Input Form
 */
function renderRadioBox(dataObj, featureKey, title, currentPts) {
  const criteria = TIRADS_CRITERIA[featureKey];
  const selectedValue = dataObj.features[featureKey];

  const items = criteria.options.map(opt => {
    const isChecked = selectedValue === opt.id;
    return `
      <label class="tirads-label">
        <input type="radio" name="input_${featureKey}" value="${opt.id}" 
               data-feature="${featureKey}" ${isChecked ? 'checked' : ''}>
        <span>${opt.label}</span>
      </label>
    `;
  }).join("");

  return `
    <div class="tirads-box">
      <div class="tirads-box-title">
        <span>${title}</span>
        <span class="pts-tag">${currentPts} pts</span>
      </div>
      <div class="tirads-options-list">
        ${items}
      </div>
    </div>
  `;
}

/**
 * Render Checkbox Group Box in Input Form
 */
function renderCheckboxBox(dataObj, title, currentPts) {
  const criteria = TIRADS_CRITERIA.echogenicFoci;
  const selectedValues = dataObj.features.echogenicFoci || ["none"];

  const items = criteria.options.map(opt => {
    const isChecked = selectedValues.includes(opt.id);
    return `
      <label class="tirads-label">
        <input type="checkbox" name="input_foci" value="${opt.id}" 
               data-feature="echogenicFoci" ${isChecked ? 'checked' : ''}>
        <span>${opt.label}</span>
      </label>
    `;
  }).join("");

  return `
    <div class="tirads-box">
      <div class="tirads-box-title">
        <span>${title}</span>
        <span class="pts-tag">${currentPts} pts</span>
      </div>
      <div class="tirads-options-list">
        ${items}
      </div>
    </div>
  `;
}

/**
 * Render Nodule List Table (Select nodules to include in report)
 */
function renderNoduleTable() {
  noduleTableBody.innerHTML = "";

  if (appState.nodules.length === 0) {
    noduleTableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 1.5rem; color: #94a3b8;">
          No nodules added yet. Fill in Nodule Input above and press Enter (or click "Add to List").
        </td>
      </tr>
    `;
    return;
  }

  appState.nodules.forEach((nodule, index) => {
    const scoreResult = calculateNoduleScore(nodule);
    const tr = document.createElement("tr");
    tr.dataset.id = nodule.id;
    tr.tabIndex = 0; // Focusable for Del key navigation

    if (nodule.id === appState.editingNoduleId) {
      tr.classList.add("editing");
    } else if (nodule.selected) {
      tr.classList.add("selected");
    }

    tr.innerHTML = `
      <td style="text-align: center; font-weight: 600;">${index + 1}</td>
      <td style="text-align: center;">
        <input type="checkbox" class="nodule-select-check" data-id="${nodule.id}" ${nodule.selected ? "checked" : ""}>
      </td>
      <td><strong>${nodule.location || "unspecified location"}</strong></td>
      <td>${nodule.size !== "" ? nodule.size : "-"}</td>
      <td>${nodule.imgNo || "-"}</td>
      <td style="text-align: center; font-weight: 700;">${scoreResult.totalPoints}</td>
      <td style="text-align: center;">
        <span class="table-badge" style="background-color: ${scoreResult.badgeColor}">${scoreResult.level}</span>
      </td>
      <td style="color: #475569; font-size: 0.78rem;">${scoreResult.recommendation}</td>
      <td style="text-align: center;">
        <button type="button" class="btn-delete-row" data-id="${nodule.id}" title="Delete nodule (Del)">Delete</button>
      </td>
    `;

    noduleTableBody.appendChild(tr);
  });
}

/**
 * Generate Structured Report based on template
 * (ONLY includes nodules that have selected === true)
 */
function generateStructuredReport() {
  const tpl = appState.template;
  let reportLines = [];

  // Filter only checked/selected nodules
  const selectedNodules = appState.nodules.filter(n => n.selected);

  // 1. Exam Title (from template)
  const examTitle = (tpl.examTitle !== undefined ? tpl.examTitle : DEFAULT_TEMPLATE.examTitle) || "";
  if (examTitle.trim()) {
    reportLines.push(examTitle.trim());
    reportLines.push("");
  }

  // 2. Thyroid Section
  reportLines.push(tpl.thyroidSectionHeader);

  // Thyroid Findings (from selected checkboxes)
  if (appState.selectedThyroidFindings && appState.selectedThyroidFindings.length > 0) {
    appState.selectedThyroidFindings.forEach(text => {
      const trimmed = text.trim();
      if (trimmed) {
        reportLines.push("  " + trimmed);
      }
    });
  }

  // 3. Format Nodules
  if (selectedNodules.length > 0) {
    const leadIn = (tpl.parenchymaLeadIn !== undefined ? tpl.parenchymaLeadIn : DEFAULT_TEMPLATE.parenchymaLeadIn) || "";
    if (leadIn.trim()) {
      reportLines.push("  " + leadIn.trim());
    }

    selectedNodules.forEach(nodule => {
      const score = calculateNoduleScore(nodule);

      // If recommendation is 'No FNA recommended by size criteria.' or 'No FNA needed.', do not print it in report
      const rec = score.recommendation;
      const isNoFnaBySize = !rec || rec === "No FNA recommended by size criteria." || rec === "No FNA needed.";
      const recText = isNoFnaBySize ? "" : rec;

      // Handle trailing space before {recommendation} in template
      let noduleStr = tpl.noduleItemFormat
        .replace(/{level}/g, score.level)
        .replace(/{location}/g, nodule.location || "unspecified location")
        .replace(/{size}/g, nodule.size || "0.0")
        .replace(/{imgNo}/g, nodule.imgNo || "N/A")
        .replace(/{composition}/g, score.compText)
        .replace(/{compositionPts}/g, score.compPts)
        .replace(/{echogenicity}/g, score.echoText)
        .replace(/{echogenicityPts}/g, score.echoPts)
        .replace(/{shape}/g, score.shapeText)
        .replace(/{shapePts}/g, score.shapePts)
        .replace(/{margin}/g, score.marginText)
        .replace(/{marginPts}/g, score.marginPts)
        .replace(/{foci}/g, score.fociText)
        .replace(/{fociPts}/g, score.fociPts)
        .replace(/{totalPts}/g, score.totalPoints);

      if (recText) {
        noduleStr = noduleStr.replace(/{recommendation}/g, recText);
      } else {
        // Remove {recommendation} and any preceding whitespace
        noduleStr = noduleStr.replace(/\s*\{recommendation\}/g, "");
      }

      reportLines.push(noduleStr);
    });
  }

  reportLines.push("");

  // 4. Neck Section
  reportLines.push(tpl.neckSectionHeader);
  if (appState.selectedNeckFindings && appState.selectedNeckFindings.length > 0) {
    appState.selectedNeckFindings.forEach(text => {
      const trimmed = text.trim();
      if (trimmed) {
        reportLines.push("  " + trimmed);
      }
    });
  }
  reportLines.push("");

  // 5. Impression Section
  if (tpl.showImpressionSection) {
    reportLines.push(tpl.impressionHeader);

    if (selectedNodules.length > 0) {
      const sortedImpressionNodules = sortNodulesForImpression(selectedNodules);
      sortedImpressionNodules.forEach(({ nodule, score }) => {
        const rec = score.recommendation;
        const isNoFnaBySize = !rec || rec === "No FNA recommended by size criteria." || rec === "No FNA needed.";

        let impStr = tpl.impressionItemFormat
          .replace(/{level}/g, score.level)
          .replace(/{location}/g, nodule.location || "unspecified location")
          .replace(/{size}/g, nodule.size || "0.0")
          .replace(/{imgNo}/g, nodule.imgNo || "N/A");

        if (!isNoFnaBySize) {
          impStr = impStr.replace(/{recommendation}/g, rec);
        } else {
          // Omit the second line (e.g. "    >> {recommendation}")
          impStr = impStr.replace(/\n\s*>>\s*\{recommendation\}/g, "");
          impStr = impStr.replace(/\s*\{recommendation\}/g, "");
        }

        reportLines.push(impStr);
      });
    }

    // Findings' Impression (from selected Thyroid & Neck options)
    const pOpts = appState.template.parenchymaQuickOptions || DEFAULT_TEMPLATE.parenchymaQuickOptions || [];
    if (appState.selectedThyroidFindings && appState.selectedThyroidFindings.length > 0) {
      appState.selectedThyroidFindings.forEach(text => {
        const matched = pOpts.find(o => (o.text || "").trim() === text.trim());
        if (matched && matched.impressionText && matched.impressionText.trim()) {
          const lines = matched.impressionText.trim().split("\n");
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
              reportLines.push("  " + trimmed);
            }
          });
        }
      });
    }

    const nOpts = appState.template.neckQuickOptions || DEFAULT_TEMPLATE.neckQuickOptions || [];
    if (appState.selectedNeckFindings && appState.selectedNeckFindings.length > 0) {
      appState.selectedNeckFindings.forEach(text => {
        const matched = nOpts.find(o => (o.text || "").trim() === text.trim());
        if (matched && matched.impressionText && matched.impressionText.trim()) {
          const lines = matched.impressionText.trim().split("\n");
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
              reportLines.push("  " + trimmed);
            }
          });
        }
      });
    }
  }

  return reportLines.join("\n");
}

/**
 * Word-wrap text so that lines do not exceed maxChars (default 81 characters),
 * preserving explicit indentation on subsequent continuation lines.
 */
function wrapReportText(text, maxChars = 81) {
  const lines = text.split("\n");
  const wrappedLines = [];

  for (const line of lines) {
    if (line.length <= maxChars) {
      wrappedLines.push(line);
      continue;
    }

    // Determine leading indentation of this line
    const indentMatch = line.match(/^\s*/);
    const leadingIndent = indentMatch ? indentMatch[0] : "";
    // Continuation line indent: preserve original indent plus 2 spaces if indented
    const continuationIndent = leadingIndent ? leadingIndent + "  " : "  ";

    const words = line.trimStart().split(/\s+/);
    let currentLine = leadingIndent;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (currentLine === leadingIndent) {
        currentLine += word;
      } else if ((currentLine + " " + word).length <= maxChars) {
        currentLine += " " + word;
      } else {
        wrappedLines.push(currentLine);
        currentLine = continuationIndent + word;
      }
    }

    if (currentLine.length > 0) {
      wrappedLines.push(currentLine);
    }
  }

  return wrappedLines.join("\n");
}

/**
 * Update Preview Box with 81-character line wrapping
 */
function updateReportPreview() {
  const fullReport = generateStructuredReport();
  const formattedReport = wrapReportText(fullReport, 81);
  reportPreviewBox.textContent = formattedReport;
}

// ==========================================
// Event Listeners
// ==========================================


// Nodule Input Container Delegated Events (Radio, Checkbox, Text Inputs, Buttons)
noduleInputContainer.addEventListener("change", (e) => {
  const target = e.target;

  // Radio button feature change
  if (target.type === "radio") {
    const feature = target.dataset.feature;
    appState.activeInput.features[feature] = target.value;
    renderNoduleInput();
  }

  // Checkbox feature: Echogenic Foci
  if (target.type === "checkbox") {
    const value = target.value;
    let fociList = appState.activeInput.features.echogenicFoci || [];

    if (value === "none") {
      fociList = ["none"];
    } else {
      fociList = fociList.filter(f => f !== "none");
      if (target.checked) {
        if (!fociList.includes(value)) fociList.push(value);
      } else {
        fociList = fociList.filter(f => f !== value);
      }
      if (fociList.length === 0) fociList = ["none"];
    }

    appState.activeInput.features.echogenicFoci = fociList;
    renderNoduleInput();
  }
});

noduleInputContainer.addEventListener("input", (e) => {
  const target = e.target;
  if (target.id === "inputLocation") {
    appState.activeInput.location = target.value;
  } else if (target.id === "inputSize") {
    appState.activeInput.size = target.value;
  } else if (target.id === "inputImage") {
    appState.activeInput.imgNo = target.value;
  }
});

noduleInputContainer.addEventListener("click", (e) => {
  const target = e.target;

  // Add / Update Button
  if (target.id === "btnAddToList") {
    saveActiveNodule();
  }

  // Clear Form / Cancel Edit Button
  if (target.id === "btnClearForm") {
    const wasEditing = appState.editingNoduleId !== null;
    resetActiveInput();
    appState.highlightedNoduleId = null;
    renderNoduleInput();
    renderNoduleTable();
    showToast(wasEditing ? "Edit canceled" : "Form cleared to defaults (0 pts)", "info");
  }
});

// Nodule Table Delegated Events (Row click to edit, Checkbox toggle, Delete button)
noduleTableBody.addEventListener("change", (e) => {
  const target = e.target;
  if (target.classList.contains("nodule-select-check")) {
    const id = parseInt(target.dataset.id, 10);
    const nodule = appState.nodules.find(n => n.id === id);
    if (nodule) {
      nodule.selected = target.checked;
      renderNoduleTable();
      updateReportPreview();
    }
  }
});

noduleTableBody.addEventListener("click", (e) => {
  const target = e.target;

  // Delete button click
  if (target.classList.contains("btn-delete-row")) {
    e.stopPropagation();
    const id = parseInt(target.dataset.id, 10);
    deleteNoduleById(id);
    return;
  }

  // Ignore clicking directly on checkbox
  if (target.classList.contains("nodule-select-check")) {
    return;
  }

  // Click row to edit
  const row = target.closest("tr");
  if (row && row.dataset.id) {
    const id = parseInt(row.dataset.id, 10);
    loadNoduleForEdit(id);
  }
});

/**
 * Delete a nodule by its ID
 */
function deleteNoduleById(id) {
  const nodule = appState.nodules.find(n => n.id === id);
  if (!nodule) return;

  if (confirm("Are you sure you want to delete this nodule?")) {
    appState.nodules = appState.nodules.filter(n => n.id !== id);
    if (appState.editingNoduleId === id) {
      resetActiveInput();
      renderNoduleInput();
    }
    if (appState.highlightedNoduleId === id) {
      appState.highlightedNoduleId = null;
    }
    renderNoduleTable();
    updateReportPreview();
    showToast("Nodule deleted", "info");
  }
}

// Reset Nodule Order Button
if (btnResetNoduleOrder) {
  btnResetNoduleOrder.addEventListener("click", () => {
    resetNoduleOrder();
  });
}

// Table Header Sorting Event Listeners
if (thOrderIndex) {
  thOrderIndex.addEventListener("click", () => {
    resetNoduleOrder();
  });
}

if (thSortImage) {
  thSortImage.addEventListener("click", () => {
    applyColumnSort("image");
  });
}

if (thSortLevel) {
  thSortLevel.addEventListener("click", () => {
    applyColumnSort("level");
  });
}

if (thSortRec) {
  thSortRec.addEventListener("click", () => {
    applyColumnSort("rec");
  });
}

// Clear All Nodules Button
btnClearAllNodules.addEventListener("click", () => {
  if (appState.nodules.length === 0) return;
  if (confirm("Are you sure you want to clear all nodules?")) {
    appState.nodules = [];
    appState.sortState = null;
    updateSortHeaderUI();
    resetActiveInput();
    appState.highlightedNoduleId = null;
    renderNoduleInput();
    renderNoduleTable();
    updateReportPreview();
    showToast("All nodules cleared", "info");
  }
});

// Keyboard Shortcuts: Enter (Add/Update to list) & Del (Delete selected nodule)
document.addEventListener("keydown", (e) => {
  // Ignore shortcuts when modal or textareas are focused
  if (templateModal.classList.contains("active")) return;
  const activeEl = document.activeElement;
  const isTextarea = activeEl && activeEl.tagName === "TEXTAREA";

  // 1. Enter key: Add or update nodule to list
  if (e.key === "Enter" && !isTextarea) {
    // If inside nodule input form inputs or focused anywhere in document
    const isInsideInput = activeEl && (
      activeEl.id === "inputLocation" ||
      activeEl.id === "inputSize" ||
      activeEl.id === "inputImage" ||
      activeEl.closest("#noduleInputContainer")
    );

    if (isInsideInput) {
      e.preventDefault();
      saveActiveNodule();
    }
  }

  // 2. Delete / Del key: Delete the currently focused or editing nodule
  if (e.key === "Delete") {
    // If user is actively typing inside an input field, let normal delete key work
    const isInputFocused = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
    if (isInputFocused) return;

    // Check if table row is focused
    const focusedRow = activeEl ? activeEl.closest("tr[data-id]") : null;
    if (focusedRow) {
      e.preventDefault();
      const id = parseInt(focusedRow.dataset.id, 10);
      deleteNoduleById(id);
      return;
    }

    // Check if editing a nodule
    if (appState.editingNoduleId !== null) {
      e.preventDefault();
      deleteNoduleById(appState.editingNoduleId);
      return;
    }

    // Check if a row was highlighted
    if (appState.highlightedNoduleId !== null) {
      e.preventDefault();
      deleteNoduleById(appState.highlightedNoduleId);
      return;
    }
  }
});

// Copy Report to Clipboard
btnCopyReport.addEventListener("click", () => {
  const text = reportPreviewBox.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Report successfully copied to clipboard!", "success");
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
});

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand("copy");
    showToast("Report successfully copied to clipboard!", "success");
  } catch (err) {
    showToast("Failed to copy, please select and copy manually", "danger");
  }
  document.body.removeChild(textArea);
}

// Reset to Default Sample
btnResetToDefault.addEventListener("click", () => {
  if (confirm("Load sample nodule data? Current nodule edits will be replaced.")) {
    initializeData(true);
    showToast("Loaded sample data", "info");
  }
});

// ==========================================
// Context Menu & Option Modal Event Listeners
// ==========================================

// Global click to close context menu
document.addEventListener("click", () => {
  hideChipContextMenu();
});

// Global contextmenu to close existing context menu when clicked elsewhere
document.addEventListener("contextmenu", (e) => {
  if (!e.target.closest || !e.target.closest(".quick-option-chip")) {
    hideChipContextMenu();
  }
});

// Context Menu: Edit Option
if (menuItemEditOption) {
  menuItemEditOption.addEventListener("click", () => {
    hideChipContextMenu();
    if (activeContextMenuContext) {
      openOptionModal("edit", activeContextMenuContext.groupKey, activeContextMenuContext.index, activeContextMenuContext.opt);
    }
  });
}

// Context Menu: Remove Option
if (menuItemRemoveOption) {
  menuItemRemoveOption.addEventListener("click", () => {
    hideChipContextMenu();
    if (activeContextMenuContext) {
      const { groupKey, index, opt } = activeContextMenuContext;
      if (confirm(`Remove option "${opt.label}"?`)) {
        removeOption(groupKey, index, opt);
      }
    }
  });
}

// Add Option Buttons
if (btnAddThyroidOption) {
  btnAddThyroidOption.addEventListener("click", () => {
    openOptionModal("add", "parenchyma");
  });
}

if (btnAddNeckOption) {
  btnAddNeckOption.addEventListener("click", () => {
    openOptionModal("add", "neck");
  });
}

// Close & Cancel Option Modal
if (btnCloseOptionModal) {
  btnCloseOptionModal.addEventListener("click", () => {
    closeOptionModal();
  });
}

if (btnCancelOptionModal) {
  btnCancelOptionModal.addEventListener("click", () => {
    closeOptionModal();
  });
}

// Save Option Modal
if (btnSaveOptionModal) {
  btnSaveOptionModal.addEventListener("click", () => {
    saveOptionModal();
  });
}

// Enter key shortcut in Option Label input
if (inputOptionLabel) {
  inputOptionLabel.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputOptionText) inputOptionText.focus();
    }
  });
}

// Ctrl+Enter or Cmd+Enter shortcut in Option Text textarea
if (inputOptionText) {
  inputOptionText.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveOptionModal();
    }
  });
}

// Ctrl+Enter or Cmd+Enter shortcut in Option Impression textarea
if (inputOptionImpression) {
  inputOptionImpression.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveOptionModal();
    }
  });
}

// ==========================================
// Template Management (JSON Import / Export / Modal)
// ==========================================

// Open Modal
btnOpenTemplateModal.addEventListener("click", () => {
  tplName.value = appState.template.templateName || "Standard Template";
  if (tplExamTitle) tplExamTitle.value = appState.template.examTitle || DEFAULT_TEMPLATE.examTitle || "";
  tplThyroidHeader.value = appState.template.thyroidSectionHeader;
  if (tplParenchymaLeadIn) tplParenchymaLeadIn.value = appState.template.parenchymaLeadIn || DEFAULT_TEMPLATE.parenchymaLeadIn || "";
  tplNeckHeader.value = appState.template.neckSectionHeader;
  tplNoduleItemFormat.value = appState.template.noduleItemFormat;
  tplImpressionItemFormat.value = appState.template.impressionItemFormat;

  templateModal.classList.add("active");
});

// Close Modal
btnCloseTemplateModal.addEventListener("click", () => {
  templateModal.classList.remove("active");
});

// Save Modal Changes
btnSaveTemplateChanges.addEventListener("click", () => {
  appState.template.templateName = tplName.value.trim();
  if (tplExamTitle) appState.template.examTitle = tplExamTitle.value.trim();
  appState.template.thyroidSectionHeader = tplThyroidHeader.value.trim();
  if (tplParenchymaLeadIn) appState.template.parenchymaLeadIn = tplParenchymaLeadIn.value.trim();
  appState.template.neckSectionHeader = tplNeckHeader.value.trim();
  appState.template.noduleItemFormat = tplNoduleItemFormat.value;
  appState.template.impressionItemFormat = tplImpressionItemFormat.value;

  // Save to LocalStorage
  localStorage.setItem("tirads_user_template", JSON.stringify(appState.template));

  renderQuickOptions();
  templateModal.classList.remove("active");
  updateReportPreview();
  showToast("Template changes saved and applied!", "success");
});

// Restore Default Template
btnRestoreDefaultTemplate.addEventListener("click", () => {
  if (confirm("Restore to default standard template?")) {
    appState.template = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
    tplName.value = appState.template.templateName;
    if (tplExamTitle) tplExamTitle.value = DEFAULT_TEMPLATE.examTitle;
    tplThyroidHeader.value = appState.template.thyroidSectionHeader;
    if (tplParenchymaLeadIn) tplParenchymaLeadIn.value = DEFAULT_TEMPLATE.parenchymaLeadIn;
    tplNeckHeader.value = appState.template.neckSectionHeader;
    tplNoduleItemFormat.value = appState.template.noduleItemFormat;
    tplImpressionItemFormat.value = appState.template.impressionItemFormat;

    localStorage.removeItem("tirads_user_template");
    renderQuickOptions();
    updateReportPreview();
    showToast("Restored to default template", "info");
  }
});

// Export Template as JSON File
btnExportTemplate.addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.template, null, 2));
  const downloadAnchor = document.createElement("a");
  const fileName = (appState.template.templateName || "tirads_template").replace(/\s+/g, "_").toLowerCase() + ".json";
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast(`Template exported: ${fileName}`, "success");
});

// Import Template from JSON File
fileImportTemplate.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!importedData.noduleItemFormat || !importedData.thyroidSectionHeader) {
        throw new Error("Template missing required fields");
      }
      if (!importedData.parenchymaQuickOptions) {
        importedData.parenchymaQuickOptions = DEFAULT_TEMPLATE.parenchymaQuickOptions;
      }
      if (!importedData.neckQuickOptions) {
        importedData.neckQuickOptions = DEFAULT_TEMPLATE.neckQuickOptions;
      }
      appState.template = importedData;
      localStorage.setItem("tirads_user_template", JSON.stringify(importedData));
      renderQuickOptions();
      updateReportPreview();
      showToast(`Imported template: ${importedData.templateName || file.name}`, "success");
    } catch (err) {
      alert("Import failed: Invalid TI-RADS template JSON file (" + err.message + ")");
    }
    // Clear file input so the same file can be reloaded if needed
    fileImportTemplate.value = "";
  };
  reader.readAsText(file);
});

// Load LocalStorage template if available on initial start
function loadStoredTemplate() {
  const stored = localStorage.getItem("tirads_user_template");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (!parsed.parenchymaQuickOptions) {
        parsed.parenchymaQuickOptions = DEFAULT_TEMPLATE.parenchymaQuickOptions;
      } else {
        // Filter out legacy "Bilateral Nodules Lead-in" option from checkboxes
        parsed.parenchymaQuickOptions = parsed.parenchymaQuickOptions.filter(
          opt => opt.label !== "Bilateral Nodules Lead-in" && !opt.text.includes("Thyroid nodules in bilateral lobes")
        );
      }
      if (!parsed.neckQuickOptions) {
        parsed.neckQuickOptions = DEFAULT_TEMPLATE.neckQuickOptions;
      }
      appState.template = parsed;
    } catch (e) {
      console.error("Failed to parse stored template", e);
    }
  }
}

// Tab Switching Logic
function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPane = document.getElementById(targetTabId);
      if (targetPane) {
        targetPane.classList.add("active");
      }
    });
  });
}

// Header Auto-Hide / Toggle Logic
function setupHeaderToggle() {
  const appHeader = document.getElementById("appHeader");
  const btnToggleHeader = document.getElementById("btnToggleHeader");

  if (!appHeader || !btnToggleHeader) return;

  btnToggleHeader.addEventListener("click", () => {
    appHeader.classList.toggle("autohide");
    if (!appHeader.classList.contains("autohide")) {
      btnToggleHeader.textContent = "Hide Menu";
    } else {
      btnToggleHeader.textContent = "Menu";
    }
  });

  // When mouse leaves the expanded header, re-hide it if desired
  appHeader.addEventListener("mouseleave", () => {
    // If it was manually opened via toggle or hover, keep interaction smooth
    if (!appHeader.classList.contains("autohide")) {
      // keep open if user toggled
    }
  });
}

// Workspace Resizer Drag Logic
function setupWorkspaceResizer() {
  const resizer = document.getElementById("workspaceResizer");
  const paneRight = document.getElementById("paneRight");
  const STORAGE_KEY = "tirads_preview_pane_width";

  if (!resizer || !paneRight) return;

  // Restore saved width if present
  try {
    const savedWidth = localStorage.getItem(STORAGE_KEY);
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      const minW = 320;
      const maxW = Math.max(minW, window.innerWidth - 380);
      if (parsed >= minW && parsed <= maxW) {
        paneRight.style.width = `${parsed}px`;
      }
    }
  } catch (e) {
    // localStorage may be disabled or restricted
  }

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  function onMouseDown(e) {
    // Only respond to left button
    if (e.button !== 0) return;
    e.preventDefault();

    isDragging = true;
    startX = e.clientX;
    startWidth = paneRight.getBoundingClientRect().width;

    resizer.classList.add("resizing");
    document.body.classList.add("resizing-active");

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging) return;

    // Moving mouse left (dx < 0) expands right pane; moving mouse right (dx > 0) shrinks it
    const dx = e.clientX - startX;
    let newWidth = startWidth - dx;

    // Boundaries: min 320px, max window.innerWidth - 380px (leaving left pane at least 380px)
    const minWidth = 320;
    const maxWidth = Math.max(minWidth, window.innerWidth - 380);

    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    paneRight.style.width = `${newWidth}px`;
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;

    resizer.classList.remove("resizing");
    document.body.classList.remove("resizing-active");

    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);

    // Save customized width to localStorage
    try {
      const currentWidth = Math.round(paneRight.getBoundingClientRect().width);
      localStorage.setItem(STORAGE_KEY, currentWidth.toString());
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Touch support for tablets/touch devices
  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    isDragging = true;
    startX = e.touches[0].clientX;
    startWidth = paneRight.getBoundingClientRect().width;

    resizer.classList.add("resizing");
    document.body.classList.add("resizing-active");

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
  }

  function onTouchMove(e) {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();

    const dx = e.touches[0].clientX - startX;
    let newWidth = startWidth - dx;
    const minWidth = 320;
    const maxWidth = Math.max(minWidth, window.innerWidth - 380);

    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    paneRight.style.width = `${newWidth}px`;
  }

  function onTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    resizer.classList.remove("resizing");
    document.body.classList.remove("resizing-active");

    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);

    try {
      const currentWidth = Math.round(paneRight.getBoundingClientRect().width);
      localStorage.setItem(STORAGE_KEY, currentWidth.toString());
    } catch (e) {
      // Ignore storage errors
    }
  }

  resizer.addEventListener("mousedown", onMouseDown);
  resizer.addEventListener("touchstart", onTouchStart, { passive: true });
}

// App Initialization
window.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupHeaderToggle();
  setupWorkspaceResizer();
  loadStoredTemplate();
  initializeData(false); // Default nodule list is empty
});

