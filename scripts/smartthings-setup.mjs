#!/usr/bin/env node
/**
 * Idempotent setup for the "Vortigen" SmartThings Virtual Device.
 *
 * Creates, in order (reusing whatever already exists at each step):
 *   1. the custom capability "Vortigen Telemetry"
 *   2. its capability presentation (dashboard/detail view) — always re-applied, PUT is an upsert
 *   3. a device profile combining that capability + battery + refresh
 *   4. a virtual device named "Vortigen" from that profile
 *
 * Safe to run multiple times: each step checks the live API for an existing
 * resource with the same name/id before creating a new one.
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
const ENV_PATH = path.join(ROOT, ".env.local");

const CAPABILITY_NAME = "Vortigen Telemetry";
const PROFILE_NAME = "Vortigen Wind Turbine";
const DEVICE_NAME = "Vortigen";

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
    err.status = res.status;
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

function errorText(err) {
  return JSON.stringify(err.body ?? {}) + " " + (err.message ?? "");
}

async function main() {
  // --- 1/5: custom capability ------------------------------------------------
  console.log(`== 1/5: Custom capability '${CAPABILITY_NAME}' ==`);
  let capId, capVersion;
  try {
    const capability = await st("POST", "/capabilities", readJson("smartthings/capability.json"));
    capId = capability.id;
    capVersion = capability.version ?? 1;
    console.log(`✓ Dibuat baru: capabilityId = ${capId} (version ${capVersion})`);
  } catch (err) {
    // SmartThings rejects a duplicate name with the exact existing id in the message,
    // e.g. "Capability 'ns.vortigenTelemetry' already exists." — reuse it directly.
    const match = errorText(err).match(/'([\w.\-]+\.[\w\-]+)' already exists/);
    if (match) {
      capId = match[1];
      capVersion = 1;
      console.log(`✓ Sudah ada, dipakai ulang: capabilityId = ${capId} (version ${capVersion})`);
    } else {
      fail("create capability", err);
    }
  }

  // --- 2/5: presentation (PUT is an upsert, always safe to re-apply) --------
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

  // --- 3/5: device profile ----------------------------------------------------
  console.log(`\n== 3/5: Device profile '${PROFILE_NAME}' ==`);
  let profileId, usedCategory;
  try {
    const existingProfiles = await st("GET", "/deviceprofiles");
    const found = (existingProfiles.items ?? []).find((p) => p.name === PROFILE_NAME);
    if (found) profileId = found.id;
  } catch (err) {
    console.warn("⚠ Gagal mengecek device profile yang sudah ada, lanjut coba buat baru.");
  }

  if (profileId) {
    console.log(`✓ Sudah ada, dipakai ulang: deviceProfileId = ${profileId}`);
  } else {
    // The exact set of valid category names isn't published anywhere reachable from this
    // script, so we probe the live API with a few likely candidates for a power-generation /
    // energy-monitoring device, then fall back to no category at all (always accepted).
    const CATEGORY_CANDIDATES = ["CurbPowerMeter", "PowerMeter", "EnergyMeter", "SmartPlug", null];
    const profileRaw = readFileSync(path.join(ROOT, "smartthings/device-profile.json"), "utf8").replace(
      /__CAP_ID__/g,
      capId
    );
    let profile;
    for (const category of CATEGORY_CANDIDATES) {
      const body = JSON.parse(profileRaw);
      if (category) {
        body.components[0].categories = [{ name: category, primary: true }];
      } else {
        delete body.components[0].categories;
      }
      try {
        profile = await st("POST", "/deviceprofiles", body);
        usedCategory = category;
        break;
      } catch (err) {
        const invalidCategory = err.body?.error?.details?.some?.((d) => /categories/.test(d.target ?? "")) ?? true;
        console.warn(`  kategori '${category ?? "(tanpa kategori)"}' ditolak, mencoba berikutnya...`);
        if (!invalidCategory) fail("create device profile", err);
      }
    }
    if (!profile) fail("create device profile", new Error("Semua kandidat kategori ditolak API."));
    profileId = profile.id;
    console.log(`✓ Dibuat baru: deviceProfileId = ${profileId} (kategori dipakai: ${usedCategory ?? "tanpa kategori"})`);
  }

  // --- 4/5: location ------------------------------------------------------------
  console.log("\n== 4/5: Lokasi (location) SmartThings Anda ==");
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
  } else {
    console.log(`✓ Memakai SMARTTHINGS_LOCATION_ID = ${locationId}`);
  }

  // --- 5/5: virtual device -------------------------------------------------------
  console.log(`\n== 5/5: Virtual Device '${DEVICE_NAME}' ==`);
  let deviceId;
  try {
    const existingDevices = await st("GET", `/devices?locationId=${locationId}`);
    const found = (existingDevices.items ?? []).find((d) => d.label === DEVICE_NAME || d.name === DEVICE_NAME);
    if (found) deviceId = found.deviceId;
  } catch (err) {
    console.warn("⚠ Gagal mengecek virtual device yang sudah ada, lanjut coba buat baru.");
  }

  if (deviceId) {
    console.log(`✓ Sudah ada, dipakai ulang: deviceId = ${deviceId}`);
  } else {
    let device;
    try {
      device = await st("POST", "/virtualdevices", {
        name: DEVICE_NAME,
        deviceProfileId: profileId,
        locationId,
        roomId: null,
        owner: {
          ownerType: "LOCATION",
          ownerId: locationId,
        },
      });
    } catch (err) {
      fail("create virtual device", err);
    }
    deviceId = device.deviceId ?? device.id;
    console.log(`✓ Dibuat baru: deviceId = ${deviceId}`);
  }

  const envLines = [
    `SMARTTHINGS_PAT=${PAT}`,
    `SMARTTHINGS_CAPABILITY_ID=${capId}`,
    `SMARTTHINGS_DEVICE_PROFILE_ID=${profileId}`,
    `SMARTTHINGS_DEVICE_ID=${deviceId}`,
    `SMARTTHINGS_LOCATION_ID=${locationId}`,
  ];
  if (existsSync(ENV_PATH)) {
    const existing = readFileSync(ENV_PATH, "utf8");
    const keep = existing
      .split("\n")
      .filter((line) => line.trim() && !envLines.some((l) => l.split("=")[0] === line.split("=")[0]));
    writeFileSync(ENV_PATH, [...keep, ...envLines].join("\n") + "\n");
  } else {
    writeFileSync(ENV_PATH, envLines.join("\n") + "\n");
  }

  console.log("\n=================================================");
  console.log("SELESAI. Ringkasan:");
  console.log(`  capabilityId      = ${capId}`);
  console.log(`  deviceProfileId   = ${profileId}`);
  console.log(`  deviceId          = ${deviceId}`);
  console.log(`  locationId        = ${locationId}`);
  console.log(`\nSemua ID di atas sudah otomatis ditulis/diperbarui di .env.local.`);
  console.log("Jalankan ulang 'npm run dev' agar server membaca .env.local yang baru,");
  console.log("lalu buka app SmartThings resmi -> perangkat 'Vortigen' akan muncul di sana.");
  console.log("=================================================");
}

main();
