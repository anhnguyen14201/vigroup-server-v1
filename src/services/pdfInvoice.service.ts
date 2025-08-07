import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'

interface Supplier {
  companyName: string
  ico: string
  dic: string
  address: string
  phones: string[]
  bankAccount: string
  imageUrls: any
}
interface Customer {
  companyName?: string
  fullName?: string
  street?: string
  postalCode?: string
  province?: string
  country?: string
  ico?: string
  dic?: string
}
interface LineItem {
  desc: string
  quantity: number
  unitGross: number
  totalGross: number
  totalNet: number
  tax: number
  name?: string
}
interface Product {
  code: string
  image: string
  name: string
  quantity: number
  unitGross: number
  totalGross: number
  totalNet: number
  tax: number
}
interface Fuel {
  distance: number
  unitCost: number
  total: number
  unitGross: number
  totalGross: number
  tax: number
  totalNet: number
}

export async function createInvoicePDF(data: {
  logoUrl: string
  date: string
  supplier: Supplier
  customer: Customer
  installations: LineItem[]
  shipping: {
    label: string
    net: number
    tax: number
    gross: number
  }
  fuels: Fuel[]
  products: Product[]
  totalPrice: number
  code: string
  statusPayment: string
  dueDate: any
  variableSymbol: any
  taxRates: any
  grossByTaxRate: any
  DPH: any
}): Promise<Buffer> {
  // 1. Load template
  let html = fs.readFileSync(path.resolve(__dirname, 'invoice.html'), 'utf8')
  const customerName = data.customer.companyName || data.customer.fullName || ''
  // 2. Inject simple fields
  html = html
    .replace('{{logoUrl}}', data.logoUrl)
    .replace('{{code}}', data.code)
    .replace('{{date}}', data.date)
    .replace('{{supplier.companyName}}', data.supplier?.companyName)
    .replace('{{supplier.address}}', data.supplier.address)
    .replace('{{supplier.ico}}', data.supplier.ico)
    .replace('{{supplier.dic}}', data.supplier.dic)
    .replace('{{supplier.bankAccount}}', data.supplier.bankAccount)
    .replace('{{variableSymbol}}', data.variableSymbol)

    // customer
    .replace('{{customer.name}}', customerName)
    .replace('{{customer.street}}', data.customer.street || '')
    .replace('{{customer.postalCode}}', data.customer.postalCode || '')
    .replace('{{customer.province}}', data.customer.province || '')
    .replace('{{customer.ico}}', data.customer.ico || '')
    .replace('{{customer.dic}}', data.customer.dic || '')
    .replace('{{date}}', data.date)
    .replace('{{dueDate}}', data.dueDate)
    .replace('{{date}}', data.date)
    .replace('{{statusPayment}}', data.statusPayment)
  // helpers
  const fmt = (v: number) =>
    new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2 }).format(v)
  // 5. Inject products
  html = html.replace(
    /{{#each products}}[\s\S]*?{{\/each}}/,
    data.products
      .map(
        p => `
        <tr>
          <td>${p.code}</td>
          <td>${p.name}</td>
          <td>${p.quantity}</td>
          <td>${fmt(p.unitGross)} Kč</td>
          <td>${fmt(p.totalGross)} Kč</td>
          <td>${p.tax} %</td>
          <td>${fmt(p.totalNet)} Kč</td>
        </tr>`,
      )
      .join(''),
  )

  // 3. Inject installations
  html = html.replace(
    /{{#each installations}}[\s\S]*?{{\/each}}/,
    data.installations
      .map(
        i => `
        <tr>
          <td>—</td>
          <td>${i.desc}</td>
          <td>${i.quantity}</td>
          <td>${fmt(i.unitGross)} Kč</td>
          <td>${fmt(i.totalGross)} Kč</td>
          <td>${i.tax} %</td>
          <td>${fmt(i.totalNet)} Kč</td>
        </tr>`,
      )
      .join(''),
  )

  // 4. Inject fuels
  html = html.replace(
    /{{#each fuels}}[\s\S]*?{{\/each}}/,
    data.fuels
      .map(
        f => `
        <tr>
            <td>—</td>
            <td>Vzdálenost: ${f.distance} Km</td>
            <td>${f.distance}</td>
            <td>${fmt(f.unitGross)} Kč</td>
            <td>${fmt(f.totalGross)} Kč</td>
            <td>${f.tax} %</td>
            <td>${fmt(f.totalNet)} Kč</td>
        </tr>`,
      )
      .join(''),
  )

  html = html.replace(
    /{{#each shipping}}[\s\S]*?{{\/each}}/,
    `
      <tr>
        <td>—</td>
        <td>${data.shipping.label}</td>
        <td>1</td>
        <td>${fmt(data.shipping.net)} Kč</td>
        <td>${fmt(data.shipping.net)} Kč</td>
        <td>${data.shipping.tax} %</td>
        <td>${fmt(data.shipping.gross)} Kč</td>
      </tr>
    `,
  )

  // 1️⃣ Sinh các dòng tbody
  const summaryRows = data.taxRates
    .map((rate: any) => {
      const základ = fmt(data.grossByTaxRate[rate])
      const dph = fmt(data.DPH[rate])
      return `
      <tr>
        <td>${rate} %</td>
        <td>${základ} Kč</td>
        <td>${dph} Kč</td>
      </tr>`
    })
    .join('')

  // 2️⃣ Gói thành table
  const summaryTable = `
  <table class="summary-table">
      <tr>
        <th>Sazba</th>
        <th>Základ</th>
        <th>DPH</th>
      </tr>
    <tbody>
      ${summaryRows}
    </tbody>
  </table>`

  // 3️⃣ Replace cả block <div class="summary">…</div>
  html = html.replace(
    /<div class="summary">[\s\S]*?<\/div>/,
    `<div class="summary">
     ${summaryTable}
   </div>`,
  )

  // 4️⃣ Cuối cùng vẫn replace tổng giá
  html = html.replace('{{totalPrice}}', fmt(data.totalPrice))
  html = html.replace('{{supplier.imageUrls}}', data.supplier.imageUrls)
  // 7. Launch Puppeteer
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
  })
  await browser.close()
  return Buffer.from(pdfBuffer)
}
