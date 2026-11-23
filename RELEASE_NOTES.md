# 🚀 E-Okul Disiplin AI Pro - Sürüm 1.1.9 ve Genel Özellik Kataloğu

**Geliştirici & Tasarımcı:** By Abdullah Yanarateş  
**Resmi Web & İndirme Sayfası:** https://www.evrakplus.com/programlar/yapay-zeka-destekli-disiplin-cezasi-programi-e-okul-disiplin-ai-pro/  
**Canlı Web Uygulaması:** https://www.evrakplus.com/disiplin-cezasi-programi/  

---

## 🌟 Sürüm 1.1.9 Yenilikleri (Önemli Güncelleme)

- **Yazılı Uyarı Takip Sistemi:** Öğrenciye verilen her yazılı uyarı kalıcı olarak kaydedilir; öğrenci ve velisine imzalatılan tutanak (tarama/fotoğraf/PDF) kayda eklenebilir ve imza durumları işaretlenir.
- **Öğrenci Sorgulama ve Uyarı Geçmişi:** Numara veya ad soyadla sorgulama; davranış bazında tekrar sayısı, tarihler ve tutanaklar tek ekranda. Yazılı uyarılar disiplin cezası kayıtlarından ayrı tutulur (e-Okul'a işlenmez, davranış puanını etkilemez).
- **Tekrar Eden Davranışta Otomatik Bilgilendirme:** Aynı davranış yeniden kaydedilirken veya olay kaydına fail eklenirken önceki uyarı tarihiyle birlikte "DİKKAT" bilgilendirmesi gösterilir.
- **evrakplus.com Üyelik Köprüsü & Güvenlik:** WordPress üyelik doğrulaması, cihazlar arası kayıt bazında birleştirme (`updatedAt`), eski sürüm verilerinin otomatik taşınması ve güçlendirilmiş senkronizasyon güvenliği.
- **Telefona ve Bilgisayara Yükleme (PWA):** Manifest, service worker ve simgelerle çevrimdışı çalışma ve uygulama olarak yükleme desteği.

---

## 🌟 Sürüm 1.1.8 Yenilikleri

- **Canlı Web-First Hibrit Mimari:** cPanel üzerinden yayınlanan tüm arayüz, evrak şablonu ve tasarım güncellemeleri masaüstü kullanıcılarına anında yansır.
- **Karar ve Evrak Modülü Yenilendi:** AI Analiz, Toplantı Yönetimi, Tutanak ve Formlar, Karar & Tebligat sekmeleri hem masaüstünde hem mobilde modern, yüksek kontrastlı ve dokunmatik uyumlu hale getirildi.
- **e-Okul Künye Defteri Excel Yükleme:** Mobildeki donuk renkler canlı ve yüksek kontrastlı renklerle değiştirildi; mobilde sıkışan tablo yerine tek dokunuşla sınıf atanan ve künye detayını gösteren Mobil Kart Görünümü eklendi.
- **Önemli Kural Uyarısı:** Yüklenen Excel dosyalarının yalnızca veri içermesi gerektiği (ek not veya manuel açıklama eklenmemesi) kuralı arayüze ve e-Okul rehberine eklendi.
- **Önbellek Kilidi Kırıldı:** Web ve masaüstü açılışlarında taze dosya çekilmesini sağlayan `no-cache` kuralları ve F5 / Ctrl+R zorla yenileme (`reloadIgnoringCache`) desteği eklendi.
- **evrakplus.com Entegrasyonu:** Sol menüye, kontrol paneline ve üst bara tek tıkla evrakplus.com ana sayfasına dönüş butonları yerleştirildi.

---

## 📋 Tüm Sürümlerin Özellik & Yetenek Özeti

### 🤖 1. Yapay Zekâ & Karar Destek Sistemi (Google Gemini AI)
- **Akıllı Olay Analizi:** Olay özetini MEB Ortaöğretim Kurumları Yönetmeliği disiplin maddeleriyle otomatik eşleştirir.
- **Çoklu Model Desteği (Free Tier):** Google Gemini 2.5 Flash, 2.0 Flash ve 1.5 Flash modelleri arasında otomatik geçiş ve 503 kota yoğunluğunda kesintisiz akıllı fallback mimarisi.
- **Otomatik Kurul Kararı ve Gerekçe:** Olayın ağırlığına, hafifletici ve ağırlaştırıcı sebeplere göre objektif ceza teklifleri ve resmi karar gerekçeleri üretir.

### 📊 2. e-Okul Künye Defteri & Öğrenci Yönetimi
- **Eksiksiz Künye Ayrıştırma:** MEB e-Okul Künye Defteri Excel (.xlsx / .xls) çıktısından *T.C. Kimlik No, Okul No, Ad-Soyad, Sınıf/Şube, Anne ve Baba Adı, Doğum Yeri/Tarihi, Veli İletişim (Telefon)* ve *İkametgâh Adresi* verilerini saniyeler içinde çeker.
- **Yüksek Kontrast & Mobil Kartlar:** Mobilde sıkışmayı önleyen dokunmatik öğrenci kartları, tek tıkla sınıf atama ve künye detay akordeonları.
- **Sınıf Bazında Filtreleme:** Hem masaüstü dikey liste hem de mobil yatay kaydırmalı sınıf butonları ile anında filtreleme.

### 📄 3. MEB Resmi Yazışma Standartları ve Evrak Motoru
- **Sabit 12 Punto & Times New Roman:** Resmi yazışma kurallarına %100 uyumlu tipografi kilidi; punto ayarı oturumlar arasında kalıcı olarak saklanır.
- **Toplu Öğrenci Çağrı Pusulası:** Olaydaki tüm öğrenciler (Fail, Tanık, Mağdur) için bağımsız tebellüğ imza bloklu çağrı pusulalarını tek tıkla toplu üretme.
- **Resmi Evrak Seti:** Olay Tutanakları, İfade Alma Tutanağı, Savunma İstemi, Disiplin Kurulu Kararı (EK-10), Karar Tebligat Yazıları ve Disiplin Karar Defteri.
- **Ceza Kaldırma & İade Modülü:** Süresi dolan veya üstün başarı gösteren öğrencilerin disiplin cezalarını mevzuata uygun şekilde kaldırma ve dosya iade tutanağı oluşturma.

### 🖨️ 4. Chromium Vektörel Baskı ve Word (.docx)
- **Kayıpsız Vektörel PDF:** Chromium dâhili printToPDF motoru ile seçilebilir, kayıpsız ve net A4 dikey baskı çıktısı.
- **Microsoft Word Desteği:** Tüm evrakları doğrudan düzenlenebilir `.docx` formatında bilgisayara kaydetme.
- **Gelişmiş CSS @media print:** Sayfa taşmasını ve imza bloklarının bölünmesini önleyen sayfalama kuralları.

### ☁️ 5. evrakplus.com Bulut Senkronizasyonu & Güvenlik
- **Çift Yönlü Eşitleme:** Masaüstü ve evrakplus.com web üyeliği arasında öğrenci ve olay verilerini bulutta güvenle saklama.
- **Otomatik AppData Yedekleme:** Windows AppData klasöründe son 20 veritabanı kopyasını otomatik saklayan yerel veri güvencesi.
- **MEB ve Fatih Projesi Ağ Uyumluluğu:** Okul ağlarındaki self-signed proxy sertifikası kısıtlamalarını aşan güvenli TLS köprüsü.
