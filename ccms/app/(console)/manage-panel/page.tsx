"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPanel, updatePanel, getPanels } from "@/lib/api/ccms-api";
import Link from "next/link";
import { ArrowLeft, Save, AlertTriangle, PlusCircle } from "lucide-react";

export default function ManagePanelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id"); // if present, we are updating

  const [panelId, setPanelId] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [firmware, setFirmware] = useState("1.0.0");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locationPlace, setLocationPlace] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editId) {
      // Basic fetch to prefill if editing
      getPanels({ limit: 100 })
        .then((res) => {
          const p = res.items.find((x) => x.panelId === editId);
          if (p) {
            setPanelId(p.panelId);
            setMacAddress(p.macAddress);
            setFirmware(p.firmwareVersion);
            setLat(p.gpsLat.toString());
            setLng(p.gpsLng.toString());
            setLocationPlace(p.name !== p.panelId ? p.name : "");
          }
        })
        .catch(() => {
          setError("Failed to load existing panel data.");
        });
    }
  }, [editId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        panel_id: panelId,
        mac_address: macAddress,
        firmware: firmware,
        location: {
          locationPlace: locationPlace || panelId,
          coordinates: {
            lat: parseFloat(lat) || 0,
            lng: parseFloat(lng) || 0,
          },
        },
        status: "UNKNOWN", // Default initial status
      };

      if (editId) {
        // Exclude status update directly if editing so we don't overwrite live health manually
        const { status, ...updatePayload } = payload;
        await updatePanel(editId, updatePayload);
      } else {
        await createPanel(payload);
      }

      router.push("/panels");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save node");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col gap-2 border-b border-slate-800 pb-4">
        <Link
          href="/panels"
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors mb-2 font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Fleet
        </Link>
        <h2 className="text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          {editId ? (
            <Save className="h-6 w-6 text-indigo-400" />
          ) : (
            <PlusCircle className="h-6 w-6 text-emerald-400" />
          )}
          {editId ? "Update Node Configuration" : "Provision New Node"}
        </h2>
        <p className="text-sm text-slate-400">
          {editId
            ? "Modify the metadata and spatial coordinates of an existing edge node."
            : "Register a new edge node controller into the fleet ecosystem."}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">
              Node / Panel ID <span className="text-rose-400">*</span>
            </label>
            <input
              required
              disabled={!!editId}
              type="text"
              value={panelId}
              onChange={(e) => setPanelId(e.target.value)}
              placeholder="e.g. METER-105"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                MAC Address
              </label>
              <input
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                placeholder="00:00:00:00:00:00"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Firmware Version
              </label>
              <input
                type="text"
                value={firmware}
                onChange={(e) => setFirmware(e.target.value)}
                placeholder="1.0.0"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <h3 className="font-semibold text-slate-200 mb-2">
            Spatial Localization
          </h3>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">
              Location Name / Identifier
            </label>
            <input
              type="text"
              value={locationPlace}
              onChange={(e) => setLocationPlace(e.target.value)}
              placeholder="e.g. North Sector, Main Highway"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="0.00000"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="0.00000"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/panels"
            className="px-6 py-2 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !panelId}
            className="px-6 py-2 rounded-md bg-indigo-500 text-white font-medium hover:bg-indigo-400 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <span className="animate-pulse">Saving...</span>
            ) : (
              <>{editId ? "Save Changes" : "Provision Node"}</>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
