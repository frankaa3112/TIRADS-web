/**
 * ACR TI-RADS Standard Definitions & Default Report Templates
 */

const TIRADS_CRITERIA = {
  composition: {
    name: "Composition",
    type: "radio", // Choose 1
    options: [
      { id: "cystic", label: "Cystic", score: 0, text: "cystic" },
      { id: "spongiform", label: "Spongiform", score: 0, text: "spongiform" },
      { id: "mixed", label: "Mixed cystic/solid", score: 1, text: "mixed cystic/solid" },
      { id: "solid", label: "Solid", score: 2, text: "solid" }
    ]
  },
  echogenicity: {
    name: "Echogenicity",
    type: "radio", // Choose 1
    options: [
      { id: "anechoic", label: "Anechoic", score: 0, text: "anechoic" },
      { id: "hyperechoic_isoechoic", label: "Hyper- or Isoechoic", score: 1, text: "hyper- or isoechoic" },
      { id: "hypoechoic", label: "Hypoechoic", score: 2, text: "hypoechoic" },
      { id: "very_hypoechoic", label: "Very Hypoechoic", score: 3, text: "very hypoechoic" }
    ]
  },
  shape: {
    name: "Shape",
    type: "radio", // Choose 1
    options: [
      { id: "wider", label: "Wider than tall", score: 0, text: "wider than tall" },
      { id: "taller", label: "Taller than wide", score: 3, text: "taller than wide" }
    ]
  },
  margin: {
    name: "Margin",
    type: "radio", // Choose 1
    options: [
      { id: "smooth", label: "Smooth", score: 0, text: "smooth" },
      { id: "ill_defined", label: "Ill-defined", score: 0, text: "ill-defined" },
      { id: "lobulated", label: "Lobulated or Irregular", score: 2, text: "lobulated or irregular" },
      { id: "extra_thyroidal", label: "Extra-thyroidal extension", score: 3, text: "extra-thyroidal extension" }
    ]
  },
  echogenicFoci: {
    name: "Echogenic Foci",
    type: "checkbox", // Cumulative
    options: [
      { id: "none", label: "None", score: 0, text: "none" },
      { id: "comet_tail", label: "Large comet tail artifacts", score: 0, text: "large comet tail artifacts" },
      { id: "macrocalcifications", label: "Macrocalcifications", score: 1, text: "macrocalcifications" },
      { id: "rim", label: "Rim calcifications", score: 2, text: "rim calcifications" },
      { id: "punctate", label: "Punctate echogenic foci", score: 3, text: "punctate echogenic foci" }
    ]
  }
};

// Evaluate ACR TI-RADS Category and Recommendations based on points and size
function calculateTIRADS(points, sizeCm) {
  let level = "TR1";
  let categoryName = "Benign";
  let badgeColor = "#22c55e"; // green
  let fnaThreshold = Infinity;
  let followThreshold = Infinity;

  if (points === 0) {
    level = "TR1";
    categoryName = "Benign";
    badgeColor = "#10b981";
  } else if (points <= 2) {
    level = "TR2";
    categoryName = "Not Suspicious";
    badgeColor = "#06b6d4";
  } else if (points === 3) {
    level = "TR3";
    categoryName = "Mildly Suspicious";
    badgeColor = "#eab308";
    fnaThreshold = 2.5;
    followThreshold = 1.5;
  } else if (points <= 6) {
    level = "TR4";
    categoryName = "Moderately Suspicious";
    badgeColor = "#f97316";
    fnaThreshold = 1.5;
    followThreshold = 1.0;
  } else {
    level = "TR5";
    categoryName = "Highly Suspicious";
    badgeColor = "#ef4444";
    fnaThreshold = 1.0;
    followThreshold = 0.5;
  }

  // Clinical Recommendation
  let recommendation = "No FNA needed.";
  if (sizeCm !== null && !isNaN(sizeCm)) {
    if (sizeCm >= fnaThreshold) {
      recommendation = "Suggest FNA.";
    } else if (sizeCm >= followThreshold) {
      recommendation = "Suggest follow-up ultrasound.";
    } else {
      recommendation = "No FNA recommended by size criteria.";
    }
  }

  return {
    level,
    categoryName,
    points,
    badgeColor,
    fnaThreshold,
    followThreshold,
    recommendation
  };
}

// Default Report Template configuration
const DEFAULT_TEMPLATE = {
  templateName: "Standard TI-RADS Ultrasound Report",
  version: "1.0",
  examTitle: "B-Mode Color Doppler Ultrasonography of the thyroid:",
  thyroidSectionHeader: "1. Thyroid:",
  parenchymaLeadIn: "- Thyroid nodules in bilateral lobes, characterization of the most suspicious ones is descripted below:",
  neckSectionHeader: "2. Neck:",
  neckDefaultText: "- The size, morphology and vascularity of lymph nodes in bilateral submandibular, supraclavicular and cervical regions are unremarkable.",
  impressionHeader: "Impression:",
  showImpressionSection: true,
  noduleItemFormat: `    - Thyroid nodule ({level}) in the {location}, {size} cm in size. (Img:{imgNo})
      Composition: {composition} ({compositionPts})
      Echogenicity: {echogenicity} ({echogenicityPts})
      Shape: {shape} ({shapePts})
      Margin: {margin} ({marginPts})
      Echogenic Foci: {foci} ({fociPts})
      {level} (total score: {totalPts} points). {recommendation}`,
  impressionItemFormat: `  - Thyroid nodule ({level}) in the {location}, {size} cm in size. (Img:{imgNo})
    >> {recommendation}`,
  parenchymaQuickOptions: [
    { label: "Normal Parenchyma", text: "- Both thyroid lobes are unremarkable in size and parenchymal echogenicity.", impressionText: "" },
    { label: "Chronic Thyroiditis (Hashimoto's)", text: "- Heterogeneous and coarse parenchymal echotexture, compatible with chronic thyroiditis (Hashimoto's).", impressionText: "- Chronic thyroiditis (Hashimoto's disease)." },
    { label: "Increased Vascularity (Thyroid Inferno)", text: "- Increased parenchymal vascularity on color Doppler (thyroid inferno pattern), suggestive of Graves' disease.", impressionText: "- Diffuse goiter with increased vascularity, consider Graves' disease." },
    { label: "Post Right Lobectomy", text: "- Status post right thyroid lobectomy.", impressionText: "- Status post right thyroid lobectomy." },
    { label: "Post Left Lobectomy", text: "- Status post left thyroid lobectomy.", impressionText: "- Status post left thyroid lobectomy." }
  ],
  neckQuickOptions: [
    { label: "Unremarkable Cervical Nodes", text: "- The size, morphology and vascularity of lymph nodes in bilateral submandibular, supraclavicular and cervical regions are unremarkable.", impressionText: "" },
    { label: "Benign Reactive Nodes", text: "- Benign-appearing reactive lymph nodes with fatty hilum in bilateral levels II-IV.", impressionText: "" },
    { label: "Suspicious Node (Loss of Hilum)", text: "- Enlarged cervical lymph node with loss of fatty hilum or rounded morphology.", impressionText: "- Suspicious cervical lymphadenopathy, FNA recommended." },
    { label: "Suspicious Node (Microcalcification/Cystic)", text: "- Cervical lymph node with cystic necrotic change or microcalcifications.", impressionText: "- Suspicious cervical lymphadenopathy with necrotic change or microcalcifications, FNA recommended." },
    { label: "No Malignancy / Lymphadenopathy", text: "- No definite evidence of cervical lymphadenopathy or distant metastasis identified.", impressionText: "" }
  ]
};

