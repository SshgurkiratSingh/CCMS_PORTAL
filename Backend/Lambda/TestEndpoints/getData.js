// 1. GET SYSTEM SNAPSHOT (Level 1 Clearance)
async function fetchSystemSnapshot() {
    console.log("[RECON] Initiating Global Snapshot Enquiry...");
    try {
        const response = await fetch(`${API_CONFIG.endpoint}?enquiry=snapshot`, {
            method: 'GET',
            headers: {
                'x-dashboard-key': API_CONFIG.dashKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`HTTP_ERROR: ${response.status}`);
        
        const data = await response.json();
        console.log("[DATA_ACQUIRED]:", data);
        return data;
    } catch (err) {
        console.error("[C0MM5_F41LUR3]:", err.message);
    }
}

// 2. PROVISION NEW PANEL (Level 2 Admin Clearance)
async function provisionPanel(panelId, place) {
    console.log(`[DEPLOY] Provisioning Identity: ${panelId}`);
    const payload = {
        panel_id: panelId,
        location: {
            coordinates: { lat: 30.7225, lng: 76.7674 },
            locationPlace: place
        },
        status: "active",
        rated_kva: 100
    };

    try {
        const response = await fetch(API_CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'x-dashboard-key': API_CONFIG.dashKey,
                'x-admin-key': API_CONFIG.adminKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log("[5YNC_C0MPL373]:", result.message);
    } catch (err) {
        console.error("[4DM1N_R3J3C710N]:", err.message);
    }
}