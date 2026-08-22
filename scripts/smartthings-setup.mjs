#!/usr/bin/env node
/**
 * One-shot setup for the "Vortigen" SmartThings Virtual Device.
 *
 * Creates, in order:
 *   1. the custom capability "Vortigen Telemetry"
 *   2. its capability presentation (dashboard/detail view)
 *   3. a device profile combining that capability + battery + refresh
 *   4. a virtual device named "Vortigen" from that profile
 *
 * Run with:
 *   SMARTTHINGS_PAT=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx node scripts/smartthings-setup.mjs
 *
 * Get a token at https://account.smartthings.com/tokens with scopes:
 * "Devices" (r/w) and "Virtual Devices" (r/w).
 *
 * On success, writes the resulting IDs into .env.local so the Next.js app
 * (see lib/smartthings.ts) can push telemetry into the device automatically.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API = "https://api.smartthings.com/v1";

const PAT = process.env.SMARTTHINGS_PAT;
if (!PAT) {
  console.error(
    "Error: SMARTTHINGS_PAT env var tidak ditemukan.\n" +
      "Generate dulu di https://account.smartthings.com/tokens (scope: Devices, Virtual Devices),\n" +
      "lalu jalankan ulang:\n" +
      "  SMARTTHINGS_PAT=xxxxxxxx node scripts/smartthings-setup.mjs   (macOS/Linux)\n" +
      '  $env:SMARTTHINGS_PAT="xxxxxxxx"; node scripts/smartthings-setup.mjs   (Windows PowerShell)\n' +
      "  set SMARTTHINGS_PAT=xxxxxxxx && node scripts/smartthings-setup.mjs   (Windows CMD)"
  );
  process.exit(1);
}

async function st(method, pathname, body) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${pathname} -> HTTP ${res.status}`);
    err.body = json;
    throw err;
  }
  return json;
}

function fail(step, err) {
  console.error(`\n✗ Gagal di langkah: ${step}`);
  console.error(err.message ?? err);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  console.error(
    "\nSalin pesan error di atas dan kirim ke Claude untuk diperbaiki — kemungkinan besar hanya perlu penyesuaian kecil di JSON."
  );
  process.exit(1);
}

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(ROOT, relPath), "utf8"));
}

async function main() {
  console.log("== 1/5: Membuat custom capability 'Vortigen Telemetry' ==");
  let capability;
  try {
    capability = await st("POST", "/capabilities", readJson("smartthings/capability.json"));
  } catch (err) {
    fail("create capability", err);
  }
  const capId = capability.id;
  const capVersion = capability.version ?? 1;
  console.log(`✓ capabilityId = ${capId} (version ${capVersion})`);

  console.log("\n== 2/5: Mengunggah presentation (tampilan dashboard) ==");
  try {
    const presentationTemplate = readFileSync(path.join(ROOT, "smartthings/presentation.json"), "utf8").replace(
      /__CAP_ID__/g,
      capId
    );
    await st("PUT", `/capabilities/${capId}/${capVersion}/presentation`, JSON.parse(presentationTemplate));
    console.log("✓ Presentation terpasang.");
  } catch (err) {
    console.warn("⚠ Presentation gagal diunggah (device tetap bisa dipakai, tapi tampilan di app mungkin generik).");
    console.warn(err.message ?? err);
    if (err.body) console.warn(JSON.stringify(err.body, null, 2));
  }

  console.log("\n== 3/5: Membuat device profile 'Vortigen Wind Turbine' ==");
  let profile;
  try {
    const profileTemplate = readFileSync(path.join(ROOT, "smartthings/device-profile.json"), "utf8").replace(
      /__CAP_ID__/g,
      capId
    );
    profile = await st("POST", "/deviceprofiles", JSON.parse(profileTemplate));
  } catch (err) {
    fail("create device profile", err);
  }
  const profileId = profile.id;
  console.log(`✓ deviceProfileId = ${profileId}`);

  console.log("\n== 4/5: Mencari lokasi (location) SmartThings Anda ==");
  let locationId = process.env.SMARTTHINGS_LOCATION_ID;
  if (!locationId) {
    let locations;
    try {
      locations = await st("GET", "/locations");
    } catch (err) {
      fail("list locations", err);
    }
    const items = locations.items ?? [];
    if (items.length === 0) {
      fail(
        "list locations",
        new Error("Tidak ada lokasi ditemukan di akun SmartThings ini — buat 1 lokasi dulu di app SmartThings.")
      );
    }
    locationId = items[0].locationId;
    console.log(`✓ Memakai lokasi: ${items[0].name} (${locationId})`);
    if (items.length > 1) {
      console.log(
        `  (Ada ${items.length} lokasi di akun ini. Kalau mau pakai yang lain, set SMARTTHINGS_LOCATION_ID.)`
      );
    }
  }

  console.log("\n== 5/5: Membuat Virtual Device 'Vortigen' ==");
  let device;
  try {
    device = await st("POST", "/virtualdevices", {
      name: "Vortigen",
      deviceProfileId: profileId,
      locationId,
      roomId: null,
    });
  } catch (err) {
    fail("create virtual device", err);
  }
  const deviceId = device.deviceId ?? device.id;
  console.log(`✓ deviceId = ${deviceId}`);

  const envPath = path.join(ROOT, ".env.local");
  const envLines = [
    `SMARTTHINGS_PAT=${PAT}`,
    `SMARTTHINGS_CAPABILITY_ID=${capId}`,
    `SMARTTHINGS_DEVICE_PROFILE_ID=${profileId}`,
    `SMARTTHINGS_DEVICE_ID=${deviceId}`,
    `SMARTTHINGS_LOCATION_ID=${locationId}`,
  ];
  if (existsSync(envPath)) {
    const existing = readFileSync(envPath, "utf8");
    const toAppend = envLines.filter((line) => !existing.includes(line.split("=")[0] + "="));
    if (toAppend.length) appendFileSync(envPath, "\n" + toAppend.join("\n") + "\n");
  } else {
    writeFileSync(envPath, envLines.join("\n") + "\n");
  }

  console.log("\n=================================================");
  console.log("SELESAI. Ringkasan:");
  console.log(`  capabilityId      = ${capId}`);
  console.log(`  deviceProfileId   = ${profileId}`);
  console.log(`  deviceId          = ${deviceId}`);
  console.log(`  locationId        = ${locationId}`);
  console.log(`\nSemua ID di atas sudah otomatis ditulis ke .env.local.`);
  console.log("Jalankan ulang 'npm run dev' agar server membaca .env.local yang baru,");
  console.log("lalu buka app SmartThings resmi -> perangkat 'Vortigen' akan muncul di sana.");
  console.log("=================================================");
}

main();
