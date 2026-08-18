import test from "node:test";
import assert from "node:assert/strict";
import {
  compareNamedItems,
  compareBundles,
  compareAttrLabel,
  FLOW_COMPARE_ATTR_KEYS
} from "./org-compare.js";
import { applyActiveVersionsToFlowItems, indexActiveFlowVersions } from "./flow-cleaner.js";

test("compareAttrLabel uses plain-language names for flow version diffs", () => {
  assert.equal(compareAttrLabel("activeVersion"), "Active version");
  assert.equal(compareAttrLabel("isActive"), "Active");
});

test("compareNamedItems treats different live flow versions as a diff", () => {
  const leftItems = applyActiveVersionsToFlowItems(
    { Order_Flow: { name: "Order_Flow", label: "Order", attrs: { isActive: "yes", processType: "Flow" } } },
    indexActiveFlowVersions([
      { VersionNumber: 5, Status: "Active", MasterLabel: "Order", Definition: { DeveloperName: "Order_Flow" } }
    ])
  );
  const rightItems = applyActiveVersionsToFlowItems(
    { Order_Flow: { name: "Order_Flow", label: "Order", attrs: { isActive: "yes", processType: "Flow" } } },
    indexActiveFlowVersions([
      { VersionNumber: 9, Status: "Active", MasterLabel: "Order", Definition: { DeveloperName: "Order_Flow" } }
    ])
  );
  const diff = compareNamedItems(leftItems, rightItems, {
    category: "flows",
    categoryLabel: "Flows",
    metadataType: "Flow",
    attrKeys: FLOW_COMPARE_ATTR_KEYS
  });
  assert.equal(diff.differ.length, 1);
  assert.equal(diff.same, 0);
  const versionRow = diff.differ[0].attrDiffs.find((r) => r.key === "activeVersion");
  assert.equal(versionRow.left, "v5");
  assert.equal(versionRow.right, "v9");
  assert.equal(versionRow.label, "Active version");
});

test("compareBundles reports a flow only active in one org", () => {
  const left = {
    categories: {
      flows: {
        id: "flows",
        attrKeys: FLOW_COMPARE_ATTR_KEYS,
        items: applyActiveVersionsToFlowItems(
          { Screen_Help: { name: "Screen_Help", label: "Help", attrs: { isActive: "yes" } } },
          { Screen_Help: { versionNumber: 2, label: "Help" } }
        )
      }
    }
  };
  const right = {
    categories: {
      flows: {
        id: "flows",
        attrKeys: FLOW_COMPARE_ATTR_KEYS,
        items: {}
      }
    }
  };
  const out = compareBundles(left, right, { categories: ["flows"] });
  assert.equal(out.onlyA.length, 1);
  assert.equal(out.onlyA[0].object, "Screen_Help");
  assert.equal(out.onlyB.length, 0);
  assert.equal(out.differ.length, 0);
});
