# ThreadsBot - Threads Accounts Capacity

**Date**: 2026-03-12 05:21 WIB

## Jawaban: Berapa Akun Threads yang Bisa Dihandle?

### ✅ UNLIMITED ACCOUNTS

ThreadsBot dapat menangani **unlimited (tidak terbatas)** jumlah akun Threads!

---

## Cara Kerjanya

### 1. Database Structure

```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  username TEXT,
  app_id TEXT,
  app_secret TEXT,
  redirect_uri TEXT,
  access_token TEXT,
  threads_user_id TEXT,
  token_expires_at DATETIME,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Fitur:**
- Setiap akun disimpan dengan ID unik
- Menyimpan credentials (app_id, app_secret)
- Menyimpan access token
- Menyimpan Threads user ID
- Status aktif/non-aktif

### 2. Account Management

**Operasi yang Didukung:**

```javascript
// 1. List all accounts
GET /accounts
→ SELECT * FROM accounts ORDER BY created_at DESC

// 2. Add new account
POST /accounts/add
→ INSERT INTO accounts (username, app_id, app_secret, redirect_uri)

// 3. Connect account (OAuth)
GET /accounts/connect/:id
→ Start OAuth flow

// 4. Delete account
GET /accounts/delete/:id
→ DELETE FROM accounts WHERE id = ?

// 5. Toggle account status
GET /accounts/toggle/:id
→ UPDATE accounts SET is_active = ?

// 6. Disconnect account
GET /accounts/disconnect/:id
→ UPDATE accounts SET access_token = NULL
```

### 3. Multi-Account Support

**Fitur:**
- ✓ Tambah akun baru kapan saja
- ✓ Kelola multiple akun dari satu dashboard
- ✓ Aktifkan/nonaktifkan akun
- ✓ Hapus akun yang tidak digunakan
- ✓ Setiap akun punya config terpisah

### 4. Auto Reply Configuration

Setiap akun memiliki auto reply config sendiri:

```sql
CREATE TABLE auto_reply_config (
  id INTEGER PRIMARY KEY,
  account_id INTEGER,
  enabled BOOLEAN DEFAULT 0,
  reply_message TEXT,
  ...
)
```

---

## Contoh Penggunaan

### Skenario 1: Single Account
```
1 Akun Threads
↓
1 Dashboard
↓
Posting otomatis ke 1 akun
```

### Skenario 2: Multiple Accounts
```
Akun 1 (Personal)
Akun 2 (Business)
Akun 3 (Brand)
↓
1 Dashboard
↓
Posting otomatis ke semua akun
```

### Skenario 3: Team Management
```
Akun 1 (Tim A)
Akun 2 (Tim B)
Akun 3 (Tim C)
Akun 4 (Tim D)
...
↓
1 Dashboard
↓
Kelola semua tim dari satu tempat
```

---

## Kapasitas & Limitasi

### Database Capacity
- **SQLite**: Dapat menangani jutaan records
- **Akun**: Unlimited (tergantung storage)
- **Per Akun**: Unlimited posts, comments, replies

### Threads API Limits
- **Rate Limit**: 200 requests per hour per token
- **Concurrent**: Dapat handle multiple akun secara bersamaan
- **Retry**: Automatic retry dengan exponential backoff

### Aplikasi Limits
- **Memory**: Tergantung server
- **CPU**: Tergantung server
- **Storage**: Tergantung database size

---

## Fitur Per Akun

Setiap akun dapat memiliki:

1. **Auto Posting**
   - Schedule posting
   - Content queue
   - Auto pilot

2. **Auto Reply**
   - Reply otomatis ke comments
   - Custom messages
   - Trigger conditions

3. **Affiliate**
   - Shopee links
   - Product management
   - Commission tracking

4. **History**
   - Track semua posts
   - View engagement
   - Analytics

5. **Settings**
   - Account configuration
   - Preferences
   - Credentials

---

## Cara Menambah Akun

### Step 1: Buka Halaman Accounts
```
https://threadsbot.kelasmaster.id/accounts
```

### Step 2: Isi Form
```
Username: @username_threads
App ID: [dari Meta Developer]
App Secret: [dari Meta Developer]
```

### Step 3: Klik "Tambah Akun"
```
Akun akan disimpan di database
```

### Step 4: Connect Account
```
Klik "Connect" untuk OAuth
Authorize aplikasi
Akun siap digunakan
```

---

## Manajemen Akun

### Aktifkan/Nonaktifkan
```
Klik toggle untuk aktifkan/nonaktifkan akun
Akun yang nonaktif tidak akan posting
```

### Disconnect
```
Klik "Disconnect" untuk logout
Access token akan dihapus
Akun tetap tersimpan di database
```

### Delete
```
Klik "Delete" untuk hapus akun
Akun akan dihapus dari database
Tidak bisa di-undo
```

---

## Best Practices

### 1. Organize Accounts
```
✓ Gunakan username yang jelas
✓ Pisahkan personal dan business
✓ Label sesuai kategori
```

### 2. Security
```
✓ Jangan share credentials
✓ Gunakan strong app secret
✓ Rotate tokens secara berkala
```

### 3. Performance
```
✓ Nonaktifkan akun yang tidak digunakan
✓ Monitor rate limits
✓ Spread posting across accounts
```

### 4. Monitoring
```
✓ Check account status regularly
✓ Monitor token expiry
✓ Review posting history
```

---

## Troubleshooting

### Akun Tidak Muncul
```
1. Refresh halaman
2. Check database connection
3. Verify credentials
```

### OAuth Gagal
```
1. Check app ID dan secret
2. Verify redirect URI
3. Check Threads permissions
```

### Posting Tidak Terkirim
```
1. Verify akun aktif
2. Check rate limits
3. Review error logs
```

---

## Summary

| Aspek | Kapasitas |
|-------|-----------|
| Jumlah Akun | Unlimited |
| Akun Aktif Bersamaan | Unlimited |
| Posts per Akun | Unlimited |
| Comments per Akun | Unlimited |
| Auto Reply Config | Per Akun |
| Storage | Tergantung DB |
| Rate Limit | 200 req/hour per token |

---

## Kesimpulan

✅ **ThreadsBot dapat menangani unlimited akun Threads**

Setiap akun dapat dikelola secara independen dengan:
- Credentials terpisah
- Configuration terpisah
- Posting schedule terpisah
- Auto reply terpisah

Semua dapat dikelola dari satu dashboard!

---

**Status**: ✅ UNLIMITED ACCOUNTS SUPPORTED  
**Last Updated**: 2026-03-12 05:21 WIB
