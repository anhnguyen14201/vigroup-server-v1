import expressAsyncHandler from 'express-async-handler'
import mongoose from 'mongoose'
import { OrderUpdate } from '~/interface/slide.interface.js'
import { IUser } from '~/interface/user.interface.js'
import { Slide } from '~/models/index.js'
import { deleteImages } from '~/utils/helps.js'

export const createSlide = expressAsyncHandler(async (req, res) => {
  //! Kiểm tra file upload và trường 'icon'
  if (
    !req.files ||
    !(req.files as { [fieldname: string]: Express.Multer.File[] }).image
  ) {
    res.status(400).json({
      success: false,
      message: 'Không có file image được tải lên',
    })
    return
  }

  const translations = JSON.parse(req.body.translations)

  //! Lấy danh sách file icon từ req.files
  const files = (req.files as { [fieldname: string]: Express.Multer.File[] })
    .image
  //! Lấy đường dẫn của từng file icon
  const iconPaths = files.map(file => file.path)

  //! Gán đường dẫn icon vào trường iconUrl của req.body
  req.body.imageUrls = iconPaths

  req.body.translations = translations

  //! Tạo document Language mới với dữ liệu từ req.body
  const newSlide = await Slide.create(req.body)

  res.status(201).json({
    success: !!newSlide,
    data: newSlide,
  })
})

//* Lấy danh sách slide
export const getSlides = expressAsyncHandler(async (req: any, res: any) => {
  // Assume req.user injected by auth middleware
  const user = req.user as IUser | undefined
  const adminRoles = [3515, 1413914, 1311417518]
  const isAdmin = user ? adminRoles.includes(user.role) : false
  const filter = isAdmin ? {} : { activity: true }

  const slides = await Slide.find(filter)

  if (!slides || slides.length === 0) {
    return res
      .status(404)
      .json({ success: false, message: 'Không tìm thấy slide' })
  }

  res.status(200).json({ success: true, data: slides })
})

//* Cập nhật thứ tự slide
export const updateSlideOrder = expressAsyncHandler(async (req, res) => {
  const updates: OrderUpdate[] = req.body

  if (!Array.isArray(updates) || updates.length === 0) {
    res.status(400).json({ message: 'Payload phải là mảng không rỗng.' })
    return
  }

  // Kiểm tra trùng lặp giá trị 'order' trong payload
  const orderSet = new Set<number>()
  for (const u of updates) {
    if (orderSet.has(u.order)) {
      res.status(400).json({ message: `Giá trị order bị trùng: ${u.order}` })
      return
    }
    orderSet.add(u.order)
  }

  // Tạo các thao tác bulkWrite
  const bulkOps = updates.map(u => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(u._id) },
      update: { $set: { order: u.order } },
    },
  }))

  try {
    const result = await Slide.bulkWrite(bulkOps, { ordered: true })

    res.status(200).json({
      message: 'Cập nhật thứ tự thành công',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    })
  } catch (error: any) {
    // Xử lý lỗi trùng lặp giá trị 'order'
    if (error.code === 11000) {
      res.status(409).json({
        message:
          'Lỗi trùng lặp giá trị order. Vui lòng đảm bảo mỗi slide có một giá trị order duy nhất.',
      })
    } else {
      res.status(500).json({
        message: 'Đã xảy ra lỗi khi cập nhật thứ tự slide.',
        error: error.message,
      })
    }
  }
})

//* Cập nhật slide
export const updateSlide = expressAsyncHandler(async (req, res) => {
  // 1. Tìm slide
  const slideId = req.params.slideId
  const existing = await Slide.findById(slideId)
  if (!existing) {
    res.status(404).json({ success: false, message: 'Slide not found' })
    return
  }

  // 2. Lấy mảng file mới (nếu có)
  const files =
    (req.files as { [key: string]: Express.Multer.File[] })?.image || []

  // 3. Xử lý hình ảnh
  if (files.length > 0) {
    // 3.1 Xóa ảnh cũ
    await deleteImages(existing.imageUrls)

    // 3.2 Lấy URL mới
    req.body.imageUrls = files.map(f => f.path)
  }

  // 4. Parse translations
  try {
    req.body.translations = JSON.parse(req.body.translations)
  } catch {
    res
      .status(400)
      .json({ success: false, message: 'Invalid translations format' })
    return
  }

  // 5. Cập nhật slide
  const updated = await Slide.findByIdAndUpdate(slideId, req.body, {
    new: true,
  })
  res.json({ success: true, data: updated })
})

//* Xóa slide
export const deleteSlide = expressAsyncHandler(async (req, res) => {
  const { slideId } = req.params

  if (!slideId) {
    res.status(400).json({ message: 'Thiếu id slide' })
    return
  }

  const slide = await Slide.findByIdAndDelete(slideId)

  if (slide && slide.imageUrls && slide.imageUrls.length > 0) {
    await deleteImages(slide.imageUrls)
  }

  if (!slide) {
    res.status(404).json({ message: 'Không tìm thấy slide' })
    return
  }

  res.status(200).json({
    success: true,
    message: 'Xóa slide thành công',
    data: slide,
  })
})
