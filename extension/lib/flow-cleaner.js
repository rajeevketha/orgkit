/**
 * Inactive Flow Version Cleaner — find/delete inactive versions that block field deletion.
 */

export const INACTIVE_FLOW_STATUSES = ["Draft", "InvalidDraft", "Obsolete"];

/**
 * @param {object} flow Tooling Flow record
 * @param {string} needle field API name or free text
 */
export function flowMatchesNeedle(flow, needle) {
  const q = String(needle || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    flow.MasterLabel,
    flow.Definition?.DeveloperName,
    flow.Definition?.MasterLabel,
    flow.Status,
    flow.ProcessType,
    String(flow.VersionNumber ?? ""),
    // Metadata may be object or string depending on API
    typeof flow.Metadata === "string" ? flow.Metadata : JSON.stringify(flow.Metadata || {})
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

export function summarizeFlowVersion(flow) {
  return {
    id: flow.Id,
    label: flow.MasterLabel || flow.Definition?.MasterLabel || flow.Definition?.DeveloperName || flow.Id,
    definitionName: flow.Definition?.DeveloperName || null,
    status: flow.Status,
    versionNumber: flow.VersionNumber,
    processType: flow.ProcessType,
    lastModifiedDate: flow.LastModifiedDate,
    isActive: flow.Status === "Active",
    canDelete: INACTIVE_FLOW_STATUSES.includes(flow.Status)
  };
}

/** API name used to match a flow across orgs (Definition.DeveloperName + optional namespace). */
export function flowDefinitionApiName(flow) {
  const dev = String(flow?.Definition?.DeveloperName || "").trim();
  if (!dev) return "";
  const ns = String(flow?.NamespacePrefix || flow?.Definition?.NamespacePrefix || "").trim();
  if (ns && !dev.startsWith(`${ns}__`)) return `${ns}__${dev}`;
  return dev;
}

/**
 * Tooling query for the live version of each flow (one Active row per definition in a healthy org).
 * Do not select Metadata/FullName — Salesforce rejects those in bulk Flow queries.
 */
export function buildActiveFlowsQuery({ includeNamespace = true } = {}) {
  const fields = [
    "Id",
    "MasterLabel",
    "Status",
    "VersionNumber",
    "ProcessType",
    "LastModifiedDate",
    ...(includeNamespace ? ["NamespacePrefix"] : []),
    "Definition.DeveloperName",
    "Definition.MasterLabel"
  ];
  return `SELECT ${fields.join(", ")} FROM Flow WHERE Status = 'Active'`;
}

/**
 * One record per flow API name. If an org has duplicate Active rows, keep the highest VersionNumber.
 */
export function indexActiveFlowVersions(records = []) {
  /** @type {Record<string, ReturnType<typeof summarizeFlowVersion> & { name: string }>} */
  const items = {};
  for (const flow of records || []) {
    const name = flowDefinitionApiName(flow);
    if (!name) continue;
    const summary = summarizeFlowVersion(flow);
    const nextVer = Number(summary.versionNumber);
    const prev = items[name];
    if (prev && Number(prev.versionNumber) >= (Number.isFinite(nextVer) ? nextVer : -1)) continue;
    items[name] = { ...summary, name };
  }
  return items;
}

function formatActiveVersion(versionNumber) {
  if (versionNumber == null || versionNumber === "") return "—";
  const n = String(versionNumber).trim();
  if (!n) return "—";
  return n.toLowerCase().startsWith("v") ? n : `v${n}`;
}

/**
 * Attach the live version number onto definition inventory items.
 * Definitions with no Active row get activeVersion "none".
 */
export function applyActiveVersionsToFlowItems(items = {}, activeByName = {}) {
  const out = {};
  for (const [name, item] of Object.entries(items || {})) {
    out[name] = {
      ...item,
      attrs: { ...(item.attrs || {}) }
    };
  }
  for (const [name, active] of Object.entries(activeByName || {})) {
    const version = formatActiveVersion(active.versionNumber);
    const existing = out[name];
    if (existing) {
      existing.attrs = {
        ...existing.attrs,
        activeVersion: version,
        isActive: "yes",
        processType: existing.attrs.processType || active.processType || ""
      };
    } else {
      out[name] = {
        name,
        label: active.label || name,
        custom: true,
        packageMember: name,
        attrs: {
          label: active.label || "",
          processType: active.processType || "",
          triggerType: "",
          isActive: "yes",
          activeVersion: version
        }
      };
    }
  }
  for (const item of Object.values(out)) {
    if (!item.attrs.activeVersion) {
      item.attrs.activeVersion = item.attrs.isActive === "yes" ? "active (version unknown)" : "none";
    }
  }
  return out;
}

export function buildInactiveFlowsQuery({ includeMetadata = false, limit = 200 } = {}) {
  const fields = [
    "Id",
    "MasterLabel",
    "Status",
    "VersionNumber",
    "ProcessType",
    "LastModifiedDate",
    "Definition.DeveloperName",
    "Definition.MasterLabel"
  ];
  if (includeMetadata) fields.push("Metadata");
  const statuses = INACTIVE_FLOW_STATUSES.map((s) => `'${s}'`).join(", ");
  return `SELECT ${fields.join(", ")} FROM Flow WHERE Status IN (${statuses}) ORDER BY LastModifiedDate DESC LIMIT ${Math.min(limit, 200)}`;
}

export function buildFieldReferenceHint(objectApiName, fieldApiName) {
  const obj = String(objectApiName || "").trim();
  const field = String(fieldApiName || "").trim();
  if (!field) return "";
  // Flows often reference Object.Field or just Field__c
  if (obj && field.includes(".")) return field;
  if (obj && !field.includes(".")) return `${obj}.${field}`;
  return field;
}
