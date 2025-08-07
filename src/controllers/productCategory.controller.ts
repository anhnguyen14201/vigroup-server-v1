import expressAsyncHandler from 'express-async-handler'
import slugify from 'slugify'
import { Product, ProductCategory } from '~/models'

//* Tạo danh mục sản phẩm
export const createProductCategory = expressAsyncHandler(
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
    const newproductCategory = await ProductCategory.create(req.body)

    res.status(201).json({
      success: true,
      data: newproductCategory,
    })
  },
)

//* Lấy danh mục sản phẩm
export const getProductCategories = expressAsyncHandler(async (req, res) => {
  const catCounts = await Product.aggregate([
    { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
  ])
  const map: Record<string, number> = {}
  catCounts.forEach(c => (map[c._id.toString()] = c.count))

  const productCategories = await ProductCategory.find().populate(
    'translations.language',
  )
  const data = productCategories.map(cat => ({
    ...cat.toObject(),
    productCount: map[cat._id.toString()] || 0,
  }))

  res.status(200).json({ success: true, data })
})

//* lấy đanh mục sản phẩm theo ID
export const getProductCategoryById = expressAsyncHandler(
  async (req: any, res: any) => {
    const productCategory = await ProductCategory.findById(
      req.params.productCategoryId,
    ).populate('translations.language products')
    if (!productCategory) {
      return res.status(404).json({
        success: false,
        message: 'Project type not found',
      })
    }
    res.status(200).json({
      success: true,
      data: productCategory,
    })
  },
)

//* Sửa danh mục sản phẩm
export const updateProductCategory = expressAsyncHandler(
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
    const updatedProductCategory = await ProductCategory.findByIdAndUpdate(
      req.params.productCategoryId,
      req.body,
      { new: true, runValidators: true },
    )

    if (!updatedProductCategory) {
      return res.status(404).json({
        success: false,
        message: 'Project type not found',
      })
    }

    res.status(200).json({
      success: true,
      data: updatedProductCategory,
    })
  },
)

//* Xóa danh mục sản phẩm
export const deleteProductCategory = expressAsyncHandler(
  async (req: any, res: any) => {
    const productCategory = await ProductCategory.findByIdAndDelete(
      req.params.productCategoryId,
    )
    if (!productCategory) {
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
