// controllers/userController.js
import expressAsyncHandler from 'express-async-handler'
import bcryptjs from 'bcryptjs'
import { IUser } from '~/interface/index.js'
import { Cart, Product, User } from '~/models/index.js'

//* Lấy thông tin người dùng hiện tại theo ID
//* @desc    Get current user
//* @route   GET /api/user/current
export const getUser = expressAsyncHandler(async (req, res) => {
  // Trước hết kiểm tra authentication
  if (!req.user || !req.user._id) {
    res.status(400).json({
      success: false,
      message: 'User is not authenticated',
    })
    return
  }

  const { _id } = req.user

  const data = await User.findById(_id).select(
    '-password -refreshTokens -registerToken -passwordChangedAt ' +
      '-passwordResetToken -passwordResetExpires',
  )

  if (!data) {
    res.status(404).json({
      success: false,
      message: 'User not found',
    })
    return
  }

  const roleMapping = {
    3515: 'CEO',
    1413914: 'Admin',
    1311417518: 'Manager',
    5131612152555: 'Employee',
    32119201513518: 'Customer',
  }
  const userRole = roleMapping[data.role] || 'Unknown'

  res.status(200).json({
    success: true,
    data: {
      ...data.toObject(),
      /*       role: userRole, */
    },
  })
})

//* Lấy danh sách tất cả người dùng với filter, pagination, sorting
//* @desc    Get all users
//* @route   GET /api/user

// Common helper để build filters từ query và quyền của người gọi
function buildBaseFilters(req: any) {
  // Clone và loại bỏ các param không dùng
  const queries = { ...req.query }
  const exclude = ['limit', 'sort', 'page', 'fields', 'searchTerm', 'role']
  exclude.forEach(f => delete queries[f])

  // Chuyển toán tử gte|lte...
  let qs = JSON.stringify(queries)
  qs = qs.replace(/\b(gte|gt|lt|lte)\b/g, m => `$${m}`)
  let filters: any = JSON.parse(qs)

  // Search chung
  if (req.query.searchTerm) {
    const v = req.query.searchTerm as string
    filters.$or = [
      { fullName: { $regex: v, $options: 'i' } },
      { phone: { $regex: v, $options: 'i' } },
      { email: { $regex: v, $options: 'i' } },
    ]
  }

  // Phân quyền: admin cao nhất (1413914) không hạn chế; quản lý (1311417518) không xem admin cao; còn lại chỉ xem khách hàng
  const roleCaller = req.user?.role
  if (roleCaller === 1413914) {
    // no-op
  } else if (roleCaller === 1311417518) {
    filters.role = { ...(filters.role || {}), $nin: [1413914] }
  } else {
    filters.role = 32119201513518
  }

  return filters
}

// Endpoint 1: /api/users/customers
// Lấy riêng khách hàng (role = 32119201513518)
export const getCustomers = expressAsyncHandler(async (req, res) => {
  const filters = buildBaseFilters(req)
  filters.role = 32119201513518

  // Build query với pagination, sort, fields
  let q = User.find(filters)
    .lean<IUser[]>()
    .select(
      '-password -refreshTokens -passwordResetToken -passwordResetExpires',
    )
    .sort({ createdAt: -1 })

  if (typeof req.query.sort === 'string') {
    q = q.sort(req.query.sort.split(',').join(' '))
  }
  if (typeof req.query.fields === 'string') {
    q = q.select((req.query.fields as string).split(',').join(' '))
  }

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10)
  const skip = (page - 1) * limit
  q = q.skip(skip).limit(limit)

  const users = await q
  const counts = await User.countDocuments(filters)
  res.json({
    success: true,
    totalItems: counts,
    totalPages: Math.ceil(counts / limit),
    currentPage: page,
    data: users,
  })
})

// Endpoint 2: /api/users/non-customers
// Lấy users có role ≠ 32119201513518
export const getNonCustomers = expressAsyncHandler(async (req, res) => {
  const filters = buildBaseFilters(req)
  // Thêm điều kiện not-in khách hàng
  const currentRole = req.user?.role ?? 0
  if (currentRole !== 3515) {
    filters.role = {
      ...(filters.role || {}),
      $nin: [3515, 32119201513518],
    }
  } else {
    filters.role = {
      ...(filters.role || {}),
      $nin: [32119201513518],
    }
  }

  let q = User.find(filters)
    .lean<IUser[]>()
    .select(
      '-password -refreshTokens -passwordResetToken -passwordResetExpires',
    )
    .sort({ createdAt: -1 })

  if (typeof req.query.sort === 'string') {
    q = q.sort(req.query.sort.split(',').join(' '))
  }
  if (typeof req.query.fields === 'string') {
    q = q.select((req.query.fields as string).split(',').join(' '))
  }

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10)
  const skip = (page - 1) * limit
  q = q.skip(skip).limit(limit)

  const users = await q
  const counts = await User.countDocuments(filters)
  res.json({
    success: true,
    totalItems: counts,
    totalPages: Math.ceil(counts / limit),
    currentPage: page,
    data: users,
  })
})

//* Chỉnh sửa thông tin người dùng
//* @desc    Update user
//* @route   PUT /api/user/:_id
export const updateUser = expressAsyncHandler(async (req: any, res: any) => {
  const { _id } = req.params
  const currentUser = req.user
    ? { role: req.user.role, _id: req.user._id.toString() }
    : { role: 0, _id: '' }

  if (Object.keys(req.body).length === 0) {
    return res
      .status(400)
      .json({ success: false, message: 'No user data to update' })
  }

  const user = await User.findById(_id)
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }

  // --- Kiểm tra email và điện thoại trùng ---
  const { email, phone } = req.body
  if (email && email !== user.email) {
    const exists = await User.findOne({ email })
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: 'Email đã được tạo nhập email khác' })
    }
  }
  if (phone && phone !== user.phone) {
    const exists = await User.findOne({ phone })
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'Số điện thoại đã được tạo nhập số điện thoại khác',
      })
    }
  }

  const targetRole = user.role
  const currentRole = currentUser.role

  // --- Logic phân quyền ---
  if (currentRole === 3515) {
    // CEO: quyền cập nhật mọi tài khoản
  } else if (currentRole === 1413914) {
    if (
      targetRole === 3515 ||
      (targetRole === 1413914 && user._id.toString() !== currentUser._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Admins cannot update CEO or other Admin accounts',
      })
    }
  } else if (currentRole === 1311417518) {
    if (![32119201513518, 5131612152555].includes(targetRole)) {
      return res.status(403).json({
        success: false,
        message: 'Managers can only update Customer and Employee accounts',
      })
    }
  } else {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to update user',
    })
  }

  // --- Thực hiện cập nhật ---
  const updatedUser = await User.findByIdAndUpdate(_id, req.body, { new: true })

  res.status(200).json({
    success: !!updatedUser,
    data: updatedUser,
  })
})

export const updateByUser = expressAsyncHandler(async (req: any, res: any) => {
  // 1. Bắt buộc phải đăng nhập
  const currentUser = req.user
  if (!currentUser?._id) {
    return res.status(401).json({
      success: false,
      message: 'Bạn cần đăng nhập để thực hiện hành động này.',
    })
  }

  // 2. Chỉ cho phép update chính tài khoản của mình
  const targetId = req.params._id
  if (targetId !== currentUser._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Bạn chỉ được phép cập nhật thông tin tài khoản của chính mình.',
    })
  }

  // 3. Cần ít nhất 1 trường để cập nhật
  if (Object.keys(req.body).length === 0) {
    return res
      .status(400)
      .json({ success: false, message: 'Không có dữ liệu để cập nhật.' })
  }

  // 4. Lấy user từ DB
  const user = await User.findById(targetId)
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy tài khoản người dùng.',
    })
  }

  // 5. Kiểm tra trùng email/phone nếu có gửi lên
  const { email, phone, oldPassword, newPassword } = req.body
  if (email && email !== user.email) {
    const exists = await User.findOne({ email })
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'Email đã tồn tại, vui lòng nhập email khác.',
      })
    }
  }
  if (phone && phone !== user.phone) {
    const exists = await User.findOne({ phone })
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'Số điện thoại đã tồn tại, vui lòng nhập số khác.',
      })
    }
  }

  // 6. Đổi mật khẩu (nếu client gửi oldPassword + newPassword)
  if (oldPassword || newPassword) {
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Cần cung cấp cả mật khẩu cũ và mật khẩu mới.',
      })
    }
    const isMatch = await bcryptjs.compare(oldPassword, user.password)
    if (!isMatch) {
      return res.status(422).json({
        success: false,
        message: 'Mật khẩu cũ không đúng.',
      })
    }
    // Hash mật khẩu mới
    const saltRounds = 10
    user.password = await bcryptjs.hash(newPassword, saltRounds)
  }

  // 7. Cập nhật các trường profile
  user.fullName = req.body.fullName ?? user.fullName
  user.email = req.body.email ?? user.email
  user.phone = req.body.phone ?? user.phone
  user.companyName = req.body.companyName ?? user.companyName
  user.dic = req.body.dic ?? user.dic
  user.ico = req.body.ico ?? user.ico
  user.country = req.body.country ?? user.country
  user.street = req.body.street ?? user.street
  user.province = req.body.province ?? user.province
  user.postalCode = req.body.postalCode ?? user.postalCode

  // 8. Lưu thay đổi
  const updatedUser = await user.save()

  // 9. Trả về dữ liệu (không gửi kèm passwordHash)
  res.status(200).json({
    success: true,
    data: {
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      companyName: updatedUser.companyName,
      dic: updatedUser.dic,
      ico: updatedUser.ico,
      country: updatedUser.country,
      street: updatedUser.street,
      province: updatedUser.province,
      postalCode: updatedUser.postalCode,
    },
  })
})

//* Xóa người dùng
//* @desc    Delete user
//* @route   DELETE /api/user/:id
export const deleteUser = expressAsyncHandler(async (req, res) => {
  const currentUser = req.user
    ? { _id: req.user._id.toString(), role: req.user.role }
    : { _id: '', role: 0 }
  const currentUserId = currentUser._id
  const currentUserRole = currentUser.role
  const userIdToRemove = req.params._id

  // Ngăn chặn người dùng xóa chính mình
  if (currentUserId === userIdToRemove) {
    res.status(403).json({
      success: false,
      message: 'Không thể xóa tài khoản của chính bạn',
    })
    return
  }

  const userToRemove = await User.findById(userIdToRemove)
  if (!userToRemove) {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng',
    })
    return
  }

  const targetRole = userToRemove.role

  // Logic phân quyền
  if (currentUserRole === 3515) {
    // CEO có thể xóa bất kỳ tài khoản nào
  } else if (currentUserRole === 1413914) {
    // Admin không thể xóa CEO hoặc Admin khác
    if (
      targetRole === 3515 ||
      (targetRole === 1413914 && userToRemove._id.toString() !== currentUserId)
    ) {
      res.status(403).json({
        success: false,
        message: 'Admin không thể xóa CEO hoặc Admin khác',
      })
      return
    }
  } else if (currentUserRole === 1311417518) {
    // Manager chỉ có thể xóa Customer và Employee
    if (targetRole !== 32119201513518 && targetRole !== 5131612152555) {
      res.status(403).json({
        success: false,
        message: 'Manager chỉ có thể xóa tài khoản của Customer và Employee',
      })
      return
    }
  } else {
    res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xóa người dùng này',
    })
    return
  }

  const removedUser = await User.findByIdAndDelete(userIdToRemove)
  res.status(200).json({
    success: !!removedUser,
    data: removedUser,
  })
})

//* Cập nhật giỏ hàng của người dùng
//* @desc    Update user cart
//* @route   PUT /api/user/cart

export const updateUserCart = expressAsyncHandler(
  async (req: any, res: any) => {
    const userId = req.user?._id
    const { productId, quantity } = req.body

    if (!userId || !productId || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message:
          'Thiếu thông tin người dùng, sản phẩm hoặc số lượng không hợp lệ',
      })
    }

    // Kiểm tra product tồn tại để lấy giá hiện tại
    const product = await Product.findById(productId).select('price')
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Sản phẩm không tồn tại',
      })
    }

    // Tìm cart item của user cho product đó
    let cartItem = await Cart.findOne({ user: userId, product: productId })

    if (cartItem) {
      // Tăng số lượng và cập nhật priceSnapshot (nếu muốn luôn cập nhật giá mới)
      cartItem.quantity += Number(quantity)
      cartItem.priceSnapshot = product.price
      await cartItem.save()
    } else {
      // Tạo mới cart item
      cartItem = await Cart.create({
        user: userId,
        product: productId,
        quantity: Number(quantity),
        priceSnapshot: product.price,
      })
    }

    // Trả về toàn bộ giỏ hàng mới nhất của user
    const updatedCart = await Cart.find({ user: userId })
      .populate('product', 'name price images') // tuỳ chọn lấy thêm các trường cần thiết
      .lean()

    res.status(200).json({
      success: true,
      cart: updatedCart,
    })
  },
)

//* Xóa sản phẩm khỏi giỏ hàng của người dùng
//* @desc    Remove product from user cart
//* @route   DELETE /api/user/cart/:productId
export const removeProductFromCart = expressAsyncHandler(
  async (req: any, res: any) => {
    const userId = req.user?._id
    const { productId } = req.params

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin người dùng hoặc ID sản phẩm',
      })
    }

    // Xoá luôn document Cart tương ứng
    const deleted = await Cart.findOneAndDelete({
      user: userId,
      product: productId,
    })
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Sản phẩm không tồn tại trong giỏ hàng',
      })
    }

    // Trả về danh sách giỏ hàng còn lại
    const updatedCart = await Cart.find({ user: userId })
      .populate('product', 'name price images')
      .lean()

    res.status(200).json({
      success: true,
      cart: updatedCart,
    })
  },
)

export const getCustomerById = expressAsyncHandler(
  async (req: any, res: any) => {
    const { id } = req.params

    // Bảo mật: chỉ nhân viên, quản lý, admin được truy cập
    // (hoặc bạn có thể kiểm tra role riêng tuỳ stack auth hiện tại)
    // nếu req.user.role không phải admin/employee thì:

    if (![3515, 1413914, 1311417518].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No permission to view user data',
      })
    }

    // Chỉ lấy "customer"
    const user = await User.findOne({ _id: id, role: 5131612152555 }).select(
      '-password ' +
        '-refreshTokens ' +
        '-registerToken ' +
        '-passwordChangedAt ' +
        '-passwordResetToken ' +
        '-passwordResetExpires',
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found or not a customer',
      })
    }

    /*
     * Nếu bạn muốn chuyển roleId thành tên role
     * bạn có thể giữ roleMapping → roleName
     * hoặc hiển thị roleId trực tiếp, tuỳ mục tiêu API
     */
    const roleMapping: Record<number, string> = {
      3515: 'CEO',
      1413914: 'Admin',
      1311417518: 'Manager',
      5131612152555: 'Employee',
      32119201513518: 'Customer',
    }
    const userObj = user.toObject()

    res.status(200).json({
      success: true,
      data: userObj,
    })
  },
)
