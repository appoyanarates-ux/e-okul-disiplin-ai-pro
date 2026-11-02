import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  PageOrientation,
  ShadingType,
  convertMillimetersToTwip
} from 'docx';
import { DocumentDefinition, DocumentSection } from './documentEngine';

const FONT_FAMILY = 'Times New Roman';

export async function generateDocxBlob(docDef: DocumentDefinition): Promise<Blob> {
  const doc = createDocxDocument(docDef);
  return await Packer.toBlob(doc);
}

export async function generateDocxBuffer(docDef: DocumentDefinition): Promise<Uint8Array> {
  const doc = createDocxDocument(docDef);
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

function createDocxDocument(docDef: DocumentDefinition): Document {
  const isLandscape = docDef.orientation === 'landscape';

  const marginTwips = convertMillimetersToTwip(18); // 18mm standard margin

  const pageWidthTwips = isLandscape ? 16838 : 11906; // A4 in twips
  const pageHeightTwips = isLandscape ? 11906 : 16838;
  const contentWidthTwips = pageWidthTwips - (marginTwips * 2);

  const children: (Paragraph | Table)[] = [];

  // 1. Institution Header
  const headerLines = docDef.institutionName.split('\n');
  headerLines.forEach(line => {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: line.trim(),
            bold: true,
            size: 24, // 12pt
            font: FONT_FAMILY,
            color: '0f172a'
          })
        ]
      })
    );
  });

  // Academic year if present
  if (docDef.academicYear) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 40 },
        children: [
          new TextRun({
            text: docDef.academicYear,
            italics: true,
            size: 20, // 10pt
            font: FONT_FAMILY,
            color: '475569'
          })
        ]
      })
    );
  }

  // 2. Document Main Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({
          text: docDef.title,
          bold: true,
          size: 28, // 14pt
          font: FONT_FAMILY,
          color: '000000'
        })
      ]
    })
  );

  // Subtitle
  if (docDef.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 120 },
        children: [
          new TextRun({
            text: docDef.subtitle,
            italics: true,
            size: 20, // 10pt
            font: FONT_FAMILY,
            color: '475569'
          })
        ]
      })
    );
  }

  // Code and Date row (if any)
  if (docDef.code || docDef.date) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' },
          left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: docDef.code ? `Sayı / Kod: ${docDef.code}` : '',
                        bold: true,
                        size: 19,
                        font: FONT_FAMILY
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: docDef.date ? `Tarih: ${docDef.date}` : '',
                        bold: true,
                        size: 19,
                        font: FONT_FAMILY
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    );
    // Spacing after header table
    children.push(new Paragraph({ spacing: { before: 120, after: 120 } }));
  }

  // 3. Render Sections
  docDef.sections.forEach(section => {
    renderSection(section, children);
  });

  // 4. Render Signatures
  if (docDef.signatures && docDef.signatures.length > 0) {
    children.push(new Paragraph({ spacing: { before: 240, after: 120 } }));
    renderSignatures(docDef.signatures, children);
  }

  // Footer & Header
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageWidthTwips,
              height: pageHeightTwips,
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
            },
            margin: {
              top: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              right: marginTwips
            }
          }
        },
        footers: {
          default: new Footer({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: 'cbd5e1' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            spacing: { before: 60 },
                            children: [
                              new TextRun({
                                text: docDef.footerNote || "E-Okul Disiplin AI Pro - By Abdullah Yanarateş",
                                size: 16, // 8pt
                                italics: true,
                                color: '64748b',
                                font: FONT_FAMILY
                              })
                            ]
                          })
                        ]
                      }),
                      new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            spacing: { before: 60 },
                            children: [
                              new TextRun({
                                text: "Sayfa ",
                                size: 16,
                                font: FONT_FAMILY
                              }),
                              new TextRun({
                                children: [PageNumber.CURRENT],
                                size: 16,
                                font: FONT_FAMILY
                              }),
                              new TextRun({
                                text: " / ",
                                size: 16,
                                font: FONT_FAMILY
                              }),
                              new TextRun({
                                children: [PageNumber.TOTAL_PAGES],
                                size: 16,
                                font: FONT_FAMILY
                              })
                            ]
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        },
        children
      }
    ]
  });

  return doc;
}

function renderSection(section: DocumentSection, children: (Paragraph | Table)[]) {
  if (section.title) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            size: 22, // 11pt
            font: FONT_FAMILY,
            color: '1e3a8a' // Dark navy
          })
        ]
      })
    );
  }

  switch (section.type) {
    case 'paragraph': {
      if (section.text) {
        const paragraphs = section.text.split('\n\n');
        paragraphs.forEach(pText => {
          let align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED;
          if (section.align === 'center') align = AlignmentType.CENTER;
          if (section.align === 'right') align = AlignmentType.RIGHT;
          if (section.align === 'left') align = AlignmentType.LEFT;

          children.push(
            new Paragraph({
              alignment: align,
              spacing: { before: 60, after: 100, line: 280 }, // 1.25 line height
              children: [
                new TextRun({
                  text: pText.trim(),
                  size: 21, // 10.5pt
                  font: FONT_FAMILY,
                  bold: section.bold || false
                })
              ]
            })
          );
        });
      }
      break;
    }

    case 'keyValueGrid': {
      if (section.items && section.items.length > 0) {
        const tableRows: TableRow[] = [];
        // Group by pairs (2 columns)
        for (let i = 0; i < section.items.length; i += 2) {
          const item1 = section.items[i];
          const item2 = section.items[i + 1];

          tableRows.push(
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 22, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: 'f8fafc' },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: item1.label,
                          bold: true,
                          size: 19,
                          font: FONT_FAMILY,
                          color: '334155'
                        })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 28, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: item1.value || '-',
                          size: 19,
                          font: FONT_FAMILY
                        })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 22, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: 'f8fafc' },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: item2 ? item2.label : '',
                          bold: true,
                          size: 19,
                          font: FONT_FAMILY,
                          color: '334155'
                        })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 28, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: item2 ? (item2.value || '-') : '',
                          size: 19,
                          font: FONT_FAMILY
                        })
                      ]
                    })
                  ]
                })
              ]
            })
          );
        }

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: 'cbd5e1' },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: 'cbd5e1' },
              left: { style: BorderStyle.SINGLE, size: 6, color: 'cbd5e1' },
              right: { style: BorderStyle.SINGLE, size: 6, color: 'cbd5e1' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' }
            },
            rows: tableRows
          })
        );
        children.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
      }
      break;
    }

    case 'table': {
      if (section.headers && section.rows) {
        const tableRows: TableRow[] = [];

        // Header row
        tableRows.push(
          new TableRow({
            tableHeader: true,
            children: section.headers.map((h, idx) => {
              const colW = section.colWidths?.[idx] || Math.floor(100 / section.headers!.length);
              return new TableCell({
                width: { size: colW, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: 'e2e8f0' },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 60 },
                    children: [
                      new TextRun({
                        text: h,
                        bold: true,
                        size: 18, // 9pt
                        font: FONT_FAMILY,
                        color: '0f172a'
                      })
                    ]
                  })
                ]
              });
            })
          })
        );

        // Data rows
        section.rows.forEach((row, rIdx) => {
          const isEven = rIdx % 2 === 0;
          tableRows.push(
            new TableRow({
              children: row.map((cellVal, cIdx) => {
                const colW = section.colWidths?.[cIdx] || Math.floor(100 / row.length);
                return new TableCell({
                  width: { size: colW, type: WidthType.PERCENTAGE },
                  shading: isEven ? { type: ShadingType.CLEAR, fill: 'ffffff' } : { type: ShadingType.CLEAR, fill: 'f8fafc' },
                  children: [
                    new Paragraph({
                      spacing: { before: 40, after: 40 },
                      children: [
                        new TextRun({
                          text: String(cellVal !== undefined && cellVal !== null ? cellVal : ''),
                          size: 17, // 8.5pt
                          font: FONT_FAMILY
                        })
                      ]
                    })
                  ]
                });
              })
            })
          );
        });

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: '94a3b8' },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: '94a3b8' },
              left: { style: BorderStyle.SINGLE, size: 6, color: '94a3b8' },
              right: { style: BorderStyle.SINGLE, size: 6, color: '94a3b8' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'cbd5e1' },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'cbd5e1' }
            },
            rows: tableRows
          })
        );
        children.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
      }
      break;
    }

    case 'bulletList': {
      if (section.bullets) {
        section.bullets.forEach(b => {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: b,
                  size: 20,
                  font: FONT_FAMILY
                })
              ]
            })
          );
        });
      }
      break;
    }

    case 'notice': {
      if (section.text) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: '3b82f6' },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: '3b82f6' },
              left: { style: BorderStyle.SINGLE, size: 24, color: '1d4ed8' }, // thick blue bar
              right: { style: BorderStyle.SINGLE, size: 6, color: '3b82f6' },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: 'eff6ff' },
                    children: [
                      new Paragraph({
                        spacing: { before: 80, after: 80 },
                        children: [
                          new TextRun({
                            text: section.text,
                            italics: true,
                            size: 19,
                            font: FONT_FAMILY,
                            color: '1e3a8a'
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        );
        children.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
      }
      break;
    }
  }
}

function renderSignatures(signatures: { title: string; name?: string; duty?: string }[], children: (Paragraph | Table)[]) {
  const colWidthPct = Math.floor(100 / signatures.length);

  const sigCells = signatures.map(sig => {
    return new TableCell({
      width: { size: colWidthPct, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: sig.title,
              bold: true,
              size: 20,
              font: FONT_FAMILY
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 40 }, // Space for signature / stamp
          children: [
            new TextRun({
              text: sig.name || 'İmza / Mühür',
              size: 19,
              font: FONT_FAMILY
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: sig.duty ? `(${sig.duty})` : '',
              italics: true,
              size: 17,
              font: FONT_FAMILY,
              color: '475569'
            })
          ]
        })
      ]
    });
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
      },
      rows: [
        new TableRow({
          children: sigCells
        })
      ]
    })
  );
}
