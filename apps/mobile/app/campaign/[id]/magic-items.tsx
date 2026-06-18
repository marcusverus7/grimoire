import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { eq, and } from "drizzle-orm";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { db, getKv, setKv } from "@/lib/db";
import { schema } from "@grimoire/core";
import { randomUUID } from "expo-crypto";

// ── Types ─────────────────────────────────────────────────────────────────────
type Rarity = "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact";

type MagicItem = {
  id: string;
  name: string;
  rarity: Rarity;
  attunement: boolean;
  holderId: string;
  holderName: string;
  notes: string;
};

const RARITIES: Rarity[] = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];
const RARITY_COLORS: Record<Rarity, string> = {
  Common: "#8A7D6D",
  Uncommon: "#2D7A4F",
  Rare: "#2563EB",
  "Very Rare": "#7C3AED",
  Legendary: "#C9A24A",
  Artifact: "#7A1A1A",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function MagicItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storageKey = `magic_items_${id}`;

  const [items, setItems] = useState<MagicItem[]>([]);
  const [pcs, setPcs] = useState<Array<{ id: string; name: string }>>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<MagicItem | null>(null);

  // Form state
  const [fname, setFname] = useState("");
  const [frarity, setFrarity] = useState<Rarity>("Uncommon");
  const [fattune, setFattune] = useState(false);
  const [fholder, setFholder] = useState("Unassigned");
  const [fnotes, setFnotes] = useState("");
  const [filterHolder, setFilterHolder] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    const loaded = getKv(storageKey);
    if (loaded) {
      try { setItems(JSON.parse(loaded) as MagicItem[]); } catch { /* keep empty */ }
    }
    const pcList = db.select({ id: schema.entities.id, name: schema.entities.name })
      .from(schema.entities)
      .where(and(eq(schema.entities.campaignId, id), eq(schema.entities.kind, "pc")))
      .all()
      .sort((a, b) => a.name.localeCompare(b.name));
    setPcs(pcList);
  }, [id, storageKey]));

  function save(next: MagicItem[]) {
    setItems(next);
    setKv(storageKey, JSON.stringify(next));
  }

  function openAdd() {
    setEditItem(null);
    setFname(""); setFrarity("Uncommon"); setFattune(false); setFholder("Unassigned"); setFnotes("");
    setModalVisible(true);
  }

  function openEdit(item: MagicItem) {
    setEditItem(item);
    setFname(item.name); setFrarity(item.rarity); setFattune(item.attunement);
    setFholder(item.holderName); setFnotes(item.notes);
    setModalVisible(true);
  }

  function submit() {
    if (!fname.trim()) return;
    const entry: MagicItem = {
      id: editItem?.id ?? randomUUID(),
      name: fname.trim(),
      rarity: frarity,
      attunement: fattune,
      holderId: pcs.find(p => p.name === fholder)?.id ?? "",
      holderName: fholder,
      notes: fnotes.trim(),
    };
    if (editItem) {
      save(items.map(it => it.id === editItem.id ? entry : it));
    } else {
      save([...items, entry]);
    }
    setModalVisible(false);
  }

  function deleteItem(itemId: string) {
    Alert.alert("Delete Item", "Remove this magic item from the registry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => save(items.filter(it => it.id !== itemId)) },
    ]);
  }

  // Group by holder
  const holders = ["Unassigned", ...pcs.map(p => p.name)];
  const visibleItems = filterHolder ? items.filter(it => it.holderName === filterHolder) : items;
  const grouped = holders.map(h => ({
    holder: h,
    items: visibleItems.filter(it => it.holderName === h),
  })).filter(g => g.items.length > 0);

  // Attunement count per holder
  function attuneCount(holderName: string) {
    return items.filter(it => it.holderName === holderName && it.attunement).length;
  }

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Magic Items", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
          Magic Item Registry
        </Text>
        <GoldRule />

        {/* Summary bar */}
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 16, backgroundColor: "#E8DCC820", borderRadius: 4, padding: 10 }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#2C2014" }}>{items.length}</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D" }}>Total Items</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#C9A24A" }}>
              {items.filter(it => it.rarity === "Rare" || it.rarity === "Very Rare" || it.rarity === "Legendary" || it.rarity === "Artifact").length}
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D" }}>Rare+</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#7C3AED" }}>
              {items.filter(it => it.attunement).length}
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D" }}>Attuned</Text>
          </View>
        </View>

        {/* Filter by holder */}
        {pcs.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => setFilterHolder(null)}
              style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, backgroundColor: filterHolder === null ? "#2C2014" : "#E8DCC8", borderWidth: 1, borderColor: filterHolder === null ? "#2C2014" : "#C4B49A" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: filterHolder === null ? "#C9A24A" : "#4A3F32" }}>All</Text>
            </Pressable>
            {pcs.map(pc => (
              <Pressable
                key={pc.id}
                onPress={() => setFilterHolder(filterHolder === pc.name ? null : pc.name)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, backgroundColor: filterHolder === pc.name ? "#2C2014" : "#E8DCC8", borderWidth: 1, borderColor: filterHolder === pc.name ? "#2C2014" : "#C4B49A" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: filterHolder === pc.name ? "#C9A24A" : "#4A3F32" }}>{pc.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Add button */}
        <Pressable
          onPress={openAdd}
          style={{ backgroundColor: "#2C2014", borderRadius: 2, padding: 12, alignItems: "center", marginBottom: 20 }}
        >
          <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 13, color: "#C9A24A", letterSpacing: 1 }}>
            + Add Magic Item
          </Text>
        </Pressable>

        {/* Grouped list */}
        {grouped.length === 0 && (
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#8A7D6D60", textAlign: "center", marginTop: 20 }}>
            No magic items tracked yet.{"\n"}Add items to keep a registry of party loot.
          </Text>
        )}
        {grouped.map(g => (
          <View key={g.holder} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1 }}>
                {g.holder}
              </Text>
              {g.holder !== "Unassigned" && (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#7C3AED" }}>
                  {attuneCount(g.holder)}/3 attunement
                </Text>
              )}
            </View>
            {g.items.map(item => (
              <ItemCard key={item.id} item={item} onEdit={() => openEdit(item)} onDelete={() => deleteItem(item.id)} />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#F5EDD8", borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, maxHeight: "90%" }}>
            <ScrollView>
              <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 15, color: "#2C2014", marginBottom: 16 }}>
                {editItem ? "Edit Item" : "Add Magic Item"}
              </Text>

              <FieldLabel label="Item Name" />
              <TextInput
                value={fname} onChangeText={setFname}
                placeholder="e.g. Flame Tongue"
                placeholderTextColor="#8A7D6D80"
                style={inputStyle}
              />

              <FieldLabel label="Rarity" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {RARITIES.map(r => (
                  <Pressable
                    key={r}
                    onPress={() => setFrarity(r)}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, borderWidth: 1, borderColor: frarity === r ? RARITY_COLORS[r] : "#C4B49A", backgroundColor: frarity === r ? RARITY_COLORS[r] + "20" : "#E8DCC8" }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: frarity === r ? RARITY_COLORS[r] : "#4A3F32" }}>{r}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable onPress={() => setFattune(a => !a)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 }}>
                <View style={{ width: 18, height: 18, borderRadius: 2, borderWidth: 1.5, borderColor: fattune ? "#7C3AED" : "#C4B49A", backgroundColor: fattune ? "#7C3AED20" : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {fattune && <Text style={{ fontSize: 11, color: "#7C3AED" }}>✓</Text>}
                </View>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014" }}>Requires Attunement</Text>
              </Pressable>

              <FieldLabel label="Holder" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {["Unassigned", "Party", ...pcs.map(p => p.name)].map(h => (
                  <Pressable
                    key={h}
                    onPress={() => setFholder(h)}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, borderWidth: 1, borderColor: fholder === h ? "#2C2014" : "#C4B49A", backgroundColor: fholder === h ? "#2C2014" : "#E8DCC8" }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: fholder === h ? "#C9A24A" : "#4A3F32" }}>{h}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <FieldLabel label="Notes (optional)" />
              <TextInput
                value={fnotes} onChangeText={setFnotes}
                placeholder="Properties, charges, special effects…"
                placeholderTextColor="#8A7D6D80"
                multiline numberOfLines={3}
                style={[inputStyle, { minHeight: 72, textAlignVertical: "top" }]}
              />

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 16 }}>
                <Pressable onPress={() => setModalVisible(false)} style={{ flex: 1, borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#4A3F32" }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={submit} style={{ flex: 1, backgroundColor: "#2C2014", borderRadius: 2, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#C9A24A" }}>
                    {editItem ? "Save Changes" : "Add Item"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ParchmentScreen>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 10,
  fontFamily: "Inter_400Regular" as const, fontSize: 13, color: "#2C2014",
  backgroundColor: "#FFFDF8", marginBottom: 12,
};

function FieldLabel({ label }: { label: string }) {
  return <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</Text>;
}

function ItemCard({ item, onEdit, onDelete }: { item: MagicItem; onEdit: () => void; onDelete: () => void }) {
  const color = RARITY_COLORS[item.rarity];
  return (
    <Pressable onPress={onEdit} onLongPress={onDelete} style={{ backgroundColor: "#E8DCC820", borderRadius: 4, borderWidth: 1, borderColor: "#C4B49A", padding: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#2C2014", flex: 1 }}>{item.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {item.attunement && (
            <View style={{ backgroundColor: "#7C3AED20", borderRadius: 2, paddingHorizontal: 5, paddingVertical: 2 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#7C3AED" }}>ATTUNE</Text>
            </View>
          )}
          <View style={{ backgroundColor: color + "20", borderRadius: 2, paddingHorizontal: 5, paddingVertical: 2 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color }}>{item.rarity.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      {item.notes ? (
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#4A3F32", marginTop: 4 }} numberOfLines={2}>{item.notes}</Text>
      ) : null}
    </Pressable>
  );
}
