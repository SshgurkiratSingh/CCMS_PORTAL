#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <PubSubClient.h>

extern PubSubClient mqttClient;

void setupMQTT();
void handleMQTTConnection();
void publishMqttData();

#endif
