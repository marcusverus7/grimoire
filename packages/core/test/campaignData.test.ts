import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_KV_NAMESPACES,
  campaignKvKeys,
  exportableCampaignNamespaces,
  renderGmToolMarkdown,
} from "../src/campaignData.js";
import { exportCampaign } from "../src/export.js";

describe("campaignKvKeys", () => {
  it("enumerates every campaign- and session-scoped kv key", () => {
    const keys = campaignKvKeys("camp_1", ["sess_a", "sess_b"]);
    // Campaign-scoped namespaces produce one key each.
    expect(keys).toContain("clues_camp_1");
    expect(keys).toContain("clocks_camp_1");
    expect(keys).toContain("bonds_camp_1");
    expect(keys).toContain("loot_history_camp_1");
    // Transient in-play keys are included for deletion.
    expect(keys).toContain("encounter_camp_1");
    expect(keys).toContain("tracker_round_camp_1");
    // Session-scoped keys fan out per session.
    expect(keys).toContain("session_notes_sess_a");
    expect(keys).toContain("session_notes_sess_b");
  });

  it("covers every registered namespace", () => {
    const keys = campaignKvKeys("c", ["s"]);
    for (const ns of CAMPAIGN_KV_NAMESPACES) {
      const expected = ns.scope === "campaign" ? `${ns.prefix}c` : `${ns.prefix}s`;
      expect(keys).toContain(expected);
    }
  });
});

describe("exportableCampaignNamespaces", () => {
  it("excludes transient and elsewhere-handled namespaces", () => {
    const ids = exportableCampaignNamespaces().map((n) => n.id);
    expect(ids).toContain("clues");
    expect(ids).toContain("timelineEvents");
    expect(ids).not.toContain("encounter"); // transient
    expect(ids).not.toContain("trackerRound"); // transient
    expect(ids).not.toContain("sceneNotes"); // exported elsewhere
  });
});

describe("renderGmToolMarkdown", () => {
  it("renders an array of objects with a title field and key/value detail", () => {
    const md = renderGmToolMarkdown("Clues", [
      { id: "1", text: "Bloody dagger", whereFound: "The cellar", connected: false },
    ]);
    expect(md).toContain("## Clues");
    expect(md).toContain("- **Bloody dagger**");
    expect(md).toContain("Where Found: The cellar");
    expect(md).toContain("Connected: no");
    expect(md).not.toContain("id:"); // ids are dropped
  });

  it("returns empty string for empty data", () => {
    expect(renderGmToolMarkdown("Clues", [])).toBe("");
    expect(renderGmToolMarkdown("Clues", null)).toBe("");
  });
});

const campaign = { id: "camp_1", name: "The Ravenport Job", systemTag: "Blades", status: "active" };

describe("exportCampaign gmTools", () => {
  it("includes GM tools in the JSON backup and gm-tools.md", () => {
    const result = exportCampaign({
      campaign,
      entities: [],
      sessions: [],
      gmTools: [
        { id: "clues", value: [{ id: "1", text: "Bloody dagger", connected: false }] },
        { id: "clocks", value: [{ id: "c1", name: "The Duke's Wrath", filled: 2, segments: 6 }] },
      ],
    });

    const gmFile = result.files.find((f) => f.path === "gm-tools.md");
    expect(gmFile).toBeDefined();
    expect(gmFile!.content).toContain("## Clues");
    expect(gmFile!.content).toContain("Bloody dagger");
    expect(gmFile!.content).toContain("## Campaign Clocks");
    expect(gmFile!.content).toContain("The Duke's Wrath");

    const index = result.files.find((f) => f.path === "index.md");
    expect(index!.content).toContain("[[gm-tools]]");

    const json = JSON.parse(result.json);
    expect(json.version).toBe(2);
    expect(json.gmTools.clues).toHaveLength(1);
    expect(json.gmTools.clocks[0].name).toBe("The Duke's Wrath");
  });

  it("omits gm-tools.md when there is no GM-tool data", () => {
    const result = exportCampaign({ campaign, entities: [], sessions: [] });
    expect(result.files.find((f) => f.path === "gm-tools.md")).toBeUndefined();
    expect(result.files.find((f) => f.path === "index.md")!.content).not.toContain("[[gm-tools]]");
  });

  it("skips transient and empty namespaces", () => {
    const result = exportCampaign({
      campaign,
      entities: [],
      sessions: [],
      gmTools: [
        { id: "encounter", value: [{ id: "e", name: "ignored" }] }, // transient — not exportable
        { id: "clues", value: [] }, // empty — skipped
      ],
    });
    expect(result.files.find((f) => f.path === "gm-tools.md")).toBeUndefined();
    const json = JSON.parse(result.json);
    expect(json.gmTools).toEqual({});
  });
});
