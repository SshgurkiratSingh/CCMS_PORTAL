#!/usr/bin/env python3
"""
CCMS Digital Hardware Clone / Simulator (ESP32 CCMS Node Twin)
=============================================================
A digital copy and testing simulator for the CCMS (Centralized Control & Monitoring System)
smart streetlight & energy meter node.

Simulates:
  - ESP32 Controller (v2.0 / v3.0 firmware behavior)
  - 128x64 SSD1306 I2C OLED Display (with auto/manual 3-screen cycling)
  - Physical Push Button (GPIO 32)
  - Physical Status LEDs:
      - LED 1 (GPIO 25): Mains Power OK (mainsRaw > 500)
      - LED 2 (GPIO 26): Network Activity (WiFi & MQTT Connected)
      - LED 3 (GPIO 27): Telemetry Tx Indicator (Flashes on publish)
  - Main Power Relay Contactor (GPIO 23 in v3.0 / GPIO 14 in v2.0)
  - Schneider Electric Modbus Multi-function Energy Meter:
      - R3009: Avg Current (A)
      - R3027: Phase 1 Voltage (V)
      - R3035: Avg Voltage (V)
      - R3053: Total Power Factor
      - R3059: Power Factor Phase 1
      - R3083: Active Power Vector (W)
      - R3109: Grid Frequency (Hz)
      - Plus additional Schneider registers (3011, 3055, 3057, 3061, 3063, 3085, 3107)
  - Node Sensors:
      - Battery Voltage (ADC GPIO 34)
      - Mains AC Raw ADC (GPIO 35)
      - Tilt / Tamper Sensor (GPIO 15)
      - DHT11 Temperature & Humidity (GPIO 4)
  - AWS IoT Core MQTT & Device Shadow Engine:
      - Real TLS MQTT connection (with auto-discovered certs) or Mock Loopback
      - Real-time Shadow Delta processing (remote Relay toggle & RTC Schedule sync)
      - Periodic Telemetry dispatch to `meter/telemetry/{CLIENT_ID}`
      - Shadow state sync to `$aws/things/{CLIENT_ID}/shadow/update`
  - Real-time Serial Terminal Console mirror (115200 baud output format)

Usage:
  python3 Tools/hardware_clone/hardware_clone.py
"""

import os
import sys
import time
import json
import random
import socket
import ssl
import threading
from datetime import datetime

import tkinter as tk
from tkinter import ttk, messagebox, filedialog

# Force IPv4 for AWS IoT resolution (solves Linux dual-stack timeout quirks)
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_getaddrinfo(host, port, family=0, *args, **kwargs):
    return _orig_getaddrinfo(host, port, socket.AF_INET, *args, **kwargs)
socket.getaddrinfo = _ipv4_getaddrinfo

# Try importing MQTT client
MQTT_AVAILABLE = False
try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    pass


# ==============================================================================
# DEFAULT HARDWARE CONFIGURATION & REGISTERS
# ==============================================================================
DEFAULT_AWS_ENDPOINT = "a3ia5opqzsvf3l-ats.iot.us-east-1.amazonaws.com"
DEFAULT_AWS_PORT = 8883
DEFAULT_CLIENT_ID = "Meter_001"
DEFAULT_PUBLISH_INTERVAL = 5  # seconds

# Schneider Modbus registers matching firmware
MODBUS_REGISTERS = [
    3009, 3011, 3027, 3035, 3053, 3055, 3057, 3059,
    3061, 3063, 3083, 3085, 3107, 3109
]


def find_default_credentials():
    """Attempt to locate AWS IoT certs in known repo paths."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    search_dirs = [
        os.path.join(base_dir, "Firmware", "ESP32_wifi_CCMS_v3.0", "credentials"),
        os.path.join(base_dir, "Firmware", "ESP32_wifi_CCMS_v2.0", "credentials"),
        os.path.join(base_dir, "credentials"),
    ]
    for d in search_dirs:
        if os.path.isdir(d):
            files = os.listdir(d)
            ca = next((f for f in files if "AmazonRootCA" in f and f.endswith(".pem")), None)
            crt = next((f for f in files if f.endswith(".crt") or f.endswith(".pem.crt")), None)
            key = next((f for f in files if "private" in f and f.endswith(".key")), None)
            if ca and crt and key:
                return {
                    "dir": d,
                    "ca": os.path.join(d, ca),
                    "cert": os.path.join(d, crt),
                    "key": os.path.join(d, key)
                }
    return None


# ==============================================================================
# HARDWARE NODE STATE
# ==============================================================================
class HardwareNodeState:
    def __init__(self):
        # Firmware Version & Identification
        self.firmware_version = "v3.0"
        self.relay_pin = 23  # GPIO 23 in v3.0, GPIO 14 in v2.0
        self.device_id = DEFAULT_CLIENT_ID
        self.device_state = "IDLE"
        self.fault_code = 0

        # Physical Actuator State
        self.relay_state = False  # False = OFF, True = ON

        # Auto Schedule
        self.auto_on_time = "18:00"
        self.auto_off_time = "06:00"
        self.last_schedule_check_minute = -1

        # Sensor Inputs (Adjustable via GUI)
        self.battery_voltage = 12.60   # Volts
        self.mains_raw = 3250          # ADC raw (0-4095)
        self.tilt_switch = 1           # 1 = Safe (Upright), 0 = Tilted
        self.temperature = 28.5        # °C
        self.humidity = 55.0           # %

        # Modbus / AC Grid Parameters
        self.grid_voltage = 230.4      # Volts (R3027 Phase 1, R3035 Avg)
        self.load_current = 4.25       # Amps (R3009)
        self.grid_freq = 50.02         # Hz (R3109)
        self.power_factor = 0.96       # PF (R3053, R3059)

        # Simulation Options
        self.auto_zero_current_on_relay_off = True
        self.jitter_noise = True

        # OLED Display State
        self.current_screen = 0  # 0: SYSTEM, 1: SENSORS, 2: MODBUS
        self.num_screens = 3
        self.auto_switch_screens = True
        self.last_screen_switch = time.time()
        self.screen_switch_interval = 5.0  # seconds

        # LEDs
        self.led1_mains_ok = False
        self.led2_net_active = False
        self.led3_tx_flash = False
        self.led3_off_timer = None

        # Uptime & Publish Timing
        self.boot_timestamp = time.time()
        self.last_publish_time = 0.0
        self.publish_interval = DEFAULT_PUBLISH_INTERVAL

    def get_effective_current(self):
        """If relay is open and auto_zero enabled, no current flows."""
        if self.auto_zero_current_on_relay_off and not self.relay_state:
            return 0.0
        return self.load_current

    def get_active_power_w(self):
        """P = V * I * PF"""
        v = self.grid_voltage
        i = self.get_effective_current()
        pf = self.power_factor
        return round(v * i * pf, 2)

    def is_mains_ok(self):
        return self.mains_raw > 500

    def apply_jitter(self):
        """Inject subtle real-world grid jitter."""
        if not self.jitter_noise:
            return
        # Subtle variations
        self.grid_voltage = max(180.0, min(260.0, round(self.grid_voltage + random.uniform(-0.3, 0.3), 2)))
        self.grid_freq = max(49.0, min(51.0, round(self.grid_freq + random.uniform(-0.02, 0.02), 2)))
        if self.relay_state:
            self.load_current = max(0.0, round(self.load_current + random.uniform(-0.05, 0.05), 2))
        self.temperature = round(self.temperature + random.uniform(-0.02, 0.02), 1)

    def generate_telemetry_payload(self):
        """Construct exact JSON payload as sent by ESP32 firmware."""
        now_ts = int(time.time())
        uptime_ms = int((time.time() - self.boot_timestamp) * 1000)
        eff_current = self.get_effective_current()
        p_w = self.get_active_power_w()

        doc = {
            "timestamp": now_ts,
            "uptime_ms": uptime_ms,
            "client_id": self.device_id,
            "batteryVoltage": round(self.battery_voltage, 2),
            "mainsVoltageRaw": int(self.mains_raw),
            "mainsStatus": "ON" if self.is_mains_ok() else "OFF",
            "tiltSwitch": int(self.tilt_switch),
            "temperature": round(self.temperature, 1),
            # Schneider Registers:
            "R3009": round(eff_current, 2),
            "R3011": round(eff_current, 2),
            "R3027": round(self.grid_voltage, 2),
            "R3035": round(self.grid_voltage, 2),
            "R3053": round(self.power_factor, 3),
            "R3055": round(self.power_factor, 3),
            "R3057": round(self.power_factor, 3),
            "R3059": round(self.power_factor, 3),
            "R3061": 0.0,
            "R3063": 0.0,
            "R3083": round(p_w, 2),
            "R3085": round(self.grid_voltage * eff_current, 2),
            "R3107": 0.0,
            "R3109": round(self.grid_freq, 2),
        }
        return doc

    def generate_shadow_reported_payload(self):
        """Construct reported Device Shadow payload."""
        now_ts = int(time.time())
        return {
            "state": {
                "reported": {
                    "relay_pin": self.relay_pin,
                    "relay_state": self.relay_state,
                    "device_state": self.device_state,
                    "timeToAutoTurnOn": self.auto_on_time,
                    "timeToAutoTurnOff": self.auto_off_time,
                    "fault_code": self.fault_code,
                    "timestamp": now_ts
                }
            }
        }


# ==============================================================================
# DIGITAL CLONE GUI & CONTROLLER
# ==============================================================================
class HardwareCloneApp:
    def __init__(self, root):
        self.root = root
        self.root.title("CCMS Node Digital Hardware Clone (ESP32 Simulator)")
        self.root.geometry("1280x880")
        self.root.minsize(1100, 780)
        self.root.configure(bg="#121820")

        self.state = HardwareNodeState()

        # Networking State
        self.mqtt_client = None
        self.is_connected = False
        self.is_loopback_mode = False
        self.mqtt_thread = None
        self.auto_publish_active = True

        # Locate certs
        found_creds = find_default_credentials()
        self.cert_ca = found_creds["ca"] if found_creds else ""
        self.cert_crt = found_creds["cert"] if found_creds else ""
        self.cert_key = found_creds["key"] if found_creds else ""

        # UI Setup
        self._setup_styles()
        self._build_ui()

        # Log system boot
        self.log_serial(f"--- CCMS {self.state.firmware_version} Hardware Clone Started ---", "SYS")
        self.log_serial(f"ESP32 Internal Clock & RTC Emulation Active (IST UTC+5:30)", "SYS")
        self.log_serial(f"Relay Output mapped to GPIO {self.state.relay_pin}", "GPIO")
        if found_creds:
            self.log_serial(f"Found AWS IoT Credentials in: {found_creds['dir']}", "NET")
        else:
            self.log_serial("No certificates found in default paths. Ready for Mock Loopback or Manual Cert selection.", "WARN")

        # Start periodic GUI simulation loop
        self.root.after(200, self._sim_loop)

    # --------------------------------------------------------------------------
    # UI STYLES
    # --------------------------------------------------------------------------
    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        # Common Dark Theme Palette
        self.BG_MAIN = "#121820"
        self.BG_PANEL = "#1a222d"
        self.BG_CARD = "#232e3d"
        self.BG_OLED = "#04080e"
        self.FG_TEXT = "#e2e8f0"
        self.FG_MUTED = "#8292a2"
        self.COLOR_CYAN = "#00e5ff"
        self.COLOR_GREEN = "#10b981"
        self.COLOR_AMBER = "#f59e0b"
        self.COLOR_RED = "#ef4444"
        self.COLOR_BLUE = "#3b82f6"

        style.configure("TFrame", background=self.BG_MAIN)
        style.configure("Panel.TFrame", background=self.BG_PANEL)
        style.configure("Card.TFrame", background=self.BG_CARD)

        style.configure("TLabel", background=self.BG_MAIN, foreground=self.FG_TEXT, font=("Segoe UI", 10))
        style.configure("Card.TLabel", background=self.BG_CARD, foreground=self.FG_TEXT, font=("Segoe UI", 10))
        style.configure("CardTitle.TLabel", background=self.BG_CARD, foreground=self.COLOR_CYAN, font=("Segoe UI", 11, "bold"))
        style.configure("Muted.TLabel", background=self.BG_CARD, foreground=self.FG_MUTED, font=("Segoe UI", 9))

        style.configure("Action.TButton", font=("Segoe UI", 10, "bold"), padding=6)
        style.configure("Tactile.TButton", font=("Segoe UI", 11, "bold"), padding=10)

    # --------------------------------------------------------------------------
    # LAYOUT
    # --------------------------------------------------------------------------
    def _build_ui(self):
        # 1. TOP HEADER BAR
        top_bar = tk.Frame(self.root, bg="#0d1217", height=54, bd=0)
        top_bar.pack(fill=tk.X, side=tk.TOP)

        title_lbl = tk.Label(top_bar, text="⚡ CCMS HARDWARE DIGITAL CLONE", bg="#0d1217", fg=self.COLOR_CYAN,
                             font=("Segoe UI", 14, "bold"), padx=16)
        title_lbl.pack(side=tk.LEFT, fill=tk.Y)

        self.lbl_header_clock = tk.Label(top_bar, text="--:--:--", bg="#0d1217", fg="#94a3b8",
                                         font=("Consolas", 12))
        self.lbl_header_clock.pack(side=tk.LEFT, padx=12)

        # Top Bar Quick Actions
        self.btn_force_telemetry = tk.Button(top_bar, text="📤 Send Telemetry Now", bg="#1e293b", fg=self.FG_TEXT,
                                             activebackground="#334155", activeforeground=self.COLOR_CYAN,
                                             font=("Segoe UI", 9, "bold"), bd=1, relief=tk.FLAT, padx=10, pady=4,
                                             command=self.publish_telemetry_now)
        self.btn_force_telemetry.pack(side=tk.RIGHT, padx=12, pady=10)

        self.btn_sim_delta = tk.Button(top_bar, text="⚡ Inject Cloud Delta Test", bg="#1e293b", fg=self.COLOR_AMBER,
                                       activebackground="#334155", activeforeground="#ffffff",
                                       font=("Segoe UI", 9, "bold"), bd=1, relief=tk.FLAT, padx=10, pady=4,
                                       command=self._prompt_inject_delta)
        self.btn_sim_delta.pack(side=tk.RIGHT, padx=6, pady=10)

        self.lbl_top_net_badge = tk.Label(top_bar, text="● OFFLINE", bg="#2a1215", fg="#f87171",
                                          font=("Segoe UI", 9, "bold"), padx=10, pady=4)
        self.lbl_top_net_badge.pack(side=tk.RIGHT, padx=10)

        # 2. MAIN SPLIT CONTAINER
        main_container = tk.Frame(self.root, bg=self.BG_MAIN)
        main_container.pack(fill=tk.BOTH, expand=True, padx=12, pady=10)

        # Left Column: Physical Node (OLED, LEDs, Button, Relay)
        left_col = tk.Frame(main_container, bg=self.BG_PANEL, width=380, bd=1, relief=tk.RIDGE)
        left_col.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 6), pady=0)
        left_col.pack_propagate(False)
        self._build_physical_node_panel(left_col)

        # Right / Center Area: Environment Stimulator (Top) & Terminal Console (Bottom)
        right_container = tk.Frame(main_container, bg=self.BG_MAIN)
        right_container.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(6, 0), pady=0)

        # Environmental Sensors Controls Notebook
        top_right = tk.Frame(right_container, bg=self.BG_PANEL, bd=1, relief=tk.RIDGE)
        top_right.pack(side=tk.TOP, fill=tk.BOTH, expand=True, pady=(0, 6))
        self._build_stimulator_panel(top_right)

        # Terminal & MQTT Inspector
        bottom_right = tk.Frame(right_container, bg="#0d1217", height=240, bd=1, relief=tk.RIDGE)
        bottom_right.pack(side=tk.BOTTOM, fill=tk.BOTH, expand=False, pady=(6, 0))
        bottom_right.pack_propagate(False)
        self._build_console_panel(bottom_right)

    # --------------------------------------------------------------------------
    # LEFT PANEL: PHYSICAL NODE (OLED, LEDs, Push Button, Relay)
    # --------------------------------------------------------------------------
    def _build_physical_node_panel(self, parent):
        lbl = tk.Label(parent, text="PHYSICAL HARDWARE VIEW", bg=self.BG_PANEL, fg=self.COLOR_CYAN,
                       font=("Segoe UI", 11, "bold"), pady=8)
        lbl.pack(fill=tk.X)

        # --- OLED DISPLAY MODULE SIMULATOR ---
        oled_frame = tk.Frame(parent, bg="#0a0e14", bd=3, relief=tk.RIDGE)
        oled_frame.pack(fill=tk.X, padx=16, pady=6)

        oled_hdr = tk.Frame(oled_frame, bg="#0a0e14")
        oled_hdr.pack(fill=tk.X, padx=6, pady=(4, 2))
        tk.Label(oled_hdr, text="SSD1306 OLED (128x64 I2C)", bg="#0a0e14", fg="#64748b",
                 font=("Consolas", 8)).pack(side=tk.LEFT)
        self.lbl_oled_screen_num = tk.Label(oled_hdr, text="SCR 1/3", bg="#0a0e14", fg=self.COLOR_CYAN,
                                            font=("Consolas", 8, "bold"))
        self.lbl_oled_screen_num.pack(side=tk.RIGHT)

        # Canvas emulating glowing OLED
        self.oled_canvas = tk.Canvas(oled_frame, bg=self.BG_OLED, height=140, bd=0, highlightthickness=0)
        self.oled_canvas.pack(fill=tk.X, padx=8, pady=(0, 8))

        # --- TACTILE PUSH BUTTON (GPIO 32) ---
        btn_frame = tk.Frame(parent, bg=self.BG_PANEL)
        btn_frame.pack(fill=tk.X, padx=16, pady=8)

        self.btn_push = tk.Button(btn_frame, text="🔘 PUSH BUTTON (GPIO 32)\nCycle OLED Screen",
                                  bg="#2e3846", fg="#ffffff", activebackground="#1e2530", activeforeground=self.COLOR_CYAN,
                                  font=("Segoe UI", 10, "bold"), bd=2, relief=tk.RAISED, pady=6,
                                  command=self._on_physical_button_click)
        self.btn_push.pack(fill=tk.X)

        # --- PHYSICAL STATUS LEDs (GPIO 25, 26, 27) ---
        leds_card = tk.LabelFrame(parent, text=" Status LEDs ", bg=self.BG_PANEL, fg=self.FG_MUTED,
                                  font=("Segoe UI", 9), padx=10, pady=8)
        leds_card.pack(fill=tk.X, padx=16, pady=8)

        led_row = tk.Frame(leds_card, bg=self.BG_PANEL)
        led_row.pack(fill=tk.X)

        # LED 1: Mains OK
        self.canvas_led1 = tk.Canvas(led_row, width=28, height=28, bg=self.BG_PANEL, highlightthickness=0)
        self.canvas_led1.grid(row=0, column=0, padx=6)
        tk.Label(led_row, text="LED1 (G25)\nMains OK", bg=self.BG_PANEL, fg=self.FG_TEXT,
                 font=("Segoe UI", 8), justify=tk.CENTER).grid(row=1, column=0)

        # LED 2: Network / Cloud
        self.canvas_led2 = tk.Canvas(led_row, width=28, height=28, bg=self.BG_PANEL, highlightthickness=0)
        self.canvas_led2.grid(row=0, column=1, padx=16)
        tk.Label(led_row, text="LED2 (G26)\nNet / Cloud", bg=self.BG_PANEL, fg=self.FG_TEXT,
                 font=("Segoe UI", 8), justify=tk.CENTER).grid(row=1, column=1)

        # LED 3: Telemetry TX Flash
        self.canvas_led3 = tk.Canvas(led_row, width=28, height=28, bg=self.BG_PANEL, highlightthickness=0)
        self.canvas_led3.grid(row=0, column=2, padx=6)
        tk.Label(led_row, text="LED3 (G27)\nTx Flash", bg=self.BG_PANEL, fg=self.FG_TEXT,
                 font=("Segoe UI", 8), justify=tk.CENTER).grid(row=1, column=2)

        led_row.columnconfigure(0, weight=1)
        led_row.columnconfigure(1, weight=1)
        led_row.columnconfigure(2, weight=1)

        # --- OUTPUT RELAY ACTUATOR ---
        relay_card = tk.LabelFrame(parent, text=" Power Contactor / Relay ", bg=self.BG_PANEL, fg=self.FG_MUTED,
                                   font=("Segoe UI", 9), padx=10, pady=10)
        relay_card.pack(fill=tk.X, padx=16, pady=8)

        # Large Relay State Banner
        self.lbl_relay_banner = tk.Label(relay_card, text="RELAY OPEN (OFF)", bg="#2a1215", fg="#ef4444",
                                         font=("Segoe UI", 13, "bold"), pady=8, bd=1, relief=tk.SOLID)
        self.lbl_relay_banner.pack(fill=tk.X, pady=(0, 8))

        relay_meta_row = tk.Frame(relay_card, bg=self.BG_PANEL)
        relay_meta_row.pack(fill=tk.X, pady=2)
        self.lbl_relay_pin = tk.Label(relay_meta_row, text="Pin: GPIO 23", bg=self.BG_PANEL, fg="#94a3b8",
                                      font=("Consolas", 9))
        self.lbl_relay_pin.pack(side=tk.LEFT)

        # Toggle Relay Button (Manual Override)
        self.btn_relay_manual = tk.Button(relay_card, text="Toggle Relay (Manual Override)", bg="#232e3d",
                                          fg=self.FG_TEXT, activebackground="#334155",
                                          font=("Segoe UI", 9, "bold"), pady=4,
                                          command=self._toggle_relay_manual)
        self.btn_relay_manual.pack(fill=tk.X, pady=(6, 0))

        # --- HARDWARE SPECS / PIN MAP BANNER ---
        spec_box = tk.LabelFrame(parent, text=" Node Config & Specs ", bg=self.BG_PANEL, fg=self.FG_MUTED,
                                 font=("Segoe UI", 9), padx=8, pady=6)
        spec_box.pack(fill=tk.BOTH, expand=True, padx=16, pady=(8, 12))

        specs_text = (
            "• MCU: ESP-WROOM-32 (Dual Core)\n"
            "• Relay Pin: GPIO 23 (v3.0)\n"
            "• Battery ADC: GPIO 34 (Divider 4.0x)\n"
            "• Mains ADC: GPIO 35 (Threshold: 500)\n"
            "• Tilt Switch: GPIO 15 (Active LOW)\n"
            "• DHT11 Sensor: GPIO 4\n"
            "• Meter Modbus: RS485 on UART2 (16/17)\n"
            "• Bridge Mirror: UART1 (TX13 / RX12)\n"
            "• RTC: ESP32 SNTP Clock (IST +5:30)"
        )
        tk.Label(spec_box, text=specs_text, bg=self.BG_PANEL, fg="#94a3b8",
                 font=("Consolas", 8), justify=tk.LEFT).pack(anchor="w")

    # --------------------------------------------------------------------------
    # MIDDLE PANEL: ENVIRONMENTAL & SENSOR STIMULATOR
    # --------------------------------------------------------------------------
    def _build_stimulator_panel(self, parent):
        # Notebook for categorized controls
        nb = ttk.Notebook(parent)
        nb.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        # TAB 1: AC GRID & SCHNEIDER ENERGY METER
        tab_grid = tk.Frame(nb, bg=self.BG_CARD)
        nb.add(tab_grid, text=" ⚡ AC Grid & Schneider Meter ")
        self._build_grid_tab(tab_grid)

        # TAB 2: DC BATTERY & AMBIENT SENSORS
        tab_sensors = tk.Frame(nb, bg=self.BG_CARD)
        nb.add(tab_sensors, text=" 🔋 DC Battery, Mains & Tamper ")
        self._build_sensors_tab(tab_sensors)

        # TAB 3: AWS IOT & NETWORK SETTINGS
        tab_net = tk.Frame(nb, bg=self.BG_CARD)
        nb.add(tab_net, text=" ☁ AWS IoT & Shadow Config ")
        self._build_network_tab(tab_net)

    # --------------------------------------------------------------------------
    # TAB 1: AC GRID & SCHNEIDER METER
    # --------------------------------------------------------------------------
    def _build_grid_tab(self, parent):
        container = tk.Frame(parent, bg=self.BG_CARD, padx=14, pady=10)
        container.pack(fill=tk.BOTH, expand=True)

        # Quick Scenarios Row
        scn_frame = tk.Frame(container, bg=self.BG_CARD)
        scn_frame.pack(fill=tk.X, pady=(0, 10))
        tk.Label(scn_frame, text="Quick Presets:", bg=self.BG_CARD, fg=self.FG_MUTED,
                 font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=(0, 8))

        presets = [
            ("Normal (230V, 4.5A)", lambda: self._apply_grid_preset(230.0, 4.5, 50.0, 0.96)),
            ("Heavy Load (225V, 15A)", lambda: self._apply_grid_preset(225.0, 15.0, 49.9, 0.98)),
            ("Voltage Sag (185V)", lambda: self._apply_grid_preset(185.0, 3.0, 49.8, 0.92)),
            ("Grid Surge (255V)", lambda: self._apply_grid_preset(255.0, 4.0, 50.1, 0.95)),
            ("Zero Load (0A)", lambda: self._apply_grid_preset(230.0, 0.0, 50.0, 1.0)),
        ]
        for name, cmd in presets:
            tk.Button(scn_frame, text=name, bg="#1e2633", fg=self.FG_TEXT, activebackground="#334155",
                      font=("Segoe UI", 8), padx=6, pady=2, command=cmd).pack(side=tk.LEFT, padx=3)

        # Grid Sliders
        # 1. Grid Voltage (R3027 / R3035)
        self.slider_v = self._create_slider_control(
            container, "Phase 1 / Avg Grid Voltage (R3027 / R3035)",
            val_min=0.0, val_max=300.0, default=self.state.grid_voltage, unit=" V",
            command=self._on_voltage_change
        )

        # 2. Load Current (R3009)
        self.slider_i = self._create_slider_control(
            container, "Load Current (R3009)",
            val_min=0.0, val_max=30.0, default=self.state.load_current, unit=" A",
            command=self._on_current_change
        )

        # 3. Grid Frequency (R3109)
        self.slider_freq = self._create_slider_control(
            container, "Grid Frequency (R3109)",
            val_min=45.0, val_max=55.0, default=self.state.grid_freq, unit=" Hz",
            command=self._on_freq_change
        )

        # 4. Power Factor (R3053 / R3059)
        self.slider_pf = self._create_slider_control(
            container, "Total Power Factor (R3053 / R3059)",
            val_min=0.50, val_max=1.00, default=self.state.power_factor, unit="",
            command=self._on_pf_change
        )

        # Live Real Power & Options Row
        bottom_row = tk.Frame(container, bg=self.BG_CARD)
        bottom_row.pack(fill=tk.X, pady=(10, 0))

        # Real-time computed power badge
        self.lbl_power_calc = tk.Label(bottom_row, text="Active Power (R3083): 938.8 W (0.94 kW)",
                                       bg="#172230", fg=self.COLOR_GREEN, font=("Consolas", 10, "bold"),
                                       padx=12, pady=6, bd=1, relief=tk.SOLID)
        self.lbl_power_calc.pack(side=tk.LEFT)

        # Checkboxes for realistic grid simulation
        self.var_auto_zero = tk.BooleanVar(value=True)
        chk_zero = tk.Checkbutton(bottom_row, text="Auto Zero Current when Relay is OFF",
                                  variable=self.var_auto_zero, bg=self.BG_CARD, fg=self.FG_TEXT,
                                  selectcolor="#0f172a", activebackground=self.BG_CARD,
                                  command=self._on_toggle_auto_zero)
        chk_zero.pack(side=tk.RIGHT, padx=8)

        self.var_jitter = tk.BooleanVar(value=True)
        chk_jit = tk.Checkbutton(bottom_row, text="Live Grid Jitter (Noise)",
                                 variable=self.var_jitter, bg=self.BG_CARD, fg=self.FG_TEXT,
                                 selectcolor="#0f172a", activebackground=self.BG_CARD,
                                 command=self._on_toggle_jitter)
        chk_jit.pack(side=tk.RIGHT, padx=8)

    # --------------------------------------------------------------------------
    # TAB 2: DC BATTERY, MAINS & TAMPER
    # --------------------------------------------------------------------------
    def _build_sensors_tab(self, parent):
        container = tk.Frame(parent, bg=self.BG_CARD, padx=14, pady=10)
        container.pack(fill=tk.BOTH, expand=True)

        # 1. Battery Voltage
        self.slider_bat = self._create_slider_control(
            container, "Backup Battery Voltage (ADC GPIO 34)",
            val_min=0.0, val_max=15.0, default=self.state.battery_voltage, unit=" V",
            command=self._on_battery_change
        )

        # 2. Mains AC Sensor Raw ADC
        self.slider_mains = self._create_slider_control(
            container, "Mains Line Sensor Raw ADC (GPIO 35) [Threshold > 500 = OK]",
            val_min=0, val_max=4095, default=self.state.mains_raw, unit=" (raw)",
            command=self._on_mains_raw_change
        )

        # 3. DHT11 Temperature
        self.slider_temp = self._create_slider_control(
            container, "Ambient Temperature (DHT11 GPIO 4)",
            val_min=-10.0, val_max=60.0, default=self.state.temperature, unit=" °C",
            command=self._on_temp_change
        )

        # Tamper & Fault Status Row
        tamper_box = tk.LabelFrame(container, text=" Tilt Tamper & Security (GPIO 15) ", bg=self.BG_CARD,
                                   fg=self.FG_MUTED, font=("Segoe UI", 9), padx=12, pady=10)
        tamper_box.pack(fill=tk.X, pady=(12, 0))

        self.var_tilt = tk.IntVar(value=1)  # 1 = Safe, 0 = Tilted
        rb_safe = tk.Radiobutton(tamper_box, text="Normal Upright (Safe - Pole Mounted)", variable=self.var_tilt,
                                 value=1, bg=self.BG_CARD, fg=self.COLOR_GREEN, selectcolor="#0f172a",
                                 activebackground=self.BG_CARD, font=("Segoe UI", 9, "bold"),
                                 command=self._on_tilt_change)
        rb_safe.pack(side=tk.LEFT, padx=10)

        rb_tilt = tk.Radiobutton(tamper_box, text="TILTED / TAMPER DETECTED (Alarm Triggered)", variable=self.var_tilt,
                                 value=0, bg=self.BG_CARD, fg=self.COLOR_RED, selectcolor="#0f172a",
                                 activebackground=self.BG_CARD, font=("Segoe UI", 9, "bold"),
                                 command=self._on_tilt_change)
        rb_tilt.pack(side=tk.LEFT, padx=10)

    # --------------------------------------------------------------------------
    # TAB 3: AWS IOT & NETWORK SETTINGS
    # --------------------------------------------------------------------------
    def _build_network_tab(self, parent):
        container = tk.Frame(parent, bg=self.BG_CARD, padx=14, pady=10)
        container.pack(fill=tk.BOTH, expand=True)

        grid_frame = tk.Frame(container, bg=self.BG_CARD)
        grid_frame.pack(fill=tk.X, pady=(0, 10))

        # Endpoint
        tk.Label(grid_frame, text="AWS IoT Endpoint:", bg=self.BG_CARD, fg=self.FG_MUTED,
                 font=("Segoe UI", 9, "bold")).grid(row=0, column=0, sticky="w", pady=4)
        self.ent_endpoint = tk.Entry(grid_frame, bg="#121820", fg=self.FG_TEXT, insertbackground=self.COLOR_CYAN,
                                     font=("Consolas", 9), width=50)
        self.ent_endpoint.insert(0, DEFAULT_AWS_ENDPOINT)
        self.ent_endpoint.grid(row=0, column=1, sticky="ew", padx=8, pady=4)

        # Client ID / Thing Name
        tk.Label(grid_frame, text="Thing Name / Client ID:", bg=self.BG_CARD, fg=self.FG_MUTED,
                 font=("Segoe UI", 9, "bold")).grid(row=1, column=0, sticky="w", pady=4)
        self.ent_client_id = tk.Entry(grid_frame, bg="#121820", fg=self.FG_TEXT, insertbackground=self.COLOR_CYAN,
                                      font=("Consolas", 9), width=50)
        self.ent_client_id.insert(0, DEFAULT_CLIENT_ID)
        self.ent_client_id.grid(row=1, column=1, sticky="ew", padx=8, pady=4)

        # Publish Interval
        tk.Label(grid_frame, text="Publish Interval (s):", bg=self.BG_CARD, fg=self.FG_MUTED,
                 font=("Segoe UI", 9, "bold")).grid(row=2, column=0, sticky="w", pady=4)
        self.ent_interval = tk.Entry(grid_frame, bg="#121820", fg=self.FG_TEXT, insertbackground=self.COLOR_CYAN,
                                     font=("Consolas", 9), width=10)
        self.ent_interval.insert(0, str(DEFAULT_PUBLISH_INTERVAL))
        self.ent_interval.grid(row=2, column=1, sticky="w", padx=8, pady=4)

        grid_frame.columnconfigure(1, weight=1)

        # Cert Paths Display
        cert_box = tk.LabelFrame(container, text=" TLS Credentials ", bg=self.BG_CARD, fg=self.FG_MUTED,
                                 font=("Segoe UI", 9), padx=10, pady=8)
        cert_box.pack(fill=tk.X, pady=8)

        self.lbl_cert_status = tk.Label(cert_box, text=f"CA: {os.path.basename(self.cert_ca) if self.cert_ca else 'MISSING'}\n"
                                                      f"Cert: {os.path.basename(self.cert_crt) if self.cert_crt else 'MISSING'}\n"
                                                      f"Key: {os.path.basename(self.cert_key) if self.cert_key else 'MISSING'}",
                                        bg=self.BG_CARD, fg="#94a3b8", font=("Consolas", 8), justify=tk.LEFT)
        self.lbl_cert_status.pack(side=tk.LEFT)

        btn_browse_cert = tk.Button(cert_box, text="📁 Select Certs Folder", bg="#1e2633", fg=self.FG_TEXT,
                                    font=("Segoe UI", 8), padx=8, pady=4, command=self._browse_credentials_folder)
        btn_browse_cert.pack(side=tk.RIGHT, padx=6)

        # Connect / Mode Buttons
        conn_row = tk.Frame(container, bg=self.BG_CARD)
        conn_row.pack(fill=tk.X, pady=(12, 0))

        self.btn_connect = tk.Button(conn_row, text="🔌 Connect to AWS IoT Core (Real TLS)", bg="#065f46",
                                     fg="#ffffff", activebackground="#047857", font=("Segoe UI", 10, "bold"),
                                     padx=14, pady=6, command=self._toggle_aws_connection)
        self.btn_connect.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_mock_mode = tk.Button(conn_row, text="🔄 Enable Mock Loopback Mode (Offline)", bg="#1e293b",
                                       fg=self.COLOR_CYAN, activebackground="#334155", font=("Segoe UI", 10, "bold"),
                                       padx=14, pady=6, command=self._toggle_mock_mode)
        self.btn_mock_mode.pack(side=tk.LEFT)

    # --------------------------------------------------------------------------
    # BOTTOM PANEL: SERIAL TERMINAL CONSOLE
    # --------------------------------------------------------------------------
    def _build_console_panel(self, parent):
        hdr = tk.Frame(parent, bg="#0d1217", height=32)
        hdr.pack(fill=tk.X, side=tk.TOP, padx=8, pady=(4, 2))

        tk.Label(hdr, text="SERIAL CONSOLE (UART 115200) / TELEMETRY BUS", bg="#0d1217", fg=self.COLOR_CYAN,
                 font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT)

        btn_clear = tk.Button(hdr, text="Clear", bg="#1e2633", fg=self.FG_MUTED, font=("Segoe UI", 8),
                              bd=0, padx=8, pady=1, command=self._clear_console)
        btn_clear.pack(side=tk.RIGHT, padx=4)

        self.var_autoscroll = tk.BooleanVar(value=True)
        chk_scroll = tk.Checkbutton(hdr, text="Auto-Scroll", variable=self.var_autoscroll, bg="#0d1217",
                                    fg=self.FG_MUTED, selectcolor="#1e2633", font=("Segoe UI", 8))
        chk_scroll.pack(side=tk.RIGHT, padx=8)

        # Text Console
        txt_frame = tk.Frame(parent, bg="#0d1217")
        txt_frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 6))

        scroll = tk.Scrollbar(txt_frame)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.txt_console = tk.Text(txt_frame, bg="#080c10", fg="#cbd5e1", insertbackground="#38bdf8",
                                   font=("Consolas", 9), yscrollcommand=scroll.set, bd=0)
        self.txt_console.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.config(command=self.txt_console.yview)

        # Tags for colored console log output
        self.txt_console.tag_config("SYS", foreground="#38bdf8")
        self.txt_console.tag_config("MQTT", foreground="#4ade80")
        self.txt_console.tag_config("SHADOW", foreground="#fbbf24")
        self.txt_console.tag_config("GPIO", foreground="#c084fc")
        self.txt_console.tag_config("WARN", foreground="#f87171")
        self.txt_console.tag_config("PAYLOAD", foreground="#94a3b8")

    # --------------------------------------------------------------------------
    # HELPER: SLIDER CONTROL CREATOR
    # --------------------------------------------------------------------------
    def _create_slider_control(self, parent, label_text, val_min, val_max, default, unit, command):
        frame = tk.Frame(parent, bg=self.BG_CARD)
        frame.pack(fill=tk.X, pady=4)

        header = tk.Frame(frame, bg=self.BG_CARD)
        header.pack(fill=tk.X)

        tk.Label(header, text=label_text, bg=self.BG_CARD, fg=self.FG_TEXT,
                 font=("Segoe UI", 9)).pack(side=tk.LEFT)

        is_int = isinstance(default, int) and isinstance(val_min, int) and isinstance(val_max, int)
        fmt = "{:d}" if is_int else "{:.2f}"
        lbl_val = tk.Label(header, text=fmt.format(default) + unit, bg=self.BG_CARD,
                           fg=self.COLOR_CYAN, font=("Consolas", 9, "bold"))
        lbl_val.pack(side=tk.RIGHT)

        def _on_move(val):
            num = int(float(val)) if is_int else round(float(val), 2)
            lbl_val.config(text=fmt.format(num) + unit)
            command(num)

        slider = ttk.Scale(frame, from_=val_min, to=val_max, value=default, command=_on_move)
        slider.pack(fill=tk.X, pady=(2, 4))
        return slider

    # --------------------------------------------------------------------------
    # SERIAL LOGGING HELPER
    # --------------------------------------------------------------------------
    def log_serial(self, msg, tag="SYS"):
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        line = f"[{ts}] [{tag}] {msg}\n"

        self.txt_console.insert(tk.END, line, tag)
        if self.var_autoscroll.get():
            self.txt_console.see(tk.END)

    def _clear_console(self):
        self.txt_console.delete("1.0", tk.END)

    # --------------------------------------------------------------------------
    # EVENT HANDLERS (SLIDERS & PHYSICAL BUTTONS)
    # --------------------------------------------------------------------------
    def _on_physical_button_click(self):
        """GPIO 32 tactile button handler."""
        self.state.current_screen = (self.state.current_screen + 1) % self.state.num_screens
        self.state.last_screen_switch = time.time()
        self.log_serial(f"GPIO 32 Tactile Button Pressed -> Switched OLED Screen to {self.state.current_screen}", "GPIO")
        self._render_oled()

    def _toggle_relay_manual(self):
        """Manual contactor toggle."""
        new_state = not self.state.relay_state
        self._apply_relay_state(new_state, source="Manual Override Switch")

    def _apply_relay_state(self, state_bool, source="Local"):
        self.state.relay_state = state_bool
        self.log_serial(f"Relay GPIO {self.state.relay_pin} switched to: {'ON' if state_bool else 'OFF'} ({source})", "GPIO")

        # Update visual banner
        if state_bool:
            self.lbl_relay_banner.config(text="RELAY CLOSED (ON - ENERGIZED)", bg="#064e3b", fg=self.COLOR_GREEN)
        else:
            self.lbl_relay_banner.config(text="RELAY OPEN (OFF - DISCONNECTED)", bg="#2a1215", fg=self.COLOR_RED)

        # Update power calc & OLED
        self._update_power_label()
        self._render_oled()

        # If connected to AWS IoT, publish updated shadow reported state
        if self.is_connected or self.is_loopback_mode:
            self.publish_shadow_reported()

    def _apply_grid_preset(self, v, i, freq, pf):
        self.state.grid_voltage = v
        self.state.load_current = i
        self.state.grid_freq = freq
        self.state.power_factor = pf

        self.slider_v.set(v)
        self.slider_i.set(i)
        self.slider_freq.set(freq)
        self.slider_pf.set(pf)

        self._update_power_label()
        self.log_serial(f"Applied Grid Preset: {v}V, {i}A, {freq}Hz, {pf} PF", "SYS")

    def _on_voltage_change(self, val):
        self.state.grid_voltage = float(val)
        self._update_power_label()

    def _on_current_change(self, val):
        self.state.load_current = float(val)
        self._update_power_label()

    def _on_freq_change(self, val):
        self.state.grid_freq = float(val)

    def _on_pf_change(self, val):
        self.state.power_factor = float(val)
        self._update_power_label()

    def _on_battery_change(self, val):
        self.state.battery_voltage = float(val)

    def _on_mains_raw_change(self, val):
        self.state.mains_raw = int(val)
        self._update_leds()

    def _on_temp_change(self, val):
        self.state.temperature = float(val)

    def _on_tilt_change(self):
        val = self.var_tilt.get()
        self.state.tilt_switch = val
        if val == 0:
            self.state.fault_code = 1
            self.log_serial("WARNING: Tilt / Tamper Switch Triggered (GPIO 15 LOW)!", "WARN")
        else:
            self.state.fault_code = 0
            self.log_serial("Tilt Sensor normalized to Safe Mounted Position.", "GPIO")

    def _on_toggle_auto_zero(self):
        self.state.auto_zero_current_on_relay_off = self.var_auto_zero.get()
        self._update_power_label()

    def _on_toggle_jitter(self):
        self.state.jitter_noise = self.var_jitter.get()

    def _update_power_label(self):
        p_w = self.state.get_active_power_w()
        p_kw = p_w / 1000.0
        eff_i = self.state.get_effective_current()
        self.lbl_power_calc.config(
            text=f"Active Power (R3083): {p_w:.1f} W ({p_kw:.2f} kW) | Effective Current: {eff_i:.2f} A"
        )

    # --------------------------------------------------------------------------
    # OLED RENDERING ENGINE
    # --------------------------------------------------------------------------
    def _render_oled(self):
        c = self.oled_canvas
        c.delete("all")
        w = c.winfo_width() or 340
        h = c.winfo_height() or 140

        # Background frame
        c.create_rectangle(0, 0, w, h, fill=self.BG_OLED, outline="")

        now_str = datetime.now().strftime("%H:%M:%S")
        uptime_sec = int(time.time() - self.state.boot_timestamp)
        h_up = uptime_sec // 3600
        m_up = (uptime_sec % 3600) // 60
        s_up = uptime_sec % 60

        scr = self.state.current_screen
        self.lbl_oled_screen_num.config(text=f"SCR {scr + 1}/3")

        cyan = self.COLOR_CYAN
        white = "#ffffff"
        font_hdr = ("Consolas", 10, "bold")
        font_txt = ("Consolas", 9)

        if scr == 0:
            # Screen 0: SYSTEM & NETWORK
            c.create_text(10, 10, anchor="nw", text=f"--- SYSTEM {self.state.firmware_version} ---", fill=cyan, font=font_hdr)
            c.create_text(10, 32, anchor="nw", text=f"TIME: {now_str} (NTP)", fill=white, font=font_txt)

            wifi_stat = "Connected (Airtel)"
            c.create_text(10, 52, anchor="nw", text=f"WiFi: {wifi_stat}", fill="#38bdf8", font=font_txt)

            mqtt_stat = "Connected" if (self.is_connected or self.is_loopback_mode) else "Offline"
            c.create_text(10, 72, anchor="nw", text=f"MQTT: {mqtt_stat}", fill="#4ade80" if "Conn" in mqtt_stat else "#f87171", font=font_txt)

            relay_str = "ON" if self.state.relay_state else "OFF"
            c.create_text(10, 92, anchor="nw", text=f"Relay(G{self.state.relay_pin}): [{relay_str}]",
                          fill="#4ade80" if relay_str == "ON" else "#f87171", font=("Consolas", 10, "bold"))

            c.create_text(10, 114, anchor="nw", text=f"UPTIME: {h_up:02d}h {m_up:02d}m {s_up:02d}s", fill="#94a3b8", font=font_txt)

        elif scr == 1:
            # Screen 1: SENSORS & HEALTH
            c.create_text(10, 10, anchor="nw", text="--- SENSORS & HEALTH ---", fill=cyan, font=font_hdr)
            c.create_text(10, 32, anchor="nw", text=f"Temp: {self.state.temperature:.1f} C (DHT11)", fill=white, font=font_txt)
            c.create_text(10, 52, anchor="nw", text=f"Bat:  {self.state.battery_voltage:.2f} V (ADC34)", fill=white, font=font_txt)

            mains_stat = "ON" if self.state.is_mains_ok() else "OFF"
            c.create_text(10, 72, anchor="nw", text=f"Mains: {self.state.mains_raw} ({mains_stat})", fill=white, font=font_txt)

            tilt_stat = "Safe" if self.state.tilt_switch == 1 else "! TILTED !"
            c.create_text(10, 92, anchor="nw", text=f"Tilt: {tilt_stat}",
                          fill="#4ade80" if self.state.tilt_switch == 1 else "#ef4444", font=font_txt)

            c.create_text(10, 114, anchor="nw", text=f"Fault Code: {self.state.fault_code}", fill="#94a3b8", font=font_txt)

        elif scr == 2:
            # Screen 2: MODBUS SCHNEIDER
            c.create_text(10, 10, anchor="nw", text="--- SCHNEIDER MODBUS ---", fill=cyan, font=font_hdr)
            eff_i = self.state.get_effective_current()
            p_w = self.state.get_active_power_w()

            c.create_text(10, 32, anchor="nw", text=f"R3027 (V_Ph1): {self.state.grid_voltage:.1f} V", fill=white, font=font_txt)
            c.create_text(10, 52, anchor="nw", text=f"R3009 (I_Avg): {eff_i:.2f} A", fill=white, font=font_txt)
            c.create_text(10, 72, anchor="nw", text=f"R3109 (Freq ): {self.state.grid_freq:.2f} Hz", fill=white, font=font_txt)
            c.create_text(10, 92, anchor="nw", text=f"R3053 (PF   ): {self.state.power_factor:.2f}", fill=white, font=font_txt)
            c.create_text(10, 114, anchor="nw", text=f"R3083 (Power): {p_w:.1f} W", fill=cyan, font=("Consolas", 9, "bold"))

    # --------------------------------------------------------------------------
    # PHYSICAL LED GRAPHICS RENDERER
    # --------------------------------------------------------------------------
    def _draw_led_circle(self, canvas, is_on, on_color, off_color):
        canvas.delete("all")
        color = on_color if is_on else off_color
        glow = on_color if is_on else "#0a0e14"

        # Subtle glow ring
        if is_on:
            canvas.create_oval(1, 1, 27, 27, fill="", outline=glow, width=2)
            canvas.create_oval(4, 4, 24, 24, fill=color, outline="#ffffff", width=1)
        else:
            canvas.create_oval(5, 5, 23, 23, fill=color, outline="#334155", width=1)

    def _update_leds(self):
        # LED 1: Mains OK (mainsRaw > 500)
        self._draw_led_circle(self.canvas_led1, self.state.is_mains_ok(), self.COLOR_GREEN, "#14331e")

        # LED 2: Network Activity (WiFi & MQTT Connected)
        net_on = self.is_connected or self.is_loopback_mode
        self._draw_led_circle(self.canvas_led2, net_on, self.COLOR_BLUE, "#14213d")

        # LED 3: Telemetry Tx Flash
        self._draw_led_circle(self.canvas_led3, self.state.led3_tx_flash, self.COLOR_AMBER, "#30230f")

    def _flash_tx_led(self):
        self.state.led3_tx_flash = True
        self._update_leds()

        def _turn_off():
            self.state.led3_tx_flash = False
            self._update_leds()

        self.root.after(250, _turn_off)

    # --------------------------------------------------------------------------
    # MAIN SIMULATION TICK LOOP (EVERY 200 ms)
    # --------------------------------------------------------------------------
    def _sim_loop(self):
        # 1. Update clock
        now = datetime.now()
        self.lbl_header_clock.config(text=now.strftime("%H:%M:%S IST"))

        # 2. Apply grid jitter if enabled
        if random.random() < 0.2:
            self.state.apply_jitter()
            self._update_power_label()

        # 3. Handle Auto Screen Switch (every 5 seconds)
        if self.state.auto_switch_screens:
            if time.time() - self.state.last_screen_switch >= self.state.screen_switch_interval:
                self.state.current_screen = (self.state.current_screen + 1) % self.state.num_screens
                self.state.last_screen_switch = time.time()

        # 4. Check RTC Auto-On / Auto-Off Schedule
        current_minute = now.hour * 60 + now.minute
        if current_minute != self.state.last_schedule_check_minute:
            self.state.last_schedule_check_minute = current_minute
            self._check_auto_schedule(now)

        # 5. Handle Periodic Telemetry Publishing
        try:
            interval = float(self.ent_interval.get())
        except ValueError:
            interval = DEFAULT_PUBLISH_INTERVAL

        if (self.is_connected or self.is_loopback_mode) and self.auto_publish_active:
            if time.time() - self.state.last_publish_time >= interval:
                self.publish_telemetry_now()

        # 6. Re-render OLED & LEDs
        self._render_oled()
        self._update_leds()

        # Schedule next tick
        self.root.after(200, self._sim_loop)

    # --------------------------------------------------------------------------
    # RTC AUTO-SCHEDULE LOGIC
    # --------------------------------------------------------------------------
    def _check_auto_schedule(self, now):
        now_time_str = now.strftime("%H:%M")
        if now_time_str == self.state.auto_on_time and not self.state.relay_state:
            self.log_serial(f"RTC Auto-ON Schedule Triggered ({now_time_str}) -> Turning Relay ON", "GPIO")
            self._apply_relay_state(True, source="RTC Auto Schedule")

        elif now_time_str == self.state.auto_off_time and self.state.relay_state:
            self.log_serial(f"RTC Auto-OFF Schedule Triggered ({now_time_str}) -> Turning Relay OFF", "GPIO")
            self._apply_relay_state(False, source="RTC Auto Schedule")

    # --------------------------------------------------------------------------
    # AWS IOT MQTT COMMUNICATION
    # --------------------------------------------------------------------------
    def _browse_credentials_folder(self):
        folder = filedialog.askdirectory(title="Select AWS IoT Credentials Folder")
        if folder:
            files = os.listdir(folder)
            ca = next((f for f in files if "AmazonRootCA" in f and f.endswith(".pem")), None)
            crt = next((f for f in files if f.endswith(".crt") or f.endswith(".pem.crt")), None)
            key = next((f for f in files if "private" in f and f.endswith(".key")), None)

            if ca and crt and key:
                self.cert_ca = os.path.join(folder, ca)
                self.cert_crt = os.path.join(folder, crt)
                self.cert_key = os.path.join(folder, key)
                self.lbl_cert_status.config(
                    text=f"CA: {os.path.basename(self.cert_ca)}\nCert: {os.path.basename(self.cert_crt)}\nKey: {os.path.basename(self.cert_key)}"
                )
                self.log_serial(f"Loaded credentials from: {folder}", "NET")
            else:
                messagebox.showwarning("Incomplete Certs", "Could not find CA .pem, .crt, and private .key in selected folder.")

    def _toggle_mock_mode(self):
        if self.is_connected:
            self._disconnect_aws()

        self.is_loopback_mode = not self.is_loopback_mode
        if self.is_loopback_mode:
            self.lbl_top_net_badge.config(text="● MOCK LOOPBACK", bg="#1e3a5f", fg=self.COLOR_CYAN)
            self.btn_mock_mode.config(text="Disable Mock Loopback", bg="#b91c1c", fg="#ffffff")
            self.log_serial("=== MOCK LOOPBACK MODE ACTIVE ===", "SYS")
            self.log_serial("Device will simulate telemetry & shadow locally without AWS IoT.", "SYS")
        else:
            self.lbl_top_net_badge.config(text="● OFFLINE", bg="#2a1215", fg="#f87171")
            self.btn_mock_mode.config(text="🔄 Enable Mock Loopback Mode (Offline)", bg="#1e293b", fg=self.COLOR_CYAN)
            self.log_serial("Mock Loopback Disabled. System Offline.", "SYS")

    def _toggle_aws_connection(self):
        if self.is_connected:
            self._disconnect_aws()
        else:
            self._connect_aws()

    def _connect_aws(self):
        if not MQTT_AVAILABLE:
            messagebox.showerror("Dependency Error", "paho-mqtt is required for AWS IoT connection.")
            return

        if not (self.cert_ca and self.cert_crt and self.cert_key):
            messagebox.showerror("Missing Certs", "Please select valid AWS Root CA, Device Cert, and Private Key.")
            return

        endpoint = self.ent_endpoint.get().strip()
        client_id = self.ent_client_id.get().strip()
        self.state.device_id = client_id

        self.log_serial(f"Attempting MQTT connection to AWS IoT: {endpoint}:8883 (Client: {client_id})...", "MQTT")
        self.btn_connect.config(text="Connecting...", bg="#ca8a04")

        def _worker():
            try:
                # Support both paho-mqtt v2 and v1
                try:
                    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
                except AttributeError:
                    client = mqtt.Client(client_id=client_id)

                client.on_connect = self._on_mqtt_connect
                client.on_disconnect = self._on_mqtt_disconnect
                client.on_message = self._on_mqtt_message

                client.tls_set(
                    ca_certs=self.cert_ca,
                    certfile=self.cert_crt,
                    keyfile=self.cert_key,
                    tls_version=ssl.PROTOCOL_TLSv1_2
                )

                client.connect(endpoint, DEFAULT_AWS_PORT, keepalive=60)
                client.loop_start()
                self.mqtt_client = client

            except Exception as e:
                self.root.after(0, lambda: self._on_connect_failed(str(e)))

        self.mqtt_thread = threading.Thread(target=_worker, daemon=True)
        self.mqtt_thread.start()

    def _disconnect_aws(self):
        if self.mqtt_client:
            try:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
            except Exception:
                pass
            self.mqtt_client = None

        self.is_connected = False
        self.lbl_top_net_badge.config(text="● OFFLINE", bg="#2a1215", fg="#f87171")
        self.btn_connect.config(text="🔌 Connect to AWS IoT Core (Real TLS)", bg="#065f46")
        self.log_serial("Disconnected from AWS IoT Core.", "MQTT")

    def _on_mqtt_connect(self, client, userdata, flags, rc, props=None):
        if rc == 0:
            self.is_connected = True
            self.root.after(0, self._on_connect_success)
        else:
            self.root.after(0, lambda: self._on_connect_failed(f"Return code {rc}"))

    def _on_connect_success(self):
        client_id = self.state.device_id
        self.lbl_top_net_badge.config(text=f"● ONLINE ({client_id})", bg="#064e3b", fg=self.COLOR_GREEN)
        self.btn_connect.config(text="Disconnect from AWS IoT", bg="#b91c1c")
        self.log_serial("MQTT Connected Successfully to AWS IoT Core!", "MQTT")

        # Subscriptions
        delta_topic = f"$aws/things/{client_id}/shadow/update/delta"
        update_accepted_topic = f"$aws/things/{client_id}/shadow/update/accepted"

        self.mqtt_client.subscribe(delta_topic, qos=1)
        self.log_serial(f"Subscribed to Shadow Delta: {delta_topic}", "MQTT")

        self.mqtt_client.subscribe(update_accepted_topic, qos=1)
        self.log_serial(f"Subscribed to Shadow Accepted: {update_accepted_topic}", "MQTT")

        # Initial Shadow Sync
        self.publish_shadow_reported()

    def _on_connect_failed(self, error_str):
        self.is_connected = False
        self.lbl_top_net_badge.config(text="● FAILED", bg="#7f1d1d", fg="#fca5a5")
        self.btn_connect.config(text="🔌 Connect to AWS IoT Core (Real TLS)", bg="#065f46")
        self.log_serial(f"MQTT Connection Failed: {error_str}", "WARN")

    def _on_mqtt_disconnect(self, client, userdata, flags=None, rc=0, props=None):
        self.is_connected = False
        self.root.after(0, lambda: self.log_serial(f"MQTT Disconnected (rc={rc})", "WARN"))
        self.root.after(0, lambda: self.lbl_top_net_badge.config(text="● OFFLINE", bg="#2a1215", fg="#f87171"))
        self.root.after(0, lambda: self.btn_connect.config(text="🔌 Connect to AWS IoT Core (Real TLS)", bg="#065f46"))

    def _on_mqtt_message(self, client, userdata, msg):
        """Handler for incoming AWS IoT Shadow updates & deltas."""
        try:
            topic = msg.topic
            payload_str = msg.payload.decode("utf-8")
            data = json.loads(payload_str)

            self.root.after(0, lambda: self._process_incoming_shadow(topic, data))
        except Exception as e:
            self.root.after(0, lambda: self.log_serial(f"Error parsing incoming MQTT payload: {e}", "WARN"))

    # --------------------------------------------------------------------------
    # SHADOW DELTA COMMAND PARSER (MATCHES FIRMWARE BEHAVIOR)
    # --------------------------------------------------------------------------
    def _process_incoming_shadow(self, topic, data):
        self.log_serial(f"INCOMING MESSAGE on {topic}:", "SHADOW")
        self.log_serial(json.dumps(data, indent=2), "PAYLOAD")

        state = data.get("state", {})
        # If wrapped under desired (like update topic), unwrap it
        desired = state.get("desired", state)

        state_changed = False

        # 1. PARSE RELAY COMMAND (desired.relay_state or desired.relayState)
        if "relay_state" in desired:
            val = desired["relay_state"]
            new_relay = (val is True or str(val).upper() in ["ON", "TRUE", "1"])
            self.log_serial(f"TACTICAL ALERT: Remote Relay Command received: {val}", "SHADOW")
            self._apply_relay_state(new_relay, source="AWS IoT Shadow Delta")
            state_changed = True
        elif "relayState" in desired:
            val = desired["relayState"]
            new_relay = (val is True or str(val).upper() in ["ON", "TRUE", "1"])
            self.log_serial(f"TACTICAL ALERT: Remote Relay Command received: {val}", "SHADOW")
            self._apply_relay_state(new_relay, source="AWS IoT Shadow Delta")
            state_changed = True

        # 2. PARSE RTC SCHEDULE (timeToAutoTurnOn / timeToAutoTurnOff)
        if "timeToAutoTurnOn" in desired:
            self.state.auto_on_time = str(desired["timeToAutoTurnOn"])
            self.log_serial(f"New Auto-ON Schedule Locked: {self.state.auto_on_time}", "SHADOW")
            state_changed = True
        elif "time_to_auto_turn_on" in desired:
            self.state.auto_on_time = str(desired["time_to_auto_turn_on"])
            self.log_serial(f"New Auto-ON Schedule Locked: {self.state.auto_on_time}", "SHADOW")
            state_changed = True

        if "timeToAutoTurnOff" in desired:
            self.state.auto_off_time = str(desired["timeToAutoTurnOff"])
            self.log_serial(f"New Auto-OFF Schedule Locked: {self.state.auto_off_time}", "SHADOW")
            state_changed = True
        elif "time_to_auto_turn_off" in desired:
            self.state.auto_off_time = str(desired["time_to_auto_turn_off"])
            self.log_serial(f"New Auto-OFF Schedule Locked: {self.state.auto_off_time}", "SHADOW")
            state_changed = True

        # 3. PARSE DEVICE STATE OVERRIDE
        if "device_state" in desired or "deviceState" in desired:
            new_ds = str(desired.get("device_state") or desired.get("deviceState"))
            self.state.device_state = new_ds
            self.log_serial(f"Device Status Override: {new_ds}", "SHADOW")
            state_changed = True

        # If any state was accepted, clear delta by reporting back state
        if state_changed:
            self.publish_shadow_reported()

    # --------------------------------------------------------------------------
    # TELEMETRY & SHADOW PUBLISHING
    # --------------------------------------------------------------------------
    def publish_telemetry_now(self):
        """Dispatches telemetry packet matching firmware schema."""
        self.state.last_publish_time = time.time()
        client_id = self.state.device_id
        telemetry_topic = f"meter/telemetry/{client_id}"

        doc = self.state.generate_telemetry_payload()
        payload_str = json.dumps(doc)

        self._flash_tx_led()

        self.log_serial(f"=== MQTT DATA PUBLISHED ({telemetry_topic}) ===", "MQTT")
        self.log_serial(payload_str, "PAYLOAD")

        if self.is_connected and self.mqtt_client:
            try:
                self.mqtt_client.publish(telemetry_topic, payload_str, qos=1)
            except Exception as e:
                self.log_serial(f"Publish failed: {e}", "WARN")

    def publish_shadow_reported(self):
        """Syncs current state to Device Shadow reported state."""
        client_id = self.state.device_id
        shadow_topic = f"$aws/things/{client_id}/shadow/update"

        doc = self.state.generate_shadow_reported_payload()
        payload_str = json.dumps(doc)

        self.log_serial(f"=== SHADOW UPDATE PUBLISHED ({shadow_topic}) ===", "SHADOW")
        self.log_serial(payload_str, "PAYLOAD")

        if self.is_connected and self.mqtt_client:
            try:
                self.mqtt_client.publish(shadow_topic, payload_str, qos=1)
            except Exception as e:
                self.log_serial(f"Shadow update failed: {e}", "WARN")

    # --------------------------------------------------------------------------
    # LOCAL CLOUD DELTA INJECTION (FOR TESTING)
    # --------------------------------------------------------------------------
    def _prompt_inject_delta(self):
        """Popup dialog to test Shadow Delta reception locally."""
        dlg = tk.Toplevel(self.root)
        dlg.title("Simulate Cloud Command (Inject Delta)")
        dlg.geometry("450x380")
        dlg.configure(bg=self.BG_PANEL)
        dlg.transient(self.root)
        dlg.grab_set()

        tk.Label(dlg, text="Inject Desired State (Simulate Lambda/Portal)", bg=self.BG_PANEL, fg=self.COLOR_CYAN,
                 font=("Segoe UI", 11, "bold")).pack(pady=10)

        # Relay Command
        rf = tk.Frame(dlg, bg=self.BG_PANEL)
        rf.pack(fill=tk.X, padx=20, pady=6)
        tk.Label(rf, text="Desired Relay State:", bg=self.BG_PANEL, fg=self.FG_TEXT).pack(side=tk.LEFT)
        var_r = tk.StringVar(value="ON" if not self.state.relay_state else "OFF")
        tk.Radiobutton(rf, text="ON", variable=var_r, value="ON", bg=self.BG_PANEL, fg=self.COLOR_GREEN,
                       selectcolor="#0f172a").pack(side=tk.LEFT, padx=10)
        tk.Radiobutton(rf, text="OFF", variable=var_r, value="OFF", bg=self.BG_PANEL, fg=self.COLOR_RED,
                       selectcolor="#0f172a").pack(side=tk.LEFT, padx=10)

        # Auto On Time
        on_f = tk.Frame(dlg, bg=self.BG_PANEL)
        on_f.pack(fill=tk.X, padx=20, pady=6)
        tk.Label(on_f, text="timeToAutoTurnOn:", bg=self.BG_PANEL, fg=self.FG_TEXT).pack(side=tk.LEFT)
        ent_on = tk.Entry(on_f, bg="#0d1217", fg=self.FG_TEXT, insertbackground=self.COLOR_CYAN, width=10)
        ent_on.insert(0, self.state.auto_on_time)
        ent_on.pack(side=tk.RIGHT)

        # Auto Off Time
        off_f = tk.Frame(dlg, bg=self.BG_PANEL)
        off_f.pack(fill=tk.X, padx=20, pady=6)
        tk.Label(off_f, text="timeToAutoTurnOff:", bg=self.BG_PANEL, fg=self.FG_TEXT).pack(side=tk.LEFT)
        ent_off = tk.Entry(off_f, bg="#0d1217", fg=self.FG_TEXT, insertbackground=self.COLOR_CYAN, width=10)
        ent_off.insert(0, self.state.auto_off_time)
        ent_off.pack(side=tk.RIGHT)

        def _do_inject():
            mock_payload = {
                "version": int(time.time()),
                "timestamp": int(time.time()),
                "state": {
                    "desired": {
                        "relay_state": (var_r.get() == "ON"),
                        "timeToAutoTurnOn": ent_on.get().strip(),
                        "timeToAutoTurnOff": ent_off.get().strip(),
                    }
                }
            }
            dlg.destroy()
            self._process_incoming_shadow("$aws/things/Meter_001/shadow/update/delta", mock_payload)

        btn_send = tk.Button(dlg, text="⚡ Send Delta Command to Digital Node", bg="#0284c7", fg="#ffffff",
                             font=("Segoe UI", 10, "bold"), pady=8, command=_do_inject)
        btn_send.pack(fill=tk.X, padx=20, pady=20)


# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================
def main():
    root = tk.Tk()
    app = HardwareCloneApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
