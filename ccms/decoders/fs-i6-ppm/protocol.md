##
## This file is part of the sigrok project.
##
## Copyright (C) 2024 Gurkirat Singh
##
## This program is free software: you can redistribute it and/or modify
## it under the terms of the GNU General Public License as published by
## the Free Software Foundation, either version 3 of the License, or
## (at your option) any later version.
##
## This program is distributed in the hope that it will be useful,
## but WITHOUT ANY WARRANTY; without even the implied warranty of
## MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
## GNU General Public License for more details.
##
## You should have received a copy of the GNU General Public License
## along with this program.  If not, see <http://www.gnu.org/licenses/>.
##

# FS i6 PPM (Pulse Position Modulation) Decoder
# 
# Protocol description:
# - PPM is used in RC systems to transmit channel data
# - Frame starts with a long sync pulse (~400µs low)
# - Each channel is represented by a pulse width (1000-2000µs typical)
# - Channels are multiplexed in time with ~400µs spacing
# - FS i6 typically has 6-10 channels
# - Total frame period: ~22.5ms

id: fs-i6-ppm
name: FS i6 PPM
longname: FlySky i6 Pulse Position Modulation
desc: Decoder for FlySky i6 PPM RC control signals
inputformats: logic
outputformats: proto
tagline: FlySky i6 PPM decoder
tags: rc, ppm, radio, flysky

## Channel definitions
channels:
  - name: PPM
    type: logic
    desc: PPM signal line

## Decoder options
options:
  - id: sync_min
    desc: Minimum sync pulse width (µs)
    type: int
    default: 350
  - id: sync_max
    desc: Maximum sync pulse width (µs)
    type: int
    default: 500
  - id: pulse_min
    desc: Minimum channel pulse width (µs)
    type: int
    default: 800
  - id: pulse_max
    desc: Maximum channel pulse width (µs)
    type: int
    default: 2200
  - id: channel_spacing
    desc: Expected channel spacing (µs)
    type: int
    default: 400
  - id: max_channels
    desc: Maximum number of channels to decode
    type: int
    default: 10
  - id: frame_timeout
    desc: Frame timeout threshold (ms)
    type: int
    default: 25

## Annotation definitions
annotations:
  - tag: sync
    desc: Frame sync pulse
  - tag: channel
    desc: Channel pulse with value
  - tag: channel-value
    desc: Channel number and pulse width
  - tag: warning
    desc: Protocol warnings and errors
  - tag: frame
    desc: Frame markers

annotationrows:
  - id: events
    desc: Events
    annotations: [sync, channel, warning, frame]
  - id: values
    desc: Values
    annotations: [channel-value]

## Decoding logic
