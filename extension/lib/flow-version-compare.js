/**
 * Compare two Flow versions (same org or two orgs).
 * Lists versions via Tooling SOQL; Metadata is fetched per Id (never in bulk).
 * Never touches sid.
 */

import { flowDefinitionApiName, summarizeFlowVersion } from "./flow-cleaner.js";

export const FLOW_ELEMENT_GROUPS = [
  ["start", "Start"],
  ["actionCalls", "Actions"],
  ["assignments", "Assignments"],
  ["collectionProcessors", "Collection processors"],
  ["customErrors", "Custom errors"],
  ["decisions", "Decisions"],
  ["loops", "Loops"],
  ["recordCreates", "Create records"],
  ["recordDeletes", "Delete records"],
  ["recordLookups", "Get records"],
  ["recordUpdates", "Update records"],
  ["screens", "Screens"],
  ["subflows", "Subflows"],
  ["transforms", "Transforms"],
  ["waits", "Waits"],
  ["formulas", "Formulas"],
  ["variables", "Variables"],
  ["constants", "Constants"],
  ["textTemplates", "Text templates"],
  ["dynamicChoiceSets", "Choice sets"]
];

const LAYOUT_KEYS = new Set([
  "locationX",
  "locationY",
  "connector",
  "defaultConnector",
  "nextValueConnector",
  "noMoreValuesConnector",
  "faultConnector"
]);

export function soqlQuoted(value) {
  return `'${String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function soqlLikeNeedle(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export function assertFlowApiName(apiName) {
  const raw = String(apiName || "").trim();
  if (!raw) throw new Error("Enter a flow API name.");
  if (raw.length > 80) throw new Error("Flow API name is too long.");
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(raw)) {
    throw new Error("Flow API name may only use letters, numbers, and underscores.");
  }
  return raw;
}

/**
 * `ns__My_Flow` → namespace + developerName. `My_Flow` stays unpackaged.
 */
export function splitFlowApiName(apiName) {
  const raw = String(apiName || "").trim();
  const m = raw.match(/^([A-Za-z][A-Za-z0-9]*)__([A-Za-z][A-Za-z0-9_]*)$/);
  if (m && !["c", "mdt", "e", "b", "x"].includes(m[2].toLowerCase())) {
    return { namespace: m[1], developerName: m[2], apiName: raw };
  }
  return { namespace: "", developerName: raw, apiName: raw };
}

export function buildFlowVersionsQuery(apiName) {
  const name = assertFlowApiName(apiName);
  const { developerName, apiName: raw } = splitFlowApiName(name);
  const names = [...new Set([developerName, raw].filter(Boolean))];
  const inList = names.map(soqlQuoted).join(", ");
  return `SELECT Id, MasterLabel, Status, VersionNumber, ProcessType, LastModifiedDate, NamespacePrefix, Definition.DeveloperName, Definition.MasterLabel FROM Flow WHERE Definition.DeveloperName IN (${inList}) ORDER BY VersionNumber DESC`;
}

export function buildFlowDefinitionSearchQuery(needle) {
  const q = soqlLikeNeedle(String(needle || "").trim());
  if (!q) {
    return "SELECT ApiName, Label, ProcessType, TriggerType, IsActive, LastModifiedDate FROM FlowDefinitionView ORDER BY LastModifiedDate DESC LIMIT 40";
  }
  return `SELECT ApiName, Label, ProcessType, TriggerType, IsActive, LastModifiedDate FROM FlowDefinitionView WHERE ApiName LIKE '%${q}%' OR Label LIKE '%${q}%' ORDER BY ApiName ASC LIMIT 40`;
}

export function formatFlowVersionChoice(v) {
  const n = v?.versionNumber;
  const ver = n == null || n === "" ? "v?" : String(n).toLowerCase().startsWith("v") ? String(n) : `v${n}`;
  const status = v?.status || "Unknown";
  const label = v?.label || v?.definitionName || "";
  return `${ver} · ${status}${label ? ` · ${label}` : ""}`;
}

/** Prefer live vs previous when comparing two versions of the same flow. */
export function defaultVersionPair(versions = []) {
  const list = Array.isArray(versions) ? versions.filter((v) => v?.id) : [];
  if (!list.length) return { leftId: "", rightId: "" };
  const sorted = [...list].sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber));
  if (sorted.length === 1) return { leftId: sorted[0].id, rightId: sorted[0].id };
  const active = sorted.find((v) => v.isActive || v.status === "Active");
  if (active) {
    const other = sorted.find((v) => v.id !== active.id) || sorted[0];
    return { leftId: other.id, rightId: active.id };
  }
  return { leftId: sorted[1].id, rightId: sorted[0].id };
}

function asArray(value) {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

export function stripFlowLayout(value) {
  if (Array.isArray(value)) return value.map(stripFlowLayout);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (LAYOUT_KEYS.has(key)) continue;
      out[key] = stripFlowLayout(child);
    }
    return out;
  }
  return value;
}

function elementName(el) {
  return String(el?.name || el?.Name || "").trim();
}

function elementLabel(el) {
  return String(el?.label || el?.Label || elementName(el) || "").trim();
}

function elementHint(type, el) {
  if (!el || typeof el !== "object") return "";
  if (type === "start") {
    const obj = el.object || el.objectName || "";
    const trig = el.recordTriggerType || el.triggerType || "";
    return [obj, trig].filter(Boolean).join(" · ");
  }
  if (el.object) return String(el.object);
  if (el.actionName) return String(el.actionName);
  if (el.flowName) return String(el.flowName);
  if (Array.isArray(el.fields) && el.fields.length) {
    return el.fields
      .map((f) => f?.name || f?.fieldText || "")
      .filter(Boolean)
      .slice(0, 6)
      .join(", ");
  }
  if (Array.isArray(el.rules) && el.rules.length) {
    return el.rules.map((r) => r?.name || r?.label || "").filter(Boolean).slice(0, 6).join(", ");
  }
  return elementLabel(el);
}

export function collectFlowElements(metadata = {}) {
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const out = [];
  for (const [key, typeLabel] of FLOW_ELEMENT_GROUPS) {
    if (key === "start") {
      if (!meta.start) continue;
      out.push({
        key: "start:start",
        type: "start",
        typeLabel,
        name: "start",
        label: "Start",
        hint: elementHint("start", meta.start),
        signature: JSON.stringify(stripFlowLayout(meta.start))
      });
      continue;
    }
    for (const el of asArray(meta[key])) {
      const name = elementName(el) || `${key}-${out.length}`;
      out.push({
        key: `${key}:${name}`,
        type: key,
        typeLabel,
        name,
        label: elementLabel(el) || name,
        hint: elementHint(key, el),
        signature: JSON.stringify(stripFlowLayout(el))
      });
    }
  }
  return out;
}

export function flowApiNameFromFullName(fullName) {
  return String(fullName || "").trim().replace(/-\d+$/, "");
}

export function summarizeFlowVersionRecord(record = {}) {
  const meta = record.Metadata && typeof record.Metadata === "object" ? record.Metadata : {};
  const header = summarizeFlowVersion(record);
  const start = meta.start || {};
  return {
    ...header,
    name:
      flowDefinitionApiName(record) ||
      header.definitionName ||
      flowApiNameFromFullName(record.FullName) ||
      "",
    interviewLabel: meta.interviewLabel || "",
    triggerObject: start.object || "",
    triggerType: start.recordTriggerType || start.triggerType || record.ProcessType || "",
    description: String(meta.description || "").slice(0, 240),
    elements: collectFlowElements(meta),
    hasMetadata: Object.keys(meta).length > 0
  };
}

function headerRows(left, right) {
  const keys = [
    ["versionNumber", "Version"],
    ["status", "Status"],
    ["processType", "Process type"],
    ["triggerObject", "Trigger object"],
    ["triggerType", "Trigger"],
    ["label", "Label"]
  ];
  const rows = [];
  for (const [key, label] of keys) {
    const a = left?.[key] == null || left[key] === "" ? "—" : String(left[key]);
    const b = right?.[key] == null || right[key] === "" ? "—" : String(right[key]);
    if (a === b) continue;
    rows.push({ key, label, left: a, right: b });
  }
  return rows;
}

export function diffFlowVersions(left, right) {
  const a = left || {};
  const b = right || {};
  const leftMap = new Map((a.elements || []).map((el) => [el.key, el]));
  const rightMap = new Map((b.elements || []).map((el) => [el.key, el]));
  const names = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const onlyA = [];
  const onlyB = [];
  const changed = [];
  let same = 0;

  for (const key of [...names].sort()) {
    const l = leftMap.get(key);
    const r = rightMap.get(key);
    if (l && !r) {
      onlyA.push(l);
      continue;
    }
    if (r && !l) {
      onlyB.push(r);
      continue;
    }
    if (l.signature === r.signature) {
      same += 1;
      continue;
    }
    changed.push({
      key,
      typeLabel: l.typeLabel || r.typeLabel,
      name: l.name || r.name,
      label: l.label || r.label,
      leftHint: l.hint || "",
      rightHint: r.hint || ""
    });
  }

  const header = headerRows(a, b);
  const total = onlyA.length + onlyB.length + changed.length + header.length;
  const sameOrg = Boolean(a.id && b.id && a.id === b.id);
  return {
    header,
    onlyA,
    onlyB,
    changed,
    same,
    total,
    sameOrg,
    summary: total
      ? `${total} difference${total === 1 ? "" : "s"} · ${same} matching element${same === 1 ? "" : "s"}`
      : `No differences in structure or header · ${same} matching element${same === 1 ? "" : "s"}`
  };
}
