# E-Okul Disiplin AI Pro

<div align="center">

![E-Okul Disiplin AI Pro Logo](public/icon.png)

### Millî Eğitim Bakanlığı Mevzuatına Uygun Profesyonel Okul Disiplin ve Evrak Yönetim Sistemi

**Projenin Sahibi ve Geliştiricisi: By Abdullah Yanarateş**

[![Platform: Windows 10 | 11 (x64)](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(x64)-blue.svg?logo=windows)](https://github.com/abdullahyanarates/e-okul-disiplin-ai-pro)
[![Electron](https://img.shields.io/badge/Electron-45.2.1-47848F.svg?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()

</div>

---

## 📋 Genel Bakış

**E-Okul Disiplin AI Pro**, Türkiye Cumhuriyeti Millî Eğitim Bakanlığı (MEB) İlköğretim ve Ortaöğretim Kurumları Yönetmeliği ile 3308 Sayılı Mesleki Eğitim Kanunu (MESEM) hükümlerine tam uyumlu olarak geliştirilmiş, resmî ve kurumsal bir masaüstü disiplin ve evrak yönetim yazılımıdır.

Okul idarecileri, disiplin kurulu başkanları, müdür yardımcıları ve koordinatör öğretmenler için öğrenci disiplin süreçlerinin kayıt altına alınmasını, kurul kararlarının yazılmasını, mevzuat analizini ve resmî yazışma kurallarına uygun evrakların (PDF ve gerçek Microsoft Word `.docx`) tek tıkla üretilmesini sağlar.

---

## 🌟 Temel Özellikler

### 1. 🪟 Windows Masaüstü Entegrasyonu
- **Windows 10 ve Windows 11 (64-bit)** için optimize edilmiştir.
- İnternet tarayıcısı gerektirmeden bağımsız masaüstü yazılımı olarak çalışır.
- Kurulum Sihirbazı (`E-Okul-Disiplin-AI-Pro-Setup.exe`) ile Masaüstü kısayolu, Başlat menüsü entegrasyonu ve Denetim Masası Program Kaldırma desteği sunar.
- Kurulumsuz tek tıkla çalışan Taşınabilir Sürüm (`E-Okul-Disiplin-AI-Pro-Portable.exe`) desteği mevcuttur.
- Çevrimdışı (offline) çalışabilir; tüm yerel veri yönetimi, evrak üretimi, raporlama ve yazdırma işlemleri internet bağlantısı olmadan eksiksiz çalışır.

### 2. 🛡️ Güvenli Electron Mimarisi
- `nodeIntegration: false`, `contextIsolation: true` ve `webSecurity: true` güvenlik standartlarına sahiptir.
- Tüm sistem çağrıları ve dosya işlemleri güvenli `preload.cjs` IPC köprüsü üzerinden kontrollü yürütülür.
- Kullanıcı verileri asla uygulamanın kurulum dizininde tutulmaz; Windows kullanıcı veri klasöründe (`%APPDATA%\e-okul-disiplin-ai-pro\`) güvenle saklanır. Uygulama güncellendiğinde veya yeniden kurulduğunda veriler korunur.
- Otomatik ve anlık yedekleme mekanizması ile sistem her işlemde veri bütünlüğü kontrolü gerçekleştirir.

### 3. 📄 Profesyonel PDF ve Microsoft Word (.docx) Evrak Sistemi
- **%100 Türkçe Karakter Desteği**: `Ğ, Ü, Ş, İ, I, Ö, Ç` karakterleri bozulmadan, hiçbir yabancılaştırma (ASCII dönüştürme) olmadan özgün Unicode olarak basılır.
- **Birebir Aynı Belge Tasarımı**: PDF ve Word çıktıları aynı veri kaynağından, aynı sayfa düzeni, aynı kenar boşlukları ve aynı hiyerarşik yapı ile üretilir.
- **Gerçek OpenXML Word Belgesi**: Sadece uzantısı değiştirilmiş HTML dosyaları yerine Microsoft Word tarafından standart olarak tanınan gerçek `.docx` dosyaları üretilir.
- **Chromium Vektör PDF**: Chromium motoru üzerinden piksellenmeyen, net ve yazıcıya hazır A4 vektör PDF çıktısı alınır.
- **Canlı Önizleme Modalı**: Belgeler indirilmeden veya yazdırılmadan önce A4 boyutunda canlı olarak incelenebilir, yakınlaştırma (zoom), sayfa yönü (dikey/yatay) ve kenar boşlukları ayarlanabilir.

### 4. 🖨️ Kapsamlı Yazdırma Sistemi
- Windows sistem yazıcıları ile doğrudan haberleşir.
- Yazıcı seçimi, kopya sayısı, A4 dikey/yatay yönlendirme ve renkli/siyah-beyaz yazdırmayı destekler.
- Yazdırma sırasında menüler, butonlar ve arayüz elemanları gizlenerek yalnızca resmî belge basılır.

### 5. 📚 Resmî MEB Belge Türleri Desteği
- Disiplin Olay Tutanağı
- Disiplin Kurulu Karar Defteri (A4 Yatay / Dikey)
- Disiplin Soruşturma Raporu
- Öğrenci Savunma İstemi (EK-8 / EK-9)
- Öğrenci İfade ve Görgü Tanığı Tutanakları
- Veli Bilgilendirme ve Görüşme Tutanakları
- Kurul Toplantı Çağrı Yazısı
- Disiplin Kurulu Karar Belgesi (EK-10)
- Öğrenci Disiplin Sicil ve Puan Durum Belgesi
- Ceza Kaldırma ve Davranış Puanı İade Kararları
- Genel ve Sınıf Bazlı Öğrenci Listeleri
- MESEM İşletme Bildirim ve Disiplin Evrakları
- İstatistik ve Dönem Sonu İnceleme Raporları

### 6. 🤖 Yapay Zekâ Destekli Karar Asistanı
- Kullanıcının tanımladığı Google Gemini API anahtarı ile çalışır.
- Olay anlatımını analiz ederek ilgili MEB yönetmelik maddesini (Kınama, Kısa Süreli Uzaklaştırma, Okul Değiştirme vb.) önerir.
- Hukuki ve idari gerekçeleri resmî dille otomatik olarak hazırlar.

---

## 🚀 Kurulum ve Kullanım

### Son Kullanıcı İçin (Windows Kurulumu)

1. [GitHub Releases](https://github.com/abdullahyanarates/e-okul-disiplin-ai-pro/releases) sayfasından en son sürümü indirin:
   - **Kurulum Sihirbazı:** `E-Okul-Disiplin-AI-Pro-Setup.exe`
   - **Taşınabilir Sürüm (Kurulumsuz):** `E-Okul-Disiplin-AI-Pro-Portable.exe`
2. `E-Okul-Disiplin-AI-Pro-Setup.exe` dosyasını çalıştırın ve ekrandaki adımları takip edin.
3. Masaüstünde oluşan **E-Okul Disiplin AI Pro** kısayoluna çift tıklayarak uygulamayı başlatın.
4. İlk açılışta **Ayarlar** menüsünden okulunuzun adını, il/ilçe bilgilerini ve kurul üyelerini tanımlayın.

---

## 💻 Geliştirici Kılavuzu

### Gereksinimler
- **Node.js**: v20.0.0 veya üzeri (v22/v24 önerilir)
- **npm**: v10.0.0 veya üzeri
- **İşletim Sistemi**: Windows 10 / 11 (64-bit)

### Kaynak Koddan Derleme Adımları

```bash
# 1. Depoyu klonlayın
git clone https://github.com/abdullahyanarates/e-okul-disiplin-ai-pro.git
cd e-okul-disiplin-ai-pro

# 2. Bağımlılıkları yükleyin
npm install

# 3. Geliştirme modunda çalıştırın (Vite + Electron)
npm run electron:dev

# 4. TypeScript ve Vite üretim derlemesini yapın
npm run build

# 5. Windows EXE paketlerini oluşturun (NSIS Setup ve Portable)
npm run dist
```

Derleme tamamlandığında üretilen `.exe` dosyaları `release/` klasöründe yer alır:
- `release/E-Okul-Disiplin-AI-Pro-Setup.exe`
- `release/E-Okul-Disiplin-AI-Pro-Portable.exe`

---

## 📁 Proje Dizin Yapısı

```
okul-disiplin-cezası-pro-ai/
├── .github/
│   └── workflows/
│       └── build.yml               # GitHub Actions Windows CI/CD iş akışı
├── build/
│   ├── icon.ico                    # Çoklu çözünürlüklü Windows uygulama ikonu
│   └── icon.png                    # 512x512 yüksek çözünürlüklü PNG ikon
├── components/                     # React kullanıcı arayüzü bileşenleri
│   ├── About.tsx                   # Hakkında ve geliştirici künyesi
│   ├── DecisionAssistant.tsx       # Karar asistanı ve evrak üretim merkezi
│   ├── DocumentViewerModal.tsx     # Evrensel A4 canlı önizleme ve yazdırma modalı
│   ├── IncidentLog.tsx             # Olay kayıt ve soruşturma modülü
│   ├── MesemManagement.tsx         # MESEM öğrenci ve işletme yönetimi
│   ├── PenaltyRemoval.tsx          # Ceza kaldırma ve puan iade modülü
│   ├── Settings.tsx                # Kurum, kurul ve yedekleme ayarları
│   └── Students.tsx                # Öğrenci künyesi ve e-Okul içe aktarma
├── context/                        # Global State Context sağlayıcıları
│   ├── IncidentContext.tsx
│   ├── SettingsContext.tsx
│   └── StudentContext.tsx
├── electron/
│   ├── main.cjs                    # Güvenli Electron ana süreç yönetimi
│   └── preload.cjs                 # IPC köprüsü ve sistem API'leri
├── services/
│   ├── documentEngine.ts           # Tüm resmî evrak şablon motoru
│   ├── docxGenerator.ts            # Gerçek .docx OpenXML belge üreticisi
│   ├── exportService.ts            # PDF, Excel ve Word dışa aktarma servisi
│   ├── geminiService.ts            # Google Gemini yapay zekâ servisi
│   └── persistenceSync.ts          # Windows AppData çift yönlü eşleme
├── .env.example                    # Örnek çevre değişkenleri
├── .gitignore                      # Güvenli git hariç tutma kuralları
├── CHANGELOG.md                    # Sürüm değişiklik geçmişi
├── LICENSE                         # MIT Lisansı
├── package.json                    # Bağımlılıklar ve Electron Builder yapılandırması
├── tsconfig.json                   # TypeScript yapılandırması
└── vite.config.ts                  # Vite derleyici yapılandırması
```

---

## 🔒 Güvenlik ve Gizlilik

- **Yerel Veri Saklama**: Tüm öğrenci ve disiplin verileri yalnızca kullanıcının yerel bilgisayarında (`%APPDATA%`) tutulur. Hiçbir harici bulut sunucusuna veya üçüncü tarafa aktarılmaz.
- **Kişisel API Anahtarı**: Google Gemini yapay zekâ entegrasyonu için ortak veya gömülü anahtar kullanılmaz; kullanıcı kendi ücretsiz anahtarını girer ve bu anahtar yalnızca yerel bellekte saklanır.
- **Veri Göçü (Migration)**: Sürüm yükseltmelerinde veri kaybı yaşanmaması için otomatik şema doğrulama ve birleştirme mekanizması devrededir.

---

## 👤 Geliştirici ve Telif Bilgisi

- **Proje Sahibi ve Geliştiricisi:** **Abdullah Yanarateş**
- **İmza:** **By Abdullah Yanarateş**
- **Platform:** Windows 10 / Windows 11 (64-bit)
- **Lisans:** MIT Lisansı - Ayrıntılar için [LICENSE](LICENSE) dosyasına bakınız.

---

*Bu proje, eğitim kurumlarımızda görev yapan tüm idareci ve öğretmenlerimizin iş yükünü hafifletmek amacıyla geliştirilmiştir.*
