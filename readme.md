# Datasans Pandamatic AI

Aplikasi web berbasis Flask untuk analisis data menggunakan Python dan visualisasi interaktif.

## Fitur

- Upload file CSV
- Preview data dan statistik dasar
- Analisis data interaktif
- Visualisasi menggunakan Plotly
- Antarmuka pengguna yang responsif

## Persyaratan Sistem

- Python 3.8+
- pip (Python package installer)

## Instalasi

1. Clone repositori ini:
```bash
git clone <repository-url>
cd datasans_pandamatic
```

2. Buat virtual environment:
```bash
python -m venv venv
```

3. Aktifkan virtual environment:
- Windows:
```bash
venv\Scripts\activate
```
- Linux/Mac:
```bash
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

## Menjalankan Aplikasi

1. Aktifkan virtual environment (jika belum):
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

2. Jalankan aplikasi:
```bash
python app.py
```

3. Buka browser dan akses `http://localhost:5000`

## Penggunaan

1. Upload File:
   - Klik tombol "Upload CSV File"
   - Pilih file CSV yang ingin dianalisis
   - Preview data akan muncul secara otomatis

2. Analisis Data:
   - Masukkan pertanyaan atau permintaan analisis di text area
   - Klik "Submit" untuk memproses
   - Hasil akan ditampilkan dalam bentuk visualisasi atau tabel

## Contoh Query

- "Show correlation between columns"
- "Create histogram for [column_name]"
- "Show data summary"

## Deployment

Untuk deployment ke production:

1. Pastikan mengatur environment variable yang diperlukan
2. Gunakan Gunicorn sebagai production server:
```bash
gunicorn app:app
```

## Keamanan

- File upload dibatasi hingga 16MB
- Hanya file CSV yang diperbolehkan
- Validasi input untuk semua request

## Lisensi

[Your License]