import { QUICK_LINKS, decodeKeyPrefix } from "../lib/quick-links.js";
import {
  isSalesforceUrl,
  parseOrgFromUrl,
  normalizeSfId,
  to18,
  buildRecordUrl,
  sameOrgAffinity,
  DEFAULT_API_VERSION
} from "../lib/salesforce.js";
import { generateSoql } from "../lib/nl-soql.js";
import { analyzeFlow } from "../lib/flow-analyzer.js";
import { predictGovernorLimits } from "../lib/governor.js";
import { summarizeOrgLimits } from "../lib/org-limits.js";
import { decodeError, decodeErrorWithAi } from "../lib/error-decoder.js";
import { analyzeDebugLog } from "../lib/debug-log.js";
import { buildFormula, FORMULA_HELPERS } from "../lib/formula-builder.js";
import { analyzePermissions, buildPermissionQueries } from "../lib/permissions.js";
import { reviewApex } from "../lib/apex-review.js";
import { aiComplete } from "../lib/ai.js";
import {
  summarizeField,
  filterFields,
  findDependentPairs,
  buildDependentMap
} from "../lib/describe-browser.js";
import {
  objectKind,
  objectKindClass,
  filterSchemaObjects,
  extractParentRelations,
  extractChildRelations,
  buildObjectQuery,
  buildParentPathQuery,
  buildChildSubquery,
  schemaSummary,
  scoreSchemaObject,
  formatFieldType,
  pickCardFields,
  layoutSchemaGraph,
  buildGraphEdges,
  routeRelationshipPath,
  edgeLabelText,
  friendlyObjectKind,
  friendlyRoleLabel,
  schemaStory,
  plainRelationshipSentence,
  friendlyFieldHint,
  friendlyAccessLine,
  sessionObjectAccess,
  fieldSchemaBadges,
  summarizeSessionPermissions,
  crudStripHtml,
  buildUserPermOverlay
} from "../lib/schema-explorer.js";
import { METADATA_SEARCH_TYPES, lightningBaseFromOrg } from "../lib/metadata-open.js";
import { PACKAGE_TYPES, buildPackageXml, packageVersion } from "../lib/package-xml.js";
import { buildFieldReferenceHint } from "../lib/flow-cleaner.js";
import {
  recordsToTable,
  tableToCsv,
  tableToTsv,
  tableToExcelXml,
  downloadTextFile,
  defaultExportBasename,
  copyText
} from "../lib/query-export.js";
import {
  listSavedSoql,
  saveSoqlEntry,
  deleteSavedSoql,
  togglePinnedSoql
} from "../lib/soql-library.js";
import {
  extractFromObject,
  getTokenAtCursor,
  filterApiNames,
  applySuggestion,
  isValidSObjectName
} from "../lib/soql-assist.js";
import {
  isSalesforceId,
  isCustomMetadataType,
  detectSObjectType,
  extractRecordId,
  buildRecordEditorFields,
  buildUpdatePayload
} from "../lib/record-editor.js";
import {
  APEX_SNIPPETS,
  summarizeExecuteAnonymous,
  extractDebugOutput
} from "../lib/anonymous-apex.js";
import {
  recordActivity,
  listActivity,
  clearActivity,
  getScratchPad,
  saveScratchPad,
  formatActivityTime,
  activityTypeLabel
} from "../lib/session-workbench.js";
import {
  compareBundles,
  filterCompareResults,
  collectApiNames,
  toPackageMemberList,
  toPackageTypesFromRows,
  formatFieldShort,
  fieldSideBySideRows,
  saveLastComparePair,
  loadLastComparePair,
  COMPARE_CATEGORIES,
  defaultCompareCategoryIds,
  commonCompareCategoryIds
} from "../lib/org-compare.js";

const FEATURES = [
  {
    id: "nl-soql",
    title: "NL → SOQL",
    blurb: "Plain English → runnable SOQL / Tooling",
    featured: true
  },
  {
    id: "schema",
    title: "Schema Explorer",
    blurb: "See how records connect — drag tiles, read relationships in plain language"
  },
  { id: "soql-run", title: "SOQL Runner", blurb: "Query standard & custom objects" },
  { id: "anon-apex", title: "Anonymous Apex", blurb: "Run Apex and view debug output" },
  { id: "describe", title: "Describe Browser", blurb: "Fields & dependencies for any object" },
  {
    id: "org-compare",
    title: "Org Compare",
    blurb: "UAT vs Prod custom object & field drift"
  },
  { id: "meta-open", title: "Metadata Quick Open", blurb: "Open classes, flows, LWCs, and more" },
  { id: "package", title: "Package.xml Builder", blurb: "Build package.xml from selected members" },
  { id: "flow-clean", title: "Inactive Flow Cleaner", blurb: "Remove inactive versions safely" },
  { id: "flow", title: "Flow Analyzer", blurb: "Find DML-in-loop and fault gaps" },
  { id: "governor", title: "Governor Predictor", blurb: "Estimate Apex limit risk" },
  { id: "errors", title: "Error Decoder", blurb: "Explain Salesforce errors" },
  { id: "logs", title: "Debug Log Analyzer", blurb: "Limits, SOQL, and exceptions" },
  { id: "formula", title: "Formula Builder", blurb: "Build field formulas from a description" },
  { id: "perms", title: "Permission Investigator", blurb: "User CRUD / FLS on any object" },
  { id: "apex", title: "Apex Review", blurb: "Security and bulkification checks" }
];

const TITLES = {
  home: "Session Workbench",
  describe: "Describe Browser",
  schema: "Schema Explorer",
  "org-compare": "Org Compare",
  "meta-open": "Metadata Quick Open",
  package: "Package.xml Builder",
  "flow-clean": "Inactive Flow Cleaner",
  "nl-soql": "NL → SOQL",
  flow: "Flow Analyzer",
  governor: "Governor Predictor",
  errors: "Error Decoder",
  logs: "Debug Log Analyzer",
  formula: "Formula Builder",
  perms: "Permission Investigator",
  apex: "Apex Review",
  links: "Setup Links",
  "soql-run": "SOQL Runner",
  "anon-apex": "Anonymous Apex",
  ids: "ID Tools",
  favs: "Favorites"
};

const state = {
  tab: null,
  org: null,
  session: null,
  preferredOrgKey: "",
  sessionPinned: false,
  launchTabUrl: "",
  availableOrgs: [],
  favorites: [],
  lastSoqlJson: "",
  lastQueryJson: {
    soql: "",
    nl: ""
  },
  lastQueryTables: {
    soql: null,
    nl: null
  },
  lastQueryRecords: {
    soql: null,
    nl: null
  },
  recordEditor: {
    open: false,
    key: null,
    sobject: null,
    id: null,
    tooling: false,
    fields: [],
    record: null,
    deletable: false,
    updateable: false
  },
  lastGenSoql: "",
  lastGenApiMode: "rest",
  toolingObjects: null,
  lastFormula: "",
  describeObjects: [],
  describe: null,
  describeFields: [],
  schemaFilter: "all",
  schemaDescribe: null,
  schemaParents: [],
  schemaChildren: [],
  schemaTrail: [],
  schemaNeighbors: {},
  schemaExpanded: {},
  schemaView: { x: 0, y: 0, scale: 1 },
  schemaPermDrawerOpen: true,
  schemaAsUserKey: "",
  schemaAsUser: null,
  schemaAsUserOverlays: {},
  schemaHighlightedEdgeId: "",
  schemaCardPositions: {},
  schemaMovingCard: "",
  schemaSimpleMode: true,
  schemaLabels: {},
  schemaFieldMenu: null,
  packageSelections: [],
  packageMembersCache: [],
  lastPackageXml: "",
  inactiveFlows: [],
  inactiveFlowSelected: [],
  soqlLibrary: [],
  editingSoqlId: null,
  soqlAssist: {
    mode: "rest",
    objectNames: [],
    fieldsByKey: {},
    activeObject: null,
    suggestions: [],
    activeIndex: 0,
    token: null,
    loadSeq: 0,
    suppressSuggest: false,
    suggestTimer: null
  },
  apexClassResults: [],
  orgLimits: null,
  sessionActivity: [],
  scratchPad: { soql: "", apex: "" },
  scratchSaveTimer: null,
  orgCompare: {
    orgs: [],
    left: null,
    right: null,
    leftInv: null,
    rightInv: null,
    raw: null,
    tab: "onlyA",
    categoryFilter: "",
    selectedCategories: defaultCompareCategoryIds(),
    running: false,
    progress: 0
  }
};

const $ = (sel) => document.querySelector(sel);

init();

async function init() {
  await applyShellMode();
  window.addEventListener("resize", () => {
    applyShellMode();
  });
  renderFeatureGrid();
  bindNav();
  bindNlExamples();
  bindSchemaExplorer();
  bindWorkbench();
  bindFeatureActions();
  bindUtilityActions();
  bindRecordDrawer();
  fillApiVersions();
  fillMetaTypeSelect();
  fillPackageTypeSelect();
  fillApexSnippets();
  renderLinks();
  renderFormulaHelpers();
  await loadFavorites();
  bindDescribeObjectSearch();
  bindSessionSwitcher();
  await loadPreferredOrgKey();
  // Opener host from toolbar/content-script launch (defaults Active session).
  const bootParams = new URLSearchParams(location.search);
  const launchHost = String(bootParams.get("launchHost") || "").trim().toLowerCase();
  if (launchHost) {
    state.launchTabUrl = `https://${launchHost}/`;
  }
  // Instant Active session placeholder so the row is not empty while session validates.
  paintLaunchSessionPlaceholder();
  await refreshOrg();
  const deepView = bootParams.get("view");
  showView(deepView && TITLES[deepView] ? deepView : "home");
}

/** Show Active session from launchHost / storage before network session validation finishes. */
function paintLaunchSessionPlaceholder() {
  const url = String(state.launchTabUrl || "").trim();
  if (!url || !isSalesforceUrl(url)) return;
  const org = parseOrgFromUrl(url);
  if (!org) return;
  if (!state.org) state.org = org;
  setOrgBanner(state.org, state.session);
  renderSessionSwitcher(state.availableOrgs || []);
}

/**
 * Action popups stay compact; opening app/index.html as a Chrome tab fills the window.
 */
async function applyShellMode() {
  let asTab = false;
  try {
    const tab = await chrome.tabs.getCurrent();
    asTab = Boolean(tab?.id);
  } catch {
    asTab = false;
  }
  const wide = asTab || window.innerWidth >= 820 || window.matchMedia("(min-width: 820px)").matches;
  document.documentElement.classList.toggle("shell-wide", wide);
}

function renderFeatureGrid() {
  const grid = $("#featureGrid");
  grid.innerHTML = "";
  FEATURES.forEach((f) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = f.featured ? "feature-card feature-card-featured" : "feature-card";
    btn.innerHTML = f.featured
      ? `<span class="feature-card-badge">Signature</span><strong>${f.title}</strong><span>${f.blurb}</span>`
      : `<strong>${f.title}</strong><span>${f.blurb}</span>`;
    btn.addEventListener("click", () => showView(f.id));
    grid.appendChild(btn);
  });
}

function bindNlExamples() {
  document.querySelectorAll("[data-nl-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.getAttribute("data-nl-example") || "";
      const input = $("#nlInput");
      if (!input || !text) return;
      input.value = text;
      // Tooling example → switch API mode for convenience.
      if (/tooling|apex class|flowdefinition|batchable/i.test(text)) {
        const mode = $("#nlApiMode");
        if (mode) mode.value = "tooling";
      } else {
        const mode = $("#nlApiMode");
        if (mode) mode.value = "rest";
      }
      input.focus();
    });
  });
}

function bindNav() {
  $("#openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#homeOpenSettings")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#backBtn").addEventListener("click", () => showView("home"));
  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.getAttribute("data-open")));
  });
}

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const el = $(`#view-${id}`);
  if (el) el.classList.add("active");
  $("#headerTitle").textContent = TITLES[id] || "OrgKit";
  $("#backBtn").classList.toggle("hidden", id === "home");
  if (id === "home") {
    refreshWorkbench().catch(() => {});
  }
  if (id === "describe" || id === "perms" || id === "schema") {
    preloadGlobalObjects().catch(() => {});
  }
  if (id === "soql-run") {
    refreshSoqlLibrary().catch(() => {});
    ensureSoqlObjectList().catch(() => {});
  }
  if (id === "governor" && !state.orgLimits) {
    loadOrgLimits().catch(() => {});
  }
  if (id === "apex" && !state.apexClassResults.length) {
    searchApexClasses("").catch(() => {});
  }
  if (id === "org-compare") {
    renderCompareCategoryPicker();
    loadCompareOrgs().catch(() => {});
  }
}

function bindWorkbench() {
  $("#wbClearContinue")?.addEventListener("click", async () => {
    state.sessionActivity = await clearActivity(currentOrgKey());
    renderWorkbenchContinue();
  });
  $("#wbOpenScratchSoql")?.addEventListener("click", async () => {
    await persistScratchPadNow();
    $("#soqlInput").value = $("#wbScratchSoql")?.value || "";
    showView("soql-run");
  });
  $("#wbOpenScratchApex")?.addEventListener("click", async () => {
    await persistScratchPadNow();
    $("#anonApexInput").value = $("#wbScratchApex")?.value || "";
    showView("anon-apex");
  });
  const soql = $("#wbScratchSoql");
  const apex = $("#wbScratchApex");
  const onScratch = () => scheduleScratchPadSave();
  soql?.addEventListener("input", onScratch);
  apex?.addEventListener("input", onScratch);
}

async function refreshWorkbench() {
  const orgKey = currentOrgKey();
  try {
    state.sessionActivity = await listActivity(orgKey);
  } catch {
    state.sessionActivity = [];
  }
  try {
    state.scratchPad = await getScratchPad(orgKey);
  } catch {
    state.scratchPad = { soql: "", apex: "" };
  }
  const soqlEl = $("#wbScratchSoql");
  const apexEl = $("#wbScratchApex");
  if (soqlEl && document.activeElement !== soqlEl) soqlEl.value = state.scratchPad.soql || "";
  if (apexEl && document.activeElement !== apexEl) apexEl.value = state.scratchPad.apex || "";
  renderWorkbenchContinue();
  renderWorkbenchPinned();
}

function scheduleScratchPadSave() {
  if (state.scratchSaveTimer) clearTimeout(state.scratchSaveTimer);
  state.scratchSaveTimer = setTimeout(() => {
    persistScratchPadNow().catch(() => {});
  }, 350);
}

async function persistScratchPadNow() {
  if (state.scratchSaveTimer) {
    clearTimeout(state.scratchSaveTimer);
    state.scratchSaveTimer = null;
  }
  const soql = $("#wbScratchSoql")?.value || "";
  const apex = $("#wbScratchApex")?.value || "";
  state.scratchPad = { soql, apex };
  await saveScratchPad(currentOrgKey(), state.scratchPad);
  const hint = $("#wbScratchHint");
  if (hint) hint.textContent = "Saved for this org";
}

async function trackActivity(entry) {
  try {
    state.sessionActivity = await recordActivity(currentOrgKey(), entry);
    if ($("#view-home")?.classList.contains("active")) {
      renderWorkbenchContinue();
    }
  } catch {
    /* non-blocking */
  }
}

function renderWorkbenchContinue() {
  const root = $("#wbContinue");
  if (!root) return;
  root.replaceChildren();
  const rows = state.sessionActivity || [];
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "wb-empty";
    empty.textContent = "Nothing yet — run SOQL, Apex, describe, or open metadata to fill this list.";
    root.appendChild(empty);
    return;
  }
  for (const row of rows.slice(0, 8)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wb-item";
    btn.innerHTML = `
      <span class="wb-item-top">
        <span class="wb-tag">${escapeHtml(activityTypeLabel(row.type))}</span>
        <span class="wb-item-title">${escapeHtml(row.title || "Activity")}</span>
        <span class="wb-item-time">${escapeHtml(formatActivityTime(row.at))}</span>
      </span>
      ${row.detail ? `<span class="wb-item-detail">${escapeHtml(row.detail)}</span>` : ""}`;
    btn.addEventListener("click", () => resumeActivity(row));
    root.appendChild(btn);
  }
}

function renderWorkbenchPinned() {
  const root = $("#wbPinned");
  if (!root) return;
  root.replaceChildren();
  const pinned = (state.soqlLibrary || []).filter((r) => r.pinned).slice(0, 8);
  if (!pinned.length) {
    const empty = document.createElement("div");
    empty.className = "wb-empty";
    empty.textContent = "Pin queries in the SOQL library to see them here.";
    root.appendChild(empty);
    return;
  }
  for (const row of pinned) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wb-item";
    const preview = row.soql.length > 100 ? `${row.soql.slice(0, 97)}…` : row.soql;
    btn.innerHTML = `
      <span class="wb-item-top">
        <span class="wb-tag">${row.apiMode === "tooling" ? "Tooling" : "SOQL"}</span>
        <span class="wb-item-title">${escapeHtml(row.name)}</span>
      </span>
      <span class="wb-item-detail">${escapeHtml(preview)}</span>`;
    btn.addEventListener("click", () => {
      $("#soqlApiMode").value = row.apiMode === "tooling" ? "tooling" : "rest";
      $("#soqlInput").value = row.soql;
      $("#soqlSaveName").value = row.name;
      state.editingSoqlId = row.id;
      showView("soql-run");
    });
    root.appendChild(btn);
  }
}

function resumeActivity(row) {
  const payload = row.payload || {};
  if (row.type === "soql" || row.view === "soql-run") {
    if (payload.apiMode) $("#soqlApiMode").value = payload.apiMode === "tooling" ? "tooling" : "rest";
    if (payload.soql) $("#soqlInput").value = payload.soql;
    showView("soql-run");
    return;
  }
  if (row.type === "apex" || row.view === "anon-apex") {
    if (payload.apex) $("#anonApexInput").value = payload.apex;
    showView("anon-apex");
    return;
  }
  if (row.view === "schema") {
    if (payload.sobject) {
      const search = $("#schemaObjectSearch");
      if (search) search.value = payload.sobject;
    }
    showView("schema");
    if (payload.sobject) onLoadSchema({ resetTrail: true, sobject: payload.sobject }).catch(() => {});
    return;
  }
  if (row.type === "describe" || row.view === "describe") {
    if (payload.sobject) $("#describeObjectSearch").value = payload.sobject;
    showView("describe");
    if (payload.sobject) onLoadDescribe().catch(() => {});
    return;
  }
  if (row.type === "meta" || row.view === "meta-open") {
    if (payload.query != null) $("#metaQuery").value = payload.query;
    if (payload.typeId) $("#metaType").value = payload.typeId;
    showView("meta-open");
    return;
  }
  if (row.view && TITLES[row.view]) showView(row.view);
}

function bindFeatureActions() {
  $("#genSoql").addEventListener("click", onGenSoql);
  $("#runGenSoql").addEventListener("click", onRunGenSoql);
  $("#copyGenSoql").addEventListener("click", async () => {
    if (state.lastGenSoql) await navigator.clipboard.writeText(state.lastGenSoql);
  });

  $("#loadFlows").addEventListener("click", onLoadFlows);
  $("#analyzeFlowPaste").addEventListener("click", () => {
    renderFlowReport(analyzeFlow($("#flowPaste").value));
  });

  $("#runGovernor").addEventListener("click", () => {
    renderGovernor(predictGovernorLimits($("#govInput").value));
  });
  $("#loadOrgLimits").addEventListener("click", () => loadOrgLimits());

  $("#decodeErr").addEventListener("click", () => renderError(decodeError($("#errInput").value)));
  $("#decodeErrAi").addEventListener("click", async () => {
    const out = await decodeErrorWithAi($("#errInput").value, aiComplete);
    renderError(out);
  });

  $("#analyzeLog").addEventListener("click", () => renderLog(analyzeDebugLog($("#logInput").value)));

  $("#buildFormula").addEventListener("click", onBuildFormula);
  $("#copyFormula").addEventListener("click", async () => {
    if (state.lastFormula) await navigator.clipboard.writeText(state.lastFormula);
  });

  $("#investigatePerms").addEventListener("click", onInvestigatePerms);
  $("#reviewApex").addEventListener("click", onReviewApex);
  $("#searchApexClasses").addEventListener("click", () => searchApexClasses($("#apexClassSearch").value));
  $("#apexClassSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchApexClasses($("#apexClassSearch").value);
  });

  $("#loadDescribe").addEventListener("click", onLoadDescribe);
  $("#describeFieldFilter").addEventListener("input", () => renderDescribeFields());
  $("#describeObjectSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onLoadDescribe();
  });

  $("#searchMeta").addEventListener("click", onSearchMeta);
  $("#metaQuery").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSearchMeta();
  });

  $("#loadPackageMembers").addEventListener("click", onLoadPackageMembers);
  $("#packageMemberFilter").addEventListener("input", () => renderPackageMembers());
  $("#clearPackageSel").addEventListener("click", () => {
    state.packageSelections = [];
    renderPackageSelection();
    renderPackageMembers();
  });
  $("#genPackageXml").addEventListener("click", onGenPackageXml);
  $("#copyPackageXml").addEventListener("click", async () => {
    if (state.lastPackageXml) await navigator.clipboard.writeText(state.lastPackageXml);
  });

  $("#loadInactiveFlows").addEventListener("click", () => onLoadInactiveFlows(false));
  $("#scanFlowFieldRefs").addEventListener("click", () => onLoadInactiveFlows(true));
  $("#flowCleanFilter").addEventListener("input", () => renderInactiveFlows());
  $("#selectAllInactiveFlows").addEventListener("click", () => {
    state.inactiveFlowSelected = state.inactiveFlows.filter((f) => f.canDelete).map((f) => f.id);
    renderInactiveFlows();
  });
  $("#clearInactiveFlows").addEventListener("click", () => {
    state.inactiveFlowSelected = [];
    renderInactiveFlows();
  });
  $("#deleteInactiveFlows").addEventListener("click", onDeleteInactiveFlows);

  $("#refreshCompareOrgs")?.addEventListener("click", () => loadCompareOrgs());
  $("#runOrgCompare")?.addEventListener("click", onRunOrgCompare);
  $("#swapCompareOrgs")?.addEventListener("click", onSwapCompareOrgs);
  $("#compareOrgLeft")?.addEventListener("change", () => {
    updateCompareOrgCards();
    renderCompareSessionList();
    persistComparePairSelection().catch(() => {});
  });
  $("#compareOrgRight")?.addEventListener("change", () => {
    updateCompareOrgCards();
    renderCompareSessionList();
    persistComparePairSelection().catch(() => {});
  });
  $("#compareSessionList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-assign-side]");
    if (!btn) return;
    const side = btn.getAttribute("data-assign-side");
    const orgKey = btn.getAttribute("data-org-key") || "";
    if (!orgKey || (side !== "A" && side !== "B")) return;
    assignCompareOrg(side, orgKey);
  });
  $("#compareFilter")?.addEventListener("input", () => renderOrgCompareResults());
  $("#compareCustomFieldsOnly")?.addEventListener("change", () => {
    if (state.orgCompare.raw) rerunOrgCompareDiff();
  });
  $("#compareCatsCommon")?.addEventListener("click", () => {
    state.orgCompare.selectedCategories = commonCompareCategoryIds();
    renderCompareCategoryPicker();
  });
  $("#compareCatsAll")?.addEventListener("click", () => {
    state.orgCompare.selectedCategories = COMPARE_CATEGORIES.map((c) => c.id);
    renderCompareCategoryPicker();
  });
  $("#compareCatsNone")?.addEventListener("click", () => {
    state.orgCompare.selectedCategories = [];
    renderCompareCategoryPicker();
  });
  $("#compareCategoryList")?.addEventListener("change", (e) => {
    const input = e.target.closest('input[data-compare-cat]');
    if (!input) return;
    const id = input.getAttribute("data-compare-cat");
    const set = new Set(state.orgCompare.selectedCategories || []);
    if (input.checked) set.add(id);
    else set.delete(id);
    state.orgCompare.selectedCategories = [...set];
  });
  $("#compareCategoryFilter")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-compare-category-filter]");
    if (!btn) return;
    state.orgCompare.categoryFilter = btn.getAttribute("data-compare-category-filter") || "";
    renderCompareCategoryFilter();
    renderOrgCompareResults();
  });
  $("#copyCompareApiNames")?.addEventListener("click", onCopyCompareApiNames);
  $("#copyComparePackageMembers")?.addEventListener("click", onCopyComparePackageMembers);
  document.querySelectorAll("#compareTabs [data-compare-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setCompareTab(btn.getAttribute("data-compare-tab") || "onlyA"));
  });
  $("#compareSummary")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-compare-tab]");
    if (!btn) return;
    setCompareTab(btn.getAttribute("data-compare-tab") || "onlyA");
  });
  renderCompareCategoryPicker();
}

function bindUtilityActions() {
  $("#linkSearch").addEventListener("input", () => renderLinks($("#linkSearch").value));
  $("#runSoql").addEventListener("click", runSoqlManual);
  $("#saveSoqlBtn").addEventListener("click", onSaveSoqlToLibrary);
  $("#soqlLibraryFilter").addEventListener("input", () => renderSoqlLibrary());
  bindSoqlAssist();
  bindQueryExportPanel($("#soqlQueryPanel"), "soql", $("#soqlQueryStatus"));
  bindQueryExportPanel($("#nlQueryPanel"), "nl", $("#nlQueryStatus"));
  $("#runAnonApex").addEventListener("click", onRunAnonApex);
  $("#fetchAnonDebug").addEventListener("click", onFetchAnonDebug);
  $("#copyAnonApex").addEventListener("click", async () => {
    const body = $("#anonApexInput").value;
    if (body) await navigator.clipboard.writeText(body);
  });
  $("#apexSnippet").addEventListener("change", () => {
    const snip = APEX_SNIPPETS.find((s) => s.id === $("#apexSnippet").value);
    if (snip) $("#anonApexInput").value = snip.body;
  });
  $("#idInput").addEventListener("input", updateIdInfo);
  $("#openRecord").addEventListener("click", openRecord);
  $("#copy15").addEventListener("click", () => copyIdLength(15));
  $("#copy18").addEventListener("click", () => copyIdLength(18));
  $("#scanPageIds").addEventListener("click", scanPageIds);
  $("#addFav").addEventListener("click", addFavorite);
  $("#saveCurrent").addEventListener("click", saveCurrentPage);
  updateIdInfo();
}

function bindQueryExportPanel(panel, key, statusEl) {
  if (!panel) return;
  panel.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-export]");
    if (!btn) return;
    const table = state.lastQueryTables[key];
    const json = state.lastQueryJson[key] || "";
    try {
      await handleQueryExport(btn.dataset.export, table, json, statusEl);
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || String(err);
    }
  });
}

async function handleQueryExport(kind, table, json, statusEl) {
  if (!table && kind !== "json") {
    throw new Error("Run a query first.");
  }
  const base = defaultExportBasename("soql-results");
  if (kind === "sheets") {
    await copyText(tableToTsv(table));
    if (statusEl) statusEl.textContent = "Copied for Google Sheets / Excel paste (TSV).";
    return;
  }
  if (kind === "excel") {
    downloadTextFile(
      `${base}.xls`,
      tableToExcelXml(table, "SOQL"),
      "application/vnd.ms-excel"
    );
    if (statusEl) statusEl.textContent = `Downloaded ${base}.xls`;
    return;
  }
  if (kind === "csv") {
    downloadTextFile(`${base}.csv`, tableToCsv(table), "text/csv;charset=utf-8");
    if (statusEl) statusEl.textContent = `Downloaded ${base}.csv`;
    return;
  }
  if (kind === "json") {
    if (!json) throw new Error("No JSON result to copy.");
    await copyText(json);
    if (statusEl) statusEl.textContent = "Copied JSON.";
  }
}

function renderQueryResult(panel, statusEl, key, queryResult, soqlText = "", options = {}) {
  const table = recordsToTable(queryResult);
  const records = Array.isArray(queryResult?.records) ? queryResult.records : [];
  const sobjectType = detectSObjectType(queryResult, soqlText);
  const tooling =
    options.tooling === true ||
    (options.tooling !== false && key === "soql" && soqlApiMode() === "tooling") ||
    (key === "nl" && state.lastGenApiMode === "tooling");
  state.lastQueryTables[key] = table;
  state.lastQueryJson[key] = JSON.stringify(queryResult, null, 2);
  state.lastQueryRecords[key] = { records, sobjectType, tooling, soqlText };
  state.lastSoqlJson = state.lastQueryJson[key];

  if (!panel) return;
  panel.classList.remove("hidden");
  const meta = panel.querySelector("[data-query-meta]");
  const wrap = panel.querySelector("[data-query-table]");
  if (meta) {
    const more = table.done === false ? " · more rows available" : "";
    const typeBit = sobjectType ? ` · ${sobjectType}` : "";
    meta.textContent = `${table.recordCount} row${table.recordCount === 1 ? "" : "s"} · ${table.columns.length} column${
      table.columns.length === 1 ? "" : "s"
    }${typeof table.totalSize === "number" ? ` · totalSize ${table.totalSize}` : ""}${typeBit}${more}`;
  }
  if (!wrap) return;
  wrap.replaceChildren();

  if (!table.recordCount) {
    const empty = document.createElement("div");
    empty.className = "query-empty";
    empty.textContent = "Query returned 0 records.";
    wrap.appendChild(empty);
    setQueryStatus(statusEl, "Ready to export an empty sheet, or adjust the query.", "ok");
    return;
  }

  const idColIdx = table.columns.findIndex((c) => c === "Id");
  const tableEl = document.createElement("table");
  tableEl.className = "query-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const thAct = document.createElement("th");
  thAct.textContent = "Actions";
  headRow.appendChild(thAct);
  for (const col of table.columns) {
    const th = document.createElement("th");
    th.textContent = col;
    th.title = col;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  tableEl.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.rows.forEach((row, rowIdx) => {
    const tr = document.createElement("tr");
    const record = records[rowIdx] || null;
    const recordId = extractRecordId(record, row, table.columns);
    const type = record?.attributes?.type || sobjectType;

    const tdAct = document.createElement("td");
    tdAct.className = "actions";
    const actions = document.createElement("div");
    actions.className = "row-actions";
    if (recordId && type) {
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn";
      openBtn.textContent = "Open";
      openBtn.title = "Open in Salesforce";
      openBtn.addEventListener("click", () => {
        openQueryRecord(recordId).catch((e) => {
          setQueryStatus(statusEl, e.message, "error");
        });
      });
      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "btn primary";
      allBtn.textContent = "All data";
      allBtn.title = "Show all fields — edit or delete";
      allBtn.addEventListener("click", () => {
        openRecordDrawer({
          key,
          sobject: type,
          id: recordId,
          tooling
        }).catch((e) => {
          setQueryStatus(statusEl, e.message, "error");
        });
      });
      actions.appendChild(openBtn);
      actions.appendChild(allBtn);
    } else {
      const miss = document.createElement("span");
      miss.className = "hint";
      miss.textContent = "Add Id";
      miss.title = "Include Id in SELECT to open / edit records";
      actions.appendChild(miss);
    }
    tdAct.appendChild(actions);
    tr.appendChild(tdAct);

    row.forEach((cell, colIdx) => {
      const td = document.createElement("td");
      if (colIdx === idColIdx && isSalesforceId(cell)) {
        const a = document.createElement("a");
        a.href = "#";
        a.className = "record-id-link";
        a.textContent = cell;
        a.title = "Open in Salesforce";
        a.addEventListener("click", (e) => {
          e.preventDefault();
          openQueryRecord(cell).catch((err) => {
            setQueryStatus(statusEl, err.message, "error");
          });
        });
        td.appendChild(a);
      } else {
        td.textContent = cell;
      }
      td.title = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
  wrap.appendChild(tableEl);
  setQueryStatus(
    statusEl,
    recordIdHint(table)
      ? "Click Id / Open for Lightning, or All data to view every field and edit/delete."
      : "Include Id in SELECT to enable Open and All data.",
    "ok"
  );
}

function recordIdHint(table) {
  return table.columns.includes("Id");
}

async function openQueryRecord(recordId) {
  await refreshOrg();
  if (!state.org) throw new Error("Open a Salesforce org tab first.");
  const url = buildRecordUrl(state.org, recordId, true);
  await chrome.tabs.create({ url });
}

function clearQueryResult(panel, statusEl, key, message, kind = "info") {
  state.lastQueryTables[key] = null;
  state.lastQueryJson[key] = "";
  state.lastQueryRecords[key] = null;
  if (panel) {
    panel.classList.add("hidden");
    const wrap = panel.querySelector("[data-query-table]");
    if (wrap) wrap.replaceChildren();
    const meta = panel.querySelector("[data-query-meta]");
    if (meta) meta.textContent = "";
  }
  setQueryStatus(statusEl, message || "", kind);
}

function setQueryStatus(statusEl, message, kind = "info") {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.classList.remove("is-error", "is-ok", "is-busy");
  if (!message) return;
  if (kind === "error") statusEl.classList.add("is-error");
  else if (kind === "ok") statusEl.classList.add("is-ok");
  else if (kind === "busy") statusEl.classList.add("is-busy");
}

function setStatusMessage(el, message, kind = "info") {
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("is-error", "is-ok", "is-busy");
  if (!message) return;
  if (kind === "error") el.classList.add("is-error");
  else if (kind === "ok") el.classList.add("is-ok");
  else if (kind === "busy") el.classList.add("is-busy");
}

function bindRecordDrawer() {
  const drawer = $("#recordDrawer");
  if (!drawer) return;
  drawer.querySelectorAll("[data-record-close]").forEach((el) => {
    el.addEventListener("click", () => closeRecordDrawer());
  });
  $("#recordOpenSf")?.addEventListener("click", async () => {
    try {
      if (!state.recordEditor.id) return;
      await openQueryRecord(state.recordEditor.id);
    } catch (e) {
      setRecordDrawerStatus(e.message);
    }
  });
  $("#recordSave")?.addEventListener("click", () => saveRecordDrawer().catch((e) => setRecordDrawerStatus(e.message)));
  $("#recordDelete")?.addEventListener("click", () => deleteRecordDrawer().catch((e) => setRecordDrawerStatus(e.message)));
  $("#recordFieldFilter")?.addEventListener("input", () => renderRecordFieldList());
}

async function openRecordDrawer({ key, sobject, id, tooling = false }) {
  if (!sobject || !id) throw new Error("Record type and Id are required.");
  const drawer = $("#recordDrawer");
  const status = $("#recordDrawerStatus");
  if (!drawer) return;
  setRecordDrawerStatus("Loading all fields…");
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
  $("#recordDrawerTitle").textContent = "Show all data";
  $("#recordDrawerSub").textContent = `${sobject} · ${id}${tooling ? " · Tooling" : ""}`;
  $("#recordFieldFilter").value = "";
  $("#recordFieldList").replaceChildren();

  await ensureSalesforceSiteAccess();
  const tabUrl = await requireTabUrl();
  const [describeRes, recordRes] = await Promise.all([
    send("describeSObject", { tabUrl, sobject, apiVersion: apiVersion(), tooling }),
    send("getSObject", { tabUrl, sobject, id, apiVersion: apiVersion(), tooling })
  ]);
  if (!describeRes.ok) throw new Error(describeRes.error);
  if (!recordRes.ok) throw new Error(recordRes.error);

  const fields = buildRecordEditorFields(describeRes.result, recordRes.result);
  const cmdt = isCustomMetadataType(sobject);
  const canUpdate =
    describeRes.result?.updateable !== false || cmdt || fields.some((f) => f.updateable);
  const canDelete = describeRes.result?.deletable !== false && !cmdt;
  state.recordEditor = {
    open: true,
    key,
    sobject,
    id,
    tooling: !!tooling,
    fields,
    record: recordRes.result,
    deletable: canDelete,
    updateable: canUpdate,
    isCmdt: cmdt
  };
  $("#recordSave").disabled = !state.recordEditor.updateable;
  $("#recordDelete").disabled = !state.recordEditor.deletable;
  renderRecordFieldList();
  setRecordDrawerStatus(
    cmdt
      ? `${fields.length} fields · custom metadata — editable fields save via Tooling CustomMetadata.`
      : `${fields.length} fields · ${fields.filter((f) => f.updateable).length} editable. Change values then Save, or Delete.`
  );
}

function closeRecordDrawer() {
  const drawer = $("#recordDrawer");
  if (drawer) {
    drawer.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
  }
  state.recordEditor.open = false;
}

function setRecordDrawerStatus(msg) {
  const el = $("#recordDrawerStatus");
  if (el) el.textContent = msg || "";
}

function renderRecordFieldList() {
  const root = $("#recordFieldList");
  if (!root) return;
  const filter = ($("#recordFieldFilter")?.value || "").trim().toLowerCase();
  const fields = (state.recordEditor.fields || []).filter((f) => {
    if (!filter) return true;
    return `${f.name} ${f.label} ${f.type}`.toLowerCase().includes(filter);
  });
  root.replaceChildren();
  for (const f of fields) {
    const row = document.createElement("div");
    row.className = `record-field${f.updateable ? "" : " readonly"}`;
    const lab = document.createElement("label");
    lab.htmlFor = `rf_${f.name}`;
    lab.innerHTML = `<strong>${escapeHtml(f.name)}</strong>${escapeHtml(f.label)} · ${escapeHtml(f.type)}`;
    row.appendChild(lab);

    if (!f.updateable) {
      const ro = document.createElement("div");
      ro.className = "field-ro";
      ro.textContent = f.value === "" || f.value == null ? "—" : String(f.value);
      row.appendChild(ro);
    } else if (f.type === "boolean") {
      const sel = document.createElement("select");
      sel.id = `rf_${f.name}`;
      sel.dataset.field = f.name;
      sel.innerHTML = `<option value="false">false</option><option value="true">true</option>`;
      const cur = f.value === true || f.value === "true" || f.value === "TRUE";
      sel.value = cur ? "true" : "false";
      row.appendChild(sel);
    } else if (f.picklistValues?.length && (f.type === "picklist" || f.type === "combobox")) {
      const sel = document.createElement("select");
      sel.id = `rf_${f.name}`;
      sel.dataset.field = f.name;
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = f.nillable ? "(blank)" : "";
      sel.appendChild(empty);
      for (const p of f.picklistValues) {
        const opt = document.createElement("option");
        opt.value = p.value;
        opt.textContent = p.label;
        sel.appendChild(opt);
      }
      sel.value = f.value == null ? "" : String(f.value);
      row.appendChild(sel);
    } else if (f.type === "textarea" || f.type === "encryptedstring" || (f.length && f.length > 80)) {
      const ta = document.createElement("textarea");
      ta.id = `rf_${f.name}`;
      ta.dataset.field = f.name;
      ta.value = f.value == null ? "" : String(f.value);
      row.appendChild(ta);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.id = `rf_${f.name}`;
      input.dataset.field = f.name;
      input.value = f.value == null ? "" : String(f.value);
      row.appendChild(input);
    }
    root.appendChild(row);
  }
  if (!fields.length) {
    const empty = document.createElement("div");
    empty.className = "query-empty";
    empty.textContent = "No fields match this filter.";
    root.appendChild(empty);
  }
}

async function saveRecordDrawer() {
  const ed = state.recordEditor;
  if (!ed?.sobject || !ed?.id) return;
  if (!ed.updateable) throw new Error("This object is not updateable.");
  const { body, changed } = buildUpdatePayload(ed.fields, (name) => {
    const el = document.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!el) return "";
    return el.value;
  });
  if (!changed) {
    setRecordDrawerStatus("No changes to save.");
    return;
  }
  const fieldList = Object.keys(body).join(", ");
  const ok = confirm(
    `Update ${ed.sobject} ${ed.id}?\n\nFields: ${fieldList}\n\nThis writes to your Salesforce org using your current session.`
  );
  if (!ok) {
    setRecordDrawerStatus("Save cancelled.");
    return;
  }
  setRecordDrawerStatus(`Saving ${changed} field${changed === 1 ? "" : "s"}…`);
  const res = await send("updateSObject", {
    tabUrl: await requireTabUrl(),
    sobject: ed.sobject,
    id: ed.id,
    fields: body,
    apiVersion: apiVersion(),
    tooling: ed.tooling
  });
  if (!res.ok) throw new Error(res.error);
  setRecordDrawerStatus(`Saved: ${res.result.fields.join(", ")}. Reloading…`);
  await openRecordDrawer({
    key: ed.key,
    sobject: ed.sobject,
    id: ed.id,
    tooling: ed.tooling
  });
  setRecordDrawerStatus(`Saved: ${Object.keys(body).join(", ")}.`);
}

async function deleteRecordDrawer() {
  const ed = state.recordEditor;
  if (!ed?.sobject || !ed?.id) return;
  if (!ed.deletable) throw new Error("This object is not deletable.");
  const ok = confirm(`Delete ${ed.sobject} ${ed.id}? This cannot be undone from OrgKit.`);
  if (!ok) return;
  setRecordDrawerStatus("Deleting…");
  const res = await send("deleteSObject", {
    tabUrl: await requireTabUrl(),
    sobject: ed.sobject,
    id: ed.id,
    apiVersion: apiVersion(),
    tooling: ed.tooling
  });
  if (!res.ok) throw new Error(res.error);
  closeRecordDrawer();
  const status =
    ed.key === "nl" ? $("#nlQueryStatus") : $("#soqlQueryStatus");
  if (status) status.textContent = `Deleted ${ed.sobject} ${ed.id}. Re-run the query to refresh rows.`;
}

function fillApiVersions() {
  const select = $("#apiVersion");
  for (let v = 62; v >= 50; v -= 1) {
    const opt = document.createElement("option");
    opt.value = `${v}.0`;
    opt.textContent = `v${v}.0`;
    if (`${v}.0` === DEFAULT_API_VERSION) opt.selected = true;
    select.appendChild(opt);
  }
  chrome.storage.sync.get({ apiVersion: DEFAULT_API_VERSION }, (data) => {
    if (data.apiVersion) select.value = data.apiVersion;
  });
}

async function loadPreferredOrgKey() {
  try {
    const data = await chrome.storage.local.get({
      preferredOrgKey: "",
      sessionPinned: false
    });
    state.preferredOrgKey = String(data.preferredOrgKey || "").trim();
    // Opening OrgKit from a Salesforce page clears sessionPinned in the SW.
    state.sessionPinned = !!data.sessionPinned && !!state.preferredOrgKey;
  } catch {
    state.preferredOrgKey = "";
    state.sessionPinned = false;
  }
}

async function savePreferredOrgKey(orgKey, { pinned = state.sessionPinned } = {}) {
  state.preferredOrgKey = String(orgKey || "").trim();
  state.sessionPinned = !!pinned && !!state.preferredOrgKey;
  try {
    await chrome.storage.local.set({
      preferredOrgKey: state.preferredOrgKey,
      sessionPinned: state.sessionPinned
    });
  } catch {
    /* local preference only */
  }
}

function bindSessionSwitcher() {
  const select = $("#activeSessionSelect");
  const refreshBtn = $("#refreshSessionsBtn");
  select?.addEventListener("change", async () => {
    const orgKey = select.value;
    if (!orgKey) return;
    await switchActiveSession(orgKey);
  });
  refreshBtn?.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    try {
      await refreshOrg();
    } finally {
      refreshBtn.disabled = false;
    }
  });
}

async function switchActiveSession(orgKey) {
  const prev = currentOrgKey();
  // User explicitly chose a session — pin until they open OrgKit from another org.
  await savePreferredOrgKey(orgKey, { pinned: true });
  // Drop org-scoped caches when switching sandboxes / orgs.
  if (prev !== orgKey) {
    state.globalObjects = null;
    state.toolingObjects = null;
    state.describe = null;
    state.describeFields = [];
    state.describeObjects = [];
    state.schemaDescribe = null;
    state.schemaParents = [];
    state.schemaChildren = [];
    state.schemaTrail = [];
    state.schemaNeighbors = {};
    state.schemaExpanded = {};
    state.schemaView = { x: 0, y: 0, scale: 1 };
    state.schemaCardPositions = {};
    state.schemaAsUserKey = "";
    state.schemaAsUser = null;
    state.schemaAsUserOverlays = {};
    state.schemaHighlightedEdgeId = "";
    state.schemaFieldMenu = null;
    hideSchemaFieldMenu();
    state.globalObjects = null;
    state.lastQueryTables = { soql: null, nl: null };
    state.lastQueryRecords = { soql: null, nl: null };
  }
  await refreshOrg();
}

function sessionOptionLabel(org) {
  const env = shortCompareEnvLabel(org.envLabel || (org.isSandbox ? "Sandbox" : "Production"));
  const host = org.myDomain || org.hostname || org.orgKey;
  const user = org.username ? ` · ${org.username}` : "";
  const sess = org.hasSession ? "" : " (nav only)";
  return `${env}: ${host}${user}${sess}`;
}

/** Match list entry to the org currently bound in the workbench. */
function findOrgInList(list, { orgKey, org, session, tabUrl } = {}) {
  const rows = Array.isArray(list) ? list : [];
  if (!rows.length) return null;

  if (orgKey) {
    const byKey = rows.find((o) => o.orgKey === orgKey);
    if (byKey) return byKey;
  }

  const orgId = session?.userInfo?.organization_id || "";
  if (orgId) {
    const byId = rows.find((o) => o.orgKey === orgId || o.orgId === orgId);
    if (byId) return byId;
  }

  if (tabUrl) {
    const byUrl = rows.find(
      (o) =>
        o.tabUrl === tabUrl ||
        (o.hostname && tabUrl.includes(o.hostname)) ||
        (o.apiBase && tabUrl.startsWith(o.apiBase)) ||
        sameOrgAffinity(o.hostname || o.tabUrl || "", tabUrl)
    );
    if (byUrl) return byUrl;
  }

  if (org?.hostname || org?.apiBase) {
    const byHost = rows.find(
      (o) =>
        o.hostname === org.hostname ||
        (org.apiBase && o.apiBase === org.apiBase) ||
        sameOrgAffinity(o.hostname || o.apiBase || o.tabUrl || "", org.hostname || org.apiBase || "")
    );
    if (byHost) return byHost;
  }

  return null;
}

function currentOrgListEntry() {
  if (!state.org && !state.tab?.url && !state.launchTabUrl) return null;
  const orgKey =
    state.session?.userInfo?.organization_id ||
    state.org?.apiBase ||
    state.org?.hostname ||
    state.tab?.url ||
    state.launchTabUrl ||
    "current";
  const username =
    state.session?.userInfo?.preferred_username ||
    state.session?.userInfo?.email ||
    state.session?.userInfo?.username ||
    "";
  return {
    orgKey,
    hostname: state.org?.hostname || "",
    apiBase: state.session?.apiBase || state.org?.apiBase || "",
    myDomain: state.org?.myDomain || "",
    envLabel: state.org?.envLabel || "Org",
    isSandbox: !!state.org?.isSandbox,
    isDevEd: !!state.org?.isDevEd,
    hasSession: !!state.session?.sid,
    username,
    tabUrl: state.tab?.url || state.launchTabUrl || "",
    orgId: state.session?.userInfo?.organization_id || "",
    label: `${state.org?.envLabel || "Org"}: ${state.org?.myDomain || state.org?.hostname || orgKey}`
  };
}

function renderSessionSwitcher(orgs) {
  const select = $("#activeSessionSelect");
  const row = $("#orgSessionRow");
  if (!select || !row) return;

  // Always include the currently connected org so the picklist is never blank
  // when Session: connected (listSalesforceOrgs can miss Setup-only tabs).
  let list = Array.isArray(orgs) ? [...orgs] : [];
  const current = currentOrgListEntry();
  if (current) {
    const existing = findOrgInList(list, {
      orgKey: current.orgKey,
      org: state.org,
      session: state.session,
      tabUrl: current.tabUrl
    });
    if (!existing) list.unshift(current);
  }

  // Default Active session to the org currently loaded (launch/current).
  const active = findOrgInList(list, {
    orgKey: state.sessionPinned ? state.preferredOrgKey : current?.orgKey || "",
    org: state.org,
    session: state.session,
    tabUrl: state.tab?.url || state.launchTabUrl || current?.tabUrl || ""
  }) || current;
  const selectedKey = active?.orgKey || current?.orgKey || "";

  select.replaceChildren();
  if (!list.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No Salesforce sessions found — open a logged-in tab";
    select.appendChild(opt);
    select.disabled = true;
    row.hidden = false;
    return;
  }

  for (const org of list) {
    const opt = document.createElement("option");
    opt.value = String(org.orgKey || "");
    opt.textContent = sessionOptionLabel(org) || String(org.orgKey || org.hostname || "Salesforce org");
    select.appendChild(opt);
  }

  if (selectedKey && [...select.options].some((o) => o.value === selectedKey)) {
    select.value = selectedKey;
  } else {
    select.selectedIndex = 0;
  }

  select.disabled = false;
  row.hidden = false;
}

async function refreshOrg() {
  // Re-read pin flag — opening from Salesforce clears pin + preferredOrgKey in the SW.
  try {
    const data = await chrome.storage.local.get({
      sessionPinned: false,
      preferredOrgKey: "",
      lastLaunchTabUrl: ""
    });
    state.sessionPinned = !!data.sessionPinned && !!String(data.preferredOrgKey || "").trim();
    state.preferredOrgKey = state.sessionPinned ? String(data.preferredOrgKey || "").trim() : "";
    state.launchTabUrl = String(data.lastLaunchTabUrl || state.launchTabUrl || "").trim();
  } catch {
    /* keep current state */
  }

  // Keep Active session visible while getActiveTabOrg validates the sid.
  paintLaunchSessionPlaceholder();

  const pinned = !!state.sessionPinned && !!state.preferredOrgKey;
  const pinnedOrg =
    pinned && Array.isArray(state.availableOrgs)
      ? state.availableOrgs.find((o) => o.orgKey === state.preferredOrgKey)
      : null;

  // Fast path: bind to the Salesforce org you opened from (or pinned session)
  // BEFORE scanning every session — so the banner is not empty on first paint.
  const res = await send("getActiveTabOrg", {
    pinned,
    preferredOrgKey: pinned ? state.preferredOrgKey : "",
    tabUrl: pinned ? pinnedOrg?.tabUrl || "" : state.launchTabUrl || "",
    useLaunchContext: !pinned
  });

  if (!res.ok) {
    setOrgBanner(null, null);
    renderSessionSwitcher([]);
  } else {
    state.tab = res.result.tab;
    state.org = res.result.org;
    state.session = res.result.session;
    if (res.result.launchTabUrl) state.launchTabUrl = res.result.launchTabUrl;
    setOrgBanner(state.org, state.session);
    // Paint Active session immediately with the current org — don't wait for full scan.
    renderSessionSwitcher(state.availableOrgs || []);
  }

  // Enumerate other open sandboxes/orgs in parallel with workbench hydrate.
  // Light list (cookie presence only) should resolve quickly.
  const listPromise = (async () => {
    let list = [];
    try {
      const listRes = await send("listSalesforceOrgs");
      list = listRes.ok && Array.isArray(listRes.result) ? listRes.result : [];
    } catch {
      list = [];
    }
    state.availableOrgs = list;

    if (pinned && state.preferredOrgKey && !findOrgInList(list, { orgKey: state.preferredOrgKey })) {
      await savePreferredOrgKey("", { pinned: false });
    }

    // Sync preferredOrgKey to the org actually loaded (for switcher + workbench keys).
    const matched = findOrgInList(list, {
      orgKey: state.sessionPinned ? state.preferredOrgKey : "",
      org: state.org,
      session: state.session,
      tabUrl: state.tab?.url || state.launchTabUrl || ""
    });
    if (matched?.orgKey) {
      state.preferredOrgKey = matched.orgKey;
      if (state.sessionPinned) {
        try {
          await chrome.storage.local.set({ preferredOrgKey: matched.orgKey, sessionPinned: true });
        } catch {
          /* ignore */
        }
      }
    }

    setOrgBanner(state.org, state.session);
    renderSessionSwitcher(list);
  })();

  await Promise.all([listPromise, refreshSoqlLibrary(), refreshWorkbench()]);
}

function currentOrgKey() {
  return (
    state.preferredOrgKey ||
    state.session?.userInfo?.organization_id ||
    state.org?.myDomain ||
    state.org?.hostname ||
    "default"
  );
}

function fillApexSnippets() {
  const select = $("#apexSnippet");
  if (!select) return;
  select.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Choose a snippet…";
  select.appendChild(blank);
  for (const s of APEX_SNIPPETS) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    select.appendChild(opt);
  }
}

async function refreshSoqlLibrary() {
  try {
    state.soqlLibrary = await listSavedSoql(currentOrgKey());
  } catch {
    state.soqlLibrary = [];
  }
  renderSoqlLibrary();
}

function renderSoqlLibrary() {
  renderWorkbenchPinned();
  const root = $("#soqlLibraryList");
  const hint = $("#soqlLibraryHint");
  if (!root) return;
  const filter = ($("#soqlLibraryFilter")?.value || "").trim().toLowerCase();
  const rows = state.soqlLibrary.filter((r) => {
    if (!filter) return true;
    return `${r.name} ${r.soql}`.toLowerCase().includes(filter);
  });
  if (hint) {
    hint.textContent = `Org key: ${currentOrgKey()} · ${state.soqlLibrary.length} saved (local only).`;
  }
  root.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "query-empty";
    empty.textContent = filter ? "No saved queries match this filter." : "No saved queries yet. Run one and click Save to library.";
    root.appendChild(empty);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "pkg-item soql-lib-item";
    const main = document.createElement("div");
    main.className = "soql-lib-main";
    const title = document.createElement("strong");
    title.textContent = `${row.pinned ? "★ " : ""}${row.name}${row.apiMode === "tooling" ? " · Tooling" : ""}`;
    const preview = document.createElement("code");
    preview.textContent = row.soql.length > 120 ? `${row.soql.slice(0, 117)}…` : row.soql;
    main.appendChild(title);
    main.appendChild(document.createElement("br"));
    main.appendChild(preview);

    const actions = document.createElement("div");
    actions.className = "soql-lib-actions";
    const mkBtn = (label, cls, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls || "btn";
      b.textContent = label;
      b.addEventListener("click", onClick);
      return b;
    };
    actions.appendChild(
      mkBtn("Load", "btn", () => {
        $("#soqlInput").value = row.soql;
        $("#soqlSaveName").value = row.name;
        if ($("#soqlApiMode")) $("#soqlApiMode").value = row.apiMode === "tooling" ? "tooling" : "rest";
        state.editingSoqlId = row.id;
        setQueryStatus($("#soqlQueryStatus"), `Loaded “${row.name}”.`, "ok");
        onSoqlApiModeChange().catch(() => {});
        refreshSoqlSuggestions();
      })
    );
    actions.appendChild(
      mkBtn("Run", "btn primary", async () => {
        $("#soqlInput").value = row.soql;
        $("#soqlSaveName").value = row.name;
        if ($("#soqlApiMode")) $("#soqlApiMode").value = row.apiMode === "tooling" ? "tooling" : "rest";
        state.editingSoqlId = row.id;
        await runSoqlManual();
      })
    );
    actions.appendChild(
      mkBtn(row.pinned ? "Unpin" : "Pin", "btn ghost", async () => {
        state.soqlLibrary = await togglePinnedSoql(currentOrgKey(), row.id);
        renderSoqlLibrary();
      })
    );
    actions.appendChild(
      mkBtn("Delete", "btn danger", async () => {
        if (!confirm(`Delete saved query “${row.name}”?`)) return;
        state.soqlLibrary = await deleteSavedSoql(currentOrgKey(), row.id);
        if (state.editingSoqlId === row.id) state.editingSoqlId = null;
        renderSoqlLibrary();
      })
    );
    item.appendChild(main);
    item.appendChild(actions);
    root.appendChild(item);
  }
}

async function onSaveSoqlToLibrary() {
  const status = $("#soqlQueryStatus");
  try {
    const name = ($("#soqlSaveName").value || "").trim() || guessSoqlName($("#soqlInput").value);
    state.soqlLibrary = await saveSoqlEntry(currentOrgKey(), {
      id: state.editingSoqlId,
      name,
      soql: $("#soqlInput").value,
      apiMode: soqlApiMode()
    });
    $("#soqlSaveName").value = name;
    const match = state.soqlLibrary.find((r) => r.name === name && r.soql === String($("#soqlInput").value).trim());
    state.editingSoqlId = match?.id || state.editingSoqlId;
    renderSoqlLibrary();
    setQueryStatus(status, `Saved “${name}” to library.`, "ok");
  } catch (e) {
    setQueryStatus(status, e.message, "error");
  }
}

function guessSoqlName(soql) {
  const m = String(soql || "").match(/\bFROM\s+([A-Za-z][A-Za-z0-9_]*)/i);
  return m ? `${m[1]} query` : `Query ${new Date().toLocaleString()}`;
}

async function onRunAnonApex() {
  const box = $("#anonApexResult");
  const debug = $("#anonApexDebug");
  box.innerHTML = `<div class="summary-bar">Executing…</div>`;
  debug.textContent = "";
  const apex = $("#anonApexInput").value;
  try {
    const res = await send("executeAnonymous", {
      tabUrl: await requireTabUrl(),
      apex,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    const summary = summarizeExecuteAnonymous(res.result);
    box.innerHTML = `<div class="finding ${summary.ok ? "info" : "high"}">
      <span class="tag">${summary.ok ? "success" : "failed"}</span>
      <strong>${escapeHtml(summary.summary)}</strong>
      <p>${escapeHtml(summary.detail || "")}</p>
    </div>
    <div class="finding info"><strong>Raw</strong><pre class="inline-pre">${escapeHtml(
      JSON.stringify(res.result, null, 2)
    )}</pre></div>`;
    await trackActivity({
      type: "apex",
      title: summary.ok ? "Anonymous Apex" : "Anonymous Apex (failed)",
      detail: String(apex).replace(/\s+/g, " ").trim(),
      view: "anon-apex",
      payload: { apex }
    });
  } catch (e) {
    box.innerHTML = `<div class="finding high"><span class="tag">error</span><strong>${escapeHtml(
      e.message
    )}</strong></div>`;
  }
}

async function onFetchAnonDebug() {
  const debug = $("#anonApexDebug");
  const box = $("#anonApexResult");
  debug.textContent = "Fetching latest Apex log…";
  try {
    const res = await send("fetchLatestApexDebug", {
      tabUrl: await requireTabUrl(),
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    const extracted = extractDebugOutput(res.result.body);
    const header = `Log ${res.result.logId} · ${res.result.startTime || ""} · ${extracted.debugCount} USER_DEBUG`;
    debug.textContent = extracted.preview
      ? `${header}\n\n${extracted.preview}`
      : `${header}\n\nNo USER_DEBUG / FATAL_ERROR lines found in the latest log.\n\n${String(res.result.body || "").slice(0, 2000)}`;
    if (box && !box.innerHTML.includes("finding")) {
      box.innerHTML = `<div class="summary-bar">${escapeHtml(header)}</div>`;
    }
  } catch (e) {
    debug.textContent = e.message;
  }
}

function setOrgBanner(org, session) {
  const banner = $("#orgBanner");
  const pill = $("#envPill");
  const host = $("#orgHost");
  const meta = $("#orgMeta");
  if (!org) {
    banner.classList.add("muted");
    pill.textContent = "—";
    pill.className = "pill";
    host.textContent = "Open a Salesforce tab";
    meta.textContent = "Org-connected tools need an active Salesforce session. Open sandboxes in Chrome, then pick one under Active session.";
    return;
  }
  banner.classList.remove("muted");
  pill.textContent = org.envLabel;
  pill.className = `pill ${org.isSandbox ? "sandbox" : org.isDevEd ? "deved" : "prod"}`;
  host.textContent = org.hostname;
  const user =
    session?.userInfo?.preferred_username ||
    session?.userInfo?.username ||
    session?.userInfo?.email ||
    session?.userInfo?.name ||
    "";
  const orgId = session?.userInfo?.organization_id || "";
  const multi =
    Array.isArray(state.availableOrgs) && state.availableOrgs.length > 1
      ? ` · ${state.availableOrgs.length} sessions — use Active session to switch`
      : "";
  meta.textContent = [user, orgId ? `Org: ${orgId}` : "", session?.sid ? "Session: connected" : "Session: navigation only"]
    .filter(Boolean)
    .join(" · ") + multi;
}

function apiVersion() {
  return $("#apiVersion")?.value || DEFAULT_API_VERSION;
}

async function requireTabUrl() {
  if (state.tab?.url && isSalesforceUrl(state.tab.url)) {
    return state.tab.url;
  }
  await refreshOrg();
  if (!state.tab?.url || !isSalesforceUrl(state.tab.url)) {
    throw new Error("Open a logged-in Salesforce tab first.");
  }
  return state.tab.url;
}

/* —— Features —— */

async function onGenSoql() {
  const out = $("#nlSoqlOut");
  const status = $("#nlQueryStatus");
  setStatusMessage(out, "Generating…", "busy");
  setQueryStatus(status, "", "info");
  try {
    const apiMode = nlApiMode();
    let sobjects = await loadNlSObjects(apiMode);
    const result = await generateSoql($("#nlInput").value, { sobjects, apiMode });
    state.lastGenSoql = result.soql;
    state.lastGenApiMode = result.apiMode || apiMode;
    setStatusMessage(
      out,
      `${result.soql}\n\n// source: ${result.source}\n// api: ${state.lastGenApiMode}\n${result.notes
        .map((n) => `// ${n}`)
        .join("\n")}`,
      "ok"
    );
    setQueryStatus(status, "SOQL ready — click Run to execute against your org session.", "ok");
  } catch (e) {
    setStatusMessage(out, e.message, "error");
    setQueryStatus(status, e.message, "error");
  }
}

function nlApiMode() {
  return $("#nlApiMode")?.value === "tooling" ? "tooling" : "rest";
}

async function loadNlSObjects(apiMode) {
  const tooling = apiMode === "tooling";
  if (tooling) {
    if (Array.isArray(state.toolingObjects) && state.toolingObjects.length && typeof state.toolingObjects[0] !== "string") {
      return state.toolingObjects;
    }
  } else if (Array.isArray(state.globalObjects) && state.globalObjects.length && typeof state.globalObjects[0] !== "string") {
    return state.globalObjects;
  }

  const out = $("#nlSoqlOut");
  if (out) out.textContent = tooling ? "Loading Tooling objects…" : "Loading org objects…";
  const res = await send("describeGlobal", {
    tabUrl: await requireTabUrl(),
    apiVersion: apiVersion(),
    tooling
  });
  if (!res.ok) throw new Error(res.error);
  const sobjects = res.result?.sobjects || [];
  if (tooling) state.toolingObjects = sobjects;
  else {
    state.globalObjects = sobjects;
    fillDescribeObjectDatalist(sobjects);
  }
  return sobjects;
}

async function onRunGenSoql() {
  const panel = $("#nlQueryPanel");
  const status = $("#nlQueryStatus");
  if (!state.lastGenSoql) {
    clearQueryResult(panel, status, "nl", "Generate a query first.", "info");
    return;
  }
  clearQueryResult(panel, status, "nl", "Running…", "busy");
  try {
    const tooling = state.lastGenApiMode === "tooling";
    const res = await send(tooling ? "toolingQuery" : "runSoql", {
      tabUrl: await requireTabUrl(),
      query: state.lastGenSoql,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    renderQueryResult(panel, status, "nl", res.result, state.lastGenSoql, { tooling });
  } catch (e) {
    clearQueryResult(panel, status, "nl", e.message, "error");
  }
}

async function onLoadFlows() {
  $("#flowOut").innerHTML = `<div class="summary-bar">Loading flows…</div>`;
  try {
    const res = await send("listFlows", { tabUrl: await requireTabUrl(), apiVersion: apiVersion() });
    if (!res.ok) throw new Error(res.error);
    const report = analyzeFlow(res.result);
    renderFlowReport(report);
  } catch (e) {
    $("#flowOut").innerHTML = `<div class="finding high"><span class="tag">error</span><strong>${escapeHtml(e.message)}</strong></div>`;
  }
}

function renderFlowReport(report) {
  $("#flowOut").innerHTML =
    `<div class="summary-bar">${escapeHtml(report.summary)}</div>` +
    report.findings
      .map(
        (f) => `<div class="finding ${f.severity}">
      <span class="tag">${f.severity}</span>
      <strong>${escapeHtml(f.rule)} · ${escapeHtml(f.flow)}</strong>
      <p>${escapeHtml(f.detail)}</p>
    </div>`
      )
      .join("");
}

function renderGovernor(report) {
  const meters = report.estimates
    .map(
      (e) => `<div class="finding ${e.risk}">
      <div class="meter ${e.risk}"><span>${escapeHtml(e.name)}</span>
      <div class="bar"><i style="width:${e.pct}%"></i></div>
      <span>${e.used}/${e.max}</span></div>
    </div>`
    )
    .join("");
  const risks = report.risks
    .map((r) => `<div class="finding ${r.level}"><span class="tag">${r.level}</span><p>${escapeHtml(r.msg)}</p></div>`)
    .join("");
  const advice = `<div class="finding info"><strong>Advice</strong><ul>${report.advice
    .map((a) => `<li>${escapeHtml(a)}</li>`)
    .join("")}</ul></div>`;
  $("#govOut").innerHTML = `<div class="summary-bar">${escapeHtml(report.summary)}</div>${meters}${risks}${advice}`;
}

function renderError(report) {
  const matches = (report.matches || [])
    .map(
      (m) => `<div class="finding high">
      <span class="tag">${escapeHtml(m.id)}</span>
      <strong>${escapeHtml(m.title)}</strong>
      <p>${escapeHtml(m.meaning)}</p>
      <ul>${m.fixes.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
    </div>`
    )
    .join("");
  const tips = (report.tips || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  const ai = report.ai
    ? `<div class="finding info"><strong>AI assist</strong><p>${escapeHtml(report.ai)}</p></div>`
    : report.aiError
      ? `<div class="finding medium"><strong>AI</strong><p>${escapeHtml(report.aiError)}</p></div>`
      : "";
  $("#errOut").innerHTML = `<div class="summary-bar">${escapeHtml(report.summary)}</div>${matches}${
    tips ? `<div class="finding info"><ul>${tips}</ul></div>` : ""
  }${ai}`;
}

function renderLog(report) {
  const limits = report.limits
    .map(
      (l) => `<div class="finding ${l.risk}">
      <div class="meter ${l.risk}"><span>${escapeHtml(l.key)}</span>
      <div class="bar"><i style="width:${l.pct}%"></i></div>
      <span>${l.used}/${l.max}</span></div>
    </div>`
    )
    .join("");
  const ex = report.exceptions.length
    ? `<div class="finding high"><strong>Exceptions</strong><ul>${report.exceptions
        .map((e) => `<li><code>${escapeHtml(e)}</code></li>`)
        .join("")}</ul></div>`
    : "";
  const soql = report.soql.length
    ? `<div class="finding info"><strong>SOQL</strong><ul>${report.soql
        .map((s) => `<li><code>${escapeHtml(s)}</code></li>`)
        .join("")}</ul></div>`
    : "";
  const warnings = report.warnings.length
    ? `<div class="finding medium"><strong>Warnings</strong><ul>${report.warnings
        .map((w) => `<li>${escapeHtml(w)}</li>`)
        .join("")}</ul></div>`
    : "";
  $("#logOut").innerHTML = `<div class="summary-bar">${escapeHtml(report.summary)}</div>${limits}${ex}${soql}${warnings}`;
}

async function onBuildFormula() {
  const out = $("#formulaOut");
  out.textContent = "Building…";
  try {
    const result = await buildFormula($("#formulaInput").value);
    state.lastFormula = result.formula;
    out.textContent = `${result.formula}\n\n// source: ${result.source}\n${result.notes.map((n) => `// ${n}`).join("\n")}`;
  } catch (e) {
    out.textContent = e.message;
  }
}

function renderFormulaHelpers() {
  $("#formulaHelpers").innerHTML = FORMULA_HELPERS.map(
    (h) => `<div><code>${escapeHtml(h.fn)}</code> — ${escapeHtml(h.desc)}</div>`
  ).join("");
}

async function onInvestigatePerms() {
  const userKey = $("#permUser").value.trim();
  const objectApiName = $("#permObject").value.trim();
  if (!userKey || !objectApiName) {
    $("#permOut").innerHTML = `<div class="finding medium"><p>User and object API name are required.</p></div>`;
    return;
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(objectApiName)) {
    $("#permOut").innerHTML = `<div class="finding high"><p>Invalid object API name.</p></div>`;
    return;
  }
  $("#permOut").innerHTML = `<div class="summary-bar">Investigating…</div>`;
  try {
    const tabUrl = await requireTabUrl();
    const qs = buildPermissionQueries(userKey, objectApiName);
    const userRes = await send("runSoql", { tabUrl, query: qs.user, apiVersion: apiVersion() });
    if (!userRes.ok) throw new Error(userRes.error);
    const user = userRes.result.records?.[0];
    if (!user) throw new Error("User not found");

    const fill = (q) => q.replaceAll("{USER_ID}", user.Id);
    const [assignRes, objRes, fieldRes, describeRes] = await Promise.all([
      send("runSoql", { tabUrl, query: fill(qs.assignments), apiVersion: apiVersion() }),
      send("runSoql", { tabUrl, query: fill(qs.objectPerms), apiVersion: apiVersion() }),
      send("runSoql", { tabUrl, query: fill(qs.fieldPerms), apiVersion: apiVersion() }),
      send("describeSObject", { tabUrl, sobject: objectApiName, apiVersion: apiVersion() })
    ]);

    const report = analyzePermissions({
      user,
      objectApiName,
      objectDescribe: describeRes.ok ? describeRes.result : null,
      objectPerms: objRes.ok ? objRes.result.records || [] : [],
      fieldPerms: fieldRes.ok ? fieldRes.result.records || [] : [],
      assignments: assignRes.ok ? assignRes.result.records || [] : []
    });

    $("#permOut").innerHTML =
      `<div class="summary-bar">${escapeHtml(report.summary)}</div>` +
      report.findings
        .map(
          (f) => `<div class="finding ${f.severity}"><span class="tag">${f.severity}</span><strong>${escapeHtml(f.title)}</strong><p>${escapeHtml(f.detail)}</p></div>`
        )
        .join("");
  } catch (e) {
    $("#permOut").innerHTML = `<div class="finding high"><strong>Error</strong><p>${escapeHtml(e.message)}</p></div>`;
  }
}

async function onReviewApex() {
  $("#apexOut").innerHTML = `<div class="summary-bar">Reviewing…</div>`;
  try {
    const report = await reviewApex($("#apexInput").value);
    const findings = report.findings
      .map(
        (f) => `<div class="finding ${f.severity}">
        <span class="tag">${f.severity}${f.lineHint ? ` · line ${f.lineHint}` : ""}</span>
        <strong>${escapeHtml(f.rule)}</strong>
        <p>${escapeHtml(f.detail)}</p>
      </div>`
      )
      .join("");
    const ai = report.ai
      ? `<div class="finding info"><strong>AI review</strong><p>${escapeHtml(report.ai)}</p></div>`
      : "";
    $("#apexOut").innerHTML = `<div class="summary-bar">${escapeHtml(report.summary)}</div>${findings}${ai}`;
  } catch (e) {
    $("#apexOut").innerHTML = `<div class="finding high"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

async function searchApexClasses(query) {
  const status = $("#apexClassStatus");
  const root = $("#apexClassList");
  if (status) status.textContent = "Loading Apex classes…";
  if (root) root.innerHTML = `<div class="query-empty">Loading…</div>`;
  try {
    await ensureSalesforceSiteAccess();
    const res = await send("listApexClasses", {
      tabUrl: await requireTabUrl(),
      query: query || "",
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    state.apexClassResults = res.result.records || [];
    renderApexClassList();
    if (status) {
      status.textContent = `Loaded ${state.apexClassResults.length} class(es)${query ? ` for “${query}”` : ""}.`;
    }
  } catch (e) {
    state.apexClassResults = [];
    if (root) root.innerHTML = "";
    if (status) status.textContent = e.message;
  }
}

function renderApexClassList() {
  const root = $("#apexClassList");
  if (!root) return;
  root.replaceChildren();
  if (!state.apexClassResults.length) {
    const empty = document.createElement("div");
    empty.className = "query-empty";
    empty.textContent = "No Apex classes found.";
    root.appendChild(empty);
    return;
  }
  for (const row of state.apexClassResults) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "describe-item";
    const ns = row.namespace ? `${row.namespace}.` : "";
    btn.innerHTML = `<strong>${escapeHtml(ns + row.name)}</strong>
      <span>${escapeHtml(row.lastModifiedDate || "")}${row.apiVersion != null ? ` · API ${escapeHtml(String(row.apiVersion))}` : ""}</span>`;
    btn.addEventListener("click", () => loadApexClassForReview(row.id, ns + row.name));
    root.appendChild(btn);
  }
}

async function loadApexClassForReview(id, label) {
  const status = $("#apexClassStatus");
  if (status) status.textContent = `Loading ${label}…`;
  try {
    await ensureSalesforceSiteAccess();
    const res = await send("getApexClassBody", {
      tabUrl: await requireTabUrl(),
      id,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    $("#apexInput").value = res.result.body || "";
    if (status) status.textContent = `Loaded ${res.result.name} (${(res.result.body || "").length} chars). Click Review.`;
    $("#apexOut").innerHTML = "";
  } catch (e) {
    if (status) status.textContent = e.message;
  }
}

async function loadOrgLimits() {
  const status = $("#orgLimitsStatus");
  const out = $("#orgLimitsOut");
  if (status) status.textContent = "Loading org limits…";
  try {
    await ensureSalesforceSiteAccess();
    const res = await send("getOrgLimits", {
      tabUrl: await requireTabUrl(),
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    state.orgLimits = res.result;
    const summary = summarizeOrgLimits(res.result);
    renderOrgLimits(summary);
    if (status) status.textContent = summary.summary;
  } catch (e) {
    state.orgLimits = null;
    if (out) out.innerHTML = `<div class="finding high"><p>${escapeHtml(e.message)}</p></div>`;
    if (status) status.textContent = e.message;
  }
}

function renderOrgLimits(summary) {
  const out = $("#orgLimitsOut");
  if (!out) return;
  // Show preferred limits first; keep list readable (top 18 by risk then name)
  const rows = [...summary.rows].sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    const d = (rank[a.risk] ?? 9) - (rank[b.risk] ?? 9);
    if (d !== 0) return d;
    return a.label.localeCompare(b.label);
  }).slice(0, 18);

  out.innerHTML =
    `<div class="summary-bar">${escapeHtml(summary.summary)}</div>` +
    rows
      .map((r) => {
        const usedLabel =
          r.used != null && r.remaining != null
            ? `${r.used.toLocaleString()} / ${r.max.toLocaleString()} used · ${r.remaining.toLocaleString()} left`
            : `Max ${r.max.toLocaleString()}`;
        const pct = r.pct != null ? `${r.pct}%` : "";
        return `<div class="finding ${r.risk}">
          <div class="meter ${r.risk}"><span>${escapeHtml(r.label)}</span>
          <div class="bar"><i style="width:${Math.min(r.pct || 0, 100)}%"></i></div>
          <span>${escapeHtml(pct)}</span></div>
          <p>${escapeHtml(usedLabel)}</p>
        </div>`;
      })
      .join("");
}

/* —— Describe / Metadata / Package.xml —— */

function fillMetaTypeSelect() {
  const sel = $("#metaType");
  sel.innerHTML = `<option value="">All types</option>`;
  METADATA_SEARCH_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label;
    sel.appendChild(opt);
  });
}

function fillPackageTypeSelect() {
  const sel = $("#packageType");
  sel.innerHTML = "";
  PACKAGE_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = t.label;
    sel.appendChild(opt);
  });
}

async function preloadGlobalObjects() {
  try {
    const res = await send("describeGlobal", { tabUrl: await requireTabUrl(), apiVersion: apiVersion() });
    if (!res.ok) return;
    const sobjects = res.result.sobjects || [];
    state.globalObjects = sobjects;
    fillDescribeObjectDatalist(sobjects);
    fillPermObjectDatalist(sobjects);
  } catch {
    /* optional */
  }
}

function normalizeDescribeObjects(sobjects) {
  return (sobjects || [])
    .map((s) => {
      if (typeof s === "string") return { name: s, label: s, custom: /__c$|__mdt$/i.test(s) };
      if (!s?.name) return null;
      return {
        name: s.name,
        label: s.label || s.name,
        labelPlural: s.labelPlural || s.pluralLabel || "",
        custom: !!s.custom || /__c$|__mdt$|__e$|__b$|__x$/i.test(s.name)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function fillDescribeObjectDatalist(sobjects) {
  state.describeObjects = normalizeDescribeObjects(sobjects);
  const list = $("#describeObjectList");
  if (list) {
    // Include every standard + custom object (no 500 cap) so custom APIs are searchable.
    list.innerHTML = state.describeObjects
      .map((o) => `<option value="${escapeHtml(o.name)}" label="${escapeHtml(o.label)}"></option>`)
      .join("");
  }
  const summary = $("#describeObjectHint");
  if (summary) {
    const customCount = state.describeObjects.filter((o) => o.custom).length;
    summary.textContent = `${state.describeObjects.length} objects loaded (${customCount} custom) — search by API name or label.`;
  }
  fillSchemaObjectDatalist();
}

function fillSchemaObjectDatalist() {
  const list = $("#schemaObjectList");
  const hint = $("#schemaObjectHint");
  const filtered = filterSchemaObjects(
    (state.globalObjects || state.describeObjects || []).map((s) =>
      typeof s === "string"
        ? { name: s, label: s, custom: /__c$|__mdt$/i.test(s), queryable: true }
        : s
    ),
    state.schemaFilter || "all"
  );
  const normalized = normalizeDescribeObjects(filtered);
  if (list) {
    list.innerHTML = normalized
      .map((o) => `<option value="${escapeHtml(o.name)}" label="${escapeHtml(o.label)}"></option>`)
      .join("");
  }
  if (hint) {
    const mdt = normalized.filter((o) => /__mdt$/i.test(o.name)).length;
    const custom = normalized.filter((o) => /__c$/i.test(o.name)).length;
    hint.textContent = `${normalized.length} objects in filter · ${custom} custom (__c) · ${mdt} metadata (__mdt)`;
  }
}

function bindSchemaExplorer() {
  $("#loadSchema")?.addEventListener("click", () => onLoadSchema().catch(() => {}));
  $("#schemaObjectSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onLoadSchema().catch(() => {});
  });
  document.querySelectorAll("[data-schema-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.schemaFilter = btn.getAttribute("data-schema-filter") || "all";
      document.querySelectorAll("[data-schema-filter]").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      fillSchemaObjectDatalist();
      renderSchemaObjectSuggest();
    });
  });
  const input = $("#schemaObjectSearch");
  const host = $("#schemaObjectSuggest");
  if (input && host) {
    const paint = () => renderSchemaObjectSuggest();
    input.addEventListener("input", paint);
    input.addEventListener("focus", paint);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideSchemaObjectSuggest();
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest?.("#schemaObjectSearch") && !e.target.closest?.("#schemaObjectSuggest")) {
        hideSchemaObjectSuggest();
      }
    });
  }
  bindSchemaCanvasControls();
}

function hideSchemaObjectSuggest() {
  const host = $("#schemaObjectSuggest");
  if (!host) return;
  host.classList.add("hidden");
  host.replaceChildren();
}

function schemaObjectUniverse() {
  const raw = state.globalObjects?.length ? state.globalObjects : state.describeObjects || [];
  return filterSchemaObjects(
    raw.map((s) =>
      typeof s === "string"
        ? { name: s, label: s, custom: /__c$|__mdt$/i.test(s), queryable: true }
        : s
    ),
    state.schemaFilter || "all"
  );
}

function renderSchemaObjectSuggest() {
  const input = $("#schemaObjectSearch");
  const host = $("#schemaObjectSuggest");
  if (!input || !host) return;
  const q = (input.value || "").trim();
  if (!q) {
    hideSchemaObjectSuggest();
    return;
  }
  const scored = [];
  for (const o of schemaObjectUniverse()) {
    const score = scoreSchemaObject(o, q);
    if (score > 0) scored.push({ o, score });
  }
  scored.sort((a, b) => b.score - a.score || String(a.o.name).localeCompare(String(b.o.name)));
  const top = scored.slice(0, 12);
  if (!top.length) {
    hideSchemaObjectSuggest();
    return;
  }
  host.classList.remove("hidden");
  host.innerHTML = top
    .map(({ o }) => {
      const kind = objectKind(o.name, !!o.custom);
      return `<button type="button" class="soql-suggest-item" role="option" data-name="${escapeHtml(o.name)}">
        <strong>${escapeHtml(o.name)}</strong>
        <span>${escapeHtml(o.label || o.name)} · ${escapeHtml(kind)}</span>
      </button>`;
    })
    .join("");
  host.querySelectorAll("[data-name]").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.getAttribute("data-name") || "";
      hideSchemaObjectSuggest();
      onLoadSchema({ resetTrail: true }).catch(() => {});
    });
  });
}

function bindSchemaCanvasControls() {
  $("#schemaZoomIn")?.addEventListener("click", () => {
    state.schemaView.scale = Math.min(1.8, (state.schemaView.scale || 1) * 1.15);
    applySchemaViewTransform();
  });
  $("#schemaZoomOut")?.addEventListener("click", () => {
    state.schemaView.scale = Math.max(0.45, (state.schemaView.scale || 1) / 1.15);
    applySchemaViewTransform();
  });
  $("#schemaZoomReset")?.addEventListener("click", () => {
    fitSchemaView();
  });
  $("#schemaResetLayout")?.addEventListener("click", () => {
    state.schemaCardPositions = {};
    state.schemaHighlightedEdgeId = "";
    renderSchemaExplorer();
    requestAnimationFrame(() => {
      drawSchemaLines();
      fitSchemaView();
    });
  });
  $("#schemaToggleSimple")?.addEventListener("click", () => {
    state.schemaSimpleMode = !state.schemaSimpleMode;
    renderSchemaExplorer();
    requestAnimationFrame(() => drawSchemaLines());
  });
  $("#schemaTogglePerms")?.addEventListener("click", () => {
    state.schemaPermDrawerOpen = !state.schemaPermDrawerOpen;
    applySchemaPermDrawer();
  });
  $("#schemaPermClose")?.addEventListener("click", () => {
    state.schemaPermDrawerOpen = false;
    applySchemaPermDrawer();
  });

  if (!document.documentElement.dataset.schemaFieldMenuBound) {
    document.documentElement.dataset.schemaFieldMenuBound = "1";
    document.addEventListener("click", (e) => {
      if (e.target.closest?.("#schemaFieldMenu") || e.target.closest?.(".sb-field[data-field]")) return;
      hideSchemaFieldMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideSchemaFieldMenu();
    });
  }

  const viewport = $("#schemaViewport");
  if (!viewport || viewport.dataset.bound === "1") return;
  viewport.dataset.bound = "1";

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  viewport.addEventListener("pointerdown", (e) => {
    if (state.schemaMovingCard) return;
    if (e.target.closest?.(".sb-card") || e.target.closest?.("button") || e.target.closest?.(".sb-line-hit")) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    viewport.setPointerCapture?.(e.pointerId);
    viewport.classList.add("is-panning");
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!dragging || state.schemaMovingCard) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    state.schemaView.x += dx;
    state.schemaView.y += dy;
    applySchemaViewTransform();
  });
  const endDrag = () => {
    dragging = false;
    viewport.classList.remove("is-panning");
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.08 : 1.08;
      state.schemaView.scale = Math.min(1.8, Math.max(0.45, (state.schemaView.scale || 1) * factor));
      applySchemaViewTransform();
    },
    { passive: false }
  );
}

function applySchemaViewTransform() {
  const world = $("#schemaWorld");
  if (!world) return;
  const { x = 0, y = 0, scale = 1 } = state.schemaView || {};
  world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function fitSchemaView() {
  const viewport = $("#schemaViewport");
  const cards = $("#schemaCards");
  if (!viewport || !cards) return;
  const nodes = [...cards.querySelectorAll(".sb-card")];
  if (!nodes.length) {
    state.schemaView = { x: 40, y: 24, scale: 1 };
    applySchemaViewTransform();
    return;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const left = Number(n.style.left.replace("px", "")) || 0;
    const top = Number(n.style.top.replace("px", "")) || 0;
    const w = n.offsetWidth || 260;
    const h = n.offsetHeight || 220;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + w);
    maxY = Math.max(maxY, top + h);
  }
  const pad = 48;
  const vw = viewport.clientWidth || 800;
  const vh = viewport.clientHeight || 520;
  const bw = Math.max(1, maxX - minX + pad * 2);
  const bh = Math.max(1, maxY - minY + pad * 2);
  const scale = Math.min(1.15, Math.max(0.5, Math.min(vw / bw, vh / bh)));
  state.schemaView = {
    scale,
    x: (vw - bw * scale) / 2 - (minX - pad) * scale,
    y: (vh - bh * scale) / 2 - (minY - pad) * scale
  };
  applySchemaViewTransform();
}

async function describeSchemaNeighbor(sobject) {
  const cached = state.schemaNeighbors?.[sobject];
  if (cached) return cached;
  try {
    const res = await send("describeSObject", {
      tabUrl: await requireTabUrl(),
      sobject,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    state.schemaNeighbors[sobject] = res.result;
    return res.result;
  } catch {
    const stub = {
      name: sobject,
      label: sobject,
      custom: /__c$|__mdt$/i.test(sobject),
      fields: [],
      childRelationships: [],
      stub: true
    };
    state.schemaNeighbors[sobject] = stub;
    return stub;
  }
}

async function onLoadSchema({ resetTrail = true, sobject: forced } = {}) {
  const input = $("#schemaObjectSearch");
  const sobject = String(forced || input?.value || "").trim();
  if (!sobject) return;
  hideSchemaObjectSuggest();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(sobject)) {
    $("#schemaSummary").textContent = "Invalid object API name.";
    return;
  }
  if (input) input.value = sobject;
  $("#schemaSummary").textContent = "Loading schema canvas…";
  $("#schemaBuilder")?.classList.add("hidden");
  $("#schemaSoqlPreview")?.classList.add("hidden");
  hideSchemaFieldMenu();
  state.schemaHighlightedEdgeId = "";
  try {
    const res = await send("describeSObject", {
      tabUrl: await requireTabUrl(),
      sobject,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    const describe = res.result;
    state.schemaDescribe = describe;
    state.schemaNeighbors = { ...(state.schemaNeighbors || {}), [describe.name]: describe };
    state.schemaParents = extractParentRelations(describe);
    state.schemaChildren = extractChildRelations(describe);
    if (resetTrail) {
      state.schemaTrail = [{ name: describe.name, label: describe.label || describe.name }];
      state.schemaExpanded = {};
      state.schemaCardPositions = {};
    } else {
      const last = state.schemaTrail[state.schemaTrail.length - 1];
      if (!last || last.name !== describe.name) {
        state.schemaTrail = [
          ...state.schemaTrail,
          { name: describe.name, label: describe.label || describe.name }
        ].slice(-12);
      }
    }

    // Prefetch neighbor describes for card field lists (cap for speed).
    const parentNames = [...new Set(state.schemaParents.map((p) => p.targetObject))].slice(0, 6);
    const childNames = [...new Set(state.schemaChildren.map((c) => c.childObject))]
      .filter((n) => n !== describe.name)
      .slice(0, 12);
    $("#schemaSummary").textContent = `${schemaSummary(describe)} · loading related objects…`;
    await Promise.all([...parentNames, ...childNames].map((n) => describeSchemaNeighbor(n)));

    $("#schemaSummary").textContent = schemaSummary(describe);
    renderSchemaExplorer();
    $("#schemaBuilder")?.classList.remove("hidden");
    requestAnimationFrame(() => {
      drawSchemaLines();
      fitSchemaView();
    });
    if (state.schemaAsUser?.Id) {
      ensureSchemaAsUserOverlay(describe.name).then(() => {
        renderSchemaExplorer();
        requestAnimationFrame(() => drawSchemaLines());
      }).catch(() => {});
    }
    await trackActivity({
      type: "describe",
      title: `Schema: ${describe.name}`,
      detail: schemaSummary(describe),
      view: "schema",
      payload: { sobject: describe.name }
    });
  } catch (e) {
    $("#schemaSummary").textContent = e.message || String(e);
  }
}

function currentSchemaOverlay(objectApiName) {
  if (!state.schemaAsUser?.Id) return null;
  const key = objectApiName || state.schemaDescribe?.name;
  if (!key) return null;
  return state.schemaAsUserOverlays?.[key] || null;
}

async function ensureSchemaAsUserOverlay(objectApiName) {
  const user = state.schemaAsUser;
  const sobject = objectApiName || state.schemaDescribe?.name;
  if (!user?.Id || !sobject) return null;
  if (state.schemaAsUserOverlays?.[sobject]) return state.schemaAsUserOverlays[sobject];
  const tabUrl = await requireTabUrl();
  const qs = buildPermissionQueries(user.Id, sobject);
  const fill = (q) => q.replaceAll("{USER_ID}", user.Id);
  const [objRes, fieldRes] = await Promise.all([
    send("runSoql", { tabUrl, query: fill(qs.objectPerms), apiVersion: apiVersion() }),
    send("runSoql", { tabUrl, query: fill(qs.fieldPerms), apiVersion: apiVersion() })
  ]);
  if (!objRes.ok) throw new Error(objRes.error || "ObjectPermissions query failed");
  if (!fieldRes.ok) throw new Error(fieldRes.error || "FieldPermissions query failed");
  const overlay = buildUserPermOverlay({
    user,
    objectApiName: sobject,
    objectPerms: objRes.result?.records || [],
    fieldPerms: fieldRes.result?.records || []
  });
  state.schemaAsUserOverlays = { ...(state.schemaAsUserOverlays || {}), [sobject]: overlay };
  return overlay;
}

async function onLoadSchemaAsUser() {
  const input = $("#schemaAsUserInput");
  const status = $("#schemaAsUserStatus");
  const userKey = String(input?.value || state.schemaAsUserKey || "").trim();
  const objectApiName = state.schemaDescribe?.name;
  if (!userKey) {
    if (status) status.textContent = "Enter a username or user Id.";
    return;
  }
  if (!objectApiName) {
    if (status) status.textContent = "Load an object on the canvas first.";
    return;
  }
  state.schemaAsUserKey = userKey;
  if (status) status.textContent = "Loading permissions…";
  try {
    const tabUrl = await requireTabUrl();
    const qs = buildPermissionQueries(userKey, objectApiName);
    const userRes = await send("runSoql", { tabUrl, query: qs.user, apiVersion: apiVersion() });
    if (!userRes.ok) throw new Error(userRes.error);
    const user = userRes.result?.records?.[0];
    if (!user) throw new Error("User not found");
    state.schemaAsUser = user;
    state.schemaAsUserOverlays = {};
    await ensureSchemaAsUserOverlay(objectApiName);
    if (status) {
      status.textContent = `Showing permissions for ${user.Username || user.Name || user.Id}`;
    }
    renderSchemaExplorer();
    requestAnimationFrame(() => drawSchemaLines());
  } catch (e) {
    if (status) status.textContent = e.message || String(e);
  }
}

function onClearSchemaAsUser() {
  state.schemaAsUserKey = "";
  state.schemaAsUser = null;
  state.schemaAsUserOverlays = {};
  const input = $("#schemaAsUserInput");
  if (input) input.value = "";
  renderSchemaExplorer();
  requestAnimationFrame(() => drawSchemaLines());
}

function renderSchemaExplorer() {
  const describe = state.schemaDescribe;
  if (!describe) return;
  const simple = state.schemaSimpleMode !== false;
  $("#schemaBuilder")?.classList.toggle("is-simple", simple);
  $("#schemaToggleSimple")?.classList.toggle("active", simple);
  const simpleBtn = $("#schemaToggleSimple");
  if (simpleBtn) simpleBtn.textContent = simple ? "Simple" : "Technical";
  const hint = $("#schemaCanvasHint");
  if (hint) {
    hint.textContent = simple
      ? "Drag any tile to move just that tile · empty space pans the map"
      : "Drag a tile to move it · empty space pans · click a line for SOQL";
  }
  renderSchemaBreadcrumb();
  renderSchemaCanvas(describe);
  renderSchemaStory(describe);
  renderSchemaActions(describe);
  renderSchemaPermDrawer(describe);
  applySchemaPermDrawer();
}

function schemaLabelMap(describe) {
  const labels = { [describe.name]: describe.label || describe.name };
  for (const [name, desc] of Object.entries(state.schemaNeighbors || {})) {
    labels[name] = desc?.label || name;
  }
  return labels;
}

function renderSchemaStory(describe, edge = null) {
  const el = $("#schemaRelationStory");
  if (!el || !describe) return;
  const labels = state.schemaLabels || schemaLabelMap(describe);
  if (edge) {
    el.textContent = plainRelationshipSentence(edge, labels);
    el.classList.add("is-focus");
    return;
  }
  el.classList.remove("is-focus");
  el.textContent = schemaStory({
    centerLabel: describe.label || describe.name,
    parentLabels: (state.schemaParents || [])
      .map((p) => labels[p.targetObject] || p.targetObject)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 5),
    childLabels: (state.schemaChildren || [])
      .map((c) => labels[c.childObject] || c.childObject)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 6)
  });
}

function applySchemaPermDrawer() {
  const drawer = $("#schemaPermDrawer");
  const btn = $("#schemaTogglePerms");
  if (!drawer) return;
  const open = state.schemaPermDrawerOpen !== false && !!state.schemaDescribe;
  drawer.hidden = !open;
  btn?.classList.toggle("active", open);
}

function renderSchemaPermDrawer(describe) {
  const body = $("#schemaPermBody");
  if (!body || !describe) return;
  const overlay = currentSchemaOverlay(describe.name);
  const summary = summarizeSessionPermissions(describe, overlay);
  const { access, fieldCounts, blockedEdit } = summary;
  const asUser = state.schemaAsUser;
  const modeLabel = overlay?.mode === "user"
    ? `user <strong>${escapeHtml(overlay.userLabel)}</strong>`
    : "<strong>this browser session</strong>";
  const blockedHtml = blockedEdit.length
    ? `<ul class="schema-perm-list">${blockedEdit
        .map(
          (b) =>
            `<li><code>${escapeHtml(b.name)}</code> — ${escapeHtml(b.reason || "Not editable")}</li>`
        )
        .join("")}</ul>`
    : `<p class="hint">No notable non-editable fields in the first samples.</p>`;

  body.innerHTML = `
    <div class="label" style="margin-top:0">As user (overlay)</div>
    <div class="row wrap" style="gap:6px;margin:6px 0">
      <input type="text" class="input grow" id="schemaAsUserInput" placeholder="Username or Id" value="${escapeHtml(state.schemaAsUserKey || "")}" autocomplete="off" />
    </div>
    <div class="row wrap" style="gap:6px">
      <button type="button" class="btn primary" id="schemaAsUserLoad">Load as user</button>
      <button type="button" class="btn ghost" id="schemaAsUserClear" ${asUser ? "" : "disabled"}>Clear</button>
    </div>
    <p class="hint" id="schemaAsUserStatus">${
      asUser
        ? `Showing permissions for ${escapeHtml(asUser.Username || asUser.Name || asUser.Id)}`
        : "Optional — overlays CRUD/FLS from ObjectPermissions + FieldPermissions."
    }</p>
    <p class="hint">Effective access for ${modeLabel}${
      overlay?.mode === "user"
        ? " (Permission Set / profile-set Object & Field permissions; standard fields fall back to object CRUD)."
        : " (from object describe)."
    }</p>
    <div class="sb-crud-strip large">${crudStripHtml(access)}</div>
    <div class="schema-perm-stats">
      <div><span>${fieldCounts.total}</span> fields</div>
      <div><span>${fieldCounts.readable}</span> readable</div>
      <div><span>${fieldCounts.editable}</span> editable</div>
      <div><span>${fieldCounts.required}</span> required</div>
      <div><span>${fieldCounts.custom}</span> custom</div>
      ${fieldCounts.notReadable ? `<div><span>${fieldCounts.notReadable}</span> not readable</div>` : ""}
    </div>
    <div class="label">Why some fields aren’t editable</div>
    ${blockedHtml}
    <div class="row wrap" style="margin-top:10px;gap:6px">
      <button type="button" class="btn" id="schemaOpenPerms">Open Permission Investigator</button>
      <button type="button" class="btn ghost" id="schemaCopySelectList">Copy readable field list</button>
    </div>
  `;
  $("#schemaAsUserLoad")?.addEventListener("click", () => {
    onLoadSchemaAsUser().catch(() => {});
  });
  $("#schemaAsUserInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onLoadSchemaAsUser().catch(() => {});
    }
  });
  $("#schemaAsUserClear")?.addEventListener("click", onClearSchemaAsUser);
  $("#schemaOpenPerms")?.addEventListener("click", () => {
    const input = $("#permObject");
    const userInput = $("#permUser");
    if (input) input.value = describe.name;
    if (userInput && state.schemaAsUserKey) userInput.value = state.schemaAsUserKey;
    showView("perms");
  });
  $("#schemaCopySelectList")?.addEventListener("click", async () => {
    const names = (describe.fields || [])
      .filter((f) => fieldSchemaBadges(f, overlay).readable)
      .map((f) => f.name)
      .slice(0, 100);
    try {
      await navigator.clipboard.writeText(names.join(", "));
    } catch {
      /* ignore */
    }
  });
}

function renderSchemaBreadcrumb() {
  const nav = $("#schemaBreadcrumb");
  if (!nav) return;
  const trail = state.schemaTrail || [];
  if (trail.length <= 1) {
    nav.innerHTML = trail.length
      ? `<span class="schema-crumb current">${escapeHtml(trail[0].name)}</span>`
      : "";
    return;
  }
  nav.innerHTML = trail
    .map((t, i) => {
      const current = i === trail.length - 1;
      if (current) {
        return `<span class="schema-crumb current">${escapeHtml(t.name)}</span>`;
      }
      return `<button type="button" class="schema-crumb linkish" data-schema-hop="${escapeHtml(t.name)}" data-trail-index="${i}">${escapeHtml(t.name)}</button>`;
    })
    .join('<span class="schema-crumb-sep">→</span>');
  nav.querySelectorAll("[data-schema-hop]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-schema-hop");
      const idx = Number(btn.getAttribute("data-trail-index"));
      if (!name) return;
      if (Number.isFinite(idx)) state.schemaTrail = state.schemaTrail.slice(0, idx + 1);
      onLoadSchema({ resetTrail: false, sobject: name }).catch(() => {});
    });
  });
}

function renderSchemaCanvas(describe) {
  const cardsHost = $("#schemaCards");
  const lines = $("#schemaLines");
  if (!cardsHost || !lines) return;

  const parentNames = [...new Set((state.schemaParents || []).map((p) => p.targetObject))].slice(0, 6);
  const childNames = [...new Set((state.schemaChildren || []).map((c) => c.childObject))]
    .filter((n) => n !== describe.name)
    .slice(0, 12);

  const positions = layoutSchemaGraph({
    centerName: describe.name,
    parentNames,
    childNames,
    cardWidth: 280,
    gapX: 72,
    gapY: 96,
    centerY: 340,
    rowSize: 4,
    cardHeight: 250
  });

  // Normalize so min x/y start near 0 for easier fitting.
  let minX = Infinity;
  let minY = Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;
  const offsetX = 48 - minX;
  const offsetY = 48 - minY;
  const saved = state.schemaCardPositions || {};

  cardsHost.replaceChildren();
  for (const [name, pos] of positions.entries()) {
    const desc =
      name === describe.name ? describe : state.schemaNeighbors?.[name] || { name, label: name, fields: [] };
    const card = buildSchemaCard(desc, pos.role === "center", pos.role);
    const x = Number.isFinite(saved[name]?.x) ? saved[name].x : pos.x + offsetX;
    const y = Number.isFinite(saved[name]?.y) ? saved[name].y : pos.y + offsetY;
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    cardsHost.appendChild(card);
  }

  const labels = schemaLabelMap(describe);
  state.schemaLabels = labels;
  state._schemaEdges = buildGraphEdges({
    centerName: describe.name,
    parents: (state.schemaParents || []).filter((p) => parentNames.includes(p.targetObject)),
    children: (state.schemaChildren || []).filter((c) => childNames.includes(c.childObject)),
    labels
  });
  state._schemaLayoutOffset = { x: offsetX, y: offsetY };
}

function buildSchemaCard(describe, isCenter, role = "center") {
  const kind = objectKind(describe.name, !!describe.custom);
  const expanded = !!state.schemaExpanded?.[describe.name];
  const simple = state.schemaSimpleMode !== false;
  const fields = pickCardFields(describe, { max: isCenter ? 12 : 8, expanded });
  const total = describe.fields?.length || 0;
  const overlay = isCenter ? currentSchemaOverlay(describe.name) : null;
  const access = overlay?.mode === "user" ? overlay.objectAccess : sessionObjectAccess(describe);
  const labels = state.schemaLabels || {};
  const card = document.createElement("div");
  card.className = `sb-card ${objectKindClass(kind)}${isCenter ? " is-center" : ""}${
    overlay?.mode === "user" ? " has-as-user" : ""
  }`;
  card.dataset.object = describe.name;
  card.dataset.role = role;
  const crudTitle =
    overlay?.mode === "user"
      ? `Access for ${overlay.userLabel}`
      : "What you can do with this record type";
  const crudHtml = isCenter
    ? simple
      ? `<div class="sb-access-line" title="${escapeHtml(crudTitle)}">${escapeHtml(friendlyAccessLine(access))}</div>`
      : `<div class="sb-crud-strip" title="${escapeHtml(crudTitle)}">${crudStripHtml(access)}</div>`
    : "";
  card.innerHTML = `
    <div class="sb-card-head">
      <span class="sb-drag-handle" title="Drag to move this tile" aria-hidden="true"></span>
      <div class="sb-card-titles">
        <span class="sb-role-pill">${escapeHtml(friendlyRoleLabel(role))}</span>
        <strong>${escapeHtml(describe.label || describe.name)}</strong>
        <span class="sb-kind">${escapeHtml(simple ? friendlyObjectKind(kind) : kind)}</span>
        ${
          simple
            ? ""
            : `<span class="sb-api" title="${escapeHtml(describe.name)}">${escapeHtml(describe.name)}</span>`
        }
      </div>
    </div>
    ${crudHtml}
    <div class="sb-fields">
      ${
        fields.length
          ? fields
              .map((f) => {
                const badges = fieldSchemaBadges(f, overlay);
                const rel = f.referenceTo?.length ? " is-rel" : "";
                const req = !f.nillable && f.createable ? " is-required" : "";
                const denied = !badges.readable ? " is-denied" : "";
                const relHint = f.referenceTo?.length
                  ? `links to ${f.referenceTo.map((n) => labels[n] || n).join(" or ")}`
                  : "";
                const accessHtml = simple
                  ? ""
                  : badges.access
                      .map(
                        (b) =>
                          `<span class="sb-badge sb-badge-${b.kind}" title="${escapeHtml(b.title)}">${escapeHtml(b.key)}</span>`
                      )
                      .join("");
                const flagHtml = simple
                  ? relHint
                    ? `<span class="sb-rel-hint">${escapeHtml(relHint)}</span>`
                    : ""
                  : badges.flags
                      .map(
                        (b) =>
                          `<span class="sb-badge sb-badge-${b.kind}" title="${escapeHtml(b.title)}">${escapeHtml(b.key)}</span>`
                      )
                      .join("");
                const typeHtml = simple ? "" : `<span class="sb-field-type">${escapeHtml(formatFieldType(f))}</span>`;
                return `<div class="sb-field${rel}${req}${denied}" data-field="${escapeHtml(f.name)}" data-object="${escapeHtml(describe.name)}" data-rel-targets="${escapeHtml((f.referenceTo || []).join(","))}" title="${escapeHtml(simple ? friendlyFieldHint(f, labels) : badges.reason || f.name)}">
                  <span class="sb-field-name">${escapeHtml(f.label || f.name)}</span>
                  <span class="sb-field-meta">
                    <span class="sb-field-badges">${accessHtml}${flagHtml}</span>
                    ${typeHtml}
                  </span>
                </div>`;
              })
              .join("")
          : `<div class="sb-field muted"><span class="sb-field-name">${describe.stub ? "Details unavailable" : "No fields"}</span></div>`
      }
    </div>
    ${
      total > fields.length || expanded
        ? `<button type="button" class="sb-more" data-expand="${escapeHtml(describe.name)}">${
            expanded ? "Show fewer fields" : `Show more fields (${total - fields.length})`
          }</button>`
        : total
          ? `<div class="sb-more-static">${total} fields</div>`
          : ""
    }
  `;

  bindSchemaCardDrag(card, describe, isCenter);
  card.querySelector("[data-expand]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const name = e.currentTarget.getAttribute("data-expand");
    state.schemaExpanded[name] = !state.schemaExpanded[name];
    renderSchemaExplorer();
    requestAnimationFrame(() => drawSchemaLines());
  });
  return card;
}

function bindSchemaCardDrag(card, describe, isCenter) {
  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;
  let startTarget = null;

  card.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button")) return;
    e.stopPropagation();
    dragging = true;
    moved = false;
    startTarget = e.target;
    lastX = e.clientX;
    lastY = e.clientY;
    card.dataset.didDrag = "0";
    state.schemaMovingCard = describe.name;
    card.classList.add("is-dragging");
    card.setPointerCapture?.(e.pointerId);
  });
  card.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const scale = state.schemaView?.scale || 1;
    if (!moved && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 6) return;
    moved = true;
    card.dataset.didDrag = "1";
    const dx = (e.clientX - lastX) / scale;
    const dy = (e.clientY - lastY) / scale;
    lastX = e.clientX;
    lastY = e.clientY;
    const left = (parseFloat(card.style.left) || 0) + dx;
    const top = (parseFloat(card.style.top) || 0) + dy;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    state.schemaCardPositions = {
      ...(state.schemaCardPositions || {}),
      [describe.name]: { x: left, y: top }
    };
    drawSchemaLines();
  });
  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    state.schemaMovingCard = "";
    card.classList.remove("is-dragging");
    if (moved) return;
    const fieldRow = startTarget?.closest?.(".sb-field[data-field]");
    if (fieldRow) {
      const fieldName = fieldRow.getAttribute("data-field");
      const field = (describe.fields || []).find((f) => f.name === fieldName);
      if (!field) return;
      openSchemaFieldMenu({
        field,
        objectName: describe.name,
        anchorEl: fieldRow,
        clientX: e.clientX,
        clientY: e.clientY
      });
      return;
    }
    if (!isCenter) {
      onLoadSchema({ resetTrail: false, sobject: describe.name }).catch(() => {});
    }
  };
  card.addEventListener("pointerup", finish);
  card.addEventListener("pointercancel", () => {
    dragging = false;
    moved = false;
    state.schemaMovingCard = "";
    card.classList.remove("is-dragging");
  });
  card.querySelectorAll(".sb-field[data-field]").forEach((row) => {
    row.addEventListener("mouseenter", () => {
      const edge = (state._schemaEdges || []).find(
        (ed) => ed.fromObject === describe.name && ed.fromField === row.getAttribute("data-field")
      );
      if (!edge && !row.classList.contains("is-rel")) return;
      highlightSchemaRelation(edge || null, {
        objects: [describe.name, ...(row.getAttribute("data-rel-targets") || "").split(",").filter(Boolean)],
        fieldEl: row
      });
    });
    row.addEventListener("mouseleave", () => highlightSchemaRelation(null));
  });
}
function hideSchemaFieldMenu() {
  const menu = $("#schemaFieldMenu");
  if (!menu) return;
  menu.classList.add("hidden");
  menu.hidden = true;
  menu.innerHTML = "";
  state.schemaFieldMenu = null;
}

function openSchemaFieldMenu({ field, objectName, anchorEl, clientX, clientY }) {
  const menu = $("#schemaFieldMenu");
  if (!menu || !field) return;
  const parentTargets = Array.isArray(field.referenceTo) ? field.referenceTo.filter(Boolean) : [];
  const edge = (state._schemaEdges || []).find(
    (e) => e.fromObject === objectName && e.fromField === field.name
  );
  const simple = state.schemaSimpleMode !== false;
  const labels = state.schemaLabels || {};
  const items = [];
  if (simple) {
    items.push({ id: "explain", label: friendlyFieldHint(field, labels) });
    if (edge) items.push({ id: "highlight-edge", label: "Show the connection" });
    if (parentTargets.length) {
      items.push({
        id: "open-parent",
        label: `Open ${labels[parentTargets[0]] || parentTargets[0]}`
      });
    }
  } else {
    items.push({ id: "copy-api", label: `Copy ${field.name}` });
    items.push({ id: "copy-select", label: "Copy SELECT snippet" });
    if (edge) items.push({ id: "highlight-edge", label: "Highlight relationship line" });
    if (parentTargets.length) {
      items.push({ id: "query-parent", label: `Query via ${field.relationshipName || field.name}` });
      items.push({
        id: "open-parent",
        label: parentTargets.length === 1 ? `Open ${parentTargets[0]}` : `Open ${parentTargets[0]}…`
      });
    }
    items.push({ id: "query-field", label: "Query this field" });
  }

  menu.innerHTML = items
    .map(
      (it) =>
        `<button type="button" class="schema-field-menu-item" role="menuitem" data-action="${it.id}">${escapeHtml(it.label)}</button>`
    )
    .join("");
  menu.classList.remove("hidden");
  menu.hidden = false;
  state.schemaFieldMenu = { field, objectName };

  const place = () => {
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    menu.style.left = "0px";
    menu.style.top = "0px";
    const rect = menu.getBoundingClientRect();
    let x = clientX ?? (anchorEl?.getBoundingClientRect().left || 0);
    let y = clientY ?? (anchorEl?.getBoundingClientRect().bottom || 0) + 4;
    if (x + rect.width > vw - pad) x = Math.max(pad, vw - rect.width - pad);
    if (y + rect.height > vh - pad) y = Math.max(pad, vh - rect.height - pad);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  };
  place();

  menu.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const action = btn.getAttribute("data-action");
      const describe = state.schemaDescribe;
      hideSchemaFieldMenu();
      if (action === "explain") {
        previewSchemaSoql(friendlyFieldHint(field, state.schemaLabels || {}));
        return;
      }
      if (action === "copy-api") {
        try {
          await navigator.clipboard.writeText(field.name);
        } catch {
          /* ignore */
        }
        return;
      }
      if (action === "copy-select") {
        const soql = `SELECT Id, ${field.name} FROM ${objectName} LIMIT 50`;
        try {
          await navigator.clipboard.writeText(soql);
        } catch {
          /* ignore */
        }
        previewSchemaSoql(soql);
        return;
      }
      if (action === "highlight-edge" && edge) {
        state.schemaHighlightedEdgeId = edge.id;
        drawSchemaLines();
        return;
      }
      if (action === "query-parent" && describe && parentTargets.length) {
        const parent =
          (state.schemaParents || []).find((p) => p.fieldName === field.name) || {
            fieldName: field.name,
            relationshipName: field.relationshipName || null,
            targetObject: parentTargets[0],
            type: field.type
          };
        openSoqlWithQuery(buildParentPathQuery(describe, parent));
        return;
      }
      if (action === "open-parent" && parentTargets[0]) {
        onLoadSchema({ resetTrail: false, sobject: parentTargets[0] }).catch(() => {});
        return;
      }
      if (action === "query-field") {
        openSoqlWithQuery(`SELECT Id, ${field.name} FROM ${objectName} LIMIT 50`);
      }
    });
  });
}

function boxForEl(el) {
  return {
    x: el.offsetLeft,
    y: el.offsetTop,
    w: el.offsetWidth,
    h: el.offsetHeight
  };
}

function drawSchemaLines() {
  const svg = $("#schemaLines");
  const cardsHost = $("#schemaCards");
  if (!svg || !cardsHost) return;
  const edges = state._schemaEdges || [];
  let maxX = 800;
  let maxY = 600;
  for (const card of cardsHost.querySelectorAll(".sb-card")) {
    maxX = Math.max(maxX, card.offsetLeft + card.offsetWidth + 120);
    maxY = Math.max(maxY, card.offsetTop + card.offsetHeight + 80);
  }
  svg.setAttribute("width", String(maxX));
  svg.setAttribute("height", String(maxY));
  svg.style.width = `${maxX}px`;
  svg.style.height = `${maxY}px`;
  svg.innerHTML = "";

  const markerId = "sb-arrow";
  svg.innerHTML = `<defs>
    <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#5b9bd5"></path>
    </marker>
    <marker id="${markerId}-md" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#e07a5f"></path>
    </marker>
  </defs>`;

  const incoming = {};
  for (const edge of edges) {
    incoming[edge.toObject] = (incoming[edge.toObject] || 0) + 1;
  }
  const incomingSeen = {};

  for (const edge of edges) {
    const fromField = cardsHost.querySelector(
      `.sb-field[data-object="${CSS.escape(edge.fromObject)}"][data-field="${CSS.escape(edge.fromField)}"]`
    );
    const toCard = cardsHost.querySelector(`.sb-card[data-object="${CSS.escape(edge.toObject)}"]`);
    const fromCard = cardsHost.querySelector(`.sb-card[data-object="${CSS.escape(edge.fromObject)}"]`);
    if (!toCard || !fromCard) continue;
    const fromEl = fromField || fromCard;
    incomingSeen[edge.toObject] = (incomingSeen[edge.toObject] || 0) + 1;
    const route = routeRelationshipPath({
      fromBox: boxForEl(fromEl),
      toBox: boxForEl(toCard),
      index: edge.spreadIndex ?? incomingSeen[edge.toObject] - 1,
      count: edge.spreadCount || incoming[edge.toObject] || 1
    });
    const highlighted = state.schemaHighlightedEdgeId === edge.id;
    const baseClass = edge.kind === "masterdetail" ? "sb-line sb-line-md" : "sb-line";
    const label = edgeLabelText(edge, { simple: state.schemaSimpleMode !== false });

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `sb-edge${highlighted ? " is-highlight" : ""}`);
    group.dataset.edgeId = edge.id;
    group.dataset.fromObject = edge.fromObject;
    group.dataset.toObject = edge.toObject;
    group.dataset.fromField = edge.fromField;

    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", route.d);
    hit.setAttribute("class", "sb-line-hit");
    hit.setAttribute("title", label);
    hit.addEventListener("mouseenter", () => highlightSchemaRelation(edge));
    hit.addEventListener("mouseleave", () => highlightSchemaRelation(null));
    hit.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onSchemaEdgeClick(edge);
    });
    group.appendChild(hit);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", route.d);
    path.setAttribute("class", `${baseClass}${highlighted ? " is-highlight" : ""}`);
    path.setAttribute("marker-end", `url(#${markerId}${edge.kind === "masterdetail" ? "-md" : ""})`);
    group.appendChild(path);

    const tick = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    tick.setAttribute("cx", String(route.x1));
    tick.setAttribute("cy", String(route.y1));
    tick.setAttribute("r", "3.5");
    tick.setAttribute("class", edge.kind === "masterdetail" ? "sb-line-dot sb-line-md" : "sb-line-dot");
    group.appendChild(tick);

    const textW = Math.min(220, Math.max(72, label.length * 6.2));
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("class", "sb-line-label-bg");
    bg.setAttribute("x", String(route.labelX - textW / 2));
    bg.setAttribute("y", String(route.labelY - 11));
    bg.setAttribute("width", String(textW));
    bg.setAttribute("height", "18");
    bg.setAttribute("rx", "4");
    group.appendChild(bg);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "sb-line-label");
    text.setAttribute("x", String(route.labelX));
    text.setAttribute("y", String(route.labelY + 2));
    text.setAttribute("text-anchor", "middle");
    text.textContent = label;
    group.appendChild(text);

    svg.appendChild(group);
  }

  if (state.schemaHighlightedEdgeId) {
    const edge = edges.find((e) => e.id === state.schemaHighlightedEdgeId);
    if (edge) highlightSchemaRelation(edge);
  }
}

function highlightSchemaRelation(edge, extra = {}) {
  const svg = $("#schemaLines");
  const cardsHost = $("#schemaCards");
  const world = $("#schemaWorld");
  if (!svg || !cardsHost) return;
  const objects = new Set(extra.objects || []);
  if (edge) {
    objects.add(edge.fromObject);
    objects.add(edge.toObject);
  }
  const hovering = objects.size > 0;
  world?.classList.toggle("is-rel-hover", hovering);
  if (state.schemaDescribe) {
    renderSchemaStory(state.schemaDescribe, hovering ? edge || null : null);
  }
  for (const card of cardsHost.querySelectorAll(".sb-card")) {
    const name = card.dataset.object;
    card.classList.toggle("is-related", hovering && objects.has(name));
    card.classList.toggle("is-dimmed", hovering && !objects.has(name));
  }
  for (const row of cardsHost.querySelectorAll(".sb-field")) {
    const match = !!(
      extra.fieldEl === row ||
      (edge &&
        row.getAttribute("data-object") === edge.fromObject &&
        row.getAttribute("data-field") === edge.fromField)
    );
    row.classList.toggle("is-rel-active", match);
  }
  for (const g of svg.querySelectorAll(".sb-edge")) {
    const on = !!(edge && g.dataset.edgeId === edge.id);
    g.classList.toggle("is-highlight", on);
    g.classList.toggle("is-dimmed", hovering && !on);
    g.querySelector(".sb-line")?.classList.toggle("is-highlight", on);
  }
}

function onSchemaEdgeClick(edge) {
  if (!edge) return;
  state.schemaHighlightedEdgeId = edge.id;
  drawSchemaLines();
  const labels = state.schemaLabels || {};
  previewSchemaSoql(plainRelationshipSentence(edge, labels));
  if (state.schemaSimpleMode !== false) return;
  const center = state.schemaDescribe;
  if (!center) return;

  // Parent lookup from center card
  if (edge.fromObject === center.name) {
    const parent =
      (state.schemaParents || []).find((p) => p.fieldName === edge.fromField) || {
        fieldName: edge.fromField,
        relationshipName: null,
        targetObject: edge.toObject,
        type: edge.kind
      };
    openSoqlWithQuery(buildParentPathQuery(center, parent));
    return;
  }

  // Child relationship into center
  if (edge.toObject === center.name) {
    const child =
      (state.schemaChildren || []).find(
        (c) => c.childObject === edge.fromObject && c.fieldName === edge.fromField
      ) || {
        childObject: edge.fromObject,
        fieldName: edge.fromField,
        relationshipName: null,
        cascadeDelete: edge.kind === "masterdetail"
      };
    const soql = buildChildSubquery(center, child) || buildObjectQuery(center);
    openSoqlWithQuery(soql);
  }
}

function renderSchemaActions(describe) {
  const root = $("#schemaActions");
  if (!root) return;
  const simple = state.schemaSimpleMode !== false;
  if (simple) {
    root.innerHTML = `
      <button type="button" class="btn primary" id="schemaOpenRelated">Open a linked record type</button>
      <button type="button" class="btn" id="schemaOpenDescribe">See all fields</button>
      <button type="button" class="btn ghost" id="schemaSendNl">Ask in plain English</button>
    `;
    $("#schemaOpenRelated")?.addEventListener("click", () => {
      const first = state.schemaParents?.[0]?.targetObject || state.schemaChildren?.[0]?.childObject;
      if (first) onLoadSchema({ resetTrail: false, sobject: first }).catch(() => {});
    });
    $("#schemaOpenDescribe")?.addEventListener("click", () => {
      const search = $("#describeObjectSearch");
      if (search) search.value = describe.name;
      showView("describe");
      onLoadDescribe().catch(() => {});
    });
    $("#schemaSendNl")?.addEventListener("click", () => {
      const nl = $("#nlInput");
      if (nl) {
        nl.value = `Show me ${describe.label || describe.name} records and how they connect to related records`;
      }
      showView("nl-soql");
    });
    return;
  }
  root.innerHTML = `
    <button type="button" class="btn primary" id="schemaQueryObject">Query this object</button>
    <button type="button" class="btn" id="schemaOpenDescribe">Open in Describe</button>
    <button type="button" class="btn" id="schemaSendNl">Ask NL → SOQL</button>
    <button type="button" class="btn ghost" id="schemaCopyName">Copy API name</button>
  `;
  $("#schemaQueryObject")?.addEventListener("click", () => {
    openSoqlWithQuery(buildObjectQuery(describe));
  });
  $("#schemaOpenDescribe")?.addEventListener("click", () => {
    const search = $("#describeObjectSearch");
    if (search) search.value = describe.name;
    showView("describe");
    onLoadDescribe().catch(() => {});
  });
  $("#schemaSendNl")?.addEventListener("click", () => {
    const kind = objectKind(describe.name, !!describe.custom);
    const nl = $("#nlInput");
    if (nl) {
      nl.value = `Show recent ${describe.name} records (${kind})${
        state.schemaParents?.[0]
          ? ` including related ${state.schemaParents[0].targetObject}`
          : ""
      }`;
    }
    showView("nl-soql");
  });
  $("#schemaCopyName")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(describe.name);
    } catch {
      /* ignore */
    }
  });

  if (state.schemaParents?.length) {
    const first = state.schemaParents[0];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = `Query via ${first.relationshipName || first.fieldName}`;
    btn.addEventListener("click", () => {
      openSoqlWithQuery(buildParentPathQuery(describe, first));
    });
    root.appendChild(btn);
  }
  const childWithRel = (state.schemaChildren || []).find((c) => c.relationshipName);
  if (childWithRel) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = `Child subquery (${childWithRel.relationshipName})`;
    btn.addEventListener("click", () => {
      const soql = buildChildSubquery(describe, childWithRel);
      if (soql) openSoqlWithQuery(soql);
    });
    root.appendChild(btn);
  }
}

function previewSchemaSoql(soql) {
  const pre = $("#schemaSoqlPreview");
  if (!pre) return;
  pre.textContent = soql || "";
  pre.classList.toggle("hidden", !soql);
}

function openSoqlWithQuery(soql) {
  if (!soql) return;
  previewSchemaSoql(soql);
  const input = $("#soqlInput");
  if (input) input.value = soql;
  showView("soql-run");
}

function fillPermObjectDatalist(sobjects) {
  const list = $("#permObjectList");
  if (!list) return;
  const objects = normalizeDescribeObjects(sobjects);
  list.innerHTML = objects
    .map((o) => `<option value="${escapeHtml(o.name)}" label="${escapeHtml(o.label)}"></option>`)
    .join("");
}

function bindDescribeObjectSearch() {
  const input = $("#describeObjectSearch");
  const host = $("#describeObjectSuggest");
  if (!input || !host) return;
  const paint = () => renderDescribeObjectSuggest();
  input.addEventListener("input", paint);
  input.addEventListener("focus", paint);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideDescribeObjectSuggest();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.("#describeObjectSearch") && !e.target.closest?.("#describeObjectSuggest")) {
      hideDescribeObjectSuggest();
    }
  });
}

function hideDescribeObjectSuggest() {
  const host = $("#describeObjectSuggest");
  if (!host) return;
  host.classList.add("hidden");
  host.replaceChildren();
}

function renderDescribeObjectSuggest() {
  const input = $("#describeObjectSearch");
  const host = $("#describeObjectSuggest");
  if (!input || !host) return;
  const q = (input.value || "").trim().toLowerCase();
  if (!q || !state.describeObjects.length) {
    hideDescribeObjectSuggest();
    return;
  }
  const scored = [];
  for (const o of state.describeObjects) {
    const name = o.name.toLowerCase();
    const label = (o.label || "").toLowerCase();
    const plural = (o.labelPlural || "").toLowerCase();
    let score = 0;
    if (name === q || label === q) score = 100;
    else if (name.startsWith(q) || label.startsWith(q)) score = 90;
    else if (name.includes(q) || label.includes(q) || plural.includes(q)) score = 70;
    else continue;
    if (o.custom) score += 5;
    scored.push({ o, score });
  }
  scored.sort((a, b) => b.score - a.score || a.o.name.localeCompare(b.o.name));
  const hits = scored.slice(0, 50).map((x) => x.o);
  if (!hits.length) {
    hideDescribeObjectSuggest();
    return;
  }
  host.classList.remove("hidden");
  host.replaceChildren();
  for (const o of hits) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "soql-suggest-item";
    btn.innerHTML = `<strong>${escapeHtml(o.name)}</strong><span>${escapeHtml(o.label)}${o.custom ? " · custom" : ""}</span>`;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      input.value = o.name;
      hideDescribeObjectSuggest();
      onLoadDescribe();
    });
    host.appendChild(btn);
  }
}

async function onLoadDescribe() {
  const sobject = $("#describeObjectSearch").value.trim();
  if (!sobject) return;
  hideDescribeObjectSuggest();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(sobject)) {
    $("#describeSummary").textContent = "Invalid object API name.";
    return;
  }
  $("#describeSummary").textContent = "Loading describe…";
  $("#describeFields").innerHTML = "";
  $("#describeDetail").innerHTML = "";
  $("#describeDependent").innerHTML = "";
  try {
    const res = await send("describeSObject", {
      tabUrl: await requireTabUrl(),
      sobject,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    const fields = (res.result.fields || []).map(summarizeField);
    state.describe = res.result;
    state.describeFields = fields;
    const customBit = res.result.custom ? " · custom" : "";
    $("#describeSummary").textContent = `${res.result.name}${customBit} · ${fields.length} fields · keyPrefix ${res.result.keyPrefix || "—"}`;
    renderDescribeFields();
    renderDependentPicker(fields);
    await trackActivity({
      type: "describe",
      title: res.result.name,
      detail: `${fields.length} fields${res.result.custom ? " · custom" : ""}`,
      view: "describe",
      payload: { sobject: res.result.name }
    });
  } catch (e) {
    $("#describeSummary").textContent = e.message;
  }
}

function renderDescribeFields() {
  const root = $("#describeFields");
  if (!state.describeFields?.length) {
    root.innerHTML = "";
    return;
  }
  const filtered = filterFields(state.describeFields, $("#describeFieldFilter").value);
  root.innerHTML = filtered
    .map((f) => {
      const deps = f.dependentPicklist ? " · dependent" : f.controllerName ? "" : "";
      const refs = f.referenceTo?.length ? ` → ${f.referenceTo.join(",")}` : "";
      return `<button type="button" class="describe-item" data-field="${escapeHtml(f.name)}">
        <strong>${escapeHtml(f.name)}</strong>
        <span>${escapeHtml(f.label)} · ${escapeHtml(f.type)}${escapeHtml(refs)}${deps}</span>
      </button>`;
    })
    .join("");
  root.querySelectorAll(".describe-item").forEach((btn) => {
    btn.addEventListener("click", () => showFieldDetail(btn.getAttribute("data-field")));
  });
}

function showFieldDetail(fieldName) {
  const field = state.describeFields.find((f) => f.name === fieldName);
  if (!field) return;
  const picks = field.picklistValues?.length
    ? `<ul>${field.picklistValues
        .map((p) => `<li><code>${escapeHtml(p.value)}</code> — ${escapeHtml(p.label)}</li>`)
        .join("")}</ul>`
    : "";
  $("#describeDetail").innerHTML = `
    <div class="finding info">
      <div class="row wrap">
        <strong>${escapeHtml(field.name)}</strong>
        <button type="button" class="btn" id="copyFieldApi">Copy API name</button>
      </div>
      <p>${escapeHtml(field.label)} · ${escapeHtml(field.type)} · custom:${field.custom} · nillable:${field.nillable} · create:${field.createable} · update:${field.updateable}</p>
      ${
        field.controllerName
          ? (() => {
              const ctrl = state.describeFields.find((f) => f.name === field.controllerName);
              return `<p>Depends on controlling field: <strong>${escapeHtml(ctrl?.label || field.controllerName)}</strong> <code>${escapeHtml(field.controllerName)}</code></p>`;
            })()
          : ""
      }
      ${field.relationshipName ? `<p>Relationship: <code>${escapeHtml(field.relationshipName)}</code></p>` : ""}
      ${picks}
    </div>`;
  $("#copyFieldApi")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(field.name);
  });

  if (field.dependentPicklist && field.controllerName) {
    const controller = state.describeFields.find((f) => f.name === field.controllerName);
    if (controller) {
      const pairs = findDependentPairs(state.describeFields || []);
      const idx = pairs.findIndex((p) => p.dependent.name === field.name);
      const pairSel = $("#depPairSelect");
      if (pairSel && idx >= 0) pairSel.value = String(idx);
      renderDependentInteractive(buildDependentMap(controller, field));
    }
  }
}

function fieldDisplayName(field) {
  if (!field) return "";
  const label = field.label || field.name;
  return label === field.name ? field.name : `${label} (${field.name})`;
}

function renderDependentPicker(fields) {
  const pairs = findDependentPairs(fields);
  if (!pairs.length) {
    $("#describeDependent").innerHTML = `<div class="hint">No field dependencies (dependent picklists) on this object.</div>`;
    return;
  }
  $("#describeDependent").innerHTML = `
    <div class="summary-bar">Field dependencies (${pairs.length})</div>
    <p class="hint dep-intro">Shows which dependent picklist options are available for each controlling value — same idea as Setup → Object Manager → Fields → Field Dependencies.</p>
    <label class="label" for="depPairSelect">Dependency</label>
    <select id="depPairSelect" class="select block-select"></select>
    <div id="depInteractive"></div>`;
  const sel = $("#depPairSelect");
  pairs.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${fieldDisplayName(p.controller)} → ${fieldDisplayName(p.dependent)}`;
    sel.appendChild(opt);
  });
  const render = () => {
    const pair = pairs[Number(sel.value)];
    renderDependentInteractive(buildDependentMap(pair.controller, pair.dependent));
  };
  sel.addEventListener("change", render);
  render();
}

function renderDependentInteractive(map) {
  const host = $("#depInteractive") || $("#describeDependent");
  if (!map) return;
  const controllerTitle = map.controllerLabel || map.controllerName;
  const dependentTitle = map.dependentLabel || map.dependentName;
  host.innerHTML = `
    <div class="dep-panel">
      <div class="dep-map" aria-label="Controlling and dependent fields">
        <div class="dep-field">
          <span class="dep-role">Controlling field</span>
          <strong>${escapeHtml(controllerTitle)}</strong>
          <code>${escapeHtml(map.controllerName)}</code>
        </div>
        <div class="dep-arrow" aria-hidden="true">→</div>
        <div class="dep-field">
          <span class="dep-role">Dependent field</span>
          <strong>${escapeHtml(dependentTitle)}</strong>
          <code>${escapeHtml(map.dependentName)}</code>
        </div>
      </div>
      <label class="label" for="depControllerValue">When <strong>${escapeHtml(controllerTitle)}</strong> equals</label>
      <select id="depControllerValue" class="select block-select"></select>
      <div id="depValuesOut" class="dep-result"></div>
    </div>`;
  const sel = $("#depControllerValue");
  map.controllerValues.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.value;
    opt.textContent = v.label === v.value ? v.label : `${v.label}  ·  ${v.value}`;
    sel.appendChild(opt);
  });
  const paint = () => {
    const vals = map.byController[sel.value] || [];
    const controlling = map.controllerValues.find((v) => v.value === sel.value);
    const controllingLabel = controlling?.label || sel.value;
    const out = $("#depValuesOut");
    if (!vals.length) {
      out.innerHTML = `<p class="dep-empty">No active options on <strong>${escapeHtml(dependentTitle)}</strong> when <strong>${escapeHtml(controllerTitle)}</strong> is <em>${escapeHtml(controllingLabel)}</em>.</p>`;
      return;
    }
    out.innerHTML = `
      <p class="dep-result-title">Then <strong>${escapeHtml(dependentTitle)}</strong> can be one of these <span class="dep-count">${vals.length}</span></p>
      <div class="dep-table-wrap">
        <table class="dep-table">
          <thead>
            <tr>
              <th scope="col">Label (what users see)</th>
              <th scope="col">API value</th>
            </tr>
          </thead>
          <tbody>
            ${vals
              .map(
                (v) => `<tr>
              <td>${escapeHtml(v.label)}</td>
              <td><code>${escapeHtml(v.value)}</code></td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="row wrap dep-actions">
        <button type="button" class="btn" id="copyDepLabels">Copy labels</button>
        <button type="button" class="btn" id="copyDepValues">Copy API values</button>
      </div>`;
    $("#copyDepLabels")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(vals.map((v) => v.label).join("\n"));
    });
    $("#copyDepValues")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(vals.map((v) => v.value).join("\n"));
    });
  };
  sel.addEventListener("change", paint);
  paint();
}

async function loadCompareOrgs() {
  const status = $("#compareStatus");
  const leftSel = $("#compareOrgLeft");
  const rightSel = $("#compareOrgRight");
  if (!leftSel || !rightSel) return;

  const prevLeft = leftSel.value;
  const prevRight = rightSel.value;
  if (status) status.textContent = "Scanning Salesforce tabs in all Chrome windows…";

  const res = await send("listSalesforceOrgs");
  if (!res.ok) {
    if (status) status.textContent = res.error || "Could not list orgs.";
    renderCompareSessionList();
    return;
  }

  const orgs = Array.isArray(res.result) ? res.result : [];
  state.orgCompare.orgs = orgs;

  let remembered = null;
  try {
    remembered = await loadLastComparePair();
  } catch {
    remembered = null;
  }

  const fill = (sel, preferred) => {
    sel.innerHTML = "";
    if (!orgs.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No Salesforce sessions found";
      sel.appendChild(opt);
      return;
    }
    for (const org of orgs) {
      const opt = document.createElement("option");
      opt.value = org.orgKey;
      const sess = org.hasSession ? "" : " (no sid)";
      const loc = org.locationLabel ? ` · ${org.locationLabel}` : "";
      opt.textContent = `${org.label}${sess}${loc}`;
      opt.disabled = !org.hasSession;
      sel.appendChild(opt);
    }
    if (preferred && [...sel.options].some((o) => o.value === preferred && !o.disabled)) {
      sel.value = preferred;
    }
  };

  const preferredLeft = prevLeft || remembered?.leftOrgKey || "";
  const preferredRight = prevRight || remembered?.rightOrgKey || "";
  fill(leftSel, preferredLeft);
  fill(rightSel, preferredRight);

  // Default: pick two different orgs when possible
  if (!leftSel.value && !rightSel.value && orgs.length >= 2) {
    const withSession = orgs.filter((o) => o.hasSession);
    if (withSession[0]) leftSel.value = withSession[0].orgKey;
    if (withSession[1]) rightSel.value = withSession[1].orgKey;
    else if (withSession[0] && orgs[1]) rightSel.value = orgs[1].orgKey;
  } else if (!rightSel.value && orgs.length >= 2 && leftSel.value) {
    const other = orgs.find((o) => o.orgKey !== leftSel.value && o.hasSession);
    if (other) rightSel.value = other.orgKey;
  } else if (leftSel.value && rightSel.value && leftSel.value === rightSel.value) {
    const other = orgs.find((o) => o.orgKey !== leftSel.value && o.hasSession);
    if (other) rightSel.value = other.orgKey;
  }

  updateCompareOrgCards();
  renderCompareSessionList();
  await persistComparePairSelection();

  const envCounts = countOrgsByEnv(orgs);
  const envBits = Object.entries(envCounts)
    .map(([env, n]) => `${env} ${n}`)
    .join(" · ");
  const windowCount = countDistinctCompareWindows(orgs);
  const windowBit =
    windowCount > 1 ? ` across ${windowCount} Chrome windows` : windowCount === 1 ? " in 1 Chrome window" : "";
  const hint = $("#compareChooserHint");
  if (hint) {
    hint.innerHTML = orgs.length
      ? `Found <strong>${orgs.length}</strong> org session${orgs.length === 1 ? "" : "s"}${windowBit}. Use <strong>Set as A</strong> / <strong>Set as B</strong>, or the dropdowns below.`
      : "No Salesforce sessions yet. Open logged-in org tabs in any Chrome window, then click <strong>Refresh sessions</strong>.";
  }
  if (status) {
    status.textContent = orgs.length
      ? `${orgs.length} org session${orgs.length === 1 ? "" : "s"} found${envBits ? ` (${envBits})` : ""}${windowBit}. Assign A and B, then Compare.`
      : "Open logged-in Salesforce tabs (any Chrome window) for the orgs you want to compare, then refresh.";
  }
}

function countOrgsByEnv(orgs) {
  const counts = {};
  for (const org of orgs || []) {
    const env = org.envLabel || (org.isSandbox ? "Sandbox" : "Production");
    counts[env] = (counts[env] || 0) + 1;
  }
  return counts;
}

function countDistinctCompareWindows(orgs) {
  const ids = new Set();
  for (const org of orgs || []) {
    for (const id of org.windowIds || []) {
      if (id != null) ids.add(id);
    }
    if ((!org.windowIds || !org.windowIds.length) && org.windowId != null) ids.add(org.windowId);
  }
  return ids.size;
}

function getCompareOrgByKey(orgKey) {
  return state.orgCompare.orgs.find((o) => o.orgKey === orgKey) || null;
}

function assignCompareOrg(side, orgKey) {
  const org = getCompareOrgByKey(orgKey);
  if (!org?.hasSession) return;
  const leftSel = $("#compareOrgLeft");
  const rightSel = $("#compareOrgRight");
  if (!leftSel || !rightSel) return;

  if (side === "A") {
    // If B already has this org, move previous A to B when possible.
    if (rightSel.value === orgKey && leftSel.value && leftSel.value !== orgKey) {
      rightSel.value = leftSel.value;
    }
    leftSel.value = orgKey;
  } else {
    if (leftSel.value === orgKey && rightSel.value && rightSel.value !== orgKey) {
      leftSel.value = rightSel.value;
    }
    rightSel.value = orgKey;
  }

  updateCompareOrgCards();
  renderCompareSessionList();
  persistComparePairSelection().catch(() => {});
  const status = $("#compareStatus");
  if (status) {
    const label = org.envLabel || org.label || orgKey;
    status.textContent = `Set ${side === "A" ? "Org A" : "Org B"} → ${label}. ${
      leftSel.value && rightSel.value && leftSel.value !== rightSel.value
        ? "Ready to Compare."
        : "Pick the other org next."
    }`;
  }
}

function renderCompareSessionList() {
  const root = $("#compareSessionList");
  if (!root) return;
  const orgs = state.orgCompare.orgs || [];
  const leftKey = $("#compareOrgLeft")?.value || "";
  const rightKey = $("#compareOrgRight")?.value || "";

  if (!orgs.length) {
    root.innerHTML = `<div class="compare-session-empty">No sessions found yet. Open Salesforce in one or more Chrome windows, stay logged in, then refresh.</div>`;
    return;
  }

  root.innerHTML = orgs
    .map((org) => {
      const isA = org.orgKey === leftKey;
      const isB = org.orgKey === rightKey;
      const selectedClass = isA ? "is-a" : isB ? "is-b" : "";
      const disabled = !org.hasSession;
      const host = org.myDomain || org.hostname || org.apiBase || "—";
      const user = org.username || (org.hasSession ? "session ready" : "no sid cookie");
      const loc = org.locationLabel || org.windowLabel || (org.tabId ? "Open tab" : "Cookie session");
      const envShort = shortCompareEnvLabel(org.envLabel || (org.isSandbox ? "Sandbox" : "Production"));
      const badge = isA ? "A" : isB ? "B" : envShort;
      const badgeClass = isA
        ? ""
        : isB
          ? "compare-org-badge-b"
          : `compare-org-badge-muted compare-org-badge-env`;
      const title = org.label || host;
      return `<div class="compare-session-item ${selectedClass}${disabled ? " is-disabled" : ""}" role="listitem" data-org-key="${escapeHtml(org.orgKey)}">
        <div class="compare-session-main">
          <span class="compare-org-badge ${badgeClass}" title="${escapeHtml(org.envLabel || envShort)}">${escapeHtml(badge)}</span>
          <div class="compare-session-text">
            <div class="compare-session-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
            <div class="compare-session-meta">${escapeHtml(host)} · ${escapeHtml(user)}</div>
            <div class="compare-session-loc">${escapeHtml(loc)}</div>
          </div>
        </div>
        <div class="compare-session-actions">
          <button type="button" class="btn ${isA ? "primary" : ""}" data-assign-side="A" data-org-key="${escapeHtml(org.orgKey)}" ${disabled ? "disabled" : ""}>Set as A</button>
          <button type="button" class="btn ${isB ? "primary" : ""}" data-assign-side="B" data-org-key="${escapeHtml(org.orgKey)}" ${disabled ? "disabled" : ""}>Set as B</button>
        </div>
      </div>`;
    })
    .join("");
}

function shortCompareEnvLabel(envLabel) {
  const env = String(envLabel || "").trim().toLowerCase();
  if (!env) return "Org";
  if (env.startsWith("prod")) return "Prod";
  if (env.startsWith("sand")) return "Sandbox";
  if (env.startsWith("dev")) return "Dev";
  if (env.startsWith("scratch")) return "Scratch";
  return String(envLabel).slice(0, 8);
}

function updateCompareOrgCards() {
  const left = getCompareOrgByKey($("#compareOrgLeft")?.value);
  const right = getCompareOrgByKey($("#compareOrgRight")?.value);
  renderCompareOrgCard("Left", left);
  renderCompareOrgCard("Right", right);
}

function renderCompareOrgCard(side, org) {
  const envEl = $(`#compareEnv${side}`);
  const metaEl = $(`#compareMeta${side}`);
  if (envEl) envEl.textContent = org?.envLabel || (side === "Left" ? "Org A" : "Org B");
  if (!metaEl) return;
  if (!org) {
    metaEl.textContent = "Pick a logged-in Salesforce session";
    return;
  }
  const host = org.myDomain || org.hostname || org.apiBase || "—";
  const user = org.username || "session user";
  const sess = org.hasSession ? "session ready" : "no sid cookie";
  const loc = org.locationLabel || (org.tabId ? "open tab" : "cookie only");
  metaEl.innerHTML = `<span>${escapeHtml(host)}</span><span>${escapeHtml(user)}</span><span>${escapeHtml(sess)}</span><span>${escapeHtml(loc)}</span>`;
}

async function persistComparePairSelection() {
  const leftOrgKey = $("#compareOrgLeft")?.value || "";
  const rightOrgKey = $("#compareOrgRight")?.value || "";
  try {
    await saveLastComparePair({ leftOrgKey, rightOrgKey });
  } catch {
    /* ignore storage failures */
  }
}

function onSwapCompareOrgs() {
  const leftSel = $("#compareOrgLeft");
  const rightSel = $("#compareOrgRight");
  if (!leftSel || !rightSel) return;
  const left = leftSel.value;
  const right = rightSel.value;
  leftSel.value = right;
  rightSel.value = left;
  // If either value is invalid/disabled after swap, leave as-is visually
  updateCompareOrgCards();
  renderCompareSessionList();
  persistComparePairSelection().catch(() => {});
  if (state.orgCompare.leftInv && state.orgCompare.rightInv) {
    const tmp = state.orgCompare.leftInv;
    state.orgCompare.leftInv = state.orgCompare.rightInv;
    state.orgCompare.rightInv = tmp;
    const tmpOrg = state.orgCompare.left;
    state.orgCompare.left = state.orgCompare.right;
    state.orgCompare.right = tmpOrg;
    if (state.orgCompare.tab === "onlyA") state.orgCompare.tab = "onlyB";
    else if (state.orgCompare.tab === "onlyB") state.orgCompare.tab = "onlyA";
    rerunOrgCompareDiff();
  }
}

function setCompareProgress(pct, label) {
  const wrap = $("#compareProgress");
  const bar = $("#compareProgressBar");
  const lab = $("#compareProgressLabel");
  if (!wrap || !bar) return;
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  state.orgCompare.progress = value;
  wrap.classList.remove("hidden");
  wrap.setAttribute("aria-hidden", "false");
  bar.style.width = `${value}%`;
  if (lab) lab.textContent = label || "";
}

function hideCompareProgress() {
  const wrap = $("#compareProgress");
  if (!wrap) return;
  wrap.classList.add("hidden");
  wrap.setAttribute("aria-hidden", "true");
  state.orgCompare.progress = 0;
}

function setCompareTab(tab) {
  const next = tab || "onlyA";
  state.orgCompare.tab = next;
  document.querySelectorAll("#compareTabs [data-compare-tab]").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-compare-tab") === next);
  });
  document.querySelectorAll("#compareSummary [data-compare-tab]").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-compare-tab") === next);
  });
  renderOrgCompareResults();
}

function renderCompareCategoryPicker() {
  const root = $("#compareCategoryList");
  if (!root) return;
  const selected = new Set(state.orgCompare.selectedCategories || defaultCompareCategoryIds());
  root.innerHTML = COMPARE_CATEGORIES.map((cat) => {
    const checked = selected.has(cat.id) ? "checked" : "";
    return `<label class="compare-cat-chip">
      <input type="checkbox" data-compare-cat="${escapeHtml(cat.id)}" ${checked} />
      <span class="compare-cat-chip-text">
        <strong>${escapeHtml(cat.label)}</strong>
        <span>${escapeHtml(cat.blurb)}</span>
      </span>
    </label>`;
  }).join("");
}

function selectedCompareCategories() {
  const fromState = state.orgCompare.selectedCategories;
  if (Array.isArray(fromState) && fromState.length) return [...fromState];
  // Fallback to checked boxes in case state drifted
  const boxes = [...document.querySelectorAll("#compareCategoryList input[data-compare-cat]:checked")];
  const ids = boxes.map((b) => b.getAttribute("data-compare-cat")).filter(Boolean);
  return ids.length ? ids : defaultCompareCategoryIds();
}

async function onRunOrgCompare() {
  const status = $("#compareStatus");
  const leftKey = $("#compareOrgLeft")?.value;
  const rightKey = $("#compareOrgRight")?.value;
  const left = getCompareOrgByKey(leftKey);
  const right = getCompareOrgByKey(rightKey);

  if (!left?.tabUrl || !right?.tabUrl) {
    if (status) status.textContent = "Select two Salesforce orgs with active sessions.";
    return;
  }
  if (left.orgKey === right.orgKey) {
    if (status) status.textContent = "Pick two different orgs (A and B must differ).";
    return;
  }
  if (!left.hasSession || !right.hasSession) {
    if (status) status.textContent = "Both orgs need a session cookie. Open a logged-in tab for each.";
    return;
  }

  const categories = selectedCompareCategories();
  if (!categories.length) {
    if (status) status.textContent = "Select at least one compare category (e.g. Objects, Profiles, Permission sets).";
    return;
  }
  state.orgCompare.selectedCategories = categories;

  const mode = $("#compareMode")?.value || "custom";
  state.orgCompare.running = true;
  state.orgCompare.left = left;
  state.orgCompare.right = right;
  state.orgCompare.categoryFilter = "";
  setCompareChromeVisible(false);
  await persistComparePairSelection();
  const catLabels = categories
    .map((id) => COMPARE_CATEGORIES.find((c) => c.id === id)?.label || id)
    .join(", ");
  setCompareProgress(8, `Starting compare: ${left.envLabel || "A"} vs ${right.envLabel || "B"}…`);
  if (status) {
    status.textContent = `Comparing ${catLabels} on ${left.label} vs ${right.label}…`;
  }

  try {
    const apiVer = apiVersion();
    let leftDone = false;
    let rightDone = false;
    const mark = (side) => {
      if (side === "left") leftDone = true;
      if (side === "right") rightDone = true;
      const done = (leftDone ? 1 : 0) + (rightDone ? 1 : 0);
      const pct = 15 + done * 35;
      const label = !leftDone
        ? `Fetching A (${left.envLabel || "Org A"})…`
        : !rightDone
          ? `Fetching B (${right.envLabel || "Org B"})…`
          : "Diffing inventories…";
      setCompareProgress(pct, label);
    };

    const payload = {
      mode,
      apiVersion: apiVer,
      categories
    };
    const leftPromise = send("fetchCompareBundle", {
      tabUrl: left.tabUrl,
      ...payload
    }).then((r) => {
      mark("left");
      return r;
    });
    const rightPromise = send("fetchCompareBundle", {
      tabUrl: right.tabUrl,
      ...payload
    }).then((r) => {
      mark("right");
      return r;
    });

    const [leftRes, rightRes] = await Promise.all([leftPromise, rightPromise]);
    if (!leftRes.ok) throw new Error(`Org A: ${leftRes.error || "inventory failed"}`);
    if (!rightRes.ok) throw new Error(`Org B: ${rightRes.error || "inventory failed"}`);

    setCompareProgress(92, "Building side-by-side diff…");
    state.orgCompare.leftInv = leftRes.result;
    state.orgCompare.rightInv = rightRes.result;
    rerunOrgCompareDiff();
    setCompareProgress(100, "Compare complete");

    const errCount =
      (leftRes.result.errors?.length || 0) + (rightRes.result.errors?.length || 0);
    const truncKeys = [
      ...Object.keys(leftRes.result.truncated || {}),
      ...Object.keys(rightRes.result.truncated || {})
    ];
    const trunc = truncKeys.length ? ` Truncated: ${[...new Set(truncKeys)].join(", ")}.` : "";
    const counts = summarizeBundleCounts(leftRes.result, rightRes.result);
    if (status) {
      status.textContent = `Compared ${counts}.${errCount ? ` ${errCount} fetch note(s).` : ""}${trunc}`;
    }
  } catch (e) {
    hideCompareProgress();
    if (status) status.textContent = e.message || String(e);
    $("#compareResults").innerHTML = `<div class="compare-empty">${escapeHtml(e.message || String(e))}</div>`;
  } finally {
    state.orgCompare.running = false;
    setTimeout(() => {
      if (!state.orgCompare.running) hideCompareProgress();
    }, 700);
  }
}

function summarizeBundleCounts(left, right) {
  const ids = new Set([
    ...Object.keys(left?.categoryCounts || {}),
    ...Object.keys(right?.categoryCounts || {}),
    ...Object.keys(left?.categories || {}),
    ...Object.keys(right?.categories || {})
  ]);
  const parts = [];
  for (const id of [...ids].sort()) {
    const label = COMPARE_CATEGORIES.find((c) => c.id === id)?.label || id;
    const a = left?.categoryCounts?.[id] ?? Object.keys(left?.categories?.[id]?.items || {}).length;
    const b = right?.categoryCounts?.[id] ?? Object.keys(right?.categories?.[id]?.items || {}).length;
    parts.push(`${label} ${a}/${b}`);
  }
  return parts.join(" · ") || "selected categories";
}

function rerunOrgCompareDiff() {
  const leftInv = state.orgCompare.leftInv;
  const rightInv = state.orgCompare.rightInv;
  if (!leftInv || !rightInv) return;
  const customFieldsOnly = !!$("#compareCustomFieldsOnly")?.checked;
  const categories = selectedCompareCategories();
  state.orgCompare.raw = compareBundles(leftInv, rightInv, { customFieldsOnly, categories });
  setCompareChromeVisible(true);
  renderOrgCompareSummary();
  renderCompareCategoryFilter();
  updateCompareTabLabels();
  setCompareTab(state.orgCompare.tab || "onlyA");
}

function setCompareChromeVisible(visible) {
  $("#compareSummary")?.classList.toggle("hidden", !visible);
  $("#compareCategoryFilter")?.classList.toggle("hidden", !visible);
  $("#compareTabs")?.classList.toggle("hidden", !visible);
  $("#compareFilter")?.classList.toggle("hidden", !visible);
  $("#compareActions")?.classList.toggle("hidden", !visible);
}

function compareEnvLabels() {
  const left = state.orgCompare.leftInv || state.orgCompare.left;
  const right = state.orgCompare.rightInv || state.orgCompare.right;
  return {
    a: left?.envLabel || "A",
    b: right?.envLabel || "B"
  };
}

function updateCompareTabLabels() {
  const raw = state.orgCompare.raw;
  if (!raw) return;
  const s = raw.summary || {};
  const { a, b } = compareEnvLabels();
  const labels = {
    onlyA: `Only in ${a} (${s.onlyA ?? 0})`,
    onlyB: `Only in ${b} (${s.onlyB ?? 0})`,
    differ: `Differ (${s.differ ?? 0})`
  };
  document.querySelectorAll("#compareTabs [data-compare-tab]").forEach((btn) => {
    const key = btn.getAttribute("data-compare-tab");
    if (key && labels[key]) btn.textContent = labels[key];
  });
}

function renderOrgCompareSummary() {
  const el = $("#compareSummary");
  const raw = state.orgCompare.raw;
  if (!el || !raw) return;
  const s = raw.summary || {};
  const { a, b } = compareEnvLabels();
  const tab = state.orgCompare.tab || "onlyA";
  const byCat = s.byCategory || {};
  const catBits = Object.entries(byCat)
    .map(([id, row]) => {
      const drift = (row.onlyA || 0) + (row.onlyB || 0) + (row.differ || 0);
      return `<div class="compare-stat compare-stat-static" title="${escapeHtml(row.label || id)}">
        <strong>${drift}</strong>${escapeHtml(row.label || id)} drift
      </div>`;
    })
    .join("");
  el.innerHTML = `
    <button type="button" class="compare-stat ${tab === "onlyA" ? "active" : ""}" data-compare-tab="onlyA" title="Show items only in A">
      <strong>${s.onlyA ?? 0}</strong>Only in ${escapeHtml(a)}
    </button>
    <button type="button" class="compare-stat ${tab === "onlyB" ? "active" : ""}" data-compare-tab="onlyB" title="Show items only in B">
      <strong>${s.onlyB ?? 0}</strong>Only in ${escapeHtml(b)}
    </button>
    <button type="button" class="compare-stat ${tab === "differ" ? "active" : ""}" data-compare-tab="differ" title="Show items that differ">
      <strong>${s.differ ?? 0}</strong>Differ
    </button>
    <div class="compare-stat compare-stat-static"><strong>${s.sameObjects ?? 0}</strong>Same</div>
    ${catBits}
  `;
}

function renderCompareCategoryFilter() {
  const el = $("#compareCategoryFilter");
  const raw = state.orgCompare.raw;
  if (!el || !raw) return;
  const byCat = raw.summary?.byCategory || {};
  const ids = Object.keys(byCat);
  if (!ids.length) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  const current = state.orgCompare.categoryFilter || "";
  const buttons = [
    `<button type="button" class="compare-cat-filter-btn ${!current ? "active" : ""}" data-compare-category-filter="">All categories</button>`
  ];
  for (const id of ids) {
    const row = byCat[id];
    const drift = (row.onlyA || 0) + (row.onlyB || 0) + (row.differ || 0);
    buttons.push(
      `<button type="button" class="compare-cat-filter-btn ${current === id ? "active" : ""}" data-compare-category-filter="${escapeHtml(id)}">${escapeHtml(row.label || id)} (${drift})</button>`
    );
  }
  el.innerHTML = buttons.join("");
}

function getFilteredCompareBucket() {
  const raw = state.orgCompare.raw;
  if (!raw) return [];
  const filtered = filterCompareResults(raw, {
    query: $("#compareFilter")?.value || "",
    customOnly: false,
    category: state.orgCompare.categoryFilter || ""
  });
  const tab = state.orgCompare.tab || "onlyA";
  if (tab === "onlyB") return filtered.onlyB || [];
  if (tab === "differ") return filtered.differ || [];
  return filtered.onlyA || [];
}

function compareRowCategoryBadge(row) {
  const label = row.categoryLabel || row.category || "";
  if (!label) return "";
  return `<span class="compare-cat-badge">${escapeHtml(label)}</span>`;
}

function renderNamedDetail(detail) {
  const entries = Object.entries(detail || {}).filter(([, v]) => v != null && String(v) !== "");
  if (!entries.length) return "";
  return `<div class="compare-named-detail">${entries
    .map(([k, v]) => `<span><em>${escapeHtml(k)}</em> ${escapeHtml(String(v))}</span>`)
    .join("")}</div>`;
}

function renderOrgCompareResults() {
  const root = $("#compareResults");
  if (!root) return;
  if (!state.orgCompare.raw) {
    root.innerHTML = "";
    return;
  }
  const rows = getFilteredCompareBucket();
  const tab = state.orgCompare.tab || "onlyA";
  const { a, b } = compareEnvLabels();
  if (!rows.length) {
    root.innerHTML = `<div class="compare-empty">No differences in this bucket${
      ($("#compareFilter")?.value || "").trim() || state.orgCompare.categoryFilter
        ? " for the current filter"
        : ""
    }.</div>`;
    return;
  }

  if (tab === "differ") {
    root.innerHTML = rows
      .map((row) => {
        if (row.kind === "named-diff" || row.attrDiffs) {
          const attrRows = row.attrDiffs || [];
          return `<div class="compare-row">
            <div class="compare-row-head">
              ${compareRowCategoryBadge(row)}
              <code>${escapeHtml(row.object)}</code>
              <span class="muted">${escapeHtml(row.label || "")}</span>
            </div>
            <div class="compare-sbs">
              <div class="compare-sbs-head"><span>Attribute</span><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></div>
              ${attrRows
                .map(
                  (r) =>
                    `<div class="compare-sbs-row compare-sbs-attr"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.left)}</span><span>${escapeHtml(r.right)}</span></div>`
                )
                .join("")}
            </div>
          </div>`;
        }

        const parts = [];
        if (row.onlyA?.length) {
          parts.push(
            `<div class="compare-field-block"><div class="compare-field-block-title">Only in ${escapeHtml(a)}</div><ul class="compare-field-list">${row.onlyA
              .map(
                (f) =>
                  `<li><code>${escapeHtml(f.name)}</code> · ${escapeHtml(formatFieldShort(f.field))}</li>`
              )
              .join("")}</ul></div>`
          );
        }
        if (row.onlyB?.length) {
          parts.push(
            `<div class="compare-field-block"><div class="compare-field-block-title">Only in ${escapeHtml(b)}</div><ul class="compare-field-list">${row.onlyB
              .map(
                (f) =>
                  `<li><code>${escapeHtml(f.name)}</code> · ${escapeHtml(formatFieldShort(f.field))}</li>`
              )
              .join("")}</ul></div>`
          );
        }
        if (row.differ?.length) {
          parts.push(
            `<div class="compare-field-block"><div class="compare-field-block-title">Field diffs (side by side)</div>
            <div class="compare-sbs">
              <div class="compare-sbs-head"><span>Field</span><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></div>
              ${row.differ
                .map((f) => {
                  const attrRows = fieldSideBySideRows(f.left, f.right);
                  const body = attrRows.length
                    ? attrRows
                        .map(
                          (r) =>
                            `<div class="compare-sbs-row compare-sbs-attr"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.left)}</span><span>${escapeHtml(r.right)}</span></div>`
                        )
                        .join("")
                    : `<div class="compare-sbs-row compare-sbs-attr"><span>detail</span><span>${escapeHtml(formatFieldShort(f.left))}</span><span>${escapeHtml(formatFieldShort(f.right))}</span></div>`;
                  return `<div class="compare-sbs-field">
                    <div class="compare-sbs-row compare-sbs-field-name"><span><code>${escapeHtml(f.name)}</code></span><span>${escapeHtml(f.left?.label || "")}</span><span>${escapeHtml(f.right?.label || "")}</span></div>
                    ${body}
                  </div>`;
                })
                .join("")}
            </div></div>`
          );
        }
        return `<div class="compare-row">
          <div class="compare-row-head">
            ${compareRowCategoryBadge(row)}
            <code>${escapeHtml(row.object)}</code>
            <span class="muted">${escapeHtml(row.label || "")}</span>
          </div>
          ${parts.join("")}
        </div>`;
      })
      .join("");
    return;
  }

  root.innerHTML = rows
    .map((row) => {
      if (row.kind === "named") {
        return `<div class="compare-row">
          <div class="compare-row-head">
            ${compareRowCategoryBadge(row)}
            <code>${escapeHtml(row.object)}</code>
            <span class="muted">${escapeHtml(row.label || "")}</span>
          </div>
          ${renderNamedDetail(row.detail)}
        </div>`;
      }
      return `<div class="compare-row">
        <div class="compare-row-head">
          ${compareRowCategoryBadge(row)}
          <code>${escapeHtml(row.object)}</code>
          <span class="muted">${escapeHtml(row.label || "")}${
            row.fieldCount != null ? ` · ${row.fieldCount} fields` : ""
          }</span>
        </div>
      </div>`;
    })
    .join("");
}

async function onCopyCompareApiNames() {
  const rows = getFilteredCompareBucket();
  const names = collectApiNames(rows, "all");
  if (!names.length) return;
  await copyText(names.join("\\n"));
  const status = $("#compareStatus");
  if (status) status.textContent = `Copied ${names.length} API name(s).`;
}

async function onCopyComparePackageMembers() {
  const rows = getFilteredCompareBucket();
  const xml = toPackageTypesFromRows(rows);
  if (!xml) {
    // Fallback for object-only rows
    const objectNames = [...new Set(rows.map((r) => r.packageMember || r.object).filter(Boolean))];
    const fallback = toPackageMemberList(objectNames, "CustomObject");
    if (!fallback) return;
    await copyText(fallback);
    const status = $("#compareStatus");
    if (status) status.textContent = `Copied package.xml members (${objectNames.length}).`;
    return;
  }
  await copyText(xml);
  const status = $("#compareStatus");
  if (status) status.textContent = `Copied package.xml member list for ${rows.length} row(s).`;
}

async function onSearchMeta() {
  const query = $("#metaQuery").value.trim();
  const typeId = $("#metaType").value || null;
  $("#metaResults").innerHTML = `<div class="summary-bar">Searching…</div>`;
  try {
    const res = await send("searchMetadata", {
      tabUrl: await requireTabUrl(),
      query,
      typeId,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    const hits = (res.result.results || []).filter((r) => !r.error && r.name);
    const errors = (res.result.results || []).filter((r) => r.error);
    if (!hits.length) {
      $("#metaResults").innerHTML = `<div class="finding medium"><p>No matches.${errors[0] ? " " + escapeHtml(errors[0].typeLabel + ": " + errors[0].error) : ""}</p></div>`;
      return;
    }
    $("#metaResults").innerHTML =
      `<div class="summary-bar">${hits.length} match(es)</div>` +
      hits
        .map(
          (h, i) => `<div class="finding info">
          <strong>${escapeHtml(h.typeLabel)} · ${escapeHtml(h.name)}</strong>
          <p>${h.lastModifiedDate ? escapeHtml(h.lastModifiedDate) : ""}</p>
          <button type="button" class="btn" data-meta-open="${i}">Open in Setup</button>
        </div>`
        )
        .join("");
    $("#metaResults").querySelectorAll("[data-meta-open]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const h = hits[Number(btn.getAttribute("data-meta-open"))];
        const base = lightningBaseFromOrg(state.org) || state.org?.origin;
        const url = h.openPath.startsWith("http") ? h.openPath : `${base}${h.openPath}`;
        await chrome.tabs.create({ url });
        await trackActivity({
          type: "meta",
          title: `${h.typeLabel} · ${h.name}`,
          detail: query || h.name,
          view: "meta-open",
          payload: { query, typeId: typeId || "", name: h.name }
        });
      });
    });
  } catch (e) {
    $("#metaResults").innerHTML = `<div class="finding high"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

async function onLoadPackageMembers() {
  const typeName = $("#packageType").value;
  $("#packageMembers").innerHTML = `<div class="hint">Loading…</div>`;
  try {
    const res = await send("listPackageTypeMembers", {
      tabUrl: await requireTabUrl(),
      typeName,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    state.packageMembersCache = (res.result.members || []).map((m) => ({
      ...m,
      type: res.result.type
    }));
    renderPackageMembers();
    renderPackageSelection();
  } catch (e) {
    $("#packageMembers").innerHTML = `<div class="finding high"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

function renderPackageMembers() {
  const root = $("#packageMembers");
  const q = ($("#packageMemberFilter").value || "").trim().toLowerCase();
  const members = state.packageMembersCache.filter(
    (m) => !q || m.member.toLowerCase().includes(q) || (m.label || "").toLowerCase().includes(q)
  );
  if (!state.packageMembersCache.length) {
    root.innerHTML = `<div class="hint">Load a metadata type to multi-select members.</div>`;
    return;
  }
  root.innerHTML = members
    .map((m) => {
      const checked = state.packageSelections.some((s) => s.type === m.type && s.member === m.member);
      return `<label class="pkg-item"><input type="checkbox" data-type="${escapeHtml(m.type)}" data-member="${escapeHtml(m.member)}" ${checked ? "checked" : ""}/> <span><code>${escapeHtml(m.member)}</code></span></label>`;
    })
    .join("");
  root.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      const type = input.getAttribute("data-type");
      const member = input.getAttribute("data-member");
      if (input.checked) {
        if (!state.packageSelections.some((s) => s.type === type && s.member === member)) {
          state.packageSelections.push({ type, member });
        }
      } else {
        state.packageSelections = state.packageSelections.filter(
          (s) => !(s.type === type && s.member === member)
        );
      }
      renderPackageSelection();
    });
  });
}

function renderPackageSelection() {
  const grouped = {};
  for (const s of state.packageSelections) {
    grouped[s.type] = grouped[s.type] || [];
    grouped[s.type].push(s.member);
  }
  const parts = Object.entries(grouped).map(([t, ms]) => `${t}(${ms.length})`);
  $("#packageSelection").textContent = parts.length
    ? `Selected: ${parts.join(", ")}`
    : "Nothing selected yet.";
}

function onGenPackageXml() {
  if (!state.packageSelections.length) {
    $("#packageXmlOut").textContent = "Select at least one member.";
    return;
  }
  state.lastPackageXml = buildPackageXml(state.packageSelections, packageVersion(apiVersion()));
  $("#packageXmlOut").textContent = state.lastPackageXml;
}

async function onLoadInactiveFlows(scanField) {
  $("#flowCleanStatus").textContent = scanField
    ? "Loading inactive versions and scanning metadata for field references…"
    : "Loading inactive flow versions…";
  $("#flowCleanOut").innerHTML = "";
  $("#flowCleanList").innerHTML = `<div class="hint">Loading…</div>`;
  try {
    const needle = buildFieldReferenceHint($("#flowCleanObject").value, $("#flowCleanField").value);
    const res = await send("listInactiveFlowVersions", {
      tabUrl: await requireTabUrl(),
      // Only apply field needle when scanning; otherwise use the list filter box only.
      needle: scanField ? needle : "",
      includeMetadata: Boolean(scanField && needle),
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    state.inactiveFlows = res.result.versions || [];
    state.inactiveFlowSelected = [];
    $("#flowCleanStatus").textContent = `Loaded ${res.result.matched}/${res.result.total} inactive version(s)${
      scanField && needle ? ` · field scan: ${needle}` : ""
    }${res.result.scannedMetadata ? " · metadata scanned" : ""}`;
    renderInactiveFlows();
  } catch (e) {
    $("#flowCleanList").innerHTML = "";
    $("#flowCleanStatus").textContent = e.message;
  }
}

function renderInactiveFlows() {
  const root = $("#flowCleanList");
  const q = ($("#flowCleanFilter").value || "").trim().toLowerCase();
  const rows = state.inactiveFlows.filter((f) => {
    if (!q) return true;
    return [f.label, f.definitionName, f.status, String(f.versionNumber || "")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  if (!state.inactiveFlows.length) {
    root.innerHTML = `<div class="hint">No inactive versions loaded.</div>`;
    return;
  }
  root.innerHTML = rows
    .map((f) => {
      const checked = state.inactiveFlowSelected.includes(f.id);
      return `<label class="pkg-item">
        <input type="checkbox" data-flow-id="${escapeHtml(f.id)}" ${checked ? "checked" : ""} ${f.canDelete ? "" : "disabled"} />
        <span><code>v${escapeHtml(String(f.versionNumber ?? "?"))}</code> ${escapeHtml(f.label)}
        <br/><span style="color:var(--muted);font-size:11px">${escapeHtml(f.definitionName || "")} · ${escapeHtml(f.status)} · ${escapeHtml(f.processType || "")}</span></span>
      </label>`;
    })
    .join("");
  root.querySelectorAll("input[data-flow-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.getAttribute("data-flow-id");
      if (input.checked) {
        if (!state.inactiveFlowSelected.includes(id)) state.inactiveFlowSelected.push(id);
      } else {
        state.inactiveFlowSelected = state.inactiveFlowSelected.filter((x) => x !== id);
      }
      $("#flowCleanStatus").textContent = `Selected ${state.inactiveFlowSelected.length} version(s)`;
    });
  });
}

async function onDeleteInactiveFlows() {
  if (!state.inactiveFlowSelected.length) {
    $("#flowCleanStatus").textContent = "Select at least one inactive version.";
    return;
  }
  const names = state.inactiveFlows
    .filter((f) => state.inactiveFlowSelected.includes(f.id))
    .map((f) => `v${f.versionNumber} ${f.label} (${f.status})`)
    .slice(0, 15);
  const ok = confirm(
    `Delete ${state.inactiveFlowSelected.length} inactive flow version(s)?\n\n${names.join("\n")}${
      state.inactiveFlowSelected.length > 15 ? "\n…" : ""
    }\n\nActive versions are never deleted. This cannot be undone.`
  );
  if (!ok) return;

  $("#flowCleanStatus").textContent = "Deleting…";
  try {
    const res = await send("deleteFlowVersions", {
      tabUrl: await requireTabUrl(),
      ids: state.inactiveFlowSelected,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    const { deleted, failed, results } = res.result;
    $("#flowCleanOut").innerHTML =
      `<div class="summary-bar">Deleted ${deleted}, failed ${failed}</div>` +
      results
        .map(
          (r) =>
            `<div class="finding ${r.ok ? "info" : "high"}"><span class="tag">${r.ok ? "deleted" : "failed"}</span><p>${escapeHtml(
              r.label || r.id
            )}${r.error ? " — " + escapeHtml(r.error) : ""}</p></div>`
        )
        .join("");
    // refresh list
    await onLoadInactiveFlows(false);
  } catch (e) {
    $("#flowCleanStatus").textContent = e.message;
  }
}

/* —— Utilities (links / soql / ids / favs) —— */

function renderLinks(filter = "") {
  const q = filter.trim().toLowerCase();
  const root = $("#linkList");
  root.innerHTML = "";
  QUICK_LINKS.forEach((group) => {
    const items = group.items.filter((i) => !q || i.label.toLowerCase().includes(q) || i.id.includes(q));
    if (!items.length) return;
    const title = document.createElement("div");
    title.className = "group-title";
    title.textContent = group.group;
    root.appendChild(title);
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "link-item";
      btn.textContent = item.label;
      btn.addEventListener("click", () => openQuickLink(item));
      root.appendChild(btn);
    });
  });
}

async function openQuickLink(item) {
  if (item.external) {
    await chrome.tabs.create({ url: item.path });
    return;
  }
  if (!state.org) {
    alert("Open a Salesforce org tab first.");
    return;
  }
  let url;
  if (item.path.startsWith("http")) url = item.path;
  else if (item.path.startsWith("/_ui/")) url = `${state.session?.apiBase || state.org.apiBase}${item.path}`;
  else {
    const lightningHost = state.org.hostname.includes("lightning.force.com")
      ? state.org.origin
      : state.org.origin.replace(".my.salesforce.com", ".lightning.force.com");
    url = `${lightningHost}${item.path}`;
  }
  if (item.newTab) await chrome.tabs.create({ url });
  else if (state.tab?.id) {
    await chrome.tabs.update(state.tab.id, { url });
    window.close();
  } else await chrome.tabs.create({ url });
}

async function runSoqlManual() {
  const panel = $("#soqlQueryPanel");
  const status = $("#soqlQueryStatus");
  clearQueryResult(panel, status, "soql", "Running…", "busy");
  hideSoqlSuggest();
  try {
    await ensureSalesforceSiteAccess();
    const tooling = soqlApiMode() === "tooling";
    const query = $("#soqlInput").value;
    const res = await send(tooling ? "toolingQuery" : "runSoql", {
      tabUrl: await requireTabUrl(),
      query,
      apiVersion: apiVersion()
    });
    if (!res.ok) throw new Error(res.error);
    renderQueryResult(panel, status, "soql", res.result, query);
    const from = String(query).match(/\bFROM\s+([A-Za-z][A-Za-z0-9_]*)/i)?.[1] || "Query";
    await trackActivity({
      type: "soql",
      title: tooling ? `Tooling · ${from}` : from,
      detail: String(query).replace(/\s+/g, " ").trim(),
      view: "soql-run",
      payload: { soql: query, apiMode: tooling ? "tooling" : "rest" }
    });
  } catch (e) {
    clearQueryResult(panel, status, "soql", e.message, "error");
  }
}

function soqlApiMode() {
  return $("#soqlApiMode")?.value === "tooling" ? "tooling" : "rest";
}

function bindSoqlAssist() {
  const input = $("#soqlInput");
  const mode = $("#soqlApiMode");
  const obj = $("#soqlObjectHint");
  const loadBtn = $("#soqlLoadFields");
  if (!input || !mode) return;

  mode.addEventListener("change", () => {
    onSoqlApiModeChange().catch((e) => {
      setQueryStatus($("#soqlQueryStatus"), e.message, "error");
    });
  });
  loadBtn?.addEventListener("click", () => {
    ensureSoqlFieldsForActiveObject(true)
      .then(() => refreshSoqlSuggestions())
      .catch((e) => {
        setQueryStatus($("#soqlQueryStatus"), e.message, "error");
      });
  });
  obj?.addEventListener("change", () => {
    const name = (obj.value || "").trim();
    if (!isValidSObjectName(name)) return;
    seedSoqlFromObject(name);
    ensureSoqlFieldsForActiveObject(true)
      .then(() => refreshSoqlSuggestions())
      .catch(() => {});
  });
  obj?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadBtn?.click();
    }
  });

  let timer = null;
  const schedule = () => {
    // User is typing again — allow suggestions to reopen.
    state.soqlAssist.suppressSuggest = false;
    clearTimeout(timer);
    clearTimeout(state.soqlAssist.suggestTimer);
    timer = setTimeout(() => {
      refreshSoqlSuggestions();
      ensureSoqlFieldsForActiveObject(false).catch(() => {});
    }, 120);
    state.soqlAssist.suggestTimer = timer;
  };
  input.addEventListener("input", schedule);
  input.addEventListener("click", () => {
    // Click reposition: refresh only if not just closed by a pick.
    if (state.soqlAssist.suppressSuggest) return;
    schedule();
  });
  input.addEventListener("keyup", (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) return;
    schedule();
  });
  input.addEventListener("keydown", onSoqlSuggestKeydown);
  input.addEventListener("blur", () => {
    setTimeout(() => hideSoqlSuggest(), 150);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.(".soql-editor")) hideSoqlSuggest();
  });
}

async function onSoqlApiModeChange() {
  state.soqlAssist.mode = soqlApiMode();
  state.soqlAssist.objectNames = [];
  state.soqlAssist.activeObject = null;
  const hint = $("#soqlAssistHint");
  if (hint) {
    hint.textContent =
      state.soqlAssist.mode === "tooling"
        ? "Tooling API — suggestions use tooling objects and fields."
        : "Standard API — suggestions use org objects and fields.";
  }
  const obj = $("#soqlObjectHint");
  if (obj) {
    obj.placeholder =
      state.soqlAssist.mode === "tooling" ? "Object API name" : "Object API name";
  }
  await ensureSoqlObjectList(true);
  await ensureSoqlFieldsForActiveObject(true);
  refreshSoqlSuggestions();
}

async function ensureSoqlObjectList(force = false) {
  const mode = soqlApiMode();
  if (!force && state.soqlAssist.objectNames.length && state.soqlAssist.mode === mode) {
    fillSoqlObjectDatalist();
    return;
  }
  state.soqlAssist.mode = mode;
  try {
    await ensureSalesforceSiteAccess();
    const res = await send("describeGlobal", {
      tabUrl: await requireTabUrl(),
      apiVersion: apiVersion(),
      tooling: mode === "tooling"
    });
    if (!res.ok) throw new Error(res.error);
    const sobjects = res.result?.sobjects || [];
    state.soqlAssist.objectNames = sobjects
      .map((o) => o.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    fillSoqlObjectDatalist();
    const status = $("#soqlQueryStatus");
    if (status && !status.textContent) {
      status.textContent = `${state.soqlAssist.objectNames.length} ${mode === "tooling" ? "Tooling" : "standard"} objects available for autocomplete.`;
    }
  } catch (e) {
    /* leave list empty; user can still type */
    fillSoqlObjectDatalist();
    throw e;
  }
}

function fillSoqlObjectDatalist() {
  const list = $("#soqlObjectList");
  if (!list) return;
  list.replaceChildren();
  for (const name of state.soqlAssist.objectNames) {
    const opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  }
}

function resolveSoqlObjectName() {
  const fromQuery = extractFromObject($("#soqlInput")?.value || "");
  const hint = ($("#soqlObjectHint")?.value || "").trim();
  if (fromQuery && isValidSObjectName(fromQuery)) return fromQuery;
  if (hint && isValidSObjectName(hint)) return hint;
  return null;
}

function fieldCacheKey(objectName) {
  return `${soqlApiMode()}:${objectName}`;
}

async function ensureSoqlFieldsForActiveObject(force = false) {
  const objectName = resolveSoqlObjectName();
  if (!objectName) return null;
  const key = fieldCacheKey(objectName);
  if (!force && state.soqlAssist.fieldsByKey[key]) {
    state.soqlAssist.activeObject = objectName;
    return state.soqlAssist.fieldsByKey[key];
  }
  const seq = ++state.soqlAssist.loadSeq;
  const hintEl = $("#soqlAssistHint");
  if (hintEl) hintEl.textContent = `Loading fields for ${objectName}…`;
  await ensureSalesforceSiteAccess();
  const res = await send("describeSObject", {
    tabUrl: await requireTabUrl(),
    sobject: objectName,
    apiVersion: apiVersion(),
    tooling: soqlApiMode() === "tooling"
  });
  if (!res.ok) throw new Error(res.error);
  if (seq !== state.soqlAssist.loadSeq) return null;
  const fields = (res.result?.fields || []).map((f) => ({
    name: f.name,
    label: f.label,
    type: f.type
  }));
  state.soqlAssist.fieldsByKey[key] = fields;
  state.soqlAssist.activeObject = objectName;
  if ($("#soqlObjectHint") && !$("#soqlObjectHint").value) {
    $("#soqlObjectHint").value = objectName;
  }
  if (hintEl) {
    hintEl.textContent = `${objectName} · ${fields.length} fields available for suggestions.`;
  }
  return fields;
}

function seedSoqlFromObject(objectName) {
  const ta = $("#soqlInput");
  if (!ta) return;
  const current = ta.value.trim();
  if (current) {
    if (!extractFromObject(current)) {
      ta.value = `${current.replace(/\s+$/, "")} FROM ${objectName} LIMIT 100`;
    }
    return;
  }
  ta.value = `SELECT Id,  FROM ${objectName} LIMIT 100`;
  // Place cursor after "SELECT Id, "
  const cursor = "SELECT Id, ".length;
  ta.focus();
  ta.setSelectionRange(cursor, cursor);
}

function refreshSoqlSuggestions() {
  const ta = $("#soqlInput");
  const box = $("#soqlSuggest");
  if (!ta || !box) return;
  if (state.soqlAssist.suppressSuggest) {
    hideSoqlSuggest();
    return;
  }
  const tokenInfo = getTokenAtCursor(ta.value, ta.selectionStart);
  state.soqlAssist.token = tokenInfo;

  if (!tokenInfo.context) {
    hideSoqlSuggest();
    return;
  }

  let items = [];
  if (tokenInfo.context === "select") {
    const objectName = resolveSoqlObjectName();
    const fields = objectName ? state.soqlAssist.fieldsByKey[fieldCacheKey(objectName)] : null;
    if (!fields?.length) {
      hideSoqlSuggest();
      return;
    }
    items = filterApiNames(fields, tokenInfo.token, 40);
  } else if (tokenInfo.context === "from") {
    items = filterApiNames(
      state.soqlAssist.objectNames.map((name) => ({ name, label: "", type: "" })),
      tokenInfo.token,
      40
    );
    // Exact object already chosen — close list
    if (
      tokenInfo.token &&
      state.soqlAssist.objectNames.some((n) => n.toLowerCase() === tokenInfo.token.toLowerCase()) &&
      items.length === 1 &&
      items[0].name.toLowerCase() === tokenInfo.token.toLowerCase()
    ) {
      hideSoqlSuggest();
      return;
    }
  }

  state.soqlAssist.suggestions = items;
  state.soqlAssist.activeIndex = 0;
  if (!items.length) {
    hideSoqlSuggest();
    return;
  }
  renderSoqlSuggest();
}

function renderSoqlSuggest() {
  const box = $("#soqlSuggest");
  if (!box) return;
  const items = state.soqlAssist.suggestions;
  box.replaceChildren();
  items.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `soql-suggest-item${idx === state.soqlAssist.activeIndex ? " active" : ""}`;
    btn.setAttribute("role", "option");
    const strong = document.createElement("strong");
    strong.textContent = item.name;
    const span = document.createElement("span");
    span.textContent = [item.label, item.type].filter(Boolean).join(" · ");
    btn.appendChild(strong);
    if (span.textContent) btn.appendChild(span);
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      applySoqlSuggestion(idx);
    });
    box.appendChild(btn);
  });
  box.classList.remove("hidden");
}

function hideSoqlSuggest() {
  const box = $("#soqlSuggest");
  if (box) {
    box.classList.add("hidden");
    box.replaceChildren();
  }
  state.soqlAssist.suggestions = [];
  state.soqlAssist.activeIndex = 0;
}

function onSoqlSuggestKeydown(e) {
  const open = state.soqlAssist.suggestions.length && !$("#soqlSuggest")?.classList.contains("hidden");
  if (!open) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    state.soqlAssist.activeIndex = (state.soqlAssist.activeIndex + 1) % state.soqlAssist.suggestions.length;
    renderSoqlSuggest();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    state.soqlAssist.activeIndex =
      (state.soqlAssist.activeIndex - 1 + state.soqlAssist.suggestions.length) % state.soqlAssist.suggestions.length;
    renderSoqlSuggest();
  } else if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    applySoqlSuggestion(state.soqlAssist.activeIndex);
  } else if (e.key === "Escape") {
    e.preventDefault();
    state.soqlAssist.suppressSuggest = true;
    hideSoqlSuggest();
  }
}

function applySoqlSuggestion(index) {
  const ta = $("#soqlInput");
  const item = state.soqlAssist.suggestions[index];
  const tokenInfo = state.soqlAssist.token;
  if (!ta || !item || !tokenInfo) return;
  const appendComma = tokenInfo.context === "select";
  const { text, cursor } = applySuggestion(ta.value, tokenInfo.start, tokenInfo.end, item.name, {
    appendComma
  });
  ta.value = text;
  ta.focus();
  ta.setSelectionRange(cursor, cursor);

  // Close and stay closed until the user types again (do not auto-reopen).
  state.soqlAssist.suppressSuggest = true;
  clearTimeout(state.soqlAssist.suggestTimer);
  hideSoqlSuggest();

  if (tokenInfo.context === "from") {
    if ($("#soqlObjectHint")) $("#soqlObjectHint").value = item.name;
    ensureSoqlFieldsForActiveObject(true).catch(() => {});
  }
}

/** Ask Chrome for Salesforce host access on a user gesture (fixes “Failed to fetch”). */
async function ensureSalesforceSiteAccess() {
  const origins = [
    "https://*.salesforce.com/*",
    "https://*.force.com/*",
    "https://*.cloudforce.com/*",
    "https://*.salesforce-setup.com/*"
  ];
  try {
    const has = await chrome.permissions.contains({ origins });
    if (has) return true;
    const granted = await chrome.permissions.request({ origins });
    if (!granted) {
      throw new Error(
        "Chrome blocked Salesforce access. Open chrome://extensions → OrgKit → Details → Site access → turn ON each Salesforce domain (or “On all sites”), then Reload the extension."
      );
    }
    return true;
  } catch (e) {
    if (/Chrome blocked Salesforce/.test(e.message || "")) throw e;
    return false;
  }
}

function updateIdInfo() {
  const raw = $("#idInput").value.trim();
  const info = $("#idInfo");
  if (!raw) {
    info.textContent = "Paste a Salesforce ID to decode prefix and convert 15 ↔ 18.";
    return;
  }
  const id18 = raw.length === 15 ? to18(raw) : normalizeSfId(raw);
  const id15 = raw.length >= 15 ? raw.slice(0, 15) : raw;
  const type = decodeKeyPrefix(id15);
  if (!id18 && raw.length !== 15 && raw.length !== 18) {
    info.textContent = "Not a valid 15/18 character Salesforce ID.";
    return;
  }
  info.innerHTML = `<div><strong>Type:</strong> ${type || "Unknown"}</div>
    <div><strong>15:</strong> <code>${id15}</code></div>
    <div><strong>18:</strong> <code>${id18 || to18(id15)}</code></div>`;
}

async function openRecord() {
  if (!state.org) return alert("Open a Salesforce org tab first.");
  const id = normalizeSfId($("#idInput").value.trim()) || $("#idInput").value.trim();
  if (!id) return;
  await chrome.tabs.create({ url: buildRecordUrl(state.org, id, true) });
}

async function copyIdLength(len) {
  const raw = $("#idInput").value.trim();
  if (!raw) return;
  const id15 = raw.slice(0, 15);
  await navigator.clipboard.writeText(len === 15 ? id15 : to18(id15));
}

async function scanPageIds() {
  const list = $("#scannedIds");
  list.innerHTML = "";
  if (!state.tab?.id) {
    list.innerHTML = "<li>Open a Salesforce tab first.</li>";
    return;
  }
  try {
    // Declared content script only — no chrome.scripting permission.
    const res = await chrome.tabs.sendMessage(state.tab.id, { type: "orgkitScanIds" });
    const result = Array.isArray(res?.ids) ? res.ids : [];
    if (!result.length) {
      list.innerHTML = "<li>No IDs found on page text.</li>";
      return;
    }
    result.forEach((id) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="fav-meta"><code>${id}</code> · ${decodeKeyPrefix(id.slice(0, 15)) || "?"}</span>`;
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "Use";
      open.addEventListener("click", () => {
        $("#idInput").value = id;
        updateIdInfo();
      });
      li.appendChild(open);
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = `<li>Scan failed — refresh the Salesforce tab and retry (${escapeHtml(err.message)})</li>`;
  }
}

async function loadFavorites() {
  const data = await chrome.storage.sync.get({ favorites: [] });
  state.favorites = data.favorites || [];
  renderFavorites();
}

function renderFavorites() {
  const list = $("#favList");
  list.innerHTML = "";
  if (!state.favorites.length) {
    list.innerHTML = "<li class='hint'>No favorites yet.</li>";
    return;
  }
  state.favorites.forEach((fav, index) => {
    const li = document.createElement("li");
    const meta = document.createElement("button");
    meta.type = "button";
    meta.className = "fav-meta";
    meta.textContent = fav.label;
    meta.title = fav.url;
    meta.addEventListener("click", () => chrome.tabs.create({ url: fav.url }));
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      state.favorites.splice(index, 1);
      await chrome.storage.sync.set({ favorites: state.favorites });
      renderFavorites();
    });
    li.append(meta, del);
    list.appendChild(li);
  });
}

async function addFavorite() {
  const label = $("#favLabel").value.trim();
  let path = $("#favPath").value.trim();
  if (!label || !path) return;
  if (!path.startsWith("http")) {
    if (!state.org) return alert("Full URL required when no Salesforce tab is open.");
    path = path.startsWith("/") ? `${state.org.origin}${path}` : `${state.org.origin}/${path}`;
  }
  state.favorites.unshift({ label, url: path });
  await chrome.storage.sync.set({ favorites: state.favorites.slice(0, 50) });
  $("#favLabel").value = "";
  $("#favPath").value = "";
  renderFavorites();
}

async function saveCurrentPage() {
  if (!state.tab?.url) return;
  const label = state.tab.title?.replace(/\s*~\s*Salesforce.*$/i, "").trim() || "Current page";
  state.favorites.unshift({ label, url: state.tab.url });
  await chrome.storage.sync.set({ favorites: state.favorites.slice(0, 50) });
  renderFavorites();
  showView("favs");
}

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
