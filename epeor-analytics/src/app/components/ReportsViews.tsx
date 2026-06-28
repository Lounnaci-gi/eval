"use client";

import { useEffect, useState, Fragment } from "react";
import { saveAs } from "file-saver";
import {
  ChevronRight, Search, Printer, FileText, FileSpreadsheet,
  MapPin, BarChart3, Users, UserX,
} from "lucide-react";
import { apiUrlObject } from "../lib/api";
import { formatPeriodLabel, appendSecteurParam } from "./utils";

export function SubscriberDrillDownView({ targetName, column, startDate, endDate, onClose, selectedSecteur = '' }: any) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const COLUMN_LABELS: Record<string, string> = {
    ca_eau: 'CA Eau',
    ca_prestation: 'CA Prestation',
    ca: 'Total CA',
    ca_recouvre: 'CA Recouvré',
    recouvre: 'Encaissement',
    creance: 'Créance',
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSubscribers([]);
    const url = apiUrlObject('/creance_subscribers');
    if (startDate) url.searchParams.append('start_date', startDate);
    if (endDate) url.searchParams.append('end_date', endDate);
    if (targetName) url.searchParams.append('target_name', targetName);
    if (column) url.searchParams.append('column', column);
    appendSecteurParam(url, selectedSecteur);
    fetch(url.toString())
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); } else { setSubscribers(data.subscribers || []); }
        setLoading(false);
      })
      .catch(() => { setError('Erreur de connexion au serveur.'); setLoading(false); });
  }, [targetName, column, startDate, endDate, selectedSecteur]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ') + ' DA';

  const filtered = subscribers.filter(s =>
    !search ||
    s.numab?.toLowerCase().includes(search.toLowerCase()) ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.commune?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const columnLabel = COLUMN_LABELS[column] || column;

  const exportCSV = () => {
    const header = ['Code Abonné', 'Nom / Raison Sociale', 'Commune', 'Type Abonné', columnLabel, 'Nb Opérations'];
    const rows = filtered.map((s: any) => [s.numab, s.name, s.commune, s.type_abonne, s.amount, s.count]);
    const csv = [header, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `abonnes_${targetName}_${column}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between p-8 pb-6 border-b border-[#F2F4F7] bg-gradient-to-r from-brand-50/60 to-white flex-shrink-0">
        <div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#101828] mb-4 transition-all active:scale-95 cursor-pointer"
          >
            <ChevronRight className="rotate-180" size={16} /> Retour à la répartition
          </button>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border bg-brand-50 text-brand-600 border-brand-100">
              Détail Abonnés
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border bg-blue-50 text-blue-600 border-blue-100">
              {columnLabel}
            </span>
          </div>
          <h2 className="text-xl font-black text-[#101828] tracking-tight">{targetName}</h2>
          <p className="text-sm text-[#667085] mt-1 font-medium">
            {loading ? 'Chargement...' : `${filtered.length} abonné${filtered.length !== 1 ? 's' : ''} trouvé${filtered.length !== 1 ? 's' : ''}`}
            {startDate ? ` · du ${startDate.slice(6,8)}/${startDate.slice(4,6)}/${startDate.slice(0,4)}` : ''}
            {endDate ? ` au ${endDate.slice(6,8)}/${endDate.slice(4,6)}/${endDate.slice(0,4)}` : ''}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-8 py-4 border-b border-[#F2F4F7] flex-shrink-0">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3] pointer-events-none">
            <Search size={14} />
          </div>
          <input
            type="text"
            placeholder="Rechercher par code abonné, nom ou commune..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-medium text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100/50 transition-all"
          />
        </div>
        <button
          onClick={exportCSV}
          disabled={loading || filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet size={13} />
          Exporter CSV
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-56 gap-4">
            <div className="w-10 h-10 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-[#667085]">Chargement des abonnés...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center">
              <UserX className="text-rose-500" size={24} />
            </div>
            <p className="text-sm font-bold text-rose-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
              <Users className="text-[#D0D5DD]" size={24} />
            </div>
            <p className="text-sm font-medium text-[#667085]">Aucun abonné trouvé pour ce filtre.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black border-b border-[#F2F4F7]">
                <th className="px-6 py-4 w-12">#</th>
                <th className="px-4 py-4">Code Abonn.</th>
                <th className="px-4 py-4">Nom / Raison Sociale</th>
                <th className="px-4 py-4">Commune</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4 text-right text-brand-600">{columnLabel}</th>
                <th className="px-6 py-4 text-right">Opérations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {paged.map((s: any, i: number) => (
                <tr key={s.numab} className="hover:bg-brand-50/20 transition-colors">
                  <td className="px-6 py-3.5 text-xs text-[#98A2B3] font-mono">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[11px] font-bold text-[#101828] bg-[#F9FAFB] px-2 py-0.5 rounded border border-[#E4E7EC]">{s.numab}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-[#101828]">{s.name}</td>
                  <td className="px-4 py-3.5 text-xs text-[#475467] font-medium">{s.commune}</td>
                  <td className="px-4 py-3.5 text-[11px] text-[#667085]">{s.type_abonne}</td>
                  <td className="px-4 py-3.5 text-right font-black text-sm text-brand-600 whitespace-nowrap">{fmt(s.amount)}</td>
                  <td className="px-6 py-3.5 text-right text-xs font-bold text-[#475467]">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between px-8 py-4 border-t border-[#F2F4F7] bg-[#F9FAFB]/50 flex-shrink-0">
          <span className="text-xs text-[#667085] font-medium">
            Page {page} / {totalPages} · {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >← Préc.</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let p: number;
              if (totalPages <= 5) p = idx + 1;
              else if (page <= 3) p = idx + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + idx;
              else p = page - 2 + idx;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    page === p ? 'bg-brand-600 text-white shadow-sm' : 'text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD]'
                  }`}
                >{p}</button>
              );
            })}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#475467] bg-white border border-[#E4E7EC] hover:border-[#D0D5DD] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >Suiv. →</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CreanceVentilationView({
  ventilationData, setVentilationData, lastVentDate, setLastVentDate,
  ventilationFilter, setVentilationFilter, onGoToCalculation,
  selectedSecteur = '', sectors = [], uniteLabel = '', endDate = ''
}: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateArrete, setDateArrete] = useState(
    endDate || (lastVentDate ? lastVentDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '')
  );
  const [expandedSections, setExpandedSections] = useState<string[]>(['EAU', 'PRESTATIONS']);

  const secteurLabel = selectedSecteur
    ? (sectors.find((s: { code: string; libelle: string }) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ') + " DA";

  const fmtNum = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ');

  const formatVentDate = (d: string) =>
    d.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const fetchVentilation = async (rawDate?: string) => {
    setLoading(true);
    setError(null);
    const ventDate = (rawDate || dateArrete || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    setLastVentDate(ventDate);
    try {
      const ventUrl = apiUrlObject('/creance_detaillee');
      ventUrl.searchParams.set('date_arrete', ventDate);
      appendSecteurParam(ventUrl, selectedSecteur);
      const res = await fetch(ventUrl.toString());
      const d = await res.json();
      if (d?.error) {
        setError(d.error);
        setVentilationData([]);
      } else {
        setVentilationData(Array.isArray(d) ? d : []);
        setVentilationFilter('ALL');
      }
    } catch {
      setError("Erreur de connexion au serveur.");
      setVentilationData([]);
    }
    setLoading(false);
  };

  const exportToExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ventilation");
      const formattedDate = formatVentDate(lastVentDate);
      const today = new Date();
      const printDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.addRow([]);

      try {
        const response = await fetch('/ade.png');
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const imageId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
          worksheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 100, height: 60 } });
        }
      } catch { /* logo optionnel */ }

      worksheet.mergeCells('C2:E2');
      const titleCell = worksheet.getCell('C2');
      titleCell.value = `Détail Ventilation des Créances — Arrêtées au : ${formattedDate}`;
      titleCell.font = { bold: true, size: 12 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('E4').value = `Edité le : ${printDate}`;
      worksheet.getCell('E4').alignment = { horizontal: 'right' };
      worksheet.addRow([]);

      const headerRow = worksheet.addRow(['Section', 'Type', 'Désignation', 'Volume', 'Créance Nette (DA)']);
      headerRow.font = { bold: true };
      worksheet.getColumn(1).width = 25;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 40;
      worksheet.getColumn(4).width = 15;
      worksheet.getColumn(5).width = 25;

      const sections = ventilationFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [ventilationFilter];
      let globalTotalVolume = 0;
      let globalTotalCreance = 0;
      let currentRow = 7;

      sections.forEach(section => {
        const rows = ventilationData.filter((r: any) => r.SECTION === section);
        if (rows.length === 0) return;
        const subTotalCreance = rows.reduce((acc: number, r: any) => acc + r.CREANCE, 0);
        const subTotalVolume = rows.reduce((acc: number, r: any) => acc + r.NBR_FACTURES, 0);
        globalTotalVolume += subTotalVolume;
        globalTotalCreance += subTotalCreance;
        rows.forEach((row: any, i: number) => {
          worksheet.addRow([i === 0 ? section : "", row.TYPE_CODE, row.CATEGORIE, row.NBR_FACTURES, row.CREANCE]);
        });
        if (rows.length > 1) {
          worksheet.mergeCells(`A${currentRow}:A${currentRow + rows.length - 1}`);
          worksheet.getCell(`A${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
          worksheet.getCell(`A${currentRow}`).font = { bold: true };
        }
        currentRow += rows.length;
        const subTotalRow = worksheet.addRow([`Sous-total ${section}`, '', '', subTotalVolume, subTotalCreance]);
        subTotalRow.font = { bold: true };
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow++;
      });

      const globalTotalRow = worksheet.addRow(['TOTAL GÉNÉRAL', '', '', globalTotalVolume, globalTotalCreance]);
      globalTotalRow.font = { bold: true };
      worksheet.mergeCells(`A${currentRow}:C${currentRow}`);

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `ventilation_${lastVentDate || 'export'}.xlsx`);
    } catch {
      alert("Une erreur est survenue lors de l'exportation Excel.");
    }
  };

  const exportToPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      const formattedDate = formatVentDate(lastVentDate);
      const pageWidth = doc.internal.pageSize.width;
      doc.setFontSize(9.5);
      doc.setTextColor(16, 24, 40);
      doc.text(`Détail Ventilation des Créances — Arrêtées au : ${formattedDate}`, pageWidth / 2, 20, { align: 'center' });

      const bodyData: any[] = [];
      const sections = ventilationFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [ventilationFilter];
      let globalTotalVolume = 0;
      let globalTotalCreance = 0;

      sections.forEach(section => {
        const rows = ventilationData.filter((r: any) => r.SECTION === section);
        if (rows.length === 0) return;
        const subTotalCreance = rows.reduce((acc: number, r: any) => acc + r.CREANCE, 0);
        const subTotalVolume = rows.reduce((acc: number, r: any) => acc + r.NBR_FACTURES, 0);
        globalTotalVolume += subTotalVolume;
        globalTotalCreance += subTotalCreance;
        rows.forEach((row: any, i: number) => {
          const rowData: any[] = [];
          if (i === 0) {
            rowData.push({
              content: section.split('').join('\n'),
              rowSpan: rows.length,
              styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: rows.length < 5 ? 5 : 8,
                textColor: section === 'EAU' ? [13, 131, 222] : [13, 148, 136] }
            });
          }
          rowData.push(
            { content: row.TYPE_CODE, styles: { halign: 'center', fontStyle: 'bold', textColor: [102, 112, 133] } },
            { content: row.CATEGORIE, styles: { textColor: [16, 24, 40] } },
            { content: fmtNum(row.NBR_FACTURES), styles: { halign: 'right', textColor: [71, 84, 103] } },
            { content: fmt(row.CREANCE), styles: { halign: 'right', fontStyle: 'bold', textColor: [16, 24, 40] } }
          );
          bodyData.push(rowData);
        });
        const fillColor: [number, number, number] = section === 'EAU' ? [239, 246, 255] : [240, 253, 250];
        bodyData.push([
          { content: `Sous-total ${section}`, colSpan: 3, styles: { fontStyle: 'bold', fillColor, textColor: [16, 24, 40] } },
          { content: fmtNum(subTotalVolume), styles: { fontStyle: 'bold', halign: 'right', fillColor, textColor: [71, 84, 103] } },
          { content: fmt(subTotalCreance), styles: { fontStyle: 'bold', halign: 'right', fillColor, textColor: [16, 24, 40] } }
        ]);
      });

      // Use a light background for the grand total to match subtotals (no dark background)
      const totalFill: [number, number, number] = [249, 250, 251];
      bodyData.push([
        { content: 'TOTAL GÉNÉRAL', colSpan: 3, styles: { fontStyle: 'bold', fillColor: totalFill, textColor: [16, 24, 40] } },
        { content: fmtNum(globalTotalVolume), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [71, 84, 103] } },
        { content: fmt(globalTotalCreance), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [16, 24, 40] } }
      ]);

      autoTable(doc, {
        startY: 32,
        margin: { bottom: 12 },
        head: [['Section', 'Type', 'Désignation', 'Volume', 'Créance Nette']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [249, 250, 251], textColor: [71, 84, 103], fontStyle: 'bold', lineWidth: 0.1, lineColor: [228, 231, 236] },
        styles: { fontSize: 8.5, cellPadding: 3, lineColor: [242, 244, 247], lineWidth: 0.1 },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 15 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 25 }, 4: { cellWidth: 35 } }
      });
      doc.save(`ventilation_${lastVentDate || 'export'}.pdf`);
    } catch {
      alert("Une erreur est survenue lors de l'exportation PDF.");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const titleStr = "Détail Ventilation des Créances Arrêtées";
    const subTitleStr = secteurLabel
      ? "Centre : " + secteurLabel
      : "Toute l'unité";
    const dateStr = lastVentDate ? "Arrêtées au " + formatVentDate(lastVentDate) : "";
    const printDate = new Date().toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const activeSections = ventilationFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [ventilationFilter];

    let tableRowsHtml = "";

    activeSections.forEach(section => {
      const sectionRows = ventilationData.filter((r: any) => r.SECTION === section);
      if (sectionRows.length === 0) return;

      const subTotalCreance = sectionRows.reduce((acc: number, r: any) => acc + r.CREANCE, 0);
      const subTotalVolume = sectionRows.reduce((acc: number, r: any) => acc + r.NBR_FACTURES, 0);

      const isEau = section === 'EAU';

      tableRowsHtml += `
        <tr class="group-header">
          <td colspan="5" style="padding: 8px 12px; font-weight: bold; background: ${isEau ? '#eff6ff' : '#f0fdf4'}; border-bottom: 1px solid #e2e8f0;">
            <span class="badge ${isEau ? 'badge-blue' : 'badge-green'}">${section}</span>
            <span style="margin-left: 6px; font-size: 9px; color: #475467;">(${sectionRows.length} types)</span>
          </td>
        </tr>
      `;

      sectionRows.forEach((row: any) => {
        tableRowsHtml += `
          <tr>
            <td style="padding: 6px 12px; font-family: monospace; font-size: 9px; font-weight: bold; color: #475467; border-bottom: 1px solid #f2f4f7;">${row.TYPE_CODE}</td>
            <td style="padding: 6px 12px; font-weight: bold; border-bottom: 1px solid #f2f4f7;">${row.CATEGORIE}</td>
            <td style="padding: 6px 12px; text-align: center; color: #667085; font-size: 8px; border-bottom: 1px solid #f2f4f7;">Code: ${row.ORDRE}</td>
            <td style="padding: 6px 12px; text-align: right; color: #475467; font-family: monospace; border-bottom: 1px solid #f2f4f7;">${fmtNum(row.NBR_FACTURES)}</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: bold; color: #101828; font-family: monospace; border-bottom: 1px solid #f2f4f7;">${fmt(row.CREANCE)}</td>
          </tr>
        `;
      });

      tableRowsHtml += `
        <tr class="subtotal-row" style="background: #f8fafc; font-weight: bold; border-top: 1px solid #e2e8f0; border-bottom: 2px solid #cbd5e1;">
          <td colspan="3" style="padding: 8px 12px; text-transform: uppercase; font-size: 9px;">Sous-total ${section}</td>
          <td style="padding: 8px 12px; text-align: right; color: #475467; font-family: monospace;">${fmtNum(subTotalVolume)}</td>
          <td style="padding: 8px 12px; text-align: right; color: ${isEau ? '#1e40af' : '#0f766e'}; font-family: monospace;">${fmt(subTotalCreance)}</td>
        </tr>
      `;
    });

    if (ventilationFilter === 'ALL') {
      const globalTotalVolume = ventilationData.reduce((acc: number, r: any) => acc + r.NBR_FACTURES, 0);
      const globalTotalCreance = ventilationData.reduce((acc: number, r: any) => acc + r.CREANCE, 0);
      tableRowsHtml += `
        <tr style="background: #f8fafc; color: #101828; font-weight: bold; font-size: 9.5px;">
          <td colspan="3" style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none;">Total Général</td>
          <td style="padding: 9px 12px; text-align: right; color: #475467; border-bottom: none; font-family: monospace;">${fmtNum(globalTotalVolume)}</td>
          <td style="padding: 9px 12px; text-align: right; color: #101828; border-bottom: none; font-family: monospace;">${fmt(globalTotalCreance)}</td>
        </tr>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: portrait;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-text {
              font-size: 14px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              padding: 1.5px 5px;
              border-radius: 3px;
              font-size: 8px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .badge-blue {
              background-color: #dbeafe;
              color: #1e40af;
              border: 1px solid #bfdbfe;
            }
            .badge-green {
              background-color: #d1fae5;
              color: #065f46;
              border: 1px solid #a7f3d0;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Analyses Financières</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'Arrêté</span>
              <span class="meta-value">${dateStr || "—"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">Type</th>
                <th>Désignation</th>
                <th style="text-align: center; width: 60px;">Ordre</th>
                <th style="text-align: right; width: 80px;">Volume</th>
                <th style="text-align: right; width: 120px;">Créance Nette</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Ventilation des créances</span>
            <span>Généré automatiquement</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!ventilationData.length && !loading && !lastVentDate) {
    return (
      <div className="bg-[#F9FAFB] border-2 border-dashed border-[#E4E7EC] rounded-[2rem] p-16 flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center border border-brand-100 shadow-inner">
          <BarChart3 className="text-brand-600" size={36} />
        </div>
        <div>
          <p className="text-lg font-black text-[#101828]">Ventilation des créances</p>
          <p className="text-sm text-[#667085] mt-2 max-w-md">
            Lancez un calcul depuis la <strong>Synthèse Globale</strong>, ou choisissez une date d&apos;arrêté ci-dessous.
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-center gap-3">
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Date d&apos;arrêté</label>
            <input
              type="date"
              value={dateArrete}
              onChange={(e) => setDateArrete(e.target.value)}
              className="block bg-white border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="button"
            onClick={() => fetchVentilation()}
            className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black hover:bg-brand-700 transition-all h-[42px]"
          >
            Calculer la ventilation
          </button>
        </div>
        <button
          type="button"
          onClick={onGoToCalculation}
          className="text-xs font-bold text-brand-600 hover:text-brand-800"
        >
          Aller à la Synthèse Globale →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {secteurLabel && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-xs font-bold text-[#0D83DE]">
          <MapPin size={16} className="shrink-0" />
          <span>
            Périmètre : centre <strong className="font-black">{secteurLabel}</strong>
            {uniteLabel ? ` — unité ${uniteLabel}` : ''}
          </span>
        </div>
      )}

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Détail Ventilation des Créances Arrêtées</h3>
          <p className="text-sm text-[#667085] mt-1 font-medium">
            {lastVentDate
              ? `Arrêtées au ${formatVentDate(lastVentDate)}`
              : 'Sélectionnez une date d\'arrêté pour recalculer'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#98A2B3] uppercase px-1">Date d&apos;arrêté</label>
            <input
              type="date"
              value={dateArrete}
              onChange={(e) => setDateArrete(e.target.value)}
              className="block bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="button"
            onClick={() => fetchVentilation()}
            disabled={loading}
            className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black hover:bg-brand-700 disabled:opacity-50 transition-all h-[42px] flex items-center gap-2"
          >
            <Search size={14} />
            {loading ? 'Calcul…' : 'Recalculer'}
          </button>
          <div className="flex bg-[#F2F4F7] p-1 rounded-xl gap-1 border border-[#E4E7EC]">
            {(['ALL', 'EAU', 'PRESTATIONS'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setVentilationFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  ventilationFilter === f ? 'bg-white text-brand-600 shadow-sm' : 'text-[#667085] hover:text-[#101828]'
                }`}
              >
                {f === 'ALL' ? 'Tout' : f === 'EAU' ? 'Eau' : 'Prestations'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-600 font-bold text-sm">{error}</div>
      )}

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b border-[#F2F4F7] flex justify-between items-center bg-slate-50/50">
          <div>
            <h4 className="text-xl font-black tracking-tight text-[#101828]">
              Détail Ventilation des Créances Arrêtées au : {lastVentDate ? formatVentDate(lastVentDate) : '—'}
            </h4>
            <p className="text-sm text-[#667085] mt-1">
              Section {ventilationFilter === 'ALL' ? 'Eau & Prestations' : ventilationFilter}
            </p>
          </div>
          {!loading && ventilationData.length > 0 && (
            <div className="flex gap-2">
              <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-xs font-black hover:bg-emerald-100 transition-all shadow-sm">
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-black hover:bg-rose-100 transition-all shadow-sm">
                <FileText size={14} /> PDF
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-xl text-xs font-black hover:bg-slate-900 transition-all shadow-sm">
                <Printer size={14} /> Imprimer
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-[0.15em] font-black border-b border-[#E4E7EC]">
                <th className="px-8 py-5 border-b border-[#E4E7EC]">Section</th>
                <th className="px-6 py-5 border-b border-[#E4E7EC]">Type</th>
                <th className="px-6 py-5 border-b border-[#E4E7EC]">Désignation</th>
                <th className="px-6 py-5 text-right border-b border-[#E4E7EC]">Volume</th>
                <th className="px-8 py-5 text-right border-b border-[#E4E7EC]">Créance Nette</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {loading ? (
                <tr><td colSpan={5} className="px-8 py-12 text-center text-sm font-bold text-[#667085]">Chargement du détail…</td></tr>
              ) : ventilationData.length > 0 ? (
                <>
                  {(ventilationFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [ventilationFilter]).map(section => {
                    const rows = ventilationData.filter((r: any) => r.SECTION === section);
                    if (rows.length === 0) return null;
                    const isExpanded = expandedSections.includes(section);
                    const subTotal = rows.reduce((acc: number, r: any) => acc + r.CREANCE, 0);
                    return (
                      <Fragment key={section}>
                        <tr
                          onClick={() => toggleSection(section)}
                          className={`${section === 'EAU' ? 'bg-blue-50/10' : 'bg-teal-50/10'} cursor-pointer hover:bg-slate-50 transition-colors border-y border-[#F2F4F7]`}
                        >
                          <td colSpan={5} className="px-8 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                <ChevronRight size={16} className="text-[#98A2B3]" />
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${section === 'EAU' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                {section}
                              </span>
                              <span className="text-[11px] font-bold text-[#667085]">
                                {isExpanded ? 'Masquer le détail' : `Afficher le détail (${rows.length} lignes)`}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && rows.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-blue-50/20 transition-colors group">
                            {i === 0 ? (
                              <td rowSpan={rows.length} className={`px-5 py-8 text-center border-r border-[#F2F4F7] ${section === 'EAU' ? 'bg-blue-50/10' : 'bg-teal-50/10'}`}>
                                <div className="flex flex-col items-center justify-center h-full">
                                  <span className={`[writing-mode:vertical-lr] rotate-180 text-[13px] font-black uppercase tracking-[0.4em] ${section === 'EAU' ? 'text-blue-500' : 'text-teal-500'}`}>
                                    {section}
                                  </span>
                                </div>
                              </td>
                            ) : null}
                            <td className="px-6 py-4">
                              <span className="font-mono text-[11px] font-bold text-[#667085] bg-[#F2F4F7] px-1.5 py-0.5 rounded">{row.TYPE_CODE}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-[13px] text-[#101828] uppercase tracking-tight">{row.CATEGORIE}</div>
                              <div className="text-[9px] text-[#98A2B3] font-medium uppercase mt-0.5">Code: {row.ORDRE}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="font-bold text-[13px] text-[#475467] font-mono tabular-nums">{fmtNum(row.NBR_FACTURES)}</div>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <div className="font-black text-[13px] text-[#101828] font-mono tracking-tighter">{fmt(row.CREANCE)}</div>
                            </td>
                          </tr>
                        ))}
                        <tr className={`${section === 'EAU' ? 'bg-blue-50/40' : 'bg-teal-50/40'} border-y border-[#F2F4F7]/50`}>
                          <td colSpan={3} className="px-8 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-1 h-4 rounded-full ${section === 'EAU' ? 'bg-blue-400' : 'bg-teal-400'} opacity-50`}></div>
                              <span className="font-black text-[12px] text-[#101828] uppercase tracking-wider">Sous-total {section}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-black text-[13px] text-[#475467] font-mono">{fmtNum(rows.reduce((acc: number, r: any) => acc + r.NBR_FACTURES, 0))}</span>
                          </td>
                          <td className="px-8 py-4 text-right">
                            <span className={`font-black text-[15px] ${section === 'EAU' ? 'text-blue-700' : 'text-teal-700'} font-mono tracking-tighter`}>{fmt(subTotal)}</span>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  {ventilationFilter === 'ALL' && (
                    <tr className="bg-slate-950 text-white relative z-20">
                      <td colSpan={3} className="px-8 py-7">
                        <div className="flex flex-col">
                          <span className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400 mb-1">Analyse Consolidée</span>
                          <span className="font-black text-lg text-white">Total Créance Ventilation</span>
                        </div>
                      </td>
                      <td className="px-6 py-7 text-right align-bottom">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Volume Global</div>
                        <div className="font-black text-lg text-slate-200 font-mono">{fmtNum(ventilationData.reduce((acc: number, r: any) => acc + r.NBR_FACTURES, 0))}</div>
                      </td>
                      <td className="px-8 py-7 text-right align-bottom bg-white/5 border-l border-white/10">
                        <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Créance Totale Arrêtée</div>
                        <div className="font-black text-2xl tracking-tighter text-white font-mono">{fmt(ventilationData.reduce((acc: number, r: any) => acc + r.CREANCE, 0))}</div>
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-sm font-bold text-[#667085]">
                    Aucune donnée — lancez un calcul ou choisissez une autre date d&apos;arrêté.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CreanceRepartitionView({ data, typeSectionFilter, setTypeSectionFilter, onGoToCalculation, startDate, endDate, selectedSecteur = '', sectors = [] }: any) {
  const [expandedTypes, setExpandedTypes] = useState<string[]>(['EAU', 'PRESTATIONS']);
  const [drillDown, setDrillDown] = useState<{targetName: string, column: string} | null>(null);
  const secteurLabel = selectedSecteur
    ? (sectors.find((s: { code: string; libelle: string }) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ') + " DA";


  const toggleTypeSection = (section: string) => {
    setExpandedTypes(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour pouvoir imprimer.");
      return;
    }

    const formatDateStr = (d: string) => {
      if (!d) return "";
      const cleaned = d.trim();
      if (/^\d{8}$/.test(cleaned)) {
        return cleaned.substring(6, 8) + "-" + cleaned.substring(4, 6) + "-" + cleaned.substring(0, 4);
      }
      const parts = cleaned.split(/[-/]/);
      if (parts.length === 3 && parts[0].length === 4) {
        return parts[2] + "-" + parts[1] + "-" + parts[0];
      }
      return d;
    };

    const titleStr = "Répartition par Type d'Abonné";
    const subTitleStr = secteurLabel
      ? "Centre : " + secteurLabel
      : "Toute l'unité";
    const formattedStart = formatDateStr(startDate);
    const formattedEnd = formatDateStr(endDate);
    const dateStr = formattedStart && formattedEnd ? "Période du " + formattedStart + " au " + formattedEnd : "";
    const printDate = new Date().toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const activeSections = typeSectionFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [typeSectionFilter];

    let tableRowsHtml = "";

    activeSections.forEach(section => {
      const sectionRows = data.by_type.filter((t: any) => t.section === section);
      if (sectionRows.length === 0) return;

      const subTotalCaEau = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca_eau, 0);
      const subTotalCaPrest = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca_prestation, 0);
      const subTotalCa = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca, 0);
      const subTotalCaRecouvre = sectionRows.reduce((acc: number, curr: any) => acc + (curr.ca_recouvre || 0), 0);
      const subTotalRecouvre = sectionRows.reduce((acc: number, curr: any) => acc + curr.recouvre, 0);
      const subTotalCreance = sectionRows.reduce((acc: number, curr: any) => acc + curr.creance, 0);
      const subTotalSubCount = sectionRows.reduce((acc: number, curr: any) => acc + (curr.sub_count || 0), 0);
      const subTotalForfaitCount = sectionRows.reduce((acc: number, curr: any) => acc + (curr.forfait_count || 0), 0);
      const subTotalScCount = sectionRows.reduce((acc: number, curr: any) => acc + (curr.sc_count || 0), 0);
      const subTotalTaux = subTotalCa > 0 ? (subTotalCaRecouvre / subTotalCa * 100) : 0;

      const isEau = section === 'EAU';

      tableRowsHtml += `
        <tr class="group-header">
          <td colspan="13" style="padding: 8px 12px; font-weight: bold; background: ${isEau ? '#eff6ff' : '#f0fdf4'};">
            <span class="badge ${isEau ? 'badge-blue' : 'badge-green'}">${section}</span>
            <span style="margin-left: 6px; font-size: 9px; color: #475467;">(${sectionRows.length} types d'abonnés)</span>
          </td>
        </tr>
      `;

      sectionRows.forEach((t: any) => {
        tableRowsHtml += `
          <tr>
            <td style="padding: 5px 12px; font-family: monospace; font-size: 9px; font-weight: bold; color: #475467;">${t.type_code}</td>
            <td style="padding: 5px 12px; font-weight: bold;">${t.name}</td>
            <td style="padding: 5px 12px; text-align: right; font-weight: bold; color: #475467;">${t.sub_count || 0}</td>
            <td style="padding: 5px 12px; text-align: right; font-weight: bold; color: #e67e22;">${t.forfait_count || 0}</td>
            <td style="padding: 5px 12px; text-align: right; font-weight: bold; color: #7c3aed;">${t.sc_count || 0}</td>
            <td style="padding: 5px 12px; text-align: right; font-weight: bold; color: #e67e22;">${(t.sub_count > 0 ? (t.forfait_count / t.sub_count * 100) : 0).toFixed(2)}%</td>
            <td style="padding: 5px 12px; text-align: right; color: #2563eb;">${fmt(t.ca_eau)}</td>
            <td style="padding: 5px 12px; text-align: right; color: #0891b2;">${fmt(t.ca_prestation)}</td>
            <td style="padding: 5px 12px; text-align: right; font-weight: bold; color: #4f46e5;">${fmt(t.ca)}</td>
            <td style="padding: 5px 12px; text-align: right; color: #0d9488;">${fmt(t.ca_recouvre || 0)}</td>
            <td style="padding: 5px 12px; text-align: right; color: #059669;">${fmt(t.recouvre)}</td>
            <td style="padding: 5px 12px; text-align: right; font-weight: bold; color: #e11d48;">${fmt(t.creance)}</td>
            <td style="padding: 5px 12px; text-align: right; font-weight: bold;">${t.taux.toFixed(2)}%</td>
          </tr>
        `;
      });

      tableRowsHtml += `
        <tr class="subtotal-row" style="background: #f8fafc; font-weight: bold; border-top: 1px solid #e2e8f0; border-bottom: 2px solid #cbd5e1;">
          <td colspan="2" style="padding: 8px 12px; text-transform: uppercase; font-size: 9px;">Sous-total ${section}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #475467;">${subTotalSubCount}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #e67e22;">${subTotalForfaitCount}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #7c3aed;">${subTotalScCount}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #e67e22;">${(subTotalSubCount > 0 ? (subTotalForfaitCount / subTotalSubCount * 100) : 0).toFixed(2)}%</td>
          <td style="padding: 8px 12px; text-align: right; color: #2563eb;">${fmt(subTotalCaEau)}</td>
          <td style="padding: 8px 12px; text-align: right; color: #0891b2;">${fmt(subTotalCaPrest)}</td>
          <td style="padding: 8px 12px; text-align: right; color: #4f46e5;">${fmt(subTotalCa)}</td>
          <td style="padding: 8px 12px; text-align: right; color: #0d9488;">${fmt(subTotalCaRecouvre)}</td>
          <td style="padding: 8px 12px; text-align: right; color: #059669;">${fmt(subTotalRecouvre)}</td>
          <td style="padding: 8px 12px; text-align: right; color: #e11d48;">${fmt(subTotalCreance)}</td>
          <td style="padding: 8px 12px; text-align: right;">${subTotalTaux.toFixed(2)}%</td>
        </tr>
      `;
    });

    if (typeSectionFilter === 'ALL') {
      const totalTaux = data.total_ca > 0 ? (((data.total_ca_recouvre || 0) / data.total_ca) * 100) : 0;
      tableRowsHtml += `
        <tr style="background: #f1f5f9; color: #101828; font-weight: bold; font-size: 9.5px; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
          <td colspan="2" style="padding: 9px 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; color: #101828;">Total Général</td>
          <td style="padding: 9px 12px; text-align: right; color: #475467; border-bottom: none;">${data.total_sub_count || 0}</td>
          <td style="padding: 9px 12px; text-align: right; color: #c2410c; border-bottom: none;">${data.total_forfait_count || 0}</td>
          <td style="padding: 9px 12px; text-align: right; color: #6d28d9; border-bottom: none;">${data.total_sc_count || 0}</td>
          <td style="padding: 9px 12px; text-align: right; color: #c2410c; border-bottom: none;">${(data.total_sub_count > 0 ? (data.total_forfait_count / data.total_sub_count * 100) : 0).toFixed(2)}%</td>
          <td style="padding: 9px 12px; text-align: right; color: #1d4ed8; border-bottom: none;">${fmt(data.total_ca_eau)}</td>
          <td style="padding: 9px 12px; text-align: right; color: #0e7490; border-bottom: none;">${fmt(data.total_ca_prestation)}</td>
          <td style="padding: 9px 12px; text-align: right; color: #0d83de; border-bottom: none;">${fmt(data.total_ca)}</td>
          <td style="padding: 9px 12px; text-align: right; color: #0f766e; border-bottom: none;">${fmt(data.total_ca_recouvre || 0)}</td>
          <td style="padding: 9px 12px; text-align: right; color: #065f46; border-bottom: none;">${fmt(data.total_recouvre)}</td>
          <td style="padding: 9px 12px; text-align: right; color: #b91c1c; border-bottom: none;">${fmt(data.total_creance)}</td>
          <td style="padding: 9px 12px; text-align: right; color: #475467; border-bottom: none;">${totalTaux.toFixed(2)}%</td>
        </tr>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #101828;
              margin: 0;
              font-size: 9px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #F2F4F7;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-text {
              font-size: 14px;
              font-weight: 900;
              color: #0D83DE;
              letter-spacing: -0.5px;
              margin: 0;
            }
            .company-name {
              font-size: 8.5px;
              font-weight: 700;
              color: #667085;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 1px;
            }
            .title-section {
              text-align: right;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              color: #101828;
              margin: 0;
            }
            .subtitle {
              font-size: 9.5px;
              color: #667085;
              margin: 3px 0 0 0;
              font-weight: 500;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              background: #F9FAFB;
              border: 1px solid #E4E7EC;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 8px;
              text-transform: uppercase;
              color: #667085;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 10px;
              font-weight: 700;
              color: #101828;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              text-align: left;
            }
            th {
              background: #F9FAFB;
              color: #475467;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 12px;
              border-bottom: 1px solid #F2F4F7;
            }
            td {
              border-bottom: 1px solid #F2F4F7;
              padding: 5px 12px;
              font-size: 9px;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              padding: 1.5px 5px;
              border-radius: 3px;
              font-size: 8px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .badge-blue {
              background-color: #dbeafe;
              color: #1e40af;
              border: 1px solid #bfdbfe;
            }
            .badge-green {
              background-color: #d1fae5;
              color: #065f46;
              border: 1px solid #a7f3d0;
            }
            .footer-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #667085;
              font-size: 8px;
              border-top: 1px solid #F2F4F7;
              padding-top: 10px;
              margin-top: 20px;
            }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <div>
                <h1 class="logo-text">EPEOR ANALYTICS</h1>
                <div class="company-name">Algérienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <h2 class="title">${titleStr}</h2>
              <p class="subtitle">Analyses Financières</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Périmètre</span>
              <span class="meta-value">${subTitleStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Période</span>
              <span class="meta-value">${dateStr || "Toutes les dates"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date d'édition</span>
              <span class="meta-value">${printDate}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">Code</th>
                <th>Type d'Abonné</th>
                <th style="text-align: right;">Nombre d'abonnés</th>
                <th style="text-align: right; color: #e67e22;">Forfait</th>
                <th style="text-align: right; color: #7c3aed;">Sans Compteur</th>
                <th style="text-align: right; color: #e67e22;">Taux Forfait</th>
                <th style="text-align: right;">CA Eau</th>
                <th style="text-align: right;">CA Prest.</th>
                <th style="text-align: right;">Total CA</th>
                <th style="text-align: right;">CA Recouvré</th>
                <th style="text-align: right;">Encaissement</th>
                <th style="text-align: right;">Créance</th>
                <th style="text-align: right; width: 80px;">Taux Recov.</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            <span>EPEOR Analytics - Système d'analyse financière</span>
            <span>Page 1 sur 1</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!data || !data.by_type) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-12 text-center max-w-2xl mx-auto my-12 animate-in fade-in duration-300">
        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-100 shadow-inner">
          <BarChart3 className="text-brand-600" size={36} />
        </div>
        <h3 className="text-2xl font-black text-[#101828] mb-3">Aucune donnée disponible</h3>
        <p className="text-sm text-[#667085] leading-relaxed max-w-md mx-auto mb-8 font-medium">
          Les calculs financiers n'ont pas encore été lancés pour la période actuelle. Veuillez vous rendre sur la Synthèse Globale pour charger les données.
        </p>
        <button
          onClick={onGoToCalculation}
          className="inline-flex items-center justify-center px-6 py-3.5 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 active:scale-95 transition-all shadow-lg shadow-brand-600/25 border border-brand-500/10"
        >
          Aller à la Synthèse Globale
        </button>
      </div>
    );
  }

  if (drillDown) {
    return (
      <SubscriberDrillDownView
        targetName={drillDown.targetName}
        column={drillDown.column}
        startDate={startDate}
        endDate={endDate}
        selectedSecteur={selectedSecteur}
        onClose={() => setDrillDown(null)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Filters and Context */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition par Type d'Abonné</h3>
          <p className="text-sm text-[#667085] mt-1 font-medium">
            {secteurLabel
              ? `Centre ${secteurLabel} — cliquez sur un montant pour le détail abonnés`
              : "Cliquez sur un montant pour voir le détail des abonnés concernés"}
          </p>
          {formatPeriodLabel(startDate, endDate) && (
            <p className="text-sm text-[#334155] mt-2 font-medium">{formatPeriodLabel(startDate, endDate)}</p>
          )}
        </div>
        
        {/* Modern Tab Filters & Print Button */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <div className="flex bg-[#F2F4F7] p-1.5 rounded-2xl gap-1 border border-[#E4E7EC]">
            {[
              { id: 'ALL', label: 'Tous les Types' },
              { id: 'EAU', label: 'Eau Uniquement' },
              { id: 'PRESTATIONS', label: 'Prestations Uniquement' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTypeSectionFilter(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 border ${
                  typeSectionFilter === tab.id
                    ? 'bg-white text-brand-600 shadow-sm border-[#E4E7EC]/40'
                    : 'text-[#667085] border-transparent hover:text-[#101828]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-brand-600/10 border border-brand-500/10 h-[38px]"
            title="Imprimer cette répartition par type d'abonné"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black border-b border-[#F2F4F7]">
                <th className="px-8 py-5">Section</th>
                <th className="px-6 py-5">Type</th>
                <th className="px-8 py-5">Type d'Abonné</th>
                <th className="px-6 py-5 text-right">Nombre d'abonnés</th>
                <th className="px-6 py-5 text-right text-orange-500">Forfait</th>
                <th className="px-6 py-5 text-right text-violet-600">Sans Compteur</th>
                <th className="px-6 py-5 text-right text-orange-500">Taux Forfait</th>
                <th className="px-6 py-5 text-right">CA Eau</th>
                <th className="px-6 py-5 text-right">CA Prest.</th>
                <th className="px-6 py-5 text-right">Total CA</th>
                <th className="px-6 py-5 text-right text-teal-600">CA Recouvré</th>
                <th className="px-6 py-5 text-right text-emerald-600">Encaissement</th>
                <th className="px-6 py-5 text-right text-rose-600">Créance</th>
                <th className="px-8 py-5 text-right">Taux Recov.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {(typeSectionFilter === 'ALL' ? ['EAU', 'PRESTATIONS'] : [typeSectionFilter]).map(section => {
                const sectionRows = data.by_type.filter((t: any) => t.section === section);
                if (sectionRows.length === 0) return null;

                const isExpanded = expandedTypes.includes(section);
                const subTotalCaEau = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca_eau, 0);
                const subTotalCaPrest = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca_prestation, 0);
                const subTotalCa = sectionRows.reduce((acc: number, curr: any) => acc + curr.ca, 0);
                const subTotalCaRecouvre = sectionRows.reduce((acc: number, curr: any) => acc + (curr.ca_recouvre || 0), 0);
                const subTotalRecouvre = sectionRows.reduce((acc: number, curr: any) => acc + curr.recouvre, 0);
                const subTotalCreance = sectionRows.reduce((acc: number, curr: any) => acc + curr.creance, 0);
                const subTotalTaux = subTotalCa > 0 ? (subTotalCaRecouvre / subTotalCa * 100) : 0;
                const subTotalSubCount = sectionRows.reduce((acc: number, curr: any) => acc + (curr.sub_count || 0), 0);
                const subTotalForfaitCount = sectionRows.reduce((acc: number, curr: any) => acc + (curr.forfait_count || 0), 0);
                const subTotalScCount = sectionRows.reduce((acc: number, curr: any) => acc + (curr.sc_count || 0), 0);

                const isEau = section === 'EAU';

                return (
                  <Fragment key={section}>
                    {/* Group Header Toggle */}
                    <tr
                      onClick={() => toggleTypeSection(section)}
                      className={`${isEau ? 'bg-blue-50/10' : 'bg-teal-50/10'} cursor-pointer hover:bg-slate-50/50 transition-colors border-y border-[#F2F4F7]`}
                    >
                      <td colSpan={13} className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight size={16} className="text-[#98A2B3]" />
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border ${isEau ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                            {section}
                          </span>
                          <span className="text-[11px] font-bold text-[#667085]">
                            {isExpanded ? 'Masquer le détail' : `Afficher le détail (${sectionRows.length} types d'abonnés)`}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Detail Rows */}
                    {isExpanded && sectionRows.map((t: any) => (
                      <tr key={t.name} className={`${isEau ? 'hover:bg-blue-50/30' : 'hover:bg-teal-50/30'} transition-colors`}>
                        <td colSpan={3} className="px-8 py-4">
                          <span className="text-[12px] font-medium text-[#344054] pl-8">{t.name}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[13px] text-[#475467]">{t.sub_count || 0}</td>
                        <td className="px-6 py-4 text-right font-bold text-[13px] text-orange-500">{t.forfait_count || 0}</td>
                        <td className="px-6 py-4 text-right font-bold text-[13px] text-violet-600">{t.sc_count || 0}</td>
                        <td className="px-6 py-4 text-right font-bold text-[13px] text-orange-500">
                          {(t.sub_count > 0 ? (t.forfait_count / t.sub_count * 100) : 0).toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-blue-600 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-blue-50/60 hover:text-blue-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca_eau' })} title="Voir les abonnés concernés">{fmt(t.ca_eau)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-cyan-600 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-cyan-50/60 hover:text-cyan-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca_prestation' })} title="Voir les abonnés concernés">{fmt(t.ca_prestation)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-[13px] text-brand-600 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-brand-50/60 hover:text-brand-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca' })} title="Voir les abonnés concernés">{fmt(t.ca)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-teal-600 bg-teal-50/5 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-teal-50/60 hover:text-teal-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'ca_recouvre' })} title="Voir les abonnés concernés">{fmt(t.ca_recouvre || 0)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[13px] text-emerald-600 bg-emerald-50/5 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-emerald-50/60 hover:text-emerald-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'recouvre' })} title="Voir les abonnés concernés">{fmt(t.recouvre)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 bg-rose-50/10 whitespace-nowrap">
                          <span className="cursor-pointer hover:bg-rose-50/60 hover:text-rose-700 underline decoration-dotted underline-offset-2 transition-all rounded px-1 py-0.5" onClick={() => setDrillDown({ targetName: t.name, column: 'creance' })} title="Voir les abonnés concernés">{fmt(t.creance)}</span>
                        </td>
                        <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467] whitespace-nowrap">{t.taux.toFixed(2)}%</td>
                      </tr>
                    ))}
 
                    {/* Section Subtotal Row */}
                    <tr className={`${isEau ? 'bg-blue-50/40' : 'bg-teal-50/40'} border-y border-[#F2F4F7]/50`}>
                      <td colSpan={3} className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-4 rounded-full ${isEau ? 'bg-blue-400' : 'bg-teal-400'} opacity-50`}></div>
                          <span className="font-black text-[12px] text-[#101828] uppercase tracking-wider">Sous-total {section}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-[#475467] font-mono whitespace-nowrap">
                        {subTotalSubCount}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-orange-500 font-mono whitespace-nowrap">
                        {subTotalForfaitCount}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-violet-600 font-mono whitespace-nowrap">
                        {subTotalScCount}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-orange-500 font-mono whitespace-nowrap">
                        {(subTotalSubCount > 0 ? (subTotalForfaitCount / subTotalSubCount * 100) : 0).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-blue-600 font-mono whitespace-nowrap">{fmt(subTotalCaEau)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-cyan-600 font-mono whitespace-nowrap">{fmt(subTotalCaPrest)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-brand-600 font-mono whitespace-nowrap">{fmt(subTotalCa)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-teal-600 font-mono bg-white/5 whitespace-nowrap">{fmt(subTotalCaRecouvre)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-emerald-600 font-mono bg-white/5 whitespace-nowrap">{fmt(subTotalRecouvre)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 font-mono bg-white/5 whitespace-nowrap">{fmt(subTotalCreance)}</td>
                      <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467] font-mono whitespace-nowrap">{subTotalTaux.toFixed(2)}%</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            {typeSectionFilter === 'ALL' && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-900 text-white font-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                   <td colSpan={3} className="px-8 py-5 text-sm uppercase tracking-widest">TOTAL GÉNÉRAL</td>
                   <td className="px-6 py-5 text-right text-slate-300 font-mono whitespace-nowrap">{data.total_sub_count || 0}</td>
                   <td className="px-6 py-5 text-right text-orange-400 font-mono whitespace-nowrap">{data.total_forfait_count || 0}</td>
                   <td className="px-6 py-5 text-right text-violet-400 font-mono whitespace-nowrap">{data.total_sc_count || 0}</td>
                   <td className="px-6 py-5 text-right text-orange-400 font-mono whitespace-nowrap">
                     {(data.total_sub_count > 0 ? (data.total_forfait_count / data.total_sub_count * 100) : 0).toFixed(2)}%
                   </td>
                   <td className="px-6 py-5 text-right text-blue-400 font-mono whitespace-nowrap">{fmt(data.total_ca_eau)}</td>
                   <td className="px-6 py-5 text-right text-cyan-400 font-mono whitespace-nowrap">{fmt(data.total_ca_prestation)}</td>
                   <td className="px-6 py-5 text-right text-brand-400 font-mono whitespace-nowrap">{fmt(data.total_ca)}</td>
                   <td className="px-6 py-5 text-right text-teal-400 font-mono bg-white/5 whitespace-nowrap">{fmt(data.total_ca_recouvre || 0)}</td>
                   <td className="px-6 py-5 text-right text-emerald-400 font-mono bg-white/5 whitespace-nowrap">{fmt(data.total_recouvre)}</td>
                   <td className="px-6 py-5 text-right text-rose-400 bg-white/5 font-mono whitespace-nowrap">{fmt(data.total_creance)}</td>
                   <td className="px-8 py-5 text-right text-slate-300 font-mono whitespace-nowrap">{(data.total_ca > 0 ? (((data.total_ca_recouvre || 0) / data.total_ca) * 100) : 0).toFixed(2)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}


export function CreanceCommuneView({ data, onGoToCalculation, selectedSecteur = '', sectors = [], startDate = '', endDate = '' }: any) {
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const secteurLabel = selectedSecteur
    ? (sectors.find((s: { code: string; libelle: string }) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ') + " DA";

  const handlePrint = () => {
    if (!data || !data.by_commune || data.by_commune.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fen\u00eatres pop-up pour pouvoir imprimer.");
      return;
    }

    const fmtP = (n: number) =>
      new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n).replace(/[\u202F\u00A0]/g, '\u00a0') + ' DA';

    const formatDateStr = (d: string) => {
      if (!d) return '';
      const cleaned = d.trim();
      if (/^\d{8}$/.test(cleaned))
        return cleaned.substring(6, 8) + '-' + cleaned.substring(4, 6) + '-' + cleaned.substring(0, 4);
      const parts = cleaned.split(/[-/]/);
      if (parts.length === 3 && parts[0].length === 4)
        return parts[2] + '-' + parts[1] + '-' + parts[0];
      return d;
    };

    const titleStr = 'R\u00e9partition des Cr\u00e9ances par Commune';
    const subTitleStr = secteurLabel ? 'Centre\u00a0: ' + secteurLabel : "Toute l'unit\u00e9";
    const formattedStart = formatDateStr(startDate);
    const formattedEnd = formatDateStr(endDate);
    const dateStr = formattedStart && formattedEnd ? 'P\u00e9riode du ' + formattedStart + ' au ' + formattedEnd : '';
    const printDate = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let tableRowsHtml = '';
    data.by_commune.forEach((c: any) => {
      const taux = c.taux ?? 0;
      tableRowsHtml += `
        <tr class="commune-row">
          <td style="padding:5px 8px;font-weight:700;color:#101828;">${c.name}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:700;color:#475467;">${c.sub_count || 0}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:700;color:#e67e22;">${c.forfait_count || 0}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:700;color:#7c3aed;">${c.sc_count || 0}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:700;color:#e67e22;">${(c.sub_count > 0 ? (c.forfait_count / c.sub_count * 100) : 0).toFixed(2)}%</td>
          <td style="padding:5px 8px;text-align:right;color:#2563eb;">${fmtP(c.ca_eau)}</td>
          <td style="padding:5px 8px;text-align:right;color:#0891b2;">${fmtP(c.ca_prestation)}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:700;color:#0D83DE;">${fmtP(c.ca)}</td>
          <td style="padding:5px 8px;text-align:right;color:#0d9488;">${fmtP(c.ca_recouvre || 0)}</td>
          <td style="padding:5px 8px;text-align:right;color:#059669;">${fmtP(c.recouvre)}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:700;color:#e11d48;">${fmtP(c.creance)}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:700;color:#475467;">${taux.toFixed(2)}%</td>
        </tr>
        <tr class="sub-row">
          <td style="padding:3px 8px 3px 22px;font-size:8px;color:#2563eb;">\u21b3\u00a0Eau</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#475467;">${c.sub_count || 0}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#2563eb;">${fmtP(c.ca_eau)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#1e40af;">${fmtP(c.ca_eau)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#0d9488;">${fmtP(c.ca_recouvre_eau || 0)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#059669;">${fmtP(c.recouvre_eau || 0)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#e11d48;">${fmtP(c.creance_eau || 0)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#1d4ed8;">${(c.taux_eau ?? 0).toFixed(2)}%</td>
        </tr>
        <tr class="sub-row">
          <td style="padding:3px 8px 3px 22px;font-size:8px;color:#0891b2;">\u21b3\u00a0Prestations</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#94a3b8;">-</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#0891b2;">${fmtP(c.ca_prestation)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#164e63;">${fmtP(c.ca_prestation)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#0d9488;">${fmtP(c.ca_recouvre_prestation || 0)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#059669;">${fmtP(c.recouvre_prestation || 0)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#e11d48;">${fmtP(c.creance_prestation || 0)}</td>
          <td style="padding:3px 8px;text-align:right;font-size:8px;color:#0e7490;">${(c.taux_prestation ?? 0).toFixed(2)}%</td>
        </tr>
      `;
    });

    const totalTaux = data.total_ca > 0 ? (((data.total_ca_recouvre || 0) / data.total_ca) * 100) : 0;
    tableRowsHtml += `
      <tr style="background:#f1f5f9;color:#101828;font-weight:700;font-size:9px;border-top:1px solid #94a3b8;border-bottom:1px solid #94a3b8;">
        <td style="padding:8px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:none;color:#101828;">Total Général</td>
        <td style="padding:8px;text-align:right;color:#475467;border-bottom:none;">${data.total_sub_count || 0}</td>
        <td style="padding:8px;text-align:right;color:#c2410c;border-bottom:none;">${data.total_forfait_count || 0}</td>
        <td style="padding:8px;text-align:right;color:#6d28d9;border-bottom:none;">${data.total_sc_count || 0}</td>
        <td style="padding:8px;text-align:right;color:#c2410c;border-bottom:none;">${(data.total_sub_count > 0 ? (data.total_forfait_count / data.total_sub_count * 100) : 0).toFixed(2)}%</td>
        <td style="padding:8px;text-align:right;color:#1d4ed8;border-bottom:none;">${fmtP(data.total_ca_eau)}</td>
        <td style="padding:8px;text-align:right;color:#0e7490;border-bottom:none;">${fmtP(data.total_ca_prestation)}</td>
        <td style="padding:8px;text-align:right;color:#0d83de;border-bottom:none;">${fmtP(data.total_ca)}</td>
        <td style="padding:8px;text-align:right;color:#0f766e;border-bottom:none;">${fmtP(data.total_ca_recouvre || 0)}</td>
        <td style="padding:8px;text-align:right;color:#065f46;border-bottom:none;">${fmtP(data.total_recouvre)}</td>
        <td style="padding:8px;text-align:right;color:#b91c1c;border-bottom:none;">${fmtP(data.total_creance)}</td>
        <td style="padding:8px;text-align:right;color:#475467;border-bottom:none;">${totalTaux.toFixed(2)}%</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page { size: landscape; margin: 8mm 10mm; }
            * { box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #101828; margin: 0; font-size: 8.5px; line-height: 1.35;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .header {
              display: flex; justify-content: space-between; align-items: center;
              border-bottom: 2px solid #F2F4F7; padding-bottom: 8px; margin-bottom: 10px;
            }
            .logo-text { font-size: 13px; font-weight: 900; color: #0D83DE; letter-spacing: -0.5px; margin: 0; }
            .company-name { font-size: 8px; font-weight: 700; color: #667085; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px; }
            .title-section { text-align: right; }
            .title { font-size: 15px; font-weight: 900; color: #101828; margin: 0; }
            .subtitle { font-size: 8.5px; color: #667085; margin: 2px 0 0 0; font-weight: 500; }
            .meta-grid {
              display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
              margin-bottom: 10px; background: #F9FAFB; border: 1px solid #E4E7EC;
              border-radius: 6px; padding: 6px 10px;
            }
            .meta-item { display: flex; flex-direction: column; }
            .meta-label { font-size: 7px; text-transform: uppercase; color: #667085; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 1px; }
            .meta-value { font-size: 8.5px; font-weight: 700; color: #101828; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th {
              background: #F9FAFB; color: #475467; font-size: 7px; font-weight: 700;
              text-transform: uppercase; letter-spacing: 0.4px; padding: 5px 8px;
              border-bottom: 1px solid #E4E7EC; white-space: nowrap;
            }
            td { border-bottom: 1px solid #F2F4F7; padding: 4px 8px; font-size: 8.5px; }
            .commune-row td { border-top: 1px solid #E4E7EC; }
            .sub-row { background: #fafafa; }
            .sub-row td { border-bottom: none; }
            .footer-info {
              display: flex; justify-content: space-between; align-items: center;
              color: #667085; font-size: 7.5px; border-top: 1px solid #F2F4F7;
              padding-top: 8px; margin-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo-text">EPEOR ANALYTICS</div>
              <div class="company-name">Alg\u00e9rienne des Eaux</div>
            </div>
            <div class="title-section">
              <div class="title">${titleStr}</div>
              <div class="subtitle">Analyses Financi\u00e8res</div>
            </div>
          </div>
          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">P\u00e9rim\u00e8tre</span><span class="meta-value">${subTitleStr}</span></div>
            <div class="meta-item"><span class="meta-label">P\u00e9riode</span><span class="meta-value">${dateStr || '\u2014'}</span></div>
            <div class="meta-item"><span class="meta-label">Date d'\u00e9dition</span><span class="meta-value">${printDate}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Commune</th>
                <th style="text-align:right;color:#475467;">Nombre d'abonnés</th>
                <th style="text-align:right;color:#e67e22;">Forfait</th>
                <th style="text-align:right;color:#7c3aed;">Sans Compteur</th>
                <th style="text-align:right;color:#e67e22;">Taux Forfait</th>
                <th style="text-align:right;color:#2563eb;">CA Eau</th>
                <th style="text-align:right;color:#0891b2;">CA Prest.</th>
                <th style="text-align:right;">Total CA</th>
                <th style="text-align:right;color:#0d9488;">CA Recouv.</th>
                <th style="text-align:right;color:#059669;">Encaissement</th>
                <th style="text-align:right;color:#e11d48;">Cr\u00e9ance</th>
                <th style="text-align:right;">Taux Recov. (%)</th>
              </tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
          <div class="footer-info">
            <span>EPEOR Analytics \u2014 Analyses Financi\u00e8res / R\u00e9partition par Commune</span>
            <span>${printDate}</span>
          </div>
          <script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!data || !data.by_commune) {
    return (
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-12 text-center max-w-2xl mx-auto my-12 animate-in fade-in duration-300">
        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-100 shadow-inner">
          <MapPin className="text-brand-600" size={36} />
        </div>
        <h3 className="text-2xl font-black text-[#101828] mb-3">Aucune donnée disponible</h3>
        <p className="text-sm text-[#667085] leading-relaxed max-w-md mx-auto mb-8 font-medium">
          Les calculs financiers n'ont pas encore été lancés pour la période actuelle. Veuillez vous rendre sur la Synthèse Globale pour charger les données.
        </p>
        <button
          onClick={onGoToCalculation}
          className="inline-flex items-center justify-center px-6 py-3.5 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 active:scale-95 transition-all shadow-lg shadow-brand-600/25 border border-brand-500/10"
        >
          Aller à la Synthèse Globale
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-[#101828]">Répartition par Commune</h3>
          <p className="text-sm text-[#667085] mt-1 font-medium">
            {secteurLabel
              ? `Données du centre ${secteurLabel} (même périmètre que la synthèse)`
              : "Détails du Chiffre d'Affaire Eau et Prestation par commune — toute l'unité"}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsTableCollapsed(!isTableCollapsed)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer border ${
              isTableCollapsed 
                ? 'bg-brand-600 text-white border-brand-700 hover:bg-brand-700' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isTableCollapsed ? 'Déplier le Tableau' : 'Plier le Tableau'}
          </button>

          <div className="w-[1px] h-6 bg-[#E4E7EC] mx-1 hidden sm:block"></div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0D83DE] hover:bg-[#0a6ab8] active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-600/10 border border-blue-500/10"
            title="Imprimer la répartition par commune"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] overflow-hidden">
        <div className={`transition-all duration-300 ease-in-out ${isTableCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[5000px] opacity-100'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] text-[#475467] text-[10px] uppercase tracking-wider font-black border-b border-[#F2F4F7]">
                  <th className="px-8 py-5 text-center">Commune</th>
                  <th className="px-6 py-5 text-right">Nombre d'abonnés</th>
                  <th className="px-6 py-5 text-right text-orange-500">Forfait</th>
                  <th className="px-6 py-5 text-right text-violet-600">Sans Compteur</th>
                  <th className="px-6 py-5 text-right text-orange-500">Taux Forfait</th>
                  <th className="px-6 py-5 text-right">CA Eau</th>
                  <th className="px-6 py-5 text-right">CA Prest.</th>
                  <th className="px-6 py-5 text-right">Total CA</th>
                  <th className="px-6 py-5 text-right text-teal-600">CA Recouvré</th>
                  <th className="px-6 py-5 text-right text-emerald-600">Encaissement</th>
                  <th className="px-6 py-5 text-right text-rose-600">Créance</th>
                  <th className="px-8 py-5 text-right">Taux Recov. (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                 {data.by_commune.map((c: any, i: number) => {
                  return (
                    <tr key={c.id || i} className="hover:bg-[#F9FAFB] transition-colors group">
                      <td className="px-8 py-4 font-black text-sm text-[#101828] text-center">
                        {c.name}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-[13px] text-[#475467]">{c.sub_count || 0}</td>
                      <td className="px-6 py-4 text-right font-bold text-[13px] text-orange-500">{c.forfait_count || 0}</td>
                      <td className="px-6 py-4 text-right font-bold text-[13px] text-violet-600">{c.sc_count || 0}</td>
                      <td className="px-6 py-4 text-right font-bold text-[13px] text-orange-500">
                        {(c.sub_count > 0 ? (c.forfait_count / c.sub_count * 100) : 0).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-blue-600">{fmt(c.ca_eau)}</td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-cyan-600">{fmt(c.ca_prestation)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-brand-600">{fmt(c.ca)}</td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-teal-600 bg-teal-50/10">{fmt(c.ca_recouvre || 0)}</td>
                      <td className="px-6 py-4 text-right font-medium text-[13px] text-emerald-600 bg-emerald-50/10">{fmt(c.recouvre)}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 bg-rose-50/30">{fmt(c.creance)}</td>
                      <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467]">{c.taux.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-900 text-white font-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                  <td className="px-8 py-5 text-sm uppercase tracking-widest">TOTAL GÉNÉRAL</td>
                  <td className="px-6 py-5 text-right text-slate-300 font-mono">{data.total_sub_count || 0}</td>
                  <td className="px-6 py-5 text-right text-orange-400 font-mono">{data.total_forfait_count || 0}</td>
                  <td className="px-6 py-5 text-right text-violet-400 font-mono">{data.total_sc_count || 0}</td>
                  <td className="px-6 py-5 text-right text-orange-400 font-mono">
                    {(data.total_sub_count > 0 ? (data.total_forfait_count / data.total_sub_count * 100) : 0).toFixed(2)}%
                  </td>
                  <td className="px-6 py-5 text-right text-blue-400 font-mono">{fmt(data.total_ca_eau)}</td>
                  <td className="px-6 py-5 text-right text-cyan-400 font-mono">{fmt(data.total_ca_prestation)}</td>
                  <td className="px-6 py-5 text-right text-brand-400 font-mono">{fmt(data.total_ca)}</td>
                  <td className="px-6 py-5 text-right text-teal-400 font-mono bg-white/5">{fmt(data.total_ca_recouvre || 0)}</td>
                  <td className="px-6 py-5 text-right text-emerald-400 font-mono bg-white/5">{fmt(data.total_recouvre)}</td>
                  <td className="px-6 py-5 text-right text-rose-400 bg-white/5 font-mono">{fmt(data.total_creance)}</td>
                  <td className="px-8 py-5 text-right text-slate-300 font-mono">{(data.total_ca > 0 ? (((data.total_ca_recouvre || 0) / data.total_ca) * 100) : 0).toFixed(2)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}




export function BilanActiviteView({ data, startDate = '', endDate = '', selectedSecteur = '', sectors = [] }: any) {
  const secteurLabel = selectedSecteur
    ? (sectors.find((s: { code: string; libelle: string }) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
    : 'Toute l\'unité';

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0]/g, ' ');

  const communeRows = Array.isArray(data?.by_commune) ? data.by_commune : [];
  const secteurFieldNames = ['secteur', 'centre', 'center', 'SECTEUR', 'CENTRE', 'center_code'];
  const hasSecteurInfo = communeRows.some((row: any) =>
    secteurFieldNames.some((field) => String(row[field] ?? '').trim() !== '')
  );
  const filteredCommunes = selectedSecteur && hasSecteurInfo
    ? communeRows.filter((row: any) => secteurFieldNames.some((field) => String(row[field] ?? '').trim() === selectedSecteur))
    : communeRows;

  const processTypeRows = (rows: any[]) => {
    const grouped: Record<string, any> = {};
    const result: any[] = [];
    const autresTravauxCodes = new Set(["2", "4", "6", "7", "X", "B", "G", "D", "C", "A"]);

    for (const row of rows) {
      const code = String(row.type_code || row.type || "").trim().toUpperCase();
      if (autresTravauxCodes.has(code)) {
        const groupKey = "AUTRES_TRAVAUX";
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            ...row,
            type_code: "2/4/6/7/X/B/G/D/C/A",
            name: "AUTRES TRAVAUX",
            ca_eau: 0,
            ca_prestation: 0,
            ca: 0,
            ca_recouvre: 0,
            recouvre: 0,
            creance: 0,
            creance_resilie: 0,
            children: []
          };
        }
        grouped[groupKey].ca_eau += Number(row.ca_eau || 0);
        grouped[groupKey].ca_prestation += Number(row.ca_prestation || 0);
        grouped[groupKey].ca += Number(row.ca || row.ca_total || ((row.ca_eau || 0) + (row.ca_prestation || 0)) || 0);
        grouped[groupKey].ca_recouvre += Number(row.ca_recouvre || 0);
        grouped[groupKey].recouvre += Number(row.recouvre || row.encaissement || row.encaisse || row.encaissement_total || 0);
        grouped[groupKey].creance += Number(row.creance || 0);
        grouped[groupKey].creance_resilie += Number(row.creance_resilie || 0);
        grouped[groupKey].children.push({ ...row });
      } else {
        result.push({ ...row });
      }
    }

    if (grouped["AUTRES_TRAVAUX"]) {
      const g = grouped["AUTRES_TRAVAUX"];
      const totCa = g.ca;
      g.taux = totCa > 0 ? (g.ca_recouvre / totCa) * 100 : 0;
      g.children.sort((x: any, y: any) => {
        const ordX = Number(x.ordre || 0);
        const ordY = Number(y.ordre || 0);
        if (ordX !== ordY) return ordX - ordY;
        const nameX = String(x.name || "");
        const nameY = String(y.name || "");
        return nameX.localeCompare(nameY);
      });
      result.push(g);
    }

    result.sort((x: any, y: any) => {
      const secX = x.section === 'EAU' ? 0 : 1;
      const secY = y.section === 'EAU' ? 0 : 1;
      if (secX !== secY) return secX - secY;
      const ordX = Number(x.ordre || 0);
      const ordY = Number(y.ordre || 0);
      if (ordX !== ordY) return ordX - ordY;
      const nameX = String(x.name || "");
      const nameY = String(y.name || "");
      return nameX.localeCompare(nameY);
    });

    return result;
  };

  const [expandedGroupedTypes, setExpandedGroupedTypes] = useState<string[]>([]);
  const toggleGroupedType = (key: string) => {
    setExpandedGroupedTypes((prev) =>
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]
    );
  };



  // Use global totals from data object, same as Synthèse Globale
  const totals = {
    ca_eau: data?.total_ca_eau || 0,
    ca_prestation: data?.total_ca_prestation || 0,
    ca: data?.total_ca || 0,
    encaissement: data?.total_recouvre || 0,
    recouvre: data?.total_ca_recouvre || 0,
    creance: data?.total_creance || 0,
    creance_resilie: data?.total_creance_resilie || 0,
  };

  const handlePrint = () => {
    if (!filteredCommunes.length) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les fen\u00eatres pop-up pour pouvoir imprimer.');
      return;
    }

    const fmtP = (n: number) =>
      new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(n).replace(/[\u202F\u00A0]/g, '\u00a0');

    const escapeHtml = (s: string) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const formatDateStr = (d: string) => {
      if (!d) return '';
      const cleaned = d.trim();
      if (/^\d{8}$/.test(cleaned))
        return cleaned.substring(6, 8) + '-' + cleaned.substring(4, 6) + '-' + cleaned.substring(0, 4);
      const parts = cleaned.split(/[-/]/);
      if (parts.length === 3 && parts[0].length === 4)
        return parts[2] + '-' + parts[1] + '-' + parts[0];
      return d;
    };

    const buildDataCells = (row: any, opts: { bg?: string; fontSize?: string } = {}) => {
      const totCa = Number(row.ca || row.ca_total || row.CA || ((row.ca_eau || 0) + (row.ca_prestation || 0)) || 0);
      const totCaRecouvre = Number(row.ca_recouvre || 0);
      const encaisse = Number(row.recouvre || row.encaissement || row.encaisse || row.encaissement_total || 0);
      const creance = Number(row.creance || row.CREANCE || 0);
      const taux = totCa > 0 ? (totCaRecouvre / totCa) * 100 : 0;
      const subCount = row.sub_count || 0;
      const forfaitPct = subCount > 0 ? ((row.forfait_count || 0) / subCount * 100).toFixed(2) : '0.00';
      const fs = opts.fontSize || '7px';
      const bg = opts.bg || '';
      const base = `padding:2px 4px;text-align:right;font-size:${fs};white-space:nowrap;${bg}`;
      return `
        <td style="${base}font-weight:700;color:#475467;">${subCount}</td>
        <td style="${base}font-weight:700;color:#e67e22;">${row.forfait_count || 0}</td>
        <td style="${base}font-weight:700;color:#7c3aed;">${row.sc_count || 0}</td>
        <td style="${base}font-weight:700;color:#e67e22;">${forfaitPct}%</td>
        <td style="${base}font-weight:700;color:#ef4444;">${row.resigned_count || 0}</td>
        <td style="${base}font-weight:700;color:#b91c1c;">${fmtP(Number(row.creance_resilie || 0))}</td>
        <td style="${base}color:#2563eb;">${fmtP(Number(row.ca_eau || 0))}</td>
        <td style="${base}color:#0891b2;">${fmtP(Number(row.ca_prestation || 0))}</td>
        <td style="${base}font-weight:700;color:#0D83DE;">${fmtP(totCa)}</td>
        <td style="${base}color:#0d9488;">${fmtP(totCaRecouvre)}</td>
        <td style="${base}color:#059669;">${fmtP(encaisse)}</td>
        <td style="${base}font-weight:700;color:#e11d48;">${fmtP(creance)}</td>
        <td style="${base}font-weight:700;color:#475467;">${taux.toFixed(2)}%</td>
      `;
    };

    const buildTypeCell = (type: any, level: 1 | 2 = 1) => {
      const name = escapeHtml(type.name || type.label || type.type || "Type d'Abonn\u00e9");
      const code = type.type_code
        ? `<span style="font-family:monospace;font-size:5.5px;font-weight:700;color:#475467;background:#f1f5f9;padding:1px 3px;border-radius:2px;margin-right:2px;border:1px solid #e2e8f0;">${escapeHtml(type.type_code)}</span>`
        : '';
      const prefix = level === 2 ? '\u21b3 \u21b3' : '\u21b3';
      const pl = level === 2 ? 12 : 4;
      return `<td style="padding:2px 4px;font-size:6.5px;color:#475467;white-space:nowrap;padding-left:${pl}px;">${prefix} ${code}${name}</td>`;
    };

    let tableRowsHtml = '';
    filteredCommunes.forEach((c: any, i: number) => {
      const communeId = c.id || String(i);
      const communeName = escapeHtml(c.name || c.commune || c.NOM || '\u2014');
      const rawTypeRows = Array.isArray(c.by_type) ? c.by_type : Array.isArray(c.types) ? c.types : [];
      const typeRows = processTypeRows(rawTypeRows);

      const rowSpan = typeRows.length === 0
        ? 1
        : 1 + typeRows.reduce((acc: number, type: any) => {
            const isGrouped = type.type_code === '2/4/6/7/X/B/G/D/C/A';
            const isExpanded = isGrouped && expandedGroupedTypes.includes(`${communeId}-AUTRES_TRAVAUX`);
            const childCount = isExpanded && Array.isArray(type.children) ? type.children.length : 0;
            return acc + 1 + childCount;
          }, 0);

      const communeTd = (rs: number) =>
        `<td rowspan="${rs}" style="padding:4px 5px;font-weight:700;color:#101828;text-align:center;vertical-align:middle;border-right:1px solid #E4E7EC;background:#fff;font-size:7.5px;white-space:nowrap;">${communeName}</td>`;

      if (typeRows.length === 0) {
        tableRowsHtml += `<tr class="commune-row">${communeTd(1)}<td style="padding:2px 4px;font-size:7px;font-weight:700;color:#0369a1;background:#e0f2fe;">Total</td>${buildDataCells(c, { bg: 'background:#f0f9ff;', fontSize: '7px' })}</tr>`;
        return;
      }

      const isFirstGrouped = typeRows[0].type_code === '2/4/6/7/X/B/G/D/C/A';
      const isFirstExpanded = isFirstGrouped && expandedGroupedTypes.includes(`${communeId}-AUTRES_TRAVAUX`);

      tableRowsHtml += `<tr class="commune-row">${communeTd(rowSpan)}${buildTypeCell(typeRows[0])}${buildDataCells(typeRows[0])}</tr>`;
      if (isFirstExpanded && Array.isArray(typeRows[0].children)) {
        typeRows[0].children.forEach((child: any) => {
          tableRowsHtml += `<tr class="sub-row">${buildTypeCell(child, 2)}${buildDataCells(child, { fontSize: '6.5px' })}</tr>`;
        });
      }
      typeRows.slice(1).forEach((type: any) => {
        const isGrouped = type.type_code === '2/4/6/7/X/B/G/D/C/A';
        const isExpanded = isGrouped && expandedGroupedTypes.includes(`${communeId}-AUTRES_TRAVAUX`);

        tableRowsHtml += `<tr class="type-row">${buildTypeCell(type)}${buildDataCells(type)}</tr>`;
        if (isExpanded && Array.isArray(type.children)) {
          type.children.forEach((child: any) => {
            tableRowsHtml += `<tr class="sub-row">${buildTypeCell(child, 2)}${buildDataCells(child, { fontSize: '6.5px' })}</tr>`;
          });
        }
      });
      tableRowsHtml += `<tr class="total-row"><td style="padding:2px 4px;font-size:7px;font-weight:700;color:#0369a1;background:#e0f2fe;text-transform:uppercase;">Total</td>${buildDataCells(c, { bg: 'background:#e0f2fe;', fontSize: '7px' })}</tr>`;
    });

    const totalTaux = totals.ca > 0 ? ((totals.recouvre / totals.ca) * 100) : 0;
    const totalForfaitPct = (data?.total_sub_count > 0 ? (data.total_forfait_count / data.total_sub_count * 100) : 0).toFixed(2);
    tableRowsHtml += `
      <tr style="background:#f1f5f9;color:#101828;font-weight:700;font-size:7px;border-top:1px solid #94a3b8;border-bottom:1px solid #94a3b8;">
        <td colspan="2" style="padding:6px 5px;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;color:#101828;">Total G\u00e9n\u00e9ral</td>
        <td style="padding:6px 4px;text-align:right;color:#475467;">${data?.total_sub_count || 0}</td>
        <td style="padding:6px 4px;text-align:right;color:#c2410c;">${data?.total_forfait_count || 0}</td>
        <td style="padding:6px 4px;text-align:right;color:#6d28d9;">${data?.total_sc_count || 0}</td>
        <td style="padding:6px 4px;text-align:right;color:#c2410c;">${totalForfaitPct}%</td>
        <td style="padding:6px 4px;text-align:right;color:#b91c1c;">${data?.total_resigned_count || 0}</td>
        <td style="padding:6px 4px;text-align:right;color:#b91c1c;">${fmtP(totals.creance_resilie)}</td>
        <td style="padding:6px 4px;text-align:right;color:#1d4ed8;">${fmtP(totals.ca_eau)}</td>
        <td style="padding:6px 4px;text-align:right;color:#0e7490;">${fmtP(totals.ca_prestation)}</td>
        <td style="padding:6px 4px;text-align:right;color:#0d83de;">${fmtP(totals.ca)}</td>
        <td style="padding:6px 4px;text-align:right;color:#0f766e;">${fmtP(totals.recouvre)}</td>
        <td style="padding:6px 4px;text-align:right;color:#065f46;">${fmtP(totals.encaissement)}</td>
        <td style="padding:6px 4px;text-align:right;color:#9f1239;">${fmtP(totals.creance)}</td>
        <td style="padding:6px 4px;text-align:right;color:#475467;">${totalTaux.toFixed(2)}%</td>
      </tr>
    `;

    const titleStr = "Bilan d'activit\u00e9 \u2014 Communes associ\u00e9es";
    const subTitleStr = selectedSecteur ? 'Centre\u00a0: ' + secteurLabel : "Toute l'unit\u00e9";
    const formattedStart = formatDateStr(startDate);
    const formattedEnd = formatDateStr(endDate);
    const dateStr = formattedStart && formattedEnd ? 'P\u00e9riode du ' + formattedStart + ' au ' + formattedEnd : '';
    const printDate = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            @page { size: A4 landscape; margin: 8mm 10mm; }
            * { box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #101828; margin: 0; font-size: 7px; line-height: 1.3;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .header {
              display: flex; justify-content: space-between; align-items: center;
              border-bottom: 2px solid #F2F4F7; padding-bottom: 6px; margin-bottom: 8px;
            }
            .logo-section { display: flex; align-items: center; gap: 8px; }
            .logo-text { font-size: 12px; font-weight: 900; color: #0D83DE; letter-spacing: -0.5px; margin: 0; }
            .company-name { font-size: 7px; font-weight: 700; color: #667085; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px; }
            .title-section { text-align: right; }
            .title { font-size: 13px; font-weight: 900; color: #101828; margin: 0; }
            .subtitle { font-size: 7.5px; color: #667085; margin: 2px 0 0 0; font-weight: 500; }
            .meta-grid {
              display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
              margin-bottom: 8px; background: #F9FAFB; border: 1px solid #E4E7EC;
              border-radius: 6px; padding: 5px 8px;
            }
            .meta-item { display: flex; flex-direction: column; }
            .meta-label { font-size: 6px; text-transform: uppercase; color: #667085; font-weight: 700; letter-spacing: 0.4px; margin-bottom: 1px; }
            .meta-value { font-size: 7.5px; font-weight: 700; color: #101828; }
            table { width: 100%; border-collapse: collapse; text-align: left; table-layout: auto; }
            th {
              background: #F9FAFB; color: #475467; font-size: 5.5px; font-weight: 700;
              text-transform: uppercase; letter-spacing: 0.3px; padding: 4px 4px;
              border-bottom: 1px solid #E4E7EC; white-space: nowrap;
            }
            td { border-bottom: 1px solid #F2F4F7; }
            .commune-row td { border-top: 1px solid #E4E7EC; }
            .sub-row { background: #fafafa; }
            .sub-row td { border-bottom: none; }
            .total-row td { background: #e0f2fe; border-top: 1px solid #7dd3fc; }
            .footer-info {
              display: flex; justify-content: space-between; align-items: center;
              color: #667085; font-size: 6.5px; border-top: 1px solid #F2F4F7;
              padding-top: 6px; margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="${window.location.origin}/ade.png" alt="ADE Logo" style="height: 25px; width: auto;" />
              <div style="display: flex; flex-direction: column;">
                <div class="logo-text">EPEOR ANALYTICS</div>
                <div class="company-name">Alg\u00e9rienne des Eaux</div>
              </div>
            </div>
            <div class="title-section">
              <div class="title">${titleStr}</div>
              <div class="subtitle">Analyses Financi\u00e8res</div>
            </div>
          </div>
          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">P\u00e9rim\u00e8tre</span><span class="meta-value">${escapeHtml(subTitleStr)}</span></div>
            <div class="meta-item"><span class="meta-label">P\u00e9riode</span><span class="meta-value">${dateStr || '\u2014'}</span></div>
            <div class="meta-item"><span class="meta-label">Date d'\u00e9dition</span><span class="meta-value">${printDate}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Commune</th>
                <th>Type d'abonn\u00e9</th>
                <th style="text-align:right;">Nb. abonn\u00e9s</th>
                <th style="text-align:right;color:#e67e22;">Forfait</th>
                <th style="text-align:right;color:#7c3aed;">Sans Cpt.</th>
                <th style="text-align:right;color:#e67e22;">Taux Forf.</th>
                <th style="text-align:right;color:#ef4444;">R\u00e9sili\u00e9s</th>
                <th style="text-align:right;color:#b91c1c;">Cr\u00e9. R\u00e9s.</th>
                <th style="text-align:right;color:#2563eb;">CA Eau</th>
                <th style="text-align:right;color:#0891b2;">CA Prest.</th>
                <th style="text-align:right;">Total CA</th>
                <th style="text-align:right;color:#0d9488;">CA Recouv.</th>
                <th style="text-align:right;color:#059669;">Encaissement</th>
                <th style="text-align:right;color:#e11d48;">Cr\u00e9ance</th>
                <th style="text-align:right;">Taux Recov.</th>
              </tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
          <div class="footer-info">
            <span>EPEOR Analytics \u2014 Bilan d'activit\u00e9 / Communes associ\u00e9es \u2014 ${filteredCommunes.length} commune${filteredCommunes.length > 1 ? 's' : ''}</span>
            <span>${printDate}</span>
          </div>
          <script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const formatPDFInt = (n: number) => {
    return new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 })
      .format(n)
      .replace(/[\u202F\u00A0\s]/g, ' ');
  };

  const formatPDFDec = (n: number) => {
    return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      .replace(/[\u202F\u00A0\s]/g, ' ');
  };

  const buildPdfDataCells = (row: any, isTotal: boolean = false, isChild: boolean = false) => {
    const totCa = Number(row.ca || row.ca_total || row.CA || ((row.ca_eau || 0) + (row.ca_prestation || 0)) || 0);
    const totCaRecouvre = Number(row.ca_recouvre || 0);
    const encaisse = Number(row.recouvre || row.encaissement || row.encaisse || row.encaissement_total || 0);
    const creance = Number(row.creance || row.CREANCE || 0);
    const taux = totCa > 0 ? (totCaRecouvre / totCa) * 100 : 0;
    const subCount = row.sub_count || 0;
    const forfaitPct = subCount > 0 ? ((row.forfait_count || 0) / subCount * 100).toFixed(2) : '0.00';

    const bgStyles = isTotal 
      ? { fillColor: [224, 242, 254] as [number, number, number] } // light blue #e0f2fe
      : isChild 
        ? { fillColor: [250, 250, 250] as [number, number, number] } // very light gray
        : {};

    return [
      { content: formatPDFInt(subCount), styles: { halign: 'right', fontStyle: 'bold', textColor: [71, 84, 103], ...bgStyles } },
      { content: formatPDFInt(row.forfait_count || 0), styles: { halign: 'right', fontStyle: 'bold', textColor: [194, 65, 12], ...bgStyles } },
      { content: formatPDFInt(row.sc_count || 0), styles: { halign: 'right', fontStyle: 'bold', textColor: [109, 40, 217], ...bgStyles } },
      { content: `${forfaitPct}%`, styles: { halign: 'right', fontStyle: 'bold', textColor: [194, 65, 12], ...bgStyles } },
      { content: formatPDFInt(row.resigned_count || 0), styles: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28], ...bgStyles } },
      { content: formatPDFDec(Number(row.creance_resilie || 0)), styles: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28], ...bgStyles } },
      { content: formatPDFDec(Number(row.ca_eau || 0)), styles: { halign: 'right', textColor: [29, 78, 216], ...bgStyles } },
      { content: formatPDFDec(Number(row.ca_prestation || 0)), styles: { halign: 'right', textColor: [14, 116, 144], ...bgStyles } },
      { content: formatPDFDec(totCa), styles: { halign: 'right', fontStyle: 'bold', textColor: [13, 131, 222], ...bgStyles } },
      { content: formatPDFDec(totCaRecouvre), styles: { halign: 'right', textColor: [15, 118, 110], ...bgStyles } },
      { content: formatPDFDec(encaisse), styles: { halign: 'right', textColor: [6, 95, 70], ...bgStyles } },
      { content: formatPDFDec(creance), styles: { halign: 'right', fontStyle: 'bold', textColor: [159, 18, 57], ...bgStyles } },
      { content: `${taux.toFixed(2)}%`, styles: { halign: 'right', fontStyle: 'bold', textColor: [71, 84, 103], ...bgStyles } }
    ];
  };

  const exportToPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF("l", "pt", "a4");
      const pageWidth = doc.internal.pageSize.width;
      
      // Title
      doc.setFontSize(12);
      doc.setTextColor(16, 24, 40);
      doc.text("Bilan d'activité — Communes associées", pageWidth / 2, 25, { align: "center" });
      
      doc.setFontSize(8.5);
      doc.setTextColor(102, 112, 133);
      const subTitleStr = selectedSecteur
        ? "Centre : " + (sectors.find((s: any) => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
        : "Toute l'unité";
      
      const formatPeriodLabelText = (start: string, end: string) => {
        if (!start || !end) return '';
        return `Période du ${start} au ${end}`;
      };
      const periodStr = formatPeriodLabelText(startDate, endDate);
      const headerSub = periodStr ? `${subTitleStr} | ${periodStr}` : subTitleStr;
      doc.text(headerSub, pageWidth / 2, 40, { align: "center" });

      const bodyData: any[] = [];

      filteredCommunes.forEach((c: any, cIdx: number) => {
        const communeId = c.id || String(cIdx);
        const communeName = c.name || c.commune || c.NOM || '—';
        const rawTypeRows = Array.isArray(c.by_type) ? c.by_type : Array.isArray(c.types) ? c.types : [];
        const typeRows = processTypeRows(rawTypeRows);

        if (typeRows.length === 0) {
          bodyData.push([
            { content: communeName, styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } },
            { content: "Total", styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
            ...buildPdfDataCells(c, true)
          ]);
          return;
        }

        let totalRows = 0;
        typeRows.forEach((type: any) => {
          const isGrouped = type.type_code === '2/4/6/7/X/B/G/D/C/A';
          const isExpanded = isGrouped && expandedGroupedTypes.includes(`${communeId}-AUTRES_TRAVAUX`);
          const childCount = isExpanded && Array.isArray(type.children) ? type.children.length : 0;
          totalRows += 1 + childCount;
        });
        totalRows += 1; // for total row

        const firstType = typeRows[0];
        const isFirstGrouped = firstType.type_code === '2/4/6/7/X/B/G/D/C/A';
        const isFirstExpanded = isFirstGrouped && expandedGroupedTypes.includes(`${communeId}-AUTRES_TRAVAUX`);

        const firstRowCells = [
          { content: communeName, rowSpan: totalRows, styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } },
          { content: (firstType.type_code ? `[${firstType.type_code}] ` : '') + (firstType.name || "Type d'Abonné"), styles: { fontStyle: isFirstGrouped ? 'bold' : 'normal' } },
          ...buildPdfDataCells(firstType)
        ];
        bodyData.push(firstRowCells);

        if (isFirstExpanded && Array.isArray(firstType.children)) {
          firstType.children.forEach((child: any) => {
            bodyData.push([
              { content: `   ↳ [${child.type_code}] ${child.name || "Type d'Abonné"}`, styles: { textColor: [102, 112, 133], fontSize: 7.5 } },
              ...buildPdfDataCells(child, false, true)
            ]);
          });
        }

        typeRows.slice(1).forEach((type: any) => {
          const isGrouped = type.type_code === '2/4/6/7/X/B/G/D/C/A';
          const isExpanded = isGrouped && expandedGroupedTypes.includes(`${communeId}-AUTRES_TRAVAUX`);

          bodyData.push([
            { content: (type.type_code ? `[${type.type_code}] ` : '') + (type.name || "Type d'Abonné"), styles: { fontStyle: isGrouped ? 'bold' : 'normal' } },
            ...buildPdfDataCells(type)
          ]);

          if (isExpanded && Array.isArray(type.children)) {
            type.children.forEach((child: any) => {
              bodyData.push([
                { content: `   ↳ [${child.type_code}] ${child.name || "Type d'Abonné"}`, styles: { textColor: [102, 112, 133], fontSize: 7.5 } },
                ...buildPdfDataCells(child, false, true)
              ]);
            });
          }
        });

        bodyData.push([
          { content: "TOTAL", styles: { fontStyle: 'bold', fillColor: [224, 242, 254] } },
          ...buildPdfDataCells(c, true)
        ]);
      });

      const totalTaux = totals.ca > 0 ? ((totals.recouvre / totals.ca) * 100) : 0;
      const totalForfaitPct = (data?.total_sub_count > 0 ? (data.total_forfait_count / data.total_sub_count * 100) : 0).toFixed(2);
      const totalFill: [number, number, number] = [241, 245, 249];
      
      bodyData.push([
        { content: "TOTAL GÉNÉRAL", colSpan: 2, styles: { fontStyle: 'bold', fillColor: totalFill } },
        { content: formatPDFInt(data?.total_sub_count || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [71, 84, 103] } },
        { content: formatPDFInt(data?.total_forfait_count || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [194, 65, 12] } },
        { content: formatPDFInt(data?.total_sc_count || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [109, 40, 217] } },
        { content: `${totalForfaitPct}%`, styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [194, 65, 12] } },
        { content: formatPDFInt(data?.total_resigned_count || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [185, 28, 28] } },
        { content: formatPDFDec(totals.creance_resilie), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [185, 28, 28] } },
        { content: formatPDFDec(totals.ca_eau), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [29, 78, 216] } },
        { content: formatPDFDec(totals.ca_prestation), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [14, 116, 144] } },
        { content: formatPDFDec(totals.ca), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [13, 131, 222] } },
        { content: formatPDFDec(totals.recouvre), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [15, 118, 110] } },
        { content: formatPDFDec(totals.encaissement), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [6, 95, 70] } },
        { content: formatPDFDec(totals.creance), styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [159, 18, 57] } },
        { content: `${totalTaux.toFixed(2)}%`, styles: { fontStyle: 'bold', halign: 'right', fillColor: totalFill, textColor: [71, 84, 103] } }
      ]);

      autoTable(doc, {
        startY: 55,
        margin: { top: 40, bottom: 25, left: 15, right: 15 },
        head: [[
          { content: 'Commune', styles: { halign: 'center' } },
          'Type d\'abonné',
          { content: 'Nb. abonnés', styles: { halign: 'right' } },
          { content: 'Forfait', styles: { halign: 'right', textColor: [194, 65, 12] } },
          { content: 'Sans Cpt.', styles: { halign: 'right', textColor: [109, 40, 217] } },
          { content: 'Taux Forf.', styles: { halign: 'right', textColor: [194, 65, 12] } },
          { content: 'Résiliés', styles: { halign: 'right', textColor: [185, 28, 28] } },
          { content: 'Cré. Rés.', styles: { halign: 'right', textColor: [185, 28, 28] } },
          { content: 'CA Eau', styles: { halign: 'right', textColor: [29, 78, 216] } },
          { content: 'CA Prest.', styles: { halign: 'right', textColor: [14, 116, 144] } },
          { content: 'Total CA', styles: { halign: 'right', textColor: [13, 131, 222] } },
          { content: 'CA Recouv.', styles: { halign: 'right', textColor: [15, 118, 110] } },
          { content: 'Encaissement', styles: { halign: 'right', textColor: [6, 95, 70] } },
          { content: 'Créance', styles: { halign: 'right', textColor: [159, 18, 57] } },
          { content: 'Taux Recov.', styles: { halign: 'right' } }
        ]],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [249, 250, 251], textColor: [71, 84, 103], fontStyle: 'bold', fontSize: 6.5, cellPadding: 3, lineWidth: 0.5, lineColor: [228, 231, 236] },
        styles: { fontSize: 6.8, cellPadding: 2.2, lineColor: [242, 244, 247], lineWidth: 0.5 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 90 },
          2: { cellWidth: 40 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 },
          5: { cellWidth: 35 },
          6: { cellWidth: 35 },
          7: { cellWidth: 50 },
          8: { cellWidth: 50 },
          9: { cellWidth: 50 },
          10: { cellWidth: 55 },
          11: { cellWidth: 50 },
          12: { cellWidth: 50 },
          13: { cellWidth: 55 },
          14: { cellWidth: 40 }
        },
        didDrawPage: (dataDraw) => {
          doc.setFontSize(6.5);
          doc.setTextColor(102, 112, 133);
          const pageCount = doc.getNumberOfPages();
          doc.text(`Page ${dataDraw.pageNumber} sur ${pageCount}`, pageWidth - 40, doc.internal.pageSize.height - 15, { align: 'right' });
          doc.text(`EPEOR Analytics — Bilan d'activité — Généré le ${new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 25, doc.internal.pageSize.height - 15);
        }
      });

      doc.save(`bilan_activite_${selectedSecteur || 'tout'}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue lors de l'exportation PDF.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-12 text-center">
        <h3 className="text-3xl font-black tracking-tight text-[#101828]">Bilan d'activité</h3>
        <p className="text-sm text-[#667085] mt-4 max-w-2xl mx-auto">
          {selectedSecteur ? `Centre : ${secteurLabel}` : 'Vue d’ensemble de l’activité financière.'}
        </p>
        {formatPeriodLabel(startDate, endDate) && (
          <p className="text-sm text-[#334155] mt-3 font-medium">{formatPeriodLabel(startDate, endDate)}</p>
        )}
      </div>

      <div className="bg-white border border-[#E4E7EC] shadow-sm rounded-[2rem] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h4 className="text-xl font-black text-[#101828]">Communes associées</h4>
            <p className="text-sm text-[#667085] mt-2">
              {selectedSecteur
                ? 'Liste des communes du centre sélectionné.'
                : 'Liste des communes couvertes par l’analyse.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="text-right text-xs uppercase tracking-[0.24em] text-[#94A3B8] font-black">
              {filteredCommunes.length} commune{filteredCommunes.length > 1 ? 's' : ''}
            </div>
            {filteredCommunes.length > 0 && (
              <>
                <div className="w-[1px] h-6 bg-[#E4E7EC] hidden sm:block" />
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#0D83DE] hover:bg-[#0a6ab8] active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-600/10 border border-blue-500/10"
                  title="Imprimer le tableau (A4 paysage)"
                >
                  <Printer size={13} />
                  <span>Imprimer</span>
                </button>
                <button
                  type="button"
                  onClick={exportToPDF}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 border border-rose-100 rounded-xl text-xs font-black transition-all shadow-sm"
                  title="Exporter au format PDF"
                >
                  <FileText size={13} />
                  <span>Exporter PDF</span>
                </button>
              </>
            )}
          </div>
        </div>

        {filteredCommunes.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[#E4E7EC] bg-[#F8FAFC] p-8 text-center text-sm text-[#667085]">
            {selectedSecteur
              ? 'Aucune commune associée à ce centre dans les données disponibles.'
              : 'Aucune commune disponible pour le bilan d’activité.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-max min-w-full text-left border-collapse text-[11px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_td>div]:flex-nowrap [&_td]:tabular-nums [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-2">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] text-[9px] uppercase tracking-wider font-black border-b border-[#F2F4F7]">
                    <th className="px-3 py-2 text-center">Commune</th>
                    <th className="px-6 py-5">Type d'abonné</th>
                    <th className="px-6 py-5 text-right">Nombre d'abonnés</th>
                    <th className="px-6 py-5 text-right text-orange-500">Forfait</th>
                    <th className="px-6 py-5 text-right text-violet-600">Sans Compteur</th>
                    <th className="px-6 py-5 text-right text-orange-500">Taux Forfait</th>
                    <th className="px-6 py-5 text-right text-red-500">Nb. Résiliés</th>
                    <th className="px-6 py-5 text-right text-red-700">Créance Résilié</th>
                    <th className="px-6 py-5 text-right">CA Eau</th>
                    <th className="px-6 py-5 text-right">CA Prest.</th>
                    <th className="px-6 py-5 text-right">Total CA</th>
                    <th className="px-6 py-5 text-right text-teal-600">CA Recouvré</th>
                    <th className="px-6 py-5 text-right text-emerald-600">Encaissement</th>
                    <th className="px-6 py-5 text-right text-rose-600">Créance</th>
                    <th className="px-8 py-5 text-right">Taux Recov. (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {filteredCommunes.map((c: any, i: number) => {
                    const communeId = c.id || String(i);
                    const rawTypeRows = Array.isArray(c.by_type) ? c.by_type : Array.isArray(c.types) ? c.types : [];
                    const typeRows = processTypeRows(rawTypeRows);
                    const totCa = Number(c.ca || c.CA || c.ca_total || ((c.ca_eau || 0) + (c.ca_prestation || 0)) || 0);
                    const totCaRecouvre = Number(c.ca_recouvre || 0);
                    const taux = totCa > 0 ? (totCaRecouvre / totCa) * 100 : 0;

                    const totalRowsInGroup = 1 + typeRows.reduce((acc: number, type: any) => {
                      const isGrouped = type.type_code === "2/4/6/7/X/B/G/D/C/A";
                      const isExpanded = isGrouped && expandedGroupedTypes.includes(`${communeId}-AUTRES_TRAVAUX`);
                      const childCount = isExpanded && Array.isArray(type.children) ? type.children.length : 0;
                      return acc + 1 + childCount;
                    }, 0);

                    return (
                      <Fragment key={communeId}>
                        {/* Commune name row – spans all sub-rows + the Total row at the bottom */}
                        <tr className="hover:bg-[#F9FAFB] transition-colors">
                          <td
                            rowSpan={totalRowsInGroup}
                            className="px-8 py-4 font-black text-sm text-[#101828] text-center align-middle bg-white border-r border-[#F2F4F7]"
                          >
                            {c.name || c.commune || c.NOM || '—'}
                          </td>
                          {/* First type row cells inline (first type, if any) */}
                          {typeRows.length === 0 ? (
                            /* No types: show Total directly on the commune row */
                            <>
                              <td className="px-6 py-4 text-xs font-semibold text-sky-700 bg-sky-50">Total</td>
                              <td className="px-6 py-4 text-right font-bold text-[13px] text-[#475467] bg-sky-50">{c.sub_count || 0}</td>
                              <td className="px-6 py-4 text-right font-bold text-[13px] text-orange-500 bg-sky-50">{c.forfait_count || 0}</td>
                              <td className="px-6 py-4 text-right font-bold text-[13px] text-violet-600 bg-sky-50">{c.sc_count || 0}</td>
                              <td className="px-6 py-4 text-right font-bold text-[13px] text-orange-500 bg-sky-50">
                                {(c.sub_count > 0 ? (c.forfait_count / c.sub_count * 100) : 0).toFixed(2)}%
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-[13px] text-red-500 bg-sky-50">{c.resigned_count || 0}</td>
                              <td className="px-6 py-4 text-right font-bold text-[13px] text-red-700 bg-sky-50">{fmt(Number(c.creance_resilie || 0))}</td>
                              <td className="px-6 py-4 text-right font-medium text-[13px] text-blue-600 bg-sky-50">{fmt(Number(c.ca_eau || 0))}</td>
                              <td className="px-6 py-4 text-right font-medium text-[13px] text-cyan-600 bg-sky-50">{fmt(Number(c.ca_prestation || 0))}</td>
                              <td className="px-6 py-4 text-right font-black text-[13px] text-brand-600 bg-sky-50">{fmt(totCa)}</td>
                              <td className="px-6 py-4 text-right font-medium text-[13px] text-teal-600 bg-sky-50">{fmt(totCaRecouvre)}</td>
                              <td className="px-6 py-4 text-right font-medium text-[13px] text-emerald-600 bg-sky-50">{fmt(Number(c.recouvre || c.encaissement || c.encaisse || c.encaissement_total || 0))}</td>
                              <td className="px-6 py-4 text-right font-black text-[13px] text-rose-600 bg-sky-50">{fmt(Number(c.creance || c.CREANCE || 0))}</td>
                              <td className="px-8 py-4 text-right font-black text-[13px] text-[#475467] bg-sky-50">{taux.toFixed(2)}%</td>
                            </>
                          ) : (() => {
                            /* Render first type row inline (shares the commune row) */
                            const type = typeRows[0];
                            const typeCaEau = Number(type.ca_eau || 0);
                            const typeCaPrest = Number(type.ca_prestation || 0);
                            const typeCaTotal = Number(type.ca || type.ca_total || ((type.ca_eau || 0) + (type.ca_prestation || 0)) || 0);
                            const typeCaRecouvre = Number(type.ca_recouvre || 0);
                            const typeEncaisse = Number(type.recouvre || type.encaissement || type.encaisse || type.encaissement_total || 0);
                            const typeCreance = Number(type.creance || 0);
                            const typeTaux = typeCaTotal > 0 ? (typeCaRecouvre / typeCaTotal) * 100 : 0;
                            const isGroupedRow = type.type_code === "2/4/6/7/X/B/G/D/C/A";
                            const groupKey = `${communeId}-AUTRES_TRAVAUX`;
                            const isGroupExpanded = expandedGroupedTypes.includes(groupKey);
                            return (
                              <>
                                <td className="px-6 py-3 text-xs font-semibold text-[#475467]">
                                  <div className={`flex items-center gap-1${isGroupedRow ? ' gap-2 cursor-pointer select-none' : ''}`}
                                    onClick={isGroupedRow ? () => toggleGroupedType(groupKey) : undefined}>
                                    {isGroupedRow && <ChevronRight size={12} className={`text-[#98A2B3] transition-transform ${isGroupExpanded ? 'rotate-90' : ''}`} />}
                                    <span>↳ </span>
                                    {type.type_code && (
                                      <span className="inline-flex items-center font-mono text-[10px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mr-2">
                                        {type.type_code}
                                      </span>
                                    )}
                                    <span className={isGroupedRow ? 'font-bold text-[#101828] hover:text-brand-600 transition-colors underline decoration-dotted' : ''}>
                                      {type.name || type.label || type.type || "Type d'Abonné"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-right font-bold text-[12px] text-[#475467]">{type.sub_count || 0}</td>
                                <td className="px-6 py-3 text-right font-bold text-[12px] text-orange-500">{type.forfait_count || 0}</td>
                                <td className="px-6 py-3 text-right font-bold text-[12px] text-violet-600">{type.sc_count || 0}</td>
                                <td className="px-6 py-3 text-right font-bold text-[12px] text-orange-500">
                                  {(type.sub_count > 0 ? (type.forfait_count / type.sub_count * 100) : 0).toFixed(2)}%
                                </td>
                                <td className="px-6 py-3 text-right font-bold text-[12px] text-red-500">{type.resigned_count || 0}</td>
                                <td className="px-6 py-3 text-right font-bold text-[12px] text-red-700">{fmt(Number(type.creance_resilie || 0))}</td>
                                <td className="px-6 py-3 text-right font-medium text-[12px] text-blue-600">{fmt(typeCaEau)}</td>
                                <td className="px-6 py-3 text-right font-medium text-[12px] text-cyan-600">{fmt(typeCaPrest)}</td>
                                <td className="px-6 py-3 text-right font-bold text-[12px] text-brand-600">{fmt(typeCaTotal)}</td>
                                <td className="px-6 py-3 text-right font-medium text-[12px] text-teal-600 bg-teal-50/10">{fmt(typeCaRecouvre)}</td>
                                <td className="px-6 py-3 text-right font-medium text-[12px] text-emerald-600 bg-emerald-50/10">{fmt(typeEncaisse)}</td>
                                <td className="px-6 py-3 text-right font-bold text-[12px] text-rose-600 bg-rose-50/30">{fmt(typeCreance)}</td>
                                <td className="px-8 py-3 text-right font-bold text-[12px] text-[#475467]">{typeTaux.toFixed(2)}%</td>
                              </>
                            );
                          })()}
                        </tr>
                        {/* Remaining type rows (index >= 1) */}
                        {typeRows.slice(1).map((type: any, tIndex: number) => {
                          const typeCaEau = Number(type.ca_eau || 0);
                          const typeCaPrest = Number(type.ca_prestation || 0);
                          const typeCaTotal = Number(type.ca || type.ca_total || ((type.ca_eau || 0) + (type.ca_prestation || 0)) || 0);
                          const typeCaRecouvre = Number(type.ca_recouvre || 0);
                          const typeEncaisse = Number(type.recouvre || type.encaissement || type.encaisse || type.encaissement_total || 0);
                          const typeCreance = Number(type.creance || 0);
                          const typeTaux = typeCaTotal > 0 ? (typeCaRecouvre / typeCaTotal) * 100 : 0;
                          const isGroupedRow = type.type_code === "2/4/6/7/X/B/G/D/C/A";
                          const groupKey = `${communeId}-AUTRES_TRAVAUX`;
                          const isGroupExpanded = expandedGroupedTypes.includes(groupKey);
                          if (isGroupedRow) {
                            return (
                              <Fragment key={`${communeId}-type-${tIndex + 1}`}>
                                <tr className="bg-slate-50 hover:bg-slate-100/80 transition-colors">
                                  <td className="px-6 py-3 text-xs font-semibold text-[#475467]">
                                    <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => toggleGroupedType(groupKey)}>
                                      <ChevronRight size={12} className={`text-[#98A2B3] transition-transform ${isGroupExpanded ? 'rotate-90' : ''}`} />
                                      <span>↳ </span>
                                      {type.type_code && (
                                        <span className="inline-flex items-center font-mono text-[9px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                          {type.type_code}
                                        </span>
                                      )}
                                      <span className="font-bold text-[#101828] hover:text-brand-600 transition-colors underline decoration-dotted">{type.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-3 text-right font-bold text-[12px] text-[#475467]">{type.sub_count || 0}</td>
                                  <td className="px-6 py-3 text-right font-bold text-[12px] text-orange-500">{type.forfait_count || 0}</td>
                                  <td className="px-6 py-3 text-right font-bold text-[12px] text-violet-600">{type.sc_count || 0}</td>
                                 <td className="px-6 py-3 text-right font-bold text-[12px] text-orange-500">
                                   {(type.sub_count > 0 ? (type.forfait_count / type.sub_count * 100) : 0).toFixed(2)}%
                                 </td>
                                 <td className="px-6 py-3 text-right font-bold text-[12px] text-red-500">{type.resigned_count || 0}</td>
                                 <td className="px-6 py-3 text-right font-bold text-[12px] text-red-700">{fmt(Number(type.creance_resilie || 0))}</td>
                                  <td className="px-6 py-3 text-right font-medium text-[12px] text-blue-600">{fmt(typeCaEau)}</td>
                                  <td className="px-6 py-3 text-right font-medium text-[12px] text-cyan-600">{fmt(typeCaPrest)}</td>
                                  <td className="px-6 py-3 text-right font-bold text-[12px] text-brand-600">{fmt(typeCaTotal)}</td>
                                  <td className="px-6 py-3 text-right font-medium text-[12px] text-teal-600 bg-teal-50/10">{fmt(typeCaRecouvre)}</td>
                                  <td className="px-6 py-3 text-right font-medium text-[12px] text-emerald-600 bg-emerald-50/10">{fmt(typeEncaisse)}</td>
                                  <td className="px-6 py-3 text-right font-bold text-[12px] text-rose-600 bg-rose-50/30">{fmt(typeCreance)}</td>
                                  <td className="px-8 py-3 text-right font-bold text-[12px] text-[#475467]">{typeTaux.toFixed(2)}%</td>
                                </tr>
                                {isGroupExpanded && Array.isArray(type.children) && type.children.map((child: any, cIdx: number) => {
                                  const childCaEau = Number(child.ca_eau || 0);
                                  const childCaPrest = Number(child.ca_prestation || 0);
                                  const childCaTotal = Number(child.ca || child.ca_total || ((child.ca_eau || 0) + (child.ca_prestation || 0)) || 0);
                                  const childCaRecouvre = Number(child.ca_recouvre || 0);
                                  const childEncaisse = Number(child.recouvre || child.encaissement || child.encaisse || child.encaissement_total || 0);
                                  const childCreance = Number(child.creance || 0);
                                  const childTaux = childCaTotal > 0 ? (childCaRecouvre / childCaTotal) * 100 : 0;
                                  return (
                                    <tr key={`${communeId}-child-${cIdx}`} className="bg-slate-100/30 hover:bg-slate-200/20 transition-colors">
                                      <td className="px-6 py-2.5 pl-14 text-xs font-semibold text-[#475467]">
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-400 mr-2">↳ ↳</span>
                                          {child.type_code && (
                                            <span className="inline-flex items-center font-mono text-[9px] font-black text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-300/50">
                                              {child.type_code}
                                            </span>
                                          )}
                                          <span>{child.name || child.label || child.type || "Type d'Abonné"}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-[#475467]/80">{child.sub_count || 0}</td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-orange-500/80">{child.forfait_count || 0}</td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-violet-600/80">{child.sc_count || 0}</td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-orange-500/80">
                                        {(child.sub_count > 0 ? (child.forfait_count / child.sub_count * 100) : 0).toFixed(2)}%
                                      </td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-red-500/80">{child.resigned_count || 0}</td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-red-700/80">{fmt(Number(child.creance_resilie || 0))}</td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-blue-600/80">{fmt(childCaEau)}</td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-cyan-600/80">{fmt(childCaPrest)}</td>
                                      <td className="px-6 py-2.5 text-right font-bold text-[11px] text-brand-600/80">{fmt(childCaTotal)}</td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-teal-600/80 bg-teal-50/5">{fmt(childCaRecouvre)}</td>
                                      <td className="px-6 py-2.5 text-right font-medium text-[11px] text-emerald-600/80 bg-emerald-50/5">{fmt(childEncaisse)}</td>
                                      <td className="px-6 py-2.5 text-right font-bold text-[12px] text-rose-600/80 bg-rose-50/10">{fmt(childCreance)}</td>
                                      <td className="px-8 py-2.5 text-right font-bold text-[11px] text-[#475467]/80">{childTaux.toFixed(2)}%</td>
                                    </tr>
                                  );
                                })}
                              </Fragment>
                            );
                          }
                          return (
                            <tr key={`${communeId}-type-${tIndex + 1}`} className="bg-slate-50 hover:bg-slate-100/50 transition-colors">
                              <td className="px-6 py-3 text-xs font-semibold text-[#475467]">
                                <div className="flex items-center gap-1">
                                  <span>↳ </span>
                                  {type.type_code && (
                                    <span className="inline-flex items-center font-mono text-[10px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mr-2">
                                      {type.type_code}
                                    </span>
                                  )}
                                  <span>{type.name || type.label || type.type || "Type d'Abonné"}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-[12px] text-[#475467]">{type.sub_count || 0}</td>
                              <td className="px-6 py-3 text-right font-bold text-[12px] text-orange-500">{type.forfait_count || 0}</td>
                              <td className="px-6 py-3 text-right font-bold text-[12px] text-violet-600">{type.sc_count || 0}</td>
                              <td className="px-6 py-3 text-right font-bold text-[12px] text-orange-500">
                                {(type.sub_count > 0 ? (type.forfait_count / type.sub_count * 100) : 0).toFixed(2)}%
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-[12px] text-red-500">{type.resigned_count || 0}</td>
                              <td className="px-6 py-3 text-right font-bold text-[12px] text-red-700">{fmt(Number(type.creance_resilie || 0))}</td>
                              <td className="px-6 py-3 text-right font-medium text-[12px] text-blue-600">{fmt(typeCaEau)}</td>
                              <td className="px-6 py-3 text-right font-medium text-[12px] text-cyan-600">{fmt(typeCaPrest)}</td>
                              <td className="px-6 py-3 text-right font-bold text-[12px] text-brand-600">{fmt(typeCaTotal)}</td>
                              <td className="px-6 py-3 text-right font-medium text-[12px] text-teal-600 bg-teal-50/10">{fmt(typeCaRecouvre)}</td>
                              <td className="px-6 py-3 text-right font-medium text-[12px] text-emerald-600 bg-emerald-50/10">{fmt(typeEncaisse)}</td>
                              <td className="px-6 py-3 text-right font-bold text-[12px] text-rose-600 bg-rose-50/30">{fmt(typeCreance)}</td>
                              <td className="px-8 py-3 text-right font-bold text-[12px] text-[#475467]">{typeTaux.toFixed(2)}%</td>
                            </tr>
                          );
                        })}
                        {/* Also render first type's expanded children if it was grouped */}
                        {typeRows.length > 0 && (() => {
                          const type = typeRows[0];
                          const isGroupedRow = type.type_code === "2/4/6/7/X/B/G/D/C/A";
                          const groupKey = `${communeId}-AUTRES_TRAVAUX`;
                          const isGroupExpanded = expandedGroupedTypes.includes(groupKey);
                          if (!isGroupedRow || !isGroupExpanded || !Array.isArray(type.children)) return null;
                          return type.children.map((child: any, cIdx: number) => {
                            const childCaEau = Number(child.ca_eau || 0);
                            const childCaPrest = Number(child.ca_prestation || 0);
                            const childCaTotal = Number(child.ca || child.ca_total || ((child.ca_eau || 0) + (child.ca_prestation || 0)) || 0);
                            const childCaRecouvre = Number(child.ca_recouvre || 0);
                            const childEncaisse = Number(child.recouvre || child.encaissement || child.encaisse || child.encaissement_total || 0);
                            const childCreance = Number(child.creance || 0);
                            const childTaux = childCaTotal > 0 ? (childCaRecouvre / childCaTotal) * 100 : 0;
                            return (
                              <tr key={`${communeId}-child0-${cIdx}`} className="bg-slate-100/30 hover:bg-slate-200/20 transition-colors">
                                <td className="px-6 py-2.5 pl-14 text-xs font-semibold text-[#475467]">
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400 mr-2">↳ ↳</span>
                                    {child.type_code && (
                                      <span className="inline-flex items-center font-mono text-[9px] font-black text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-300/50">
                                        {child.type_code}
                                      </span>
                                    )}
                                    <span>{child.name || child.label || child.type || "Type d'Abonné"}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-[#475467]/80">{child.sub_count || 0}</td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-orange-500/80">{child.forfait_count || 0}</td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-violet-600/80">{child.sc_count || 0}</td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-orange-500/80">
                                  {(child.sub_count > 0 ? (child.forfait_count / child.sub_count * 100) : 0).toFixed(2)}%
                                </td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-red-500/80">{child.resigned_count || 0}</td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-red-700/80">{fmt(Number(child.creance_resilie || 0))}</td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-blue-600/80">{fmt(childCaEau)}</td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-cyan-600/80">{fmt(childCaPrest)}</td>
                                <td className="px-6 py-2.5 text-right font-bold text-[11px] text-brand-600/80">{fmt(childCaTotal)}</td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-teal-600/80 bg-teal-50/5">{fmt(childCaRecouvre)}</td>
                                <td className="px-6 py-2.5 text-right font-medium text-[11px] text-emerald-600/80 bg-emerald-50/5">{fmt(childEncaisse)}</td>
                                <td className="px-6 py-2.5 text-right font-bold text-[12px] text-rose-600/80 bg-rose-50/10">{fmt(childCreance)}</td>
                                <td className="px-8 py-2.5 text-right font-bold text-[11px] text-[#475467]/80">{childTaux.toFixed(2)}%</td>
                              </tr>
                            );
                          });
                        })()}
                        {/* Total row – at the bottom with sky-blue background */}
                        {typeRows.length > 0 && (
                          <tr className="bg-sky-100 hover:bg-sky-200/70 transition-colors border-t-2 border-sky-300">
                            <td className="px-6 py-4 text-xs font-black text-sky-700 uppercase tracking-wide">Total</td>
                            <td className="px-6 py-4 text-right font-black text-[13px] text-sky-700">{c.sub_count || 0}</td>
                            <td className="px-6 py-4 text-right font-black text-[13px] text-orange-600">{c.forfait_count || 0}</td>
                            <td className="px-6 py-4 text-right font-black text-[13px] text-violet-700">{c.sc_count || 0}</td>
                            <td className="px-6 py-4 text-right font-black text-[13px] text-orange-600">
                              {(c.sub_count > 0 ? (c.forfait_count / c.sub_count * 100) : 0).toFixed(2)}%
                            </td>
                            <td className="px-6 py-4 text-right font-black text-[13px] text-red-600">{c.resigned_count || 0}</td>
                            <td className="px-6 py-4 text-right font-black text-[13px] text-red-700">{fmt(Number(c.creance_resilie || 0))}</td>
                            <td className="px-6 py-4 text-right font-medium text-[13px] text-blue-700">{fmt(Number(c.ca_eau || 0))}</td>
                            <td className="px-6 py-4 text-right font-medium text-[13px] text-cyan-700">{fmt(Number(c.ca_prestation || 0))}</td>
                            <td className="px-6 py-4 text-right font-black text-[13px] text-brand-700">{fmt(totCa)}</td>
                            <td className="px-6 py-4 text-right font-medium text-[13px] text-teal-700">{fmt(totCaRecouvre)}</td>
                            <td className="px-6 py-4 text-right font-medium text-[13px] text-emerald-700">{fmt(Number(c.recouvre || c.encaissement || c.encaisse || c.encaissement_total || 0))}</td>
                            <td className="px-6 py-4 text-right font-black text-[13px] text-rose-700">{fmt(Number(c.creance || c.CREANCE || 0))}</td>
                            <td className="px-8 py-4 text-right font-black text-[13px] text-sky-700">{taux.toFixed(2)}%</td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-slate-900 text-white font-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                    <td colSpan={2} className="px-8 py-5 text-sm uppercase tracking-widest">TOTAL GÉNÉRAL</td>
                    <td className="px-6 py-5 text-right text-slate-300 font-mono">{data.total_sub_count || 0}</td>
                    <td className="px-6 py-5 text-right text-orange-400 font-mono">{data.total_forfait_count || 0}</td>
                    <td className="px-6 py-5 text-right text-violet-400 font-mono">{data.total_sc_count || 0}</td>
                    <td className="px-6 py-5 text-right text-orange-400 font-mono">{(data.total_sub_count > 0 ? (data.total_forfait_count / data.total_sub_count * 100) : 0).toFixed(2)}%</td>
                    <td className="px-6 py-5 text-right text-red-400 font-mono">{data.total_resigned_count || 0}</td>
                    <td className="px-6 py-5 text-right text-red-300 font-mono">{fmt(totals.creance_resilie)}</td>
                    <td className="px-6 py-5 text-right text-blue-400 font-mono">{fmt(totals.ca_eau)}</td>
                    <td className="px-6 py-5 text-right text-cyan-400 font-mono">{fmt(totals.ca_prestation)}</td>
                    <td className="px-6 py-5 text-right text-brand-400 font-mono">{fmt(totals.ca)}</td>
                    <td className="px-6 py-5 text-right text-teal-400 font-mono bg-white/5">{fmt(totals.recouvre)}</td>
                    <td className="px-6 py-5 text-right text-emerald-400 font-mono bg-white/5">{fmt(totals.encaissement)}</td>
                    <td className="px-6 py-5 text-right text-rose-400 bg-white/5 font-mono">{fmt(totals.creance)}</td>
                    <td className="px-8 py-5 text-right text-slate-300 font-mono">{(totals.ca > 0 ? ((totals.recouvre / totals.ca) * 100) : 0).toFixed(2)}%</td>
                  </tr>
                </tfoot>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

