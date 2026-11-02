# Sürüm Geçmişi (Changelog)

**E-Okul Disiplin AI Pro** projesine ait tüm önemli değişiklikler bu dosyada belgelenmektedir.

Proje Sahibi ve Geliştiricisi: **By Abdullah Yanarateş**

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
