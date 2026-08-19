/** Salesforce org / session helpers shared by popup & background. */

const SF_HOST_RE =
  /^(?<sub>[a-z0-9-]+(?:\.[a-z0-9-]+)*)\.(?<rest>my\.salesforce\.com|lightning\.force\.com|salesforce\.com|cloudforce\.com|visual\.force\.com|vf\.force\.com|salesforce-setup\.com|my\.salesforce-setup\.com)$/i;

/** Pod / instance Lightning hosts (legacy sandboxes & some production pods). */
const POD_LIGHTNING_RE = /^(cs|gs|na|eu|ap|um)\d+\.lightning\.force\.com$/i;
const POD_SALESFORCE_RE = /^(cs|gs|na|eu|ap|um)\d+\.salesforce\.com$/i;

export function isSalesforceUrl(url) {
  try {
    const u = new URL(url);
    return /\.(salesforce|force|cloudforce|salesforce-setup|visualforce)\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function isLightningHost(hostname) {
  return String(hostname || "")
    .toLowerCase()
    .endsWith(".lightning.force.com");
}

export function isSetupHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h.endsWith(".salesforce-setup.com") || h.endsWith(".my.salesforce-setup.com");
}

/**
 * Map Lightning / Setup hostnames to the REST API host (*.my.salesforce.com
 * or legacy *.salesforce.com pods).
 * Critical: *.my.salesforce-setup.com must become *.my.salesforce.com
 * (NOT *.my.my.salesforce.com).
 *
 * Note: A Lightning `sid` is host-scoped. Callers that only have a Lightning
 * cookie must call APIs on the Lightning host — do not pair a Lightning sid
 * with the rewritten my.salesforce.com base.
 */
export function toSalesforceApiHost(hostname) {
  let h = String(hostname || "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  if (!h) return h;
  // Repair already-broken hosts from older builds
  h = h.replace(/\.my\.my\.salesforce\.com$/i, ".my.salesforce.com");
  if (h.endsWith(".my.salesforce.com")) return h;
  if (POD_SALESFORCE_RE.test(h)) return h;
  if (h.endsWith(".lightning.force.com")) {
    // Legacy pod sandboxes: cs72.lightning.force.com → cs72.salesforce.com
    if (POD_LIGHTNING_RE.test(h)) {
      return h.replace(/\.lightning\.force\.com$/i, ".salesforce.com");
    }
    // Enhanced domains (incl. *.sandbox.* / *.develop.*):
    // foo.sandbox.lightning.force.com → foo.sandbox.my.salesforce.com
    return h.replace(/\.lightning\.force\.com$/i, ".my.salesforce.com");
  }
  if (h.endsWith(".my.salesforce-setup.com")) {
    return h.replace(/\.my\.salesforce-setup\.com$/i, ".my.salesforce.com");
  }
  if (h.endsWith(".salesforce-setup.com")) {
    return h.replace(/\.salesforce-setup\.com$/i, ".my.salesforce.com");
  }
  return h;
}

export function toSalesforceApiBase(hostnameOrOrigin) {
  const raw = String(hostnameOrOrigin || "").trim();
  if (!raw) return "";
  try {
    if (raw.includes("://")) {
      const u = new URL(raw);
      return `${u.protocol}//${toSalesforceApiHost(u.hostname)}`;
    }
  } catch {
    /* treat as hostname */
  }
  return `https://${toSalesforceApiHost(raw)}`;
}

/**
 * API base URLs to try for a cookie host, in preference order.
 * Lightning/setup sids must be tried against their own host first — rewriting
 * them to *.my.salesforce.com causes "Session expired or invalid" (common on
 * sandboxes where users only open Lightning).
 */
export function apiBaseCandidatesForCookieHost(cookieHost) {
  const h = String(cookieHost || "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  if (!h) return [];
  const out = [];
  const push = (base) => {
    if (base && !out.includes(base)) out.push(base);
  };

  if (isLightningHost(h)) {
    push(`https://${h}`);
    const rewritten = toSalesforceApiHost(h);
    if (rewritten && rewritten !== h) push(`https://${rewritten}`);
    return out;
  }

  if (isSetupHost(h)) {
    const api = toSalesforceApiHost(h);
    push(`https://${api}`);
    if (api.endsWith(".my.salesforce.com")) {
      push(`https://${api.replace(/\.my\.salesforce\.com$/i, ".lightning.force.com")}`);
    } else if (POD_SALESFORCE_RE.test(api)) {
      push(`https://${api.replace(/\.salesforce\.com$/i, ".lightning.force.com")}`);
    }
    return out;
  }

  if (h.endsWith(".my.salesforce.com") || POD_SALESFORCE_RE.test(h)) {
    push(`https://${h}`);
    return out;
  }

  push(toSalesforceApiBase(h));
  return out;
}

/** Twin Lightning host for an API host (used when probing cookies). */
export function toSalesforceLightningHost(hostname) {
  const api = toSalesforceApiHost(hostname);
  if (!api) return "";
  if (api.endsWith(".my.salesforce.com")) {
    return api.replace(/\.my\.salesforce\.com$/i, ".lightning.force.com");
  }
  if (POD_SALESFORCE_RE.test(api)) {
    return api.replace(/\.salesforce\.com$/i, ".lightning.force.com");
  }
  if (isLightningHost(api)) return api;
  return "";
}

/** Stable org affinity key for matching cookies/tabs across Lightning vs API hosts. */
export function orgAffinityKey(hostnameOrUrl) {
  let host = String(hostnameOrUrl || "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  if (!host) return "";
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    /* keep */
  }
  const api = toSalesforceApiHost(host) || host;
  // Drop trailing product labels; keep sandbox/develop segments.
  // acme--uat.sandbox.my.salesforce.com → acme--uat.sandbox
  // cs72.salesforce.com → cs72
  // acme.develop.my.salesforce.com → acme.develop
  return api
    .replace(/\.my\.salesforce\.com$/i, "")
    .replace(/\.salesforce\.com$/i, "")
    .replace(/\.lightning\.force\.com$/i, "")
    .replace(/\.salesforce-setup\.com$/i, "");
}

export function sameOrgAffinity(aHostname, bHostname) {
  const a = orgAffinityKey(aHostname);
  const b = orgAffinityKey(bHostname);
  return !!a && !!b && a === b;
}

export function classifySalesforceEnv(hostname) {
  const host = String(hostname || "").toLowerCase();
  const firstLabel = host.split(".")[0] || "";
  const isVf = host.includes(".vf.force.com") || host.includes(".visual.force.com");
  const isDevEd =
    host.includes("-dev-ed.") ||
    host.includes(".develop.") ||
    /\bdevelop\.(my\.)?salesforce\.com$/i.test(host) ||
    host.includes("develop.lightning.force.com");
  const isSandbox =
    !isDevEd &&
    (host.includes(".sandbox.") ||
      host.includes(".scratch.") ||
      /^cs\d+\./i.test(host) ||
      /^gs\d+\./i.test(host) ||
      // Older My Domain sandboxes: name--sandbox.my.salesforce.com (not VF --c)
      (/--/.test(firstLabel) && !isVf));

  return {
    isSandbox,
    isDevEd,
    envLabel: isSandbox ? "Sandbox" : isDevEd ? "Developer" : "Production"
  };
}

export function parseOrgFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const match = host.match(SF_HOST_RE);
    const isLightning = host.includes("lightning.force.com") || u.pathname.startsWith("/lightning");
    const isSetup = host.includes("salesforce-setup.com") || u.pathname.includes("/lightning/setup/");
    const { isSandbox, isDevEd, envLabel } = classifySalesforceEnv(host);

    let instanceBase = `${u.protocol}//${u.hostname}`;
    const apiHost = toSalesforceApiHost(host);

    const myDomain = host.split(".")[0].replace(/--.*$/, "");

    return {
      hostname: host,
      origin: u.origin,
      pathname: u.pathname,
      instanceBase,
      apiBase: `${u.protocol}//${apiHost}`,
      myDomain,
      isLightning,
      isSetup,
      isSandbox,
      isDevEd,
      envLabel,
      url: u.href,
      hostMatch: match ? match.groups : null
    };
  } catch {
    return null;
  }
}

/** Convert 15-char Salesforce ID to 18-char. */
export function to18(id15) {
  if (!id15 || id15.length !== 15) return id15;
  const suffix = [];
  for (let block = 0; block < 3; block++) {
    let flags = 0;
    for (let i = 0; i < 5; i++) {
      const c = id15.charAt(block * 5 + i);
      if (c >= "A" && c <= "Z") flags += 1 << i;
    }
    suffix.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ012345".charAt(flags));
  }
  return id15 + suffix.join("");
}

export function normalizeSfId(id) {
  if (!id) return null;
  const clean = String(id).trim();
  if (!/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(clean)) return null;
  return clean.length === 15 ? to18(clean) : clean;
}

export function extractIdsFromText(text) {
  if (!text) return [];
  const re = /\b([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})\b/g;
  const found = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    // Heuristic: SF IDs usually start with digit or specific letters
    if (/^[0-9a-zA-Z]{3}/.test(id) && /[0-9]/.test(id.slice(0, 3))) {
      found.add(id);
    } else if (/^[a-zA-Z][0-9a-zA-Z]{2}/.test(id) && /[0-9]/.test(id)) {
      found.add(id);
    }
  }
  return [...found];
}

export function buildRecordUrl(org, recordId, useLightning = true) {
  const id = normalizeSfId(recordId) || recordId;
  if (useLightning) {
    return `${org.origin}/${id}`;
  }
  return `${org.apiBase || org.origin}/${id}`;
}

export function buildSetupUrl(org, lightningPath, classicPath) {
  if (org?.isLightning !== false) {
    // Prefer lightning path on lightning hosts
    const base = org.origin.includes("lightning")
      ? org.origin
      : org.origin.replace(".my.salesforce.com", ".lightning.force.com");
    return `${base}${lightningPath}`;
  }
  return `${org.apiBase || org.origin}${classicPath || lightningPath}`;
}

export const DEFAULT_API_VERSION = "59.0";

export function restUrl(apiBase, path, apiVersion = DEFAULT_API_VERSION) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase}/services/data/v${apiVersion}${p}`;
}
