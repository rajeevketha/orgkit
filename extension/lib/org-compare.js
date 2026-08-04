/**
 * Org Compare — normalize REST/Tooling inventories and diff objects, profiles, permsets, and common metadata.
 * In-browser only; never touches sid.
 */

/** @typedef {{ name: string, label: string, custom: boolean, type: string, nillable: boolean, createable?: boolean, length?: number|null, precision?: number|null, scale?: number|null, referenceTo?: string[] }} FieldInv */
/** @typedef {{ name: string, label: string, custom: boolean, keyPrefix?: string|null, fields: Record<string, FieldInv> }} ObjectInv */
/** @typedef {{ orgKey: string, label: string, hostname?: string, objectCount: number, objects: Record<string, ObjectInv> }} OrgInventory */

export function isCustomObjectName(name, { includeMdt = true } = {}) {
  const n = String(name || "");
  if (n.endsWith("__c")) return true;
  if (includeMdt && n.endsWith("__mdt")) return true;
  return false;
}

export function filterGlobalObjects(sobjects, mode = "custom") {
  const list = Array.isArray(sobjects) ? sobjects : [];
  if (mode === "all") {
    return list.filter((o) => o?.name && o.queryable !== false);
  }
  const includeMdt = mode !== "custom-no-mdt";
  return list.filter((o) => o?.name && isCustomObjectName(o.name, { includeMdt }));
}

export function normalizeField(field) {
  if (!field?.name) return null;
  return {
    name: field.name,
    label: field.label || field.name,
    custom: !!field.custom,
    type: String(field.type || ""),
    nillable: !!field.nillable,
    createable: !!field.createable,
    length: field.length ?? null,
    precision: field.precision ?? null,
    scale: field.scale ?? null,
    referenceTo: Array.isArray(field.referenceTo) ? [...field.referenceTo].sort() : []
  };
}

export function normalizeObjectDescribe(desc) {
  if (!desc?.name) return null;
  const fields = {};
  for (const f of desc.fields || []) {
    const nf = normalizeField(f);
    if (nf) fields[nf.name] = nf;
  }
  return {
    name: desc.name,
    label: desc.label || desc.name,
    custom: !!desc.custom,
    keyPrefix: desc.keyPrefix || null,
    fields
  };
}

export function buildInventoryFromDescribes(orgMeta, objectDescribes) {
  const objects = {};
  for (const d of objectDescribes || []) {
    const obj = normalizeObjectDescribe(d);
    if (obj) objects[obj.name] = obj;
  }
  return {
    orgKey: orgMeta?.orgKey || orgMeta?.hostname || "org",
    label: orgMeta?.label || orgMeta?.hostname || "Org",
    hostname: orgMeta?.hostname || "",
    envLabel: orgMeta?.envLabel || "",
    objectCount: Object.keys(objects).length,
    objects
  };
}

function fieldSignature(f) {
  if (!f) return "";
  const refs = (f.referenceTo || []).join(",");
  return [
    f.type || "",
    f.nillable ? "1" : "0",
    f.custom ? "1" : "0",
    f.length ?? "",
    f.precision ?? "",
    f.scale ?? "",
    refs
  ].join("|");
}

function fieldDiffReasons(a, b) {
  const reasons = [];
  if ((a?.type || "") !== (b?.type || "")) reasons.push(`type: ${a?.type || "—"} → ${b?.type || "—"}`);
  if (!!a?.nillable !== !!b?.nillable) {
    reasons.push(`nillable: ${a?.nillable ? "yes" : "no"} → ${b?.nillable ? "yes" : "no"}`);
  }
  if (!!a?.custom !== !!b?.custom) reasons.push(`custom: ${a?.custom} → ${b?.custom}`);
  if ((a?.length ?? null) !== (b?.length ?? null) && (a?.type === "string" || b?.type === "string")) {
    reasons.push(`length: ${a?.length ?? "—"} → ${b?.length ?? "—"}`);
  }
  if ((a?.precision ?? null) !== (b?.precision ?? null) || (a?.scale ?? null) !== (b?.scale ?? null)) {
    if (["double", "currency", "percent", "int"].includes(a?.type) || ["double", "currency", "percent", "int"].includes(b?.type)) {
      reasons.push(
        `precision/scale: ${a?.precision ?? "—"}/${a?.scale ?? "—"} → ${b?.precision ?? "—"}/${b?.scale ?? "—"}`
      );
    }
  }
  const ar = (a?.referenceTo || []).join(",");
  const br = (b?.referenceTo || []).join(",");
  if (ar !== br) reasons.push(`referenceTo: ${ar || "—"} → ${br || "—"}`);
  return reasons;
}

/**
 * Diff two inventories.
 * @returns {{ onlyA: object[], onlyB: object[], differ: object[], sameObjects: number, summary: object }}
 */
export function compareInventories(left, right, { customFieldsOnly = false } = {}) {
  const aObjs = left?.objects || {};
  const bObjs = right?.objects || {};
  const names = new Set([...Object.keys(aObjs), ...Object.keys(bObjs)]);

  const onlyA = [];
  const onlyB = [];
  const differ = [];
  let sameObjects = 0;

  for (const name of [...names].sort((x, y) => x.localeCompare(y))) {
    const a = aObjs[name];
    const b = bObjs[name];
    if (a && !b) {
      onlyA.push({
        kind: "object",
        object: name,
        label: a.label,
        custom: a.custom,
        fieldCount: Object.keys(a.fields || {}).length,
        apiNames: [name]
      });
      continue;
    }
    if (b && !a) {
      onlyB.push({
        kind: "object",
        object: name,
        label: b.label,
        custom: b.custom,
        fieldCount: Object.keys(b.fields || {}).length,
        apiNames: [name]
      });
      continue;
    }

    const aFields = a.fields || {};
    const bFields = b.fields || {};
    const fieldNames = new Set([...Object.keys(aFields), ...Object.keys(bFields)]);
    const fieldOnlyA = [];
    const fieldOnlyB = [];
    const fieldDiffer = [];

    for (const fn of [...fieldNames].sort((x, y) => x.localeCompare(y))) {
      const af = aFields[fn];
      const bf = bFields[fn];
      if (customFieldsOnly) {
        const isCustom = !!(af?.custom || bf?.custom || String(fn).endsWith("__c"));
        if (!isCustom) continue;
      }
      if (af && !bf) {
        fieldOnlyA.push({ name: fn, field: af });
        continue;
      }
      if (bf && !af) {
        fieldOnlyB.push({ name: fn, field: bf });
        continue;
      }
      if (fieldSignature(af) !== fieldSignature(bf)) {
        fieldDiffer.push({
          name: fn,
          left: af,
          right: bf,
          reasons: fieldDiffReasons(af, bf)
        });
      }
    }

    if (!fieldOnlyA.length && !fieldOnlyB.length && !fieldDiffer.length) {
      sameObjects += 1;
      continue;
    }

    differ.push({
      kind: "object-fields",
      object: name,
      label: a.label || b.label,
      custom: !!(a.custom || b.custom),
      onlyA: fieldOnlyA,
      onlyB: fieldOnlyB,
      differ: fieldDiffer,
      apiNames: [
        ...fieldOnlyA.map((f) => `${name}.${f.name}`),
        ...fieldOnlyB.map((f) => `${name}.${f.name}`),
        ...fieldDiffer.map((f) => `${name}.${f.name}`)
      ]
    });
  }

  return {
    onlyA,
    onlyB,
    differ,
    sameObjects,
    summary: {
      leftObjects: Object.keys(aObjs).length,
      rightObjects: Object.keys(bObjs).length,
      onlyA: onlyA.length,
      onlyB: onlyB.length,
      differ: differ.length,
      sameObjects
    }
  };
}

/** Filter diff buckets by text needle and optional custom-only object rows. */
export function filterCompareResults(results, { query = "", customOnly = false, category = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  const cat = String(category || "").trim();
  const match = (text) => !q || String(text || "").toLowerCase().includes(q);

  const filterRow = (row) => {
    if (cat && row.category && row.category !== cat) return false;
    if (customOnly && row.custom === false) return false;
    if (!q) return true;
    if (match(row.object) || match(row.label) || match(row.categoryLabel) || match(row.category)) return true;
    if (row.apiNames?.some((n) => match(n))) return true;
    if (row.detail) {
      for (const v of Object.values(row.detail)) {
        if (match(v)) return true;
      }
    }
    if (row.onlyA?.some((f) => match(f.name) || match(f.field?.label))) return true;
    if (row.onlyB?.some((f) => match(f.name) || match(f.field?.label))) return true;
    if (row.differ?.some((f) => match(f.name) || match(f.left?.label) || match(f.right?.label) || match(f.label))) return true;
    if (row.attrDiffs?.some((f) => match(f.label) || match(f.left) || match(f.right))) return true;
    return false;
  };

  return {
    ...results,
    onlyA: (results.onlyA || []).filter(filterRow),
    onlyB: (results.onlyB || []).filter(filterRow),
    differ: (results.differ || []).filter(filterRow)
  };
}

export function collectApiNames(rows, bucket) {
  const names = [];
  for (const row of rows || []) {
    if (bucket === "objects" || row.kind === "object") {
      names.push(row.object);
      continue;
    }
    if (bucket === "fields-a") {
      for (const f of row.onlyA || []) names.push(`${row.object}.${f.name}`);
    } else if (bucket === "fields-b") {
      for (const f of row.onlyB || []) names.push(`${row.object}.${f.name}`);
    } else if (bucket === "fields-differ") {
      for (const f of row.differ || []) names.push(`${row.object}.${f.name}`);
    } else {
      names.push(...(row.apiNames || [row.object]));
    }
  }
  return [...new Set(names)];
}

/** Handoff note: package.xml <types> block for one metadata type. */
export function toPackageMemberList(memberNames, metadataType = "CustomObject") {
  const members = [...new Set((memberNames || []).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  if (!members.length) return "";
  const typeName = String(metadataType || "CustomObject");
  const lines = members.map((m) => `        <members>${m}</members>`);
  return [
    `<!-- Org Compare handoff — ${typeName} members -->`,
    "<types>",
    ...lines,
    `        <name>${typeName}</name>`,
    "</types>"
  ].join("\n");
}

/** Build package.xml types from compare rows grouped by metadataType. */
export function toPackageTypesFromRows(rows) {
  /** @type {Map<string, Set<string>>} */
  const byType = new Map();
  for (const row of rows || []) {
    const typeName = row.metadataType || (row.category === "objects" ? "CustomObject" : "");
    if (!typeName) continue;
    if (!byType.has(typeName)) byType.set(typeName, new Set());
    const member = row.packageMember || row.object;
    if (member) byType.get(typeName).add(member);
  }
  const blocks = [];
  for (const [typeName, members] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const xml = toPackageMemberList([...members], typeName);
    if (xml) blocks.push(xml);
  }
  return blocks.join("\n");
}

export function formatFieldShort(f) {
  if (!f) return "—";
  const req = !f.nillable ? "required" : "nillable";
  const custom = f.custom ? "custom" : "standard";
  return `${f.type} · ${req} · ${custom}`;
}


const LAST_PAIR_KEY = "orgkitCompareLastPair";

/**
 * Remember last A/B orgKeys locally (never sid / secrets).
 * @param {{ leftOrgKey?: string, rightOrgKey?: string }} pair
 */
export async function saveLastComparePair(pair = {}) {
  const leftOrgKey = String(pair.leftOrgKey || "").trim();
  const rightOrgKey = String(pair.rightOrgKey || "").trim();
  if (!leftOrgKey && !rightOrgKey) {
    await chrome.storage.local.remove(LAST_PAIR_KEY);
    return null;
  }
  const value = {
    leftOrgKey,
    rightOrgKey,
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [LAST_PAIR_KEY]: value });
  return value;
}

export async function loadLastComparePair() {
  const data = await chrome.storage.local.get({ [LAST_PAIR_KEY]: null });
  const pair = data[LAST_PAIR_KEY];
  if (!pair || typeof pair !== "object") return null;
  return {
    leftOrgKey: String(pair.leftOrgKey || "").trim(),
    rightOrgKey: String(pair.rightOrgKey || "").trim(),
    updatedAt: pair.updatedAt || null
  };
}

/** Side-by-side field attribute rows for Differ rendering. */
export function fieldSideBySideRows(left, right) {
  const rows = [];
  const push = (label, aVal, bVal) => {
    const a = aVal == null || aVal === "" ? "—" : String(aVal);
    const b = bVal == null || bVal === "" ? "—" : String(bVal);
    if (a === b) return;
    rows.push({ label, left: a, right: b });
  };
  push("type", left?.type, right?.type);
  push("nillable", left ? (left.nillable ? "yes" : "no") : null, right ? (right.nillable ? "yes" : "no") : null);
  push("custom", left ? (left.custom ? "yes" : "no") : null, right ? (right.custom ? "yes" : "no") : null);
  if (left?.type === "string" || right?.type === "string") {
    push("length", left?.length ?? null, right?.length ?? null);
  }
  if (
    ["double", "currency", "percent", "int"].includes(left?.type) ||
    ["double", "currency", "percent", "int"].includes(right?.type)
  ) {
    push(
      "precision/scale",
      left ? `${left.precision ?? "—"}/${left.scale ?? "—"}` : null,
      right ? `${right.precision ?? "—"}/${right.scale ?? "—"}` : null
    );
  }
  const ar = (left?.referenceTo || []).join(", ");
  const br = (right?.referenceTo || []).join(", ");
  push("referenceTo", ar || null, br || null);
  return rows;
}


/** Compare categories available in Org Compare (REST describe + Tooling/SOQL inventories). */
export const COMPARE_CATEGORIES = [
  {
    id: "objects",
    label: "Objects & fields",
    blurb: "Custom object/field schema via REST describe",
    metadataType: "CustomObject",
    defaultOn: true,
    common: true
  },
  {
    id: "profiles",
    label: "Profiles",
    blurb: "Profile names present in each org",
    metadataType: "Profile",
    defaultOn: true,
    common: true
  },
  {
    id: "permissionSets",
    label: "Permission sets",
    blurb: "Permission set inventory (not profile-owned)",
    metadataType: "PermissionSet",
    defaultOn: true,
    common: true
  },
  {
    id: "flows",
    label: "Flows",
    blurb: "Flow definitions + active flag",
    metadataType: "Flow",
    defaultOn: true,
    common: true
  },
  {
    id: "apexClasses",
    label: "Apex classes",
    blurb: "Apex class inventory + API version/status",
    metadataType: "ApexClass",
    defaultOn: true,
    common: true
  },
  {
    id: "apexTriggers",
    label: "Apex triggers",
    blurb: "Trigger inventory + status/API version",
    metadataType: "ApexTrigger",
    defaultOn: false,
    common: true
  },
  {
    id: "validationRules",
    label: "Validation rules",
    blurb: "Object validation rules + active flag",
    metadataType: "ValidationRule",
    defaultOn: true,
    common: true
  },
  {
    id: "recordTypes",
    label: "Record types",
    blurb: "Record types by object + active flag",
    metadataType: "RecordType",
    defaultOn: false,
    common: true
  },
  {
    id: "flexiPages",
    label: "Lightning pages",
    blurb: "FlexiPage / Lightning page inventory",
    metadataType: "FlexiPage",
    defaultOn: false,
    common: false
  },
  {
    id: "lwc",
    label: "LWC bundles",
    blurb: "Lightning Web Component bundles",
    metadataType: "LightningComponentBundle",
    defaultOn: false,
    common: false
  }
];

export function getCompareCategory(id) {
  return COMPARE_CATEGORIES.find((c) => c.id === id) || null;
}

export function defaultCompareCategoryIds() {
  return COMPARE_CATEGORIES.filter((c) => c.defaultOn).map((c) => c.id);
}

export function commonCompareCategoryIds() {
  return COMPARE_CATEGORIES.filter((c) => c.common).map((c) => c.id);
}

function namedAttrRows(left, right, keys) {
  const rows = [];
  for (const key of keys || []) {
    const a = left?.[key];
    const b = right?.[key];
    const aVal = a == null || a === "" ? "—" : String(a);
    const bVal = b == null || b === "" ? "—" : String(b);
    if (aVal === bVal) continue;
    rows.push({ label: key, left: aVal, right: bVal });
  }
  return rows;
}

function namedSignature(item, keys) {
  return (keys || []).map((k) => `${k}=${item?.[k] ?? ""}`).join("|");
}

/**
 * Diff one named-item category (profiles, flows, apex, etc.).
 */
export function compareNamedItems(leftItems, rightItems, {
  category,
  categoryLabel,
  metadataType,
  attrKeys = []
} = {}) {
  const aItems = leftItems || {};
  const bItems = rightItems || {};
  const names = new Set([...Object.keys(aItems), ...Object.keys(bItems)]);
  const onlyA = [];
  const onlyB = [];
  const differ = [];
  let same = 0;

  for (const name of [...names].sort((x, y) => x.localeCompare(y))) {
    const a = aItems[name];
    const b = bItems[name];
    if (a && !b) {
      onlyA.push({
        kind: "named",
        category,
        categoryLabel,
        metadataType,
        object: name,
        label: a.label || name,
        custom: a.custom !== false,
        detail: a.attrs || {},
        packageMember: a.packageMember || name,
        apiNames: [name]
      });
      continue;
    }
    if (b && !a) {
      onlyB.push({
        kind: "named",
        category,
        categoryLabel,
        metadataType,
        object: name,
        label: b.label || name,
        custom: b.custom !== false,
        detail: b.attrs || {},
        packageMember: b.packageMember || name,
        apiNames: [name]
      });
      continue;
    }
    const keys = attrKeys.length ? attrKeys : Object.keys({ ...(a.attrs || {}), ...(b.attrs || {}) }).sort();
    if (namedSignature(a.attrs, keys) === namedSignature(b.attrs, keys)) {
      same += 1;
      continue;
    }
    const attrDiffs = namedAttrRows(a.attrs, b.attrs, keys);
    differ.push({
      kind: "named-diff",
      category,
      categoryLabel,
      metadataType,
      object: name,
      label: a.label || b.label || name,
      custom: !!(a.custom !== false || b.custom !== false),
      attrDiffs,
      left: a.attrs || {},
      right: b.attrs || {},
      packageMember: a.packageMember || b.packageMember || name,
      apiNames: [name]
    });
  }

  return { onlyA, onlyB, differ, same };
}

/**
 * Diff full multi-category bundles from fetchCompareBundle.
 */
export function compareBundles(left, right, { customFieldsOnly = false, categories = null } = {}) {
  const selected = Array.isArray(categories) && categories.length
    ? categories
    : Object.keys(left?.categories || right?.categories || {});

  const onlyA = [];
  const onlyB = [];
  const differ = [];
  let sameCount = 0;
  const byCategory = {};

  for (const catId of selected) {
    const catDef = getCompareCategory(catId);
    const leftCat = left?.categories?.[catId];
    const rightCat = right?.categories?.[catId];
    if (!leftCat && !rightCat) continue;

    if (catId === "objects") {
      const objDiff = compareInventories(
        { objects: leftCat?.items || left?.objects || {} },
        { objects: rightCat?.items || right?.objects || {} },
        { customFieldsOnly }
      );
      const tag = (row) => ({
        ...row,
        category: "objects",
        categoryLabel: catDef?.label || "Objects & fields",
        metadataType: "CustomObject",
        packageMember: row.object
      });
      const a = (objDiff.onlyA || []).map(tag);
      const b = (objDiff.onlyB || []).map(tag);
      const d = (objDiff.differ || []).map(tag);
      onlyA.push(...a);
      onlyB.push(...b);
      differ.push(...d);
      sameCount += objDiff.sameObjects || 0;
      byCategory[catId] = {
        label: catDef?.label || catId,
        onlyA: a.length,
        onlyB: b.length,
        differ: d.length,
        same: objDiff.sameObjects || 0,
        leftCount: Object.keys(leftCat?.items || left?.objects || {}).length,
        rightCount: Object.keys(rightCat?.items || right?.objects || {}).length
      };
      continue;
    }

    const named = compareNamedItems(leftCat?.items || {}, rightCat?.items || {}, {
      category: catId,
      categoryLabel: catDef?.label || leftCat?.label || catId,
      metadataType: catDef?.metadataType || leftCat?.metadataType || "",
      attrKeys: leftCat?.attrKeys || rightCat?.attrKeys || []
    });
    onlyA.push(...named.onlyA);
    onlyB.push(...named.onlyB);
    differ.push(...named.differ);
    sameCount += named.same || 0;
    byCategory[catId] = {
      label: catDef?.label || catId,
      onlyA: named.onlyA.length,
      onlyB: named.onlyB.length,
      differ: named.differ.length,
      same: named.same || 0,
      leftCount: Object.keys(leftCat?.items || {}).length,
      rightCount: Object.keys(rightCat?.items || {}).length
    };
  }

  // Stable sort within buckets: category then name
  const sortRows = (rows) =>
    [...rows].sort((a, b) => {
      const c = String(a.category || "").localeCompare(String(b.category || ""));
      if (c) return c;
      return String(a.object || "").localeCompare(String(b.object || ""));
    });

  return {
    onlyA: sortRows(onlyA),
    onlyB: sortRows(onlyB),
    differ: sortRows(differ),
    sameObjects: sameCount,
    sameCount,
    summary: {
      onlyA: onlyA.length,
      onlyB: onlyB.length,
      differ: differ.length,
      sameObjects: sameCount,
      leftObjects: byCategory.objects?.leftCount ?? Object.keys(left?.objects || {}).length,
      rightObjects: byCategory.objects?.rightCount ?? Object.keys(right?.objects || {}).length,
      byCategory
    }
  };
}
