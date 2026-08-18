import test from "node:test";
import assert from "node:assert/strict";
import {
  objectKind,
  filterSchemaObjects,
  extractParentRelations,
  extractChildRelations,
  pickDisplayFields,
  buildObjectQuery,
  buildParentPathQuery,
  buildChildSubquery,
  scoreSchemaObject,
  schemaSummary,
  formatFieldType,
  pickCardFields,
  layoutSchemaGraph,
  buildGraphEdges,
  assignEdgeSpread,
  routeRelationshipPath,
  edgeLabelText,
  schemaStory,
  friendlyAccessLine,
  sessionObjectAccess,
  fieldSchemaBadges,
  summarizeSessionPermissions,
  crudStripHtml,
  buildUserPermOverlay
} from "./schema-explorer.js";

test("objectKind classifies standard, custom, and metadata", () => {
  assert.equal(objectKind("Account"), "Standard");
  assert.equal(objectKind("My_Obj__c", true), "Custom");
  assert.equal(objectKind("Config__mdt"), "Custom Metadata");
  assert.equal(objectKind("Order_Event__e"), "Platform Event");
});

test("filterSchemaObjects supports all / custom / mdt", () => {
  const objs = [
    { name: "Account", label: "Account", custom: false, queryable: true },
    { name: "Job__c", label: "Job", custom: true, queryable: true },
    { name: "Setting__mdt", label: "Setting", custom: true, queryable: true },
    { name: "Hidden__c", label: "Hidden", custom: true, queryable: false }
  ];
  assert.equal(filterSchemaObjects(objs, "all").length, 4);
  assert.deepEqual(
    filterSchemaObjects(objs, "custom").map((o) => o.name),
    ["Job__c", "Hidden__c"]
  );
  assert.deepEqual(
    filterSchemaObjects(objs, "mdt").map((o) => o.name),
    ["Setting__mdt"]
  );
  assert.deepEqual(
    filterSchemaObjects(objs, "standard").map((o) => o.name),
    ["Account"]
  );
});

test("extractParentRelations dedupes polymorphic lookups", () => {
  const describe = {
    name: "Task",
    fields: [
      {
        name: "WhoId",
        label: "Name",
        type: "reference",
        relationshipName: "Who",
        referenceTo: ["Contact", "Lead"]
      },
      {
        name: "WhatId",
        label: "Related To",
        type: "reference",
        relationshipName: "What",
        referenceTo: ["Account", "Opportunity"]
      }
    ]
  };
  const parents = extractParentRelations(describe);
  assert.equal(parents.length, 4);
  assert.ok(parents.some((p) => p.targetObject === "Contact" && p.fieldName === "WhoId"));
  assert.ok(parents.some((p) => p.targetObject === "Account" && p.relationshipName === "What"));
});

test("extractChildRelations skips deprecated and sorts", () => {
  const describe = {
    name: "Account",
    childRelationships: [
      { childSObject: "Contact", field: "AccountId", relationshipName: "Contacts" },
      { childSObject: "Case", field: "AccountId", relationshipName: "Cases" },
      {
        childSObject: "Old__c",
        field: "Account__c",
        relationshipName: "Olds__r",
        deprecatedAndHidden: true
      },
      { childSObject: "Note", field: "ParentId", relationshipName: null }
    ]
  };
  const children = extractChildRelations(describe);
  assert.equal(children.length, 3);
  assert.equal(children[0].childObject, "Case");
  assert.equal(children.find((c) => c.childObject === "Note")?.relationshipName, null);
});

test("queries prefer Name / DeveloperName and build relationship SOQL", () => {
  const contact = {
    name: "Contact",
    custom: false,
    fields: [
      { name: "Id", type: "id" },
      { name: "Name", type: "string" },
      {
        name: "AccountId",
        label: "Account",
        type: "reference",
        relationshipName: "Account",
        referenceTo: ["Account"]
      }
    ],
    childRelationships: [
      { childSObject: "Case", field: "ContactId", relationshipName: "Cases" }
    ]
  };
  assert.equal(pickDisplayFields(contact).includes("Name"), true);
  assert.match(buildObjectQuery(contact), /^SELECT Id, Name FROM Contact LIMIT 50$/);
  const parent = extractParentRelations(contact)[0];
  assert.match(buildParentPathQuery(contact, parent), /Account\.Name/);
  const child = extractChildRelations(contact)[0];
  assert.match(buildChildSubquery(contact, child), /\(SELECT Id FROM Cases LIMIT 10\)/);
  assert.match(schemaSummary(contact), /Contact · Standard/);
});

test("CMDT display fields use DeveloperName / MasterLabel", () => {
  const mdt = {
    name: "Region_Setting__mdt",
    custom: true,
    fields: [
      { name: "Id", type: "id" },
      { name: "DeveloperName", type: "string" },
      { name: "MasterLabel", type: "string" },
      {
        name: "Owner_User__c",
        label: "Owner User",
        type: "reference",
        relationshipName: "Owner_User__r",
        referenceTo: ["User"]
      }
    ],
    childRelationships: []
  };
  assert.equal(objectKind(mdt.name, true), "Custom Metadata");
  assert.deepEqual(pickDisplayFields(mdt).slice(0, 3), ["Id", "DeveloperName", "MasterLabel"]);
  assert.match(buildObjectQuery(mdt), /DeveloperName/);
});

test("formatFieldType and card field picking", () => {
  assert.equal(
    formatFieldType({ type: "reference", referenceTo: ["Account"] }),
    "Lookup(Account)"
  );
  assert.equal(formatFieldType({ type: "string", length: 255 }), "Text(255)");
  assert.equal(formatFieldType({ type: "boolean" }), "Checkbox");
  const desc = {
    name: "Account",
    fields: [
      { name: "BillingCity", type: "string", length: 40 },
      { name: "OwnerId", type: "reference", referenceTo: ["User"], nillable: false, createable: true },
      { name: "Name", type: "string", length: 255 },
      { name: "Id", type: "id" }
    ]
  };
  const picked = pickCardFields(desc, { max: 3 }).map((f) => f.name);
  assert.deepEqual(picked, ["Id", "Name", "OwnerId"]);
});

test("layoutSchemaGraph places parents above and children below", () => {
  const pos = layoutSchemaGraph({
    centerName: "Account",
    parentNames: ["User"],
    childNames: ["Contact", "Case"],
    cardWidth: 200,
    gapX: 20,
    gapY: 40,
    centerY: 200
  });
  assert.ok(pos.get("User").y < pos.get("Account").y);
  assert.ok(pos.get("Contact").y > pos.get("Account").y);
  assert.equal(pos.get("Account").role, "center");
});

test("layoutSchemaGraph wraps extra children onto a second row", () => {
  const pos = layoutSchemaGraph({
    centerName: "Account",
    parentNames: [],
    childNames: ["Contact", "Case", "Opportunity", "Task", "Note"],
    cardWidth: 200,
    gapX: 20,
    gapY: 40,
    rowSize: 4,
    cardHeight: 100
  });
  assert.equal(pos.get("Contact").y, pos.get("Case").y);
  assert.ok(pos.get("Note").y > pos.get("Contact").y);
  assert.equal(pos.get("Note").role, "child");
});

test("buildGraphEdges links lookups both ways", () => {
  const edges = buildGraphEdges({
    centerName: "Account",
    parents: [{ fieldName: "OwnerId", targetObject: "User", type: "reference", relationshipName: "Owner" }],
    children: [{ childObject: "Contact", fieldName: "AccountId", cascadeDelete: false, relationshipName: "Contacts" }]
  });
  assert.equal(edges.length, 2);
  assert.equal(edges[0].fromObject, "Account");
  assert.equal(edges[0].label, "Owner → User");
  assert.equal(edges[1].toObject, "Account");
  assert.equal(edges[0].plainLabel, "belongs to User");
  assert.match(edges[1].sentence, /Contact/);
});

test("schemaStory and friendly access use plain language", () => {
  assert.match(
    schemaStory({
      centerLabel: "Account",
      parentLabels: ["User"],
      childLabels: ["Contact", "Opportunity"]
    }),
    /You're looking at Account/
  );
  assert.equal(friendlyAccessLine({ read: true, create: true, edit: true, del: false }), "You can view, create and edit these records.");
  assert.equal(edgeLabelText({ plainLabel: "belongs to User", techLabel: "Owner → User" }, { simple: true }), "belongs to User");
});

test("assignEdgeSpread and routeRelationshipPath fan stacked links", () => {
  const spread = assignEdgeSpread([
    { id: "a", fromObject: "Job__c", toObject: "Account", fromField: "A__c" },
    { id: "b", fromObject: "Job__c", toObject: "Account", fromField: "B__c" }
  ]);
  assert.equal(spread[0].spreadIndex, 0);
  assert.equal(spread[1].spreadIndex, 1);
  assert.equal(spread[1].spreadCount, 2);
  const a = routeRelationshipPath({
    fromBox: { x: 0, y: 40, w: 100, h: 20 },
    toBox: { x: 200, y: 0, w: 100, h: 80 },
    index: 0,
    count: 2
  });
  const b = routeRelationshipPath({
    fromBox: { x: 0, y: 60, w: 100, h: 20 },
    toBox: { x: 200, y: 0, w: 100, h: 80 },
    index: 1,
    count: 2
  });
  assert.notEqual(a.x2, b.x2);
  assert.match(a.d, /^M /);
  assert.equal(edgeLabelText({ label: "Owner → User" }), "Owner → User");
});

test("session CRUD and field badges from describe", () => {
  const describe = {
    name: "Account",
    createable: true,
    updateable: true,
    deletable: false,
    queryable: true,
    fields: [
      { name: "Id", type: "id", updateable: false },
      { name: "Name", type: "string", nillable: false, createable: true, updateable: true },
      { name: "Secret__c", type: "string", custom: true, accessible: false, updateable: false },
      {
        name: "OwnerId",
        type: "reference",
        referenceTo: ["User"],
        updateable: true,
        nillable: false,
        createable: true
      }
    ]
  };
  const access = sessionObjectAccess(describe);
  assert.equal(access.create, true);
  assert.equal(access.del, false);
  assert.equal(access.read, true);
  const nameBadges = fieldSchemaBadges(describe.fields[1]);
  assert.equal(nameBadges.readable, true);
  assert.equal(nameBadges.editable, true);
  assert.ok(nameBadges.flags.some((f) => f.key === "Req"));
  const secret = fieldSchemaBadges(describe.fields[2]);
  assert.equal(secret.readable, false);
  const summary = summarizeSessionPermissions(describe);
  assert.equal(summary.fieldCounts.readable, 3);
  assert.equal(summary.fieldCounts.custom, 1);
  assert.match(crudStripHtml(access), /is-on/);
});

test("buildUserPermOverlay maps object and field permissions", () => {
  const overlay = buildUserPermOverlay({
    user: { Id: "005xx", Username: "ada@example.com", Name: "Ada" },
    objectApiName: "Account",
    objectPerms: [
      {
        PermissionsCreate: false,
        PermissionsRead: true,
        PermissionsEdit: true,
        PermissionsDelete: false,
        PermissionsViewAllRecords: false,
        PermissionsModifyAllRecords: false
      }
    ],
    fieldPerms: [
      { Field: "Account.Name", PermissionsRead: true, PermissionsEdit: true },
      { Field: "Account.Secret__c", PermissionsRead: false, PermissionsEdit: false }
    ]
  });
  assert.equal(overlay.mode, "user");
  assert.equal(overlay.objectAccess.read, true);
  assert.equal(overlay.objectAccess.create, false);
  assert.equal(overlay.fieldMap.Name.read, true);
  assert.equal(overlay.fieldMap.Secret__c.read, false);

  const name = fieldSchemaBadges(
    { name: "Name", type: "string", updateable: true, custom: false },
    overlay
  );
  assert.equal(name.readable, true);
  assert.equal(name.editable, true);

  const secret = fieldSchemaBadges(
    { name: "Secret__c", type: "string", custom: true, updateable: true },
    overlay
  );
  assert.equal(secret.readable, false);
  assert.equal(secret.editable, false);

  const industry = fieldSchemaBadges(
    { name: "Industry", type: "picklist", updateable: true, custom: false },
    overlay
  );
  assert.equal(industry.readable, true);
  assert.equal(industry.editable, true);

  const summary = summarizeSessionPermissions(
    {
      name: "Account",
      createable: true,
      updateable: true,
      deletable: true,
      queryable: true,
      fields: [
        { name: "Name", type: "string", updateable: true },
        { name: "Secret__c", type: "string", custom: true, updateable: true },
        { name: "Industry", type: "picklist", updateable: true }
      ]
    },
    overlay
  );
  assert.equal(summary.access.create, false);
  assert.equal(summary.fieldCounts.readable, 2);
  assert.equal(summary.fieldCounts.editable, 2);
});
