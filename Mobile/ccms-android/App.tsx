import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { getSnapshot, latestValue, telemetryDate, toPanels } from "./src/api";
import type { Panel } from "./src/types";

const DASHBOARD_KEY_STORAGE = "ccms_dashboard_key";

function metric(value: number, unit: string, digits = 1): string {
  return `${value.toFixed(digits)} ${unit}`;
}

function PanelDetails({ panel, onBack }: { panel: Panel; onBack: () => void }) {
  const latest = panel.latest;
  const timestamp = telemetryDate(latest?.timestamp);
  const readings = [
    ["Average voltage", metric(latestValue(latest, "R3035"), "V")],
    ["Average current", metric(latestValue(latest, "R3009"), "A", 3)],
    ["Grid frequency", metric(latestValue(latest, "R3109"), "Hz", 2)],
    ["Power factor", latestValue(latest, "R3053").toFixed(3)],
    ["Battery", metric(latestValue(latest, "batteryVoltage"), "V", 3)],
    ["Temperature", metric(latestValue(latest, "temperature"), "°C")],
    ["Mains", String(latest?.mainsStatus ?? "UNKNOWN")],
  ];

  return (
    <View style={styles.screen}>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹ Panels</Text></Pressable>
      <Text style={styles.title}>{panel.name}</Text>
      <Text style={styles.subtle}>{panel.id} · {panel.deviceId}</Text>
      <Text style={styles.subtle}>{timestamp ? `Last reading: ${timestamp.toLocaleString()}` : "No telemetry received"}</Text>
      <View style={styles.detailGrid}>
        {readings.map(([label, value]) => (
          <View key={label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  const [dashboardKey, setDashboardKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(DASHBOARD_KEY_STORAGE).then(setSavedKey);
  }, []);

  const loadSnapshot = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      setPanels(toPanels(await getSnapshot(key)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (savedKey) loadSnapshot(savedKey);
  }, [loadSnapshot, savedKey]);

  const summary = useMemo(() => {
    const online = panels.filter((panel) => panel.status === "ACTIVE" || panel.status === "ONLINE").length;
    const alarms = panels.filter((panel) => panel.status === "FAULT").length;
    return { online, alarms };
  }, [panels]);

  const signIn = async () => {
    const key = dashboardKey.trim();
    if (!key) {
      setError("Enter the dashboard key.");
      return;
    }
    await SecureStore.setItemAsync(DASHBOARD_KEY_STORAGE, key);
    setSavedKey(key);
  };

  if (!savedKey) {
    return (
      <SafeAreaView style={styles.loginScreen}>
        <Text style={styles.brand}>CCMS Portal</Text>
        <Text style={styles.loginLead}>Fleet telemetry for Android</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setDashboardKey}
          placeholder="Dashboard key"
          placeholderTextColor="#7f8ca5"
          secureTextEntry
          style={styles.input}
          value={dashboardKey}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={signIn} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Connect</Text></Pressable>
      </SafeAreaView>
    );
  }

  if (selectedPanel) {
    return <SafeAreaView style={styles.safe}><PanelDetails panel={selectedPanel} onBack={() => setSelectedPanel(null)} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={panels}
        keyExtractor={(panel) => panel.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadSnapshot(savedKey)} tintColor="#72d8ff" />}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Fleet overview</Text>
            <Text style={styles.subtle}>Live data from the CCMS Lambda API</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}><Text style={styles.metricLabel}>Panels</Text><Text style={styles.summaryValue}>{panels.length}</Text></View>
              <View style={styles.summaryCard}><Text style={styles.metricLabel}>Active / online</Text><Text style={styles.summaryValue}>{summary.online}</Text></View>
              <View style={styles.summaryCard}><Text style={styles.metricLabel}>Faults</Text><Text style={styles.summaryValue}>{summary.alarms}</Text></View>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            {loading && !panels.length && <ActivityIndicator color="#72d8ff" style={styles.loader} />}
            <Text style={styles.sectionTitle}>Panels</Text>
          </>
        }
        renderItem={({ item }) => {
          const date = telemetryDate(item.latest?.timestamp);
          return (
            <Pressable onPress={() => setSelectedPanel(item)} style={styles.panelCard}>
              <View style={styles.panelHeader}><Text style={styles.panelName}>{item.name}</Text><Text style={styles.status}>{item.status}</Text></View>
              <Text style={styles.subtle}>{item.id} · {item.deviceId}</Text>
              <Text style={styles.reading}>{item.latest ? `${metric(latestValue(item.latest, "R3035"), "V")} · ${metric(latestValue(item.latest, "R3009"), "A", 3)}` : "No telemetry yet"}</Text>
              <Text style={styles.subtle}>{date ? date.toLocaleString() : ""}</Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#07111f" },
  screen: { flex: 1, padding: 20, backgroundColor: "#07111f" },
  loginScreen: { flex: 1, justifyContent: "center", padding: 28, backgroundColor: "#07111f" },
  list: { padding: 20, gap: 12 },
  brand: { color: "#f4f8ff", fontSize: 34, fontWeight: "800" },
  loginLead: { color: "#9aaac3", fontSize: 16, marginTop: 8, marginBottom: 28 },
  title: { color: "#f4f8ff", fontSize: 28, fontWeight: "800" },
  subtle: { color: "#9aaac3", fontSize: 13, marginTop: 4 },
  input: { backgroundColor: "#101e31", borderColor: "#29425f", borderWidth: 1, borderRadius: 12, color: "#fff", fontSize: 16, padding: 15 },
  primaryButton: { alignItems: "center", backgroundColor: "#25aee4", borderRadius: 12, marginTop: 14, padding: 15 },
  primaryButtonText: { color: "#02121d", fontSize: 16, fontWeight: "800" },
  error: { color: "#ff9b9b", marginTop: 12 },
  summaryRow: { flexDirection: "row", gap: 8, marginTop: 20 },
  summaryCard: { flex: 1, backgroundColor: "#10233a", borderRadius: 12, minHeight: 86, padding: 12 },
  summaryValue: { color: "#ecf6ff", fontSize: 27, fontWeight: "800", marginTop: 7 },
  sectionTitle: { color: "#ecf6ff", fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 2 },
  panelCard: { backgroundColor: "#0d1d30", borderColor: "#1d3856", borderWidth: 1, borderRadius: 14, padding: 16 },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  panelName: { color: "#f4f8ff", flex: 1, fontSize: 17, fontWeight: "700", marginRight: 8 },
  status: { color: "#72d8ff", fontSize: 12, fontWeight: "800" },
  reading: { color: "#d4e5f5", fontSize: 15, marginTop: 12 },
  loader: { marginTop: 24 },
  backButton: { marginBottom: 18 },
  backText: { color: "#72d8ff", fontSize: 16, fontWeight: "700" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 24 },
  metricCard: { backgroundColor: "#10233a", borderRadius: 12, minHeight: 90, padding: 14, width: "48%" },
  metricLabel: { color: "#9aaac3", fontSize: 12 },
  metricValue: { color: "#f4f8ff", fontSize: 18, fontWeight: "700", marginTop: 8 },
});
