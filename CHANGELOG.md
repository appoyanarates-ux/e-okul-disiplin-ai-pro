# Sürüm Geçmişi (Changelog)

**E-Okul Disiplin AI Pro** projesine ait tüm önemli değişiklikler bu dosyada belgelenmektedir.

Proje Sahibi ve Geliştiricisi: **By Abdullah Yanarateş**

---

## [1.0.2] - 2026-11-02

### 🖨️ Saf Vektörel PDF ve Chromium printToPDF / showSaveDialog Mimarisi
- **Resim Dönüştürücüler (`html2canvas`) Kaldırıldı:** DOM'u pikselleştirip canvas/PNG olarak PDF'e basan rasterize yöntemler tamamen temizlendi; metinleri kopyalanabilir, seçilebilir ve sıfır kalite kaybıyla işlenen saf vektörel mimariye geçildi.
- **Electron Chromium `printToPDF` & `showSaveDialog` IPC Altyapısı:** Belge HTML'leri arka planda izole Chromium pencerelerinde `@page` ve CSS kurallarıyla render edilerek yerel Windows "Farklı Kaydet" penceresiyle diske yazdırıldı.
- **Kapsamlı CSS `@media print` Kuralları:** Tüm menüler, butonlar, yan çubuklar ve modal katmanları yazdırma çıktılarından tamamen izole edildi; tablo ve imza blokları sayfa bölünmelerine karşı güvenceye alındı.

---

## [1.0.1] - 2026-11-02

### ⚡ Düzeltmeler ve Güncelleme Bildirim Sistemi

#### 🛠️ Beyaz Ekran Hatası Düzeltildi
- Render sürecinde tarayıcı uyumsuz Node modüllerinin (`events`, `xmlbuilder2`) sebep olduğu `Uncaught TypeError: Class extends value undefined` başlatma hatası tespit edildi ve kökten giderildi.
- Word dışa aktarma motoru optimize edilerek %100 saf istemci uyumlu `exportHtmlToWord` ve OpenXML `docxGenerator` yapısına geçirildi.
- Paket boyutu 4.5 MB'tan 3.2 MB'a düşürüldü; uygulama açılış süresi hızlandırıldı.

#### 🔄 Otomatik Güncelleme Bildirimi ve Canlı İlerleme Çubuğu
- Önceki sürümü yüklemiş olan kullanıcılar için uygulama açılışında otomatik güncelleme kontrolü eklendi (`UpdateNotificationModal`).
- Yeni bir sürüm yayımlandığında ekranın üstünde dikkat çekici bildirim çubuğu gösterilir.
- Kullanıcı tek tıkla güncellemeyi başlatabilir; canlı indirme yüzdesi (%XX), aktarılan megabayt ve indirme hızı anlık olarak izlenir.
- İndirme tamamlandığında "Şimdi Yeniden Başlat ve Yükle" butonu ile mevcut veriler (öğrenci, olay, okul ayarları) korunarak otomatik yükseltme gerçekleştirilir.
- "Hakkında" bölümüne manuel "Yazılım Güncellemelerini Denetle" butonu eklendi.

---

## [1.0.0] - 2026-11-02

### 🚀 İlk Masaüstü Sürümü (Windows 10 / Windows 11 x64)

#### 🖥️ Electron Masaüstü Mimarisi
- React 19 + TypeScript + Vite web uygulaması, Electron tabanlı tam donanımlı Windows masaüstü yazılımına dönüştürüldü.
- `E-Okul-Disiplin-AI-Pro-Setup.exe` (NSIS kurulum sihirbazı, masaüstü kısayolu, Başlat menüsü, kaldırma desteği) üretildi.
- `E-Okul-Disiplin-AI-Pro-Portable.exe` (kurulum gerektirmeyen taşınabilir sürüm) üretildi.
- `nodeIntegration: false`, `contextIsolation: true` ve `webSecurity: true` güvenlik standartları uygulandı.
- Windows kullanıcı veri klasörü (`%APPDATA%\e-okul-disiplin-ai-pro\`) üzerinde kalıcı veri depolama ve otomatik arşivleme mimarisi kuruldu.
- Tek instance kilidi (single instance lock) ve çevrimdışı (offline) çalışma yeteneği eklendi.

#### 📄 PDF ve Microsoft Word (.docx) Evrak Sistemi
- MEB resmî yazışma kurallarına tam uyumlu evrensel şablon motoru (`services/documentEngine.ts`) geliştirildi.
- Gerçek Microsoft Word belgeleri üreten `services/docxGenerator.ts` entegre edildi.
- Tüm Türkçe karakterler (`Ğ, Ü, Ş, İ, I, Ö, Ç`) %100 Unicode uyumlu hale getirildi, karakter bozulmaları giderildi.
- PDF ve DOCX çıktılarının aynı veriden, aynı düzen ve sayfa yapısıyla üretilmesi sağlandı.
- Evrensel A4 canlı önizleme, yakınlaştırma (zoom), sayfa yönü (dikey/yatay), kenar boşluğu ve Windows sistem yazdırma arayüzü (`components/DocumentViewerModal.tsx`) eklendi.

#### 🖨️ Yazdırma Sistemi
- Windows sistem yazıcıları ile doğrudan iletişim kuran yazdırma entegrasyonu sağlandı.
- Arayüz menüleri ve butonları yazdırma çıktılarından izole edildi.

#### ⚙️ Veri Güvenliği ve Yedekleme
- Otomatik ve manuel yedekleme sistemi geliştirildi.
- JSON ve Excel formatlarında dışa ve içe aktarma desteği sağlandı.
- Yedekleme dosya bütünlüğü kontrolü ve şema göçü (migration) mekanizması kuruldu.

#### 🌐 GitHub & CI/CD
- `.github/workflows/build.yml` ile Windows 10/11 x64 otomatik derleme ve GitHub Release iş akışı yapılandırıldı.
- `LICENSE` (MIT), `.gitignore`, `.env.example` ve kapsamlı `README.md` hazırlandı.
- Uygulama içi "Hakkında" bölümü ve geliştirici künyesi "By Abdullah Yanarateş" olarak güncellendi.
