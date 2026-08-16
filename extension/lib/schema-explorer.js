/**
 * Schema Explorer — parent/child graph helpers from REST describe.
 * Supports standard, custom (__c), and custom metadata (__mdt) objects.
 * Never touches sid.
 */

/** @typedef {{ fieldName: string, relationshipName: string|null, targetObject: string, type: string, label: string, nillable?: boolean }} ParentRelation */
/** @typedef {{ childObject: string, relationshipName: string|null, fieldName: string, cascadeDelete: boolean, deprecatedAndHidden: boolean }} ChildRelation */

export function objectKind(name, customFlag = false) {
  const n = String(name || "");
  if (/__mdt$/i.test(n)) return "Custom Metadata";
  if (/__e$/i.test(n)) return "Platform Event";
  if (/__b$/i.test(n)) return "Big Object";
  if (/__x$/i.test(n)) return "External Object";
  if (/__kav$/i.test(n)) return "Knowledge";
  if (/__c$/i.test(n) || customFlag) return "Custom";
  return "Standard";
}

export function objectKindClass(kind) {
  const k = String(kind || "").toLowerCase();
  if (k.includes("metadata")) return "kind-mdt";
  if (k.includes("custom")) return "kind-custom";
  if (k.includes("event")) return "kind-event";
  if (k.includes("external") || k.includes("big")) return "kind-other";
  return "kind-standard";
}

/**
 * Classify global describe entries for Schema Explorer filters.
 * @param {Array<{name?: string, label?: string, custom?: boolean, queryable?: boolean}>} sobjects
 * @param {"all"|"standard"|"custom"|"mdt"} filter
 */
export function filterSchemaObjects(sobjects, filter = "all") {
  const list = Array.isArray(sobjects) ? sobjects : [];
  return list.filter((o) => {
    if (!o?.name) return false;
    // Prefer queryable when the flag exists; still allow CMDT / known suffixes.
    if (o.queryable === false && !/__mdt$|__c$/i.test(o.name)) return false;
    const kind = objectKind(o.name, !!o.custom);
    if (filter === "standard") return kind === "Standard";
    if (filter === "custom") return kind === "Custom" || /__c$/i.test(o.name);
    if (filter === "mdt") return kind === "Custom Metadata" || /__mdt$/i.test(o.name);
    return true;
  });
}

/**
 * Parent / lookup / master-detail edges from field describe.
 * @param {object} describe
 * @returns {ParentRelation[]}
 */
export function extractParentRelations(describe) {
  /** @type {ParentRelation[]} */
  const out = [];
  const seen = new Set();
  for (const f of describe?.fields || []) {
    const refs = Array.isArray(f.referenceTo) ? f.referenceTo : [];
    if (!refs.length) continue;
    for (const target of refs) {
      if (!target) continue;
      const key = `${f.name}|${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        fieldName: f.name,
        relationshipName: f.relationshipName || null,
        targetObject: target,
        type: f.type || "reference",
        label: f.label || f.name,
        nillable: !!f.nillable
      });
    }
  }
  return out.sort((a, b) =>
    String(a.targetObject).localeCompare(String(b.targetObject)) ||
    String(a.fieldName).localeCompare(String(b.fieldName))
  );
}

/**
 * Child relationship edges from describe.childRelationships.
 * @param {object} describe
 * @returns {ChildRelation[]}
 */
export function extractChildRelations(describe) {
  /** @type {ChildRelation[]} */
  const out = [];
  const seen = new Set();
  for (const c of describe?.childRelationships || []) {
    if (!c?.childSObject) continue;
    if (c.deprecatedAndHidden) continue;
    const key = `${c.childSObject}|${c.field || ""}|${c.relationshipName || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      childObject: c.childSObject,
      relationshipName: c.relationshipName || null,
      fieldName: c.field || "",
      cascadeDelete: !!c.cascadeDelete,
      deprecatedAndHidden: !!c.deprecatedAndHidden
    });
  }
  return out.sort((a, b) => String(a.childObject).localeCompare(String(b.childObject)));
}

/** Prefer a human-friendly display field that exists on the object. */
export function pickDisplayFields(describe, { max = 4 } = {}) {
  const names = new Set((describe?.fields || []).map((f) => f.name));
  const preferred = [
    "Id",
    "Name",
    "DeveloperName",
    "MasterLabel",
    "QualifiedApiName",
    "Subject",
    "CaseNumber",
    "OrderNumber",
    "ContractNumber",
    "Title",
    "Label"
  ];
  const picked = [];
  for (const p of preferred) {
    if (names.has(p) && !picked.includes(p)) picked.push(p);
    if (picked.length >= max) break;
  }
  if (!picked.includes("Id") && names.has("Id")) picked.unshift("Id");
  if (!picked.length) picked.push("Id");
  return picked;
}

export function buildObjectQuery(describe, { limit = 50 } = {}) {
  const name = describe?.name;
  if (!name) return "";
  const fields = pickDisplayFields(describe);
  return `SELECT ${fields.join(", ")} FROM ${name} LIMIT ${limit}`;
}

/**
 * Parent-path SOQL using relationshipName when available.
 * @param {object} describe
 * @param {ParentRelation} parent
 */
export function buildParentPathQuery(describe, parent, { limit = 50 } = {}) {
  const name = describe?.name;
  if (!name || !parent?.targetObject) return "";
  const base = pickDisplayFields(describe, { max: 2 });
  let parentSelect = parent.fieldName;
  if (parent.relationshipName) {
    // Prefer Name/DeveloperName on parent when we don't have its describe yet.
    parentSelect = `${parent.relationshipName}.Id, ${parent.relationshipName}.Name`;
  }
  const fields = [...new Set([...base, parentSelect])];
  return `SELECT ${fields.join(", ")} FROM ${name} LIMIT ${limit}`;
}

/**
 * Child subquery SOQL. Returns null when relationshipName is missing (some children are not queryable that way).
 * @param {object} describe
 * @param {ChildRelation} child
 */
export function buildChildSubquery(describe, child, { limit = 20, childLimit = 10 } = {}) {
  const name = describe?.name;
  if (!name || !child?.relationshipName) return null;
  const base = pickDisplayFields(describe, { max: 2 });
  return `SELECT ${base.join(", ")}, (SELECT Id FROM ${child.relationshipName} LIMIT ${childLimit}) FROM ${name} LIMIT ${limit}`;
}

export function schemaSummary(describe) {
  if (!describe?.name) return "";
  const kind = objectKind(describe.name, !!describe.custom);
  const fields = describe.fields?.length || 0;
  const parents = extractParentRelations(describe).length;
  const children = extractChildRelations(describe).length;
  return `${describe.name} · ${kind} · ${fields} fields · ${parents} parents · ${children} children`;
}

/**
 * Score object matches for typeahead (API name + label).
 */
export function scoreSchemaObject(o, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q || !o?.name) return 0;
  const name = o.name.toLowerCase();
  const label = String(o.label || "").toLowerCase();
  const plural = String(o.labelPlural || "").toLowerCase();
  if (name === q || label === q) return 100;
  if (name.startsWith(q) || label.startsWith(q)) return 90;
  if (name.includes(q) || label.includes(q) || plural.includes(q)) return 70;
  if (q.endsWith("__c") && name === q) return 100;
  if (q.endsWith("__mdt") && name === q) return 100;
  return 0;
}
