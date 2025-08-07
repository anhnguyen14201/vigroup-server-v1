import expressAsyncHandler from 'express-async-handler'
import slugifyModule from 'slugify'
import { Product, ProductBrand } from '~/models/index.js'
const slugify = slugifyModule.default || slugifyModule

// CREATE ProductBrand
export const createProductBrand = expressAsyncHandler(
  async (req: any, res: any) => {
    // 1. Parse và validate mảng translations
    let translations = req.body.translations
    if (typeof translations === 'string') {
      try {
        translations = JSON.parse(translations)
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Field "translations" không phải JSON hợp lệ.',
        })
      }
    }
    if (!Array.isArray(translations)) {
      return res.status(400).json({
        success: false,
        message: 'Field "translations" phải là mảng.',
      })
    }

    // 2. Lấy "name" ở cấp root, bắt buộc phải có
    const { name } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Field "name" là bắt buộc và phải là chuỗi không rỗng.',
      })
    }
    const trimmedName = name.trim()

    // 3. Sinh slug từ name
    const generatedSlug = slugify(trimmedName, {
      lower: true,
      strict: true,
      locale: 'vi', // hoặc 'en' nếu bạn muốn bỏ qua dấu Việt
    })
    req.body.slug = generatedSlug

    // 4. Chuẩn hóa lại translations (chỉ giữ language & metaDescription)
    const translationsClean = translations.map((t: any) => {
      const { language, metaDescription } = t
      if (!language) {
        throw new Error('Mỗi phần tử trong "translations" phải có "language".')
      }
      return {
        language,
        metaDescription: (metaDescription || '').trim(),
      }
    })
    req.body.translations = translationsClean

    // 5. Các trường khác: products (ObjectId) hoặc các field bổ sung
    //    Ví dụ: const products = req.body.products

    // 6. Tạo document mới
    try {
      const newBrand = await ProductBrand.create({
        name: trimmedName,
        slug: generatedSlug,
        translations: translationsClean,
        products: req.body.products, // nếu có
        // nếu còn field khác, cũng truyền vào đây
      })

      return res.status(201).json({
        success: true,
        data: newBrand,
      })
    } catch (err: any) {
      // Bắt lỗi unique = slug hoặc name trùng
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Tên hoặc slug đã tồn tại. Vui lòng chọn giá trị khác.',
        })
      }
      return res.status(500).json({
        success: false,
        message: 'Tạo ProductBrand thất bại.',
      })
    }
  },
)

// GET ALL ProductBrands
export const getProductBrands = expressAsyncHandler(
  async (req: any, res: any) => {
    const catCounts = await Product.aggregate([
      { $match: { brandIds: { $ne: null } } },
      { $group: { _id: '$brandIds', count: { $sum: 1 } } },
    ])
    const map: Record<string, number> = {}
    catCounts.forEach((c: any) => (map[c._id.toString()] = c.count))
    const brands = await ProductBrand.find().populate('translations.language')
    const data = brands.map((cat: any) => ({
      ...cat.toObject(),
      brandCount: map[cat._id.toString()] || 0,
    }))

    res.status(200).json({ success: true, data: data })
  },
)

// GET ProductBrand BY ID
export const getProductBrandById = expressAsyncHandler(
  async (req: any, res: any) => {
    const { productBrandId } = req.params
    const brand = await ProductBrand.findById(productBrandId)
      .populate('translations.language')
      .populate('products')
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ProductBrand',
      })
    }
    return res.status(200).json({
      success: true,
      data: brand,
    })
  },
)

// UPDATE ProductBrand
export const updateProductBrand = expressAsyncHandler(
  async (req: any, res: any) => {
    const { productBrandId } = req.params

    // 1. Parse và validate mảng translations nếu cần
    let translations = req.body.translations
    if (typeof translations === 'string') {
      try {
        translations = JSON.parse(translations)
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Field "translations" không phải JSON hợp lệ.',
        })
      }
    }
    if (!Array.isArray(translations)) {
      return res.status(400).json({
        success: false,
        message: 'Field "translations" phải là mảng.',
      })
    }

    // 2. Sinh slug mới (nếu "name" được thay đổi)
    if (
      req.body.name &&
      typeof req.body.name === 'string' &&
      req.body.name.trim()
    ) {
      const trimmedName = req.body.name.trim()
      const generatedSlug = slugify(trimmedName, {
        lower: true,
        strict: true,
        locale: 'vi',
      })
      req.body.slug = generatedSlug
    }

    // 3. Chuẩn hóa lại translations
    const translationsClean = translations.map((t: any) => {
      const { language, metaDescription } = t
      if (!language) {
        throw new Error('Mỗi phần tử trong "translations" phải có "language".')
      }
      return {
        language,
        metaDescription: (metaDescription || '').trim(),
      }
    })
    req.body.translations = translationsClean

    // 4. Cập nhật
    try {
      const updated = await ProductBrand.findByIdAndUpdate(
        productBrandId,
        {
          ...(req.body.name ? { name: req.body.name.trim() } : {}),
          ...(req.body.slug ? { slug: req.body.slug } : {}),
          translations: translationsClean,
          ...(req.body.products ? { products: req.body.products } : {}),
          ...(req.body.metaDescription
            ? { metaDescription: req.body.metaDescription }
            : {}),
          ...req.body.otherFields, // nếu có thêm field khác
        },
        { new: true, runValidators: true },
      )
        .populate('translations.language')
        .populate('products')

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'ProductBrand không tồn tại.',
        })
      }
      return res.status(200).json({
        success: true,
        data: updated,
      })
    } catch (err: any) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Tên hoặc slug đã tồn tại. Vui lòng chọn giá trị khác.',
        })
      }
      return res.status(500).json({
        success: false,
        message: 'Cập nhật ProductBrand thất bại.',
      })
    }
  },
)

// DELETE ProductBrand
export const deleteProductBrand = expressAsyncHandler(
  async (req: any, res: any) => {
    const { productBrandId } = req.params
    const deleted = await ProductBrand.findByIdAndDelete(productBrandId)
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'ProductBrand không tồn tại.',
      })
    }
    return res.status(200).json({
      success: true,
      message: 'Đã xóa ProductBrand thành công.',
    })
  },
)
