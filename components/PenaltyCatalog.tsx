
import React, { useState, useEffect } from 'react';
import { 
  Gavel, Search, CheckCircle, ChevronRight, BookOpen, AlertCircle, X, Sparkles, Loader2
} from 'lucide-react';
import { useIncidents } from '../context/IncidentContext';
import { useStudents } from '../context/StudentContext';
import { useSettings } from '../context/SettingsContext';
import { getPenaltyRecommendation } from '../services/geminiService';

// ORTAOKUL VERİSİ (Madde 55)
const MIDDLE_SCHOOL_PENALTIES = {
  uyarma: {
    title: 'Uyarma',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    iconColor: 'text-blue-600',
    description: 'Bilinçlendirme ile düzeltilebilecek davranışlar için uygulanan yaptırım.',
    items: [
      { code: '1', text: 'Derse ve diğer etkinliklere vaktinde gelmemek ve geçerli bir neden olmaksızın bu davranışı tekrar etmek' },
      { code: '2', text: 'Okula özürsüz devamsızlığını alışkanlık hâline getirmek' },
      { code: '3', text: 'Yatılı bölge ortaokullarında öğrenci dolaplarını amacı dışında kullanmak' },
      { code: '4', text: 'Okula, yönetimce yasaklanmış malzeme getirmek ve bunları kullanmak' },
      { code: '5', text: 'Yalan söylemek' },
      { code: '6', text: 'Duvarları, sıraları ve okul çevresini kirletmek' },
      { code: '7', text: 'Görgü kurallarına uymamak' },
      { code: '8', text: 'Okul kütüphanesinden aldığı kitapları zamanında teslim etmemek' },
      { code: '10', text: 'Kılık ve kıyafetle ilgili kurallara uymamak' }
    ]
  },
  kinama: {
    title: 'Kınama',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    iconColor: 'text-yellow-600',
    description: 'Öğrenciye davranışının kusurlu olduğunun yazılı bildirilmesi.',
    items: [
      { code: '1', text: 'Yöneticilere, öğretmenlere, görevlilere ve arkadaşlarına kaba ve saygısız davranmak' },
      { code: '2', text: 'Okul kurallarını ve ders ortamını bozmak' },
      { code: '3', text: 'Okul yönetimini yanlış bilgilendirmek' },
      { code: '4', text: 'Törenlere özürsüz katılmamak' },
      { code: '5', text: 'Okulda ya da okul dışında sigara içmek' },
      { code: '6', text: 'Resmî evrakta değişiklik yapmak' },
      { code: '7', text: 'Okulda kavga etmek' },
      { code: '8', text: 'Sınıfta cep telefonu kullanmak' },
      { code: '9', text: 'Başkasının malını haberi olmadan almak' },
      { code: '10', text: 'Okul eşyasına zarar vermek' },
      { code: '15', text: 'Akran zorbalığı yapmak' }
    ]
  },
  degistirme: {
    title: 'Okul Değiştirme',
    color: 'bg-red-100 text-red-800 border-red-200',
    iconColor: 'text-red-600',
    description: 'Öğrencinin başka bir okula nakledilmesi.',
    items: [
      { code: '2', text: 'Sarkıntılık, hakaret, iftira, tehdit ve taciz etmek' },
      { code: '3', text: 'Okula yaralayıcı, öldürücü aletler getirmek' },
      { code: '9', text: 'Başkasının malına zarar vermeyi alışkanlık haline getirmek' },
      { code: '12', text: 'Okul personeline ve arkadaşlarına şiddet uygulamak' },
      { code: '16', text: 'Alkol veya bağımlılık yapan maddeleri kullanmak' },
      { code: '18', text: 'Bilişim araçlarıyla kişilik haklarını ihlal etmek (Ses/Görüntü kaydı)' }
    ]
  }
};

// LİSE VERİSİ (Madde 164)
const HIGH_SCHOOL_PENALTIES = {
  kinama: {
    title: 'Kınama',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    iconColor: 'text-yellow-600',
    description: 'Öğrenciye, cezayı gerektiren davranışta bulunduğunun ve tekrarından kaçınmasının kesin bir dille ve yazılı olarak bildirilmesidir.',
    items: [
      { code: 'a', text: 'Okulu, okul eşyasını ve çevresini kirletmek' },
      { code: 'b', text: 'Okul yönetimi veya öğretmenler tarafından verilen eğitim ve öğretime ilişkin görevleri yapmamak' },
      { code: 'c', text: 'Kılık-kıyafete ilişkin mevzuat hükümlerine uymamak' },
      { code: 'ç', text: 'Tütün, tütün mamulleri veya tütün içermeyen ancak tütün mamulünü taklit eder tarzda kullanılan her türlü ürünü bulundurmak veya kullanmak' },
      { code: 'd', text: 'Başkasına ait eşyayı izinsiz almak veya kullanmak' },
      { code: 'e', text: 'Yalan söylemek' },
      { code: 'f', text: 'Okula geldiği hâlde özürsüz eğitim ve öğretim faaliyetlerine katılmamak' },
      { code: 'g', text: 'Okul kütüphanesi ve laboratuvar malzemelerini eksik vermek veya kötü kullanmak' },
      { code: 'ğ', text: 'Okul yöneticilerine, öğretmenlerine, çalışanlarına ve arkadaşlarına kaba ve saygısız davranmak' },
      { code: 'h', text: 'Dersin ve ders dışı eğitim faaliyetlerinin akışını ve düzenini bozacak davranışlarda bulunmak' },
      { code: 'ı', text: 'Kopya çekmek veya çekilmesine yardımcı olmak' },
      { code: 'i', text: 'Yatılı okullarda pansiyon kurallarına uymamak' },
      { code: 'j', text: 'Müstehcen veya yasaklanmış araç, gereç ve dokümanları okula sokmak' },
      { code: 'k', text: 'Kumar oynamaya yarayan araç-gereç bulundurmak' },
      { code: 'l', text: 'Bilişim araçlarını belirlenen usul ve esaslara aykırı şekilde kullanmak' },
      { code: 'n', text: 'Ders saatleri içinde bilişim araçlarını açık tutarak dersin akışını bozmak' },
      { code: 'o', text: 'Eğitim ortamlarında okul yönetiminin izni dışında bilişim araçlarını yanında bulundurmak ve kullanmak' },
      { code: 'ö', text: 'Okula, okul yönetiminin izni dışında okulla ilgisi olmayan kişileri getirmek' }
    ]
  },
  uzaklastirma: {
    title: 'Kısa Süreli Uzaklaştırma',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    iconColor: 'text-orange-600',
    description: 'Okuldan 1-5 gün arasında uzaklaştırma cezasını gerektiren fiil ve davranışlar.',
    items: [
      { code: 'a', text: 'Okul personeline veya öğrencilere sözle, davranışla veya sosyal medya üzerinden hakaret etmek, tehdit etmek' },
      { code: 'b', text: 'Pansiyonun düzenini bozmak, pansiyonu terk etmek, gece izinsiz dışarıda kalmak' },
      { code: 'c', text: 'Ayrımcılığı körükleyici davranışlarda bulunmak' },
      { code: 'ç', text: 'Okul binası ve eklentilerinde izinsiz gösteri, etkinlik ve toplantı düzenlemek' },
      { code: 'd', text: 'Her türlü ortamda kumar oynamak veya oynatmak' },
      { code: 'e', text: 'Okul kurallarının uygulanmasını engellemek' },
      { code: 'g', text: 'Yasaklanmış araç, gereç ve dokümanları paylaşmak, dağıtmak' },
      { code: 'ğ', text: 'Bilişim araçları veya sosyal medya yoluyla eğitim faaliyetlerine veya kişilere zarar vermek' },
      { code: 'ı', text: 'Kavga etmek, başkalarına fiili şiddet uygulamak' },
      { code: 'j', text: 'Toplu kopya çekmek veya çekilmesine yardımcı olmak' },
      { code: 'k', text: 'Sarhoşluk veren zararlı maddeleri bulundurmak veya kullanmak' },
      { code: 'm', text: 'Okul personelinin malına zarar vermek' },
      { code: 'n', text: 'İzinsiz olarak görüntü çekmek, kaydetmek, paylaşmak' },
      { code: 'ö', text: 'Akran zorbalığı yapmak' }
    ]
  },
  degistirme: {
    title: 'Okul Değiştirme',
    color: 'bg-red-100 text-red-800 border-red-200',
    iconColor: 'text-red-600',
    description: 'Öğrencinin başka bir okula naklinin yapılması.',
    items: [
      { code: 'a', text: 'Türk Bayrağına, ülkeyi, milleti ve devleti temsil eden sembollere saygısızlık etmek' },
      { code: 'b', text: 'Millî ve manevi değerleri aşağılamak, hakaret etmek' },
      { code: 'ç', text: 'Hırsızlık yapmak' },
      { code: 'e', text: 'Resmî belgelerde değişiklik yapmak; sahte belge düzenlemek' },
      { code: 'g', text: 'Okula ait taşınır veya taşınmaz mallara zarar vermek' },
      { code: 'h', text: 'Eğitim ortamına yaralayıcı, öldürücü silah ve alet getirmek' },
      { code: 'ı', text: 'Zor kullanarak veya tehditle kopya çekmek' },
      { code: 'i', text: 'Bağımlılık yapan zararlı maddeleri bulundurmak veya kullanmak' },
      { code: 'k', text: 'Siyasi ve ideolojik amaçlı eylem düzenlemek, katılmak' },
      { code: 'm', text: 'Bilişim araçları veya sosyal medya yoluyla kişilere ağır derecede maddi ve manevi zarar vermek' },
      { code: 'r', text: 'Sarkıntılık, iftira, taciz etmek veya bunları sosyal medyada paylaşmak' },
      { code: 'ş', text: 'Kesici, delici aletlerle kendine zarar vermek' }
    ]
  },
  orgun_disi: {
    title: 'Örgün Eğitim Dışına Çıkarma',
    color: 'bg-slate-800 text-white border-slate-900',
    iconColor: 'text-slate-300',
    description: 'Öğrencinin örgün ortaöğretim kurumları ile ilişiğinin kesilmesidir.',
    items: [
      { code: 'a', text: 'Türk Bayrağına, sembollere hakaret etmek' },
      { code: 'b', text: 'Bölücü ve yıkıcı toplu eylemler düzenlemek veya katılmak' },
      { code: 'd', text: 'Bağımlılık yapan zararlı maddelerin ticaretini yapmak' },
      { code: 'g', text: 'Okul personeline karşı saldırıda bulunmak' },
      { code: 'ı', text: 'Silah veya güç kullanarak yaralamak, öldürmek' },
      { code: 'i', text: 'Cinsel istismar ve bu konuda suç sayılan fiilleri işlemek' },
      { code: 'j', text: 'Çete kurmak, gasp, haraç almak' },
      { code: 'l', text: 'Bilişim araçlarıyla bölücü, ahlak dışı ve şiddeti özendiren içerik yaymak' }
    ]
  }
};

const PenaltyCatalog = () => {
  const { incidents, updateIncidentStudent } = useIncidents();
  const { students } = useStudents();
  const { institution } = useSettings();

  // Okul Türünü Belirle
  const isHighSchool = institution.type !== 'Ortaokul';
  const dataSet = isHighSchool ? HIGH_SCHOOL_PENALTIES : MIDDLE_SCHOOL_PENALTIES;
  
  // Default active tab depends on school type
  const [activeTab, setActiveTab] = useState<string>(isHighSchool ? 'kinama' : 'uyarma');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection State for "Proposal"
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // AI Recommendation State
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Tab reset effect when school type changes
  useEffect(() => {
    setActiveTab(isHighSchool ? 'kinama' : 'uyarma');
  }, [isHighSchool]);

  // Reset AI suggestion when selections change
  useEffect(() => {
    setAiSuggestion(null);
  }, [selectedIncidentId, selectedStudentId]);

  // Helpers
  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);
  const incidentStudents = selectedIncident 
    ? selectedIncident.involvedStudents.map(rel => ({
        ...students.find(s => s.id === rel.studentId),
        role: rel.role,
        currentDecision: rel.decision
      })).filter(s => s.id && s.role === 'suspect') // Sadece faillere ceza verilir
    : [];

  const handleApplyPenalty = (penaltyName: string, itemCode: string, itemText: string) => {
    if (!selectedIncidentId || !selectedStudentId) {
      alert("Lütfen önce yukarıdan bir olay ve öğrenci seçiniz.");
      return;
    }

    updateIncidentStudent(selectedIncidentId, selectedStudentId, {
      decision: penaltyName.toUpperCase(),
      decisionReason: `Madde ${isHighSchool ? '164' : '55'}/${isHighSchool ? '2' : '1'}-${itemCode}) ${itemText}`,
      decisionDate: new Date().toISOString().split('T')[0]
    });
    
    setSuccessMessage(`"${penaltyName}" teklifi başarıyla kaydedildi. 'Karar ve Evrak > Karar ve Tebligat' menüsünden işlemi tamamlayabilirsiniz.`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleGetAiSuggestion = async () => {
      if (!selectedIncident || !selectedStudentId) return;
      const student = students.find(s => s.id === selectedStudentId);
      if (!student) return;

      setLoadingAi(true);
      const result = await getPenaltyRecommendation(selectedIncident, student, institution.type);
      setAiSuggestion(result);
      setLoadingAi(false);
  };

  const currentCategory = dataSet[activeTab as keyof typeof dataSet];
  const filteredItems = currentCategory ? currentCategory.items.filter((item: { text: string }) => 
    item.text.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <div className="p-8 max-w-7xl mx-auto h-screen flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Gavel className="w-8 h-8 text-blue-600" />
             Yaptırım Gerektiren Davranışlar
           </h1>
           <p className="text-slate-500">
             {isHighSchool ? 'Ortaöğretim Kurumları Yönetmeliği (Lise)' : 'İlköğretim Kurumları Yönetmeliği (Ortaokul)'} esaslarına göre yaptırım türleri.
           </p>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 bg-green-50 text-green-700 p-4 rounded-lg border border-green-200 flex items-center animate-fade-in shadow-sm shrink-0">
           <CheckCircle className="w-5 h-5 mr-3 shrink-0" />
           <span className="font-medium text-sm">{successMessage}</span>
           <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-600 hover:text-green-800">
             <X className="w-4 h-4" />
           </button>
        </div>
      )}

      {/* --- SELECTION PANEL (PROPOSAL SYSTEM) --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 shrink-0 space-y-4">
         <div className="flex items-center gap-2 mb-3 text-blue-800 font-bold border-b border-blue-50 pb-2">
            <AlertCircle className="w-5 h-5" />
            Ceza Teklifi / Uygulama Paneli
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">1. Olay Seçiniz</label>
                <select 
                    value={selectedIncidentId}
                    onChange={e => { setSelectedIncidentId(e.target.value); setSelectedStudentId(''); }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                >
                    <option value="">-- Olay Seçimi Yapınız --</option>
                    {incidents.map(inc => (
                        <option key={inc.id} value={inc.id}>{inc.code} - {inc.title}</option>
                    ))}
                </select>
             </div>
             <div className="flex gap-2">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">2. Öğrenci Seçiniz (Fail)</label>
                    <select 
                        value={selectedStudentId}
                        onChange={e => setSelectedStudentId(e.target.value)}
                        disabled={!selectedIncidentId}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                        <option value="">-- Öğrenci Seçimi Yapınız --</option>
                        {incidentStudents.length === 0 && selectedIncidentId && <option disabled>Bu olayda fail kaydı yok.</option>}
                        {incidentStudents.map((s) => (
                            <option key={s.id} value={s.id}>
                            {s.name} {s.currentDecision ? `(Mevcut: ${s.currentDecision})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <button 
                    onClick={handleGetAiSuggestion}
                    disabled={!selectedIncidentId || !selectedStudentId || loadingAi}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    title="Yapay zeka olayı analiz edip ceza önerebilir"
                >
                    {loadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    AI Ceza Önerisi
                </button>
             </div>
         </div>

         {/* AI Result Area */}
         {aiSuggestion && (
             <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl animate-fade-in relative">
                 <button onClick={() => setAiSuggestion(null)} className="absolute top-2 right-2 text-purple-400 hover:text-purple-700"><X className="w-4 h-4" /></button>
                 <h4 className="flex items-center gap-2 font-bold text-purple-800 mb-2">
                     <Sparkles className="w-4 h-4" /> Yapay Zeka Önerisi
                 </h4>
                 <div className="text-sm text-purple-900 whitespace-pre-wrap leading-relaxed font-medium">
                     {aiSuggestion}
                 </div>
                 <div className="mt-3 text-xs text-purple-600 italic border-t border-purple-200 pt-2">
                     * Bu bir öneridir. Kesin karar disiplin kuruluna aittir. Öneriyi dikkate alarak aşağıdaki listeden ilgili maddeyi seçiniz.
                 </div>
             </div>
         )}

         {selectedIncidentId && selectedStudentId && !aiSuggestion && (
             <div className="mt-2 text-xs text-green-600 bg-green-50 p-2 rounded flex items-center gap-2">
                 <CheckCircle className="w-4 h-4" />
                 Seçim aktif. Aşağıdaki maddelerden birine tıklayarak teklifi kaydedebilirsiniz.
             </div>
         )}
      </div>

      {/* --- TABS --- */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 shrink-0">
        {Object.entries(dataSet).map(([key, data]) => (
            <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all whitespace-nowrap ${
                    activeTab === key 
                    ? data.color + ' ring-2 ring-offset-2 ring-transparent' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
                <BookOpen className={`w-4 h-4 ${activeTab === key ? '' : 'text-slate-400'}`} />
                <span className="font-bold text-sm">{data.title}</span>
            </button>
        ))}
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
          {/* Header & Filter */}
          <div className={`p-6 border-b border-slate-100 ${currentCategory.color.replace('text-', 'bg-opacity-10 bg-')}`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                      <h2 className={`text-xl font-bold flex items-center gap-2 ${currentCategory.iconColor}`}>
                          {currentCategory.title}
                      </h2>
                      <p className="text-sm opacity-80 mt-1 max-w-2xl">{currentCategory.description}</p>
                  </div>
                  <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Madde ara (örn: sigara, kavga)..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 shadow-sm text-slate-700"
                      />
                  </div>
              </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 bg-slate-50">
              <div className="grid gap-3">
                  {filteredItems.length === 0 ? (
                      <div className="p-10 text-center text-slate-400">Aranan kriterde madde bulunamadı.</div>
                  ) : (
                      filteredItems.map((item, idx: number) => (
                          <div key={idx} className="group bg-white p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex justify-between items-center gap-4">
                              <div className="flex gap-4">
                                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${currentCategory.color.replace('border-', '')}`}>
                                      {item.code}
                                  </span>
                                  <p className="text-slate-700 text-sm leading-relaxed pt-1.5">{item.text}</p>
                              </div>
                              
                              {/* Apply Button */}
                              <button 
                                onClick={() => handleApplyPenalty(currentCategory.title, item.code, item.text)}
                                disabled={!selectedIncidentId || !selectedStudentId}
                                className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                                    selectedIncidentId && selectedStudentId 
                                    ? 'bg-slate-800 text-white hover:bg-slate-700 shadow-sm' 
                                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                }`}
                              >
                                  Teklifi Kaydet
                                  <ChevronRight className="w-3 h-3" />
                              </button>
                          </div>
                      ))
                  )}
              </div>
          </div>
          
          <div className="p-3 bg-white border-t border-slate-200 text-xs text-slate-400 flex justify-between">
             <span>{isHighSchool ? 'Ortaöğretim Kurumları Yönetmeliği Madde 164' : 'İlköğretim Kurumları Yönetmeliği Madde 55'}</span>
             <span>Toplam {currentCategory.items.length} madde listelendi.</span>
          </div>
      </div>
    </div>
  );
};

export default PenaltyCatalog;
