/**
 * Minimal TipTap-compatible rich text model. The mobile and web editors both
 * emit this shape; everything in core that reads a body works on it.
 */
export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichTextNode[];
}

export interface RichTextDoc extends RichTextNode {
  type: "doc";
  content?: RichTextNode[];
}

export const MENTION_NODE = "mention";

/** Plain text of a node tree; mentions render as their label. */
export function nodeText(node: RichTextNode): string {
  if (node.type === MENTION_NODE) {
    return String(node.attrs?.["label"] ?? "");
  }
  if (node.text != null) return node.text;
  return (node.content ?? []).map(nodeText).join("");
}

/** Depth-first walk over every node, parents before children. */
export function walk(
  node: RichTextNode,
  visit: (node: RichTextNode, blockAncestor: RichTextNode | null) => void,
  blockAncestor: RichTextNode | null = null,
): void {
  visit(node, blockAncestor);
  const nextAncestor = isBlock(node) ? node : blockAncestor;
  for (const child of node.content ?? []) {
    walk(child, visit, nextAncestor);
  }
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
]);

export function isBlock(node: RichTextNode): boolean {
  return BLOCK_TYPES.has(node.type);
}

export function doc(...content: RichTextNode[]): RichTextDoc {
  return { type: "doc", content };
}

export function paragraph(...content: RichTextNode[]): RichTextNode {
  return { type: "paragraph", content };
}

export function textNode(text: string): RichTextNode {
  return { type: "text", text };
}

export function mentionNode(entityId: string, label: string): RichTextNode {
  return { type: MENTION_NODE, attrs: { entityId, label } };
}
