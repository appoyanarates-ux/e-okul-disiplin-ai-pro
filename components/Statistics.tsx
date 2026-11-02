
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import { Filter, FolderOpen, Edit, X, Gavel, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useIncidents } from '../context/IncidentContext';
import { useStudents } from '../context/StudentContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

const Statistics = () => {
  const { incidents } = useIncidents();
  const { students } = useStudents();
  const navigate = useNavigate();

  // State for active filter selection
  const [activeFilter, setActiveFilter] = useState<'all' | 'decided' | 'pending' | 'penalty' | null>(null);

  // --- HESAPLAMALAR ---
  const stats = useMemo(() => {
    const total = incidents.length;
    const decided = incidents.filter(i => i.status === 'decided').length;
    const pending = total - decided;

    // Ceza Alan Olaylar (İçinde en az bir ceza barındıran olay sayısı)
    let penaltyIncidentCount = 0;
    
    // Ceza Oranı Hesaplama
    let totalDecisions = 0;
    let totalPenalties = 0;

    incidents.forEach(inc => {
        let hasPenalty = false;
        inc.involvedStudents.forEach(s => {
            if (s.decision) {
                totalDecisions++;
                if (!s.decision.includes('YER OLMADIĞINA')) {
                    totalPenalties++;
                    hasPenalty = true;
                }
            }
        });
        if (hasPenalty) penaltyIncidentCount++;
    });

    const penaltyRate = totalDecisions > 0 ? Math.round((totalPenalties / totalDecisions) * 100) : 0;

    return { total, decided, pending, penaltyRate, penaltyIncidentCount };
  }, [incidents]);

  // --- FİLTRELENMİŞ LİSTE ---
  const filteredList = useMemo(() => {
    if (!activeFilter) return [];
    
    switch (activeFilter) {
        case 'decided':
            return incidents.filter(i => i.status === 'decided');
        case 'pending':
            return incidents.filter(i => i.status !== 'decided');
        case 'penalty':
            // İçinde ceza alan öğrenci olan olayları getir
            return incidents.filter(inc => 
                inc.involvedStudents.some(s => s.decision && !s.decision.includes('YER OLMADIĞINA'))
            );
        case 'all':
        default:
            return incidents;
    }
  }, [activeFilter, incidents]);

  // --- GRAFİK VERİLERİ ---
  const incidentTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(inc => {
        const title = inc.title.trim();
        counts[title] = (counts[title] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
  }, [incidents]);

  const gradeLevelData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(inc => {
        inc.involvedStudents.forEach(inv => {
            const student = students.find(s => s.id === inv.studentId);
            if (student && student.grade) {
                const gradeKey = student.grade; 
                counts[gradeKey] = (counts[gradeKey] || 0) + 1;
            }
        });
    });
    return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  }, [incidents, students]);

  // --- ACTIONS ---
  const handleEdit = (id?: string) => {
    navigate('/incidents' + (id ? `?incidentId=${id}` : '')); 
  };

  const handleDecision = (id?: string) => {
    navigate('/decisions?tab=decision' + (id ? `&incidentId=${id}` : ''));
  };

  if (incidents.length === 0) {
      return (
          <div className="p-8 flex flex-col items-center justify-center h-full text-slate-400">
              <h1 className="text-2xl font-bold text-slate-800 mb-2">İstatistikler</h1>
              <p>Henüz yeterli veri girişi yapılmadı. Olay kaydettikçe grafikler oluşacaktır.</p>
          </div>
      );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Disiplin İstatistikleri ve Dosya Yönetimi</h1>
        <Link
          to="/export"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer w-fit"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Rapor & Dışa Aktar (PDF / Excel)</span>
        </Link>
      </div>

      {/* STAT CARDS (CLICKABLE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Card 1: Total */}
        <div 
            onClick={() => setActiveFilter(activeFilter === 'all' ? null : 'all')}
            className={`p-6 rounded-xl shadow-sm border transition-all cursor-pointer hover:-translate-y-1 ${activeFilter === 'all' ? 'bg-slate-50 border-slate-400 ring-2 ring-slate-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}
        >
          <div className="flex justify-between items-start">
             <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Toplam Olay</h3>
                <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                <span className="text-xs text-slate-400 font-medium">Sistemdeki tüm kayıtlar</span>
             </div>
             <FolderOpen className={`w-8 h-8 ${activeFilter === 'all' ? 'text-slate-600' : 'text-slate-200'}`} />
          </div>
          {activeFilter === 'all' && <div className="mt-2 text-xs text-blue-600 font-bold flex items-center gap-1"><Filter className="w-3 h-3"/> Listeleniyor</div>}
        </div>

        {/* Card 2: Decided */}
        <div 
            onClick={() => setActiveFilter(activeFilter === 'decided' ? null : 'decided')}
            className={`p-6 rounded-xl shadow-sm border transition-all cursor-pointer hover:-translate-y-1 ${activeFilter === 'decided' ? 'bg-green-50 border-green-400 ring-2 ring-green-200' : 'bg-white border-slate-100 hover:border-green-300'}`}
        >
           <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Karara Bağlanan</h3>
                <p className="text-3xl font-bold text-green-600">{stats.decided}</p>
                <span className="text-xs text-slate-400 font-medium">Dosyası kapanan olaylar</span>
              </div>
              <CheckCircle className={`w-8 h-8 ${activeFilter === 'decided' ? 'text-green-600' : 'text-green-100'}`} />
           </div>
           {activeFilter === 'decided' && <div className="mt-2 text-xs text-green-700 font-bold flex items-center gap-1"><Filter className="w-3 h-3"/> Listeleniyor</div>}
        </div>

        {/* Card 3: Pending */}
        <div 
            onClick={() => setActiveFilter(activeFilter === 'pending' ? null : 'pending')}
            className={`p-6 rounded-xl shadow-sm border transition-all cursor-pointer hover:-translate-y-1 ${activeFilter === 'pending' ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200' : 'bg-white border-slate-100 hover:border-orange-300'}`}
        >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Bekleyen Dosya</h3>
                <p className="text-3xl font-bold text-orange-500">{stats.pending}</p>
                <span className="text-xs text-slate-400 font-medium">İşlem bekleyen olaylar</span>
              </div>
              <AlertCircle className={`w-8 h-8 ${activeFilter === 'pending' ? 'text-orange-500' : 'text-orange-100'}`} />
            </div>
            {activeFilter === 'pending' && <div className="mt-2 text-xs text-orange-700 font-bold flex items-center gap-1"><Filter className="w-3 h-3"/> Listeleniyor</div>}
        </div>

        {/* Card 4: Penalty */}
        <div 
            onClick={() => setActiveFilter(activeFilter === 'penalty' ? null : 'penalty')}
            className={`p-6 rounded-xl shadow-sm border transition-all cursor-pointer hover:-translate-y-1 ${activeFilter === 'penalty' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' : 'bg-white border-slate-100 hover:border-blue-300'}`}
        >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Ceza Verilen Olay</h3>
                <p className="text-3xl font-bold text-blue-500">{stats.penaltyIncidentCount}</p>
                <span className="text-xs text-slate-400 font-medium">Genel Ceza Oranı: %{stats.penaltyRate}</span>
              </div>
              <Gavel className={`w-8 h-8 ${activeFilter === 'penalty' ? 'text-blue-500' : 'text-blue-100'}`} />
            </div>
            {activeFilter === 'penalty' && <div className="mt-2 text-xs text-blue-700 font-bold flex items-center gap-1"><Filter className="w-3 h-3"/> Listeleniyor</div>}
        </div>
      </div>

      {/* ACTIVE FILTER LIST */}
      {activeFilter && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-8 animate-fade-in ring-1 ring-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    {activeFilter === 'all' && 'Tüm Olay Listesi'}
                    {activeFilter === 'decided' && 'Karara Bağlanmış Dosyalar'}
                    {activeFilter === 'pending' && 'İşlem Bekleyen Açık Dosyalar'}
                    {activeFilter === 'penalty' && 'Ceza Uygulanan Olaylar'}
                </h3>
                <button onClick={() => setActiveFilter(null)} className="text-slate-400 hover:text-red-500 p-1">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 shadow-sm">
                        <tr>
                            <th className="p-3 font-semibold text-slate-600">Tarih</th>
                            <th className="p-3 font-semibold text-slate-600">Kod</th>
                            <th className="p-3 font-semibold text-slate-600">Olay Adı</th>
                            <th className="p-3 font-semibold text-slate-600 text-center">Durum</th>
                            <th className="p-3 font-semibold text-slate-600 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredList.length === 0 ? (
                            <tr><td colSpan={5} className="p-6 text-center text-slate-400">Bu kategoride kayıt bulunamadı.</td></tr>
                        ) : (
                            filteredList.map(inc => (
                                <tr key={inc.id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="p-3 text-slate-500 font-mono text-xs">{inc.date}</td>
                                    <td className="p-3 font-bold text-slate-700">{inc.code}</td>
                                    <td className="p-3 text-slate-800">{inc.title}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${inc.status === 'decided' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {inc.status === 'decided' ? 'KARARA BAĞLANDI' : 'BEKLEMEDE'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleEdit(inc.id)}
                                                className="flex items-center gap-1 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-300 px-2 py-1 rounded shadow-sm text-xs"
                                                title="Düzenle / Detay"
                                            >
                                                <Edit className="w-3 h-3" /> Düzenle
                                            </button>
                                            <button 
                                                onClick={() => handleDecision(inc.id)}
                                                className="flex items-center gap-1 text-slate-500 hover:text-red-600 bg-white border border-slate-200 hover:border-red-300 px-2 py-1 rounded shadow-sm text-xs"
                                                title="Karar ve Evrak"
                                            >
                                                <Gavel className="w-3 h-3" /> Karar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* CHARTS (Only show if not filtering, or below filter) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-[400px]">
          <h2 className="text-lg font-bold text-slate-700 mb-4">En Sık Yaşanan Olaylar (Top 5)</h2>
          {incidentTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                data={incidentTypeData}
                margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
                >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12}} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} name="Olay Sayısı" />
                </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">Veri yok</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-[400px]">
          <h2 className="text-lg font-bold text-slate-700 mb-4">Sınıf Seviyesine Göre Dağılım</h2>
          {gradeLevelData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie
                    data={gradeLevelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                    {gradeLevelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-slate-400">Veri yok</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Statistics;
