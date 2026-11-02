const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const migrateImportedData = (rawData: unknown) => {
    let institutionSettings: Record<string, unknown> | null = null;
    let boardMembers: unknown[] = [];
    let students: unknown[] = [];
    let incidents: unknown[] = [];
    let apiKey = '';

    const extractArray = (data: unknown, possibleKeys: string[]) => {
        if (!data || typeof data !== 'object') return [];
        if (Array.isArray(data)) return data;
        const dataObj = data as Record<string, unknown>;
        for (const key of possibleKeys) {
            if (dataObj[key] && Array.isArray(dataObj[key])) {
                return dataObj[key];
            }
        }
        return [];
    };

    if (Array.isArray(rawData)) {
        if (rawData.length > 0 && typeof rawData[0] === 'object' && rawData[0] !== null) {
            const first = rawData[0] as Record<string, unknown>;
            if ((first.name && first.number) || (first.adSoyad && first.okulNo) || (first.AdSoyad && first.No)) {
                students = [...rawData];
            }
            else if ((first.title && first.date) || (first.Baslik && first.Tarih) || (first.title !== undefined)) {
                incidents = [...rawData];
            }
        }
    } else if (typeof rawData === 'object' && rawData !== null) {
        const rawObj = rawData as Record<string, unknown>;
        // Institution Settings
        institutionSettings = (rawObj.institutionSettings || rawObj.settings || null) as Record<string, unknown> | null;
        
        // Board Members
        boardMembers = extractArray(rawData, ['boardSettings', 'boardMembers', 'kurul', 'Kurul']);
        
        // Students
        students = extractArray(rawData, ['students', 'Ogrenciler', 'ogrenciler', 'studentSettings']);
        
        // Incidents
        incidents = extractArray(rawData, ['incidents', 'Olaylar', 'olaylar', 'incidentSettings']);
        
        apiKey = (rawObj.gemini_api_key || rawObj.apiKey || '') as string;
    }

    // MAP STUDENTS
    const migratedStudents = students.map((unknownS: unknown) => {
        if (typeof unknownS !== 'object' || unknownS === null) return null;
        const s = unknownS as Record<string, unknown>;
        return {
            ...s,
            id: s.id || generateId(),
            number: s.number || s.okulNo || s.No || '',
            name: s.name || s.adSoyad || s.AdSoyad || s.FullName || '',
            grade: s.grade || s.sinif || s.Sinif || '',
            tcNo: s.tcNo || s.TC || '',
            fatherName: s.fatherName || s.babaAdi || '',
            motherName: s.motherName || s.anneAdi || '',
            birthPlaceDate: s.birthPlaceDate || s.dogumYeriTarihi || '',
            province: s.province || s.il || '',
            district: s.district || s.ilce || '',
            neighborhood: s.neighborhood || s.mahalle || '',
            volumeNo: s.volumeNo || s.ciltNo || '',
            familyOrderNo: s.familyOrderNo || s.aileSiraNo || '',
            orderNo: s.orderNo || s.siraNo || '',
            registrationType: s.registrationType || s.kayitTipi || '',
            previousSchoolInfo: s.previousSchoolInfo || s.oncekiOkul || '',
            registrationDate: s.registrationDate || s.kayitTarihi || '',
            parentName: s.parentName || s.veliAdi || '',
            examStatus: s.examStatus || s.sinavDurumu || '',
            boardingStatus: s.boardingStatus || s.yatiliDurumu || '',
            scholarshipStatus: s.scholarshipStatus || s.bursDurumu || '',
            gender: s.gender || s.cinsiyet || '',
            healthStatus: s.healthStatus || s.saglikDurumu || '',
            address: s.address || s.adres || '',
            parentPhone: s.parentPhone || s.veliTelefon || '',
            previousPenalties: Array.isArray(s.previousPenalties) 
                ? s.previousPenalties.map((unknownP: unknown) => {
                    const p = unknownP as Record<string, unknown>;
                    return {
                        id: p.id || generateId(),
                        decision: p.decision || p.karar || '',
                        decisionNo: p.decisionNo || p.kararNo || '',
                        date: p.date || p.tarih || '',
                        penaltyScore: p.penaltyScore || p.puan || '',
                        description: p.description || p.aciklama || '',
                        isRemoved: !!(p.isRemoved || p.silindiMi),
                        removedDecisionNo: p.removedDecisionNo || '',
                        removedDate: p.removedDate || '',
                        removedReason: p.removedReason || ''
                    };
                  })
                : (Array.isArray(s.Cezalar) 
                    ? s.Cezalar.map((unknownP: unknown) => {
                        const p = unknownP as Record<string, unknown>;
                        return {
                            id: generateId(),
                            decision: p.CezaTipi || p.ceza || '',
                            decisionNo: p.KararNo || '',
                            date: p.KararTarihi || '',
                            penaltyScore: '',
                            description: p.Aciklama || '',
                            isRemoved: false
                        };
                      })
                    : [])
        };
    }).filter(Boolean);

    // MAP INCIDENTS
    const migratedIncidents = incidents.map((unknownInc: unknown) => {
        if (typeof unknownInc !== 'object' || unknownInc === null) return null;
        const inc = unknownInc as Record<string, unknown>;
        
        let invStudents: unknown[] = [];
        if (Array.isArray(inc.involvedStudents)) {
            invStudents = inc.involvedStudents;
        } else if (Array.isArray(inc.KarisAnOgrenci)) {
            invStudents = inc.KarisAnOgrenci.map((unknownInv: unknown) => {
                const inv = unknownInv as Record<string, unknown>;
                return {
                    studentId: inv.OgrenciId || inv.id || '',
                    role: inv.Rol || 'suspect',
                    notes: inv.Notlar || '',
                    decision: inv.Karar || '',
                    decisionNo: inv.KararNo || '',
                    decisionDate: inv.KararTarihi || '',
                    decisionReason: inv.Gerekce || ''
                };
            });
        }

        const formattedInvStudents = invStudents.map((unknownInv: unknown) => {
             const inv = unknownInv as Record<string, unknown>;
             return {
                 studentId: inv.studentId || '',
                 role: inv.role || 'suspect',
                 notes: inv.notes || '',
                 studentStatement: inv.studentStatement || '',
                 studentDefense: inv.studentDefense || '',
                 decision: inv.decision || '',
                 decisionNo: inv.decisionNo || '',
                 decisionDate: inv.decisionDate || '',
                 decisionReason: inv.decisionReason || '',
                 penaltyScore: String(inv.penaltyScore || ''),
                 aiAnalysis: inv.aiAnalysis || '',
                 isRemoved: !!inv.isRemoved,
                 removedDecisionNo: inv.removedDecisionNo || '',
                 removedDate: inv.removedDate || '',
                 removedReason: inv.removedReason || ''
             };
        });

        return {
            ...inc,
            id: inc.id || generateId(),
            code: inc.code || inc.Kodu || `OLAY-${Date.now().toString().slice(-6)}`,
            title: inc.title || inc.Baslik || 'İsimsiz Olay',
            date: inc.date || inc.Tarih || new Date().toISOString().split('T')[0],
            time: inc.time || inc.Saat || '12:00',
            location: inc.location || inc.Yer || 'Okul',
            description: inc.description || inc.Aciklama || '',
            status: inc.status || inc.Durum || 'pending',
            involvedStudents: formattedInvStudents,
            petitioner: inc.petitioner || inc.DilekceVeren || '',
            petitionerInfo: inc.petitionerInfo || inc.DilekceTarihSayi || '',
            mitigatingFactors: inc.mitigatingFactors || inc.Hafifletici || '',
            useMitigatingFactors: !!(inc.useMitigatingFactors || inc.HafifleticiKullan),
        };
    }).filter(Boolean);

    // MAP INSTITUTION
    let migratedInstitutionSettings = null;
    if (institutionSettings && typeof institutionSettings === 'object') {
        const inst = institutionSettings as Record<string, unknown>;
        migratedInstitutionSettings = {
            ...inst,
            name: inst.name || inst.OkulAdi || '',
            code: inst.code || inst.KurumKodu || '',
            type: inst.type || inst.Turu || 'Ortaokul',
            year: inst.year || inst.EgitimYili || '2023-2024',
            province: inst.province || inst.Il || '',
            district: inst.district || inst.Ilce || '',
            managerName: inst.managerName || inst.MudurAdi || '',
            address: inst.address || inst.Adres || '',
            phone: inst.phone || inst.Telefon || '',
            fax: inst.fax || inst.Faks || '',
            headerText: inst.headerText || inst.Antet || '',
            ebysCode: inst.ebysCode || inst.EbysNo || ''
        };
    }

    // MAP BOARD MEMBERS
    const migratedBoardMembers = boardMembers.map((unknownM: unknown) => {
        if (typeof unknownM !== 'object' || unknownM === null) return null;
        const m = unknownM as Record<string, unknown>;
        return {
            ...m,
            id: m.id || generateId(),
            role: m.role || m.Gorev || 'Üye',
            mainName: m.mainName || m.AsilAd || '',
            mainTitle: m.mainTitle || m.AsilUnvan || '',
            reserveName: m.reserveName || m.YedekAd || '',
            reserveTitle: m.reserveTitle || m.YedekUnvan || ''
        };
    }).filter(Boolean);

    return {
        institutionSettings: migratedInstitutionSettings,
        boardMembers: migratedBoardMembers,
        students: migratedStudents,
        incidents: migratedIncidents,
        apiKey: apiKey
    };
};
