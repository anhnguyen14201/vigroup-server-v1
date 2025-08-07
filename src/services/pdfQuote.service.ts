import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'
import { formatPhoneCZ } from '~/utils'

interface Supplier {
  companyName: string
  ico: string
  dic: string
  address: string
  phones: string[]
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
  unitCost: number
  total: number
  image?: string
  name?: string
}
interface Product {
  code: string
  image: string
  name: string
  quantity: number
  unitCost: number
  total: number
}
interface Fuel {
  distance: number
  unitCost: number
  total: number
}

export async function createQuotePDF(data: {
  logoUrl: string
  date: string
  supplier: Supplier
  shipping: { label: string; net: number; tax: number; gross: number }
  customer: Customer
  installations: LineItem[]
  fuels: Fuel[]
  products: Product[]
  totalPrice: number
  code: string
}): Promise<Buffer> {
  // 1. Load template
  let html = fs.readFileSync(path.resolve(__dirname, 'quote.html'), 'utf8')
  const customerName = data.customer.companyName || data.customer.fullName || ''
  const supplierPhonesStr = data.supplier.phones
    .map(phone => formatPhoneCZ(phone))
    .join(' • ')
  // 2. Inject simple fields
  html = html
    .replace('{{logoUrl}}', data.logoUrl)
    .replace('{{code}}', data.code)
    .replace('{{date}}', data.date)
    .replace('{{supplier.companyName}}', data.supplier?.companyName)
    .replace('{{supplier.address}}', data.supplier.address)
    .replace('{{supplier.ico}}', data.supplier.ico)
    .replace('{{supplier.dic}}', data.supplier.dic)
    .replace('{{supplier.phones}}', supplierPhonesStr)
    // customer
    .replace('{{customer.name}}', customerName)
    .replace('{{customer.street}}', data.customer.street || '')
    .replace('{{customer.postalCode}}', data.customer.postalCode || '')
    .replace('{{customer.province}}', data.customer.province || '')
    .replace('{{customer.ico}}', data.customer.ico || '')
    .replace('{{customer.dic}}', data.customer.dic || '')

  // helpers
  const fmt = (v: number) =>
    new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2 }).format(v)
  // 5. Inject products
  html = html.replace(
    /{{#each products}}[\s\S]*?{{\/each}}/,
    data.products
      .map(
        p => `
        <tr style="background:#e8f5e9">
          <td>${p.code}</td>
          <td>${p.image ? `<img src="${p.image}" alt="${p.name}" />` : '—'}</td>
          <td>${p.name}</td>
          <td>${p.quantity}</td>
          <td>${fmt(p.unitCost)} Kč</td>
          <td>${fmt(p.total)} Kč</td>
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
        <tr style="background:#e0f2ff">
          <td>—</td>
          <td>${i.image ? `<img src="${i.image}" alt="${i.name}" />` : '—'}</td>
          <td>${i.desc}</td>
          <td>${i.quantity}</td>
          <td>${fmt(i.unitCost)} Kč</td>
          <td>${fmt(i.total)} Kč</td>
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
        <tr style="background:#fff8e1">
          <td>Xăng xe</td>
          <td>—</td>
          <td>Quãng đường: ${f.distance} Km</td>
          <td>${f.distance}</td>
          <td>${fmt(f.unitCost)} Kč</td>
          <td>${fmt(f.total)} Kč</td>
        </tr>`,
      )
      .join(''),
  )

  html = html.replace(
    /{{#shipping}}[\s\S]*?{{\/shipping}}/,
    `
      <tr style="background:#fff3e0">
        <td>${data.shipping.label}</td>
        <td>—</td>
        <td>—</td>
        <td>1</td>
        <td>${fmt(data.shipping.net)} Kč</td>
        <td>${fmt(data.shipping.gross)} Kč</td>
      </tr>
    `,
  )

  // 6. Inject totalPrice
  html = html.replace('{{totalPrice}}', fmt(data.totalPrice))

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
