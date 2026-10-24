# Menghubungkan Elio Planner ke Cloud (Supabase)

Panduan ini cukup dilakukan **sekali**, kira-kira 10 menit. Setelah itu kalender, matkul, lomba, timer, dan file akan tersinkron otomatis antara laptop dan tablet.

Biaya: **gratis** (paket Free Supabase). Kuota file 1 GB dan maksimal 50 MB per file, lebih dari cukup untuk PDF tugas dan berkas lomba.

---

## 1. Buat project Supabase

1. Buka **https://supabase.com**, klik **Start your project**, lalu masuk dengan akun GitHub kamu.
2. Klik **New project**, lalu isi:
   - **Name**: `elio-planner`
   - **Database Password**: buat password yang kuat lalu simpan. Password ini tidak dipakai di aplikasi, tapi jangan sampai hilang.
   - **Region**: **Southeast Asia (Singapore)** supaya cepat dari Indonesia
3. Klik **Create new project** dan tunggu 1 sampai 2 menit sampai project siap.

## 2. Jalankan skrip pengaturan

1. Di menu kiri, buka **SQL Editor**, lalu klik **New query**.
2. Buka file [`supabase-setup.sql`](supabase-setup.sql), salin **seluruh** isinya, lalu tempel di editor.
3. Klik **Run**. Pastikan muncul tulisan **Success**.

Skrip ini membuat tabel untuk data, tempat penyimpanan file yang privat, dan aturan keamanan supaya hanya akunmu yang bisa membaca datamu.

## 3. Atur alamat aplikasi

1. Buka **Authentication**, lalu **URL Configuration**.
2. Di **Site URL**, isi: `https://melkiyunus05.github.io/planner/`
3. Di **Redirect URLs**, klik **Add URL** dan isi alamat yang sama. Lalu **Save**.

Langkah ini diperlukan supaya link konfirmasi email membuka aplikasimu.

## 4. Ambil kunci koneksi

1. Buka **Project Settings** (ikon roda gigi), lalu **API** (di versi baru namanya **Data API** dan **API Keys**).
2. Salin dua hal ini:
   - **Project URL**, contohnya `https://abcdefgh.supabase.co`
   - **anon public** key (diawali `eyJ...`), atau **publishable** key (diawali `sb_publishable_...`)

Kunci ini memang aman dipakai di aplikasi. Data tetap terlindungi oleh aturan keamanan dari langkah 2. **Jangan** pakai key bernama `service_role` atau `secret`.

## 5. Hubungkan aplikasi dan buat akun

1. Buka aplikasi di laptop, lalu klik **ikon awan** di kanan atas (atau menu ⋮ > **Akun & sinkronisasi**).
2. Tempel **Project URL** dan **key**, lalu klik **Hubungkan**.
3. Isi email dan password (minimal 6 karakter), lalu klik **Daftar akun baru**.
4. Buka email dari Supabase dan klik link konfirmasinya.
5. Kembali ke aplikasi, lalu klik **Masuk**. Ikon awan berubah hijau tandanya sudah tersinkron.

## 6. Kunci project supaya hanya kamu yang bisa daftar

Setelah akunmu jadi:

1. Buka **Authentication**, lalu **Sign In / Providers** (di versi lama: **Providers** > **Email**, atau **Settings**).
2. Matikan **Allow new users to sign up**, lalu **Save**.

Dengan begitu, orang lain yang membuka aplikasimu tidak bisa membuat akun di project-mu.

## 7. Hubungkan tablet

1. Di laptop, klik **ikon awan**, lalu **Salin link koneksi**. Kirim link itu ke tablet, misalnya lewat WhatsApp ke diri sendiri.
2. Buka link itu di tablet, lalu **Masuk** dengan email dan password yang sama.

**Khusus iPad dengan aplikasi yang sudah di-install di Home Screen:** penyimpanan aplikasi Home Screen terpisah dari Safari, jadi link tadi tidak terbaca oleh aplikasinya. Caranya: di laptop klik **Salin kode**, lalu di aplikasi iPad buka ikon awan dan tempel kode itu di kolom **Project URL**, klik **Hubungkan**, lalu **Masuk**.

---

## Catatan penting

- **Pertama kali sinkron**, data dari cloud diambil dulu, baru data perangkat dikirim. Jadi kategori atau pengaturan yang sudah kamu ubah di laptop tidak tertimpa oleh data bawaan tablet.
- Kalau dua perangkat mengubah **data yang sama** hampir bersamaan, perubahan **terakhir** yang dipakai.
- Aplikasi tetap bisa dipakai **offline**. Perubahan dikirim otomatis saat online lagi. **Membuka dan mengunggah file butuh internet.**
- Project Supabase gratis bisa **dijeda otomatis** kalau tidak dipakai sekitar seminggu. Kalau terjadi, buka dashboard Supabase lalu klik **Restore project**. Datamu tidak hilang.
- Backup JSON (menu ⋮ > Ekspor backup) tetap berguna. Backup itu menyimpan semua data dan **daftar** file, sedangkan isi file-nya tetap di cloud.
