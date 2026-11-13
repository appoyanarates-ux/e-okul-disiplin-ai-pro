
import React, { useState } from 'react';
import { 
  HelpCircle, FileSpreadsheet, 
  ChevronDown, ChevronUp, BookOpen, Settings, Users, AlertTriangle, FileText, Gavel
} from 'lucide-react';

const HelpBackup = () => {
  const [openSection, setOpenSection] = useState<string | null>('step1');

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };

  const steps = [
    {
      id: 'step1',
      icon: Settings,
      title: '1. Adım: Kurulum ve Ayarlar (Başlangıç)',
      content: (
        <div className="space-y-2">
            <p>Uygulamayı kullanmaya başlamadan önce Kontrol Panelinin en başında bulunan <strong>Kurum Ayarları</strong> menüsünü yapılandırın:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li><strong>Kurum Bilgileri:</strong> Okul adı, müdür adı ve il/ilçe bilgileri tüm resmi evraklara otomatik yansır.</li>
                <li><strong>Okul Türü:</strong> Lise veya Ortaokul seçimi, disiplin yönetmeliği maddelerinin (Madde 164 veya 55) otomatik ayarlanmasını sağlar.</li>
                <li><strong>Yapay Zeka (AI):</strong> Gemini API anahtarınızı girerek olay analizi ve otomatik taslak oluşturma özelliklerini aktif hale getirin. Program her türlü Gemini API anahtarını ve modellerini (Gemini 2.0 Flash, 1.5 Flash vb.) otomatik algılar.</li>
            </ul>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1">🛡️ Windows SmartScreen ("Windows kişisel bilgisayarınızı korudu") Uyarısı Çıkarsa:</p>
                <p>Windows ilk kurulumda mavi renkli Microsoft Defender ekranı gösterdiğinde: Ekranda yer alan <strong>"Ek bilgi"</strong> bağlantısına tıklayın ve ardından altta açılan <strong>"Yine de çalıştır"</strong> butonuna basın. Kurulum güvenle başlayacaktır.</p>
            </div>
        </div>
      )
    },
    {
      id: 'step2',
      icon: Users,
      title: '2. Adım: Öğrenci Veritabanı',
      content: (
        <div className="space-y-2">
          <p><strong>Öğrenci İşlemleri</strong> menüsünden okulunuzun öğrenci listesini oluşturun:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Excel Yükle:</strong> e-Okul'dan alacağınız standart "Öğrenci Künye Defteri" Excel dosyasını sisteme yükleyin. Sistem; öğrenci adresi, doğum yeri, baba adı gibi detayları otomatik olarak alır ve evraklara işler.</li>
            <li><strong>Manuel Ekleme:</strong> Dilerseniz öğrencileri tek tek de ekleyebilirsiniz.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'step3',
      icon: AlertTriangle,
      title: '3. Adım: Olay Kaydı Oluşturma',
      content: (
        <div className="space-y-2">
            <p><strong>Olay İşlemleri</strong> menüsünden disiplin sürecini başlatın:</p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                <li><strong>Yeni Olay:</strong> Olayın tarihi, saati, yeri ve özetini girerek kaydedin.</li>
                <li><strong>Öğrenci Ekleme:</strong> Üstteki sekmeden "Öğrenci Ekleme" ekranına geçin. Bu olaya karışan öğrencileri "Fail", "Tanık" veya "Mağdur" olarak atayın.</li>
            </ol>
            <p className="text-xs text-orange-600 mt-1">* Fail eklenmeyen olaylarda ceza süreci başlatılamaz.</p>
        </div>
      )
    },
    {
      id: 'step4',
      icon: BookOpen,
      title: '4. Adım: Ceza Maddesi Belirleme (Teklif)',
      content: (
        <div className="space-y-2">
             <p>Öğrenciye verilecek cezayı belirlemek için <strong>Disiplin Cezaları</strong> menüsünü kullanın:</p>
             <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Panelin üst kısmından ilgili <strong>Olayı</strong> ve <strong>Fail Öğrenciyi</strong> seçin.</li>
                <li>İsterseniz <strong>"AI Ceza Önerisi"</strong> butonuna basarak yapay zekadan tavsiye alın.</li>
                <li>Listeden uygun maddeyi bulup <strong>"Teklifi Kaydet"</strong> butonuna basın. Bu işlem, seçilen maddeyi karar ekranına otomatik taşır.</li>
             </ul>
        </div>
      )
    },
    {
      id: 'step5',
      icon: FileText,
      title: '5. Adım: Tutanak ve Evrak Hazırlama',
      content: (
        <div className="space-y-2">
            <p><strong>Karar ve Evrak</strong> menüsünde soruşturma sürecini yönetin:</p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                <li><strong>Toplantı Yönetimi:</strong> Kurul üyeleri için çağrı yazısı ve öğrenci/veli çağrı pusulalarını oluşturun.</li>
                <li><strong>Tutanak ve Formlar:</strong> "İfade Tutanağı", "Savunma İsteme", "Veli Görüşme" gibi evrakları seçin.</li>
                <li><strong>Otomatik Doldurma:</strong> Öğrenci veritabanındaki detaylı bilgiler (Adres, Baba Adı vb.) formlardaki ilgili boşluklara otomatik olarak yerleşir.</li>
            </ol>
        </div>
      )
    },
    {
      id: 'step6',
      icon: Gavel,
      title: '6. Adım: Karar Alma ve Tebligat',
      content: (
        <div className="space-y-2">
            <p>Sürecin son aşaması olan <strong>Karar ve Tebligat</strong> sekmesine gelin:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Sol menüden Olay ve Öğrenciyi seçtiğinizde, 4. adımda yaptığınız ceza teklifi ekrana gelir.</li>
                <li>Karar No, Karar Tarihi ve Ceza Puanını kontrol edip <strong>"Kararı Kaydet"</strong> butonuna basın.</li>
                <li><strong>EK-10 Karar Tutanağı</strong> ve <strong>Yaptırım Tebliğ (Öğrenci/Veli)</strong> evraklarını yazdırarak dosyayı kapatın.</li>
            </ul>
        </div>
      )
    }
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto pb-20">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <HelpCircle className="w-8 h-8 text-blue-600" />
        Yardım
      </h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-slate-500" />
                    Uygulama Kullanım Kılavuzu
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                    Disiplin süreçlerinin yönetimi ve uygulama özellikleri hakkında adım adım rehber.
                </p>
           </div>
           
           <div className="p-6 space-y-3 bg-slate-50">
             {steps.map((step) => (
               <div key={step.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                 <button 
                    onClick={() => toggleSection(step.id)}
                    className="w-full flex justify-between items-center p-4 bg-white hover:bg-slate-50 transition-colors text-left"
                 >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${openSection === step.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                            <step.icon className="w-5 h-5" />
                        </div>
                        <span className={`font-semibold text-sm ${openSection === step.id ? 'text-blue-700' : 'text-slate-700'}`}>{step.title}</span>
                    </div>
                    {openSection === step.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                 </button>
                 {openSection === step.id && (
                    <div className="p-4 pl-[4.5rem] text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                        {step.content}
                    </div>
                 )}
               </div>
             ))}
           </div>

           <div className="p-6 border-t border-slate-200 bg-white">
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 items-start">
                <FileSpreadsheet className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                    <h4 className="font-bold text-blue-800 text-sm">MEB Excel Formatı Hakkında</h4>
                    <p className="text-xs text-blue-700 mt-1">
                        Toplu öğrenci yükleme özelliği, e-Okul'dan alınan standart <strong>"Öğrenci Künye Defteri"</strong> raporu ile tam uyumludur. Dosyanızın yapısını bozmadan doğrudan yükleyebilirsiniz.
                    </p>
                </div>
             </div>
           </div>
      </div>
    </div>
  );
};

export default HelpBackup;
