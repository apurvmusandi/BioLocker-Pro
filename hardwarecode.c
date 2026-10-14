#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Fingerprint.h>

// ================= Pin Definitions =================
#define RX2_PIN    16
#define TX2_PIN    17
#define RELAY_PIN  4
#define GREEN_LED  18
#define RED_LED    19
#define BUZZER_PIN 13

// ================= Objects =================
LiquidCrystal_I2C lcd(0x27, 16, 2); 

HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// ================= Enroll Function =================
uint8_t enrollFinger(uint8_t id) {
  int p = -1;
  lcd.clear();
  lcd.print("Place Finger");

  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
  }

  finger.image2Tz(1);
  lcd.clear();
  lcd.print("Remove Finger");
  delay(2000);

  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
  }

  lcd.clear();
  lcd.print("Place Again");

  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
  }

  finger.image2Tz(2);

  if (finger.createModel() == FINGERPRINT_OK) {
    if (finger.storeModel(id) == FINGERPRINT_OK) {
      lcd.clear();
      lcd.print("Stored ID:");
      lcd.print(id);
      delay(2000);
      return id;
    }
  }

  lcd.clear();
  lcd.print("Enroll Failed");
  delay(2000);
  return -1;
}

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

  // ✅ STEP 1: Enroll fingerprint at start
  enrollFinger(1);   // You can change ID (1,2,3...)

  // ✅ STEP 2: Then normal system
  resetDisplay();
}

void loop() {
  getFingerprintID();
  delay(50);
}

// ================= Core Logic =================

int getFingerprintID() {
  uint8_t p = finger.getImage();
  
  if (p != FINGERPRINT_OK) return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    grantAccess(finger.fingerID);
  } else if (p == FINGERPRINT_NOTFOUND) {
    denyAccess();
  }
  
  return finger.fingerID;
}

void grantAccess(int id) {
  Serial.print("Access Granted! ID: "); Serial.println(id);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Access Granted");
  lcd.setCursor(0, 1);
  lcd.print("Welcome ID: ");
  lcd.print(id);

  digitalWrite(GREEN_LED, HIGH);
  digitalWrite(RELAY_PIN, HIGH);
  
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(BUZZER_PIN, LOW);

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