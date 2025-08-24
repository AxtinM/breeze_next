/*
 * ESP32 Smart WiFi Portal Client
 * This code connects ESP devices to the Breeze portal system
 * 
 * Features:
 * - Auto WiFi connection with fallback AP mode
 * - MQTT communication with the server
 * - Device discovery and state management
 * - Remote control via MQTT commands
 * 
 * Dependencies:
 * - WiFi library
 * - PubSubClient library for MQTT
 * - ArduinoJson library
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <DNSServer.h>

// Configuration
const char* DEVICE_ID = "esp32-001";
const char* DEVICE_NAME = "Living Room Light";
const char* DEVICE_TYPE = "ESP32";
const char* FIRMWARE_VERSION = "1.0.0";

// WiFi credentials (can be configured via captive portal)
char wifi_ssid[32] = "YOUR_WIFI_SSID";
char wifi_password[64] = "YOUR_WIFI_PASSWORD";

// MQTT configuration
const char* MQTT_SERVER = "192.168.1.100"; // Your server IP
const int MQTT_PORT = 1883;

// Hardware pins
const int RELAY_PIN = 2;    // GPIO2 for relay control
const int LED_PIN = 4;      // GPIO4 for status LED
const int BUTTON_PIN = 0;   // GPIO0 for manual button

// Global objects
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
WebServer server(80);
DNSServer dnsServer;

// State variables
bool deviceState = false;
bool wifiConnected = false;
bool mqttConnected = false;
unsigned long lastHeartbeat = 0;
unsigned long lastButtonPress = 0;
bool buttonPressed = false;

// MQTT Topics
String TOPIC_DISCOVERY = "breeze/devices/" + String(DEVICE_ID) + "/discovery";
String TOPIC_STATUS = "breeze/devices/" + String(DEVICE_ID) + "/status";
String TOPIC_STATE = "breeze/devices/" + String(DEVICE_ID) + "/state";
String TOPIC_COMMAND = "breeze/devices/" + String(DEVICE_ID) + "/command/+";

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Breeze ESP32 Client...");
  
  // Initialize pins
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Set initial state
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize WiFi
  setupWiFi();
  
  // Initialize MQTT
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
}

void loop() {
  // Handle WiFi connection
  if (!wifiConnected) {
    handleCaptivePortal();
  } else {
    // Handle MQTT connection
    if (!mqttClient.connected()) {
      connectMQTT();
    } else {
      mqttClient.loop();
    }
    
    // Send periodic status updates
    if (millis() - lastHeartbeat > 30000) { // Every 30 seconds
      sendStatusUpdate();
      lastHeartbeat = millis();
    }
  }
  
  // Handle manual button press
  handleButton();
  
  // Update status LED
  updateStatusLED();
  
  delay(100);
}

void setupWiFi() {
  WiFi.begin(wifi_ssid, wifi_password);
  
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // Send discovery message
    sendDiscoveryMessage();
  } else {
    Serial.println();
    Serial.println("WiFi connection failed. Starting captive portal...");
    startCaptivePortal();
  }
}

void startCaptivePortal() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("BreezeSetup_" + String(DEVICE_ID));
  
  dnsServer.start(53, "*", WiFi.softAPIP());
  
  server.on("/", handleCaptivePortalRoot);
  server.on("/connect", handleWiFiConnect);
  server.onNotFound(handleCaptivePortalRoot);
  
  server.begin();
  Serial.println("Captive portal started");
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());
}

void handleCaptivePortal() {
  dnsServer.processNextRequest();
  server.handleClient();
}

void handleCaptivePortalRoot() {
  String html = R"(
<!DOCTYPE html>
<html>
<head>
    <title>Breeze WiFi Setup</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        input { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; background: #007bff; color: white; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .info { background: #e7f3ff; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Breeze Device Setup</h1>
        <div class="info">
            <strong>Device:</strong> )" + String(DEVICE_NAME) + R"(<br>
            <strong>Type:</strong> )" + String(DEVICE_TYPE) + R"(<br>
            <strong>ID:</strong> )" + String(DEVICE_ID) + R"(
        </div>
        <form action="/connect" method="post">
            <input type="text" name="ssid" placeholder="WiFi Network Name" required>
            <input type="password" name="password" placeholder="WiFi Password" required>
            <button type="submit">Connect</button>
        </form>
    </div>
</body>
</html>
)";
  server.send(200, "text/html", html);
}

void handleWiFiConnect() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");
  
  ssid.toCharArray(wifi_ssid, sizeof(wifi_ssid));
  password.toCharArray(wifi_password, sizeof(wifi_password));
  
  server.send(200, "text/html", 
    "<html><body><h1>Connecting...</h1><p>Device will restart and connect to: " + ssid + "</p></body></html>");
  
  delay(2000);
  ESP.restart();
}

void connectMQTT() {
  if (mqttClient.connect(DEVICE_ID)) {
    Serial.println("MQTT connected");
    mqttConnected = true;
    
    // Subscribe to command topic
    String commandTopic = "breeze/devices/" + String(DEVICE_ID) + "/command/+";
    mqttClient.subscribe(commandTopic.c_str());
    
    // Send discovery message
    sendDiscoveryMessage();
    sendStatusUpdate();
  } else {
    Serial.print("MQTT connection failed, rc=");
    Serial.println(mqttClient.state());
    mqttConnected = false;
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("Received MQTT message on topic: " + String(topic));
  Serial.println("Message: " + message);
  
  // Parse topic to get command
  String topicStr = String(topic);
  int lastSlash = topicStr.lastIndexOf('/');
  if (lastSlash == -1) return;
  
  String command = topicStr.substring(lastSlash + 1);
  
  if (command == "set_state") {
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, message);
    
    String state = doc["state"];
    if (state == "on") {
      setDeviceState(true);
    } else if (state == "off") {
      setDeviceState(false);
    }
  }
}

void sendDiscoveryMessage() {
  if (!mqttConnected) return;
  
  DynamicJsonDocument doc(1024);
  doc["id"] = DEVICE_ID;
  doc["name"] = DEVICE_NAME;
  doc["type"] = DEVICE_TYPE;
  doc["firmware"] = FIRMWARE_VERSION;
  doc["ip"] = WiFi.localIP().toString();
  doc["mac"] = WiFi.macAddress();
  doc["state"] = deviceState ? "on" : "off";
  
  String message;
  serializeJson(doc, message);
  
  mqttClient.publish(TOPIC_DISCOVERY.c_str(), message.c_str(), true);
  Serial.println("Discovery message sent");
}

void sendStatusUpdate() {
  if (!mqttConnected) return;
  
  DynamicJsonDocument doc(1024);
  doc["online"] = true;
  doc["wifi_strength"] = WiFi.RSSI();
  doc["uptime"] = millis() / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  
  String message;
  serializeJson(doc, message);
  
  mqttClient.publish(TOPIC_STATUS.c_str(), message.c_str());
}

void sendStateUpdate() {
  if (!mqttConnected) return;
  
  DynamicJsonDocument doc(1024);
  doc["state"] = deviceState ? "on" : "off";
  doc["timestamp"] = millis();
  
  String message;
  serializeJson(doc, message);
  
  mqttClient.publish(TOPIC_STATE.c_str(), message.c_str());
}

void setDeviceState(bool state) {
  deviceState = state;
  digitalWrite(RELAY_PIN, state ? HIGH : LOW);
  
  Serial.println("Device state changed to: " + String(state ? "ON" : "OFF"));
  
  sendStateUpdate();
}

void handleButton() {
  bool currentButtonState = digitalRead(BUTTON_PIN) == LOW;
  
  if (currentButtonState && !buttonPressed && (millis() - lastButtonPress > 200)) {
    buttonPressed = true;
    lastButtonPress = millis();
    
    // Toggle device state
    setDeviceState(!deviceState);
  } else if (!currentButtonState) {
    buttonPressed = false;
  }
}

void updateStatusLED() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  
  if (!wifiConnected) {
    // Fast blink when no WiFi
    if (millis() - lastBlink > 200) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlink = millis();
    }
  } else if (!mqttConnected) {
    // Slow blink when WiFi connected but no MQTT
    if (millis() - lastBlink > 1000) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlink = millis();
    }
  } else {
    // Solid on when fully connected
    digitalWrite(LED_PIN, HIGH);
  }
}
