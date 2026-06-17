import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { schema, computeLinkChanges } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

function doc(...paragraphs: RichTextNode[]): RichTextNode {
  return { type: "doc", content: paragraphs };
}

function p(...content: RichTextNode[]): RichTextNode {
  return { type: "paragraph", content };
}

function t(text: string): RichTextNode {
  return { type: "text", text };
}

function mention(id: string, label: string): RichTextNode {
  return { type: "mention", attrs: { id, label } };
}

function heading(level: 1 | 2 | 3, text: string): RichTextNode {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function blockquote(text: string): RichTextNode {
  return { type: "blockquote", content: [p(t(text))] };
}

function insertLinks(
  campaignId: string,
  fromType: "entity" | "session",
  fromId: string,
  body: RichTextNode,
) {
  const changes = computeLinkChanges({ campaignId, fromType, fromId, body, existing: [] });
  for (const row of changes.inserts) {
    db.insert(schema.entityLinks).values({ id: newId(), ...row }).run();
  }
}

export function seedSampleCampaign(): string {
  const now = Date.now();
  const nowDate = new Date(now);

  // ── IDs upfront so we can use them in @-mentions ──────────────────────
  const campaignId = newId();
  const miraId = newId();
  const valdrisId = newId();
  const kiraId = newId();
  const saltwaterInnId = newId();
  const sunkenPalaceId = newId();
  const tidewardenId = newId();
  const questId = newId();
  const scepterId = newId();
  const session1Id = newId();
  const session2Id = newId();

  // ── Campaign ──────────────────────────────────────────────────────────
  db.insert(schema.campaigns)
    .values({
      id: campaignId,
      name: "The Sunken Throne",
      systemTag: "D&D 5e",
      status: "active",
      settings: {
        notes: "Sea-port city built over ruins of an ancient empire. Players are hired investigators who stumble onto a much bigger conspiracy.",
        nextSession: "Saturday evening",
      } as Record<string, unknown>,
      createdAt: nowDate,
    })
    .run();

  // ── GM profile (reuse existing local_gm) ─────────────────────────────
  const existing = db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.username, "local_gm"))
    .get();
  let gmId: string;
  if (existing) {
    gmId = existing.id;
  } else {
    gmId = newId();
    db.insert(schema.profiles)
      .values({ id: gmId, username: "local_gm", displayName: "Game Master", createdAt: nowDate })
      .run();
  }

  db.insert(schema.memberships)
    .values({ id: newId(), campaignId, userId: gmId, role: "gm", joinedAt: nowDate })
    .run();

  // ── Entities ──────────────────────────────────────────────────────────

  // NPC: Mira Saltwell
  const miraBody = doc(
    p(
      t("Mira has run the "),
      mention(saltwaterInnId, "Saltwater Inn"),
      t(" for two decades. She keeps every sailor's secret and charges accordingly."),
    ),
    p(t("She has a soft spot for the party — they remind her of her old crew.")),
    blockquote("The sea gives freely. It just doesn't tell you what it wants back."),
  );
  db.insert(schema.entities)
    .values({
      id: miraId,
      campaignId,
      name: "Mira Saltwell",
      kind: "npc",
      summary: "Innkeeper of the Saltwater Inn; knows everyone's secrets",
      body: miraBody,
      attrs: { hp: "22", ac: "10" },
      visibility: "table",
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .run();
  insertLinks(campaignId, "entity", miraId, miraBody);

  // NPC: Lord Valdris Crane (antagonist, GM-only)
  const valdrisBody = doc(
    p(
      t("Lord Valdris controls the "),
      mention(tidewardenId, "Tidewarden Guild"),
      t(" through a web of favours and fear. Publicly a philanthropist; privately a collector of imperial relics."),
    ),
    p(
      t("He is searching for the "),
      mention(scepterId, "Moonstone Scepter"),
      t(" — the same artefact the party has been hired to retrieve."),
    ),
  );
  db.insert(schema.entities)
    .values({
      id: valdrisId,
      campaignId,
      name: "Lord Valdris Crane",
      kind: "npc",
      summary: "Guildmaster of the Tidewardens; the campaign's primary antagonist",
      body: valdrisBody,
      attrs: {
        hp: "45",
        ac: "13",
        gmSecret:
          "Valdris is a descendant of the last emperor. He believes the Scepter will activate a sunken control room that lets him command the city's ancient defences.",
      },
      visibility: "gm_only",
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .run();
  insertLinks(campaignId, "entity", valdrisId, valdrisBody);

  // PC: Kira Ashwood
  db.insert(schema.entities)
    .values({
      id: kiraId,
      campaignId,
      name: "Kira Ashwood",
      kind: "pc",
      summary: "Rogue, former Tidewarden courier who went freelance",
      body: doc(
        p(
          t("Kira spent three years running packages for the Tidewardens before she learned what was really inside them. She burned her contract and hasn't looked back."),
        ),
        p(t("She has an encyclopaedic knowledge of the city's rooftops and sewer system.")),
      ),
      attrs: { hp: "28", ac: "15", initiative: "+4" },
      visibility: "table",
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .run();

  // Location: Saltwater Inn
  db.insert(schema.entities)
    .values({
      id: saltwaterInnId,
      campaignId,
      name: "Saltwater Inn",
      kind: "location",
      summary: "The party's base of operations; ground floor bar, rooms upstairs",
      body: doc(
        heading(2, "The Common Room"),
        p(
          t("Low ceilings, long tables, and a fire that always smells faintly of kelp. Sailors argue, merchants whisper, and Mira moves between them all."),
        ),
        heading(2, "The Back Room"),
        p(t("Available for a coin. This is where jobs are offered, alliances made, and secrets exchanged.")),
      ),
      visibility: "table",
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .run();

  // Location: The Sunken Palace
  const palaceBody = doc(
    p(
      t("Forty fathoms below the harbour, the imperial palace stands intact beneath a permanent magical air-lock — a gift from a sea-mage centuries ago."),
    ),
    p(
      t("The "),
      mention(tidewardenId, "Tidewarden Guild"),
      t(" controls the only known diving route. Passage costs dearly."),
    ),
    blockquote("They say the throne room lights are still on. Nobody who found out came back to explain why."),
  );
  db.insert(schema.entities)
    .values({
      id: sunkenPalaceId,
      campaignId,
      name: "The Sunken Palace",
      kind: "location",
      summary: "Submerged imperial palace; the final dungeon",
      body: palaceBody,
      visibility: "table",
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .run();
  insertLinks(campaignId, "entity", sunkenPalaceId, palaceBody);

  // Faction: The Tidewarden Guild
  db.insert(schema.entities)
    .values({
      id: tidewardenId,
      campaignId,
      name: "Tidewarden Guild",
      kind: "faction",
      summary: "Controls trade, salvage rights, and most of the harbour's secrets",
      body: doc(
        p(
          t("Founded ostensibly to protect merchants from piracy, the Tidewardens have quietly become the most powerful organisation in the city."),
        ),
        p(t("Their blue-and-silver livery is everywhere. Their motives rarely are.")),
      ),
      visibility: "table",
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .run();

  // Quest: Retrieve the Moonstone Scepter
  const questBody = doc(
    p(
      t("An anonymous client paid the party 200gp upfront to retrieve the scepter from the "),
      mention(sunkenPalaceId, "Sunken Palace"),
      t(". Another 800gp on delivery."),
    ),
    p(t("The client's identity is unknown. The deadline is the next tidal alignment — 12 days.")),
  );
  db.insert(schema.entities)
    .values({
      id: questId,
      campaignId,
      name: "Retrieve the Moonstone Scepter",
      kind: "quest",
      summary: "Recover the scepter from the Sunken Palace before the Tidewardens do",
      body: questBody,
      attrs: { questStatus: "active" },
      visibility: "table",
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .run();
  insertLinks(campaignId, "entity", questId, questBody);

  // Item: Moonstone Scepter
  const scepterBody = doc(
    p(
      t("A rod of dark sea-iron topped with a fist-sized moonstone. Warm to the touch. Hums faintly at low tide."),
    ),
    p(
      t("The moonstone pulses when brought within fifty feet of the "),
      mention(sunkenPalaceId, "Sunken Palace"),
      t("."),
    ),
  );
  db.insert(schema.entities)
    .values({
      id: scepterId,
      campaignId,
      name: "Moonstone Scepter",
      kind: "item",
      summary: "Imperial relic of unknown purpose; radiates transmutation magic",
      body: scepterBody,
      visibility: "table",
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .run();
  insertLinks(campaignId, "entity", scepterId, scepterBody);

  // ── Sessions (no createdAt/updatedAt fields in schema) ───────────────

  const session1Body = doc(
    p(
      t("The party arrived at the "),
      mention(saltwaterInnId, "Saltwater Inn"),
      t(" as directed. "),
      mention(miraId, "Mira Saltwell"),
      t(" slid a note across the bar: \"Someone is watching the harbour. Leave before dawn.\""),
    ),
    p(
      t("Investigating the docks, they found a Tidewarden agent shadowing them. "),
      mention(kiraId, "Kira Ashwood"),
      t(" recognised the man — her old handler. They gave him the slip through the fish market."),
    ),
    p(
      t("The session ended with the party recovering a partial map of the diving route to the "),
      mention(sunkenPalaceId, "Sunken Palace"),
      t(" — torn, but enough to plan."),
    ),
  );
  db.insert(schema.sessions)
    .values({
      id: session1Id,
      campaignId,
      number: 1,
      title: "The Innkeeper's Warning",
      status: "played",
      body: session1Body,
    })
    .run();
  insertLinks(campaignId, "session", session1Id, session1Body);

  db.insert(schema.sessions)
    .values({
      id: session2Id,
      campaignId,
      number: 2,
      title: "Into the Depths",
      status: "planned",
      body: doc(
        p(
          t("The party plans to bribe their way onto a Tidewarden diving vessel or steal a submersible skiff."),
        ),
        p(
          t("Planned encounters: bribery or infiltration at the "),
          mention(tidewardenId, "Tidewarden Guild"),
          t(" docks, the kelp forest maze, a guardian construct at the "),
          mention(sunkenPalaceId, "Sunken Palace"),
          t(" gates."),
        ),
      ),
    })
    .run();

  // ── Quotes ────────────────────────────────────────────────────────────
  db.insert(schema.quotes)
    .values({
      id: newId(),
      campaignId,
      sessionId: session1Id,
      text: "The sea gives freely. It just doesn't tell you what it wants back.",
      attribution: "Mira Saltwell",
      createdAt: nowDate,
    })
    .run();
  db.insert(schema.quotes)
    .values({
      id: newId(),
      campaignId,
      sessionId: session1Id,
      text: "I've run from worse. Follow me — and don't look down.",
      attribution: "Kira Ashwood",
      createdAt: new Date(now + 1),
    })
    .run();
  db.insert(schema.quotes)
    .values({
      id: newId(),
      campaignId,
      text: "Every secret in this city eventually floats up to Mira's bar.",
      attribution: "Overheard at the docks",
      createdAt: new Date(now + 2),
    })
    .run();

  return campaignId;
}
