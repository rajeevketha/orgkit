import {
  isSalesforceUrl,
  parseOrgFromUrl,
  restUrl,
  toSalesforceApiHost,
  toSalesforceApiBase,
  toSalesforceLightningHost,
  apiBaseCandidatesForCookieHost,
  sameOrgAffinity,
  DEFAULT_API_VERSION
} from "../lib/salesforce.js";
import { METADATA_SEARCH_TYPES } from "../lib/metadata-open.js";
import { PACKAGE_TYPES } from "../lib/package-xml.js";
import {
  buildInactiveFlowsQuery,
  buildActiveFlowsQuery,
  flowMatchesNeedle,
  summarizeFlowVersion,
  indexActiveFlowVersions,
  applyActiveVersionsToFlowItems,
  INACTIVE_FLOW_STATUSES
} from "../lib/flow-cleaner.js";
import {
  buildFlowVersionsQuery,
  buildFlowDefinitionSearchQuery,
  assertFlowApiName
} from "../lib/flow-version-compare.js";
import {
  filterGlobalObjects,
  normalizeObjectDescribe,
  isCustomObjectName,
  defaultCompareCategoryIds,
  FLOW_COMPARE_ATTR_KEYS
} from "../lib/org-compare.js";

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.sync.get(
    {
      favorites: [],
      apiVersion: DEFAULT_API_VERSION,
      showToolbar: true,
      showBadge: true,
      launcherMinimized: false,
      deployChecklist: []
    },
    (data) => {
      // Older "Hide tab" turned the launcher fully off (showToolbar=false) with no on-page restore.
      // On upgrade, bring it back as minimized so a Show control remains on the page.
      if (details.reason === "update" && data.showToolbar === false) {
        data.showToolbar = true;
        data.launcherMinimized = true;
      }
      chrome.storage.sync.set(data);
    }
  );
});

/** Toolbar icon / Alt+Shift+O → open OrgKit in a full tab (not a tiny popup). */
chrome.action.onClicked.addListener((tab) => {
  openOrgKitTab(undefined, tab).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    getOrgSession: () => getOrgSession(message.tabUrl || sender.tab?.url),
    runSoql: () => runSoql(message.tabUrl, message.query, message.apiVersion),
    toolingQuery: () => toolingQuery(message.tabUrl, message.query, message.apiVersion),
    restGet: () => restGet(message.tabUrl, message.path, message.apiVersion),
    describeGlobal: () => describeGlobal(message.tabUrl, message.apiVersion, message.tooling),
    describeSObject: () =>
      describeSObject(message.tabUrl, message.sobject, message.apiVersion, message.tooling),
    getSObject: () =>
      getSObject(message.tabUrl, message.sobject, message.id, message.apiVersion, message.tooling),
    updateSObject: () =>
      updateSObject(
        message.tabUrl,
        message.sobject,
        message.id,
        message.fields,
        message.apiVersion,
        message.tooling
      ),
    deleteSObject: () =>
      deleteSObject(message.tabUrl, message.sobject, message.id, message.apiVersion, message.tooling),
    listFlows: () => listFlows(message.tabUrl, message.apiVersion),
    getApexCoverage: () => getApexCoverage(message.tabUrl, message.apiVersion),
    getRecentDeployFailures: () => getRecentDeployFailures(message.tabUrl, message.apiVersion),
    getOrgLimits: () => getOrgLimits(message.tabUrl, message.apiVersion),
    listApexClasses: () => listApexClasses(message.tabUrl, message.query, message.apiVersion),
    getApexClassBody: () => getApexClassBody(message.tabUrl, message.id, message.apiVersion),
    openUrl: async () => {
      await chrome.tabs.create({ url: message.url });
      return { ok: true };
    },
    openOrgKit: () => openOrgKitTab(message.view, sender.tab),
    getActiveTabOrg: () => getActiveTabOrg(message),
    listSalesforceOrgs: () => listSalesforceOrgs(),
    fetchOrgInventory: () =>
      fetchOrgInventory(message.tabUrl, {
        mode: message.mode,
        apiVersion: message.apiVersion,
        maxObjects: message.maxObjects
      }),
    fetchCompareBundle: () =>
      fetchCompareBundle(message.tabUrl, {
        categories: message.categories,
        mode: message.mode,
        apiVersion: message.apiVersion,
        maxObjects: message.maxObjects,
        maxRows: message.maxRows
      }),
    searchMetadata: () => searchMetadata(message.tabUrl, message.query, message.typeId, message.apiVersion),
    listPackageTypeMembers: () =>
      listPackageTypeMembers(message.tabUrl, message.typeName, message.apiVersion),
    listInactiveFlowVersions: () =>
      listInactiveFlowVersions(message.tabUrl, message.needle, message.includeMetadata, message.apiVersion),
    listFlowDefinitions: () => listFlowDefinitions(message.tabUrl, message.query, message.apiVersion),
    listFlowVersions: () => listFlowVersions(message.tabUrl, message.apiName, message.apiVersion),
    getFlowVersionDetail: () => getFlowVersionDetail(message.tabUrl, message.flowId, message.apiVersion),
    deleteFlowVersions: () => deleteFlowVersions(message.tabUrl, message.ids, message.apiVersion),
    executeAnonymous: () => executeAnonymous(message.tabUrl, message.apex, message.apiVersion),
    fetchLatestApexDebug: () => fetchLatestApexDebug(message.tabUrl, message.apiVersion),
    getExtensionVersion: async () => ({
      version: "1.10.0",
      hasSearchMetadata: typeof searchMetadata === "function",
      hasFlowCleaner: typeof listInactiveFlowVersions === "function",
      hasExecuteAnonymous: typeof executeAnonymous === "function",
      hasOrgLimits: typeof getOrgLimits === "function",
      hasRecordCrud: typeof updateSObject === "function",
      hasOrgCompare: typeof fetchCompareBundle === "function",
      privacyPolicy: "privacy.html",
      metadataTypeCount: METADATA_SEARCH_TYPES.length,
      packageTypeCount: PACKAGE_TYPES.length
    })
  };

  const fn = handlers[message.type];
  if (!fn) return false;

  Promise.resolve()
    .then(() => fn())
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

/**
 * Resolve a Salesforce tab from an explicit session-switcher preference.
 * Never stores sid — tabUrl / orgKey only.
 * Fast path: scan open tabs (+ stored URL). Avoids listSalesforceOrgs / userinfo.
 */
async function resolveTabFromPreference(preferredOrgKey, preferredTabUrl) {
  const key = String(preferredOrgKey || "").trim();
  const tabUrl = String(preferredTabUrl || "").trim();
  if (!key && !tabUrl) return null;

  let tabs = [];
  try {
    tabs = (await chrome.tabs.query({})) || [];
  } catch {
    tabs = [];
  }

  const sfTabs = tabs.filter(
    (t) => t?.url && isSalesforceUrl(t.url) && !isLoginOnlyUrl(t.url)
  );

  if (tabUrl && isSalesforceUrl(tabUrl) && !isLoginOnlyUrl(tabUrl)) {
    const exact = sfTabs.find((t) => t.url === tabUrl);
    if (exact) return exact;
    const affinity = sfTabs.find((t) => sameOrgAffinity(t.url, tabUrl));
    if (affinity) return affinity;
    return { id: null, url: tabUrl, title: "", windowId: null };
  }

  if (key) {
    for (const t of sfTabs) {
      const org = parseOrgFromUrl(t.url);
      if (!org) continue;
      if (
        org.apiBase === key ||
        org.hostname === key ||
        org.myDomain === key ||
        sameOrgAffinity(org.hostname || t.url, key) ||
        String(t.url).includes(key)
      ) {
        return t;
      }
    }
  }

  return null;
}

async function captureLaunchContext(hintTab) {
  let sfTab = null;
  if (hintTab?.url && isSalesforceUrl(hintTab.url) && !isLoginOnlyUrl(hintTab.url)) {
    sfTab = hintTab;
  } else {
    // Active tab may already be OrgKit; pick most recently used Salesforce tab.
    sfTab = await findSalesforceTab();
  }
  if (!sfTab?.url || !isSalesforceUrl(sfTab.url) || isLoginOnlyUrl(sfTab.url)) {
    return null;
  }
  const payload = {
    launchTabUrl: sfTab.url,
    launchTabId: sfTab.id ?? null,
    launchAt: Date.now()
  };
  try {
    await chrome.storage.session.set(payload);
  } catch {
    /* session storage unavailable */
  }
  try {
    // Clear pinned/previous Active session so the opener org is selected by default.
    await chrome.storage.local.set({
      lastLaunchTabUrl: payload.launchTabUrl,
      lastLaunchAt: payload.launchAt,
      sessionPinned: false,
      preferredOrgKey: ""
    });
  } catch {
    /* ignore */
  }
  return payload;
}

async function getLaunchContext() {
  const maxAgeMs = 10 * 60 * 1000;
  try {
    const s = await chrome.storage.session.get({
      launchTabUrl: "",
      launchTabId: null,
      launchAt: 0
    });
    if (s.launchTabUrl && Date.now() - Number(s.launchAt || 0) < maxAgeMs) {
      return s;
    }
  } catch {
    /* ignore */
  }
  try {
    const l = await chrome.storage.local.get({ lastLaunchTabUrl: "", lastLaunchAt: 0 });
    if (l.lastLaunchTabUrl && Date.now() - Number(l.lastLaunchAt || 0) < maxAgeMs) {
      return {
        launchTabUrl: l.lastLaunchTabUrl,
        launchTabId: null,
        launchAt: l.lastLaunchAt
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function tabFromLaunchContext(launch) {
  if (!launch?.launchTabUrl || !isSalesforceUrl(launch.launchTabUrl)) return null;

  if (launch.launchTabId != null) {
    try {
      const t = await chrome.tabs.get(launch.launchTabId);
      if (t?.url && isSalesforceUrl(t.url) && !isLoginOnlyUrl(t.url)) return t;
    } catch {
      /* tab closed */
    }
  }

  try {
    const all = await chrome.tabs.query({});
    const matches = (all || []).filter(
      (t) => t?.url && isSalesforceUrl(t.url) && !isLoginOnlyUrl(t.url)
    );
    const same = matches.find((t) => sameOrgAffinity(t.url, launch.launchTabUrl));
    if (same) return same;
  } catch {
    /* ignore */
  }

  return {
    id: launch.launchTabId ?? null,
    url: launch.launchTabUrl,
    title: "",
    windowId: null
  };
}

async function getActiveTabOrg(opts = {}) {
  const preferredOrgKey = String(opts.preferredOrgKey || "").trim();
  const preferredTabUrl = String(opts.tabUrl || "").trim();
  const pinned = !!opts.pinned;
  const useLaunchContext = opts.useLaunchContext !== false && !pinned;

  let tab = null;

  // 1) Explicit pinned session (user chose Active session dropdown).
  if (pinned && (preferredOrgKey || preferredTabUrl)) {
    tab = await resolveTabFromPreference(preferredOrgKey, preferredTabUrl);
  }

  // 2) Launch context — org the user was on when they opened OrgKit.
  if (!tab?.url && useLaunchContext) {
    const launch = await getLaunchContext();
    tab = await tabFromLaunchContext(launch);
  }

  // 3) Most recently accessed Salesforce tab (works after OrgKit becomes active).
  if (!tab?.url) {
    tab = await findSalesforceTab();
  }

  // 4) Soft preference fallback.
  if (!tab?.url && (preferredOrgKey || preferredTabUrl)) {
    tab = await resolveTabFromPreference(preferredOrgKey, preferredTabUrl);
  }

  if (!tab?.url || !isSalesforceUrl(tab.url)) {
    return { tab: tab || null, org: null, session: null, launchTabUrl: null };
  }
  const org = parseOrgFromUrl(tab.url);
  const [session, launch] = await Promise.all([
    getSessionForOrg(org),
    useLaunchContext ? getLaunchContext() : Promise.resolve(null)
  ]);
  return {
    tab,
    org,
    session,
    launchTabUrl: launch?.launchTabUrl || tab.url || null
  };
}

async function openOrgKitTab(view, hintTab) {
  // Capture Salesforce org BEFORE OrgKit becomes the active tab.
  const launch = await captureLaunchContext(hintTab);

  const base = chrome.runtime.getURL("app/index.html");
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  // Pass host in the URL so Active session can default even if storage is slow.
  if (launch?.launchTabUrl) {
    try {
      params.set("launchHost", new URL(launch.launchTabUrl).hostname);
    } catch {
      /* ignore */
    }
  }
  const qs = params.toString();
  const url = qs ? `${base}?${qs}` : base;
  const all = await chrome.tabs.query({});
  const existing = all.find((t) => typeof t.url === "string" && t.url.startsWith(base));
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url });
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    return { ok: true, tabId: existing.id, reused: true };
  }
  const tab = await chrome.tabs.create({ url });
  return { ok: true, tabId: tab.id, reused: false };
}

/**
 * Run a Salesforce REST/Tooling request from the service worker.
 * Uses declared Salesforce host_permissions + the browser session cookie (sid).
 * No chrome.scripting injection — same session model as Salesforce Inspector Reloaded.
 */
async function sfFetchUrl(url, sid, options = {}) {
  return sfFetchUrlDirect(url, sid, options);
}

async function sfFetchUrlDirect(url, sid, options = {}) {
  const method = options.method || "GET";
  const headers = {
    Authorization: `Bearer ${sid}`,
    Accept: "application/json",
    ...(options.headers || {})
  };
  if (options.body != null && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: options.body != null ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
      credentials: "omit"
    });
  } catch (e) {
    throw new Error(networkBlockedMessage(url, e));
  }

  if ((method === "DELETE" || method === "PATCH" || method === "PUT") && (res.status === 204 || res.status === 200)) {
    if (res.status === 204) return { ok: true };
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg =
      (Array.isArray(body) && body[0]?.message) || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body == null ? { ok: true } : body;
}

async function sfFetchText(url, sid) {
  return sfFetchTextDirect(url, sid);
}

async function sfFetchTextDirect(url, sid) {
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sid}`,
        Accept: "text/plain, application/json"
      },
      credentials: "omit"
    });
  } catch (e) {
    throw new Error(networkBlockedMessage(url, e));
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = JSON.parse(text);
      msg = (Array.isArray(body) && body[0]?.message) || body?.message || msg;
    } catch {
      /* keep status */
    }
    throw new Error(msg);
  }
  return text;
}

/**
 * Prefer the active Salesforce tab; otherwise the most recently accessed
 * Salesforce tab (critical when OrgKit itself is the active tab).
 */
async function findSalesforceTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.url && isSalesforceUrl(active.url) && !isLoginOnlyUrl(active.url)) {
    return active;
  }

  const all = await chrome.tabs.query({});
  const sfTabs = (all || []).filter(
    (t) => t?.url && isSalesforceUrl(t.url) && !isLoginOnlyUrl(t.url)
  );
  if (!sfTabs.length) return active || null;

  sfTabs.sort((a, b) => {
    const byAccess = (b.lastAccessed || 0) - (a.lastAccessed || 0);
    if (byAccess) return byAccess;
    // Prefer same window as the active (OrgKit) tab when timestamps tie.
    if (active?.windowId != null) {
      const aSame = a.windowId === active.windowId ? 1 : 0;
      const bSame = b.windowId === active.windowId ? 1 : 0;
      if (aSame !== bSame) return bSame - aSame;
    }
    return (b.id || 0) - (a.id || 0);
  });
  return sfTabs[0];
}

function isLoginOnlyUrl(url) {
  try {
    const u = new URL(url);
    return /^(login|test)\.salesforce\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

async function getOrgSession(tabUrl) {
  if (!tabUrl || !isSalesforceUrl(tabUrl)) {
    throw new Error("Not a Salesforce tab");
  }
  const org = parseOrgFromUrl(tabUrl);
  const session = await getSessionForOrg(org);
  return { org, session };
}

/** Short-lived in-memory session cache (sid stays in SW memory only; never written to storage). */
const SESSION_CACHE_TTL_MS = 45_000;
/** @type {Map<string, { at: number, result: object }>} */
const sessionCache = new Map();

function sessionCacheKey(org, strict) {
  return `${strict ? "s" : "n"}|${org?.hostname || ""}|${org?.apiBase || ""}`;
}

function rememberSession(org, strict, result) {
  if (!org || !result?.sid) return;
  sessionCache.set(sessionCacheKey(org, strict), { at: Date.now(), result });
}

async function getSessionForOrg(org, { strict = false } = {}) {
  if (!org) throw new Error("Missing org");
  const key = sessionCacheKey(org, strict);
  const hit = sessionCache.get(key);
  if (hit && Date.now() - hit.at < SESSION_CACHE_TTL_MS) {
    return hit.result;
  }
  const result = await getSessionForOrgUncached(org, { strict });
  rememberSession(org, strict, result);
  return result;
}

async function probeUserInfo(apiBase, sid) {
  try {
    await ensureHostFetchAllowed(apiBase);
  } catch {
    /* fetch path still clarifies site access */
  }
  try {
    return await sfFetchUrl(`${apiBase}/services/oauth2/userinfo`, sid);
  } catch {
    return await sfFetchUrl(restUrl(apiBase, "/chatter/users/me"), sid);
  }
}

async function getSessionForOrgUncached(org, { strict = false } = {}) {
  // Prefer my.salesforce.com / pod salesforce.com sid for REST/Tooling.
  // Lightning/setup sids are host-scoped — they fail against a rewritten
  // *.my.salesforce.com apiBase ("Session expired or invalid"). That failure
  // is common on sandboxes where users only open Lightning tabs.
  const apiHost = toSalesforceApiHost(org.hostname);
  const hostsToTry = unique([
    apiHost,
    org.apiBase ? new URL(org.apiBase).hostname : null,
    org.hostname,
    toSalesforceLightningHost(org.hostname),
    toSalesforceLightningHost(apiHost)
  ]);

  /** @type {{ host: string, sid: string, rank: number }[]} */
  const candidates = [];
  const seenHosts = new Set();
  const pushCandidate = (host, sid) => {
    const h = String(host || "")
      .replace(/^\./, "")
      .toLowerCase();
    if (!h || !sid || seenHosts.has(h)) return;
    seenHosts.add(h);
    candidates.push({ host: h, sid, rank: apiCookieRank(h) });
  };

  // Parallel cookie host probes (was sequential — major sandbox latency).
  await Promise.all(
    hostsToTry.filter(Boolean).map(async (host) => {
      try {
        const cookie = await chrome.cookies.get({ url: `https://${host}/`, name: "sid" });
        if (cookie?.value) pushCandidate(host, cookie.value);
      } catch {
        /* ignore per-host cookie read failures */
      }
    })
  );

  // Full Salesforce sid enumeration is relatively expensive. Skip when host probes
  // already found a cookie for this org (common path after opening from a tab).
  if (!candidates.length) {
    try {
      const sfCookies = await listSalesforceSidCookies();
      const ranked = [...sfCookies].sort(
        (a, b) => apiCookieRank(b.domain) - apiCookieRank(a.domain)
      );
      const affinityMatches = ranked.filter((c) => sameOrgAffinity(org.hostname, c.domain));
      for (const match of affinityMatches) {
        if (match?.value) pushCandidate(String(match.domain || "").replace(/^\./, ""), match.value);
      }
      // Non-strict single-org UX: if affinity found nothing, allow top Salesforce sids.
      if (!candidates.length && !strict) {
        for (const match of ranked.slice(0, 3)) {
          if (match?.value) pushCandidate(String(match.domain || "").replace(/^\./, ""), match.value);
        }
      }
    } catch {
      /* ignore cookie enumeration failures */
    }
  }

  candidates.sort((a, b) => b.rank - a.rank);

  if (!candidates.length) {
    return { sid: null, apiBase: org.apiBase, cookieHost: null, userInfo: null };
  }

  let bestUnvalidated = null;
  for (const candidate of candidates) {
    const bases = apiBaseCandidatesForCookieHost(candidate.host);
    // Race API bases for this cookie — first valid userinfo wins (do not wait for all).
    try {
      const { apiBase, userInfo } = await Promise.any(
        bases.map(async (apiBase) => {
          const userInfo = await probeUserInfo(apiBase, candidate.sid);
          return { apiBase, userInfo };
        })
      );
      return {
        sid: candidate.sid,
        apiBase,
        cookieHost: candidate.host,
        userInfo
      };
    } catch {
      if (!bestUnvalidated && bases[0]) {
        bestUnvalidated = {
          sid: candidate.sid,
          apiBase: bases[0],
          cookieHost: candidate.host,
          userInfo: null
        };
      }
    }
  }

  // Prefer a host-matched unvalidated cookie (navigation-only) over claiming no session.
  // Never keep a Lightning sid paired only with a failed my.salesforce rewrite — candidates
  // already tried Lightning apiBase first for Lightning cookies.
  if (bestUnvalidated && sameOrgAffinity(org.hostname, bestUnvalidated.cookieHost)) {
    return bestUnvalidated;
  }
  return { sid: null, apiBase: org.apiBase, cookieHost: null, userInfo: null };
}

/**
 * True when a sid cookie exists for this org (no userinfo / network).
 * Used by the Active session picklist for fast paint.
 */
function cookieMatchesOrg(cookies, orgHostname) {
  if (!orgHostname || !Array.isArray(cookies)) return false;
  return cookies.some((c) => sameOrgAffinity(orgHostname, c.domain));
}

function alreadyListedOrg(byKey, org) {
  return [...byKey.values()].some(
    (e) =>
      sameOrgAffinity(e.hostname || e.apiBase || e.tabUrl || "", org.hostname) ||
      e.hostname === org.hostname ||
      e.apiBase === org.apiBase
  );
}

/**
 * List open Salesforce tabs / cookie-backed sessions for dual-org pickers.
 * Scans tabs in every Chrome window (not just the focused one).
 * Never returns sid values — only host, labels, and a tabUrl for subsequent API calls.
 *
 * Fast path: cookie presence only (no per-org userinfo). Full session validation
 * happens when that org is selected / used for API calls.
 */
async function listSalesforceOrgs() {
  // Empty query = all tabs across all windows in this Chrome profile.
  const [tabs, cookies] = await Promise.all([
    chrome.tabs.query({}).catch(() => []),
    listSalesforceSidCookies().catch(() => [])
  ]);
  const sfTabs = (tabs || []).filter(
    (t) => t?.url && isSalesforceUrl(t.url) && !isLoginOnlyUrl(t.url)
  );

  /** @type {Map<number, chrome.windows.Window>} */
  const windowById = new Map();
  try {
    const windows = await chrome.windows.getAll({ populate: false, windowTypes: ["normal"] });
    for (const w of windows || []) {
      if (w?.id != null) windowById.set(w.id, w);
    }
  } catch {
    /* windows API unavailable — still list tabs without window labels */
  }

  // Stable window numbers for UI (1-based, focused first then by id).
  const orderedWindowIds = [...windowById.values()]
    .sort((a, b) => {
      if (!!b.focused !== !!a.focused) return b.focused ? 1 : -1;
      return (a.id || 0) - (b.id || 0);
    })
    .map((w) => w.id);
  const windowNumberById = new Map(orderedWindowIds.map((id, i) => [id, i + 1]));

  /** @type {Map<string, object>} */
  const byKey = new Map();

  const mergeSources = (prevSources, nextSource) => {
    const sources = Array.isArray(prevSources) ? [...prevSources] : [];
    if (!nextSource) return sources;
    const dup = sources.some(
      (s) =>
        s.tabId != null &&
        nextSource.tabId != null &&
        s.tabId === nextSource.tabId
    );
    if (!dup) sources.push(nextSource);
    return sources;
  };

  const upsert = (entry) => {
    const key = entry.orgKey;
    if (!key) return;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        ...entry,
        sources: mergeSources([], entry.source || null),
        tabCount: entry.tabId ? 1 : 0,
        windowIds: entry.windowId != null ? [entry.windowId] : []
      });
      return;
    }

    const sources = mergeSources(prev.sources, entry.source || null);
    const windowIds = [
      ...new Set(
        [...(prev.windowIds || []), ...(entry.windowId != null ? [entry.windowId] : [])].filter(
          (id) => id != null
        )
      )
    ];
    const tabCount = sources.filter((s) => s.tabId != null).length;

    // Prefer entries that have a session + a live tab; keep richest metadata.
    const prevScore = (prev.hasSession ? 2 : 0) + (prev.tabId ? 1 : 0) + (prev.windowFocused ? 0.5 : 0);
    const nextScore =
      (entry.hasSession ? 2 : 0) + (entry.tabId ? 1 : 0) + (entry.windowFocused ? 0.5 : 0);
    const base = nextScore > prevScore ? { ...prev, ...entry } : { ...entry, ...prev };
    byKey.set(key, {
      ...base,
      sources,
      tabCount,
      windowIds,
      windowLabels: windowIds
        .map((id) => {
          const n = windowNumberById.get(id);
          const focused = windowById.get(id)?.focused;
          if (!n) return null;
          return focused ? `Window ${n} (focused)` : `Window ${n}`;
        })
        .filter(Boolean)
    });
  };

  for (const tab of sfTabs) {
    const org = parseOrgFromUrl(tab.url);
    if (!org) continue;
    const hasSession = cookieMatchesOrg(cookies, org.hostname);
    const orgKey = org.apiBase || org.hostname;
    const displayName = org.myDomain || org.hostname;
    const win = tab.windowId != null ? windowById.get(tab.windowId) : null;
    const windowNumber = tab.windowId != null ? windowNumberById.get(tab.windowId) : null;
    const windowLabel =
      windowNumber != null
        ? win?.focused
          ? `Window ${windowNumber} (focused)`
          : `Window ${windowNumber}`
        : tab.windowId != null
          ? `Window ${tab.windowId}`
          : "Window";
    upsert({
      orgKey,
      tabId: tab.id,
      tabUrl: tab.url,
      tabTitle: String(tab.title || "").slice(0, 120),
      windowId: tab.windowId ?? null,
      windowNumber: windowNumber ?? null,
      windowFocused: !!win?.focused,
      windowLabel,
      hostname: org.hostname,
      apiBase: org.apiBase,
      myDomain: org.myDomain,
      envLabel: org.envLabel,
      isSandbox: !!org.isSandbox,
      isDevEd: !!org.isDevEd,
      hasSession,
      username: "",
      orgId: "",
      sourceKind: "tab",
      label: `${org.envLabel}: ${displayName}`,
      source: {
        kind: "tab",
        tabId: tab.id,
        tabUrl: tab.url,
        tabTitle: String(tab.title || "").slice(0, 120),
        windowId: tab.windowId ?? null,
        windowNumber: windowNumber ?? null,
        windowLabel
      }
    });
  }

  // Cookie-backed sessions without a matching open tab (still usable via apiBase URL).
  for (const c of cookies || []) {
    const domain = String(c.domain || "").replace(/^\./, "").toLowerCase();
    // Include Lightning/Setup cookie sessions (rank 1).
    if (!domain || apiCookieRank(domain) < 1) continue;
    // Keep cookie host in tabUrl so Setup/Lightning sids resolve correctly.
    const tabUrl = `https://${domain}/`;
    const org = parseOrgFromUrl(tabUrl);
    if (!org) continue;
    if (alreadyListedOrg(byKey, org)) continue;
    const orgKey = org.apiBase || org.hostname;
    if (byKey.has(orgKey)) continue;
    upsert({
      orgKey,
      tabId: null,
      tabUrl,
      tabTitle: "",
      windowId: null,
      windowNumber: null,
      windowFocused: false,
      windowLabel: "Cookie session (no open tab)",
      hostname: org.hostname,
      apiBase: org.apiBase,
      myDomain: org.myDomain,
      envLabel: org.envLabel,
      isSandbox: !!org.isSandbox,
      isDevEd: !!org.isDevEd,
      hasSession: true,
      username: "",
      orgId: "",
      sourceKind: "cookie",
      label: `${org.envLabel}: ${org.myDomain || org.hostname}`,
      source: {
        kind: "cookie",
        tabId: null,
        tabUrl,
        tabTitle: "",
        windowId: null,
        windowNumber: null,
        windowLabel: "Cookie session (no open tab)"
      }
    });
  }

  // Seed opener/launch org when tab URL discovery missed it (common on Setup hosts).
  try {
    const launch = await getLaunchContext();
    if (launch?.launchTabUrl && isSalesforceUrl(launch.launchTabUrl) && !isLoginOnlyUrl(launch.launchTabUrl)) {
      const org = parseOrgFromUrl(launch.launchTabUrl);
      if (org && !alreadyListedOrg(byKey, org)) {
        const hasSession = cookieMatchesOrg(cookies, org.hostname);
        const orgKey = org.apiBase || org.hostname;
        upsert({
          orgKey,
          tabId: launch.launchTabId ?? null,
          tabUrl: launch.launchTabUrl,
          tabTitle: "",
          windowId: null,
          windowNumber: null,
          windowFocused: false,
          windowLabel: "Launch session",
          hostname: org.hostname,
          apiBase: org.apiBase,
          myDomain: org.myDomain,
          envLabel: org.envLabel,
          isSandbox: !!org.isSandbox,
          isDevEd: !!org.isDevEd,
          hasSession,
          username: "",
          orgId: "",
          sourceKind: "launch",
          label: `${org.envLabel}: ${org.myDomain || org.hostname}`,
          source: {
            kind: "launch",
            tabId: launch.launchTabId ?? null,
            tabUrl: launch.launchTabUrl,
            tabTitle: "",
            windowId: null,
            windowNumber: null,
            windowLabel: "Launch session"
          }
        });
      }
    }
  } catch {
    /* ignore */
  }

  return [...byKey.values()]
    .map((entry) => {
      const windowLabels =
        entry.windowLabels ||
        (entry.windowLabel ? [entry.windowLabel] : []).filter(Boolean);
      const locationBit = windowLabels.length
        ? windowLabels.join(", ")
        : entry.sourceKind === "cookie"
          ? "Cookie session"
          : "Open tab";
      const tabBit =
        entry.tabCount > 1 ? ` · ${entry.tabCount} tabs` : entry.tabId ? " · open tab" : "";
      return {
        ...entry,
        windowLabels,
        locationLabel: `${locationBit}${tabBit}`,
        // Keep picker label readable; location shown separately in UI.
        label: entry.label
      };
    })
    .sort((a, b) => {
      if (!!b.hasSession !== !!a.hasSession) return b.hasSession ? 1 : -1;
      if (!!b.windowFocused !== !!a.windowFocused) return b.windowFocused ? 1 : -1;
      return String(a.label).localeCompare(String(b.label));
    });
}

/**
 * Build a field/object inventory for one org via REST describe (no Metadata API).
 * Defaults to custom objects (+ __mdt) for speed.
 */
async function fetchOrgInventory(tabUrl, options = {}) {
  const mode = options.mode || "custom";
  const apiVersion = options.apiVersion || DEFAULT_API_VERSION;
  const maxObjects = Math.min(Math.max(Number(options.maxObjects) || 200, 1), 500);

  const { org, session } = await getOrgSessionStrict(tabUrl);
  if (!session?.sid) {
    throw new Error("No Salesforce session cookie for that org. Open a logged-in tab for it.");
  }
  await ensureHostFetchAllowed(session.apiBase);

  const globalUrl = restUrl(session.apiBase, "/sobjects", apiVersion);
  const global = await sfFetchUrl(globalUrl, session.sid);
  const targets = filterGlobalObjects(global?.sobjects || [], mode).slice(0, maxObjects);

  const objects = {};
  const errors = [];
  const concurrency = 5;
  let index = 0;

  async function worker() {
    while (index < targets.length) {
      const i = index;
      index += 1;
      const name = targets[i].name;
      try {
        const path = `/sobjects/${name}/describe`;
        const url = restUrl(session.apiBase, path, apiVersion);
        const desc = await sfFetchUrl(url, session.sid);
        const normalized = normalizeObjectDescribe(desc);
        if (normalized) objects[normalized.name] = normalized;
      } catch (e) {
        errors.push({ object: name, error: e.message || String(e) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length || 1) }, () => worker()));

  const username =
    session.userInfo?.preferred_username ||
    session.userInfo?.email ||
    session.userInfo?.username ||
    "";
  const orgKey = session.userInfo?.organization_id || org.apiBase || org.hostname;

  return {
    orgKey,
    label: `${org.envLabel}: ${org.myDomain || org.hostname}`,
    hostname: org.hostname,
    apiBase: session.apiBase,
    envLabel: org.envLabel,
    username,
    mode,
    objectCount: Object.keys(objects).length,
    scanned: targets.length,
    truncated: (global?.sobjects || []).length > 0 && filterGlobalObjects(global.sobjects || [], mode).length > maxObjects,
    errors,
    objects,
    // Convenience counts for UI
    customObjectCount: Object.values(objects).filter((o) => isCustomObjectName(o.name)).length
  };
}

/**
 * Multi-category Org Compare inventory (objects via describe + common metadata via SOQL/Tooling).
 * Never returns sid.
 */
async function fetchCompareBundle(tabUrl, options = {}) {
  const apiVersion = options.apiVersion || DEFAULT_API_VERSION;
  const mode = options.mode || "custom";
  const maxObjects = Math.min(Math.max(Number(options.maxObjects) || 200, 1), 500);
  const maxRows = Math.min(Math.max(Number(options.maxRows) || 2000, 50), 5000);
  const categories = Array.isArray(options.categories) && options.categories.length
    ? [...new Set(options.categories.map(String))]
    : defaultCompareCategoryIds();

  const { org, session } = await getOrgSessionStrict(tabUrl);
  if (!session?.sid) {
    throw new Error("No Salesforce session cookie for that org. Open a logged-in tab for it.");
  }
  await ensureHostFetchAllowed(session.apiBase);

  const username =
    session.userInfo?.preferred_username ||
    session.userInfo?.email ||
    session.userInfo?.username ||
    "";
  const orgKey = session.userInfo?.organization_id || org.apiBase || org.hostname;
  const bundle = {
    orgKey,
    label: `${org.envLabel}: ${org.myDomain || org.hostname}`,
    hostname: org.hostname,
    apiBase: session.apiBase,
    envLabel: org.envLabel,
    username,
    mode,
    categories: {},
    objects: {},
    objectCount: 0,
    errors: [],
    truncated: {},
    categoryCounts: {}
  };

  const runNamed = async (catId, label, metadataType, attrKeys, runner) => {
    try {
      const result = await runner();
      bundle.categories[catId] = {
        id: catId,
        label,
        metadataType,
        attrKeys,
        items: result.items || {},
        scanned: result.scanned || Object.keys(result.items || {}).length
      };
      bundle.categoryCounts[catId] = Object.keys(result.items || {}).length;
      if (result.truncated) bundle.truncated[catId] = true;
      if (Array.isArray(result.errors) && result.errors.length) {
        bundle.errors.push(...result.errors.map((e) => ({ category: catId, ...e })));
      }
    } catch (e) {
      bundle.errors.push({ category: catId, error: e.message || String(e) });
      bundle.categories[catId] = {
        id: catId,
        label,
        metadataType,
        attrKeys,
        items: {},
        scanned: 0
      };
      bundle.categoryCounts[catId] = 0;
    }
  };

  // Run selected categories; objects first if present, others in parallel.
  const wantObjects = categories.includes("objects");
  const otherCats = categories.filter((c) => c !== "objects");

  if (wantObjects) {
    try {
      const inv = await fetchOrgInventory(tabUrl, { mode, apiVersion, maxObjects });
      bundle.objects = inv.objects || {};
      bundle.objectCount = inv.objectCount || 0;
      bundle.categories.objects = {
        id: "objects",
        label: "Objects & fields",
        metadataType: "CustomObject",
        attrKeys: [],
        items: inv.objects || {},
        scanned: inv.scanned || 0
      };
      bundle.categoryCounts.objects = bundle.objectCount;
      if (inv.truncated) bundle.truncated.objects = true;
      if (Array.isArray(inv.errors)) {
        for (const err of inv.errors) bundle.errors.push({ category: "objects", ...err });
      }
    } catch (e) {
      bundle.errors.push({ category: "objects", error: e.message || String(e) });
      bundle.categories.objects = {
        id: "objects",
        label: "Objects & fields",
        metadataType: "CustomObject",
        attrKeys: [],
        items: {},
        scanned: 0
      };
    }
  }

  const jobs = [];

  if (otherCats.includes("profiles")) {
    jobs.push(
      runNamed("profiles", "Profiles", "Profile", [], async () => {
        const q =
          "SELECT Id, Name, LastModifiedDate FROM Profile ORDER BY Name ASC";
        const page = await queryAllRecords(session, q, { tooling: false, apiVersion, maxRows });
        const items = {};
        for (const r of page.records) {
          const name = String(r.Name || "").trim();
          if (!name) continue;
          items[name] = {
            name,
            label: name,
            custom: !STANDARD_PROFILE_NAMES.has(name),
            packageMember: name,
            attrs: {
              lastModifiedDate: shortDate(r.LastModifiedDate)
            }
          };
        }
        return { items, scanned: page.records.length, truncated: page.truncated };
      })
    );
  }

  if (otherCats.includes("permissionSets")) {
    jobs.push(
      runNamed(
        "permissionSets",
        "Permission sets",
        "PermissionSet",
        ["label", "namespace", "isCustom", "description"],
        async () => {
          const q =
            "SELECT Id, Name, Label, NamespacePrefix, Description, IsCustom, LastModifiedDate FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Name ASC";
          const page = await queryAllRecords(session, q, { tooling: false, apiVersion, maxRows });
          const items = {};
          for (const r of page.records) {
            const name = memberName(r.NamespacePrefix, r.Name);
            if (!name) continue;
            items[name] = {
              name,
              label: r.Label || r.Name || name,
              custom: r.IsCustom !== false,
              packageMember: name,
              attrs: {
                label: r.Label || "",
                namespace: r.NamespacePrefix || "",
                isCustom: r.IsCustom ? "yes" : "no",
                description: String(r.Description || "").slice(0, 120),
                lastModifiedDate: shortDate(r.LastModifiedDate)
              }
            };
          }
          return { items, scanned: page.records.length, truncated: page.truncated };
        }
      )
    );
  }

  if (otherCats.includes("flows")) {
    jobs.push(
      runNamed(
        "flows",
        "Flows",
        "Flow",
        FLOW_COMPARE_ATTR_KEYS,
        async () => {
          const errors = [];
          let items = {};
          let scanned = 0;
          let truncated = false;

          try {
            const q =
              "SELECT ApiName, Label, ProcessType, TriggerType, IsActive, LastModifiedDate FROM FlowDefinitionView ORDER BY ApiName ASC";
            const page = await queryAllRecords(session, q, { tooling: false, apiVersion, maxRows });
            scanned = page.records.length;
            truncated = !!page.truncated;
            for (const r of page.records) {
              const name = String(r.ApiName || "").trim();
              if (!name) continue;
              items[name] = {
                name,
                label: r.Label || name,
                custom: true,
                packageMember: name,
                attrs: {
                  label: r.Label || "",
                  processType: r.ProcessType || "",
                  triggerType: r.TriggerType || "",
                  isActive: r.IsActive ? "yes" : "no"
                }
              };
            }
          } catch {
            try {
              const q =
                "SELECT Id, DeveloperName, MasterLabel, NamespacePrefix, LastModifiedDate FROM FlowDefinition ORDER BY DeveloperName ASC";
              const page = await queryAllRecords(session, q, { tooling: true, apiVersion, maxRows });
              scanned = page.records.length;
              truncated = !!page.truncated;
              for (const r of page.records) {
                const name = memberName(r.NamespacePrefix, r.DeveloperName);
                if (!name) continue;
                items[name] = {
                  name,
                  label: r.MasterLabel || name,
                  custom: true,
                  packageMember: name,
                  attrs: {
                    label: r.MasterLabel || "",
                    processType: "",
                    triggerType: "",
                    isActive: "—"
                  }
                };
              }
            } catch (e) {
              errors.push({ error: e.message || String(e) });
            }
          }

          try {
            let page;
            try {
              page = await queryAllRecords(session, buildActiveFlowsQuery({ includeNamespace: true }), {
                tooling: true,
                apiVersion,
                maxRows
              });
            } catch {
              page = await queryAllRecords(session, buildActiveFlowsQuery({ includeNamespace: false }), {
                tooling: true,
                apiVersion,
                maxRows
              });
            }
            items = applyActiveVersionsToFlowItems(items, indexActiveFlowVersions(page.records));
            truncated = truncated || !!page.truncated;
          } catch (e) {
            errors.push({ error: `Active flow versions: ${e.message || String(e)}` });
            items = applyActiveVersionsToFlowItems(items, {});
          }

          return { items, scanned, truncated, errors };
        }
      )
    );
  }

  if (otherCats.includes("apexClasses")) {
    jobs.push(
      runNamed(
        "apexClasses",
        "Apex classes",
        "ApexClass",
        ["namespace", "apiVersion", "status", "lengthWithoutComments"],
        async () => {
          const q =
            "SELECT Id, Name, NamespacePrefix, ApiVersion, Status, LengthWithoutComments, LastModifiedDate FROM ApexClass ORDER BY Name ASC";
          const page = await queryAllRecords(session, q, { tooling: true, apiVersion, maxRows });
          const items = {};
          for (const r of page.records) {
            const name = memberName(r.NamespacePrefix, r.Name);
            if (!name) continue;
            items[name] = {
              name,
              label: r.Name || name,
              custom: !r.NamespacePrefix,
              packageMember: name,
              attrs: {
                namespace: r.NamespacePrefix || "",
                apiVersion: r.ApiVersion != null ? String(r.ApiVersion) : "",
                status: r.Status || "",
                lengthWithoutComments:
                  r.LengthWithoutComments != null ? String(r.LengthWithoutComments) : "",
                lastModifiedDate: shortDate(r.LastModifiedDate)
              }
            };
          }
          return { items, scanned: page.records.length, truncated: page.truncated };
        }
      )
    );
  }

  if (otherCats.includes("apexTriggers")) {
    jobs.push(
      runNamed(
        "apexTriggers",
        "Apex triggers",
        "ApexTrigger",
        ["namespace", "tableEnumOrId", "apiVersion", "status"],
        async () => {
          const q =
            "SELECT Id, Name, TableEnumOrId, NamespacePrefix, ApiVersion, Status, LastModifiedDate FROM ApexTrigger ORDER BY Name ASC";
          const page = await queryAllRecords(session, q, { tooling: true, apiVersion, maxRows });
          const items = {};
          for (const r of page.records) {
            const name = memberName(r.NamespacePrefix, r.Name);
            if (!name) continue;
            items[name] = {
              name,
              label: r.Name || name,
              custom: !r.NamespacePrefix,
              packageMember: name,
              attrs: {
                namespace: r.NamespacePrefix || "",
                tableEnumOrId: r.TableEnumOrId || "",
                apiVersion: r.ApiVersion != null ? String(r.ApiVersion) : "",
                status: r.Status || "",
                lastModifiedDate: shortDate(r.LastModifiedDate)
              }
            };
          }
          return { items, scanned: page.records.length, truncated: page.truncated };
        }
      )
    );
  }

  if (otherCats.includes("validationRules")) {
    jobs.push(
      runNamed(
        "validationRules",
        "Validation rules",
        "ValidationRule",
        ["object", "active", "errorDisplayField"],
        async () => {
          const q =
            "SELECT Id, ValidationName, Active, ErrorDisplayField, EntityDefinition.QualifiedApiName, LastModifiedDate FROM ValidationRule ORDER BY EntityDefinition.QualifiedApiName ASC, ValidationName ASC";
          const page = await queryAllRecords(session, q, { tooling: true, apiVersion, maxRows });
          const items = {};
          for (const r of page.records) {
            const objectName =
              r.EntityDefinition?.QualifiedApiName ||
              r.EntityDefinition?.QualifiedApiName ||
              "";
            const rule = String(r.ValidationName || "").trim();
            if (!rule) continue;
            const name = objectName ? `${objectName}.${rule}` : rule;
            items[name] = {
              name,
              label: name,
              custom: true,
              packageMember: name,
              attrs: {
                object: objectName || "",
                active: r.Active ? "yes" : "no",
                errorDisplayField: r.ErrorDisplayField || "",
                lastModifiedDate: shortDate(r.LastModifiedDate)
              }
            };
          }
          return { items, scanned: page.records.length, truncated: page.truncated };
        }
      )
    );
  }

  if (otherCats.includes("recordTypes")) {
    jobs.push(
      runNamed(
        "recordTypes",
        "Record types",
        "RecordType",
        ["object", "developerName", "isActive", "namespace"],
        async () => {
          const q =
            "SELECT Id, Name, DeveloperName, SobjectType, IsActive, NamespacePrefix, LastModifiedDate FROM RecordType ORDER BY SobjectType ASC, DeveloperName ASC";
          const page = await queryAllRecords(session, q, { tooling: false, apiVersion, maxRows });
          const items = {};
          for (const r of page.records) {
            const objectName = String(r.SobjectType || "").trim();
            const dev = String(r.DeveloperName || r.Name || "").trim();
            if (!objectName || !dev) continue;
            const name = `${objectName}.${dev}`;
            const pkg = memberName(r.NamespacePrefix, `${objectName}.${dev}`);
            items[name] = {
              name,
              label: r.Name || name,
              custom: String(objectName).includes("__"),
              packageMember: pkg || name,
              attrs: {
                object: objectName,
                developerName: dev,
                isActive: r.IsActive ? "yes" : "no",
                namespace: r.NamespacePrefix || "",
                lastModifiedDate: shortDate(r.LastModifiedDate)
              }
            };
          }
          return { items, scanned: page.records.length, truncated: page.truncated };
        }
      )
    );
  }

  if (otherCats.includes("flexiPages")) {
    jobs.push(
      runNamed(
        "flexiPages",
        "Lightning pages",
        "FlexiPage",
        ["label", "namespace", "entityDefinitionId"],
        async () => {
          const q =
            "SELECT Id, DeveloperName, MasterLabel, NamespacePrefix, EntityDefinitionId, LastModifiedDate FROM FlexiPage ORDER BY DeveloperName ASC";
          const page = await queryAllRecords(session, q, { tooling: true, apiVersion, maxRows });
          const items = {};
          for (const r of page.records) {
            const name = memberName(r.NamespacePrefix, r.DeveloperName);
            if (!name) continue;
            items[name] = {
              name,
              label: r.MasterLabel || name,
              custom: !r.NamespacePrefix,
              packageMember: name,
              attrs: {
                label: r.MasterLabel || "",
                namespace: r.NamespacePrefix || "",
                entityDefinitionId: r.EntityDefinitionId || "",
                lastModifiedDate: shortDate(r.LastModifiedDate)
              }
            };
          }
          return { items, scanned: page.records.length, truncated: page.truncated };
        }
      )
    );
  }

  if (otherCats.includes("lwc")) {
    jobs.push(
      runNamed(
        "lwc",
        "LWC bundles",
        "LightningComponentBundle",
        ["namespace", "apiVersion"],
        async () => {
          const q =
            "SELECT Id, DeveloperName, NamespacePrefix, ApiVersion, LastModifiedDate FROM LightningComponentBundle ORDER BY DeveloperName ASC";
          const page = await queryAllRecords(session, q, { tooling: true, apiVersion, maxRows });
          const items = {};
          for (const r of page.records) {
            const name = memberName(r.NamespacePrefix, r.DeveloperName);
            if (!name) continue;
            items[name] = {
              name,
              label: r.DeveloperName || name,
              custom: !r.NamespacePrefix,
              packageMember: name,
              attrs: {
                namespace: r.NamespacePrefix || "",
                apiVersion: r.ApiVersion != null ? String(r.ApiVersion) : "",
                lastModifiedDate: shortDate(r.LastModifiedDate)
              }
            };
          }
          return { items, scanned: page.records.length, truncated: page.truncated };
        }
      )
    );
  }

  await Promise.all(jobs);
  return bundle;
}

const STANDARD_PROFILE_NAMES = new Set([
  "System Administrator",
  "Standard User",
  "Read Only",
  "Marketing User",
  "Contract Manager",
  "Solution Manager",
  "Guest License User",
  "Chatter Free User",
  "Chatter Moderator User",
  "Chatter External User",
  "Minimum Access - Salesforce",
  "Salesforce API Only System Integrations"
]);

function memberName(namespacePrefix, name) {
  const n = String(name || "").trim();
  if (!n) return "";
  const ns = String(namespacePrefix || "").trim();
  return ns ? `${ns}__${n}` : n;
}

function shortDate(value) {
  if (!value) return "";
  try {
    return String(value).slice(0, 19).replace("T", " ");
  } catch {
    return String(value);
  }
}

/**
 * Paginate SOQL / Tooling query results up to maxRows.
 * nextRecordsUrl is used as returned by Salesforce (full /services/data/... path).
 */
async function queryAllRecords(session, query, { tooling = false, apiVersion = DEFAULT_API_VERSION, maxRows = 2000 } = {}) {
  const path = tooling
    ? `/tooling/query?q=${encodeURIComponent(query)}`
    : `/query?q=${encodeURIComponent(query)}`;
  let data = await sfFetchUrl(restUrl(session.apiBase, path, apiVersion), session.sid);
  const records = [...(data.records || [])];
  let next = data.nextRecordsUrl;
  while (next && records.length < maxRows) {
    const url = next.startsWith("http")
      ? next
      : `${session.apiBase}${next.startsWith("/") ? "" : "/"}${next}`;
    data = await sfFetchUrl(url, session.sid);
    records.push(...(data.records || []));
    next = data.done ? null : data.nextRecordsUrl;
  }
  return {
    records: records.slice(0, maxRows),
    truncated: records.length > maxRows || Boolean(next),
    totalSize: data.totalSize ?? records.length
  };
}

async function getOrgSessionStrict(tabUrl) {
  if (!tabUrl || !isSalesforceUrl(tabUrl)) {
    throw new Error("Not a Salesforce tab");
  }
  const org = parseOrgFromUrl(tabUrl);
  const session = await getSessionForOrg(org, { strict: true });
  return { org, session };
}

/** Higher = better for Salesforce REST API Authorization: Bearer. */
function apiCookieRank(domain) {
  const d = String(domain || "").replace(/^\./, "").toLowerCase();
  if (d.endsWith(".my.salesforce.com")) return 3;
  if (d.endsWith(".salesforce.com") && !d.includes("setup")) return 2;
  // Lightning / Setup sids are usable when apiBase candidates rewrite correctly.
  if (d.endsWith(".lightning.force.com")) return 1;
  if (d.endsWith(".salesforce-setup.com")) return 1;
  return 0;
}

/**
 * Privacy: only request sid cookies for known Salesforce registrable domains.
 * Do not call cookies.getAll({ name: "sid" }) across the whole browser profile.
 */
async function listSalesforceSidCookies() {
  const domains = [
    ".salesforce.com",
    ".force.com",
    ".cloudforce.com",
    ".salesforce-setup.com",
    ".visualforce.com"
  ];
  const parts = await Promise.all(
    domains.map(async (domain) => {
      try {
        const part = await chrome.cookies.getAll({ name: "sid", domain });
        return Array.isArray(part) ? part : [];
      } catch {
        return [];
      }
    })
  );
  const out = parts.flat();
  // De-dupe by domain+value length marker (never log values)
  const seen = new Set();
  return out.filter((c) => {
    const key = `${c.domain}|${c.path}|${String(c.value || "").length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function requireSession(tabUrl) {
  const { org, session } = await getOrgSession(tabUrl);
  if (!session?.sid) throw new Error("No Salesforce session cookie found. Open a logged-in Salesforce tab.");
  return { org, session };
}

async function runSoql(tabUrl, query, apiVersion = DEFAULT_API_VERSION) {
  if (!query?.trim()) throw new Error("SOQL query is empty");
  // Security: caller must not concatenate untrusted input without binds — UI tools use fixed templates.
  const { session } = await requireSession(tabUrl);
  await ensureHostFetchAllowed(session.apiBase);
  const url = restUrl(session.apiBase, `/query?q=${encodeURIComponent(query.trim())}`, apiVersion);
  return sfFetchUrl(url, session.sid);
}

async function toolingQuery(tabUrl, query, apiVersion = DEFAULT_API_VERSION) {
  if (!query?.trim()) throw new Error("Tooling query is empty");
  const { session } = await requireSession(tabUrl);
  await ensureHostFetchAllowed(session.apiBase);
  const url = restUrl(session.apiBase, `/tooling/query?q=${encodeURIComponent(query.trim())}`, apiVersion);
  return sfFetchUrl(url, session.sid);
}

async function restGet(tabUrl, path, apiVersion = DEFAULT_API_VERSION) {
  const { session } = await requireSession(tabUrl);
  await ensureHostFetchAllowed(session.apiBase);
  const url = path.startsWith("http") ? path : restUrl(session.apiBase, path, apiVersion);
  return sfFetchUrl(url, session.sid);
}

async function describeGlobal(tabUrl, apiVersion = DEFAULT_API_VERSION, tooling = false) {
  return restGet(tabUrl, tooling ? "/tooling/sobjects" : "/sobjects", apiVersion);
}

async function describeSObject(tabUrl, sobject, apiVersion = DEFAULT_API_VERSION, tooling = false) {
  if (!sobject) throw new Error("Object API name required");
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(sobject)) throw new Error("Invalid object API name");
  const path = tooling
    ? `/tooling/sobjects/${sobject}/describe`
    : `/sobjects/${sobject}/describe`;
  return restGet(tabUrl, path, apiVersion);
}

function assertRecordId(id) {
  const clean = String(id || "").trim();
  if (!/^[a-zA-Z0-9]{15,18}$/.test(clean)) throw new Error("Invalid Salesforce record Id.");
  return clean;
}

function assertSObjectName(sobject) {
  const name = String(sobject || "").trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error("Invalid object API name");
  return name;
}

async function getSObject(tabUrl, sobject, id, apiVersion = DEFAULT_API_VERSION, tooling = false) {
  const type = assertSObjectName(sobject);
  const recordId = assertRecordId(id);
  const prefix = tooling ? "/tooling" : "";
  return restGet(tabUrl, `${prefix}/sobjects/${type}/${recordId}`, apiVersion);
}

async function updateSObject(
  tabUrl,
  sobject,
  id,
  fields,
  apiVersion = DEFAULT_API_VERSION,
  tooling = false
) {
  const type = assertSObjectName(sobject);
  const recordId = assertRecordId(id);
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("Update fields object required.");
  }
  // Security: never allow Id / attributes in PATCH body; only simple field map.
  const body = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) continue;
    if (key === "Id" || key === "attributes") continue;
    body[key] = value;
  }
  if (!Object.keys(body).length) throw new Error("No updatable fields provided.");

  // Custom metadata records: standard sObject PATCH is usually blocked — use Tooling CustomMetadata.
  if (/__mdt$/i.test(type) && !tooling) {
    return updateCustomMetadataRecord(tabUrl, type, recordId, body, apiVersion);
  }

  const { session } = await requireSession(tabUrl);
  await ensureHostFetchAllowed(session.apiBase);
  const prefix = tooling ? "/tooling" : "";
  const url = restUrl(session.apiBase, `${prefix}/sobjects/${type}/${recordId}`, apiVersion);
  await sfFetchUrl(url, session.sid, { method: "PATCH", body });
  return { ok: true, id: recordId, sobject: type, fields: Object.keys(body) };
}

/**
 * Update a Custom Metadata Type record via Tooling API CustomMetadata.
 * FullName format: MyType__mdt.RecordDeveloperName
 */
async function updateCustomMetadataRecord(tabUrl, sobject, id, fields, apiVersion) {
  const current = await getSObject(tabUrl, sobject, id, apiVersion, false);
  const developerName = current?.DeveloperName;
  if (!developerName || !/^[A-Za-z][A-Za-z0-9_]*$/.test(developerName)) {
    throw new Error("Custom metadata record is missing DeveloperName; cannot update via Tooling.");
  }
  const label =
    fields.MasterLabel ??
    fields.Label ??
    current.MasterLabel ??
    current.Label ??
    developerName;

  const skip = new Set([
    "Id",
    "DeveloperName",
    "QualifiedApiName",
    "NamespacePrefix",
    "MasterLabel",
    "Label",
    "Language",
    "SystemModstamp",
    "CreatedDate",
    "CreatedById",
    "LastModifiedDate",
    "LastModifiedById",
    "attributes"
  ]);
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    if (skip.has(key)) continue;
    values.push({
      field: key,
      value: value === null || value === undefined ? null : value
    });
  }

  const { session } = await requireSession(tabUrl);
  await ensureHostFetchAllowed(session.apiBase);
  const fullName = `${sobject}.${developerName}`;
  const url = restUrl(
    session.apiBase,
    `/tooling/sobjects/CustomMetadata/${encodeURIComponent(sobject)}.${encodeURIComponent(developerName)}`,
    apiVersion
  );
  await sfFetchUrl(url, session.sid, {
    method: "PATCH",
    body: {
      Metadata: {
        label: String(label),
        values
      }
    }
  });
  return {
    ok: true,
    id,
    sobject,
    fields: Object.keys(fields),
    via: "tooling-custom-metadata",
    fullName
  };
}

async function deleteSObject(tabUrl, sobject, id, apiVersion = DEFAULT_API_VERSION, tooling = false) {
  const type = assertSObjectName(sobject);
  const recordId = assertRecordId(id);
  const { session } = await requireSession(tabUrl);
  await ensureHostFetchAllowed(session.apiBase);
  const prefix = tooling ? "/tooling" : "";
  const url = restUrl(session.apiBase, `${prefix}/sobjects/${type}/${recordId}`, apiVersion);
  await sfFetchUrl(url, session.sid, { method: "DELETE" });
  return { ok: true, id: recordId, sobject: type };
}

async function listFlows(tabUrl, apiVersion = DEFAULT_API_VERSION) {
  const q =
    "SELECT Id, ApiName, Label, ProcessType, TriggerType, IsActive, LastModifiedDate FROM FlowDefinitionView ORDER BY LastModifiedDate DESC LIMIT 50";
  try {
    return await runSoql(tabUrl, q, apiVersion);
  } catch {
    const tooling =
      "SELECT Id, DeveloperName, MasterLabel, ManageableState, LastModifiedDate FROM FlowDefinition ORDER BY LastModifiedDate DESC LIMIT 50";
    return toolingQuery(tabUrl, tooling, apiVersion);
  }
}

async function getApexCoverage(tabUrl, apiVersion = DEFAULT_API_VERSION) {
  // Aggregate coverage from ApexCodeCoverageAggregate when available
  try {
    const q =
      "SELECT ApexClassOrTriggerId, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate LIMIT 200";
    const data = await toolingQuery(tabUrl, q, apiVersion);
    const records = data.records || [];
    let covered = 0;
    let uncovered = 0;
    for (const r of records) {
      covered += r.NumLinesCovered || 0;
      uncovered += r.NumLinesUncovered || 0;
    }
    const total = covered + uncovered;
    const coveragePercent = total ? Math.round((covered / total) * 1000) / 10 : null;
    return { coveragePercent, classCount: records.length, covered, uncovered };
  } catch (e) {
    return { coveragePercent: null, error: e.message };
  }
}

async function getOrgLimits(tabUrl, apiVersion = DEFAULT_API_VERSION) {
  return restGet(tabUrl, "/limits", apiVersion);
}

function escapeSoqlLike(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

async function listApexClasses(tabUrl, query = "", apiVersion = DEFAULT_API_VERSION) {
  const needle = String(query || "").trim();
  // Security: only allowlist-safe characters in LIKE; escape remaining quotes/wildcards.
  if (needle && !/^[A-Za-z0-9_.\- ]{1,80}$/.test(needle)) {
    throw new Error("Search may only use letters, numbers, spaces, underscore, dot, or hyphen.");
  }
  let q =
    "SELECT Id, Name, NamespacePrefix, ApiVersion, LengthWithoutComments, LastModifiedDate FROM ApexClass ORDER BY Name ASC LIMIT 100";
  if (needle) {
    const like = escapeSoqlLike(needle);
    q = `SELECT Id, Name, NamespacePrefix, ApiVersion, LengthWithoutComments, LastModifiedDate FROM ApexClass WHERE Name LIKE '%${like}%' ORDER BY LastModifiedDate DESC LIMIT 50`;
  }
  const data = await toolingQuery(tabUrl, q, apiVersion);
  return {
    totalSize: data.totalSize ?? (data.records || []).length,
    records: (data.records || []).map((r) => ({
      id: r.Id,
      name: r.Name,
      namespace: r.NamespacePrefix || null,
      apiVersion: r.ApiVersion,
      length: r.LengthWithoutComments,
      lastModifiedDate: r.LastModifiedDate
    }))
  };
}

async function getApexClassBody(tabUrl, id, apiVersion = DEFAULT_API_VERSION) {
  const cleanId = String(id || "").trim();
  if (!/^[a-zA-Z0-9]{15,18}$/.test(cleanId)) throw new Error("Invalid Apex class Id.");
  const q = `SELECT Id, Name, NamespacePrefix, Body, ApiVersion, LengthWithoutComments, LastModifiedDate FROM ApexClass WHERE Id = '${cleanId}' LIMIT 1`;
  const data = await toolingQuery(tabUrl, q, apiVersion);
  const row = data.records?.[0];
  if (!row) throw new Error("Apex class not found.");
  return {
    id: row.Id,
    name: row.Name,
    namespace: row.NamespacePrefix || null,
    body: row.Body || "",
    apiVersion: row.ApiVersion,
    length: row.LengthWithoutComments,
    lastModifiedDate: row.LastModifiedDate
  };
}

async function getRecentDeployFailures(tabUrl, apiVersion = DEFAULT_API_VERSION) {
  try {
    const q =
      "SELECT Id, Status, CreatedDate, ErrorMessage FROM DeployRequest WHERE Status = 'Failed' ORDER BY CreatedDate DESC LIMIT 5";
    const data = await toolingQuery(tabUrl, q, apiVersion);
    return { count: data.records?.length || 0, records: data.records || [] };
  } catch {
    return { count: 0, records: [], error: "DeployRequest not accessible" };
  }
}

async function searchMetadata(tabUrl, query, typeId, apiVersion = DEFAULT_API_VERSION) {
  const q = String(query || "").trim();
  if (q.length < 2) throw new Error("Type at least 2 characters to search.");
  // Security: only allowlisted metadata type handlers; query values are SOQL-escaped in lib.
  const types = typeId
    ? METADATA_SEARCH_TYPES.filter((t) => t.id === typeId)
    : METADATA_SEARCH_TYPES;

  const results = [];
  for (const typeDef of types) {
    try {
      const data = typeDef.tooling
        ? await toolingQuery(tabUrl, typeDef.query(q), apiVersion)
        : await runSoql(tabUrl, typeDef.query(q), apiVersion);
      for (const record of data.records || []) {
        results.push({
          typeId: typeDef.id,
          typeLabel: typeDef.label,
          id: record.Id || record.DurableId || null,
          name: typeDef.displayName ? typeDef.displayName(record) : record.Name || record.DeveloperName || record.ApiName,
          lastModifiedDate: record.LastModifiedDate || null,
          record,
          openPath: typeDef.openPath(record)
        });
      }
    } catch (e) {
      if (typeDef.fallback) {
        try {
          const fb = typeDef.fallback;
          const data = fb.tooling
            ? await toolingQuery(tabUrl, fb.query(q), apiVersion)
            : await runSoql(tabUrl, fb.query(q), apiVersion);
          for (const record of data.records || []) {
            results.push({
              typeId: typeDef.id,
              typeLabel: typeDef.label,
              id: record.Id || null,
              name: fb.displayName ? fb.displayName(record) : record.Name || record.DeveloperName,
              lastModifiedDate: record.LastModifiedDate || null,
              record,
              openPath: fb.openPath(record)
            });
          }
        } catch (e2) {
          results.push({
            typeId: typeDef.id,
            typeLabel: typeDef.label,
            error: e2.message || e.message
          });
        }
      } else {
        results.push({ typeId: typeDef.id, typeLabel: typeDef.label, error: e.message });
      }
    }
  }
  return { query: q, results };
}

async function listPackageTypeMembers(tabUrl, typeName, apiVersion = DEFAULT_API_VERSION) {
  const typeDef = PACKAGE_TYPES.find((t) => t.name === typeName);
  if (!typeDef) throw new Error("Unknown metadata type");

  try {
    const data = typeDef.tooling
      ? await toolingQuery(tabUrl, typeDef.listQuery, apiVersion)
      : await runSoql(tabUrl, typeDef.listQuery, apiVersion);
    return {
      type: typeDef.name,
      label: typeDef.label,
      members: (data.records || []).map((r) => ({
        id: r.Id || null,
        member: typeDef.memberName(r),
        label: typeDef.memberName(r),
        lastModifiedDate: r.LastModifiedDate || null
      }))
    };
  } catch (e) {
    if (!typeDef.fallback) throw e;
    const fb = typeDef.fallback;
    const data = fb.tooling
      ? await toolingQuery(tabUrl, fb.listQuery, apiVersion)
      : await runSoql(tabUrl, fb.listQuery, apiVersion);
    return {
      type: typeDef.name,
      label: typeDef.label,
      members: (data.records || []).map((r) => ({
        id: r.Id || null,
        member: fb.memberName(r),
        label: fb.memberName(r),
        lastModifiedDate: r.LastModifiedDate || null
      }))
    };
  }
}

async function listFlowDefinitions(tabUrl, query = "", apiVersion = DEFAULT_API_VERSION) {
  const needle = String(query || "").trim();
  if (needle && !/^[A-Za-z0-9_ ]{1,80}$/.test(needle)) {
    throw new Error("Search may only use letters, numbers, spaces, or underscores.");
  }
  const q = buildFlowDefinitionSearchQuery(needle);
  try {
    const page = await runSoql(tabUrl, q, apiVersion);
    const records = page.records || [];
    return {
      flows: records.map((r) => ({
        apiName: r.ApiName,
        label: r.Label || r.ApiName,
        processType: r.ProcessType || "",
        triggerType: r.TriggerType || "",
        isActive: !!r.IsActive
      }))
    };
  } catch {
    const tooling =
      "SELECT Id, DeveloperName, MasterLabel, NamespacePrefix, LastModifiedDate FROM FlowDefinition ORDER BY LastModifiedDate DESC LIMIT 40";
    const page = await toolingQuery(tabUrl, tooling, apiVersion);
    const needleLc = needle.toLowerCase();
    const flows = (page.records || [])
      .map((r) => {
        const apiName = memberName(r.NamespacePrefix, r.DeveloperName);
        return {
          apiName,
          label: r.MasterLabel || apiName,
          processType: "",
          triggerType: "",
          isActive: null
        };
      })
      .filter((f) => !needleLc || f.apiName.toLowerCase().includes(needleLc) || f.label.toLowerCase().includes(needleLc));
    return { flows };
  }
}

async function listFlowVersions(tabUrl, apiName, apiVersion = DEFAULT_API_VERSION) {
  const name = assertFlowApiName(apiName);
  const { session } = await getOrgSessionStrict(tabUrl);
  if (!session?.sid) {
    throw new Error("No Salesforce session cookie for that org. Open a logged-in tab for it.");
  }
  await ensureHostFetchAllowed(session.apiBase);
  const page = await queryAllRecords(session, buildFlowVersionsQuery(name), {
    tooling: true,
    apiVersion,
    maxRows: 200
  });
  return {
    apiName: name,
    truncated: !!page.truncated,
    versions: (page.records || []).map((flow) => ({
      ...summarizeFlowVersion(flow),
      definitionName: flow.Definition?.DeveloperName || name
    }))
  };
}

async function getFlowVersionDetail(tabUrl, flowId, apiVersion = DEFAULT_API_VERSION) {
  const id = String(flowId || "").trim();
  if (!/^[a-zA-Z0-9]{15,18}$/.test(id)) throw new Error("Pick a flow version from the list.");
  const { session } = await getOrgSessionStrict(tabUrl);
  if (!session?.sid) {
    throw new Error("No Salesforce session cookie for that org. Open a logged-in tab for it.");
  }
  await ensureHostFetchAllowed(session.apiBase);
  const detailUrl = restUrl(session.apiBase, `/tooling/sobjects/Flow/${id}`, apiVersion);
  const detail = await sfFetchUrl(detailUrl, session.sid);
  if (!detail?.Id) throw new Error("Could not load that flow version.");
  return {
    Id: detail.Id,
    MasterLabel: detail.MasterLabel,
    Status: detail.Status,
    VersionNumber: detail.VersionNumber,
    ProcessType: detail.ProcessType,
    LastModifiedDate: detail.LastModifiedDate,
    FullName: detail.FullName || null,
    Definition: detail.Definition || null,
    Metadata: detail.Metadata || {}
  };
}

async function listInactiveFlowVersions(
  tabUrl,
  needle = "",
  includeMetadata = false,
  apiVersion = DEFAULT_API_VERSION
) {
  // Salesforce Tooling rule: Metadata/FullName cannot be queried for multiple Flow rows.
  // Always list without Metadata, then optionally GET each version when scanning field refs.
  const q = buildInactiveFlowsQuery({ includeMetadata: false, limit: 200 });
  const data = await toolingQuery(tabUrl, q, apiVersion);
  let records = data.records || [];
  const needleText = String(needle || "").trim();

  if (includeMetadata && needleText) {
    const { session } = await requireSession(tabUrl);
    const scanned = [];
    for (const flow of records) {
      try {
        const detailUrl = restUrl(session.apiBase, `/tooling/sobjects/Flow/${flow.Id}`, apiVersion);
        const detail = await sfFetchUrl(detailUrl, session.sid);
        const merged = { ...flow, Metadata: detail?.Metadata, FullName: detail?.FullName };
        if (flowMatchesNeedle(merged, needleText)) scanned.push(merged);
      } catch {
        // If detail fetch fails, still keep label-only match
        if (flowMatchesNeedle(flow, needleText)) scanned.push(flow);
      }
    }
    records = scanned;
  } else if (needleText) {
    records = records.filter((f) => flowMatchesNeedle(f, needleText));
  }

  return {
    total: data.totalSize ?? (data.records || []).length,
    matched: records.length,
    statuses: INACTIVE_FLOW_STATUSES,
    scannedMetadata: Boolean(includeMetadata && needleText),
    versions: records.map(summarizeFlowVersion)
  };
}

async function deleteFlowVersions(tabUrl, ids, apiVersion = DEFAULT_API_VERSION) {
  if (!Array.isArray(ids) || !ids.length) throw new Error("No flow version Ids provided.");
  // Security: only delete Tooling Flow records; validate Id shape; never trust client status alone.
  const cleanIds = [...new Set(ids.map((id) => String(id || "").trim()).filter((id) => /^[a-zA-Z0-9]{15,18}$/.test(id)))];
  if (!cleanIds.length) throw new Error("No valid Salesforce Ids.");
  if (cleanIds.length > 50) throw new Error("Delete at most 50 versions at a time.");

  const { session } = await requireSession(tabUrl);
  const results = [];
  for (const id of cleanIds) {
    try {
      // Verify status before delete — refuse Active
      const detailUrl = restUrl(session.apiBase, `/tooling/sobjects/Flow/${id}`, apiVersion);
      const detail = await sfFetchUrl(detailUrl, session.sid);
      if (detail?.Status === "Active") {
        results.push({ id, ok: false, error: "Refused: Active flow versions cannot be deleted." });
        continue;
      }
      if (detail?.Status && !INACTIVE_FLOW_STATUSES.includes(detail.Status)) {
        results.push({ id, ok: false, error: `Refused: status ${detail.Status} is not deletable via this tool.` });
        continue;
      }
      await sfFetchUrl(detailUrl, session.sid, { method: "DELETE" });
      results.push({
        id,
        ok: true,
        status: detail?.Status,
        label: detail?.MasterLabel || id
      });
    } catch (e) {
      results.push({ id, ok: false, error: e.message || String(e) });
    }
  }
  return {
    deleted: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  };
}

async function executeAnonymous(tabUrl, apex, apiVersion = DEFAULT_API_VERSION) {
  const body = String(apex || "").trim();
  if (!body) throw new Error("Apex body is empty.");
  if (body.length > 12000) {
    throw new Error("Apex body is too long for the Tooling executeAnonymous URL limit (~12k). Shorten it.");
  }
  // Security: execute only via authenticated user session; never log/store the body or sid.
  const { session } = await requireSession(tabUrl);
  const url = restUrl(
    session.apiBase,
    `/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(body)}`,
    apiVersion
  );
  const result = await sfFetchUrl(url, session.sid);
  return {
    ...result,
    executedAt: new Date().toISOString()
  };
}

async function fetchLatestApexDebug(tabUrl, apiVersion = DEFAULT_API_VERSION) {
  const { session } = await requireSession(tabUrl);
  const userId = session.userInfo?.user_id || session.userInfo?.userId;
  let q = "SELECT Id, StartTime, Status, LogLength, LogUserId FROM ApexLog ORDER BY StartTime DESC LIMIT 1";
  if (userId && /^[a-zA-Z0-9]{15,18}$/.test(userId)) {
    q = `SELECT Id, StartTime, Status, LogLength, LogUserId FROM ApexLog WHERE LogUserId = '${userId}' ORDER BY StartTime DESC LIMIT 1`;
  }
  const data = await toolingQuery(tabUrl, q, apiVersion);
  const log = data.records?.[0];
  if (!log?.Id) {
    throw new Error("No Apex debug log found. Set a Trace Flag for your user in Setup, then execute again.");
  }
  const bodyUrl = restUrl(session.apiBase, `/tooling/sobjects/ApexLog/${log.Id}/Body`, apiVersion);
  const bodyText = await sfFetchText(bodyUrl, session.sid);
  return {
    logId: log.Id,
    startTime: log.StartTime,
    status: log.Status,
    logLength: log.LogLength,
    body: bodyText
  };
}

async function ensureHostFetchAllowed(apiBase) {
  if (!apiBase) throw new Error("Missing Salesforce API host.");
  let origin;
  try {
    origin = new URL(apiBase).origin;
  } catch {
    throw new Error(`Invalid Salesforce API host: ${apiBase}`);
  }
  // Host permissions are declared in the manifest; if the user set Site access to
  // "On click", Chrome still blocks fetch with a bare "Failed to fetch".
  try {
    const originPattern = `${origin}/*`;
    const hasExact = await chrome.permissions.contains({ origins: [originPattern] });
    if (!hasExact) {
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) {
        throw new Error(
          `Chrome blocked access to ${origin}. Open chrome://extensions → OrgKit → Details → Site access → “On all sites”, then reload and retry.`
        );
      }
    }
  } catch (e) {
    if (/Chrome blocked access|Invalid Salesforce|Missing Salesforce/.test(e.message || "")) throw e;
    // permissions.request can fail from SW without a user gesture — continue; fetch error handler clarifies.
  }
}

function networkBlockedMessage(url, err) {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep raw */
  }
  return (
    `Failed to reach Salesforce API (${host}). ` +
    `Usually Chrome Site access is restricted: chrome://extensions → OrgKit → Details → Site access → turn ON each Salesforce domain (or “On all sites”). ` +
    `Listing the URLs is not enough if their toggles are gray/off. ` +
    `Then Reload the extension and keep a logged-in Salesforce tab open. ` +
    `Detail: ${err?.message || err}`
  );
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}
