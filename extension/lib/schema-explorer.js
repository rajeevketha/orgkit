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

/** Salesforce-like field type label for Schema Builder cards. */
export function formatFieldType(field) {
  if (!field) return "";
  const t = String(field.type || "").toLowerCase();
  const refs = Array.isArray(field.referenceTo) ? field.referenceTo : [];
  if (refs.length) {
    const join = refs.join(", ");
    if (t === "masterdetail" || t === "master-detail") return `Master-Detail(${join})`;
    return `Lookup(${join})`;
  }
  if (t === "string" || t === "textarea") {
    const len = field.length != null ? field.length : "";
    return len !== "" ? `Text(${len})` : t === "textarea" ? "Text Area" : "Text";
  }
  if (t === "double" || t === "currency" || t === "percent") {
    const p = field.precision != null ? field.precision : "";
    const s = field.scale != null ? field.scale : "";
    if (p !== "" && s !== "") {
      const label = t === "currency" ? "Currency" : t === "percent" ? "Percent" : "Number";
      return `${label}(${p}, ${s})`;
    }
  }
  const map = {
    boolean: "Checkbox",
    int: "Number",
    datetime: "Date/Time",
    date: "Date",
    email: "Email",
    phone: "Phone",
    url: "URL",
    id: "ID",
    reference: "Lookup",
    picklist: "Picklist",
    multipicklist: "Picklist (Multi-Select)",
    address: "Address",
    location: "Geolocation",
    encryptedstring: "Encrypted Text",
    base64: "Base64",
    combobox: "Combobox",
    time: "Time"
  };
  return map[t] || field.type || "";
}

/**
 * Choose which fields appear on a Schema Builder card.
 * Relationship fields always prioritized; expanded shows more.
 */
export function pickCardFields(describe, { max = 10, expanded = false } = {}) {
  const fields = Array.isArray(describe?.fields) ? [...describe.fields] : [];
  const limit = expanded ? Math.min(fields.length, 40) : max;
  const score = (f) => {
    let s = 0;
    if (f.name === "Id") s += 200;
    if (["Name", "DeveloperName", "MasterLabel", "Subject", "CaseNumber"].includes(f.name)) s += 150;
    if (f.referenceTo?.length) s += 80;
    if (!f.nillable && f.createable) s += 40;
    if (f.custom) s += 5;
    if (f.type === "masterdetail") s += 15;
    return s;
  };
  return fields
    .filter((f) => f?.name)
    .sort((a, b) => score(b) - score(a) || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
}

/**
 * Auto-layout: center object, parents above, children below (Salesforce Schema Builder–like).
 * @returns {Map<string, { x: number, y: number, role: string }>}
 */
export function layoutSchemaGraph({
  centerName,
  parentNames = [],
  childNames = [],
  cardWidth = 260,
  gapX = 36,
  gapY = 72,
  centerY = 320
} = {}) {
  /** @type {Map<string, { x: number, y: number, role: string }>} */
  const positions = new Map();
  const parents = [...new Set(parentNames.filter(Boolean))];
  const children = [...new Set(childNames.filter(Boolean).filter((n) => n !== centerName))];

  const placeRow = (names, y, role) => {
    const n = names.length;
    if (!n) return;
    const totalW = n * cardWidth + (n - 1) * gapX;
    let x = -totalW / 2;
    for (const name of names) {
      positions.set(name, { x, y, role });
      x += cardWidth + gapX;
    }
  };

  placeRow(parents, 24, "parent");
  positions.set(centerName, {
    x: -cardWidth / 2,
    y: parents.length ? centerY : 24,
    role: "center"
  });
  const childY = (positions.get(centerName)?.y || centerY) + 280 + gapY;
  placeRow(children, childY, "child");
  return positions;
}

/**
 * Edges for SVG connectors (child lookup field → parent object).
 */
export function buildGraphEdges({ centerName, parents = [], children = [] } = {}) {
  /** @type {Array<{ id: string, fromObject: string, fromField: string, toObject: string, kind: string }>} */
  const edges = [];
  for (const p of parents) {
    if (!p?.targetObject || !p?.fieldName) continue;
    edges.push({
      id: `${centerName}.${p.fieldName}->${p.targetObject}`,
      fromObject: centerName,
      fromField: p.fieldName,
      toObject: p.targetObject,
      kind: String(p.type || "").toLowerCase() === "masterdetail" ? "masterdetail" : "lookup"
    });
  }
  for (const c of children) {
    if (!c?.childObject || !c?.fieldName) continue;
    edges.push({
      id: `${c.childObject}.${c.fieldName}->${centerName}`,
      fromObject: c.childObject,
      fromField: c.fieldName,
      toObject: centerName,
      kind: c.cascadeDelete ? "masterdetail" : "lookup"
    });
  }
  return edges;
}

/**
 * Session-user object access from REST describe flags (no extra API call).
 */
export function sessionObjectAccess(describe) {
  if (!describe) {
    return { create: false, read: false, edit: false, del: false, queryable: false, searchable: false };
  }
  return {
    create: !!describe.createable,
    read: !!(describe.queryable || describe.retrieveable),
    edit: !!describe.updateable,
    del: !!describe.deletable,
    queryable: !!describe.queryable,
    searchable: !!describe.searchable
  };
}

/**
 * Field access + schema flags for Schema Builder badges.
 * Session FLS inferred from describe: fields returned are readable unless accessible===false.
 */
export function fieldSchemaBadges(field) {
  if (!field?.name) return { access: [], flags: [], readable: false, editable: false, reason: "" };
  const readable = field.accessible !== false;
  const editable = !!field.updateable;
  /** @type {Array<{ key: string, title: string, kind: string }>} */
  const access = [];
  if (readable) access.push({ key: "R", title: "Readable for this session", kind: "ok" });
  else access.push({ key: "R", title: "Not readable for this session", kind: "no" });
  if (editable) access.push({ key: "E", title: "Editable for this session", kind: "ok" });
  else access.push({ key: "E", title: "Not editable for this session", kind: "no" });

  /** @type {Array<{ key: string, title: string, kind: string }>} */
  const flags = [];
  if (!field.nillable && field.createable) {
    flags.push({ key: "Req", title: "Required on create", kind: "req" });
  }
  if (field.unique) flags.push({ key: "Unq", title: "Unique", kind: "flag" });
  if (field.externalId) flags.push({ key: "Ext", title: "External ID", kind: "flag" });
  if (field.custom) flags.push({ key: "Cstm", title: "Custom field", kind: "flag" });
  if (field.calculated || field.autoNumber) {
    flags.push({ key: "Fx", title: "Formula / auto-number", kind: "flag" });
  }
  if (field.referenceTo?.length) {
    flags.push({
      key: field.type === "masterdetail" ? "MD" : "Lk",
      title: formatFieldType(field),
      kind: "rel"
    });
  }

  let reason = "";
  if (!editable) {
    if (field.calculated) reason = "Formula/calculated fields are not directly editable";
    else if (field.autoNumber) reason = "Auto-number fields are system-managed";
    else if (field.type === "id") reason = "Id is system-managed";
    else if (field.accessible === false) reason = "Field is not accessible (FLS)";
    else if (!field.updateable) reason = "Describe reports updateable=false for this session";
  }

  return { access, flags, readable, editable, reason };
}

export function summarizeSessionPermissions(describe) {
  const access = sessionObjectAccess(describe);
  const fields = Array.isArray(describe?.fields) ? describe.fields : [];
  let readable = 0;
  let editable = 0;
  let required = 0;
  let custom = 0;
  const blockedEdit = [];
  for (const f of fields) {
    const b = fieldSchemaBadges(f);
    if (b.readable) readable += 1;
    if (b.editable) editable += 1;
    if (!f.nillable && f.createable) required += 1;
    if (f.custom) custom += 1;
    if (b.readable && !b.editable && blockedEdit.length < 8 && f.name !== "Id") {
      blockedEdit.push({ name: f.name, reason: b.reason || "Not updateable" });
    }
  }
  return {
    access,
    fieldCounts: {
      total: fields.length,
      readable,
      editable,
      required,
      custom,
      notReadable: fields.length - readable
    },
    blockedEdit
  };
}

export function crudStripHtml(access) {
  const cells = [
    ["C", access.create, "Create"],
    ["R", access.read, "Read / query"],
    ["U", access.edit, "Update"],
    ["D", access.del, "Delete"]
  ];
  return cells
    .map(
      ([k, ok, title]) =>
        `<span class="sb-crud ${ok ? "is-on" : "is-off"}" title="${title}: ${ok ? "Yes" : "No"}">${k}</span>`
    )
    .join("");
}
