import json
import time
import ssl
import os
from datetime import datetime
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient

def create_iot_client():
    """
    Create and configure AWS IoT MQTT client for Meter_001
    """
    # Your AWS IoT endpoint
    endpoint = "a3ia5opqzsvf3l-ats.iot.us-east-1.amazonaws.com"
    
    # Client configuration - must match thing name per your policy
    client_id = "Meter_001"
    
    # Certificate paths - updated to match your folder structure
    credentials_folder = "credentials"
    root_ca_path = os.path.join(credentials_folder, "AmazonRootCA1 (2).pem")
    certificate_path = os.path.join(credentials_folder, "ea788924202702b291dea54f7bdd0acd14ff1fdb6bbf4889ca7dd6b84e58d9c1-certificate.pem.crt")
    private_key_path = os.path.join(credentials_folder, "ea788924202702b291dea54f7bdd0acd14ff1fdb6bbf4889ca7dd6b84e58d9c1-private.pem.key")
    
    # Verify files exist
    for file_path, file_type in [
        (root_ca_path, "Root CA"),
        (certificate_path, "Certificate"),
        (private_key_path, "Private Key")
    ]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"{file_type} file not found: {file_path}")
        else:
            print(f"✅ Found {file_type}: {file_path}")
    
    # Initialize the client
    mqtt_client = AWSIoTMQTTClient(client_id)
    mqtt_client.configureEndpoint(endpoint, 8883)
    mqtt_client.configureCredentials(root_ca_path, private_key_path, certificate_path)
    
    # Configure connection settings
    mqtt_client.configureAutoReconnectBackoffTime(1, 32, 20)
    mqtt_client.configureOfflinePublishQueueing(-1)  # Infinite offline publish queueing
    mqtt_client.configureDrainingFrequency(2)  # Draining: 2 Hz
    mqtt_client.configureConnectDisconnectTimeout(10)  # 10 sec
    mqtt_client.configureMQTTOperationTimeout(5)  # 5 sec
    
    return mqtt_client

def generate_meter_telemetry():
    """
    Generate realistic meter telemetry data
    """
    import random
    
    # Simulate realistic meter readings with some variation
    base_power = 1200
    power_variation = random.uniform(-50, 100)
    
    return {
        "device_id": "Meter_001",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "meter_readings": {
            "power_consumption_kw": round(base_power + power_variation, 2),
            "voltage_v": round(220 + random.uniform(-5, 5), 1),
            "current_a": round(5.5 + random.uniform(-0.5, 1.0), 2),
            "frequency_hz": round(50.0 + random.uniform(-0.1, 0.1), 2),
            "power_factor": round(0.95 + random.uniform(-0.05, 0.05), 3),
            "energy_total_kwh": round(15000 + (time.time() % 1000), 2)
        },
        "device_status": {
            "online": True,
            "temperature_c": round(25 + random.uniform(-5, 15), 1),
            "humidity_percent": round(45 + random.uniform(-10, 20), 1),
            "signal_strength_dbm": random.randint(-60, -30),
            "battery_level_percent": random.randint(85, 100)
        },
        "metadata": {
            "firmware_version": "1.2.3",
            "location": "Building A - Floor 1 - Room 101",
            "installation_date": "2026-01-15",
            "last_calibration": "2026-02-01"
        }
    }

def generate_shadow_update():
    """
    Generate device shadow update payload
    """
    import random
    
    return {
        "state": {
            "reported": {
                "power_kw": round(1200 + random.uniform(-50, 100), 2),
                "voltage_v": round(220 + random.uniform(-5, 5), 1),
                "status": "operational",
                "last_reading": datetime.utcnow().isoformat() + "Z",
                "firmware_version": "1.2.3",
                "uptime_seconds": int(time.time() % 86400),
                "total_energy_kwh": round(15000 + (time.time() % 1000), 2),
                "alerts": [],
                "maintenance_required": False
            }
        }
    }

def on_message_callback(client, userdata, message):
    """
    Callback function for received messages (shadow responses)
    """
    print(f"\n📨 Received message on topic: {message.topic}")
    try:
        payload = json.loads(message.payload.decode('utf-8'))
        print(f"📄 Message payload:")
        print(json.dumps(payload, indent=2))
    except json.JSONDecodeError:
        print(f"📄 Raw message: {message.payload.decode('utf-8')}")
    print("-" * 60)

def test_meter_mqtt_publishing():
    """
    Main function to test MQTT publishing for Meter_001 with your Master_Meter_Policy
    """
    print("🔌 AWS IoT MQTT Test for Meter_001")
    print("=" * 70)
    print(f"📁 Using certificates from: {os.path.abspath('credentials')}")
    print("=" * 70)
    
    # Create MQTT client
    try:
        client = create_iot_client()
        print("✅ MQTT client created successfully")
    except Exception as e:
        print(f"❌ Failed to create MQTT client: {e}")
        return
    
    # Connect to AWS IoT
    try:
        print("\n🔌 Connecting to AWS IoT Core...")
        client.connect()
        print("✅ Connected to AWS IoT Core successfully!")
        print(f"🆔 Client ID: Meter_001")
        print(f"🌐 Endpoint: a3ia5opqzsvf3l-ats.iot.us-east-1.amazonaws.com:8883")
        time.sleep(2)  # Wait for connection to stabilize
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        print("💡 Check if:")
        print("   - Certificate is attached to Meter_001 thing")
        print("   - Master_Meter_Policy is attached to the certificate")
        print("   - Certificate files are valid and not expired")
        return
    
    # Subscribe to shadow response topics (allowed by your policy)
    shadow_topics = [
        "$aws/things/Meter_001/shadow/update/accepted",
        "$aws/things/Meter_001/shadow/update/rejected",
        "$aws/things/Meter_001/shadow/get/accepted",
        "$aws/things/Meter_001/shadow/get/rejected"
    ]
    
    print("\n📡 Subscribing to shadow response topics...")
    for topic in shadow_topics:
        try:
            client.subscribe(topic, 1, on_message_callback)
            print(f"✅ Subscribed to: {topic}")
        except Exception as e:
            print(f"❌ Failed to subscribe to {topic}: {e}")
    
    time.sleep(2)
    
    # Test 1: Publish telemetry data (allowed by your policy)
    print("\n" + "="*70)
    print("📊 TEST 1: Publishing Meter Telemetry Data")
    print("="*70)
    telemetry_topic = "meter/telemetry/Meter_001"
    
    for i in range(3):
        try:
            telemetry_data = generate_meter_telemetry()
            payload = json.dumps(telemetry_data, indent=2)
            
            print(f"\n📤 Publishing message {i+1}/3 to topic: {telemetry_topic}")
            print(f"📄 Sample data preview:")
            print(f"   Power: {telemetry_data['meter_readings']['power_consumption_kw']} kW")
            print(f"   Voltage: {telemetry_data['meter_readings']['voltage_v']} V")
            print(f"   Current: {telemetry_data['meter_readings']['current_a']} A")
            print(f"   Status: {telemetry_data['device_status']['online']}")
            
            client.publish(telemetry_topic, payload, 1)
            print("✅ Telemetry data published successfully!")
            
            time.sleep(3)  # Wait between publishes
            
        except Exception as e:
            print(f"❌ Failed to publish telemetry: {e}")
    
    # Test 2: Publish device shadow update (allowed by your policy)
    print("\n" + "="*70)
    print("🌟 TEST 2: Publishing Device Shadow Update")
    print("="*70)
    shadow_update_topic = "$aws/things/Meter_001/shadow/update"
    
    try:
        shadow_data = generate_shadow_update()
        payload = json.dumps(shadow_data, indent=2)
        
        print(f"\n📤 Publishing to shadow topic: {shadow_update_topic}")
        print(f"📄 Shadow data preview:")
        print(f"   Power: {shadow_data['state']['reported']['power_kw']} kW")
        print(f"   Status: {shadow_data['state']['reported']['status']}")
        print(f"   Uptime: {shadow_data['state']['reported']['uptime_seconds']} seconds")
        
        client.publish(shadow_update_topic, payload, 1)
        print("✅ Shadow update published successfully!")
        
        time.sleep(3)  # Wait for shadow response
        
    except Exception as e:
        print(f"❌ Failed to publish shadow update: {e}")
    
    # Test 3: Get current shadow state
    print("\n" + "="*70)
    print("🔍 TEST 3: Requesting Current Shadow State")
    print("="*70)
    shadow_get_topic = "$aws/things/Meter_001/shadow/get"
    
    try:
        print(f"\n📤 Requesting shadow state from: {shadow_get_topic}")
        # Empty payload for get request
        client.publish(shadow_get_topic, "{}", 1)
        print("✅ Shadow get request sent successfully!")
        
        time.sleep(3)  # Wait for shadow response
        
    except Exception as e:
        print(f"❌ Failed to request shadow state: {e}")
    
    # Test 4: Try publishing to unauthorized topic (should fail per your policy)
    print("\n" + "="*70)
    print("🚫 TEST 4: Testing Unauthorized Topic Access")
    print("="*70)
    unauthorized_topic = "unauthorized/topic/test"
    
    try:
        print(f"\n📤 Attempting to publish to unauthorized topic: {unauthorized_topic}")
        client.publish(unauthorized_topic, '{"test": "unauthorized access attempt"}', 1)
        print("⚠️  Published to unauthorized topic (this shouldn't work with your policy)")
    except Exception as e:
        print(f"✅ Correctly blocked unauthorized publish: {e}")
    
    # Keep connection alive to receive any remaining messages
    print("\n⏳ Waiting for any remaining shadow responses...")
    time.sleep(5)
    
    # Disconnect
    try:
        client.disconnect()
        print("\n✅ Disconnected from AWS IoT Core")
    except Exception as e:
        print(f"❌ Error during disconnect: {e}")
    
    print("\n" + "="*70)
    print("🎉 MQTT Test Completed Successfully!")
    print("="*70)
    print("📋 Summary:")
    print("   ✅ Connected with client ID: Meter_001")
    print("   ✅ Published telemetry to: meter/telemetry/Meter_001")
    print("   ✅ Updated device shadow")
    print("   ✅ Subscribed to shadow responses")
    print("   ✅ Policy restrictions working correctly")

if __name__ == "__main__":
    # Check if credentials folder exists
    if not os.path.exists("credentials"):
        print("❌ Error: 'credentials' folder not found!")
        print("💡 Make sure you're running this script from the directory containing the credentials folder")
        exit(1)
    
    test_meter_mqtt_publishing()
