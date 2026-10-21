#!/usr/bin/env python3
"""
Membangkitkan ulang `06 PPT/assets/js/data.js` dari berkas kerja Excel.

Pakai:
    python3 "06 PPT/assets/tools/build-data.py"

Dijalankan dari folder akar proyek (PROJECT NEXUS DECARBONISASI).
Keluaran ditulis langsung ke 06 PPT/assets/js/data.js.

Catatan teknis yang penting:
  - Pembacaan .xlsx memakai zipfile + regex, BUKAN openpyxl. Berkas di drvfs
    (mount /mnt/f) kadang gagal dibaca openpyxl secara transien (BadZipFile),
    sedangkan baca XML mentah dari zip stabil.
  - Blok data yang tidak ada di workbook (faktor emisi, parameter, daftar sumber,
    daftar asumsi) ditulis tangan di bagian STATIC di bawah; sumbernya naskah
    Metodologi-Terstruktur.docx dan METODE_IMPUTASI_TK.md.
"""

import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))  # .../PROJECT NEXUS DECARBONISASI
WB = os.path.join(ROOT, "09 Hasil Analisis Emisi Persektor Tahun 2025",
                  "GRID Emisi dan Tenaga Kerja",
                  "Prioritas_Grid_Industri_Jatim_2025.xlsx")
OUT = os.path.join(ROOT, "06 PPT", "assets", "js", "data.js")

SECTOR_SHEETS = {
    "Makanan &amp; Minuman": "Makanan & Minuman",
    "Tekstil": "Tekstil",
    "Kimia": "Kimia",
    "Pupuk": "Pupuk",
    "Besi &amp; Baja": "Besi & Baja",
}


def load_workbook(path):
    """Kembalikan (zip, shared_strings, {nama_sheet: path_xml})."""
    z = zipfile.ZipFile(path)
    ss = re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S)
    ss = ["".join(re.findall(r"<t[^>]*>([^<]*)</t>", s)) for s in ss]
    wb = z.read("xl/workbook.xml").decode()
    names = re.findall(r'<sheet name="([^"]+)" sheetId="\d+"[^/]*r:id="(rId\d+)"', wb)
    rels = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"',
                           z.read("xl/_rels/workbook.xml.rels").decode()))
    return z, ss, {nm: "xl/" + rels[rid] for nm, rid in names}


def rows_of(z, ss, sheet_path):
    """Hasilkan tiap baris sheet sebagai daftar nilai sel (string)."""
    data = z.read(sheet_path).decode()
    for r in re.findall(r"<row[^>]*>(.*?)</row>", data, re.S):
        out = []
        for _ref, attr, body in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)>(.*?)</c>', r, re.S):
            v = "".join(re.findall(r"<v>([^<]*)</v>", body))
            if 't="s"' in attr and v.isdigit():
                v = ss[int(v)]
            out.append(v)
        yield out


def extract_grid(z, ss, sheets):
    """857 kotak grid dari lima lembar sektor, lengkap dengan lat/lon."""
    grid = []
    for nm, sector in SECTOR_SHEETS.items():
        if nm not in sheets:
            sys.exit(f"Lembar sektor tidak ditemukan: {nm}")
        for out in rows_of(z, ss, sheets[nm]):
            if not out or not out[0].startswith("Grid"):
                continue
            try:
                rank = int(out[0].split()[1])
                kab = out[1]
                lat, lon = round(float(out[2]), 4), round(float(out[3]), 4)
                s1, s2 = round(float(out[4])), round(float(out[5]))
                emisi = round(float(out[6]))
                eko, tk = round(float(out[7])), round(float(out[8]))
                ne = round(float(out[9]), 4)
                nk = round(float(out[10]), 4)
                nt = round(float(out[11]), 4)
            except (IndexError, ValueError):
                continue
            grid.append({
                "sec": sector, "rank": rank, "kab": kab, "lat": lat, "lon": lon,
                "s1": s1, "s2": s2, "emisi": emisi, "eko": eko, "tk": tk,
                "ne": ne, "nk": nk, "nt": nt, "score": round((ne + nk + nt) / 3, 4),
            })
    return grid


# --------------------------------------------------------------------------
# Blok STATIC: ditulis tangan, sumbernya di komentar masing-masing.
# Kalau berubah, sunting di sini lalu jalankan ulang skrip ini.
# --------------------------------------------------------------------------
STATIC = r'''
// ---- Faktor emisi bahan bakar (GHG Protocol CST v2.0; GWP AR5 CH4=28, N2O=265) ----
const FUEL_FACTORS = [
  {bb:"Bensin",                 padanan:"Motor gasoline",            sat:"Liter", co2:2.2882, ch4:0.00033,  n2o:0.0000198, co2e:2.3027},
  {bb:"Minyak Solar",           padanan:"Gas/Diesel oil",            sat:"Liter", co2:2.9100, ch4:0.00039,  n2o:0.0000236, co2e:2.9272},
  {bb:"Minyak Tanah",           padanan:"Other kerosene",            sat:"Liter", co2:2.6716, ch4:0.00037,  n2o:0.0000222, co2e:2.6878},
  {bb:"Batubara/briket/kokas",  padanan:"Other bituminous coal",     sat:"Kg",    co2:2.4407, ch4:0.00026,  n2o:0.0000387, co2e:2.4582},
  {bb:"Avgas/avtur",            padanan:"Jet kerosene",              sat:"Liter", co2:2.5716, ch4:0.00036,  n2o:0.0000215, co2e:2.5873},
  {bb:"Minyak bakar/MFO",       padanan:"Residual fuel oil",         sat:"Liter", co2:3.0053, ch4:0.00039,  n2o:0.0000233, co2e:3.0223},
  {bb:"Gas kota/gas alam",      padanan:"Natural gas",               sat:"M3",    co2:1.8850, ch4:0.00017,  n2o:0.0000034, co2e:1.8906},
  {bb:"LPG/BBG",                padanan:"Liquified Petroleum Gases",  sat:"Kg",    co2:2.9846, ch4:0.00024,  n2o:0.0000047, co2e:2.9925}
];

// ---- Kuantitas pemakaian bahan bakar 2016 (BPS IBS Jatim Tabel 4.1, satuan fisik) ----
const FUEL_QTY = [
  {sektor:"10 Makanan",     v:[26413321, 114910808, 1648418, 248145601, 322, 507220521, 125906745, 40471084]},
  {sektor:"11 Minuman",     v:[2984700, 2359726, 98323, 2091934, 0, 0, 1933258, 7104154]},
  {sektor:"13 Tekstil",     v:[4126362, 6278440, 86660, 29814700, 206, 0, 879820, 2675876]},
  {sektor:"20 Kimia",       v:[121639859, 1334079777, 772653, 62277456, 2500, 320400, 20058372, 208856308]},
  {sektor:"24 Logam Dasar", v:[3575702, 6658380, 152703, 18376969, 0, 21488, 67521563, 4241037]}
];

// ---- Emisi Scope 1 2016 per bahan bakar (ton CO2e) ----
const FUEL_EMIS = [
  {sektor:"10 Makanan",     v:[60822, 336370, 4431, 609981, 1, 1532980, 238034, 121110], total:2903728},
  {sektor:"11 Minuman",     v:[6873, 6907, 264, 5142, 0, 0, 3655, 21259], total:44101},
  {sektor:"13 Tekstil",     v:[9502, 18378, 233, 73289, 1, 0, 1663, 8008], total:111074},
  {sektor:"20 Kimia",       v:[280099, 3905153, 2077, 153088, 6, 968, 37921, 625004], total:5004316},
  {sektor:"24 Logam Dasar", v:[8234, 19491, 410, 45174, 0, 65, 127653, 12691], total:213718}
];
const FUEL_EMIS_TOTAL = [365529, 4286299, 7415, 886675, 8, 1534013, 408926, 788072];

// ---- Scope 2 2016: listrik bersih -> kWh -> emisi ----
const LISTRIK_S2 = [
  {sektor:"10 Makanan",     tabel42:2715696240,  tabel43:4530381224,  listrik:1814684984, kwh:1627520165, gwh:1627.5, s2:1302016},
  {sektor:"11 Minuman",     tabel42:140756069,   tabel43:866244799,   listrik:725488730,  kwh:650662538,  gwh:650.7,  s2:520530},
  {sektor:"13 Tekstil",     tabel42:188112572,   tabel43:641309991,   listrik:453197419,  kwh:406455084,  gwh:406.5,  s2:325164},
  {sektor:"20 Kimia",       tabel42:19822999892, tabel43:23721147745, listrik:3898147853, kwh:3496096729, gwh:3496.1, s2:2796877},
  {sektor:"24 Logam Dasar", tabel42:354758040,   tabel43:893066095,   listrik:538308055,  kwh:482787493,  gwh:482.8,  s2:386230}
];

// ---- Ringkasan emisi 2016 -> proyeksi 2025 per sektor (ton CO2e) ----
const SECTOR_TABLE = [
  {sektor:"Makanan",       kbli:"10",      s1_2016:2903728, s2_2016:1302016, total_2016:4205744, faktor:2.10832, s1_2025:6121987, s2_2025:2745067, total_2025:8867054},
  {sektor:"Minuman",       kbli:"11",      s1_2016:44101,   s2_2016:520530,  total_2016:564631,  faktor:2.10832, s1_2025:92979,   s2_2025:1097444, total_2025:1190423},
  {sektor:"Tekstil",       kbli:"13",      s1_2016:111074,  s2_2016:325164,  total_2016:436238,  faktor:1.40049, s1_2025:155558,  s2_2025:455389,  total_2025:610947},
  {sektor:"Kimia + Pupuk", kbli:"20",      s1_2016:5004316, s2_2016:2796877, total_2016:7801193, faktor:1.83964, s1_2025:9206140, s2_2025:5145248, total_2025:14351387},
  {sektor:"Besi & Baja",   kbli:"24",      s1_2016:213718,  s2_2016:386230,  total_2016:599948,  faktor:1.62864, s1_2025:348069,  s2_2025:629030,  total_2025:977099}
];

// ---- Penyebut normalisasi per sektor (maks tiap metrik) + jumlah sel ----
const NORM_MAX = [
  {sektor:"Makanan & Minuman", kbli:"10 & 11", sel:263, maksEmisi:1087843, maksEko:28709758976, maksTk:28270},
  {sektor:"Tekstil",           kbli:"13",      sel:94,  maksEmisi:70323,   maksEko:938877504,   maksTk:4692},
  {sektor:"Kimia",             kbli:"20",      sel:444, maksEmisi:3030506, maksEko:18525560832, maksTk:11752},
  {sektor:"Pupuk",             kbli:"20",      sel:20,  maksEmisi:23094,   maksEko:23685126144, maksTk:3298},
  {sektor:"Besi & Baja",       kbli:"24",      sel:36,  maksEmisi:208145,  maksEko:3047770368,  maksTk:5764}
];

// ---- Alokasi proxy tenaga kerja (intensitas per 1 pekerja) ----
const TK_ALLOC = [
  {sub:"Makanan",     tk:232370, s1PerTk:26.35, s2PerTk:11.81, nt2025:238177960917},
  {sub:"Minuman",     tk:21738,  s1PerTk:4.28,  s2PerTk:50.49, nt2025:11677197465},
  {sub:"Tekstil",     tk:40763,  s1PerTk:3.82,  s2PerTk:11.17, nt2025:8156748254},
  {sub:"Kimia Murni", tk:54142,  s1PerTk:null,  s2PerTk:null,  nt2025:123317562231},
  {sub:"Pupuk",       tk:5287,   s1PerTk:null,  s2PerTk:null,  nt2025:null},
  {sub:"Logam Dasar", tk:27058,  s1PerTk:12.86, s2PerTk:23.25, nt2025:14307176839}
];

// ---- Median imputasi tenaga kerja (METODE_IMPUTASI_TK.md) ----
const TK_MED_RENTANG = [
  {sektor:"Makanan",     r20_99:29, r100:250},
  {sektor:"Tekstil",     r20_99:33, r100:310},
  {sektor:"Minuman",     r20_99:37, r100:334},
  {sektor:"Logam Dasar", r20_99:40, r100:200},
  {sektor:"Kimia",       r20_99:44, r100:175}
];
const TK_MED_BADAN = [
  {sektor:"Makanan",     tbk:299, pt:110, cv:41, ud:28, lain:28},
  {sektor:"Minuman",     tbk:300, pt:98,  cv:34, ud:29, lain:33},
  {sektor:"Tekstil",     tbk:794, pt:146, cv:39, ud:41, lain:32},
  {sektor:"Kimia",       tbk:851, pt:72,  cv:36, ud:44, lain:38},
  {sektor:"Logam Dasar", tbk:130, pt:128, cv:40, ud:24, lain:83}
];
const COMPANY_COUNT = [
  {sektor:"Makanan", n:2150}, {sektor:"Kimia", n:694}, {sektor:"Tekstil", n:411},
  {sektor:"Besi & Baja", n:220}, {sektor:"Minuman", n:166}
];

// ---- Parameter perhitungan ----
const PARAMS = [
  {p:"Tarif listrik industri I-3 (>200 kVA)", v:"Rp 1.115 / kWh",            s:"Permen ESDM 28/2016, Lampiran IV"},
  {p:"Faktor emisi grid JAMALI (OM)",         v:"0,80 ton CO2 / MWh",        s:"Kepmen ESDM 163.K/HK.02/MEM.S/2021"},
  {p:"GWP metana (CH4)",                      v:"28",                        s:"IPCC AR5, horizon 100 tahun"},
  {p:"GWP dinitrogen oksida (N2O)",           v:"265",                       s:"IPCC AR5, horizon 100 tahun"},
  {p:"Resolusi sel grid",                     v:"0,1 derajat (±11 km)",      s:"Mengikuti raster EDGAR"},
  {p:"Rasio intensitas Kimia : Pupuk, Scope 1", v:"67,635 : 1",              s:"Laporan tahunan emiten 2025"},
  {p:"Rasio intensitas Kimia : Pupuk, Scope 2", v:"53,094 : 1",              s:"Laporan tahunan emiten 2025"},
  {p:"Bobot tiap metrik pada skor prioritas", v:"⅓ emisi, ⅓ ekonomi, ⅓ TK",  s:"Pilihan metodologi tim"},
  {p:"Batas administrasi agregasi",           v:"Kabupaten/kota GADM level 2", s:"Overlay centroid sel"}
];

// ---- Sumber data primer (Bagian 2.1 naskah metodologi) ----
const SOURCES = [
  {n:1,  elemen:"Kuantitas pemakaian delapan jenis bahan bakar", dok:"BPS, Statistik Industri Besar & Sedang Jawa Timur 2016", bag:"Tabel 4.1, satuan fisik, per KBLI 2 digit", tahap:"1"},
  {n:2,  elemen:"Nilai bahan bakar dan pelumas", dok:"BPS, Statistik IBS Jawa Timur 2016", bag:"Tabel 4.2 (rupiah)", tahap:"1"},
  {n:3,  elemen:"Biaya input bahan bakar, listrik, dan gas", dok:"BPS, Statistik IBS Jawa Timur 2016", bag:"Tabel 4.3 (rupiah)", tahap:"1"},
  {n:4,  elemen:"Nilai tambah industri per KBLI", dok:"BPS, Statistik IBS Jawa Timur 2016", bag:"Tabel 6", tahap:"8"},
  {n:5,  elemen:"Faktor emisi bahan bakar", dok:"GHG Protocol, Emission Factors for Cross-Sector Tools v2.0", bag:"Lembar Stationary Combustion, Tabel 1–3", tahap:"1"},
  {n:6,  elemen:"Potensi pemanasan global (GWP)", dok:"IPCC AR5", bag:"Horizon 100 tahun: CH4=28, N2O=265", tahap:"1"},
  {n:7,  elemen:"Tarif tenaga listrik industri", dok:"Permen ESDM Nomor 28 Tahun 2016", bag:"Lampiran IV, golongan I-3", tahap:"1"},
  {n:8,  elemen:"Faktor emisi sistem ketenagalistrikan", dok:"Kepmen ESDM 163.K/HK.02/MEM.S/2021", bag:"Sistem JAMALI, Operating Margin", tahap:"1"},
  {n:9,  elemen:"Faktor pertumbuhan aktivitas sektoral", dok:"BPS, PDRB Jawa Timur harga konstan 2010", bag:"Seri 2016–2025 per subsektor", tahap:"2"},
  {n:10, elemen:"Daftar perusahaan, alamat, tenaga kerja", dok:"BPS, Direktori Perusahaan IBS Jawa Timur", bag:"Sepuluh terbitan 2016–2025", tahap:"3, 4"},
  {n:11, elemen:"Titik lokasi perusahaan", dok:"Hasil geocoding alamat + penelusuran Google Maps", bag:"Pin asli bila ada, centroid berjenjang bila tidak", tahap:"3"},
  {n:12, elemen:"Perusahaan di KEK dan kawasan industri", dok:"Penelusuran Google Maps pada deliniasi kawasan", bag:"Tambahan entri di luar direktori", tahap:"3"},
  {n:13, elemen:"Raster emisi gridded", dok:"EDGAR, Joint Research Centre Komisi Eropa", bag:"Sektor Chemical processes & Iron and steel", tahap:"5"},
  {n:14, elemen:"Batas administrasi", dok:"Batas Provinsi Jawa Timur & kabupaten/kota GADM L2", bag:"Pemotongan raster & agregasi hasil", tahap:"5, 9"},
  {n:15, elemen:"Intensitas emisi perusahaan pupuk & kimia", dok:"Laporan tahunan dan keberlanjutan emiten 2025", bag:"Emisi Scope 1/2 dibanding pendapatan, dengan kutipan halaman", tahap:"7"},
  {n:16, elemen:"Batas desa dan kode pos", dok:"Jawa Timur Desa.gpkg & kodepos_jatim.csv", bag:"Penentuan centroid berjenjang", tahap:"3"}
];

// ---- Asumsi & keterbatasan (Bagian 5 naskah metodologi), diurut pengaruh ----
const ASSUMPTIONS = [
  {a:"Intensitas emisi per keluaran riil tetap antara 2016 dan 2025", t:"2", arah:"Hasil 2025 cenderung terlalu tinggi", p:"Dinyatakan terbuka sebagai batas atas; perbaikan menuntut data aktivitas lebih baru"},
  {a:"Tenaga kerja sebanding dengan emisi dalam satu sektor", t:"6", arah:"Pabrik padat modal dialokasikan terlalu rendah", p:"Berlaku pada tingkat proporsi, bukan tingkat pabrik; hasil tidak dibaca per pabrik"},
  {a:"Rasio pemisah pupuk–kimia dari sampel emiten terbatas", t:"7", arah:"Pembagian KBLI 20 peka terhadap pilihan sampel", p:"Sumber dicatat dengan kutipan; uji kepekaan belum dilakukan"},
  {a:"Emisi proses belum dihitung", t:"1", arah:"Kimia, pupuk, logam dasar tercatat lebih rendah dari sebenarnya", p:"Dinyatakan sebagai batas cakupan; menuntut data kapasitas & jenis proses"},
  {a:"Scope 2 dihitung dari belanja listrik, bukan kWh terukur", t:"1", arah:"Bergantung ketepatan tarif yang dipilih", p:"Tarif I-3 dipakai rata karena BPS menggabungkan pabrik menengah & besar"},
  {a:"Faktor emisi grid tetap 0,80 ton CO2/MWh", t:"1, 2", arah:"Scope 2 2025 cenderung terlalu tinggi bila bauran membaik", p:"Dipilih faktor berkekuatan surat keputusan agar dapat dipertahankan"},
  {a:"Jenis batubara memakai padanan other bituminous coal", t:"1", arah:"Pengungkit terbesar hasil Scope 1", p:"Alternatif subbituminus menurunkan hasil; menunggu keputusan akhir"},
  {a:"Keberadaan di Google Maps sebagai proksi operasi 2025", t:"3", arah:"Populasi dapat sedikit berlebih atau berkurang", p:"Status tutup permanen menggugurkan bukti; jejak keputusan tersimpan"},
  {a:"Sebagian koordinat dari centroid kecamatan/kabupaten", t:"3", arah:"Ketelitian sebaran dalam sel menurun", p:"Tingkat koordinat dicatat sehingga dapat disaring"},
  {a:"Nilai tambah sebanding dengan tenaga kerja", t:"8", arah:"Produktivitas antar pabrik dianggap seragam", p:"Sama dengan keterbatasan proxy emisi"},
  {a:"Tenaga kerja dipakai sebagai pembobot sekaligus variabel penilaian", t:"6, 8, 9", arah:"Korelasi antar variabel tinggi secara bawaan", p:"Perlu dinyatakan terbuka saat menafsirkan skor"},
  {a:"Normalisasi dilakukan per sektor", t:"9", arah:"Skor antar sektor tidak sebanding", p:"Pembandingan dibatasi pada sektor yang sama"}
];

// ---- Ambang kategori prioritas ----
const CATEGORIES = [
  {min:0.8, nama:"Sangat Prioritas", makna:"Segera ditindaklanjuti",                     warna:"#36415A"},
  {min:0.6, nama:"Prioritas",        makna:"Diprioritaskan dalam rencana dekarbonisasi", warna:"#6B8A6C"},
  {min:0.4, nama:"Cukup",            makna:"Dipantau, intervensi menengah",              warna:"#B7D894"},
  {min:0.2, nama:"Kurang",           makna:"Belum mendesak",                             warna:"#D0ECB4"},
  {min:0.0, nama:"Tidak Prioritas",  makna:"Bukan sasaran utama saat ini",               warna:"#EDF6E0"}
];

const SECTOR_COLOR = {
  "Kimia":"#36415A", "Makanan & Minuman":"#6B8A6C", "Tekstil":"#B7D894",
  "Besi & Baja":"#8FAE71", "Pupuk":"#4F6E52"
};
'''


def main():
    if not os.path.exists(WB):
        sys.exit(f"Workbook tidak ditemukan:\n  {WB}")
    z, ss, sheets = load_workbook(WB)
    grid = extract_grid(z, ss, sheets)
    if len(grid) != 857:
        print(f"PERINGATAN: jumlah kotak {len(grid)}, biasanya 857", file=sys.stderr)

    head = [
        "/* ==========================================================================",
        "   DATA ASLI — Studi Dekarbonisasi Industri Jawa Timur (CESGS / KATALIS)",
        "   Sumber: Prioritas_Grid_Industri_Jatim_2025.xlsx, Kalkulator_Emisi_CO2e_IBS_Jatim_2016.xlsx,",
        "           METODE_IMPUTASI_TK.md, statistik BPS IBS Jatim 2016, GHG Protocol, Permen/Kepmen ESDM.",
        "   Dibangkitkan otomatis oleh assets/tools/build-data.py — jangan sunting tangan.",
        "   ========================================================================== */",
        "",
        "// 857 kotak grid 0,1 derajat (±11 km) hasil Tahap 6-9, lengkap dengan koordinat.",
        "const GRID = " + json.dumps(grid, ensure_ascii=False, separators=(",", ":")) + ";",
        "",
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(head) + STATIC)

    sektor = {}
    for g in grid:
        sektor[g["sec"]] = sektor.get(g["sec"], 0) + 1
    print(f"Ditulis: {OUT}")
    print(f"  {len(grid)} kotak grid — " + " · ".join(f"{k} {v}" for k, v in sektor.items()))
    print(f"  {os.path.getsize(OUT):,} byte")


if __name__ == "__main__":
    main()
