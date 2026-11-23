/**
 * Öğrenci Yazılı Uyarı Tutanağı (öğrenci ve velisine imzalatılır).
 * Bu belge disiplin cezası değildir; bilgilendirme ve belgelendirme amaçlıdır.
 */
import { Institution, Student, WrittenWarning } from '../types';
import { formatDateTr, getBehaviorRef } from './warningCatalog';

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const nl2br = (v: string) => esc(v).replace(/\n/g, '<br>');

const headerHtml = (inst: Institution) => {
  const top = inst.district
    ? `${esc(inst.district.toLocaleUpperCase('tr-TR'))} KAYMAKAMLIĞI`
    : inst.province ? `${esc(inst.province.toLocaleUpperCase('tr-TR'))} VALİLİĞİ` : '';
  return `
  <div style="text-align:center; font-weight:bold; line-height:1.35; font-size:11pt; margin-bottom:10px;">
    T.C.<br>
    ${top ? top + '<br>' : ''}
    ${esc((inst.name || '................................................').toLocaleUpperCase('tr-TR'))} MÜDÜRLÜĞÜ
  </div>`;
};

export const buildWrittenWarningBody = (
  w: WrittenWarning,
  inst: Institution,
  student?: Student,
  opts?: { priorCount?: number }
): string => {
  const name = student?.name || w.studentName;
  const number = student?.number || w.studentNumber;
  const grade = student?.grade || w.studentGrade;
  const parent = w.parentName || student?.parentName || '';
  const ref = getBehaviorRef(w.behaviorKey, inst.type);
  const dateStr = formatDateTr(w.date);
  const timeStr = w.time || '..:..';
  const priorNote = opts?.priorCount && opts.priorCount > 0
    ? `<p style="margin:6px 0; font-size:10pt; text-align:justify;"><b>Not:</b> Öğrenci aynı davranış nedeniyle daha önce ${opts.priorCount} kez yazılı olarak uyarılmıştır.</p>`
    : '';

  return `
  ${headerHtml(inst)}
  <div style="text-align:center; font-weight:bold; font-size:12.5pt; margin:8px 0 2px;">ÖĞRENCİ YAZILI UYARI TUTANAĞI</div>
  <table style="width:100%; font-size:10pt; margin:8px 0 10px; border-collapse:collapse;">
    <tr>
      <td style="text-align:left;"><b>Sayı:</b> ${esc(w.documentNo || '..........')}</td>
      <td style="text-align:right;"><b>Tarih / Saat:</b> ${dateStr} - ${esc(timeStr)}</td>
    </tr>
  </table>

  <table style="width:100%; border-collapse:collapse; font-size:10.5pt;">
    <tr>
      <td style="border:1px solid #444; padding:5px 8px; width:28%; font-weight:bold; background:#f3f4f6;">Adı Soyadı</td>
      <td style="border:1px solid #444; padding:5px 8px;">${esc(name)}</td>
      <td style="border:1px solid #444; padding:5px 8px; width:16%; font-weight:bold; background:#f3f4f6;">Okul No</td>
      <td style="border:1px solid #444; padding:5px 8px; width:18%;">${esc(number)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #444; padding:5px 8px; font-weight:bold; background:#f3f4f6;">Sınıfı</td>
      <td style="border:1px solid #444; padding:5px 8px;">${esc(grade)}</td>
      <td style="border:1px solid #444; padding:5px 8px; font-weight:bold; background:#f3f4f6;">Olay Yeri</td>
      <td style="border:1px solid #444; padding:5px 8px;">${esc(w.location || '')}</td>
    </tr>
    <tr>
      <td style="border:1px solid #444; padding:5px 8px; font-weight:bold; background:#f3f4f6;">Velisi</td>
      <td colspan="3" style="border:1px solid #444; padding:5px 8px;">${esc(parent)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #444; padding:5px 8px; font-weight:bold; background:#f3f4f6;">Uyarıya Konu Davranış</td>
      <td colspan="3" style="border:1px solid #444; padding:5px 8px;"><b>${esc(w.behaviorTitle)}</b>${ref ? ` <span style="font-size:9pt; color:#444;">(İlgili yönetmelik: ${esc(ref)})</span>` : ''}</td>
    </tr>
  </table>

  <div style="font-weight:bold; font-size:10.5pt; margin:12px 0 4px;">Davranışın Açıklaması:</div>
  <div style="border:1px solid #444; min-height:70px; padding:6px 8px; font-size:10.5pt; line-height:1.45;">${w.description ? nl2br(w.description) : '<br><br><br>'}</div>

  <p style="text-indent:28px; line-height:1.5; font-size:10.5pt; margin-top:12px; text-align:justify;">
    Yukarıda kimlik bilgileri yazılı okulumuz öğrencisi <b>${esc(name)}</b>, <b>${dateStr}</b> tarihinde saat <b>${esc(timeStr)}</b> sularında
    belirtilen davranışta bulunmuştur. Öğrenciye davranışının okul kurallarına aykırı olduğu, öğrencilerden beklenen olumlu davranışlar
    anlatılmış ve aynı davranışın tekrarı hâlinde yürürlükteki mevzuat kapsamında disiplin işlemi yönünden değerlendirme yapılabileceği
    hususunda öğrenci ve velisi <b>yazılı olarak uyarılmıştır</b>. İşbu tutanak öğrenci ve velisi ile birlikte imza altına alınmıştır.
  </p>
  ${priorNote}
  <p style="font-size:9pt; color:#333; border-top:1px dashed #999; padding-top:5px; margin-top:8px; text-align:justify;">
    Bilgi: Bu tutanak, öğrencinin davranışı hakkında bilgilendirilmesini ve uyarılmasını belgeleyen bir kayıttır; disiplin cezası değildir,
    e-Okul sistemine disiplin cezası olarak işlenmez ve davranış puanında herhangi bir düşüşe neden olmaz.
  </p>

  <table style="width:100%; margin-top:22px; font-size:10.5pt; text-align:center; border-collapse:collapse;">
    <tr>
      <td style="width:33%; vertical-align:top; padding:4px;"><b>Öğrenci</b><br><br><br>${esc(name)}<br>İmza</td>
      <td style="width:34%; vertical-align:top; padding:4px;"><b>Veli</b><br><br><br>${esc(parent || '.................................')}<br>İmza</td>
      <td style="width:33%; vertical-align:top; padding:4px;"><b>Uyarıyı Yapan</b><br><br><br>${esc(w.warnedBy || '.................................')}<br>${esc(w.warnedByTitle || 'Öğretmen / Müdür Yardımcısı')}<br>İmza</td>
    </tr>
  </table>
  <div style="text-align:center; margin-top:26px; font-size:10.5pt;">
    <b>UYGUNDUR</b><br>${dateStr}<br><br><br>
    ${esc(inst.managerName || '.................................')}<br>Okul Müdürü
  </div>`;
};

export const buildWrittenWarningHtml = (
  w: WrittenWarning,
  inst: Institution,
  student?: Student,
  opts?: { priorCount?: number }
): string => `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>Yazılı Uyarı Tutanağı - ${esc(w.studentName)}</title>
<style>
  @page { size: A4 portrait; margin: 18mm 18mm 16mm 20mm; }
  body { font-family: 'Times New Roman', Times, serif; color:#000; margin:0; }
  table { page-break-inside: avoid; }
  @media screen { body { max-width: 190mm; margin: 12px auto; } }
</style></head>
<body>${buildWrittenWarningBody(w, inst, student, opts)}</body></html>`;

/** Word'ün açabildiği .doc (HTML tabanlı) dosyası olarak indirir */
export const downloadWrittenWarningDoc = (w: WrittenWarning, inst: Institution, student?: Student, opts?: { priorCount?: number }) => {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Yazılı Uyarı Tutanağı</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page WordSection1 { size:21cm 29.7cm; margin:1.8cm 1.8cm 1.6cm 2cm; } div.WordSection1 { page:WordSection1; } body { font-family:'Times New Roman'; }</style>
</head><body><div class="WordSection1">${buildWrittenWarningBody(w, inst, student, opts)}</div></body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const safeName = (w.studentName || 'ogrenci').replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+/g, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `yazili_uyari_tutanagi_${safeName}_${w.date || ''}.doc`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
