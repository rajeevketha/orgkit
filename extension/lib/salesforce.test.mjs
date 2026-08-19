import assert from "node:assert/strict";
import {
  toSalesforceApiHost,
  apiBaseCandidatesForCookieHost,
  orgAffinityKey,
  sameOrgAffinity,
  classifySalesforceEnv,
  parseOrgFromUrl,
  toSalesforceLightningHost
} from "./salesforce.js";

// Enhanced-domain sandbox Lightning → my.salesforce API host
assert.equal(
  toSalesforceApiHost("acme--uat.sandbox.lightning.force.com"),
  "acme--uat.sandbox.my.salesforce.com"
);

// Legacy pod sandbox Lightning → salesforce.com (NOT my.salesforce.com)
assert.equal(toSalesforceApiHost("cs72.lightning.force.com"), "cs72.salesforce.com");

// Developer enhanced domain
assert.equal(
  toSalesforceApiHost("acme.develop.lightning.force.com"),
  "acme.develop.my.salesforce.com"
);

// Lightning cookie must try Lightning apiBase first (sandbox fix)
assert.deepEqual(
  apiBaseCandidatesForCookieHost("acme--uat.sandbox.lightning.force.com"),
  [
    "https://acme--uat.sandbox.lightning.force.com",
    "https://acme--uat.sandbox.my.salesforce.com"
  ]
);

// API cookie stays on API host
assert.deepEqual(apiBaseCandidatesForCookieHost("acme--uat.sandbox.my.salesforce.com"), [
  "https://acme--uat.sandbox.my.salesforce.com"
]);

assert.deepEqual(apiBaseCandidatesForCookieHost("cs72.salesforce.com"), [
  "https://cs72.salesforce.com"
]);

assert.equal(
  orgAffinityKey("acme--uat.sandbox.lightning.force.com"),
  orgAffinityKey("acme--uat.sandbox.my.salesforce.com")
);
assert.equal(sameOrgAffinity("acme--uat.sandbox.lightning.force.com", "acme--uat.sandbox.my.salesforce.com"), true);
assert.equal(sameOrgAffinity("acme--uat.sandbox.lightning.force.com", "acme.my.salesforce.com"), false);

assert.equal(classifySalesforceEnv("acme--uat.sandbox.lightning.force.com").envLabel, "Sandbox");
assert.equal(classifySalesforceEnv("acme.develop.lightning.force.com").envLabel, "Developer");
assert.equal(classifySalesforceEnv("acme.my.salesforce.com").envLabel, "Production");
assert.equal(classifySalesforceEnv("cs72.lightning.force.com").envLabel, "Sandbox");
// VF --c must not be classified as sandbox
assert.equal(classifySalesforceEnv("ns--c.vf.force.com").envLabel, "Production");

const sand = parseOrgFromUrl("https://acme--uat.sandbox.lightning.force.com/lightning/o/Account/list");
assert.equal(sand.isSandbox, true);
assert.equal(sand.apiBase, "https://acme--uat.sandbox.my.salesforce.com");
assert.equal(sand.envLabel, "Sandbox");

const dev = parseOrgFromUrl("https://acme.develop.lightning.force.com/lightning/setup/SetupOneHome/home");
assert.equal(dev.isDevEd, true);
assert.equal(dev.isSandbox, false);
assert.equal(dev.envLabel, "Developer");

assert.equal(
  toSalesforceLightningHost("acme--uat.sandbox.my.salesforce.com"),
  "acme--uat.sandbox.lightning.force.com"
);
assert.equal(toSalesforceLightningHost("cs72.salesforce.com"), "cs72.lightning.force.com");

console.log("salesforce.test.mjs: all assertions passed");
