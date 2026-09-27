import os
import time
import json
import logging
from dotenv import load_dotenv
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
from stm_communicator import STMCommunicator

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# AWS IoT Configuration
AWS_IOT_ENDPOINT = os.getenv("AWS_IOT_ENDPOINT")
CLIENT_ID = os.getenv("CLIENT_ID", "CCMS_RPi_Gateway_01")
PATH_TO_CERT = os.getenv("PATH_TO_CERT", "certs/certificate.pem.crt")
PATH_TO_KEY = os.getenv("PATH_TO_KEY", "certs/private.pem.key")
PATH_TO_ROOT_CA = os.getenv("PATH_TO_ROOT_CA", "certs/AmazonRootCA1.pem")
TELEMETRY_TOPIC = f"ccms/telemetry/{CLIENT_ID}"
SHADOW_UPDATE_TOPIC = f"$aws/things/{CLIENT_ID}/shadow/update"
SHADOW_DELTA_TOPIC = f"$aws/things/{CLIENT_ID}/shadow/update/delta"

stm = STMCommunicator(port="/dev/serial0", baudrate=115200)
mqtt_client = None

def customShadowCallback_Delta(client, userdata, message):
    logger.info(f"Received shadow delta: {message.payload}")
    try:
        payload = json.loads(message.payload.decode("utf-8"))
        state = payload.get("state", {})
        
        if "relay_state" in state:
            relay_state = state["relay_state"]
            logger.info(f"Commanding STM to set relay to {relay_state}")
            stm.send_command("relay", 1 if relay_state else 0)
            
    except json.JSONDecodeError:
        logger.error("Failed to parse shadow delta JSON")
    except Exception as e:
        logger.error(f"Error processing shadow delta: {e}")

def setup_mqtt():
    global mqtt_client
    mqtt_client = AWSIoTMQTTClient(CLIENT_ID)
    mqtt_client.configureEndpoint(AWS_IOT_ENDPOINT, 8883)
    mqtt_client.configureCredentials(PATH_TO_ROOT_CA, PATH_TO_KEY, PATH_TO_CERT)
    
    # Configure connection settings
    mqtt_client.configureAutoReconnectBackoffTime(1, 32, 20)
    mqtt_client.configureOfflinePublishQueueing(-1)
    mqtt_client.configureDrainingFrequency(2)
    mqtt_client.configureConnectDisconnectTimeout(10)
    mqtt_client.configureMQTTOperationTimeout(5)
    
    logger.info("Connecting to AWS IoT...")
    mqtt_client.connect()
    logger.info("Connected!")
    
    # Subscribe to shadow delta
    mqtt_client.subscribe(SHADOW_DELTA_TOPIC, 1, customShadowCallback_Delta)
    logger.info(f"Subscribed to {SHADOW_DELTA_TOPIC}")

def main():
    logger.info("Starting RPi Gateway Service...")
    
    if not stm.connect():
        logger.error("Could not connect to STM32. Exiting.")
        return
        
    try:
        setup_mqtt()
    except Exception as e:
        logger.error(f"Failed to setup AWS IoT MQTT: {e}")
        stm.close()
        return

    try:
        while True:
            # Poll for telemetry from STM32
            telemetry = stm.read_telemetry()
            
            if telemetry:
                logger.info(f"Received telemetry from STM: {telemetry}")
                # Publish to AWS IoT Core
                message_json = json.dumps(telemetry)
                mqtt_client.publish(TELEMETRY_TOPIC, message_json, 1)
                logger.debug(f"Published telemetry to {TELEMETRY_TOPIC}")
                
            # Sleep briefly to yield CPU
            time.sleep(0.1)
            
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        if mqtt_client:
            mqtt_client.disconnect()
        stm.close()

if __name__ == "__main__":
    main()
