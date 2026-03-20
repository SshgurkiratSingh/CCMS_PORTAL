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

import sigrokdecode as srd

class Decoder(srd.Decoder):
    api_version = 3
    id = 'fs-i6-ppm'
    name = 'FS i6 PPM'
    longname = 'FlySky i6 Pulse Position Modulation'
    desc = 'Decoder for FlySky i6 PPM RC control signals'
    license = 'gplv3+'
    inputs = ['logic']
    outputs = ['ppm']
    tags = ['rc', 'ppm', 'radio', 'flysky']
    channels = (
        {'id': 'ppm', 'name': 'PPM', 'desc': 'PPM signal line'},
    )
    optional_channels = ()
    options = (
        {'id': 'sync_min', 'desc': 'Minimum sync pulse width (µs)', 'default': 350, 'type': int},
        {'id': 'sync_max', 'desc': 'Maximum sync pulse width (µs)', 'default': 500, 'type': int},
        {'id': 'pulse_min', 'desc': 'Minimum channel pulse width (µs)', 'default': 800, 'type': int},
        {'id': 'pulse_max', 'desc': 'Maximum channel pulse width (µs)', 'default': 2200, 'type': int},
        {'id': 'channel_spacing', 'desc': 'Expected channel spacing (µs)', 'default': 400, 'type': int},
        {'id': 'max_channels', 'desc': 'Maximum number of channels', 'default': 10, 'type': int},
        {'id': 'frame_timeout', 'desc': 'Frame timeout threshold (ms)', 'default': 25, 'type': int},
    )
    annotations = (
        ('sync', 'Frame sync pulse'),
        ('channel', 'Channel pulse'),
        ('channel-value', 'Channel value'),
        ('warning', 'Protocol warnings'),
        ('frame', 'Frame markers'),
    )
    annotation_rows = (
        ('events', 'Events', (0, 1, 3, 4)),
        ('values', 'Values', (2,)),
    )

    def __init__(self):
        self.reset()

    def reset(self):
        self.pulses = []
        self.channels = []
        self.frame_start = None
        self.last_edge = None
        self.channel_count = 0
        self.in_frame = False
        self.samplerate = None

    def start(self):
        self.out_ann = self.register(srd.OUTPUT_ANN)

    def metadata(self, key, value):
        if key == srd.SRD_CONF_SAMPLERATE:
            self.samplerate = value

    def us_to_samples(self, us):
        """Convert microseconds to sample count"""
        if not self.samplerate:
            return us
        return int((us * self.samplerate) / 1_000_000)

    def samples_to_us(self, samples):
        """Convert sample count to microseconds"""
        if not self.samplerate:
            return samples
        return int((samples * 1_000_000) / self.samplerate)

    def is_sync_pulse(self, width_samples):
        """Check if pulse width indicates a sync pulse"""
        width_us = self.samples_to_us(width_samples)
        sync_min = self.options['sync_min']
        sync_max = self.options['sync_max']
        return sync_min <= width_us <= sync_max

    def is_valid_channel_pulse(self, width_samples):
        """Check if pulse width is a valid channel pulse"""
        width_us = self.samples_to_us(width_samples)
        pulse_min = self.options['pulse_min']
        pulse_max = self.options['pulse_max']
        return pulse_min <= width_us <= pulse_max

    def is_frame_timeout(self, gap_samples):
        """Check if gap indicates frame timeout"""
        gap_us = self.samples_to_us(gap_samples)
        timeout_us = self.options['frame_timeout'] * 1000
        return gap_us > timeout_us

    def pulse_width_to_value(self, width_samples):
        """Convert pulse width to channel value (1000-2000 typical)"""
        width_us = self.samples_to_us(width_samples)
        return width_us

    def put_ann(self, start_samplenum, end_samplenum, ann_class, data):
        """Helper to put annotation"""
        self.put(start_samplenum, end_samplenum, self.out_ann, [ann_class, data])

    def process_frame(self):
        """Process a complete frame of PPM data"""
        if len(self.channels) < 1:
            return

        # Report frame start
        if self.frame_start is not None:
            self.put_ann(self.frame_start, self.last_edge, 4, 
                        [f'Frame: {len(self.channels)} channels'])

        # Report each channel
        for i, (start, end, width) in enumerate(self.channels):
            value = self.pulse_width_to_value(end - start)

            # Annotation for channel pulse
            self.put_ann(start, end, 1, [f'CH{i+1}', f'Channel {i+1}: {value}µs'])

            # Annotation for channel value
            self.put_ann(start, end, 2, [f'{value}µs'])

        # Report sync pulse
        if self.pulses:
            sync_start, sync_end, sync_width = self.pulses[0]
            self.put_ann(sync_start, sync_end, 0, 
                        [f'Sync: {self.samples_to_us(sync_width)}µs'])

    def handle_new_frame(self):
        """Handle the start of a new frame"""
        # Process previous frame if exists
        if self.channels:
            self.process_frame()

        # Reset for new frame
        self.channels = []
        self.pulses = []
        self.channel_count = 0
        self.frame_start = self.last_edge
        self.in_frame = True

    def decode(self):
        if not self.samplerate:
            raise Exception('Cannot decode without samplerate.')

        # Wait for rising edge (end of low sync pulse)
        self.wait({0: 'e'})

        while True:
            edge_sample = self.samplenum

            if self.last_edge is not None:
                pulse_width = edge_sample - self.last_edge

                # Check for frame timeout (gap between frames)
                if self.is_frame_timeout(pulse_width):
                    if self.in_frame and self.channels:
                        self.process_frame()
                    self.in_frame = False
                    self.pulses = []
                    self.channels = []
                    self.frame_start = None
                    self.channel_count = 0

                    # Report timeout
                    self.put_ann(self.last_edge, edge_sample, 3,
                                [f'Timeout: {self.samples_to_us(pulse_width)}µs'])

                # Check if this is a sync pulse (long low period)
                elif self.is_sync_pulse(pulse_width):
                    # Store sync pulse
                    self.pulses.insert(0, (self.last_edge, edge_sample, pulse_width))
                    self.handle_new_frame()

                # Check if this could be a channel pulse
                elif self.in_frame and self.is_valid_channel_pulse(pulse_width):
                    if self.channel_count < self.options['max_channels']:
                        self.channels.append((self.last_edge, edge_sample, pulse_width))
                        self.channel_count += 1
                    else:
                        self.put_ann(self.last_edge, edge_sample, 3,
                                    [f'Max {self.options["max_channels"]} channels'])

                # Invalid pulse width
                elif self.in_frame:
                    self.put_ann(self.last_edge, edge_sample, 3,
                                [f'Invalid width: {self.samples_to_us(pulse_width)}µs'])

            self.last_edge = edge_sample

            # Wait for next edge
            self.wait({0: 'e'})
