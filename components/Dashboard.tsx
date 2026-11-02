
import React from 'react';
import { 
  Users, AlertTriangle, FileCheck, Scale, 
  FileText, TrendingUp, Book, Mail, FilePlus, Settings, RotateCcw, AlertCircle, Briefcase, FileSpreadsheet, Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import IncidentCalendar from './IncidentCalendar';

const Card = ({ 
  title, 
  icon: Icon, 
  color, 
  to, 
  description,
  badge 
}: { 
  title: string, 
  icon: React.ElementType, 
  color: string, 
  to: string, 
  description: string,
  badge?: React.ReactNode
}) => (
  <Link to={to} className="group relative bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-1 h-full flex flex-col justify-between">
    {badge && <div className="absolute top-4 right-4 z-10">{badge}</div>}
    <div>
        <div className={`w-12 h-12 rounded-xl ${color} bg-opacity-10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
           <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
    <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={`text-xs font-bold ${color.replace('bg-', 'text-')} bg-slate-50 px-2 py-1 rounded`}>Git &rarr;</span>
    </div>
  </Link>
);

const Dashboard = () => {
  const { apiKey } = useSettings();
  const showApiWarning = !apiKey || apiKey.trim() === '';

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kontrol Paneli</h1>
          <p className="text-slate-500">Disiplin süreçlerini yönetmek için aşağıdaki menüleri kullanabilirsiniz.</p>
        </div>

        {showApiWarning && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-lg animate-pulse">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-650"></span>
            </span>
            <span>AI Sistemi Eksik Yapılandırma!</span>
          </div>
        )}
      </div>

      {showApiWarning && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-8 flex items-start gap-4 shadow-xs relative overflow-hidden transition-all duration-300">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
          <div className="flex-shrink-0 bg-red-100 p-2.5 rounded-xl text-red-600">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-800 text-sm flex items-center gap-2">
              Gemini Yapay Zeka (AI) API Anahtarı Eksik!
            </h3>
            <p className="text-xs text-red-600 leading-relaxed mt-1">
              "AI Karar Destek", olay analizi ve otomatik kurul tutanakları oluşturma özelliklerinin aktif çalışabilmesi için geçerli bir Gemini API anahtarına sahip olmanız gerekmektedir. 
            </p>
            <div className="mt-3 flex items-center gap-4">
              <Link to="/settings" className="text-xs font-bold bg-red-650 text-white hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors shadow-xs">
                Hemen API Anahtarı Tanımla &rarr;
              </Link>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                referrerPolicy="no-referrer"
                className="text-xs font-medium text-red-650 hover:text-red-800 underline flex items-center gap-1"
              >
                Ücretsiz API Key Al
              </a>
            </div>
          </div>
        </div>
      )}

      {/* DİSİPLİN OLAY TAKVİMİ & KRONOLOJİ GÖRÜNÜMÜ */}
      <div className="mb-8" id="incident-calendar">
        <IncidentCalendar />
      </div>

      <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
            <span className="w-2 h-6 bg-slate-800 rounded-full"></span>
            <h2 className="text-lg font-bold text-slate-700">GENEL İŞLEMLER &amp; MODÜLLER</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Olay Takvimi Kısayolu */}
            <a 
              href="#incident-calendar" 
              className="group relative bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-1 h-full flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-600 bg-opacity-10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Olay Takvimi</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Aylık takvim ve kronolojik zaman çizelgesinde olayları görüntüle.</p>
              </div>
              <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs font-bold text-blue-600 bg-slate-50 px-2 py-1 rounded">Görüntüle &darr;</span>
              </div>
            </a>

            {/* 0. Kurum Ayarları (En Başa Taşındı) */}
            <Card 
              title="Kurum Ayarları" 
              icon={Settings} 
              color="bg-gray-600" 
              to="/settings" 
              description="Okul bilgileri, müdür ve disiplin kurulu üyelerini yapılandır." 
              badge={showApiWarning ? (
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-650 shadow-md border border-white"></span>
                </span>
              ) : undefined}
            />

            {/* 1. Veri Tabanı */}
            <Card 
              title="Öğrenci Listesi" 
              icon={Users} 
              color="bg-blue-600" 
              to="/students" 
              description="Öğrenci veritabanını görüntüle, yeni kayıt ekle veya Excel'den aktar." 
            />

            {/* MESEM Yönetimi */}
            <Card 
              title="MESEM Yönetimi" 
              icon={Briefcase} 
              color="bg-indigo-600" 
              to="/mesem" 
              description="Mesleki Eğitim Merkezi işletme, koordinatör öğretmen ve esnek Excel yükleme işlemleri." 
            />

            {/* 2. Olay Girişleri */}
            <Card 
              title="Olay Kaydı Oluştur" 
              icon={AlertTriangle} 
              color="bg-red-500" 
              to="/incidents" 
              description="Yeni bir disiplin olayını sisteme kaydet ve detaylarını gir." 
            />
             <Card 
              title="Olaya Öğrenci Ekle" 
              icon={FilePlus} 
              color="bg-orange-500" 
              to="/incidents" 
              description="Mevcut bir olaya fail veya tanık öğrenci eklemesi yap." 
            />

            {/* 3. Süreç ve Karar */}
            <Card 
              title="Tutanak Hazırla" 
              icon={FileText} 
              color="bg-indigo-500" 
              to="/decisions" 
              description="İfade tutanağı ve savunma isteme yazılarını otomatik oluştur." 
            />
            <Card 
              title="AI Karar Destek" 
              icon={Scale} 
              color="bg-emerald-600" 
              to="/decisions" 
              description="Yapay zeka ile olayı analiz et ve kurul kararı taslağı çıkar." 
              badge={showApiWarning ? (
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-650 shadow-md border border-white"></span>
                </span>
              ) : undefined}
            />
            <Card 
              title="Veli Bildirimi" 
              icon={Mail} 
              color="bg-amber-500" 
              to="/decisions" 
              description="Veli çağrı pusulası ve bilgilendirme evraklarını hazırla." 
            />
             <Card 
              title="Ceza Tebligatı" 
              icon={FileCheck} 
              color="bg-teal-500" 
              to="/decisions" 
              description="Kesinleşen cezaların resmi tebliğ evraklarını görüntüle." 
            />

            {/* 4. Referans ve Rapor */}
             <Card 
              title="Ceza Silme İşlemleri cursor-pointer" 
              icon={RotateCcw} 
              color="bg-cyan-600" 
              to="/penalty-removal" 
              description="Ceza alan öğrencilerin durumunu görüşmek için toplantı evrağı hazırla." 
            />

            <Card 
              title="Mevzuat Asistanı" 
              icon={Book} 
              color="bg-slate-600" 
              to="/regulations" 
              description="Yönetmelik maddeleri ve disiplin cezaları hakkında arama yap." 
            />
            <Card 
              title="İstatistikler" 
              icon={TrendingUp} 
              color="bg-purple-600" 
              to="/statistics" 
              description="Olay türleri, sınıf dağılımları ve ceza oranlarını incele." 
            />
            <Card 
              title="Rapor & Dışa Aktar" 
              icon={FileSpreadsheet} 
              color="bg-emerald-600" 
              to="/export" 
              description="Disiplin Karar Defteri, öğrenci künyeleri ve ceza kayıtlarını PDF/Excel formatında indir." 
            />
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
