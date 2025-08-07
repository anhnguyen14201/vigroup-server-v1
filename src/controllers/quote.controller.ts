import expressAsyncHandler from 'express-async-handler'
import { getSignedUrl, uploadPdfBuffer } from '~/configs'
import {
  Infor,
  InforCompany,
  Installation,
  Invoice,
  Language,
  Product,
  User,
  Warranty,
} from '~/models'
import { createInvoicePDF, createQuotePDF } from '~/services'
import { deleteImages, deletePDF, generateQuoteCode } from '~/utils'

//* Tạo báo giá
export const postQuote = expressAsyncHandler(async (req: any, res: any) => {
  const {
    infor: inforPayload = [],
    logoUrl,
    supplier: supplierId,
    customer: customerPayload,
    installations: instPayload = [],
    fuels: fuelsPayload = [],
    products: prodPayload = [],
    shippingCost,
    status,
  } = req.body

  // 1. Lấy supplier và dữ liệu infor/installations/products
  const [supplierDoc, inforDocs, installationDocs, productDocs] =
    await Promise.all([
      InforCompany.findById(supplierId).lean(),
      Infor.find({ _id: { $in: inforPayload.map((i: any) => i._id) } }).lean(),
      Installation.find({
        _id: { $in: instPayload.map((i: any) => i.install) },
      }).lean(),
      Product.find({
        _id: { $in: prodPayload.map((p: any) => p.product) },
      }).lean(),
    ])

  // 2. Xác định customerDoc (ID hoặc object)
  let customerDoc: any
  if (typeof customerPayload === 'string') {
    customerDoc = await User.findById(customerPayload).lean()
  } else {
    customerDoc = { ...customerPayload }
  }

  // 3. Map infor, address, phones
  const infor = inforPayload.map((item: any) => {
    const doc = inforDocs.find(d => d._id.toString() === item._id)
    return { ...doc }
  })
  const addressItem = infor.find((i: any) => i.inforType === 'address')
  const address = addressItem?.desc.trim() ?? ''
  const phoneItems = infor
    .filter((i: any) => i.inforType === 'phone')
    .sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime())
  const phone = phoneItems.slice(-2).map((i: any) => i.desc.trim())

  // 4. Map installations
  const installations = instPayload.map((item: any) => {
    const doc = installationDocs.find(d => d._id.toString() === item.install)
    const unitNet = doc ? Number(doc.cost) || 0 : 0
    const unitGross = doc
      ? +(unitNet / (1 + (doc.tax ?? 0) / 100)).toFixed(2)
      : 0
    const totalGross = +(unitGross * item.quantity).toFixed(2)
    const totalNet = unitNet * item.quantity
    return {
      install: doc,
      quantity: item.quantity,
      tax: doc?.tax,
      unitGross,
      unitNet,
      totalGross,
      totalNet,
    }
  })

  // 5. Map products
  const products = prodPayload.map((item: any) => {
    const doc = productDocs.find(d => d._id.toString() === item.product)
    const unitNet = doc ? (doc.discount ?? doc.price ?? 0) : 0
    const unitGross = doc
      ? +(unitNet / (1 + (doc.tax ?? 0) / 100)).toFixed(2)
      : 0
    const totalGross = +(unitGross * item.quantity).toFixed(2)
    const totalNet = unitNet * item.quantity
    return {
      product: doc,
      tax: doc?.tax,
      quantity: item.quantity,
      unitGross,
      unitNet,
      totalGross,
      totalNet,
    }
  })

  // 6. Map fuels
  const fuels = fuelsPayload.map((f: any) => {
    const distance = Number(f.distance) || 0
    const tax = Number(f.tax) || 0
    const unitCost = Number(f.unitCost) || 0
    const unitGross = +(unitCost / (1 + tax / 100)).toFixed(2)
    const totalGross = +(unitGross * distance).toFixed(2)
    const total = distance * unitCost
    return { distance, unitCost, total, unitGross, totalGross, tax }
  })

  const SHIPPING_TAX_RATE = 0.21
  const shippingGross = Number(shippingCost) || 0
  const shippingNet = +(shippingGross / (1 + SHIPPING_TAX_RATE)).toFixed(2)
  const shippingTax = +(shippingGross - shippingNet).toFixed(2)

  // 7. Tính tổng giá net
  const totalPrice = [
    ...installations.map((i: any) => i.totalNet),
    ...products.map((p: any) => p.totalNet),
    ...fuels.map((f: any) => f.total),
    shippingGross,
  ].reduce((sum, curr) => sum + curr, 0)

  // 8. Tạo mã, ngày
  let invoiceId = ''
  if (status) invoiceId = await generateQuoteCode(status)
  const now = new Date()
  const formattedDate = now.toISOString().slice(0, 10)
  const formattedToShowDate = now.toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  // 9. Tạo record Invoice
  const quote = await Invoice.create({
    infor,
    logoUrl,
    supplier: supplierId,
    // nếu customerPayload là object, lưu luôn fields dưới schema phù hợp
    customer: typeof customerPayload === 'string' ? customerPayload : undefined,
    personalInfo:
      typeof customerPayload === 'object'
        ? customerPayload.personalInfo
        : undefined,
    companyInfo:
      typeof customerPayload === 'object'
        ? customerPayload.companyInfo
        : undefined,
    installations,
    fuels,
    products,
    totalPrice,
    code: invoiceId,
    date: formattedDate,
    status,
  })

  // 10. Sinh PDF
  const pdfBuffer = await createQuotePDF({
    code: invoiceId,
    logoUrl,
    supplier: {
      ...(supplierDoc as NonNullable<typeof supplierDoc>),
      phones: phone,
      address: address,
    },
    customer: customerDoc,
    shipping: {
      label: 'Shipping',
      net: shippingNet,
      tax: shippingTax,
      gross: shippingGross,
    },
    installations: installations.map((ins: any) => ({
      code: ins.install.code,
      image: ins.install.imageUrls,
      desc: ins.install.translations.find(
        (tr: any) => tr.language.toString() === String(tr.language),
      ).desc,
      quantity: ins.quantity,
      unitCost: ins.unitNet,
      total: ins.totalNet,
    })),
    fuels,
    products: products.map((p: any) => ({
      code: p.product.code,
      image: p.product.thumbnailUrls,
      name: p.product.translations.find(
        (tr: any) => tr.language.toString() === String(tr.language),
      ).productName,
      quantity: p.quantity,
      unitCost: p.unitNet,
      total: p.totalNet,
    })),
    totalPrice,
    date: formattedToShowDate,
  })

  // 11. Upload và tạo warranty
  const publicId = `quotes/${invoiceId}-${Date.now()}`
  await uploadPdfBuffer(pdfBuffer, publicId)
  const signedUrl = getSignedUrl(publicId)
  quote.pdfUrl = signedUrl

  if (status) {
    const warranty = await Warranty.create({
      invoice: quote._id,
      startDate: new Date(),
    })
    quote.warranty = warranty._id
  }

  if (status) {
    const updatePromises = prodPayload.map((item: any) => {
      const productId = item.product
      const qtySold = item.quantity
      return Product.findByIdAndUpdate(
        productId,
        {
          $inc: {
            quantity: -qtySold, // giảm tồn kho
            sold: qtySold, // tăng số lượng bán
          },
        },
        { new: true },
      )
    })
    await Promise.all(updatePromises)
  }
  await quote.save()

  return res.status(200).json({
    code: invoiceId,
    date: now.toISOString(),
    pdfUrl: signedUrl,
    totalPrice,
  })
})

//* Tạo hóa đơn
export const postInvoice = expressAsyncHandler(async (req: any, res: any) => {
  const {
    infor: inforPayload = [],
    logoUrl,
    supplier: supplierId,
    customer: customerPayload,
    installations: instPayload = [],
    fuels: fuelsPayload = [],
    products: prodPayload = [],
    shippingCost: shippingGross,
    status,
    statusPayment,
  } = req.body

  // 1. Lấy tài liệu từ DB (supplier, infor, installation, product)
  const [supplierDoc, inforDocs, installationDocs, productDocs] =
    await Promise.all([
      InforCompany.findById(supplierId).lean(),
      Infor.find({ _id: { $in: inforPayload.map((i: any) => i._id) } }).lean(),
      Installation.find({
        _id: { $in: instPayload.map((i: any) => i.install) },
      }).lean(),
      Product.find({
        _id: { $in: prodPayload.map((p: any) => p.product) },
      }).lean(),
    ])

  // 2. Xác định customerDoc: nếu payload là string => fetch User, nếu object => dùng luôn
  let customerDoc: any
  if (typeof customerPayload === 'string') {
    customerDoc = await User.findById(customerPayload).lean()
  } else {
    customerDoc = { ...customerPayload }
  }

  // 3. Map infor, lấy address, phones
  const infor = inforPayload.map((item: any) => {
    const doc = inforDocs.find(d => d._id.toString() === item._id)
    return { ...doc }
  })

  // 4. Map installations
  const installations = instPayload.map((item: any) => {
    const doc = installationDocs.find(d => d._id.toString() === item.install)
    const unitNet = doc ? Number(doc.cost) || 0 : 0
    const unitGross = doc
      ? +(unitNet / (1 + (doc.tax ?? 0) / 100)).toFixed(2)
      : 0
    const totalGross = +(unitGross * item.quantity).toFixed(2)
    const totalNet = unitNet * item.quantity
    return {
      install: doc,
      quantity: item.quantity,
      tax: doc?.tax,
      unitGross,
      unitNet,
      totalGross,
      totalNet,
    }
  })

  // 5. Map products
  const products = prodPayload.map((item: any) => {
    const doc = productDocs.find(d => d._id.toString() === item.product)
    const unitNet = doc ? (doc.discount ?? doc.price ?? 0) : 0
    const unitGross = doc
      ? +(unitNet / (1 + (doc.tax ?? 0) / 100)).toFixed(2)
      : 0
    const totalGross = +(unitGross * item.quantity).toFixed(2)
    const totalNet = unitNet * item.quantity
    return {
      product: doc,
      tax: doc?.tax,
      quantity: item.quantity,
      unitGross,
      unitNet,
      totalGross,
      totalNet,
    }
  })

  // 6. Map fuels
  const fuels = fuelsPayload.map((f: any) => {
    const distance = Number(f.distance) || 0
    const tax = Number(f.tax) || 0
    const unitNet = Number(f.unitCost) || 0
    const unitGross = +(unitNet / (1 + tax / 100)).toFixed(2)
    const totalGross = +(unitGross * distance).toFixed(2)
    const totalNet = distance * unitNet
    return { distance, unitNet, totalNet, unitGross, totalGross, tax }
  })
  const TAX_RATE = 0.21
  const shippingNet = shippingGross
    ? Math.round((shippingGross / (1 + TAX_RATE)) * 100) / 100
    : 0
  // 7. Tính totalPrice và phân tích thuế
  const round2 = (v: number) => Math.round(v * 100) / 100
  const allLines = [
    ...installations.map((i: any) => ({
      totalNet: i.totalNet,
      totalGross: i.totalGross,
      tax: i.tax,
    })),
    ...products.map((p: any) => ({
      totalNet: p.totalNet,
      totalGross: p.totalGross,
      tax: p.tax,
    })),
    ...fuels.map((f: any) => ({
      totalNet: f.totalNet,
      totalGross: f.totalGross,
      tax: f.tax,
    })),
    {
      totalNet: shippingGross || 0,
      totalGross: shippingNet || 0,
      tax: 21,
    },
  ]

  const totalPrice = round2(allLines.reduce((sum, l) => sum + l.totalNet, 0))
  const taxRates = Array.from(new Set(allLines.map(l => l.tax)))
  const netByTaxRate: Record<number, number> = {}
  const grossByTaxRate: Record<number, number> = {}
  const DPH: Record<number, number> = {}
  taxRates.forEach(rate => {
    netByTaxRate[rate] = round2(
      allLines.filter(l => l.tax === rate).reduce((s, l) => s + l.totalNet, 0),
    )
    grossByTaxRate[rate] = round2(
      allLines
        .filter(l => l.tax === rate)
        .reduce((s, l) => s + l.totalGross, 0),
    )
    DPH[rate] = round2(netByTaxRate[rate] - grossByTaxRate[rate])
  })

  // 8. Tạo invoiceId, dueDate
  let invoiceId = ''
  let variableSymbol = ''
  if (status) {
    invoiceId = await generateQuoteCode(status)
    variableSymbol = invoiceId.replace(/^[A-Za-z]+/, '').replace(/-/g, '')
  }

  const now = new Date()
  const formattedDate = now.toISOString().slice(0, 10)
  const formattedToShowDate = now.toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const dueDate = new Date(
    now.getTime() + 5 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  // 9. Tạo record Invoice
  const invoice = await Invoice.create({
    infor,
    logoUrl,
    supplier: supplierId,
    customer: typeof customerPayload === 'string' ? customerPayload : undefined,
    personalInfo:
      typeof customerPayload === 'object'
        ? customerPayload.personalInfo
        : undefined,
    companyInfo:
      typeof customerPayload === 'object'
        ? customerPayload.companyInfo
        : undefined,
    installations,
    fuels,
    products,
    totalPrice,
    code: invoiceId,
    date: formattedDate,
    status,
    statusPayment,
  })

  // 10. Sinh PDF hóa đơn
  const pdfBuffer = await createInvoicePDF({
    code: invoiceId,
    logoUrl,
    statusPayment,
    supplier: {
      ...(supplierDoc as NonNullable<any>),
      address: supplierDoc?.address ?? '',
      bankAccount: supplierDoc?.bankAccount ?? '',
      imageUrls: supplierDoc?.imageUrls[0],
    },

    shipping: {
      label: 'Shipping',
      net: shippingNet,
      tax: 21,
      gross: shippingGross || 0,
    },

    customer: customerDoc,
    installations: installations.map((ins: any) => ({
      code: ins.install.code,
      image: ins.install.imageUrls,
      desc:
        ins.install.translations.find(
          (tr: any) => tr.language.toString() === '684062fed02c80cef15fdaf9',
        )?.desc || ins.install.code,
      quantity: ins.quantity,
      unitNet: ins.unitNet,
      unitGross: ins.unitGross,
      totalNet: ins.totalNet,
      totalGross: ins.totalGross,
      tax: ins.tax,
    })),
    fuels,
    products: products.map((p: any) => ({
      code: p.product.code,
      image: p.product.thumbnailUrls,
      name:
        p.product.translations.find(
          (tr: any) => tr.language.toString() === '684062fed02c80cef15fdaf9',
        )?.productName || p.product.code,
      quantity: p.quantity,
      unitNet: p.unitNet,
      unitGross: p.unitGross,
      totalNet: p.totalNet,
      totalGross: p.totalGross,
      tax: p.tax,
    })),
    totalPrice,
    date: formattedToShowDate,
    dueDate,
    taxRates,
    grossByTaxRate,
    DPH,
    variableSymbol,
  })

  if (status) {
    const updatePromises = prodPayload.map((item: any) => {
      const productId = item.product
      const qtySold = item.quantity
      return Product.findByIdAndUpdate(
        productId,
        {
          $inc: {
            quantity: -qtySold, // giảm tồn kho
            sold: qtySold, // tăng số lượng bán
          },
        },
        { new: true },
      )
    })
    await Promise.all(updatePromises)
  }

  // 11. Upload PDF và tạo warranty
  const publicId = `invoices/${invoiceId}-${Date.now()}`
  await uploadPdfBuffer(pdfBuffer, publicId)
  const signedUrl = getSignedUrl(publicId)
  invoice.pdfUrl = signedUrl
  const warranty = await Warranty.create({
    invoice: invoice._id,
    startDate: new Date(),
  })
  invoice.warranty = warranty._id
  await invoice.save()

  // 12. Trả về client
  return res.status(200).json({
    code: invoiceId,
    date: now.toISOString(),
    pdfUrl: signedUrl,
    totalPrice,
  })
})

//* Sửa hóa đơn
export const upsertQuote = expressAsyncHandler(async (req: any, res: any) => {
  const { id } = req.params // nếu gọi PATCH /api/quotes/:id
  const data = req.body as any // supplier, customer, installations, fuels, products, totalPrice, status

  // 1. Xác định status và code
  const status = data.status
  // Nếu tạo mới, auto sinh code; nếu cập nhật, giữ code hoặc regenerate nếu status thay đổi
  let code: string
  let quote: any

  quote = await Invoice.findById(id)
  if (!quote)
    return res.status(404).json({ message: 'Không tìm thấy báo giá.' })

  // Nếu status thay đổi hoặc chưa có code, sinh lại
  if (quote.status !== status || !quote.code) {
    code = await generateQuoteCode(status)
  } else {
    code = quote.code
  }

  const now = new Date()
  const formattedDate = now.toLocaleDateString('cs-CZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  // Cập nhật các trường
  quote.code = code
  quote.date = formattedDate
  quote.status = status
  quote.supplier = data.supplier
  quote.customer = data.customer
  quote.installations = data.installations || []
  quote.fuels = data.fuels || []
  quote.products = data.products || []
  quote.totalPrice = data.totalPrice
  // date giữ nguyên nếu bạn không muốn thay đổi create-date
  await deleteImages(quote.pdfUrl)
  // 2. Tạo / cập nhật PDF
  // Gọi createInvoicePDF với date từ quote.date
  /*   const pdfBuffer = await createInvoicePDF({
    logoUrl: data.logoUrl,
    date: (quote.date as Date).toLocaleDateString('vi-VN'),
    supplier: quote.supplier,
    customer: quote.customer,
    installations: quote.installations,
    fuels: quote.fuels,
    products: quote.products,
    totalPrice: quote.totalPrice,
  })

  const publicId = `${status}/${code}-${Date.now()}`
  await uploadPdfBuffer(pdfBuffer, publicId)
  const signedUrl = getSignedUrl(publicId)

  // 3. Lưu pdfUrl và save quote
  quote.pdfUrl = signedUrl
  await quote.save() */

  // 4. Kết quả
  return res.status(200).json({
    id: quote._id,
    code: quote.code,
    status: quote.status,
    date: quote.date,
    pdfUrl: quote.pdfUrl,
  })
})

//* Xóa hóa đơn
export const deleteQuote = expressAsyncHandler(async (req: any, res: any) => {
  const { id } = req.params

  const quote = await Invoice.findById(id)
  if (!quote) {
    return res.status(404).json({ message: 'Không tìm thấy báo giá.' })
  }
  // 1. Tìm báo giá

  if (quote && quote.pdfUrl && quote.pdfUrl.length > 0) {
    await deletePDF(quote.pdfUrl as any)
  }

  if (!quote) {
    return res.status(404).json({ message: 'Không tìm thấy báo giá.' })
  }

  await Invoice.findByIdAndDelete(id)
  await Warranty.deleteMany({ invoice: id })

  // 3. Xóa document báo giá

  // 4. Trả về 204 No Content
  return res.status(204).end()
})

//* Lấy hóa đơn
export const getAllInvoices = expressAsyncHandler(
  async (req: any, res: any) => {
    const queries = { ...req.query }
    const excludeFields = [
      'limit',
      'page',
      'sort',
      'fields',
      'searchTerm',
      'code',
    ]
    excludeFields.forEach(field => delete queries[field])

    // Chuyển đổi các toán tử so sánh
    let filters: any = {}
    if (Object.keys(queries).length) {
      let queryStr = JSON.stringify(queries)
      queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, m => `$${m}`)
      filters = JSON.parse(queryStr)
    }

    // Tìm kiếm theo mã hóa đơn (code)
    if (req.query.searchTerm || req.query.code) {
      const term = req.query.code || req.query.searchTerm
      filters.code = { $regex: new RegExp(term as string, 'i') }
    }

    // Tạo query với populate
    let q = Invoice.find(filters)
      .populate('customer')
      .populate('warranty') // warranty có virtual currentStatus
      .populate('fuels')
      .populate({
        path: 'products.product',
        populate: { path: 'translations.language' },
      })
      .populate({
        path: 'installations.install',
        populate: { path: 'translations.language' },
      })

    // Sắp xếp
    if (typeof req.query.sort === 'string') {
      q = q.sort(req.query.sort.split(',').join(' '))
    } else {
      q = q.sort('-createdAt')
    }

    // Chọn trường
    if (typeof req.query.fields === 'string') {
      q = q.select(req.query.fields.split(',').join(' '))
    }

    // Phân trang
    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const limit = Math.max(1, parseInt(req.query.limit || '10', 10))
    const skip = (page - 1) * limit
    q = q.skip(skip).limit(limit)

    // Thực thi query và đếm tổng
    const [invoices, counts] = await Promise.all([
      q.exec(), // Mongoose Documents
      Invoice.countDocuments(filters),
    ])

    // Map sang plain objects, include virtuals và override status
    const invoicesData = invoices.map(inv => {
      // toObject({ virtuals: true }) để lấy currentStatus
      const obj = inv.toObject({ virtuals: true })
      if (
        obj.warranty &&
        typeof obj.warranty === 'object' &&
        'currentStatus' in obj.warranty
      ) {
        ;(obj.warranty as any).status = obj.warranty.currentStatus
        // (nếu không muốn trả về currentStatus nữa, có thể delete obj.warranty.currentStatus)
      }
      return obj
    })

    // Trả về kết quả
    return res.json({
      success: true,
      totalItems: counts,
      totalPages: Math.ceil(counts / limit),
      currentPage: page,
      data: invoicesData,
    })
  },
)
