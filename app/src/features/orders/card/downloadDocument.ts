/** Минимальный валидный PDF (один лист, ASCII-текст) — «содержимое» демо-документов из исходных данных. */
function demoPdf(title: string): Blob {
  const safe = title.replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, '')
  const stream = `BT /F1 20 Tf 72 760 Td (Demo document: ${safe}) Tj ET`
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((o, i) => {
    const at = pdf.length
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((o) => (pdf += `${String(o).padStart(10, '0')} 00000 n \n`))
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

const save = (href: string, name: string) => {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Скачивает загруженный файл или, для демо-данных без файла, пример PDF. */
export function downloadDocument(doc: { fileName: string; dataUrl?: string }) {
  if (doc.dataUrl) return save(doc.dataUrl, doc.fileName)
  const url = URL.createObjectURL(demoPdf(doc.fileName))
  save(url, doc.fileName.endsWith('.pdf') ? doc.fileName : `${doc.fileName}.pdf`)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })

export const formatSize = (bytes?: number) =>
  bytes === undefined
    ? ''
    : bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} КБ`
      : `${(bytes / 1024 / 1024).toFixed(1)} МБ`
