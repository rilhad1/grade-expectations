// Генерує templates/statement.docx — простий шаблон відомості (заглушка для OQ-5).
// Запуск: pnpm --filter @ge/api template:build. Готовий файл комітиться; коледж може замінити його своїм
// (теги docxtemplater: {college}, {students} тощо — див. modules/documents/statement.ts).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import PizZip from 'pizzip';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const run = (text: string, bold = false) =>
  `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (text: string, opts: { bold?: boolean; center?: boolean; after?: number } = {}) =>
  `<w:p><w:pPr>${opts.center ? '<w:jc w:val="center"/>' : ''}<w:spacing w:after="${String(opts.after ?? 120)}"/></w:pPr>${run(text, opts.bold)}</w:p>`;

const cell = (width: number, text: string, opts: { bold?: boolean; center?: boolean } = {}) =>
  `<w:tc><w:tcPr><w:tcW w:w="${String(width)}" w:type="dxa"/></w:tcPr>${para(text, { ...opts, after: 40 })}</w:tc>`;

const widths = [700, 5200, 1500, 2200] as const;
const border = (side: string) =>
  `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`;
const row = (cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`;

const table = `<w:tbl><w:tblPr><w:tblW w:w="${String(widths.reduce((a, b) => a + b, 0))}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${String(w)}"/>`).join('')}</w:tblGrid>${row(
  [
    cell(widths[0], '№', { bold: true, center: true }),
    cell(widths[1], 'Прізвище, ім’я, по батькові', { bold: true }),
    cell(widths[2], 'Оцінка', { bold: true, center: true }),
    cell(widths[3], 'Примітка', { bold: true }),
  ],
)}${row([
  cell(widths[0], '{#students}{n}', { center: true }),
  cell(widths[1], '{name}'),
  cell(widths[2], '{final}', { center: true }),
  cell(widths[3], '{comment}{/students}'),
])}</w:tbl>`;

const body = [
  para('{college}', { center: true }),
  para('ВІДОМІСТЬ', { bold: true, center: true, after: 0 }),
  para('{module}', { bold: true, center: true, after: 240 }),
  para('Семестр: {semester}'),
  para('Дисципліна: {discipline} ({lessonKind}), форма контролю: {controlForm}'),
  para('Група: {group}'),
  para('Викладач: {teacher}', { after: 240 }),
  table,
  para('', { after: 120 }),
  para('Усього студентів: {total}. Оцінено: {graded}. Не атестовано (н/а): {notCertified}.'),
  para('Дата: {date}', { after: 360 }),
  para('Викладач ____________________ {teacher}', { after: 240 }),
  para('Завідувач відділення ____________________'),
].join('');

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="uk-UA"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;

const zip = new PizZip();
zip.file(
  '[Content_Types].xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
);
zip.file(
  '_rels/.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
);
zip.file(
  'word/_rels/document.xml.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
);
zip.file('word/document.xml', documentXml);
zip.file('word/styles.xml', stylesXml);

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../templates/statement.docx');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Записано ${out}`);
