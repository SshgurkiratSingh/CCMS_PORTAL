import json
import time
import random
import ssl
import socket
import paho.mqtt.client as mqtt

# AWS IoT Config
ENDPOINT  = "a3ia5opqzsvf3l-ats.iot.us-east-1.amazonaws.com"
PORT      = 8883
CLIENT_ID = "Meter_001"
TOPIC     = f"meter/telemetry/{CLIENT_ID}"

CA_CERT   = "credentials/AmazonRootCA1 (2).pem"
CERT_FILE = "credentials/ea788924202702b291dea54f7bdd0acd14ff1fdb6bbf4889ca7dd6b84e58d9c1-certificate.pem.crt"
KEY_FILE  = "credentials/ea788924202702b291dea54f7bdd0acd14ff1fdb6bbf4889ca7dd6b84e58d9c1-private.pem.key"

REGISTERS = [3009, 3011, 3027, 3035, 3055, 3059, 3061, 3085, 3109,
             3053, 3057, 3063, 3083, 3107, 3059, 3059, 3107]

# Force IPv4 resolution
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_getaddrinfo(host, port, family=0, *args, **kwargs):
    return _orig_getaddrinfo(host, port, socket.AF_INET, *args, **kwargs)
socket.getaddrinfo = _ipv4_getaddrinfo

def sample_payload():
    doc = {"timestamp": int(time.time() * 1000), "swap_mode": "big"}
    for reg in REGISTERS:
        doc[f"R{reg}"] = round(random.uniform(0.0, 500.0), 4)
    return json.dumps(doc)

def on_connect(client, userdata, flags, rc, props=None):
    print("Connected" if rc == 0 else f"Failed rc={rc}")

def on_publish(client, userdata, mid, rc=None, props=None):
    print(f"Published mid={mid}")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=CLIENT_ID)
client.on_connect = on_connect
client.on_publish = on_publish
client.connect_timeout = 10
client.tls_set(ca_certs=CA_CERT, certfile=CERT_FILE, keyfile=KEY_FILE)
client.connect(ENDPOINT, PORT, keepalive=60)
client.loop_start()

try:
    time.sleep(3)  # wait for connection
    while True:
        payload = sample_payload()
        client.publish(TOPIC, payload, qos=1)
        print(f"Topic: {TOPIC}\nPayload: {payload}\n")
        time.sleep(5)
except KeyboardInterrupt:
    pass
finally:
    client.loop_stop()
    client.disconnect()
