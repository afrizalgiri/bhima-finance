# Panduan Deploy ke Cloud (Gratis)

Stack: **Vercel** (frontend) + **Render** (backend) + **Supabase** (database PostgreSQL)

---

## LANGKAH 1 — Buat Akun (semua gratis)

1. **GitHub** → https://github.com → Sign up (pakai Google)
2. **Supabase** → https://supabase.com → Sign up (pakai GitHub)
3. **Render** → https://render.com → Sign up (pakai GitHub)
4. **Vercel** → https://vercel.com → Sign up (pakai GitHub)

---

## LANGKAH 2 — Upload Code ke GitHub

Buka **Command Prompt** di folder `bhima finance`, jalankan:

```
git init
git add .
git commit -m "first commit"
```

Lalu buka GitHub → **New repository** → nama: `bhima-finance` → Create.

Salin perintah yang muncul (yang ada `git remote add origin ...`) dan jalankan di Command Prompt.

---

## LANGKAH 3 — Buat Database di Supabase

1. Login Supabase → **New Project**
2. Isi nama project: `bhima-finance`, pilih region: **Singapore**
3. Buat password database (catat!)
4. Tunggu selesai (~2 menit)
5. Buka **Project Settings → Database**
6. Copy **Connection string** (pilih mode: **URI**) → bentuknya:
   ```
   postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres
   ```
7. Ganti `[PASSWORD]` dengan password yang kamu buat tadi → **simpan string ini**

---

## LANGKAH 4 — Deploy Backend ke Render

1. Login Render → **New → Web Service**
2. Connect GitHub → pilih repo `bhima-finance`
3. Isi pengaturan:
   - **Name**: `bhima-finance-backend`
   - **Root Directory**: `app/backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. Klik **Advanced** → **Add Environment Variable**, isi satu per satu:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | (connection string Supabase dari langkah 3) |
   | `JWT_SECRET` | (tulis sembarang teks panjang, min 32 karakter) |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | (isi sementara `http://localhost:3000`, nanti diupdate) |

5. Klik **Create Web Service** → tunggu deploy selesai (~5 menit)
6. Setelah selesai, copy URL backend → bentuknya: `https://bhima-finance-backend.onrender.com`

---

## LANGKAH 5 — Deploy Frontend ke Vercel

1. Login Vercel → **Add New → Project**
2. Import repo `bhima-finance` dari GitHub
3. Atur:
   - **Root Directory**: `app/frontend`
   - **Framework Preset**: Next.js (otomatis terdeteksi)
4. Klik **Environment Variables**, tambahkan:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://bhima-finance-backend.onrender.com/api` |

5. Klik **Deploy** → tunggu ~3 menit
6. Setelah selesai, copy URL frontend → bentuknya: `https://bhima-finance.vercel.app`

---

## LANGKAH 6 — Update CORS di Render

Kembali ke Render → pilih service backend → **Environment**:

Update nilai `FRONTEND_URL` menjadi URL Vercel kamu:
```
https://bhima-finance.vercel.app
```

Klik **Save Changes** → Render akan auto-redeploy.

---

## SELESAI!

Buka URL Vercel → login dengan:
- **Email**: `admin@bhimafinance.com`
- **Password**: `admin123`

> **Ganti password setelah login pertama** di menu Pengaturan!

---

## Catatan Penting

- **Render free tier**: backend "tidur" setelah 15 menit tidak dipakai. Request pertama setelah tidur butuh ~30 detik. Ini normal di free tier.
- **Supabase free tier**: database gratis selamanya (500MB)
- **Vercel free tier**: frontend gratis selamanya
- **Upload logo**: file yang diupload ke Render tidak permanen (hilang saat redeploy). Untuk production yang stabil, upgrade ke Render paid atau gunakan Cloudinary.

---

## Jika Ada Update Code

Setiap kali ada perubahan, cukup jalankan di Command Prompt:
```
git add .
git commit -m "update"
git push
```
Vercel dan Render akan otomatis redeploy.
