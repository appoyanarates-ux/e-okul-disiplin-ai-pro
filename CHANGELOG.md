# Sürüm Geçmişi (Changelog)

**E-Okul Disiplin AI Pro** projesine ait tüm önemli değişiklikler bu dosyada belgelenmektedir.

Proje Sahibi ve Geliştiricisi: **By Abdullah Yanarateş**

## [1.1.1] - 2026-11-04

### 📄 Seçili Öğrenciler İçin Toplu & Ayrı Ayrı Öğrenci Çağrı Pusulası Oluşturma
- **Toplantı Yönetimi (Sekme 2) Toplu Çağrı Pusulası Desteği:**
  - Olaydaki tüm öğrenciler için öğrenci bazında seçim kutuları (checkbox), "Tümünü Seç / Tümünü Kaldır" kontrolü ve tek tıkla toplu üretim imkanı sağlandı.
  - Seçilen her öğrenci için MEB standartlarına uygun, kendi adı-soyadı, sınıfı, numarası ve tebellüğ imza bloğunu içeren **bağımsız birer Öğrenci Çağrı Pusulası** oluşturulur.
  - Öğrenci rolüne göre çağrı metni otomatik olarak özelleştirilir:
    - **Fail (Şüpheli):** Disiplin kurulunda savunmasını yapmak üzere çağrı.
    - **Tanık:** Olayla ilgili görgü ve bilgisine başvurulmak üzere ifadeye çağrı.
    - **Mağdur:** Olayla ilgili bilgi ve beyanına başvurulmak üzere çağrı.
- **Tutanak ve Formlar (Sekme 3) Hızlı Erişim Butonu:**
  - "İfade & Savunma Belgeleri" menüsüne doğrudan **"Öğrenci Çağrı Pusulası"** butonu eklendi; seçili öğrenci için tek tıkla çağrı pusulası düzenlenebilir ve yazdırılabilir.
- **Toplu Yazdırma ve Ön İzleme Entegrasyonu:**
  - Seçilen öğrenciler için oluşturulan tüm pusulalar tek liste halinde ön izlenebilir ve tek tıkla doğrudan yazdırılabilir veya Word/PDF'e aktarılabilir.

---

## [1.1.0] - 2026-11-04

### 👥 Olaylar Sayfası Çoklu Öğrenci ve Rol Seçimi (Fail, Tanık, Mağdur)
- **Aynı Anda Çoklu Öğrenci Ekleme:**
  - Olaylar sayfasındaki "Öğrenci Ekle" penceresi baştan aşağı yenilendi.
  - Artık tek tek öğrenci eklemek yerine, aynı anda dilediğiniz kadar öğrenciyi seçip olaya tek tıkla ekleyebilirsiniz.
- **Satır Bazında Hızlı Rol Atama:**
  - Her öğrencinin yanında bulunan **Fail (Şüpheli)**, **Tanık** ve **Mağdur** butonları ile öğrenciye anında rol atanabilir.
  - Farklı öğrencilere aynı pencerede farklı roller verilerek (örn. 2 Fail, 3 Tanık, 1 Mağdur) hepsi birlikte eklenebilir.
- **Toplu Rol ve Sınıf Filtresi:**
  - Üst kısımdaki hızlı rol seçici ile seçilen tüm öğrencilerin rolleri toplu olarak değiştirilebilir.
  - Sınıf filtresi ve anlık arama ile hedeflenen sınıftaki öğrenciler saniyeler içinde listelenip eklenebilir.

---

## [1.0.9] - 2026-11-04

### 🔄 Öğrenci Değişiminde Evrak Verilerinin Korunması & Kalıcı Belge Hafızası
- **Öğrenciye ve Evraka Özel Kalıcı Hafıza (`customDocuments`):**
  - Tutanak ve Formlar sayfasında bir öğrenci için hazırlanan veya düzenlenen evraklar (İfade Talebi, Savunma Talebi, Öğrenci İfade Belgesi, Öğrenci Savunma Belgesi, Görüşme Tutanağı, EK-10 vb.) öğrenci bazlı kalıcı olarak kaydedilir.
  - Başka bir öğrenciye geçilip tekrar eski öğrenciye dönüldüğünde, yazılan metinler, açıklamalar ve yapılan tüm değişiklikler eksiksiz geri yüklenir; hiçbir veri kaybolmaz.
- **Akıllı Öğrenci Geçişi & Ön İzleme Senkronizasyonu:**
  - Sol öğrenci listesinden öğrenci tıklandığında ön izleme penceresi derhal o öğrencinin aktif evrakına ve varsa kayıtlı düzenlemelerine geçer.
  - Kart tıklaması tekil öğrenci geçişini sağlarken, onay kutusu (checkbox) çoklu evrak seçimi için ayrıştırıldı.
- **Şablona Sıfırlama İmkanı ("Şablona Sıfırla"):**
  - İstenildiği takdirde öğrenci evrakını ilk orijinal boş MEB şablonuna geri döndürmek için ön izleme başlığına *"Şablona Sıfırla"* butonu eklendi.
- **Olay Güncelleme Koruması:**
  - Olaydaki bir öğrencinin verisi kaydedildiğinde tüm öğrenci seçiminin ve evrak listesinin sıfırlanmasına neden olan re-render döngüsü engellendi.

---

## [1.0.8] - 2026-11-04

### 🛠️ Ön İzleme Canlı Düzenleyici (ContentEditable) Yenilendi & Yazma Kilidi Çözüldü
- **Akıllı DOM Senkronizasyonu (`EditableDocumentContent`):**
  - Ön izleme belgelerinde React sanal DOM uzlaşması (dangerouslySetInnerHTML çakışması) nedeniyle her tuş vuruşunda yazının silinmesine / kilitlenmesine neden olan sorun tamamen giderildi.
  - Canlı belge düzenleyici, harici re-render'lardan izole edilerek akıcı ve kesintisiz yazma, silme, biçimlendirme ve düzeltme deneyimi sağlandı.
- **Kararlı Otomatik Kayıt & İmleç Sabitleme:**
  - Kullanıcı belge üzerinde yazarken veya silerken imleç konumu bozulmaz; duraklamada (debounce) veya odak dışına çıkıldığında (blur) değişiklikler ve öğrenci ifade/savunma verileri anında ve hatasız kaydedilir.

---

## [1.0.7] - 2026-11-04

### 📝 Canlı Ön İzleme Üzerinde İfade ve Savunma Girişi & Otomatik Kayıt
- **Tutanak ve Formlar Panelinde Küçük Giriş Alanı Kaldırıldı:**
  - Tutanak ve Formlar sol panelindeki dar/küçük öğrenci ifade ve savunma textarea kutuları kaldırıldı; yerine canlı belge düzenleme rehberi eklendi.
- **Doğrudan A4 Ön İzleme Penceresinden Düzenleme:**
  - İfade tutanakları, savunma tutanakları, talep formları ve öğrenci görüşme belgelerindeki ifade/savunma kısımları sağ taraftaki A4 ön izleme penceresi üzerinde doğrudan tıklanıp yazılabilir hale getirildi.
  - El yazısı için boş bırakıldığında placeholder baskıda görünmez, temiz ve resmi çıktı formatı korunur.
- **Otomatik Kayıt ve Anlık Geri Bildirim Bildirimi:**
  - Ön izleme belgesinde yazılan öğrenci ifadesi ve savunması otomatik olarak olaya işlenir ve anlık olarak kaydedilir.
  - Belge üzerinde ve ekranın sağ alt köşesinde kaydedildiğine dair şık ve belirgin otomatik kayıt bildirim uyarısı sunuldu.

---

## [1.0.6] - 2026-11-03

### 📊 Saf Excel Veri İçe Aktarma Standardı (PDF İçe Aktarma Kaldırıldı)
- **Yalnızca Excel & CSV Desteği:**
  - PDF ile veri yükleme karmaşası ve tutarsızlıkları tamamen kaldırılarak, öğrenci künye ve liste aktarımları doğrudan ve eksiksiz çalışan **Excel (`.xlsx`, `.xls`) ve CSV** formatına odaklandı.
  - Sürükle-bırak alanı, dosya seçiciler ve kılavuzlar yalnızca Excel kabul edecek şekilde güncellendi.
  - Yanlışlıkla PDF yüklendiğinde kullanıcıyı e-Okul'dan Excel indirmeye yönlendiren bilgilendirici uyarı eklendi.
- **Hafifletilmiş Paket ve Sıfır Bağımlılık:**
  - PDF okuyucu motoru kaldırıldı; gereksiz web worker yükleri temizlendi, uygulama açılış ve çalışma performansı artırıldı.
- **Tam Uyumlu Excel Künye Ayrıştırıcı:**
  - Yan yana 2'li öğrenci künye kartları, dikey sıralı kartlar ve sınıf tabloları tam uyumla aktarılmaya devam etmektedir.

---

## [1.0.5] - 2026-11-03

### 📑 Esnek e-Okul PDF ve Çok Sütunlu Excel Künye Defteri Ayrıştırıcı Motoru
- **Yan Yana 2'li (Çok Sütunlu) Öğrenci Desteği:**
  - PDF belgelerinde tek sayfada yatay olarak yan yana yer alan 2 sütunlu künye kartları otomatik tespit edilip sol ve sağ sütunlar birbirine karışmadan bağımsız olarak ayrıştırıldı.
  - Excel sayfalarında yatayda yan yana sıralanmış 2'li (veya daha fazla) öğrenci künye blokları (`columnBands`) otomatik taranarak her öğrenci eksiksiz sisteme aktarıldı.
- **Akıllı Satır ve İleriye Bakış (Lookahead) Çözümlemesi:**
  - PDF raporlarında etiketlerin (`Okul No:`, `Adı:`, `T.C. Kimlik No:`) ve değerlerin farklı tablolarda/satırlarda yer aldığı durumlarda otomatik ileriye bakış (`getNextValue`) ile tüm kimlik ve okul bilgileri eksiksiz eşleştirildi.
  - Dikey satır baselines toleransı optimize edilerek hücre bölünmeleri önlendi.
- **Excel Sayısal Ondalık (.0) Biçim Koruması:**
  - Excel ve CSV dışa aktarımlarında tamsayıların sonuna eklenen `.0` uzantıları (`71.0`, `17012964572.0`, `31.0`) otomatik temizlenerek T.C. Kimlik No doğrulamasının (`is11DigitTc`) ve Okul Numaralarının bozulması kökten engellendi.
- **Eksiksiz Alan Aktarımı:**
  - Okul No, Adı Soyadı, Sınıfı, T.C. Kimlik No, Anne/Baba Adı, Doğum Yeri ve Tarihi, Nüfus İli, İlçesi, Mahallesi, Cilt No, Aile Sıra No, Birey Sıra No, Veli Adı Soyadı ve İletişim bilgileri tam uyumla aktarılmaktadır.

---

## [1.0.4] - 2026-11-03

### 📄 Resmi Yazışma Standardı: Sabit 12 Punto ve Times New Roman Tipografisi
- **12 Punto Standartlaşması:** Karar ve Evraklar sayfası, Ceza Kaldırma modülü ve tüm belge önizleme/indirme alanlarında resmi yazışma kurallarına uygun olarak varsayılan yazı boyutu **12 punto (12pt)** olarak ayarlandı.
- **Kalıcı (Persistent) Punto Ayarı:** Kullanıcının seçtiği punto boyutu tarayıcı hafızasında (`localStorage`) saklanarak oturumlar arasında **sabit** kalması güvenceye alındı.
- **Times New Roman Tipografi Kilidi:** Canlı belge düzenleyicisi, önizleme ekranı, yazıcı çıktıları (`@media print`), Chromium vektörel PDF çıktısı ve Microsoft Word (`.docx`) dosyalarında font ailesi kalıcı olarak `"Times New Roman", Times, "Liberation Serif", serif` olarak mühürlendi.

---

## [1.0.3] - 2026-11-03

### 🤖 Google Gemini Free Tier API Desteği ve Çoklu Model Fallback Mimarisi
- **Geçersiz Model Adı Düzeltildi:** Hatalı olan `gemini-3.8-flash` referansı kaldırılarak Google Gemini Free & Paid Tier için resmi desteklenen güncel ve kararlı modeller tanımlandı (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-2.5-flash-lite`).
- **503 High Demand / UNAVAILABLE Koruması:** Google'ın ücretsiz API anahtarlarında anlık model yoğunluğunda verdiği 503 hatası ("This model is currently experiencing high demand") algılanarak otomatik olarak sıradaki hafif ve hızlı modellere geçiş sağlandı.
- **Akıllı API Key Doğrulama:** Test işlemi tek bir modelle sınırlı kalmayıp sıralı olarak yedek modelleri de deneyecek şekilde esnetildi; 503 veya 429 gibi anlık sunucu/kota durumlarında anahtarın geçerli olduğu teyit edilerek kullanıcının kaydetmesine izin verildi.
- **MEB ve Kurumsal Güvenlik Sertifikası Köprüsü:** Okul ve MEB (Fatih Projesi) ağlarındaki self-signed proxy sertifikası kaynaklı indirme kısıtlamaları için `NODE_TLS_REJECT_UNAUTHORIZED=0` ve özel bağlantı köprüsü kalıcı hale getirildi.

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
