# 📋 Queue System - Status Setelah Stress Test

## 📊 Ringkasan Queue

| Status | Jumlah | Keterangan |
|--------|--------|-----------|
| queued | 77 | Menunggu untuk diposting |
| used | 16 | Sudah diposting |
| **Total** | **93** | - |

---

## ✅ Item yang Sudah Diposting (used)

Semua item yang sudah diposting **tetap ada di database** dengan status `used` dan timestamp `used_at`.

### Contoh:
```
ID: 34, Account: 3, Status: used, Used at: 2026-03-12 10:10:00
ID: 36, Account: 3, Status: used, Used at: 2026-03-12 10:10:00
ID: 37, Account: 3, Status: used, Used at: 2026-03-12 10:10:00
...
```

---

## 🔄 Queue Workflow

```
1. Item dibuat dengan status: queued
   ↓
2. Scheduler/Manual trigger mengambil item
   ↓
3. Item diposting ke Threads
   ↓
4. Status berubah menjadi: used
   ↓
5. Timestamp used_at dicatat
   ↓
6. Item tetap ada di database untuk audit trail
```

---

## 📈 Keuntungan Menyimpan Item yang Sudah Diposting

1. **Audit Trail** - Riwayat lengkap posting
2. **Analytics** - Bisa analisis posting history
3. **Prevent Duplicate** - Tidak akan posting item yang sama 2x
4. **Reporting** - Laporan posting per akun
5. **Recovery** - Bisa lihat apa yang sudah diposting

---

## 🧹 Cleanup (Optional)

Jika ingin menghapus item yang sudah lama diposting:

```sql
-- Hapus item yang sudah diposting lebih dari 30 hari
DELETE FROM content_queue 
WHERE status = 'used' 
AND used_at < datetime('now', '-30 days');
```

---

## 📝 Catatan

- Item `used` tidak akan diambil lagi oleh scheduler
- Hanya item dengan status `queued` yang akan diposting
- Setiap posting akan update `used_at` dengan waktu posting
- Database akan terus bertambah seiring waktu (pertimbangkan cleanup berkala)

---

**Generated**: 2026-03-12 17:12:32
