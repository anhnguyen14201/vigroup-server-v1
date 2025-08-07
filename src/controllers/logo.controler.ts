import expressAsyncHandler from 'express-async-handler'
import { IUser } from '~/interface/index.js'
import { Logo } from '~/models/index.js'
import { deleteImages } from '~/utils/index.js'

//* Tạo logo
export const createLogo = expressAsyncHandler(async (req, res) => {
  // Kiểm tra xem có file image được tải lên không
  if (
    !req.files ||
    !(req.files as { [fieldname: string]: Express.Multer.File[] }).icon
  ) {
    res.status(400).json({
      success: false,
      message: 'Không có file image được tải lên',
    })
    return
  }

  // Parse dữ liệu translations từ req.body

  // Lấy danh sách file image từ req.files
  const files = (req.files as { [fieldname: string]: Express.Multer.File[] })
    .icon

  const translations = JSON.parse(req.body.translations)

  // Lấy đường dẫn của từng file image
  const imagePaths = files.map(file => file.path)

  // Gán đường dẫn image vào trường imageUrls của req.body
  req.body.imageUrls = imagePaths
  req.body.translations = translations

  // Lấy logoType từ req.body
  const { logoType } = req.body

  // Cập nhật tất cả các logo cùng logoType có activity: true thành activity: false
  await Logo.updateMany(
    { logoType, activity: true },
    { $set: { activity: false } },
  )

  // Tạo document Logo mới với activity: true
  const newSlide = await Logo.create({
    ...req.body,
    activity: true,
  })

  res.status(201).json({
    success: !!newSlide,
    data: newSlide,
  })
})

//* Lấy thông tin logo
export const getLogo = expressAsyncHandler(async (req, res) => {
  const user = req.user as IUser | undefined
  const adminRoles = [3515, 1413914, 1311417518]
  const isAdmin = user ? adminRoles.includes(user.role) : false
  const filter = isAdmin ? {} : { activity: true }
  const logo = await Logo.find(filter).sort({ createdAt: -1 })

  if (!logo) {
    res.status(404).json({ success: false, message: 'Không tìm thấy Logo' })
    return
  }
  res.status(200).json({
    success: true,
    data: logo ? logo : 'Không có logo nào',
  })
})

//* Sửa logo
export const updateLogo = expressAsyncHandler(async (req, res) => {
  const logoId = req.params.logoId
  const existing = await Logo.findById(logoId)
  if (!existing) {
    res.status(404).json({ success: false, message: 'Logo not found' })
    return
  }

  // Parse activity mới (boolean) và logoType mới (string)
  const newActivity =
    typeof req.body.activity !== 'undefined'
      ? JSON.parse(req.body.activity)
      : existing.activity
  const newLogoType = req.body.logoType ?? existing.logoType

  // Xử lý upload file mới
  const files =
    (req.files as { [key: string]: Express.Multer.File[] })?.icon || []
  if (files.length > 0) {
    await deleteImages(existing.imageUrls)
    req.body.imageUrls = files.map(f => f.path)
  }

  try {
    req.body.translations = JSON.parse(req.body.translations)
  } catch {
    res
      .status(400)
      .json({ success: false, message: 'Invalid translations format' })
    return
  }

  // Nếu user bật activity = true cho logo này
  if (newActivity === true) {
    // Tắt hết các logo khác cùng logoType mới
    await Logo.updateMany(
      { logoType: newLogoType, activity: true, _id: { $ne: logoId } },
      { $set: { activity: false } },
    )
  }

  // Cập nhật logo hiện tại với cả activity và logoType mới
  const updated = await Logo.findByIdAndUpdate(
    logoId,
    {
      ...req.body,
      activity: newActivity,
      logoType: newLogoType,
    },
    { new: true },
  )

  res.json({ success: true, data: updated })
})

//* Xóa logo
export const deleteLogo = expressAsyncHandler(async (req, res) => {
  const { logoId } = req.params

  if (!logoId) {
    res.status(400).json({ message: 'Thiếu id slide' })
    return
  }

  const logo = await Logo.findByIdAndDelete(logoId)

  if (logo && logo.imageUrls && logo.imageUrls.length > 0) {
    await deleteImages(logo.imageUrls)
  }

  if (!logo) {
    res.status(404).json({ message: 'Không tìm thấy slide' })
    return
  }

  res.status(200).json({
    success: true,
    message: 'Xóa slide thành công',
    data: logo,
  })
})
