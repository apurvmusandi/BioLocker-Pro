#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Fingerprint.h>

// ================= Network Settings =================
const char* ssid     = "Apurv";
const char* password = "12345678";
const char* serverUrl = "http://192.168.137.1:3000";

// ================= Pin Definitions =================
#define RX2_PIN    16
#define TX2_PIN    17
#define RELAY_PIN  4
#define GREEN_LED  18
#define RED_LED    19
#define BUZZER_PIN 13

// ================= Objects & Global Variables =================
LiquidCrystal_I2C lcd(0x27, 16, 2); 
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
WebServer server(80);

unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 5000; // 5 seconds

// Enrollment state variables
volatile bool startEnrollment = false;
volatile uint8_t enrollId = 0;

// Remote unlocking trigger flag
volatile bool triggerUnlock = false;

// ================= Setup & Wifi Helper =================
void connectWiFi() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 20) {
    delay(500);
    Serial.print(".");
    lcd.setCursor(attempt % 16, 1);
    lcd.print(".");
    attempt++;
  }

  lcd.clear();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
  } else {
    Serial.println("WiFi Connection Failed!");
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed!");
    lcd.setCursor(0, 1);
    lcd.print("Working Offline");
  }
  delay(2000);
}

// ================= HTTP Client Handlers =================

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(serverUrl) + "/api/hardware/heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Send local IP in heartbeat JSON payload
  String jsonPayload = "{\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  
  int httpResponseCode = http.POST(jsonPayload);
  if (httpResponseCode > 0) {
    Serial.print("Heartbeat response: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Heartbeat error: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }
  http.end();
}

void postAccessLog(int fingerID, String action) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(serverUrl) + "/api/hardware/access";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String jsonPayload = "{\"fingerID\":" + String(fingerID) + ",\"action\":\"" + action + "\"}";

  int httpResponseCode = http.POST(jsonPayload);
  if (httpResponseCode > 0) {
    Serial.print("Access log report status: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Access log report error: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }
  http.end();
}

void postEnrollConfirm(int id, bool success) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(serverUrl) + "/api/hardware/enroll-confirm";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String jsonPayload = "{\"id\":" + String(id) + ",\"success\":" + (success ? "true" : "false") + "}";

  int httpResponseCode = http.POST(jsonPayload);
  if (httpResponseCode > 0) {
    Serial.print("Enroll confirm report status: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Enroll confirm report error: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }
  http.end();
}

// ================= ESP32 Local Server Route Callbacks =================

void handleUnlock() {
  server.send(200, "application/json", "{\"status\":\"unlocked\"}");
  triggerUnlock = true;
}

void handleEnroll() {
  if (server.hasArg("id")) {
    int requestedId = server.arg("id").toInt();
    if (requestedId >= 1 && requestedId <= 127) {
      enrollId = requestedId;
      startEnrollment = true;
      server.send(200, "application/json", "{\"status\":\"enrolling\"}");
      return;
    }
  }
  server.send(400, "application/json", "{\"error\":\"Invalid ID parameter\"}");
}

void handleDeleteFinger() {
  if (server.hasArg("id")) {
    int idToDelete = server.arg("id").toInt();
    if (idToDelete >= 1 && idToDelete <= 127) {
      if (finger.deleteModel(idToDelete) == FINGERPRINT_OK) {
        Serial.print("Deleted fingerprint ID: ");
        Serial.println(idToDelete);
        server.send(200, "application/json", "{\"success\":true}");
        return;
      } else {
        Serial.print("Delete failed on sensor for ID: ");
        Serial.println(idToDelete);
        server.send(500, "application/json", "{\"success\":false,\"error\":\"Delete failed on sensor\"}");
        return;
      }
    }
  }
  server.send(400, "application/json", "{\"error\":\"Invalid ID parameter\"}");
}

// ================= Core Relocking Routines =================

void grantAccess(int id, bool isRemote = false) {
  Serial.print("Access Granted! ID: "); Serial.println(id);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Access Granted");
  lcd.setCursor(0, 1);
  if (isRemote) {
    lcd.print("Remote Trigger");
  } else {
    lcd.print("Welcome ID: ");
    lcd.print(id);
  }

  digitalWrite(GREEN_LED, HIGH);
  digitalWrite(RELAY_PIN, HIGH);
  
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(BUZZER_PIN, LOW);

  // Sync access logs with backend
  if (!isRemote) {
    postAccessLog(id, "Granted");
  }

  delay(4000);

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RELAY_PIN, LOW);
  resetDisplay();
}

void denyAccess() {
  Serial.println("Access Denied!");
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Access Denied!");

  digitalWrite(RED_LED, HIGH);
  
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);
  delay(150);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);

  // Log denied scan event to server
  postAccessLog(-1, "Denied");

  delay(2000);

  digitalWrite(RED_LED, LOW);
  resetDisplay();
}

void resetDisplay() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Place Finger...");
  lcd.setCursor(0, 1);
  lcd.print("To Unlock Door");
}

// ================= Enrollment Routine =================

bool runEnrollSequence(uint8_t id) {
  int p = -1;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Place Finger");
  lcd.setCursor(0, 1);
  lcd.print("Enroll ID: " + String(id));

  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    server.handleClient(); // Allow server loops during waiting
    if (WiFi.status() == WL_CONNECTED && millis() - lastHeartbeat > heartbeatInterval) {
      sendHeartbeat();
      lastHeartbeat = millis();
    }
    delay(50);
  }

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) return false;
  
  lcd.clear();
  lcd.print("Remove Finger");
  delay(2000);

  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
    delay(50);
  }

  lcd.clear();
  lcd.print("Place Again");

  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    delay(50);
  }

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) return false;

  if (finger.createModel() == FINGERPRINT_OK) {
    if (finger.storeModel(id) == FINGERPRINT_OK) {
      lcd.clear();
      lcd.print("Stored ID:");
      lcd.print(id);
      delay(2000);
      return true;
    }
  }

  lcd.clear();
  lcd.print("Enroll Failed");
  delay(2000);
  return false;
}

// ================= Core Scanner Logic =================

int getFingerprintID() {
  uint8_t p = finger.getImage();
  
  if (p != FINGERPRINT_OK) return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    grantAccess(finger.fingerID, false);
  } else if (p == FINGERPRINT_NOTFOUND) {
    denyAccess();
  }
  
  return finger.fingerID;
}

// ================= Main App Setup & Loop =================

void setup() {
  delay(1000);
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("System Starting");

  delay(1000);

  // Initialize fingerprint reader serial interface
  mySerial.begin(57600, SERIAL_8N1, RX2_PIN, TX2_PIN);
  finger.begin(57600);

  if (finger.verifyPassword()) {
    lcd.clear();
    lcd.print("Scanner Found!");
    Serial.println("Found fingerprint sensor!");
  } else {
    lcd.clear();
    lcd.print("Scanner Error!");
    while (1) { delay(1); }
  }

  delay(1500);

  // Setup WiFi connection
  connectWiFi();

  // Setup local web server routing
  server.on("/unlock", HTTP_POST, handleUnlock);
  server.on("/enroll", HTTP_POST, handleEnroll);
  server.on("/delete-finger", HTTP_POST, handleDeleteFinger);
  server.begin();
  Serial.println("Local HTTP Web Server Started on Port 80");

  resetDisplay();
}

void loop() {
  // Handle HTTP client request updates
  server.handleClient();

  // Handle remote unlock triggers from dashboard
  if (triggerUnlock) {
    triggerUnlock = false;
    grantAccess(1, true);
  }

  // Handle biometric enrollment procedures
  if (startEnrollment) {
    startEnrollment = false;
    bool success = runEnrollSequence(enrollId);
    postEnrollConfirm(enrollId, success);
    resetDisplay();
  }

  // Regular finger verification scans
  if (!startEnrollment) {
    getFingerprintID();
  }

  // Heartbeat transmissions
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }

  delay(50);
}
