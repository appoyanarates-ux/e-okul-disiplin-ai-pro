import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Scale, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  CalendarDays, 
  ListFilter, 
  X, 
  ExternalLink,
  Plus
} from 'lucide-react';
import { Incident, Student } from '../types';
import { useIncidents } from '../context/IncidentContext';
import { useStudents } from '../context/StudentContext';

const STATUS_CONFIG = {
  pending: {
    label: 'Beklemede',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    icon: AlertCircle
  },
  investigating: {
    label: 'İnceleme Sürüyor',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    icon: AlertTriangle
  },
  decided: {
    label: 'Karara Bağlandı',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    icon: CheckCircle2
  },
  archived: {
    label: 'Arşivlendi',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
    icon: FileText
  }
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  suspect: { label: 'Fail / Şüpheli', color: 'text-red-700 bg-red-50 border-red-200' },
  witness: { label: 'Tanık', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  victim: { label: 'Mağdur', color: 'text-purple-700 bg-purple-50 border-purple-200' }
};

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const IncidentCalendar: React.FC = () => {
  const { incidents, addIncident } = useIncidents();
  const { students, addStudent } = useStudents();

  // View state: 'calendar' or 'timeline'
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Calendar month state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Demo incident seeder for new or empty databases
  const handleLoadDemoIncidents = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const pad = (n: number) => String(n).padStart(2, '0');
    const d1 = pad(Math.max(1, now.getDate() - 2));
    const d2 = pad(Math.max(1, now.getDate() - 6));
    const d3 = pad(Math.max(1, now.getDate() - 11));

    let sampleStudentIds = students.map(s => s.id);
    if (sampleStudentIds.length === 0) {
      const s1: Student = {
        id: 'demo-st-1',
        name: 'Ahmet Yılmaz',
        number: '104',
        grade: '10-A',
        tcNo: '12345678901',
        fatherName: 'Mehmet',
        motherName: 'Ayşe',
        gender: 'ERKEK',
        province: 'KIRŞEHİR',
        district: 'MERKEZ',
        volumeNo: '14',
        familyOrderNo: '88',
        orderNo: '10'
      };
      const s2: Student = {
        id: 'demo-st-2',
        name: 'Mustafa Demir',
        number: '215',
        grade: '10-B',
        tcNo: '23456789012',
        fatherName: 'Ali',
        motherName: 'Fatma',
        gender: 'ERKEK',
        province: 'ANKARA',
        district: 'ÇANKAYA',
        volumeNo: '18',
        familyOrderNo: '45',
        orderNo: '12'
      };
      addStudent(s1);
      addStudent(s2);
      sampleStudentIds = ['demo-st-1', 'demo-st-2'];
    }

    const demo1: Incident = {
      id: `demo-inc-${Date.now()}-1`,
      code: `OLAY${yyyy}-001`,
      title: 'Ders Esnasında Cep Telefonu Kullanımı ve Talimatlara Uymama',
      date: `${yyyy}-${mm}-${d1}`,
      time: '10:45',
      location: '10-A Sınıfı Dersliği',
      description: 'Ders esnasında öğretmen uyarısına rağmen cep telefonu ile ilgilenilmesi ve ders akışının bozulması.',
      status: 'decided',
      involvedStudents: [
        {
          studentId: sampleStudentIds[0],
          role: 'suspect',
          studentStatement: 'Ödev kontrolü amacıyla telefonu açtığımı belirttim, üzgünüm.',
          studentDefense: 'Ders kurallarını bildiğimi beyan eder, bir daha tekrarlamayacağımı taahhüt ederim.',
          decision: 'UYARMA',
          decisionNo: `${yyyy}/1`,
          decisionDate: `${yyyy}-${mm}-${d1}`,
          penaltyScore: '10'
        }
      ]
    };

    const demo2: Incident = {
      id: `demo-inc-${Date.now()}-2`,
      code: `OLAY${yyyy}-002`,
      title: 'Koridorda Akran Münakaşası ve Gürültü',
      date: `${yyyy}-${mm}-${d2}`,
      time: '12:30',
      location: '2. Kat Doğu Koridoru',
      description: 'Öğle arasında iki öğrenci arasında sözlü tartışma ve münakaşa yaşanmıştır.',
      status: 'investigating',
      petitioner: 'Nöbetçi Öğretmen',
      petitionerInfo: '12.30 Nöbet Defteri Kaydı',
      involvedStudents: [
        {
          studentId: sampleStudentIds[1] || sampleStudentIds[0],
          role: 'suspect',
          notes: 'İfadesi için çağrı pusulası düzenlendi.'
        }
      ]
    };

    const demo3: Incident = {
      id: `demo-inc-${Date.now()}-3`,
      code: `OLAY${yyyy}-003`,
      title: 'Okul Donatımına ve Sıralara Kasıtlı Zarar Verme',
      date: `${yyyy}-${mm}-${d3}`,
      time: '15:15',
      location: 'Fen Laboratuvarı',
      description: 'Laboratuvar dersi bitiminde masa yüzeylerine kasıtlı zarar verildiği nöbetçi öğretmen tarafından tutanak altına alınmıştır.',
      status: 'pending',
      petitioner: 'Ders Öğretmeni',
      involvedStudents: [
        {
          studentId: sampleStudentIds[0],
          role: 'suspect',
          notes: 'Savunma istem yazısı tebliğ aşamasında.'
        }
      ]
    };

    addIncident(demo1);
    addIncident(demo2);
    addIncident(demo3);
  };

  // Year and Month
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Helper map for quick student lookups
  const studentMap = useMemo(() => {
    const map = new Map<string, { name: string; number: string; class?: string }>();
    students.forEach(s => {
      map.set(s.id, { name: s.name, number: s.number, class: s.grade });
    });
    return map;
  }, [students]);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      // Status filter
      if (statusFilter !== 'all' && inc.status !== statusFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = inc.title?.toLowerCase().includes(query);
        const matchCode = inc.code?.toLowerCase().includes(query);
        const matchDesc = inc.description?.toLowerCase().includes(query);
        const matchLocation = inc.location?.toLowerCase().includes(query);
        
        // Match involved student name
        const matchStudent = inc.involvedStudents?.some(is => {
          const st = studentMap.get(is.studentId);
          return st?.name.toLowerCase().includes(query) || st?.number.includes(query);
        });

        if (!matchTitle && !matchCode && !matchDesc && !matchLocation && !matchStudent) {
          return false;
        }
      }
      return true;
    });
  }, [incidents, statusFilter, searchTerm, studentMap]);

  // Chronologically sorted incidents (newest first for timeline)
  const sortedIncidents = useMemo(() => {
    return [...filteredIncidents].sort((a, b) => {
      const dateA = `${a.date || ''}T${a.time || '00:00'}`;
      const dateB = `${b.date || ''}T${b.time || '00:00'}`;
      return dateB.localeCompare(dateA);
    });
  }, [filteredIncidents]);

  // Incidents mapped by 'YYYY-MM-DD'
  const incidentsByDate = useMemo(() => {
    const map: Record<string, Incident[]> = {};
    filteredIncidents.forEach(inc => {
      if (!inc.date) return;
      const key = inc.date.trim();
      if (!map[key]) map[key] = [];
      map[key].push(inc);
    });
    return map;
  }, [filteredIncidents]);

  // Calendar calculations
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // In JS: Sunday is 0, Monday is 1 ... Saturday is 6.
    // Turkish calendar starts on Monday (0: Mon, 1: Tue, ... 6: Sun).
    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay === -1) startDay = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Previous month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const date = new Date(currentYear, currentMonth - 1, dayNum);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        incidents: incidentsByDate[dateStr] || []
      });
    }

    // Current month days
    const todayStr = new Date().toISOString().split('T')[0];
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNumber: i,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        incidents: incidentsByDate[dateStr] || []
      });
    }

    // Next month padding to fill complete weeks (multiples of 7)
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(currentYear, currentMonth + 1, i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        dayNumber: i,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        incidents: incidentsByDate[dateStr] || []
      });
    }

    return days;
  }, [currentYear, currentMonth, incidentsByDate]);

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(now.toISOString().split('T')[0]);
  };

  // Selected date incidents for calendar drawer/detail
  const selectedDateIncidents = selectedDateStr ? incidentsByDate[selectedDateStr] || [] : [];

  // Summary counts
  const stats = useMemo(() => {
    const total = incidents.length;
    const pending = incidents.filter(i => i.status === 'pending').length;
    const investigating = incidents.filter(i => i.status === 'investigating').length;
    const decided = incidents.filter(i => i.status === 'decided').length;

    // Incidents this month
    const thisMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const thisMonthCount = incidents.filter(i => i.date?.startsWith(thisMonthPrefix)).length;

    return { total, pending, investigating, decided, thisMonthCount };
  }, [incidents, currentYear, currentMonth]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Header & Controls */}
      <div className="p-6 border-b border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Olay Takvimi &amp; Süreç Takibi</h2>
                <p className="text-xs text-slate-500">
                  Disiplin olaylarını takvim veya kronolojik zaman çizelgesi üzerinden inceleyin.
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls: View Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Takvim
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'timeline'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                Zaman Çizelgesi
              </button>
            </div>

            <Link
              to="/incidents"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Olay
            </Link>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Toplam Olay</span>
            <span className="text-base font-bold font-mono text-slate-800 tabular-nums">{stats.total}</span>
          </div>
          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block">Beklemede</span>
            <span className="text-base font-bold font-mono text-amber-900 tabular-nums">{stats.pending}</span>
          </div>
          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 block">İncelemede</span>
            <span className="text-base font-bold font-mono text-blue-900 tabular-nums">{stats.investigating}</span>
          </div>
          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">Karara Bağlandı</span>
            <span className="text-base font-bold font-mono text-emerald-900 tabular-nums">{stats.decided}</span>
          </div>
          <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 block">Bu Ayki Olaylar</span>
            <span className="text-base font-bold font-mono text-indigo-900 tabular-nums">{stats.thisMonthCount}</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Status Segmented Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'Tüm Olaylar' },
              { id: 'pending', label: 'Beklemede' },
              { id: 'investigating', label: 'İncelemede' },
              { id: 'decided', label: 'Karara Bağlandı' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Olay adı, kod veya öğrenci ara..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-150 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div className="p-6">
        {viewMode === 'calendar' ? (
          /* ========================================================================= */
          /* CALENDAR VIEW                                                             */
          /* ========================================================================= */
          <div className="space-y-4">
            {/* Calendar Month Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </h3>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {stats.thisMonthCount} olay kayıtlı
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                >
                  Bugün
                </button>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                  title="Önceki Ay"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                  title="Sonraki Ay"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {incidents.length === 0 && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-blue-950">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Sistemde henüz kayıtlı disiplin vakası bulunmamaktadır. Takvimi deneyimlemek için örnek kayıtları yükleyebilirsiniz.</span>
                </div>
                <button
                  type="button"
                  onClick={handleLoadDemoIncidents}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors shrink-0 shadow-2xs self-start sm:self-auto flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Örnek Olayları Yükle
                </button>
              </div>
            )}

            {/* Calendar Grid Container */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100 text-[11px] font-bold text-slate-600 text-center py-2">
                {DAY_NAMES.map((name, i) => (
                  <div key={name} className={i >= 5 ? 'text-amber-800' : ''}>
                    {name}
                  </div>
                ))}
              </div>

              {/* Days Matrix */}
              <div className="grid grid-cols-7 gap-[1px] bg-slate-200">
                {calendarDays.map((day, idx) => {
                  const hasIncidents = day.incidents.length > 0;
                  const isSelected = selectedDateStr === day.dateStr;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDateStr(day.dateStr);
                      }}
                      className={`min-h-[92px] sm:min-h-[105px] p-1.5 sm:p-2 bg-white transition-colors cursor-pointer flex flex-col justify-between ${
                        !day.isCurrentMonth ? 'bg-slate-50/70 text-slate-400' : 'text-slate-800'
                      } ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/20' : 'hover:bg-slate-50'}`}
                    >
                      {/* Day Number Header */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-mono font-semibold tabular-nums w-6 h-6 flex items-center justify-center rounded-full ${
                            day.isToday
                              ? 'bg-blue-600 text-white font-bold'
                              : isSelected
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-700'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {hasIncidents && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {day.incidents.length}
                          </span>
                        )}
                      </div>

                      {/* Day Incidents Chips */}
                      <div className="space-y-1 overflow-hidden flex-1">
                        {day.incidents.slice(0, 2).map(inc => {
                          const config = STATUS_CONFIG[inc.status] || STATUS_CONFIG.pending;
                          return (
                            <button
                              key={inc.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIncident(inc);
                              }}
                              className={`w-full text-left p-1 rounded border text-[10px] leading-tight truncate transition-all hover:scale-[1.02] ${config.bg} ${config.border} ${config.text}`}
                              title={`${inc.code}: ${inc.title} (${config.label})`}
                            >
                              <span className="font-mono font-semibold">{inc.time || ''}</span>{' '}
                              <span className="font-medium truncate">{inc.title}</span>
                            </button>
                          );
                        })}

                        {day.incidents.length > 2 && (
                          <div className="text-[9.5px] font-semibold text-slate-500 hover:text-blue-600 pl-0.5">
                            +{day.incidents.length - 2} olay daha...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Incidents Detail Drawer */}
            {selectedDateStr && (
              <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50/30 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-100">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {new Date(selectedDateStr).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        weekday: 'long'
                      })} Tarihindeki Olaylar
                    </h4>
                    <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      {selectedDateIncidents.length} Kayıt
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDateStr(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {selectedDateIncidents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    Bu tarihe ait kayıtlı disiplin olayı bulunmamaktadır.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedDateIncidents.map(inc => {
                      const config = STATUS_CONFIG[inc.status] || STATUS_CONFIG.pending;
                      const suspectCount = inc.involvedStudents?.filter(s => s.role === 'suspect').length || 0;
                      return (
                        <div
                          key={inc.id}
                          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {inc.code}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.bg} ${config.border} ${config.text}`}>
                                {config.label}
                              </span>
                            </div>

                            <h5 className="font-bold text-xs text-slate-900 mb-1">{inc.title}</h5>

                            <div className="text-[11px] text-slate-500 space-y-1 mb-2.5">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Saat: {inc.time || 'Belirtilmedi'}</span>
                                {inc.location && (
                                  <>
                                    <span>·</span>
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    <span>{inc.location}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span>
                                  {inc.involvedStudents?.length || 0} Öğrenci ({suspectCount} Fail)
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            <button
                              type="button"
                              onClick={() => setSelectedIncident(inc)}
                              className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                            >
                              Detay Görüntüle &rarr;
                            </button>
                            <Link
                              to="/decisions"
                              className="text-slate-500 hover:text-slate-800 font-medium text-[11px]"
                            >
                              Karar / Evrak
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* TIMELINE / CHRONOLOGICAL LIST VIEW                                        */
          /* ========================================================================= */
          <div className="space-y-6">
            {sortedIncidents.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">Olay Kaydı Bulunamadı</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Seçilen filtre ve arama kriterlerine uygun herhangi bir disiplin vakası mevcut değil.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    to="/incidents"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Yeni Olay Kaydet
                  </Link>
                  {incidents.length === 0 && (
                    <button
                      type="button"
                      onClick={handleLoadDemoIncidents}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                      Örnek Olayları Yükle
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {sortedIncidents.map(inc => {
                  const config = STATUS_CONFIG[inc.status] || STATUS_CONFIG.pending;
                  const incidentDateFormatted = inc.date
                    ? new Date(inc.date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'Tarih Belirtilmedi';

                  return (
                    <div key={inc.id} className="relative group">
                      {/* Timeline Node Icon */}
                      <div
                        className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white ring-2 ring-slate-200 flex items-center justify-center ${config.dot}`}
                      />

                      {/* Card */}
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                        {/* Header Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {inc.code}
                            </span>
                            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                              {incidentDateFormatted}
                            </span>
                            {inc.time && (
                              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {inc.time}
                              </span>
                            )}
                            {inc.location && (
                              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {inc.location}
                              </span>
                            )}
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border self-start sm:self-auto ${config.bg} ${config.border} ${config.text}`}
                          >
                            {config.label}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h4 className="font-bold text-sm text-slate-900 mb-1">{inc.title}</h4>
                        {inc.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                            {inc.description}
                          </p>
                        )}

                        {/* Involved Students Strip */}
                        {inc.involvedStudents && inc.involvedStudents.length > 0 && (
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-3">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                              İlgili Öğrenciler ({inc.involvedStudents.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {inc.involvedStudents.map((is, i) => {
                                const st = studentMap.get(is.studentId);
                                const roleConf = ROLE_LABELS[is.role] || ROLE_LABELS.suspect;
                                return (
                                  <div
                                    key={i}
                                    className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded-md"
                                  >
                                    <span className="font-semibold text-slate-800">
                                      {st?.name || `Öğrenci #${is.studentId}`}
                                    </span>
                                    {st?.number && (
                                      <span className="text-slate-400 font-mono text-[10px]">
                                        ({st.number})
                                      </span>
                                    )}
                                    <span
                                      className={`text-[9.5px] px-1 py-0.2 rounded border font-bold ${roleConf.color}`}
                                    >
                                      {roleConf.label}
                                    </span>
                                    {is.decision && (
                                      <span className="text-[9.5px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1 py-0.2 rounded font-bold">
                                        {is.decision}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Card Footer Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedIncident(inc)}
                            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                          >
                            Tüm Detayları Gör &rarr;
                          </button>
                          <div className="flex items-center gap-3">
                            <Link
                              to="/incidents"
                              className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              Olay Sayfası
                            </Link>
                            <Link
                              to="/decisions"
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold flex items-center gap-1 transition-colors"
                            >
                              <Scale className="w-3 h-3 text-indigo-600" />
                              Karar &amp; Evrak
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* QUICK VIEW MODAL FOR SELECTED INCIDENT                                   */}
      {/* ========================================================================= */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-white/10 px-2 py-0.5 rounded border border-white/20">
                    {selectedIncident.code}
                  </span>
                  <h3 className="font-bold text-base tracking-wide truncate max-w-md">
                    {selectedIncident.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                  <span>
                    {selectedIncident.date
                      ? new Date(selectedIncident.date).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Tarih Belirtilmedi'}
                  </span>
                  {selectedIncident.time && <span>· Saat: {selectedIncident.time}</span>}
                  {selectedIncident.location && <span>· Yer: {selectedIncident.location}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Status and Metadata */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Soruşturma Durumu</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {STATUS_CONFIG[selectedIncident.status]?.label || selectedIncident.status}
                  </span>
                </div>
                {selectedIncident.petitioner && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Dilekçeyi Veren</span>
                    <span className="font-medium text-slate-700">{selectedIncident.petitioner}</span>
                  </div>
                )}
                {selectedIncident.petitionerInfo && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Evrak Sayı/Tarih</span>
                    <span className="font-medium text-slate-700">{selectedIncident.petitionerInfo}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1.5 pb-1 border-b border-slate-100">
                  Olay Özeti / Açıklama
                </h4>
                <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed text-slate-700 whitespace-pre-line">
                  {selectedIncident.description || 'Olayla ilgili detaylı açıklama girilmemiş.'}
                </p>
              </div>

              {/* Mitigating factors if any */}
              {selectedIncident.mitigatingFactors && (
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1.5 pb-1 border-b border-slate-100">
                    Hafifletici Nedenler
                  </h4>
                  <p className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-amber-900 leading-relaxed">
                    {selectedIncident.mitigatingFactors}
                  </p>
                </div>
              )}

              {/* Involved Students Table */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                  <span>Olaya Karışan Öğrenciler</span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {selectedIncident.involvedStudents?.length || 0} Kişi
                  </span>
                </h4>

                {(!selectedIncident.involvedStudents || selectedIncident.involvedStudents.length === 0) ? (
                  <p className="text-slate-400 italic py-2">Bu olaya henüz öğrenci eklenmemiştir.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10.5px]">
                          <th className="p-2.5">Öğrenci</th>
                          <th className="p-2.5">Rol</th>
                          <th className="p-2.5">İfade / Savunma</th>
                          <th className="p-2.5">Disiplin Kararı</th>
                          <th className="p-2.5 text-right">Puan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedIncident.involvedStudents.map((is, idx) => {
                          const st = studentMap.get(is.studentId);
                          const roleConf = ROLE_LABELS[is.role] || ROLE_LABELS.suspect;
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5">
                                <span className="font-bold text-slate-800 block">
                                  {st?.name || `Öğrenci #${is.studentId}`}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  No: {st?.number || '-'} · Sınıf: {st?.class || '-'}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${roleConf.color}`}>
                                  {roleConf.label}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600 text-[11px]">
                                {is.studentStatement ? (
                                  <span className="text-emerald-700 font-medium">İfade Alındı</span>
                                ) : (
                                  <span className="text-slate-400">Bekliyor</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {is.decision ? (
                                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10.5px]">
                                    {is.decision}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Karara bağlanmadı</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                                {is.penaltyScore ? `-${is.penaltyScore}` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Kapat
              </button>

              <div className="flex items-center gap-2">
                <Link
                  to="/incidents"
                  className="px-4 py-2 border border-blue-300 bg-white hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Olay Sayfasında Düzenle
                </Link>
                <Link
                  to="/decisions"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Scale className="w-4 h-4" />
                  Karar &amp; Evrak Sayfasına Git
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default IncidentCalendar;
