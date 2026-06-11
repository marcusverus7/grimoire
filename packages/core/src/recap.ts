/**
 * Recap pipeline — the growth loop. Manual recaps in MVP (marked beats →
 * recap doc), AI narration in V1 (prompt builders live here so the edge
 * function stays a thin transport).
 */
import {
  type RichTextDoc,
  type RichTextNode,
  doc,
  isBlock,
  nodeText,
  paragraph,
  textNode,
  walk,
} from "./richtext";

export type RecapTone = "plain" | "epic" | "noir" | "comedy";

export interface Beat {
  /** Block id inside the session body (attrs.blockId). */
  blockRef: string | null;
  text: string;
}

/**
 * Beats are blocks the GM marked in the session note (attrs.beat === true).
 * Order of appearance is narrative order — preserved exactly.
 */
export function extractBeats(sessionBody: RichTextNode): Beat[] {
  const beats: Beat[] = [];
  walk(sessionBody, (node) => {
    if (!isBlock(node) || node.attrs?.["beat"] !== true) return;
    const text = nodeText(node).replace(/\s+/g, " ").trim();
    if (!text) return;
    beats.push({
      blockRef: node.attrs?.["blockId"] != null ? String(node.attrs["blockId"]) : null,
      text,
    });
  });
  return beats;
}

/** The MVP manual recap: beats rendered as a clean read-only document. */
export function buildManualRecapDoc(args: {
  campaignName: string;
  sessionNumber: number;
  sessionTitle?: string | null;
  beats: Beat[];
}): RichTextDoc {
  const { campaignName, sessionNumber, sessionTitle, beats } = args;
  const heading: RichTextNode = {
    type: "heading",
    attrs: { level: 1 },
    content: [
      textNode(
        sessionTitle
          ? `Previously on ${campaignName} — Session ${sessionNumber}: ${sessionTitle}`
          : `Previously on ${campaignName} — Session ${sessionNumber}`,
      ),
    ],
  };
  return doc(heading, ...beats.map((b) => paragraph(textNode(b.text))));
}

const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no 0/O/1/l/I

/**
 * URL-safe share slug; 12 chars of an unambiguous base-58-style alphabet
 * (~70 bits). Uses Web Crypto so it runs in Node, browsers and React Native
 * (with the expo-crypto polyfill) alike.
 */
export function generateShareSlug(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let slug = "";
  for (const b of bytes) slug += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  return slug;
}

// ---------------------------------------------------------------------------
// AI recap prompt (V1) — designed for a Haiku-class model behind the edge
// function. The system prompt carries the rules; the user turn carries data.
// ---------------------------------------------------------------------------

const TONE_DIRECTION: Record<RecapTone, string> = {
  plain:
    "Write in clear, warm, neutral prose. No theatrics — just a faithful, vivid retelling.",
  epic:
    "Write like the narrator of a high-fantasy saga: sweeping, mythic, momentous. Short sentences for impact. Never parody.",
  noir:
    "Write like a hard-boiled detective recalling the night: terse, atmospheric, wry. First person plural for the party ('we').",
  comedy:
    "Write with affectionate comic timing: dry understatement, gentle exaggeration of the party's chaos. Never mock the players.",
};

export interface AiRecapInput {
  campaignName: string;
  systemTag?: string | null;
  sessionNumber: number;
  sessionTitle?: string | null;
  tone: RecapTone;
  /** The GM's session notes as Markdown (richTextToMarkdown output). */
  sessionNotesMarkdown: string;
  /** Marked beats, if the GM marked any — these MUST all appear in the recap. */
  beats?: Beat[];
  /** Previous recap text for continuity, if one exists. */
  previousRecapText?: string | null;
  /** Player character names, so the narrator never invents or misnames a PC. */
  characterNames?: string[];
  /** Facts the players must not learn. The model is told to omit them entirely. */
  gmOnlyNotes?: string | null;
}

export interface AiRecapPrompt {
  system: string;
  user: string;
}

export function buildAiRecapPrompt(input: AiRecapInput): AiRecapPrompt {
  const toneDirection = TONE_DIRECTION[input.tone];

  const system = [
    "You are the recap narrator for a tabletop RPG campaign app. You turn a GM's session notes into a short 'Previously on…' recap that the whole table will read.",
    "",
    "Rules, in priority order:",
    "1. NEVER reveal information marked GM-only, and never hint that hidden information exists. If a GM-only fact is entangled with an event, describe the event as the players experienced it.",
    "2. Only use events present in the notes. Never invent outcomes, dialogue, or names. If the notes are ambiguous, stay vague rather than guess.",
    "3. Every marked beat must appear in the recap, in the order given.",
    "4. Refer to player characters only by the names provided.",
    "5. Length: 150–250 words. It is read on a phone in under a minute.",
    "6. End with one short hook sentence pointing at an unresolved thread from the notes.",
    "",
    `Tone: ${toneDirection}`,
    "",
    "Output: the recap text only. No headings, no preamble, no markdown syntax.",
  ].join("\n");

  const parts: string[] = [
    `Campaign: ${input.campaignName}${input.systemTag ? ` (${input.systemTag})` : ""}`,
    `Session ${input.sessionNumber}${input.sessionTitle ? `: ${input.sessionTitle}` : ""}`,
  ];
  if (input.characterNames?.length) {
    parts.push(`Player characters: ${input.characterNames.join(", ")}`);
  }
  if (input.previousRecapText) {
    parts.push("", "<previous_recap>", input.previousRecapText, "</previous_recap>");
  }
  parts.push("", "<session_notes>", input.sessionNotesMarkdown, "</session_notes>");
  if (input.beats?.length) {
    parts.push(
      "",
      "<beats_that_must_appear_in_order>",
      ...input.beats.map((b, i) => `${i + 1}. ${b.text}`),
      "</beats_that_must_appear_in_order>",
    );
  }
  if (input.gmOnlyNotes) {
    parts.push(
      "",
      "<gm_only_do_not_reveal>",
      input.gmOnlyNotes,
      "</gm_only_do_not_reveal>",
    );
  }

  return { system, user: parts.join("\n") };
}
