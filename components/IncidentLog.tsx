
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Save, Search, Plus, Trash2, Calendar, MapPin, 
  FileText, UserPlus, X, AlertCircle, Clock, ChevronRight, CheckCircle, AlertTriangle, Download, FileSpreadsheet,
  Check, Users, Filter
} from 'lucide-react';
import { useStudents } from '../context/StudentContext';
import { useIncidents } from '../context/IncidentContext';
import { Incident } from '../types';
import { exportIncidentToPDF, exportIncidentToDocx, exportIncidentsToExcel } from '../services/exportService';
import { getCurrentAcademicYear, getAcademicYearFromDate } from '../services/academicYear';

// Form State Initializer
const getEmptyIncident = (): Incident => ({
  id: '',
  code: '',
  title: '',
  date: new Date().toISOString().split('T')[0],
  time: '09:00',
  location: '',
  description: '',
  status: 'pending',
  involvedStudents: [],
  petitioner: '',
  petitionerInfo: '',
  mitigatingFactors: '',
  useMitigatingFactors: false
});

const IncidentLog = () => {
  const { students } = useStudents();
  const { incidents, addIncident, updateIncident, deleteIncident, getNextIncidentCode } = useIncidents();
  
  // UI State
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState(''); // Added for student picker search
  const [filterYear, setFilterYear] = useState(true); // true: Current Year, false: All
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Multi-Student Picker State
  const [pickerSelections, setPickerSelections] = useState<Record<string, 'suspect' | 'witness' | 'victim'>>({});
  const [pickerDefaultRole, setPickerDefaultRole] = useState<'suspect' | 'witness' | 'victim'>('suspect');
  const [pickerGradeFilter, setPickerGradeFilter] = useState<string>('all');

  // --- DELETE CONFIRMATION STATE ---
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'incident' | 'student' | null;
    targetId: string | null;
  }>({ isOpen: false, type: null, targetId: null });

  const [formData, setFormData] = useState<Incident>(getEmptyIncident());

  // When selection changes, update form data
  useEffect(() => {
    if (selectedIncidentId) {
      const found = incidents.find(i => i.id === selectedIncidentId);
      if (found) setFormData(found);
    } else {
      setFormData({ ...getEmptyIncident(), code: getNextIncidentCode() });
    }
  }, [selectedIncidentId, incidents, getNextIncidentCode]);

  const handleNewIncident = () => {
    setSelectedIncidentId(null);
    setFormData({ ...getEmptyIncident(), code: getNextIncidentCode() });
    setSuccessMessage(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIncidentId) {
      updateIncident(formData);
      setSuccessMessage('Olay kaydı başarıyla güncellendi.');
    } else {
      const newId = Math.random().toString(36).substr(2, 9);
      addIncident({ ...formData, id: newId });
      setSelectedIncidentId(newId);
      setSuccessMessage('Yeni olay kaydı başarıyla oluşturuldu.');
    }
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // --- DELETE HANDLERS ---
  const requestDeleteIncident = () => {
    if (selectedIncidentId) {
      setDeleteModal({ isOpen: true, type: 'incident', targetId: selectedIncidentId });
    }
  };

  const requestDeleteStudent = (studentId: string) => {
    setDeleteModal({ isOpen: true, type: 'student', targetId: studentId });
  };

  const confirmDelete = () => {
    if (deleteModal.type === 'incident' && deleteModal.targetId) {
        deleteIncident(deleteModal.targetId);
        handleNewIncident();
        setSuccessMessage('Olay kaydı silindi.');
    } 
    else if (deleteModal.type === 'student' && deleteModal.targetId) {
        const updatedInvolved = formData.involvedStudents.filter(s => s.studentId !== deleteModal.targetId);
        const updatedIncident = { ...formData, involvedStudents: updatedInvolved };
        setFormData(updatedIncident);
        if (selectedIncidentId) {
            updateIncident(updatedIncident);
            setSuccessMessage('Öğrenci olaydan çıkarıldı.');
        }
    }
    setDeleteModal({ isOpen: false, type: null, targetId: null });
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const addStudentToIncident = (studentId: string, role: 'suspect' | 'witness' | 'victim') => {
    // Check if already exists
    if (formData.involvedStudents.some(s => s.studentId === studentId)) {
      alert('Bu öğrenci zaten olaya eklenmiş.');
      return;
    }
    
    const updatedInvolved = [...formData.involvedStudents, { studentId, role }];
    const updatedIncident = { ...formData, involvedStudents: updatedInvolved };
    setFormData(updatedIncident);
    
    // Auto-save behavior similar to desktop apps
    if (selectedIncidentId) {
      updateIncident(updatedIncident);
      setSuccessMessage('Öğrenci olaya eklendi ve kayıt güncellendi.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    setShowStudentPicker(false);
  };

  const addMultipleStudentsToIncident = (newSelections: Array<{ studentId: string, role: 'suspect' | 'witness' | 'victim' }>) => {
    if (newSelections.length === 0) return;

    const existingIds = new Set(formData.involvedStudents.map(s => s.studentId));
    const toAdd = newSelections.filter(s => !existingIds.has(s.studentId));

    if (toAdd.length === 0) {
      alert('Seçilen öğrencilerin tümü zaten bu olaya eklenmiş.');
      return;
    }

    const updatedInvolved = [...formData.involvedStudents, ...toAdd];
    const updatedIncident = { ...formData, involvedStudents: updatedInvolved };
    setFormData(updatedIncident);

    if (selectedIncidentId) {
      updateIncident(updatedIncident);
      setSuccessMessage(`${toAdd.length} öğrenci olaya eklendi ve kayıt güncellendi.`);
    } else {
      setSuccessMessage(`${toAdd.length} öğrenci olaya eklendi.`);
    }
    setTimeout(() => setSuccessMessage(null), 3000);
    setShowStudentPicker(false);
    setPickerSelections({});
  };

  // Helper to get student info
  const getStudentInfo = (id: string) => students.find(s => s.id === id);

  const filteredIncidents = incidents.filter(inc => {
    // Academic year filter
    if (filterYear) {
      const currentAcademic = getCurrentAcademicYear();
      const incidentAcademic = getAcademicYearFromDate(inc.date);
      
      if (incidentAcademic !== currentAcademic) {
         return false;
      }
    }

    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    // Search matches code, title, location, description
    const matchesIncident = 
      inc.code.toLowerCase().includes(term) ||
      inc.title.toLowerCase().includes(term) ||
      (inc.location && inc.location.toLowerCase().includes(term)) ||
      (inc.description && inc.description.toLowerCase().includes(term));

    if (matchesIncident) return true;

    // Search matches any involved student's name or number
    const matchesStudent = inc.involvedStudents.some(rel => {
      const student = students.find(s => s.id === rel.studentId);
      if (!student) return false;
      return (
        student.name.toLowerCase().includes(term) ||
        student.number.includes(term) ||
        (student.grade && student.grade.toLowerCase().includes(term))
      );
    });

    return matchesStudent;
  });

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen pt-0 bg-[#f3f4f6]">
      
      {/* LEFT PANEL: LIST */}
      <div className="w-full lg:w-1/3 max-h-[45vh] lg:max-h-none bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col z-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
           <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
             <FileText className="w-5 h-5 text-blue-600" />
             OLAY LİSTESİ
           </h2>
           
           <div className="flex items-center gap-4 mb-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={filterYear} onChange={() => setFilterYear(true)} className="text-blue-600" />
                <span>Bu Öğretim Yılı ({getCurrentAcademicYear()})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!filterYear} onChange={() => setFilterYear(false)} className="text-blue-600" />
                <span>Tümü</span>
              </label>
           </div>

           <div className="relative">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
             <input 
               type="text" 
               placeholder="Olay ara..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
             />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto">
           {filteredIncidents.length === 0 ? (
             <div className="p-8 text-center text-slate-400 text-sm">
               Kayıtlı olay bulunamadı.
             </div>
           ) : (
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-100 sticky top-0">
                 <tr>
                   <th className="p-3 font-semibold text-slate-600 border-b">Kod</th>
                   <th className="p-3 font-semibold text-slate-600 border-b">Olay Adı</th>
                   <th className="p-3 font-semibold text-slate-600 border-b text-center">Öğr.</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {filteredIncidents.map(inc => (
                   <tr 
                    key={inc.id} 
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className={`cursor-pointer transition-colors ${selectedIncidentId === inc.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                   >
                     <td className="p-3 font-mono text-xs">{inc.code}</td>
                     <td className="p-3 font-medium truncate max-w-[150px]">{inc.title}</td>
                     <td className="p-3 text-center">
                       <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs font-bold">
                         {inc.involvedStudents.length}
                       </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
        </div>
        
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
           Toplam {filteredIncidents.length} kayıt listelendi.
        </div>
      </div>

      {/* RIGHT PANEL: FORM & DETAILS */}
      <div className="w-full lg:w-2/3 flex flex-col min-h-screen lg:h-full bg-[#f3f4f6]">
        
        {/* Header Actions */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap justify-between items-center gap-3 shadow-sm shrink-0">
           <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-500">Olay İşlemleri</h1>
                <ChevronRight className="w-4 h-4 text-slate-300" />
                <h2 className="text-base sm:text-lg font-bold text-blue-700">Olay Kaydı & Öğrenciler</h2>
            </div>
           <div className="flex flex-wrap items-center gap-2">
             <Link 
                to="/export"
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200"
                title="Gelişmiş Rapor ve Dışa Aktarma Aracı (PDF/Excel)"
             >
               <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Rapor Merkezi
             </Link>
             <button 
                onClick={() => exportIncidentsToExcel(filteredIncidents, students)}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium border border-emerald-200"
                title="Tümünü Excel'e Aktar"
             >
               <Download className="w-4 h-4" /> Excel
             </button>
             {selectedIncidentId && (
               <>
                 <button 
                    onClick={() => exportIncidentToDocx(formData, students)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200 cursor-pointer"
                    title="Bu Olay Raporunu Word (.docx) Olarak İndir"
                 >
                   <FileText className="w-4 h-4" /> Word (.docx)
                 </button>
                 <button 
                    onClick={() => exportIncidentToPDF(formData, students)}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium border border-purple-200 cursor-pointer"
                    title="Bu Olay Raporunu PDF'e Aktar"
                 >
                   <FileText className="w-4 h-4" /> Rapor Al (PDF)
                 </button>
               </>
             )}
             <button 
                onClick={handleNewIncident}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium border border-slate-200"
             >
               <Plus className="w-4 h-4" /> Yeni Olay
             </button>
             <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
             >
               <Save className="w-4 h-4" /> Kaydet
             </button>
             {selectedIncidentId && (
                <button 
                  onClick={requestDeleteIncident}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium border border-red-100"
                >
                  <Trash2 className="w-4 h-4" /> Sil
                </button>
             )}
           </div>
        </div>

        {/* Success Message Banner */}
        {successMessage && (
            <div className="mx-6 mt-4 bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 flex items-center animate-fade-in shadow-sm shrink-0">
                <CheckCircle className="w-5 h-5 mr-3 shrink-0" />
                <span className="font-medium text-sm">{successMessage}</span>
                <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-600 hover:text-green-800">
                    <X className="w-4 h-4" />
                </button>
            </div>
        )}

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          
          <div className="bg-white p-6 rounded-xl border border-slate-300 shadow-sm min-h-[500px]">
             
             {/* 1. INCIDENT FORM */}
             <form className="space-y-5 animate-fade-in">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Olay Kodu</label>
                    <input 
                        type="text" disabled value={formData.code}
                        className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm cursor-not-allowed"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Otomatik oluşturulur.</p>
                    </div>
                    <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Olay Adı (Kısa Tanım)</label>
                    <input 
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        placeholder="Örn: Koridorda Kavga"
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                    />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarih</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                        type="date" 
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    </div>
                    <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Saat</label>
                        <div className="relative">
                        <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                        type="time" 
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    </div>
                    <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Olay Yeri</label>
                        <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                        type="text" 
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Olayın Özeti</label>
                    <textarea 
                    rows={8}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Olayın gelişimi, görgü tanıkları ve detaylar..."
                    ></textarea>
                 </div>

                 <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dilekçeyi Veren Kişi</label>
                        <input 
                        type="text" 
                        value={formData.petitioner}
                        onChange={(e) => setFormData({...formData, petitioner: e.target.value})}
                        placeholder="Öğretmen / Öğrenci / Veli"
                        className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" id="hidePetitioner" className="w-4 h-4 text-blue-600 rounded" />
                        <label htmlFor="hidePetitioner" className="text-sm text-slate-700">Tutanaklarda Gizle</label>
                    </div>
                 </div>
                 
                 <div className="mt-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dilekçe Tarih ve Sayısı</label>
                        <input 
                        type="text" 
                        value={formData.petitionerInfo}
                        onChange={(e) => setFormData({...formData, petitionerInfo: e.target.value})}
                        className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                        />
                 </div>

                 {/* Yaptırımı Hafifleten Nedenler Bölümü */}
                 <div className="bg-[#ecfdf5] border border-emerald-250 rounded-xl p-4 mt-6">
                   <h4 className="text-sm font-bold text-emerald-850 flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-emerald-600" />
                      Yaptırımı Hafifleten Nedenler (1 Alt Derece Teklifi)
                   </h4>
                   <p className="text-xs text-emerald-700 mb-3 leading-relaxed">
                      Eğer öğrenciler için cezayı hafifletici nedenler/gerekçeler söz konusu ise burayı doldurunuz. Bu sayede karar aşamasında öğrencilere 1 alt basamak/derece ceza teklif edilebilir.
                   </p>
                   <div className="space-y-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Hafifletici Nedenler / Gözlemler / Kanaat</label>
                         <textarea 
                            rows={3}
                            value={formData.mitigatingFactors || ''}
                            onChange={(e) => setFormData({...formData, mitigatingFactors: e.target.value})}
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            placeholder="Örn: Derslerindeki başarısı, ilk kez disipline sevk edilmesi, samimi pişmanlığı ve olumlu davranışları..."
                         />
                      </div>
                      <div className="flex items-center gap-2">
                         <input 
                            type="checkbox" 
                            id="useMitigatingFactors" 
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                            checked={formData.useMitigatingFactors || false}
                            onChange={(e) => setFormData({...formData, useMitigatingFactors: e.target.checked})}
                         />
                         <label htmlFor="useMitigatingFactors" className="text-xs font-semibold text-slate-750 select-none">
                            Bu hafifletici gerekçeler Karar ve Tebligat belgelerinde kullanılsın / gösterilsin (Aktif)
                         </label>
                      </div>
                   </div>
                 </div>
             </form>

             {/* 2. INVOLVED STUDENTS SECTION */}
             <div className="mt-10 border-t-2 border-slate-100 pt-8 animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                         <UserPlus className="w-5 h-5 text-green-600" />
                         Olaya Karışan Öğrenciler
                     </h3>
                     <button 
                        onClick={() => {
                           setShowStudentPicker(true);
                           setStudentSearchTerm('');
                           setPickerSelections({});
                           setPickerGradeFilter('all');
                           setPickerDefaultRole('suspect');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm font-medium"
                     >
                        <Plus className="w-4 h-4" /> Öğrenci Ekle
                     </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                           <tr>
                              <th className="p-3 text-xs font-bold text-slate-500 uppercase">Rol</th>
                              <th className="p-3 text-xs font-bold text-slate-500 uppercase">Numara</th>
                              <th className="p-3 text-xs font-bold text-slate-500 uppercase">Adı Soyadı</th>
                              <th className="p-3 text-xs font-bold text-slate-500 uppercase">Sınıf</th>
                              <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">İşlem</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {formData.involvedStudents.length === 0 ? (
                             <tr><td colSpan={5} className="p-8 text-center text-slate-400">Bu olaya henüz öğrenci eklenmemiş.</td></tr>
                           ) : (
                             formData.involvedStudents.map((rel, idx) => {
                                const student = getStudentInfo(rel.studentId);
                                const roleBadge = 
                                  rel.role === 'suspect' ? 'bg-red-100 text-red-700 border-red-200' :
                                  rel.role === 'witness' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                  'bg-orange-100 text-orange-700 border-orange-200';
                                
                                return (
                                   <tr key={idx} className="hover:bg-slate-50">
                                      <td className="p-3">
                                         <span className={`px-2 py-1 rounded-full text-xs font-bold border uppercase ${roleBadge}`}>
                                            {rel.role === 'suspect' ? 'Fail' : rel.role === 'witness' ? 'Tanık' : 'Mağdur'}
                                         </span>
                                      </td>
                                      <td className="p-3 font-mono text-slate-600">{student?.number || '???'}</td>
                                      <td className="p-3 font-medium text-slate-800">{student?.name || 'Silinmiş Öğrenci'}</td>
                                      <td className="p-3 text-slate-600">{student?.grade}</td>
                                      <td className="p-3 text-right">
                                         <button 
                                            onClick={() => requestDeleteStudent(rel.studentId)}
                                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                         >
                                            <Trash2 className="w-4 h-4" />
                                         </button>
                                      </td>
                                   </tr>
                                )
                             })
                           )}
                        </tbody>
                     </table>
                  </div>

                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-start gap-3">
                     <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                     <div className="text-xs text-yellow-800 leading-relaxed">
                        <p className="font-bold">Bilgilendirme:</p>
                        <p>"Fail" olarak eklenen öğrenciler için disiplin süreci başlatılabilir ve tutanak hazırlanabilir. "Tanık" olarak eklenenler ifade tutanağında yer alır.</p>
                     </div>
                  </div>
             </div>

          </div>
        </div>
      </div>

      {/* MODAL: Student Picker (Multi-Select & Multi-Role) */}
      {showStudentPicker && (() => {
        const alreadyInvolvedIds = new Set(formData.involvedStudents.map(s => s.studentId));
        
        const availableGrades = Array.from(
          new Set(students.map(s => s.grade).filter(Boolean))
        ).sort();

        const filteredStudents = students.filter(s => {
          const matchesSearch = 
            s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
            s.number.includes(studentSearchTerm) ||
            (s.grade && s.grade.toLowerCase().includes(studentSearchTerm.toLowerCase()));

          const matchesGrade = pickerGradeFilter === 'all' || s.grade === pickerGradeFilter;

          return matchesSearch && matchesGrade;
        });

        const selectedCount = Object.keys(pickerSelections).length;
        const suspectCount = Object.values(pickerSelections).filter(r => r === 'suspect').length;
        const witnessCount = Object.values(pickerSelections).filter(r => r === 'witness').length;
        const victimCount = Object.values(pickerSelections).filter(r => r === 'victim').length;

        const handleToggleStudent = (studentId: string, specificRole?: 'suspect' | 'witness' | 'victim') => {
          if (alreadyInvolvedIds.has(studentId)) return;

          setPickerSelections(prev => {
            const next = { ...prev };
            const currentRole = next[studentId];

            if (specificRole) {
              if (currentRole === specificRole) {
                delete next[studentId];
              } else {
                next[studentId] = specificRole;
              }
            } else {
              if (currentRole) {
                delete next[studentId];
              } else {
                next[studentId] = pickerDefaultRole;
              }
            }
            return next;
          });
        };

        const handleBatchSelectFiltered = (selectAll: boolean) => {
          if (!selectAll) {
            setPickerSelections({});
            return;
          }
          const next = { ...pickerSelections };
          filteredStudents.forEach(s => {
            if (!alreadyInvolvedIds.has(s.id)) {
              if (!next[s.id]) {
                next[s.id] = pickerDefaultRole;
              }
            }
          });
          setPickerSelections(next);
        };

        const handleSetAllSelectedRole = (role: 'suspect' | 'witness' | 'victim') => {
          setPickerDefaultRole(role);
          setPickerSelections(prev => {
            const next: Record<string, 'suspect' | 'witness' | 'victim'> = {};
            Object.keys(prev).forEach(id => {
              next[id] = role;
            });
            return next;
          });
        };

        const handleConfirmAddSelected = () => {
          const itemsToAdd = (Object.entries(pickerSelections) as [string, 'suspect' | 'witness' | 'victim'][]).map(([studentId, role]) => ({
            studentId,
            role
          }));
          addMultipleStudentsToIncident(itemsToAdd);
        };

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh] border border-slate-200">
                
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 via-slate-100/70 to-indigo-50/40">
                   <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                         <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                         <h3 className="font-bold text-slate-900 text-base leading-tight">Olaya Öğrenci Ekle</h3>
                         <p className="text-xs text-slate-500">Birden fazla öğrenci seçebilir, her birine Fail, Tanık veya Mağdur rolü atayabilirsiniz.</p>
                      </div>
                   </div>
                   <button 
                      onClick={() => setShowStudentPicker(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                   >
                      <X className="w-5 h-5" />
                   </button>
                </div>

                {/* Filter and Role Bar */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-200 space-y-3">
                   <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      {/* Search */}
                      <div className="sm:col-span-8 relative">
                         <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                         <input 
                           type="text" 
                           placeholder="Öğrenci adı, okul no veya sınıf..." 
                           className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" 
                           value={studentSearchTerm}
                           onChange={(e) => setStudentSearchTerm(e.target.value)}
                         />
                      </div>
                      {/* Grade Filter */}
                      <div className="sm:col-span-4 relative">
                         <select
                            value={pickerGradeFilter}
                            onChange={(e) => setPickerGradeFilter(e.target.value)}
                            className="w-full py-2 px-2.5 bg-white border border-slate-200 rounded-lg outline-none text-xs text-slate-700 font-medium cursor-pointer"
                         >
                            <option value="all">Tüm Sınıflar</option>
                            {availableGrades.map(g => (
                               <option key={g} value={g}>{g}</option>
                            ))}
                         </select>
                      </div>
                   </div>

                   {/* Quick Role & Selection Controls */}
                   <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 text-xs">
                      <div className="flex items-center gap-1.5">
                         <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Varsayılan Rol:</span>
                         <button
                            type="button"
                            onClick={() => handleSetAllSelectedRole('suspect')}
                            className={`px-2.5 py-1 rounded-md font-bold text-xs border transition-all flex items-center gap-1 cursor-pointer ${
                               pickerDefaultRole === 'suspect' 
                                 ? 'bg-red-600 text-white border-red-600 shadow-xs ring-2 ring-red-200' 
                                 : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                            }`}
                         >
                            <span className="w-2 h-2 rounded-full bg-red-400"></span> Fail (Şüpheli)
                         </button>
                         <button
                            type="button"
                            onClick={() => handleSetAllSelectedRole('witness')}
                            className={`px-2.5 py-1 rounded-md font-bold text-xs border transition-all flex items-center gap-1 cursor-pointer ${
                               pickerDefaultRole === 'witness' 
                                 ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-200' 
                                 : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                            }`}
                         >
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span> Tanık
                         </button>
                         <button
                            type="button"
                            onClick={() => handleSetAllSelectedRole('victim')}
                            className={`px-2.5 py-1 rounded-md font-bold text-xs border transition-all flex items-center gap-1 cursor-pointer ${
                               pickerDefaultRole === 'victim' 
                                 ? 'bg-orange-600 text-white border-orange-600 shadow-xs ring-2 ring-orange-200' 
                                 : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
                            }`}
                         >
                            <span className="w-2 h-2 rounded-full bg-orange-400"></span> Mağdur
                         </button>
                      </div>

                      <div className="flex items-center gap-2">
                         <button
                            type="button"
                            onClick={() => handleBatchSelectFiltered(true)}
                            className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                         >
                            Listeyi Seç ({filteredStudents.filter(s => !alreadyInvolvedIds.has(s.id)).length})
                         </button>
                         {selectedCount > 0 && (
                            <>
                               <span className="text-slate-300">•</span>
                               <button
                                  type="button"
                                  onClick={() => handleBatchSelectFiltered(false)}
                                  className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                               >
                                  Temizle
                               </button>
                            </>
                         )}
                      </div>
                   </div>
                </div>

                {/* Student List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-100 max-h-[46vh]">
                   {filteredStudents.map(student => {
                      const isAlreadyInvolved = alreadyInvolvedIds.has(student.id);
                      const assignedRole = pickerSelections[student.id];
                      const isSelected = !!assignedRole;

                      return (
                         <div 
                            key={student.id} 
                            className={`pt-1.5 first:pt-0 rounded-xl transition-all p-2.5 flex items-center justify-between gap-3 ${
                               isAlreadyInvolved 
                                 ? 'bg-slate-50/80 opacity-60 cursor-not-allowed border border-dashed border-slate-200' 
                                 : isSelected 
                                   ? 'bg-indigo-50/70 border border-indigo-200 shadow-2xs' 
                                   : 'hover:bg-slate-50 border border-transparent'
                            }`}
                         >
                            {/* Checkbox & Student Info */}
                            <div 
                               onClick={() => !isAlreadyInvolved && handleToggleStudent(student.id)}
                               className={`flex items-center gap-3 flex-1 min-w-0 ${!isAlreadyInvolved ? 'cursor-pointer' : ''}`}
                            >
                               <div 
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                     isAlreadyInvolved 
                                       ? 'bg-slate-200 border-slate-300' 
                                       : isSelected 
                                         ? assignedRole === 'suspect' ? 'bg-red-600 border-red-600 text-white' : assignedRole === 'witness' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-orange-600 border-orange-600 text-white'
                                         : 'border-slate-300 bg-white hover:border-slate-400'
                                  }`}
                               >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  {isAlreadyInvolved && <span className="text-[10px] text-slate-500 font-bold">✓</span>}
                               </div>

                               <div className="flex-1 min-w-0">
                                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5 truncate">
                                     <span>{student.name}</span>
                                     {isAlreadyInvolved && (
                                        <span className="text-[9.5px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                                           Olaya Ekli
                                        </span>
                                     )}
                                     {(student.isMesem || (student.grade && student.grade.toUpperCase().includes('MES'))) && (
                                        <span className="text-[9.5px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded border border-purple-200">
                                           MESEM
                                        </span>
                                     )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                     <span>No: <b>{student.number}</b></span>
                                     <span>•</span>
                                     <span>Sınıf: <b>{student.grade}</b></span>
                                     {student.tcNo && <><span>•</span><span>TC: {student.tcNo}</span></>}
                                  </div>
                               </div>
                            </div>

                            {/* Role Buttons */}
                            {!isAlreadyInvolved ? (
                               <div className="flex items-center gap-1.5 shrink-0">
                                  <button 
                                     type="button"
                                     onClick={() => handleToggleStudent(student.id, 'suspect')} 
                                     title="Bu öğrenciyi 'Fail' olarak ata/seç"
                                     className={`text-xs px-2.5 py-1 rounded-md font-bold border transition-all cursor-pointer ${
                                        assignedRole === 'suspect'
                                           ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                           : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                     }`}
                                  >
                                     Fail
                                  </button>
                                  <button 
                                     type="button"
                                     onClick={() => handleToggleStudent(student.id, 'witness')} 
                                     title="Bu öğrenciyi 'Tanık' olarak ata/seç"
                                     className={`text-xs px-2.5 py-1 rounded-md font-bold border transition-all cursor-pointer ${
                                        assignedRole === 'witness'
                                           ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                           : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                                     }`}
                                  >
                                     Tanık
                                  </button>
                                  <button 
                                     type="button"
                                     onClick={() => handleToggleStudent(student.id, 'victim')} 
                                     title="Bu öğrenciyi 'Mağdur' olarak ata/seç"
                                     className={`text-xs px-2.5 py-1 rounded-md font-bold border transition-all cursor-pointer ${
                                        assignedRole === 'victim'
                                           ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                                           : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'
                                     }`}
                                  >
                                     Mağdur
                                  </button>
                               </div>
                            ) : (
                               <div className="text-[11px] text-slate-400 font-medium italic pr-2">
                                  Zaten eklendi
                               </div>
                            )}
                         </div>
                      );
                   })}

                   {filteredStudents.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs">
                         Arama kriterlerine uygun öğrenci bulunamadı.
                      </div>
                   )}
                </div>

                {/* Footer with Summary and Action */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                   <div className="flex items-center gap-2 text-xs">
                      {selectedCount > 0 ? (
                         <>
                            <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                               Toplam {selectedCount} Öğrenci Seçildi
                            </span>
                            <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
                               {suspectCount > 0 && (
                                  <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-bold">
                                     {suspectCount} Fail
                                  </span>
                               )}
                               {witnessCount > 0 && (
                                  <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold">
                                     {witnessCount} Tanık
                                  </span>
                               )}
                               {victimCount > 0 && (
                                  <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded font-bold">
                                     {victimCount} Mağdur
                                  </span>
                               )}
                            </div>
                         </>
                      ) : (
                         <span className="text-slate-500 italic">
                            Lütfen eklemek istediğiniz öğrencileri ve rollerini seçiniz.
                         </span>
                      )}
                   </div>

                   <div className="flex items-center gap-2">
                      <button 
                         type="button"
                         onClick={() => setShowStudentPicker(false)}
                         className="px-4 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                         İptal
                      </button>
                      <button 
                         type="button"
                         disabled={selectedCount === 0}
                         onClick={handleConfirmAddSelected}
                         className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                            selectedCount > 0
                               ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:shadow-md'
                               : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                         }`}
                      >
                         <UserPlus className="w-4 h-4" />
                         <span>Seçilenleri Olaya Ekle ({selectedCount})</span>
                      </button>
                   </div>
                </div>

             </div>
          </div>
        );
      })()}

      {/* MODAL: Delete Confirmation */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-100 bg-red-50 flex items-center gap-3">
                 <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                 <h3 className="font-bold text-red-900">Silme İşlemi Onayı</h3>
              </div>
              <div className="p-6 text-slate-600 text-sm">
                 {deleteModal.type === 'incident' 
                    ? "Bu olay kaydını ve bağlı tüm verileri (ifadeler, analizler) silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
                    : "Seçili öğrenciyi bu olaydan çıkarmak istediğinize emin misiniz?"
                 }
              </div>
              <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                 <button 
                    onClick={() => setDeleteModal({ isOpen: false, type: null, targetId: null })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                 >
                    İptal
                 </button>
                 <button 
                    onClick={confirmDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
                 >
                    Evet, Sil
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default IncidentLog;
