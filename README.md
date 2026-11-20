# KENXIT STORE (Cloudflare Workers + D1 + R2)

## Deploy
1. `npm install`
2. `npx wrangler login`
3. Database: `npx wrangler d1 create kenxit-db` → salin `database_id` ke `wrangler.toml`
4. (Opsional, butuh billing) Bucket gambar: `npx wrangler r2 bucket create kenxit-images`, lalu aktifkan blok R2 di `wrangler.toml`. Tanpa R2, tempel link gambar di dashboard.
5. Migrasi: `npm run migrate` (lokal: `npm run migrate:local`)
6. Akun admin pertama (secret, tidak ada di source code):
   `npx wrangler secret put ADMIN_EMAIL` dan `npx wrangler secret put ADMIN_PASSWORD`
   Akun dibuat otomatis (password di-hash) saat login pertama di `/kenxitadmin`.
   Setelah itu ganti password di menu Pengaturan Akun, lalu boleh hapus secret `ADMIN_PASSWORD`.
7. `npm run deploy`

## Lokal
Salin `.dev.vars.example` ke `.dev.vars`, isi, lalu `npm run migrate:local && npm run dev`.

## Catatan
- Nomor WA dan template pesan diubah di Admin > Pengaturan Website (placeholder: {product} {game} {duration} {price}).
- Total terjual diatur manual oleh admin; tombol WhatsApp tidak menaikkan angka.
- Hash password: PBKDF2-SHA256 (WebCrypto bawaan Workers; Argon2id/bcrypt tidak tersedia native).
- Login dibatasi 5 percobaan gagal per IP per 15 menit. Untuk perlindungan lebih, tambahkan Cloudflare WAF Rate Limiting.
- Upload gambar: JPG/PNG/WebP, maks 2MB, dicek tipe dan signature file. Gambar lama dihapus dari R2 saat diganti/dihapus.
