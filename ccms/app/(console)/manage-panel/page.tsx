"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPanel, updatePanel, getPanels } from "@/lib/api/ccms-api";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { ArrowLeft, Save, PlusCircle, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { Button, Input } from "@heroui/react";
import { PageHeader, SectionCard, ErrorBanner } from "@/components/ui";

const LocationPickerMap = dynamic(() => import("@/components/location-picker-map"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full bg-slate-800 animate-pulse flex items-center justify-center rounded-md border border-slate-700">
      <div className="text-slate-400 text-sm">Loading Map...</div>
    </div>
  ),
});

export default function ManagePanelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, setAdminKey } = useAuth();
  const editId = searchParams.get("id");

  const [panelId, setPanelId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [firmware, setFirmware] = useState("1.0.0");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locationPlace, setLocationPlace] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation is not supported by your browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude.toString()); setLng(pos.coords.longitude.toString()); },
      () => setError("Failed to get current location. Ensure you have granted permission."),
    );
  };

  useEffect(() => {
    if (!editId) return;
    getPanels({ limit: 100 })
      .then((res) => {
        const p = res.items.find((x) => x.panelId === editId);
        if (p) {
          setPanelId(p.panelId); setDeviceId(p.deviceId); setFirmware(p.firmwareVersion);
          setLat(p.gpsLat.toString()); setLng(p.gpsLng.toString());
          setLocationPlace(p.name !== p.panelId ? p.name : "");
        }
      })
      .catch(() => setError("Failed to load existing panel data."));
  }, [editId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!session?.adminKey) {
        const input = window.prompt("Admin password is required to save panel changes.");
        const trimmed = input?.trim() ?? "";
        if (!trimmed) { setError("Admin password is required to save panel changes."); return; }
        await setAdminKey(trimmed);
      }
      const payload = {
        panel_id: panelId, device_id: deviceId, firmware,
        location: { locationPlace: locationPlace || panelId, coordinates: { lat: parseFloat(lat) || 0, lng: parseFloat(lng) || 0 } },
        status: "UNKNOWN",
      };
      if (editId) {
        const { status, ...updatePayload } = payload;
        await updatePanel(editId, updatePayload);
      } else {
        await createPanel(payload);
      }
      router.push("/panels");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save node";
      setError(
        /403|forbidden|admin\s*key|admin/i.test(message)
          ? "Admin authorization failed. Please provide a valid admin password and try again."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col gap-1.5 border-b border-slate-800 pb-4">
        <Link
          href="/panels"
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors mb-1 font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Fleet
        </Link>
        <PageHeader
          icon={editId ? <Save className="h-6 w-6 text-indigo-400" /> : <PlusCircle className="h-6 w-6 text-emerald-400" />}
          title={editId ? "Update Node Configuration" : "Provision New Node"}
          description={
            editId
              ? "Modify the metadata and spatial coordinates of an existing edge node."
              : "Register a new edge node controller into the fleet ecosystem."
          }
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSave} className="space-y-5">
        <SectionCard className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Node / Panel ID <span className="text-rose-400">*</span>
            </label>
            <Input
              required disabled={!!editId} type="text" variant="secondary"
              value={panelId} onChange={(e) => setPanelId(e.target.value)} placeholder="e.g. METER-105"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Device ID</label>
              <Input type="text" variant="secondary" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Meter_001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Firmware Version</label>
              <Input type="text" variant="secondary" value={firmware} onChange={(e) => setFirmware(e.target.value)} placeholder="1.0.0" />
            </div>
          </div>
        </SectionCard>

        <SectionCard className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-200">Spatial Localization</h3>
            <Button type="button" size="sm" variant="secondary" onPress={handleUseCurrentLocation} className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Use Current Location
            </Button>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Location Name / Identifier</label>
            <Input type="text" variant="secondary" value={locationPlace} onChange={(e) => setLocationPlace(e.target.value)} placeholder="e.g. North Sector, Main Highway" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Latitude</label>
              <Input type="number" variant="secondary" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="0.00000" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Longitude</label>
              <Input type="number" variant="secondary" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="0.00000" />
            </div>
          </div>
          <div className="pt-1">
            <label className="text-sm font-medium text-slate-300 block mb-2">Pin Location on Map</label>
            <LocationPickerMap
              lat={parseFloat(lat) || 0}
              lng={parseFloat(lng) || 0}
              onChange={(newLat, newLng) => { setLat(newLat.toFixed(5)); setLng(newLng.toFixed(5)); }}
            />
          </div>
        </SectionCard>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onPress={() => router.push("/panels")}>Cancel</Button>
          <Button type="submit" variant="primary" isDisabled={saving || !panelId} isPending={saving}>
            {saving ? "Saving..." : editId ? "Save Changes" : "Provision Node"}
          </Button>
        </div>
      </form>
    </section>
  );
}
