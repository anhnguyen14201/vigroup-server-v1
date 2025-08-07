import expressAsyncHandler from 'express-async-handler'
import { ProjectType } from '~/models'
import slugify from 'slugify'

/*
 * Controller để quản lý các loại dự án (Project Types)
 * - Tạo mới, lấy danh sách, lấy theo ID, cập nhật và xóa loại dự án
 */
export const createProjectType = expressAsyncHandler(
  async (req: any, res: any) => {
    // 1. Parse nếu translations là chuỗi JSON
    let translations = req.body.translations
    if (typeof translations === 'string') {
      try {
        translations = JSON.parse(translations)
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Field translations không phải JSON hợp lệ.',
        })
      }
    }

    // 2. Kiểm tra phải là mảng
    if (!Array.isArray(translations)) {
      return res.status(400).json({
        success: false,
        message: 'Field translations phải là mảng.',
      })
    }

    // 3. Sinh slug cho từng bản dịch
    //    Nếu name rỗng, ta để slug là chuỗi rỗng
    const translationsWithSlug = translations.map((t: any) => {
      const rawName = t.name || ''
      const generatedSlug = rawName.trim()
        ? slugify(rawName, { lower: true, strict: true, locale: 'vi' })
        : ''
      return {
        ...t,
        slug: generatedSlug,
      }
    })

    // 4. Gán lại mảng translations đã bổ sung slug vào req.body
    req.body.translations = translationsWithSlug

    // 5. Tạo document mới
    const newProjectType = await ProjectType.create(req.body)

    res.status(201).json({
      success: true,
      data: newProjectType,
    })
  },
)

//* Lấy danh sách tất cả loại dự án
export const getProjectTypes = expressAsyncHandler(async (req, res) => {
  const projectTypes = await ProjectType.find().populate(
    'translations.language',
  )
  res.status(200).json({
    success: true,
    data: projectTypes,
  })
})

//* Lấy loại dự án theo ID
export const getProjectTypeById = expressAsyncHandler(
  async (req: any, res: any) => {
    const projectType = await ProjectType.findById(
      req.params.projectTypeId,
    ).populate('translations.language')
    if (!projectType) {
      return res.status(404).json({
        success: false,
        message: 'Project type not found',
      })
    }
    res.status(200).json({
      success: true,
      data: projectType,
    })
  },
)

//* Cập nhật loại dự án theo ID
export const updateProjectType = expressAsyncHandler(
  async (req: any, res: any) => {
    // 1. Parse nếu translations là chuỗi JSON
    let translations = req.body.translations
    if (typeof translations === 'string') {
      try {
        translations = JSON.parse(translations)
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Field translations không phải JSON hợp lệ.',
        })
      }
    }

    // 2. Kiểm tra phải là mảng
    if (!Array.isArray(translations)) {
      return res.status(400).json({
        success: false,
        message: 'Field translations phải là mảng.',
      })
    }

    // 3. Sinh slug cho từng bản dịch
    const translationsWithSlug = translations.map((t: any) => {
      const rawName = t.name || ''
      const generatedSlug = rawName.trim()
        ? slugify(rawName, { lower: true, strict: true, locale: 'vi' })
        : ''
      return {
        ...t,
        slug: generatedSlug,
      }
    })

    // 4. Gán lại mảng translations đã bổ sung slug vào req.body
    req.body.translations = translationsWithSlug

    // 5. Cập nhật document
    const updatedProjectType = await ProjectType.findByIdAndUpdate(
      req.params.projectTypeId,
      req.body,
      { new: true, runValidators: true },
    )

    if (!updatedProjectType) {
      return res.status(404).json({
        success: false,
        message: 'Project type not found',
      })
    }

    res.status(200).json({
      success: true,
      data: updatedProjectType,
    })
  },
)

//* Xóa loại dự án theo ID
export const deleteProjectType = expressAsyncHandler(
  async (req: any, res: any) => {
    const projectType = await ProjectType.findByIdAndDelete(
      req.params.projectTypeId,
    )
    if (!projectType) {
      return res.status(404).json({
        success: false,
        message: 'Project type not found',
      })
    }
    res.status(200).json({
      success: true,
      message: 'Project type deleted successfully',
    })
  },
)
