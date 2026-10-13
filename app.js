/**
 * TI-RADS Structured Ultrasound Reporting System
 * Application Logic & State Management
 */

// Application State
let appState = {
  template: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)),
  examTitle: DEFAULT_TEMPLATE.examTitle,
  parenchymaLeadIn: DEFAULT_TEMPLATE.parenchymaLeadIn,
  neckText: DEFAULT_TEMPLATE.neckDefaultText,
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
  // List of saved nodules
  nodules: []
};

// Unique nodule id counter
let noduleIdCounter = 1;

// DOM Elements
const noduleInputContainer = document.getElementById("noduleInputContainer");
const noduleTableBody = document.getElementById("noduleTableBody");
const btnClearAllNodules = document.getElementById("btnClearAllNodules");
const reportPreviewBox = document.getElementById("reportPreviewBox");
const inputExamTitle = document.getElementById("inputExamTitle");
const inputParenchymaLeadIn = document.getElementById("inputParenchymaLeadIn");
const inputNeckText = document.getElementById("inputNeckText");
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
const tplThyroidHeader = document.getElementById("tplThyroidHeader");
const tplNeckHeader = document.getElementById("tplNeckHeader");
const tplNoduleItemFormat = document.getElementById("tplNoduleItemFormat");
const tplImpressionItemFormat = document.getElementById("tplImpressionItemFormat");

/**
 * Initialize Application Data (Default nodule list is empty)
 */
function initializeData(loadSampleNodule = false) {
  appState.examTitle = DEFAULT_TEMPLATE.examTitle;
  appState.parenchymaLeadIn = DEFAULT_TEMPLATE.parenchymaLeadIn;
  appState.neckText = DEFAULT_TEMPLATE.neckDefaultText;
  
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

  // Update form inputs
  inputExamTitle.value = appState.examTitle;
  inputParenchymaLeadIn.value = appState.parenchymaLeadIn;
  inputNeckText.value = appState.neckText;

  renderNoduleInput();
  renderNoduleTable();
  updateReportPreview();
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

  // 1. Exam Title
  if (appState.examTitle.trim()) {
    reportLines.push(appState.examTitle.trim());
    reportLines.push("");
  }

  // 2. Thyroid Section
  reportLines.push(tpl.thyroidSectionHeader);
  if (appState.parenchymaLeadIn.trim()) {
    reportLines.push("  " + appState.parenchymaLeadIn.trim());
  }

  // 3. Format Nodules
  if (selectedNodules.length > 0) {
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
  } else {
    reportLines.push("    - No focal suspicious nodule identified.");
  }

  reportLines.push("");

  // 4. Neck Section
  reportLines.push(tpl.neckSectionHeader);
  if (appState.neckText.trim()) {
    reportLines.push("  " + appState.neckText.trim());
  }
  reportLines.push("");

  // 5. Impression Section
  if (tpl.showImpressionSection) {
    reportLines.push(tpl.impressionHeader);

    if (selectedNodules.length > 0) {
      selectedNodules.forEach(nodule => {
        const score = calculateNoduleScore(nodule);
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
    } else {
      reportLines.push("  - No definite evidence of thyroid malignancy.");
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

// Global Inputs Change
inputExamTitle.addEventListener("input", (e) => {
  appState.examTitle = e.target.value;
  updateReportPreview();
});

inputParenchymaLeadIn.addEventListener("input", (e) => {
  appState.parenchymaLeadIn = e.target.value;
  updateReportPreview();
});

inputNeckText.addEventListener("input", (e) => {
  appState.neckText = e.target.value;
  updateReportPreview();
});

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

// Clear All Nodules Button
btnClearAllNodules.addEventListener("click", () => {
  if (appState.nodules.length === 0) return;
  if (confirm("Are you sure you want to clear all nodules?")) {
    appState.nodules = [];
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
// Template Management (JSON Import / Export / Modal)
// ==========================================

// Open Modal
btnOpenTemplateModal.addEventListener("click", () => {
  tplName.value = appState.template.templateName || "Standard Template";
  tplThyroidHeader.value = appState.template.thyroidSectionHeader;
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
  appState.template.thyroidSectionHeader = tplThyroidHeader.value.trim();
  appState.template.neckSectionHeader = tplNeckHeader.value.trim();
  appState.template.noduleItemFormat = tplNoduleItemFormat.value;
  appState.template.impressionItemFormat = tplImpressionItemFormat.value;

  // Save to LocalStorage
  localStorage.setItem("tirads_user_template", JSON.stringify(appState.template));

  templateModal.classList.remove("active");
  updateReportPreview();
  showToast("Template changes saved and applied!", "success");
});

// Restore Default Template
btnRestoreDefaultTemplate.addEventListener("click", () => {
  if (confirm("Restore to default standard template?")) {
    appState.template = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
    tplName.value = appState.template.templateName;
    tplThyroidHeader.value = appState.template.thyroidSectionHeader;
    tplNeckHeader.value = appState.template.neckSectionHeader;
    tplNoduleItemFormat.value = appState.template.noduleItemFormat;
    tplImpressionItemFormat.value = appState.template.impressionItemFormat;
    localStorage.removeItem("tirads_user_template");
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
      appState.template = importedData;
      localStorage.setItem("tirads_user_template", JSON.stringify(importedData));
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
      appState.template = JSON.parse(stored);
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

