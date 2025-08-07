import expressAsyncHandler from 'express-async-handler'
import { InforCompany } from '~/models' // điều chỉnh đường dẫn import đúng
import { deleteImages } from '~/utils'

//* Tạo thông tin công ty

export const createInforCompany = expressAsyncHandler(
  async (req: any, res: any) => {
    // 1. Kiểm tra file upload
    if (
      !req.files ||
      !Array.isArray((req.files as any).icon) ||
      !(req.files as any).icon.length
    ) {
      return res.status(400).json({
        success: false,
        message: 'Không có file icon được tải lên',
      })
    }

    // 2. Lấy đường dẫn file
    const files: Express.Multer.File[] = (req.files as any).icon
    const imagePaths = files.map(file => file.path)

    // 3. Chuẩn bị payload từ req.body
    const { companyName, address, ico, dic, bankAccount } = req.body

    // 4. Đặt các bản ghi cũ đang active thành inactive
    await InforCompany.updateMany(
      { isActive: true },
      { $set: { isActive: false } },
    )

    // 5. Tạo bản ghi mới
    const newCompany = await InforCompany.create({
      companyName,
      address,
      ico,
      dic,
      bankAccount,
      imageUrls: imagePaths,
      isActive: true,
    })

    res.status(201).json({
      success: true,
      data: newCompany,
    })
  },
)

/**
 * GET /api/company
 * Lấy tất cả bản ghi InforCompany
 */
export const getInforCompany = expressAsyncHandler(
  async (_req: any, res: any) => {
    const companies = await InforCompany.find()
    if (!companies || companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không có thông tin công ty nào',
      })
    }
    res.status(200).json({
      success: true,
      data: companies,
    })
  },
)

/**
 * PUT /api/company/:companyId
 * Cập nhật một bản ghi InforCompany
 * - Xử lý upload mới: field name = 'icon'
 * - Nếu isActive=true → set tất cả bản ghi khác isActive=false
 */
export const updateInforCompany = expressAsyncHandler(
  async (req: any, res: any) => {
    const { companyId } = req.params
    const existing = await InforCompany.findById(companyId)
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy công ty' })
    }

    // 1. Xử lý upload file mới (icon)
    const files: Express.Multer.File[] = (req.files as any)?.icon ?? []
    if (files.length > 0) {
      // Xóa ảnh cũ
      if (existing.imageUrls && existing.imageUrls.length > 0) {
        await deleteImages(existing.imageUrls)
      }
      // Gán đường dẫn file mới
      req.body.imageUrls = files.map(f => f.path)
    }

    // 2. Xử lý isActive (nếu client gửi lên)
    const newActive =
      typeof req.body.isActive !== 'undefined'
        ? JSON.parse(req.body.isActive)
        : existing.isActive

    // 3. Nếu newActive=true → tắt hết các bản ghi khác
    if (newActive === true) {
      await InforCompany.updateMany(
        { _id: { $ne: companyId }, isActive: true },
        { $set: { isActive: false } },
      )
    }

    // 4. Cập nhật bản ghi hiện tại
    const updated = await InforCompany.findByIdAndUpdate(
      companyId,
      {
        ...req.body,
        isActive: newActive,
      },
      { new: true },
    )

    res.json({ success: true, data: updated })
  },
)

/**
 * DELETE /api/company/:companyId
 * Xóa một InforCompany
 */
export const deleteInforCompany = expressAsyncHandler(
  async (req: any, res: any) => {
    const { companyId } = req.params
    if (!companyId) {
      return res
        .status(400)
        .json({ success: false, message: 'Thiếu companyId' })
    }

    const company = await InforCompany.findByIdAndDelete(companyId)
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy công ty' })
    }

    // Xóa file ảnh nếu có
    if (company.imageUrls && company.imageUrls.length > 0) {
      await deleteImages(company.imageUrls)
    }

    res.status(200).json({
      success: true,
      message: 'Xóa thông tin công ty thành công',
      data: company,
    })
  },
)
