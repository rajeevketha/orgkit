import test from "node:test";
import assert from "node:assert/strict";
import {
  splitFlowApiName,
  assertFlowApiName,
  buildFlowVersionsQuery,
  buildFlowDefinitionSearchQuery,
  formatFlowVersionChoice,
  defaultVersionPair,
  collectFlowElements,
  summarizeFlowVersionRecord,
  diffFlowVersions,
  stripFlowLayout
} from "./flow-version-compare.js";

test("splitFlowApiName separates packaged names", () => {
  assert.deepEqual(splitFlowApiName("Order_Flow"), {
    namespace: "",
    developerName: "Order_Flow",
    apiName: "Order_Flow"
  });
  assert.equal(splitFlowApiName("np__Screen_Help").namespace, "np");
  assert.equal(splitFlowApiName("np__Screen_Help").developerName, "Screen_Help");
});

test("buildFlowVersionsQuery is definition-scoped and has no Metadata", () => {
  const q = buildFlowVersionsQuery("Order_Flow");
  assert.match(q, /FROM Flow/);
  assert.match(q, /Definition\.DeveloperName IN/);
  assert.match(q, /'Order_Flow'/);
  assert.doesNotMatch(q, /Metadata/);
  assert.throws(() => assertFlowApiName("bad name"), /letters/);
});

test("buildFlowDefinitionSearchQuery escapes LIKE wildcards", () => {
  const q = buildFlowDefinitionSearchQuery("Order%");
  assert.match(q, /FlowDefinitionView/);
  assert.match(q, /Order\\%/);
});

test("defaultVersionPair prefers previous vs Active", () => {
  const pair = defaultVersionPair([
    { id: "a", versionNumber: 8, status: "Active", isActive: true },
    { id: "b", versionNumber: 5, status: "Obsolete", isActive: false }
  ]);
  assert.equal(pair.leftId, "b");
  assert.equal(pair.rightId, "a");
});

test("formatFlowVersionChoice is readable", () => {
  assert.equal(
    formatFlowVersionChoice({ versionNumber: 4, status: "Draft", label: "Order" }),
    "v4 · Draft · Order"
  );
});

test("collectFlowElements ignores canvas layout noise", () => {
  const els = collectFlowElements({
    start: { object: "Account", recordTriggerType: "Create", locationX: 1, locationY: 2 },
    recordLookups: [{ name: "Get_Account", label: "Get Account", object: "Account", locationX: 40 }],
    decisions: { name: "Check_Type", label: "Check", rules: [{ name: "Is_Partner" }] }
  });
  assert.equal(els.some((e) => e.type === "start"), true);
  assert.equal(els.find((e) => e.name === "Get_Account").hint, "Account");
  assert.match(els.find((e) => e.name === "Check_Type").hint, /Is_Partner/);
  const stripped = stripFlowLayout({ name: "x", locationX: 9, connector: { targetReference: "y" } });
  assert.equal(stripped.locationX, undefined);
  assert.equal(stripped.connector, undefined);
  assert.equal(stripped.name, "x");
});

test("diffFlowVersions reports added, removed, and changed elements", () => {
  const left = summarizeFlowVersionRecord({
    Id: "301aaa000000001AAA",
    MasterLabel: "Order",
    Status: "Obsolete",
    VersionNumber: 3,
    ProcessType: "AutoLaunchedFlow",
    Definition: { DeveloperName: "Order_Flow" },
    Metadata: {
      start: { object: "Account", recordTriggerType: "Create" },
      recordLookups: [{ name: "Get_Account", object: "Account" }],
      assignments: [{ name: "Set_Flag", label: "Old" }]
    }
  });
  const right = summarizeFlowVersionRecord({
    Id: "301bbb000000001AAA",
    MasterLabel: "Order",
    Status: "Active",
    VersionNumber: 8,
    ProcessType: "AutoLaunchedFlow",
    Definition: { DeveloperName: "Order_Flow" },
    Metadata: {
      start: { object: "Account", recordTriggerType: "CreateAndUpdate" },
      recordLookups: [{ name: "Get_Account", object: "Account" }],
      screens: [{ name: "Ask_User", fields: [{ name: "Reason" }] }]
    }
  });
  const diff = diffFlowVersions(left, right);
  assert.ok(diff.header.some((r) => r.key === "versionNumber" && r.left === "3" && r.right === "8"));
  assert.ok(diff.header.some((r) => r.key === "status"));
  assert.equal(diff.onlyA.some((e) => e.name === "Set_Flag"), true);
  assert.equal(diff.onlyB.some((e) => e.name === "Ask_User"), true);
  assert.equal(diff.changed.some((e) => e.name === "start"), true);
  assert.equal(diff.same >= 1, true);
});
