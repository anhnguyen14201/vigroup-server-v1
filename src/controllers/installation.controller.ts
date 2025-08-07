import expressAsyncHandler from 'express-async-handler'
import { Installation } from '~/models'
import { deleteImages } from '~/utils'

//* Tạo thông tin lắp đặt
export const createInstallation = expressAsyncHandler(
  async (req: any, res: any) => {
    // translations phải là JSON string
    if (!req.body.translations) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu dữ liệu translations',
      })
    }

    // Parse translations
    let translations
    try {
      translations = JSON.parse(req.body.translations)
      if (!Array.isArray(translations) || translations.length === 0) {
        throw new Error()
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: 'translations không hợp lệ',
      })
    }

    // Xử lý file icon
    const files = (req.files as { icon?: Express.Multer.File[] })?.icon || []
    const imageUrls = files.map(f => f.path)

    // Tạo document
    const newInstall = await Installation.create({
      translations,
      cost: req.body.cost,
      tax: req.body.tax,
      imageUrls,
    })

    res.status(201).json({
      success: true,
      data: newInstall,
    })
  },
)

//* Lấy danh sách
export const getInstallation = expressAsyncHandler(async (_req, res) => {
  const installs = await Installation.find().populate('translations.language')
  res.status(200).json({
    success: true,
    data: installs,
  })
})

//* Cập nhật thông tin lắp đặt
export const updateInstallation = expressAsyncHandler(
  async (req: any, res: any) => {
    const { installId } = req.params
    const existing = await Installation.findById(installId)
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'Installation không tồn tại' })
    }

    // Nếu client gửi translations thì parse lại
    if (req.body.translations) {
      try {
        const tr = JSON.parse(req.body.translations)
        if (!Array.isArray(tr)) throw new Error()
        req.body.translations = tr
      } catch {
        return res
          .status(400)
          .json({ success: false, message: 'translations không hợp lệ' })
      }
    }

    // Xử lý upload mới
    const files = (req.files as { icon?: Express.Multer.File[] })?.icon || []
    if (files.length > 0) {
      // xóa cũ
      await deleteImages(existing.imageUrls)
      req.body.imageUrls = files.map(f => f.path)
    }

    // Update
    const updated = await Installation.findByIdAndUpdate(
      installId,
      {
        translations: req.body.translations || existing.translations,
        cost: req.body.cost ?? existing.cost,
        tax: req.body.tax ?? existing.tax,
        imageUrls: req.body.imageUrls ?? existing.imageUrls,
      },
      { new: true },
    )

    res.json({ success: true, data: updated })
  },
)

//* Xóa thông tin lắp đặt
export const deleteInstallation = expressAsyncHandler(
  async (req: any, res: any) => {
    const { installId } = req.params
    if (!installId) {
      return res
        .status(400)
        .json({ success: false, message: 'Thiếu installId' })
    }

    const inst = await Installation.findByIdAndDelete(installId)
    if (!inst) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy Installation' })
    }

    // Xóa ảnh trên storage
    if (Array.isArray(inst.imageUrls) && inst.imageUrls.length) {
      await deleteImages(inst.imageUrls)
    }

    res.status(200).json({
      success: true,
      message: 'Xóa thành công',
      data: inst,
    })
  },
)
