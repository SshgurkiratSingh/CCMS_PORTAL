# FS i6 PPM Decoder for PulseView/Sigrok

Decoder for FlySky i6 PPM (Pulse Position Modulation) RC control signals.

## Installation

### Option 1: User installation (recommended)

```bash
# Copy decoder to user directory
cp -r decoders/fs-i6-ppm ~/.local/share/sigrok/decoders/

# Set environment variable (add to ~/.bashrc for persistence)
export SIGROKDECODE_DIR=~/.local/share/sigrok/decoders

# Start PulseView
pulseview
```

### Option 2: System-wide installation (requires root)

```bash
sudo cp -r decoders/fs-i6-ppm /usr/share/libsigrokdecode/decoders/
```

## Usage in PulseView

1. Capture PPM signal with a logic analyzer
2. Add decoder → Select "FS i6 PPM"
3. Assign the PPM signal channel
4. Adjust options if needed

## Protocol Details

### PPM Signal Characteristics

- **Sync Pulse**: 350-500µs (marks frame start)
- **Channel Pulses**: 800-2200µs (1000-2000µs typical range)
- **Channel Spacing**: ~400µs between pulse starts
- **Frame Period**: ~22.5ms
- **Channels**: 6-10 (FS i6 typically uses 6-10 channels)

### Pulse Width Mapping

| Pulse Width | Throttle/Control |
|-------------|------------------|
| 1000µs      | Minimum (0%)     |
| 1500µs      | Neutral (50%)    |
| 2000µs      | Maximum (100%)   |

## Decoder Options

| Option | Default | Description |
|--------|---------|-------------|
| `sync_min` | 350 | Minimum sync pulse width (µs) |
| `sync_max` | 500 | Maximum sync pulse width (µs) |
| `pulse_min` | 800 | Minimum channel pulse width (µs) |
| `pulse_max` | 2200 | Maximum channel pulse width (µs) |
| `channel_spacing` | 400 | Expected channel spacing (µs) |
| `max_channels` | 10 | Maximum channels to decode |
| `frame_timeout` | 25 | Frame timeout threshold (ms) |

## Wiring

Connect your PPM signal from the RC receiver to the logic analyzer:

```
FS i6 Receiver → Logic Analyzer
    PPM OUT     →    Channel 0
    GND         →    GND
```

## Annotations

- **Sync**: Frame synchronization pulse
- **Channel**: Individual channel pulses
- **Channel Value**: Pulse width in microseconds
- **Warning**: Invalid pulses or protocol errors
- **Frame**: Frame boundaries

## License

GPL-3.0 or later
