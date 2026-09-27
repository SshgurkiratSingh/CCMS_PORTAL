import serial
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class STMCommunicator:
    def __init__(self, port: str = "/dev/serial0", baudrate: int = 115200):
        self.port = port
        self.baudrate = baudrate
        self.ser = None

    def connect(self) -> bool:
        try:
            self.ser = serial.Serial(self.port, self.baudrate, timeout=1)
            logger.info(f"Connected to STM on {self.port} at {self.baudrate} baud")
            return True
        except serial.SerialException as e:
            logger.error(f"Failed to connect to STM: {e}")
            return False

    def send_command(self, command: str, value: Any) -> bool:
        """Sends a JSON command to the STM via UART."""
        if not self.ser or not self.ser.is_open:
            logger.error("Serial port is not open")
            return False
            
        payload = json.dumps({"cmd": command, "val": value}) + "\n"
        try:
            self.ser.write(payload.encode('utf-8'))
            logger.debug(f"Sent: {payload.strip()}")
            return True
        except Exception as e:
            logger.error(f"Error sending command: {e}")
            return False

    def read_telemetry(self) -> Optional[Dict[str, Any]]:
        """Reads a line of telemetry from STM via UART and parses JSON."""
        if not self.ser or not self.ser.is_open:
            return None
            
        if self.ser.in_waiting > 0:
            try:
                line = self.ser.readline().decode('utf-8').strip()
                if line:
                    logger.debug(f"Received: {line}")
                    return json.loads(line)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from STM: {line}")
            except Exception as e:
                logger.error(f"Error reading from STM: {e}")
                
        return None

    def close(self):
        if self.ser and self.ser.is_open:
            self.ser.close()
            logger.info("Closed serial connection to STM")
