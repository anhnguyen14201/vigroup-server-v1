import { Request, Response } from 'express'
import expressAsyncHandler from 'express-async-handler'
import mongoose from 'mongoose'
import { IUser } from '~/interface/index.js'
import { Order, Product, User } from '~/models/index.js'

import { sendEmail } from '~/utils/index.js'

interface CartItemPayload {
  productId: string
  quantity: number
  _id?: string
}

interface ShippingCosts {
  [key: string]: number
}

const shippingCosts: ShippingCosts = {
  PICKUP: 0,
  PPL: 500,
  GLS: 500,
  DPD: 500,
  GEIS: 500,
}

//*tạo order
export const createOrder = expressAsyncHandler(async (req: any, res: any) => {
  const {
    shippingMethod,
    cartItems,
    _id,
    personalInfo: bodyPersonal,
    companyInfo: bodyCompany,
  }: {
    shippingMethod: string
    cartItems: CartItemPayload[]
    _id: string
    personalInfo: {
      fullName: string
      email: string
      phone: string
      country: string
      street: string
      province: string
      postalCode: string
    }
    companyInfo: {
      companyName?: string
      companyAddress?: string
      dic?: string
      ico?: string
    }
  } = req.body

  let personalInfo = bodyPersonal
  let companyInfo = bodyCompany
  let customerId: string | null = null

  if (_id) {
    // Logged in: fetch user profile
    customerId = _id
    const user = await User.findById(customerId).lean()
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Override personal/company info from user record
    personalInfo = {
      fullName: user.fullName || personalInfo.fullName,
      email: user.email || personalInfo.email,
      phone: user.phone || personalInfo.phone,
      country: user?.country || personalInfo.country,
      street: user?.street || personalInfo.street,
      province: user?.province || personalInfo.province,
      postalCode: user?.postalCode || personalInfo.postalCode,
    }
    companyInfo = {
      companyName: user.companyName || companyInfo.companyName,
      dic: user.dic || companyInfo.dic,
      ico: user.ico || companyInfo.ico,
    }
  }

  // Validate shipping method
  if (!shippingCosts.hasOwnProperty(shippingMethod)) {
    return res.status(400).json({ error: 'Invalid shipping method' })
  }

  // Fetch products from DB
  const productIds = cartItems.map(item => item.productId)
  const productsInDb = await Product.find({ _id: { $in: productIds } }).lean()

  // Calculate total and validate stock
  let total = 0
  for (const item of cartItems) {
    const prod = productsInDb.find(
      (p: any) => p._id.toString() === item.productId,
    )
    if (!prod) {
      return res
        .status(404)
        .json({ error: `Product ${item.productId} not found` })
    }
    if (prod.quantity < item.quantity) {
      return res
        .status(400)
        .json({ error: `Insufficient stock for ${item._id}` })
    }
    const price =
      prod.discount && prod.discount > 0 ? prod.discount : prod.price
    total += price * item.quantity
  }

  // Add shipping cost
  const shippingCost = shippingCosts[shippingMethod]
  // Create order document
  const orderDoc = new Order({
    cartItems: cartItems.map(ci => ({
      productId: ci.productId,
      quantity: ci.quantity,
    })),
    customer: _id,
    personalInfo,
    companyInfo,
    shippingMethod,
    shippingCost,
    total,
  })

  const order = await orderDoc.save()

  const productRows = cartItems
    .map(item => {
      const prod = productsInDb.find(p => p._id.toString() === item.productId)
      if (!prod) return ''
      // English translation
      const enTrans = (prod.translations || []).find(
        (tr: any) => tr.language.toString() === '68406314d02c80cef15fdafb',
      )
      const name =
        enTrans?.productName || prod.translations[0]?.productName || prod.code
      const price =
        prod.discount && prod.discount > 0 ? prod.discount : prod.price
      const subtotal = price * item.quantity
      const imgUrl = prod.thumbnailUrls?.[0] || ''
      return `
      <tr>
        <td><img src="${imgUrl}" alt="${name}" style="width:80px; height:auto;"/></td>
        <td>${name}</td>
        <td class="text-right">${price.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', currencyDisplay: 'narrowSymbol' })} </td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">${subtotal.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', currencyDisplay: 'narrowSymbol' })} </td>
      </tr>
    `
    })
    .join('')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Xác nhận đặt hàng</title>
  <style>
    /* === Reset & Base Styles === */
    body, h1, h2, h3, p, table { margin:0; padding:0; }
    body { background: #f0f2f5; font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; }
    img { border:0; display: block; max-width: 100%; height: auto; }

    /* === Container === */
    .wrapper {
      width:100%; padding: 20px 0;
      background: #f0f2f5;
    }
    .container {
      max-width: 800px; margin: 0 auto;
      background: #fff; border-radius: 8px;
      overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    /* === Header === */
    .header {
      text-align: center; padding: 30px 20px;
      background: #0052cc; color: #fff;
    }
    .header img {
      max-height: 40px; margin-bottom: 16px;
    }
    .header h1 {
      font-size: 24px; font-weight: 300;
    }

    /* === Body === */
    .body { padding: 30px 20px; }
    .greeting { font-size: 16px; line-height: 1.5; margin-bottom: 24px; }
    .section {
      margin-bottom: 24px;
    }
    .section h2 {
      font-size: 14px; text-transform: uppercase;
      color: #0052cc; margin-bottom: 8px; letter-spacing: 0.5px;
    }
    .section p {
      font-size: 14px; line-height: 1.5; color: #555;
    }
    .info-grid {
      display: flex; flex-wrap: wrap; gap: 20px; column-gap: 100px;
    }
    .info-item { flex: 1 1 45%; }

    /* === Order Table === */
    .order-table {
      width: 100%; border-collapse: collapse;
      margin-top: 16px;
    }
    .order-table th, .order-table td {
      padding: 12px; border-bottom: 1px solid #eee;
      text-align: left; font-size: 14px;
    }
    .order-table th {
      background: #f7f9fc; font-weight: 600; color: #333;
    }
    .order-table tr:last-child td {
      border-bottom: none;
    }

    /* === Summary === */
    .summary {
      margin-top: 16px; text-align: right;
      font-size: 14px; line-height: 1.5;
    }
    .summary .total {
      font-weight: 600; font-size: 16px; color: #000;
    }

    /* === Button === */
    .btn {
      display: inline-block; margin-top: 20px;
      padding: 12px 24px; background: #ff6347; color: #fff;
      text-decoration: none; border-radius: 4px;
      font-size: 14px; font-weight: 500;
    }

    /* === Footer === */
    .footer {
      background: #f7f9fc; padding: 20px;
      text-align: center; font-size: 12px; color: #777;
    }

    @media (max-width: 800px) {
      .info-grid { flex-direction: column; }
      .info-item { flex: 1 1 100%; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <!-- <img src="https://yourdomain.com/logo.png" alt="${companyInfo.companyName} Logo"/> -->
        <h1>Cảm ơn Quý khách đã đặt hàng!</h1>
      </div>

      <!-- Body -->
      <div class="body">
        <p class="greeting">
          Xin Chào! ${personalInfo.fullName},<br>
          Chúng tôi rất vui thông báo rằng đã nhận được đơn hàng của bạn. Thông tin chi tiết như sau:
        </p>

        <!-- Billing & Shipping Info -->
        <div class="section">
          <h2>Chi tiết đơn hàng</h2>
          <div class="info-grid">
            <div class="info-item">
              <h3>Thông tin khách hàng</h3>
              <p>
                ${personalInfo.fullName}<br>
                ${personalInfo.email}<br>
                ${personalInfo.phone}
              </p>
            </div>
            <div class="info-item">
              <h3>Địa chỉ nhận hàng</h3>
              <p>
                ${personalInfo.street}<br>
                ${personalInfo.postalCode} ${personalInfo.province}<br>
                ${personalInfo.country}
              </p>
            </div>
          </div>
        </div>

        <!-- Shipping Method -->
        <div class="section">
          <h2>Phương thức vận chuyển</h2>
          <p>
            ${shippingMethod}<br>
            Phí dịch vụ: ${shippingCost.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', currencyDisplay: 'narrowSymbol' })}
          </p>
        </div>

        <!-- Products Table -->
        <div class="section">
          <h2>Các sản phẩm trong đơn hàng của bạn</h2>
          <table class="order-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Tên sản phẩm</th>
                <th>Giá bán</th>
                <th>Số lượng</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              ${productRows}
            </tbody>
          </table>
        </div>

        <!-- Summary & Button -->
        <div class="summary">
          <p>Tổng: ${total.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', currencyDisplay: 'narrowSymbol' })}</p>
          <p>Phí vận chuyển: ${shippingCost.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', currencyDisplay: 'narrowSymbol' })}</p>
          <p class="total">Thành tiền: ${(total + shippingCost).toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', currencyDisplay: 'narrowSymbol' })}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        Questions? Contact us at <a href="mailto:info@vigroup.cz">info@vigroup.cz</a>.<br>
        © ${new Date().getFullYear()} Vigroup. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>


`

  // Send confirmation email
  try {
    await sendEmail({
      email: personalInfo.email,
      subject: 'Xác nhận đặt hàng',
      html,
    })
  } catch (emailErr) {
    console.error('Email sending failed:', emailErr)
    // Continue anyway
  }

  res.status(201).json({ success: true, orderId: order._id })
})

export const getOrders = expressAsyncHandler(async (req: any, res: any) => {
  // 1. User & Role check for advanced filters
  const user = req.user as IUser | undefined
  const adminRoles = [3515, 1413914, 1311417518]
  const isAdmin = user ? adminRoles.includes(user.role) : false

  // 2. Base filter: non-admins only see their own orders
  const baseFilter: Record<string, any> = isAdmin ? {} : { customer: user?._id }

  // 3. Clone and remove pagination/sort limit fields
  const queries = { ...req.query }
  const excludeFields = [
    'limit',
    'sort',
    'page',
    'fields',
    'value',
    'userId',
    'searchTerm',
  ]
  excludeFields.forEach(field => delete queries[field])

  // 4. Convert operators to Mongo syntax
  let filterStr = JSON.stringify(queries)
  filterStr = filterStr.replace(/\b(gte|gt|lt|lte)\b/g, match => `$${match}`)
  let filters: Record<string, any> = JSON.parse(filterStr)

  if (req.query.userId) {
    filters.customer = req.query.userId
  }

  // 5. Search by order ID or customer name
  if (req.query.searchTerm) {
    const term = req.query.searchTerm as string
    // Attempt to match ObjectId or text
    const orConditions: any[] = []
    if (mongoose.Types.ObjectId.isValid(term)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(term) })
    }
    orConditions.push({
      'personalInfo.fullName': { $regex: term, $options: 'i' },
    })
    filters = { ...filters, $or: orConditions }
  }

  // 6. Merge baseFilter + dynamic filters
  const finalFilter = { ...baseFilter, ...filters }

  // 7. Build mongoose query
  let queryCommand = Order.find(finalFilter)
    .populate({
      path: 'cartItems.productId',
      select: 'translations price discount thumbnailUrls',
    })
    .populate({
      path: 'customer',
      select: 'fullName email address province postalCode phone',
    })

  // 8. Sorting
  if (typeof req.query.sort === 'string') {
    const sortBy = req.query.sort.split(',').join(' ')
    queryCommand = queryCommand.sort(sortBy)
  } else {
    queryCommand = queryCommand.sort('-createdAt')
  }

  // 9. Field limiting
  if (typeof req.query.fields === 'string') {
    const fields = req.query.fields.split(',').join(' ')
    queryCommand = queryCommand.select(fields)
  }

  // 10. Pagination
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10)
  const skip = (page - 1) * limit
  queryCommand = queryCommand.skip(skip).limit(limit)

  // 11. Execute & count
  const orders = await queryCommand.exec()
  const totalItems = await Order.countDocuments(finalFilter)

  // 12. Respond
  res.status(200).json({
    success: true,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    currentPage: page,
    data: orders,
  })
})

export const getOrderById = expressAsyncHandler(async (req: any, res: any) => {
  const { id } = req.params

  // Tìm theo ID, đổ đầy các relation
  const order = await Order.findById(id)
    .populate({
      path: 'cartItems.productId',
      select: 'translations price discount thumbnailUrls',
    })
    .populate({
      path: 'customer',
      select: 'fullName email street province postalCode phone country',
    })
    .exec()

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' })
  }

  res.status(200).json({
    success: true,
    data: order,
  })
})

export function getOrderConfirmationEmail(data: {
  personalInfo: {
    fullName: string
    email: string
    phone: string
    street: string
    postalCode: string
    province: string
    country: string
  }
  shippingMethod: string
  shippingCost: number
  productRowsHtml: string // chuỗi <tr>…</tr> đã build
  subtotal: number
  total: number
  companyName: string
}): { subject: string; html: string } {
  const {
    personalInfo,
    shippingMethod,
    shippingCost,
    productRowsHtml,
    subtotal,
    total,
    companyName,
  } = data

  const subCzk = (v: number) =>
    v.toLocaleString('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      currencyDisplay: 'narrowSymbol',
    })

  const subject = `Chúng tôi xin thông báo: đơn hàng của Quý khách tại ${companyName} đã được xác nhận.`

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Đơn hàng của Quý khách đã được xác nhận!</title>
  <style>
    body, h1, p, table { margin:0; padding:0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width:800px; margin:20px auto; background:#fff; border-radius:6px; overflow:hidden; }
    .header { background:#28a745; color:#fff; text-align:center; padding:20px; }
    .header h1 { font-weight:400; font-size:24px; }
    .body { padding:20px; }
    .body p { margin-bottom:16px; font-size:14px; line-height:1.5; }
    .section h2 { font-size:16px; margin-bottom:8px; color:#28a745; }
    .info { margin-bottom:20px; }
    .info div { margin-bottom:12px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    th, td { border:1px solid #ddd; padding:8px; text-align:left; font-size:14px; }
    th { background:#f0f0f0; }
    .summary { text-align:right; font-size:14px; line-height:1.5; }
    .summary .total { font-weight:600; font-size:16px; margin-top:8px; }
    .footer { background:#f0f0f0; text-align:center; padding:12px; font-size:12px; color:#666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Đơn hàng của Quý khách đã được xác nhận!</h1>
    </div>
    <div class="body">
      <p>Xin Chào! <strong>${personalInfo.fullName}</strong>,</p>
      <p>Cảm ơn bạn đã tin tưởng chúng tôi ${companyName}! Chúng tôi vô cùng hân hạnh xác nhận rằng đơn hàng của Quý khách đã được tiếp nhận thành công và hiện đang được xử lý. Xin mời xem thông tin chi tiết bên dưới.</p>

      <div class="info">
        <div>
          <h2>Thông tin chi tiết vận chuyển</h2>
          <p>Người nhận: ${personalInfo.fullName}</p> 
          <p>Số điện thoại: ${personalInfo.phone}</p> 
          <p>Địa chỉ: ${personalInfo.street}, ${personalInfo.postalCode} ${personalInfo.province}, ${personalInfo.country}</p>
        </div>
        <div>
          <h2>Phương thức vận chuyển</h2>
          <p>${shippingMethod} — Phí dịch vụ: ${subCzk(shippingCost)}</p> 
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Ảnh</th>
            <th>Tên sản phẩm</th>
            <th>Giá</th>
            <th>Số lượng</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${productRowsHtml}
        </tbody>
      </table>

      <div class="summary">
        <div>Tổng: ${subCzk(subtotal)}</div>
        <div>Phí vận chuyển: ${subCzk(shippingCost)}</div>
        <div class="total">Thành tiền: ${subCzk(total + shippingCost)}</div>
      </div>
    </div>
    <div class="footer">
      If you have any questions, just reply to this email or contact our support team. We’re here to help!<br>
      Warm regards, <br>
      The ${companyName} Team
    </div>
  </div>
</body>
</html>

`
  return { subject, html }
}

export function getOrderCancelledEmail(data: {
  personalInfo: {
    fullName: string
    email: string
  }
  orderId: string
  companyName: string
}): { subject: string; html: string } {
  const { personalInfo, orderId, companyName } = data

  const subject = `Chúng tôi xin thông báo: đơn hàng của Quý khách tại ${companyName} đã bị hủy.`

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Chúng tôi xin thông báo đơn hàng của bạn đã bị hủy.</title>
  <style>
    body, h1, p { margin:0; padding:0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width:800px; margin:20px auto; background:#fff; border-radius:6px; overflow:hidden; }
    .header { background:#dc3545; color:#fff; text-align:center; padding:20px; }
    .header h1 { font-weight:400; font-size:24px; }
    .body { padding:20px; }
    .body p { margin-bottom:16px; font-size:14px; line-height:1.6; }
    .footer { background:#f0f0f0; text-align:center; padding:12px; font-size:12px; color:#666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Đơn hàng đã bị hủy</h1>
    </div>
    <div class="body">
      <p>Xin Chào! <strong>${personalInfo.fullName}</strong>,</p>
      <p>Chúng tôi rất tiếc phải thông báo rằng đơn hàng của bạn <strong>#${orderId}</strong> đã bị hủy.  </p>
      <p>Quý khách yên tâm, các sản phẩm đã được đặt trước đã được trả về kho và không có phí nào được tính thêm.</p>
      <p>Nếu Quý khách có bất kỳ thắc mắc hoặc cần đặt đơn hàng mới, chúng tôi luôn sẵn lòng hỗ trợ!</p>
    </div>
    <div class="footer">
      Xin cảm ơn Quý khách đã cân nhắc ${companyName}.<br/>
      Xin vui lòng liên hệ bất kỳ lúc nào nếu Quý khách cần hỗ trợ.
    </div>
  </div>
</body>
</html>

`
  return { subject, html }
}

/**
 * @desc    Cập nhật trạng thái đơn hàng
 * @route   PUT /api/orders/status
 * @access  Private/Admin
 */
export const updateOrderStatus = expressAsyncHandler(
  async (req: any, res: any) => {
    const { orderId, status } = req.body

    // Tìm đơn hàng và populate thông tin sản phẩm
    const order = await Order.findById(orderId)
      .populate('cartItems.productId')
      .exec()

    if (!order) {
      return res.status(404).json({ message: 'Order không tồn tại' })
    }

    // Kiểm tra thông tin khách hàng
    const personalInfo = order.personalInfo
    if (!personalInfo?.fullName || !personalInfo?.email) {
      return res
        .status(400)
        .json({ message: 'Thông tin khách hàng không đầy đủ' })
    }

    const totalAmount = order.total ?? 0

    // Cập nhật trạng thái và shippingDate nếu chuyển thành Successed
    order.status = status
    if (status === 'Successed') {
      order.shippingDate = new Date()
    }
    await order.save()

    // Xử lý tồn kho và email
    if (status === 'Cancelled') {
      // hoàn trả tồn kho
      await Promise.all(
        order.cartItems.map(async item => {
          const prod = item.productId as any
          const product = await Product.findById(prod._id)
          if (product) {
            product.quantity += item.quantity
            product.sold -= item.quantity
            await product.save()
          }
        }),
      )

      // Gửi mail hủy đơn
      const { subject, html } = getOrderCancelledEmail({
        personalInfo: {
          fullName: personalInfo.fullName,
          email: personalInfo.email,
        },
        orderId: order._id.toString(),
        companyName: process.env.COMPANY_NAME || 'Vigroup',
      })
      await sendEmail({ email: personalInfo.email, subject, html })
    }

    if (status === 'Successed') {
      // Kiểm tra đủ tồn kho
      for (const item of order.cartItems) {
        const prod = item.productId as any
        const product = await Product.findById(prod._id)
        if (!product) {
          return res
            .status(404)
            .json({ message: `Sản phẩm ${prod._id} không tìm thấy` })
        }
        if (product.quantity < item.quantity) {
          return res
            .status(400)
            .json({ message: `Không đủ số lượng cho sản phẩm ${product._id}` })
        }
      }

      // Build productRowsHtml và các số liệu
      const productRowsHtml = order.cartItems
        .map(item => {
          const prod = item.productId as any

          const enTrans = (prod.translations || []).find(
            (tr: any) => tr.language.toString() === '68406314d02c80cef15fdafb',
          )
          const name =
            enTrans?.productName ||
            prod.translations[0]?.productName ||
            prod.code
          const price =
            prod.discount && prod.discount > 0 ? prod.discount : prod.price
          const subtotal = price * item.quantity
          const imgUrl = prod.thumbnailUrls?.[0] || ''
          return `
                <tr>
                  <td><img src="${imgUrl}" alt="${name}" style="width:80px; height:auto;"/></td>
                  <td>${name}</td>
                  <td class="text-right">${price.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', currencyDisplay: 'narrowSymbol' })} </td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">${subtotal.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', currencyDisplay: 'narrowSymbol' })} </td>
                </tr>
              `
        })
        .join('')

      const { subject, html } = getOrderConfirmationEmail({
        personalInfo: {
          fullName: personalInfo.fullName,
          email: personalInfo.email,
          phone: personalInfo.phone || '',
          street: personalInfo.street || '',
          postalCode: personalInfo.postalCode || '',
          province: personalInfo.province || '',
          country: personalInfo.country || '',
        },
        shippingMethod: order.shippingMethod,
        shippingCost: order.shippingCost || 0,
        productRowsHtml,
        subtotal: totalAmount,
        total: totalAmount,
        companyName: process.env.COMPANY_NAME || 'Vigroup',
      })
      await sendEmail({ email: personalInfo.email, subject, html })
    }

    return res.status(200).json({ success: true, order })
  },
)

export const updateOrderPdf = expressAsyncHandler(
  async (req: any, res: any) => {
    const { id } = req.params
    const { pdfUrl } = req.body

    if (!pdfUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing pdfUrl in request body',
      })
    }

    // Cập nhật trường pdfUrl
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { $set: { pdfUrl } },
      { new: true }, // trả về document sau khi update
    )
      .populate({
        path: 'cartItems.productId',
        select: 'translations price discount thumbnailUrls',
      })
      .populate({
        path: 'customer',
        select: 'fullName email street province postalCode phone country',
      })
      .exec()

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    res.status(200).json({
      success: true,
      data: updatedOrder,
    })
  },
)

// DELETE /api/orders/:id
export const deleteOrder = expressAsyncHandler(async (req: any, res: any) => {
  const { id } = req.params

  const order = await Order.findById(id).exec()
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    })
  }

  await order.deleteOne()

  res.status(200).json({
    success: true,
    message: 'Order deleted successfully',
  })
})

export const getOrderStatisticsByDay = expressAsyncHandler(
  async (req: any, res: any) => {
    const order = await Order.aggregate([
      { $match: { status: 'Successed' } },
      //{ $unwind: '$products' },

      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' },
            day: { $dayOfMonth: '$updatedAt' },
          },

          totalSales: {
            $sum: '$total',
          },

          totalOrders: { $sum: 1 },
          totalProducts: { $sum: '$products.quantity' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
    ])

    return res.status(200).json({
      success: true,
      orderDatas: order,
    })
  },
)

//? Get order statistics by week
export const getOrderStatisticsByWeek = async (req: any, res: any) => {
  try {
    const orders = await Order.aggregate([
      {
        $match: { status: 'Successed' },
      },

      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            week: { $isoWeek: '$updatedAt' },
          },
          totalSales: {
            $sum: '$total',
          },
          totalOrders: { $sum: 1 },
          totalProducts: { $sum: '$products.quantity' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.week': 1 },
      },
    ])

    return res.status(200).json({
      success: true,
      orderDatas: orders,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

//? Get order statistics by month
export const getOrderStatisticsByMonth = async (req: any, res: any) => {
  try {
    const orders = await Order.aggregate([
      {
        $match: { status: 'Successed' },
      },

      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' },
          },
          totalSales: {
            $sum: '$total',
          },
          totalOrders: { $sum: 1 },
          totalProducts: { $sum: '$products.quantity' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ])

    return res.status(200).json({
      success: true,
      orderDatas: orders,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

//? Get order statistics by year
export const getOrderStatisticsByYear = async (req: any, res: any) => {
  try {
    const orders = await Order.aggregate([
      {
        $match: { status: 'Successed' },
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
          },
          totalSales: {
            $sum: '$total',
          },
          totalOrders: { $sum: 1 },
          totalProducts: { $sum: '$products.quantity' },
        },
      },
      {
        $sort: { '_id.year': 1 },
      },
    ])

    return res.status(200).json({
      success: true,
      orderDatas: orders,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}
