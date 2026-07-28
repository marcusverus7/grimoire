import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { nodeText } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

interface Props {
  body: RichTextNode;
  campaignId?: string;
}

export function RichTextRenderer({ body, campaignId }: Props) {
  useThemeTick();
  const router = useRouter();

  if (!body.content) return null;

  const handleMention = (entityId: string) => {
    if (campaignId && entityId) {
      router.push(`/campaign/${campaignId}/entity/${entityId}` as Parameters<typeof router.push>[0]);
    }
  };

  return (
    <>
      {body.content.map((block, i) => {
        if (!nodeText(block).trim()) return null;

        if (block.type === "heading") {
          const level = (block.attrs?.["level"] as number) ?? 2;
          return (
            <Text
              key={i}
              style={{
                fontFamily: "CormorantGaramond_700Bold",
                fontSize: level === 1 ? 22 : level === 2 ? 19 : 17,
                color: color.ink,
                marginBottom: 8,
              }}
            >
              {renderInline(block, handleMention)}
            </Text>
          );
        }

        if (block.type === "blockquote") {
          return (
            <View
              key={i}
              style={{
                borderLeftWidth: 2,
                borderLeftColor: withAlpha("gold", 0x66 / 255),
                paddingLeft: 12,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "CormorantGaramond_400Regular_Italic",
                  fontSize: 16,
                  color: withAlpha("ink", 0xB3 / 255),
                  lineHeight: 24,
                  fontStyle: "italic",
                }}
              >
                {renderInline(block, handleMention)}
              </Text>
            </View>
          );
        }

        if (block.type === "bulletList" || block.type === "orderedList") {
          return (
            <View key={i} style={{ marginBottom: 8, paddingLeft: 8 }}>
              {(block.content ?? []).map((li, j) => (
                <View key={j} style={{ flexDirection: "row", marginBottom: 4 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      color: color.gold,
                      marginRight: 8,
                    }}
                  >
                    {block.type === "orderedList" ? `${j + 1}.` : "•"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "CormorantGaramond_400Regular",
                      fontSize: 16,
                      color: withAlpha("ink", 0xCC / 255),
                      flex: 1,
                      lineHeight: 24,
                    }}
                  >
                    {renderInline(li, handleMention)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text
            key={i}
            style={{
              fontFamily: "CormorantGaramond_400Regular",
              fontSize: 16,
              color: withAlpha("ink", 0xCC / 255),
              marginBottom: 8,
              lineHeight: 24,
            }}
          >
            {renderInline(block, handleMention)}
          </Text>
        );
      })}
    </>
  );
}

function renderInline(
  node: RichTextNode,
  onMention: (entityId: string) => void,
): React.ReactNode {
  if (node.text != null) return node.text;

  if (node.type === "mention") {
    const label = String(node.attrs?.["label"] ?? "");
    const entityId = String(node.attrs?.["id"] ?? "");
    return (
      <Text
        key={`mention-${entityId || label}`}
        onPress={() => onMention(entityId)}
        style={{
          color: color.gold,
          fontFamily: "CormorantGaramond_600SemiBold",
        }}
      >
        @{label}
      </Text>
    );
  }

  const children = (node.content ?? []).map((child, i) =>
    renderInline(child, onMention),
  );

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return React.createElement(React.Fragment, null, ...children);
}
