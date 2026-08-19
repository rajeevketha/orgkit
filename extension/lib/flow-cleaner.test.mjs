import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActiveFlowsQuery,
  flowDefinitionApiName,
  indexActiveFlowVersions,
  applyActiveVersionsToFlowItems,
  summarizeFlowVersion
} from "./flow-cleaner.js";

test("buildActiveFlowsQuery asks Tooling Flow for Status = Active", () => {
  const q = buildActiveFlowsQuery();
  assert.match(q, /FROM Flow/);
  assert.match(q, /Status = 'Active'/);
  assert.match(q, /VersionNumber/);
  assert.match(q, /Definition\.DeveloperName/);
  assert.doesNotMatch(q, /Metadata/);
  const noNs = buildActiveFlowsQuery({ includeNamespace: false });
  assert.doesNotMatch(noNs, /NamespacePrefix/);
});

test("flowDefinitionApiName prefixes namespace once", () => {
  assert.equal(
    flowDefinitionApiName({
      NamespacePrefix: "np",
      Definition: { DeveloperName: "Screen_Flow" }
    }),
    "np__Screen_Flow"
  );
  assert.equal(
    flowDefinitionApiName({
      NamespacePrefix: "np",
      Definition: { DeveloperName: "np__Screen_Flow" }
    }),
    "np__Screen_Flow"
  );
});

test("indexActiveFlowVersions keeps the highest Active version per flow", () => {
  const indexed = indexActiveFlowVersions([
    {
      Id: "301aaa",
      MasterLabel: "Order",
      Status: "Active",
      VersionNumber: 3,
      Definition: { DeveloperName: "Order_Flow", MasterLabel: "Order" }
    },
    {
      Id: "301bbb",
      MasterLabel: "Order",
      Status: "Active",
      VersionNumber: 8,
      Definition: { DeveloperName: "Order_Flow", MasterLabel: "Order" }
    },
    {
      Id: "301ccc",
      MasterLabel: "Case",
      Status: "Active",
      VersionNumber: 1,
      Definition: { DeveloperName: "Case_Flow", MasterLabel: "Case" }
    }
  ]);
  assert.equal(indexed.Order_Flow.versionNumber, 8);
  assert.equal(indexed.Order_Flow.id, "301bbb");
  assert.equal(indexed.Case_Flow.versionNumber, 1);
  assert.equal(summarizeFlowVersion({ Status: "Active", VersionNumber: 2 }).isActive, true);
});

test("applyActiveVersionsToFlowItems marks missing live versions as none", () => {
  const merged = applyActiveVersionsToFlowItems(
    {
      Order_Flow: {
        name: "Order_Flow",
        label: "Order",
        attrs: { isActive: "yes", processType: "AutoLaunchedFlow", triggerType: "RecordAfterSave" }
      },
      Draft_Only: {
        name: "Draft_Only",
        label: "Draft",
        attrs: { isActive: "no", processType: "Flow", triggerType: "" }
      }
    },
    {
      Order_Flow: { versionNumber: 12, processType: "AutoLaunchedFlow", label: "Order" }
    }
  );
  assert.equal(merged.Order_Flow.attrs.activeVersion, "v12");
  assert.equal(merged.Order_Flow.attrs.isActive, "yes");
  assert.equal(merged.Draft_Only.attrs.activeVersion, "none");
});
