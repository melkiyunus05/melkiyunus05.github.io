/*
 * Vortigen — ESP32 telemetry sender
 *
 * Reads the turbine's sensors and POSTs one JSON reading to the dashboard's
 * /api/telemetry endpoint every SEND_INTERVAL_MS. The dashboard computes the
 * tier (Normal/Peringatan Dini/Kritis/Mati), updates the SmartThings Virtual
 * Device, and serves the web dashboard — all from this one POST.
 *
 * Libraries needed (Arduino Library Manager):
 *   - ArduinoJson (by Benoit Blanchon)
 *
 * Before uploading:
 *   1. Fill in WIFI_SSID / WIFI_PASSWORD below.
 *   2. Fill in SERVER_URL — your deployed dashboard's URL, e.g.
 *        "https://vortigen-dashboard-xxxx.vercel.app/api/telemetry"
 *      (a local "http://192.168.x.x:3000/api/telemetry" only works if the
 *      ESP32 and your laptop are on the same Wi-Fi network — fine for bench
 *      testing, but the deployed URL works from anywhere.)
 *   3. On the dashboard server, set env var DISABLE_SIMULATOR=true so the
 *      built-in demo generator stops overwriting your real readings every
 *      3 seconds (see lib/store.ts).
 *   4. Wire SENSOR_PIN_* below to your actual sensors and replace the
 *      readXxx() placeholder functions with real sensor reads/calibration.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---- Configure me ----------------------------------------------------------
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *SERVER_URL = "https://your-deployment.vercel.app/api/telemetry";
const unsigned long SEND_INTERVAL_MS = 5000;

// ---- Sensor pins (adjust to your wiring) -----------------------------------
const int ANEMOMETER_PIN = 34;   // wind speed sensor (e.g. pulse/analog anemometer)
const int STRAIN_GAUGE_PIN = 35; // structural stress (via HX711 or ADC + amplifier)
const int CURRENT_SENSE_PIN = 32; // energy output (e.g. ACS712 current sensor)
const int BATTERY_ADC_PIN = 33;   // battery voltage divider

unsigned long lastSend = 0;

void connectWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\nConnected, IP: " + WiFi.localIP().toString());
}

// ---- Replace these with real calibrated sensor reads -----------------------

float readWindSpeed() {
  // Placeholder: map raw ADC to m/s. Replace with your anemometer's real curve.
  int raw = analogRead(ANEMOMETER_PIN);
  return (raw / 4095.0) * 20.0; // 0..20 m/s
}

float readStructuralStress() {
  // Placeholder: map raw strain reading to kPa. Replace with your gauge's calibration.
  int raw = analogRead(STRAIN_GAUGE_PIN);
  return (raw / 4095.0) * 10.0; // 0..10 kPa
}

float readEnergyOutput() {
  // Placeholder: derive kW from current sensor + known bus voltage.
  int raw = analogRead(CURRENT_SENSE_PIN);
  float amps = (raw / 4095.0) * 5.0;
  const float busVoltage = 12.0;
  return (amps * busVoltage) / 1000.0; // kW
}

int readBatteryPercent() {
  int raw = analogRead(BATTERY_ADC_PIN);
  float voltage = (raw / 4095.0) * 3.3 * 2; // adjust divider ratio to your circuit
  const float VMIN = 3.0, VMAX = 4.2;       // adjust to your battery chemistry
  float pct = (voltage - VMIN) / (VMAX - VMIN) * 100.0;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (int)pct;
}

float readAmplitude() {
  // Optional: oscillation amplitude from the VIV mechanism, if measured.
  return 0.3;
}

int readDutyCycle() {
  // Optional: Edge AI's current harvesting duty cycle, if exposed.
  return 10;
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping send.");
    return;
  }

  StaticJsonDocument<256> doc;
  doc["windSpeed"] = readWindSpeed();
  doc["amplitude"] = readAmplitude();
  doc["dutyCycle"] = readDutyCycle();
  doc["structuralStress"] = readStructuralStress();
  doc["energyOutput"] = readEnergyOutput();
  doc["batteryPercent"] = readBatteryPercent();

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);

  Serial.print("POST -> HTTP ");
  Serial.println(code);
  if (code > 0) {
    Serial.println(http.getString());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  connectWifi();
}

void loop() {
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendTelemetry();
  }
}
