import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState, useCallback } from "react";
import { eq, and, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema, nodeText } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

type ResultKind = "entity" | "session" | "quote";

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  href: string;
}

const KIND_COLORS: Record<ResultKind, string> = {
  entity: "#A07A2C",
  session: "#7A2418",
  quote: "#4A3F32",
};

export default function LoreSearchScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const search = useCallback(
    (q: string) => {
      const trimmed = q.trim().toLowerCase();
      if (!trimmed) {
        setResults([]);
        setSearched(false);
        return;
      }
      setSearched(true);
      const out: SearchResult[] = [];
      const pattern = `%${trimmed}%`;

      // Search entities by name + summary
      const entities = db
        .select()
        .from(schema.entities)
        .where(
          and(
            eq(schema.entities.campaignId, campaignId),
            or(
              like(schema.entities.name, pattern),
              like(schema.entities.summary, pattern),
            ),
          ),
        )
        .limit(20)
        .all();

      for (const e of entities) {
        out.push({
          id: e.id,
          kind: "entity",
          title: e.name,
          subtitle: e.kind + (e.summary ? ` — ${e.summary.slice(0, 80)}` : ""),
          href: `/campaign/${campaignId}/entity/${e.id}`,
        });
      }

      // Search sessions by title + body text
      const sessions = db
        .select()
        .from(schema.sessions)
        .where(
          and(
            eq(schema.sessions.campaignId, campaignId),
            or(
              like(schema.sessions.title, pattern),
              like(schema.sessions.body as unknown as string, pattern),
            ),
          ),
        )
        .limit(10)
        .all();

      for (const s of sessions) {
        const bodyText = s.body
          ? nodeText(s.body as RichTextNode).slice(0, 100)
          : "";
        const matchInBody =
          bodyText.toLowerCase().includes(trimmed) && !s.title?.toLowerCase().includes(trimmed);
        out.push({
          id: s.id,
          kind: "session",
          title: `Session ${s.number}${s.title ? `: ${s.title}` : ""}`,
          subtitle: matchInBody ? `"…${bodyText}…"` : s.status,
          href: `/campaign/${campaignId}/session/${s.id}`,
        });
      }

      // Search quotes by text + attribution
      const quotes = db
        .select()
        .from(schema.quotes)
        .where(
          and(
            eq(schema.quotes.campaignId, campaignId),
            or(
              like(schema.quotes.text, pattern),
              like(schema.quotes.attribution, pattern),
            ),
          ),
        )
        .limit(10)
        .all();

      for (const q of quotes) {
        out.push({
          id: q.id,
          kind: "quote",
          title: `"${q.text.slice(0, 70)}${q.text.length > 70 ? "…" : ""}"`,
          subtitle: q.attribution ? `— ${q.attribution}` : "Quote",
          href: `/campaign/${campaignId}/quotes`,
        });
      }

      setResults(out);
    },
    [campaignId],
  );

  const handleChange = (text: string) => {
    setQuery(text);
    search(text);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Search Lore",
          headerSearchBarOptions: undefined,
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1 }}>
          {/* Search input */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              margin: 16,
              borderWidth: 1,
              borderColor: "#A07A2C40",
              borderRadius: 4,
              backgroundColor: "#FAF5EA",
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ fontSize: 16, color: "#A07A2C", marginRight: 8 }}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={handleChange}
              placeholder="Search entities, sessions, quotes…"
              placeholderTextColor="#8A7D6D80"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                fontFamily: "Inter_400Regular",
                fontSize: 15,
                color: "#2C2014",
                paddingVertical: 12,
              }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => handleChange("")}>
                <Text style={{ color: "#8A7D6D", fontSize: 18, paddingLeft: 8 }}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Results */}
          {results.length === 0 && searched ? (
            <View style={{ alignItems: "center", marginTop: 48 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: "#2C2014", marginBottom: 8 }}>
                Nothing found
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", textAlign: "center" }}>
                Try a different name, keyword, or phrase.
              </Text>
            </View>
          ) : results.length === 0 && !searched ? (
            <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 32 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014", marginBottom: 8 }}>
                Lore Search
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", textAlign: "center", lineHeight: 20 }}>
                Search across all entities, session notes, and captured quotes in this campaign.
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.kind + item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(item.href as Parameters<typeof router.push>[0])}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    marginBottom: 6,
                    borderRadius: 2,
                    borderWidth: 1,
                    borderColor: "#A07A2C15",
                    backgroundColor: "#FAF5EA",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 2,
                        backgroundColor: KIND_COLORS[item.kind] + "20",
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: KIND_COLORS[item.kind], textTransform: "uppercase", letterSpacing: 0.8 }}>
                        {item.kind}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014", marginBottom: 2 }}>
                    {item.title}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#8A7D6D" }} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                </Pressable>
              )}
              ListHeaderComponent={
                results.length > 0 ? (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginBottom: 10 }}>
                    {results.length} result{results.length !== 1 ? "s" : ""}
                  </Text>
                ) : null
              }
            />
          )}
        </View>
      </ParchmentScreen>
    </>
  );
}
