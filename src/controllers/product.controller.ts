import expressAsyncHandler from 'express-async-handler'
import mongoose, { AnyObject } from 'mongoose'
import slugifyModule from 'slugify'
const slugify = slugifyModule.default || slugifyModule
import {
  Product,
  ProductCategory,
  ProductBrand,
  Language,
} from '~/models/index.js'
import { deleteImages } from '~/utils/helps.js'
/*
 * Trợ giúp tạo slug duy nhất cho từng productName.
 * Nếu có sản phẩm nào khác (ngoại trừ sản phẩm có ID excludeProductId nếu cập nhật)
 * đang sử dụng slug đó, hàm sẽ tự động thêm hậu tố số vào slug.
 */
async function generateUniqueSlug(
  productName: string,
  excludeProductId?: string,
): Promise<string> {
  const baseSlug = slugify(productName.trim(), {
    lower: true,
    strict: true,
    locale: 'vi',
  })
  let newSlug = baseSlug
  let count = 1
  while (
    await Product.exists({
      'translations.slug': newSlug,
      ...(excludeProductId ? { _id: { $ne: excludeProductId } } : {}),
    })
  ) {
    newSlug = `${baseSlug}-${count}`
    count++
  }
  return newSlug
}

/*
 * Tạo sản phẩm mới.
 * - Xử lý trường translations (JSON string hoặc mảng) và tạo slug cho từng bản dịch.
 * - Xử lý file upload cho thumbnail và images.
 * - Cập nhật ProductCategory và ProductBrand nếu có.
 */
export const createProduct = expressAsyncHandler(async (req: any, res: any) => {
  const {
    translations: rawTranslations,
    categoryIds: rawCategoryIds,
    code: rawCode,
    brandIds: rawBrandIds,
    price,
    cost,
    discount,
    tax,
    quantity,
    isFeatured,
    isNewArrival,
    ...rest
  } = req.body

  // 1) Parse rawTranslations
  let parsedTranslations: any[] = []
  try {
    parsedTranslations = Array.isArray(rawTranslations)
      ? rawTranslations
      : JSON.parse(rawTranslations)
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        'Field "translations" phải là JSON hợp lệ hoặc mảng. Vui lòng kiểm tra lại.',
    })
  }

  if (!Array.isArray(parsedTranslations) || parsedTranslations.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Field "translations" phải là mảng và không được để trống.',
    })
  }

  // 2) Xử lý các field khác
  const code = typeof rawCode === 'string' ? rawCode.trim() : undefined

  // Nếu rawCategoryIds là mảng các ID
  const categoryIds = Array.isArray(rawCategoryIds)
    ? rawCategoryIds[0]
    : rawCategoryIds
  const brandIds = Array.isArray(rawBrandIds) ? rawBrandIds[0] : rawBrandIds
  // 3) Xử lý file upload (nếu có)
  const filesMap = (req.files as { [key: string]: Express.Multer.File[] }) || {}
  const thumbnailFiles: Express.Multer.File[] = Array.isArray(
    filesMap.thumbnail,
  )
    ? filesMap.thumbnail
    : []
  const imageFiles: Express.Multer.File[] = Array.isArray(filesMap.images)
    ? filesMap.images
    : []
  const thumbnailPaths = thumbnailFiles.map(file => file.path)
  const imagePaths = imageFiles.map(file => file.path)

  // 4) Xử lý và validate parsedTranslations: tạo slug duy nhất
  let processedTranslations: any[] = []
  try {
    processedTranslations = await Promise.all(
      parsedTranslations.map(async (t: any) => {
        const {
          productName,
          language,
          metaDescription,
          shortDesc,
          desc,
          specifications,
        } = t
        const uniqueSlug = await generateUniqueSlug(productName)
        return {
          language,
          productName: productName.trim(),
          slug: uniqueSlug,
          metaDescription: metaDescription?.trim() || '',
          shortDesc: shortDesc?.trim() || '',
          desc: desc?.trim() || '',
          specifications: specifications?.trim() || '',
        }
      }),
    )
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }

  // 5) Đóng gói payload
  const payload: any = {
    code,
    price,
    cost,
    discount,
    tax,
    quantity,
    isFeatured,
    isNewArrival,
    translations: processedTranslations,
    thumbnailUrls: thumbnailPaths,
    imageUrls: imagePaths,
    /*     categoryIds: categoryIds,
    brandIds: brandIds, */
    ...rest,
  }

  if (categoryIds) {
    payload.categoryIds = categoryIds
  }
  if (brandIds) {
    payload.brandIds = brandIds
  }

  // 6) Tạo sản phẩm và cập nhật liên kết với danh mục/ thương hiệu
  try {
    const newProduct = await Product.create(payload)

    // Nếu categoryIds tồn tại, cập nhật ProductCategory
    if (categoryIds) {
      const updatedProductCategory = await ProductCategory.findByIdAndUpdate(
        categoryIds,
        {
          $addToSet: { products: newProduct._id },
        },
      )
      if (!updatedProductCategory) {
        console.error(
          `ProductCategory with ID ${categoryIds.toString()} not found when creating product.`,
        )
      }
    }

    // Nếu brandIds tồn tại, cập nhật ProductBrand
    if (brandIds) {
      const updatedProductBrand = await ProductBrand.findByIdAndUpdate(
        brandIds,
        {
          $addToSet: { products: newProduct._id },
        },
      )
      if (!updatedProductBrand) {
        console.error(
          `ProductBrand with ID ${brandIds.toString()} not found when creating product.`,
        )
      }
    }

    return res.status(201).json({ success: true, productData: newProduct })
  } catch (error: any) {
    console.error('Error in createProduct:', error)
    if (error.code === 11000 && error.keyPattern?.['translations.slug']) {
      return res.status(409).json({
        success: false,
        message:
          'Một trong các slug đã tồn tại. Vui lòng đổi productName khác.',
      })
    }
    return res.status(500).json({
      success: false,
      message: `Tạo sản phẩm thất bại. Chi tiết lỗi: ${error.message}`,
    })
  }
})

/*
 * Lấy danh sách sản phẩm với phân trang và tìm kiếm.
 * - Hỗ trợ tìm kiếm theo tên sản phẩm, mã sản phẩm, danh mục, thương hiệu.
 * - Trả về danh sách sản phẩm cùng với thông tin phân trang.
 */
export const getAllPrivateProducts = expressAsyncHandler(
  async (req: any, res: any) => {
    if (req.query.sortBy) {
      const prefix = req.query.sortOrder === 'desc' ? '-' : ''
      req.query.sort = `${prefix}${req.query.sortBy}`
    }
    if (req.query.searchTerm) {
      req.query.productValue = req.query.searchTerm
    }

    const queries = { ...req.query }

    const excludeFields = [
      'limit',
      'sort',
      'page',
      'fields',
      'productValue',
      'language',
      'sortBy',
      'sortOrder',
      'searchTerm',
      'categoryId',
      'brandId',
    ]
    excludeFields.forEach(f => delete queries[f])

    let filters: any = {}
    if (Object.keys(queries).length) {
      let qs = JSON.stringify(queries)
      qs = qs.replace(/\b(gte|gt|lte|lt)\b/g, m => `$${m}`)
      filters = JSON.parse(qs)
    }

    if (req.query.productValue) {
      const regex = new RegExp(req.query.productValue, 'i')
      if (req.query.language) {
        const langId = req.query.language
        filters.$or = [
          {
            translations: {
              $elemMatch: {
                language: new mongoose.Types.ObjectId(langId),
                productName: { $regex: regex },
              },
            },
          },
          { code: { $regex: regex } },
        ]
      } else {
        filters.$or = [
          { 'translations.productName': { $regex: regex } },
          { code: { $regex: regex } },
        ]
      }
    }

    if (req.query.categoryId) {
      filters.categoryIds = req.query.categoryId
    }
    if (req.query.brandId) {
      filters.brandIds = req.query.brandId
    }

    let q = Product.find(filters).populate([
      'translations.language',
      'categoryIds',
      'brandIds',
    ])

    if (typeof req.query.sort === 'string') {
      q = q.sort(req.query.sort.split(',').join(' '))
    } else {
      q = q.sort({ createdAt: -1 })
    }

    if (typeof req.query.fields === 'string') {
      q = q.select(req.query.fields.split(',').join(' '))
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const limit = Math.max(1, parseInt(req.query.limit || '10', 10))
    const skip = (page - 1) * limit
    q = q.skip(skip).limit(limit)

    const [products, counts] = await Promise.all([
      q.exec(),
      Product.countDocuments(filters),
    ])

    res.json({
      success: true,
      totalItems: counts,
      totalPages: Math.ceil(counts / limit),
      currentPage: page,
      data: products,
    })
  },
)

export const getAllProducts = expressAsyncHandler(
  async (req: any, res: AnyObject) => {
    // --- 1. Parse paging, sort, search, language, price filters ---
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10))
    const limit = Math.max(1, parseInt((req.query.limit as string) || '10', 10))
    const skip = (page - 1) * limit

    const sortBy = (req.query.sortBy as string) || undefined
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1
    const languageId = req.query.language as string | undefined
    const searchTerm = req.query.searchTerm as string | undefined
    const categoryId = req.query.categoryId as string | undefined
    const brandId = req.query.brandId as string | undefined
    const minPrice = req.query.minPrice
      ? parseFloat(req.query.minPrice as string)
      : undefined
    const maxPrice = req.query.maxPrice
      ? parseFloat(req.query.maxPrice as string)
      : undefined

    // --- 2. Build match filter for category, brand, search ---
    const match: any = {}
    if (categoryId) {
      match.categoryIds = { $in: [new mongoose.Types.ObjectId(categoryId)] }
    }
    if (brandId) {
      match.brandIds = { $in: [new mongoose.Types.ObjectId(brandId)] }
    }
    if (searchTerm) {
      const regex = new RegExp(searchTerm, 'i')
      if (languageId) {
        match.$or = [
          {
            translations: {
              $elemMatch: {
                language: new mongoose.Types.ObjectId(languageId),
                productName: { $regex: regex },
              },
            },
          },
          { code: { $regex: regex } },
        ]
      } else {
        match.$or = [
          { 'translations.productName': { $regex: regex } },
          { code: { $regex: regex } },
        ]
      }
    }

    // --- 3. Build Aggregation Pipeline ---
    const pipeline: any[] = []
    pipeline.push({ $match: match })

    // Compute effectivePrice: if discount > 0 use discount, else price
    if (
      minPrice !== undefined ||
      maxPrice !== undefined ||
      sortBy === 'price'
    ) {
      pipeline.push({
        $addFields: {
          effectivePrice: {
            $cond: [{ $gt: ['$discount', 0] }, '$discount', '$price'],
          },
        },
      })
    }

    // Filter by effectivePrice range
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceMatch: any = {}
      if (minPrice !== undefined) priceMatch.$gte = minPrice
      if (maxPrice !== undefined) priceMatch.$lte = maxPrice
      pipeline.push({ $match: { effectivePrice: priceMatch } })
    }

    // --- 4. Extract matched translation ---
    if (languageId) {
      pipeline.push(
        {
          $addFields: {
            matchedTranslation: {
              $filter: {
                input: '$translations',
                as: 't',
                cond: {
                  $eq: [
                    '$$t.language',
                    new mongoose.Types.ObjectId(languageId),
                  ],
                },
              },
            },
          },
        },
        {
          $unwind: {
            path: '$matchedTranslation',
            preserveNullAndEmptyArrays: true,
          },
        },
      )
    }

    // --- 5. Sort stage ---
    if (sortBy === 'productName' && languageId) {
      pipeline.push({ $sort: { 'matchedTranslation.productName': sortOrder } })
    } else if (sortBy === 'price') {
      pipeline.push({ $sort: { effectivePrice: sortOrder } })
    } else if (sortBy) {
      pipeline.push({ $sort: { [sortBy]: sortOrder } })
    } else {
      pipeline.push({ $sort: { createdAt: -1 } })
    }

    // --- 6. Facet for pagination and count ---
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'totalItems' }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              code: 1,
              price: 1,
              discount: 1,
              effectivePrice: 1,
              tax: 1,
              quantity: 1,
              isFeatured: 1,
              isNewArrival: 1,
              categoryIds: 1,
              brandIds: 1,
              thumbnailUrls: 1,
              imageUrls: 1,
              stockStatus: 1,
              ...(languageId
                ? {
                    productName: '$matchedTranslation.productName',
                    slug: '$matchedTranslation.slug',
                    shortDesc: '$matchedTranslation.shortDesc',
                    desc: '$matchedTranslation.desc',
                    specifications: '$matchedTranslation.specifications',
                    language: '$matchedTranslation.language',
                  }
                : { translations: 1 }),
            },
          },
        ],
      },
    })

    pipeline.push({
      $unwind: { path: '$metadata', preserveNullAndEmptyArrays: true },
    })

    // --- 7. Execute aggregation and respond ---
    const result = await Product.aggregate(pipeline)
    const { data: products = [], metadata } = result[0] || {}
    const totalItems = metadata?.totalItems || 0
    res.status(200).json({
      success: true,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      data: products,
    })
  },
)

/*

 * Hàm sửa sản phẩm
 * - Đối với translations: parse và đảm bảo slug duy nhất (trừ chính product đang update)
 * - Cập nhật quan hệ ProductCategory và ProductBrand nếu có thay đổi categoryIds hoặc brandIds
 */
export const updateProduct = expressAsyncHandler(async (req: any, res: any) => {
  const { productId } = req.params

  // 1. Tìm product hiện tại
  const existingProduct = await Product.findById(productId)
  if (!existingProduct) {
    return res.status(404).json({
      success: false,
      message: 'Product không tồn tại',
    })
  }

  // 2. Parse các field từ body: translations, categoryIds, brandIds, code, giá, v.v.
  const {
    translations: rawTranslations,
    categoryIds: rawCategoryIds,
    brandIds: rawBrandIds,
    code: rawCode,
    price,
    cost,
    discount,
    tax,
    quantity,
    isFeatured,
    isNewArrival,
    removedImageUrls = [],
    ...rest
  } = req.body

  let stockStatus: string
  if (quantity <= 0) stockStatus = 'Out of Stock'
  else if (quantity < 10) stockStatus = 'Low Stock'
  else stockStatus = 'In Stock'

  // 3. Parse rawTranslations nếu có
  let parsedTranslations: any[] = []
  if (rawTranslations !== undefined) {
    try {
      parsedTranslations = Array.isArray(rawTranslations)
        ? rawTranslations
        : JSON.parse(rawTranslations)
    } catch (err) {
      console.error('Error parsing rawTranslations:', err)
      return res.status(400).json({
        success: false,
        message: 'Field "translations" phải là JSON hợp lệ hoặc mảng.',
      })
    }
    if (!Array.isArray(parsedTranslations) || parsedTranslations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Field "translations" phải là mảng và không được để trống.',
      })
    }
  }

  // 4. Xử lý code, categoryIds, brandIds
  const code =
    typeof rawCode === 'string' ? rawCode.trim() : existingProduct.code
  const newCategoryId = rawCategoryIds || existingProduct.categoryIds
  const newBrandId = rawBrandIds || existingProduct.brandIds

  if (!newCategoryId) {
    return res.status(400).json({
      success: false,
      message: 'Field "categoryIds" là bắt buộc.',
    })
  }

  // 5. Xử lý file upload (nếu Multer đã cấu hình upload.fields)
  const filesMap = (req.files as { [key: string]: Express.Multer.File[] }) || {}
  const thumbnailFiles: Express.Multer.File[] = Array.isArray(
    filesMap.thumbnail,
  )
    ? filesMap.thumbnail
    : []
  const imageFiles: Express.Multer.File[] = Array.isArray(filesMap.images)
    ? filesMap.images
    : []

  // 5.1. Lấy thumbnailPaths và imagePaths hiện tại
  let thumbnailPaths: string[] = Array.isArray(existingProduct.thumbnailUrls)
    ? existingProduct.thumbnailUrls.map(String)
    : []
  let imagePaths: string[] = Array.isArray(existingProduct.imageUrls)
    ? existingProduct.imageUrls.map(String)
    : []

  if (thumbnailFiles.length > 0) {
    // Nếu upload mới thumbnail => override hoàn toàn
    thumbnailPaths = thumbnailFiles.map(f => f.path)
  }

  if (imageFiles.length > 0) {
    // Nếu upload mới images => append vào existing
    const newImagePaths = imageFiles.map(f => f.path)
    imagePaths = [...imagePaths, ...newImagePaths]
  }

  // 5.2. Xử lý xóa ảnh đã loại bỏ
  let removed = removedImageUrls

  // Nếu là chuỗi JSON, parse
  if (typeof removed === 'string') {
    const s = removed.trim()
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        removed = JSON.parse(s)
      } catch {
        // Fallback: nếu parse fail, thử split dấu phẩy
        removed = s
          .split(',')
          .map(u => u.trim())
          .filter(Boolean)
      }
    } else if (s.includes(',')) {
      // Nếu không phải JSON array, nhưng chứa dấu phẩy => split
      removed = s
        .split(',')
        .map(u => u.trim())
        .filter(Boolean)
    } else {
      // Chuỗi đơn lẻ
      removed = [s]
    }
  }

  // Bây giờ removed chắc chắn là string[]
  const removedImage = Array.isArray(removed) ? removed : []

  // Chạy logic cũ
  if (removedImage.length > 0) {
    // 1. Lọc khỏi imagePaths
    imagePaths = imagePaths.filter(url => !removedImage.includes(url))

    // 2. Xóa trên Cloudinary
    await deleteImages(removedImage)
  }
  // 6. Xử lý translations: nếu client gửi, phải generate slug duy nhất
  let processedTranslations: any[] = existingProduct.translations || []
  if (parsedTranslations.length > 0) {
    try {
      processedTranslations = await Promise.all(
        parsedTranslations.map(async (t: any) => {
          const {
            productName,
            language,
            metaDescription,
            shortDesc,
            desc,
            specifications,
          } = t
          /*           if (!productName || !language) {
            throw new Error('Mỗi translation phải có productName và language.')
          } */
          // Generate slug duy nhất, loại trừ productId hiện tại
          const uniqueSlug = await generateUniqueSlug(
            productName.trim(),
            productId,
          )
          return {
            language,
            productName: productName.trim(),
            slug: uniqueSlug,
            metaDescription: metaDescription?.trim() || '',
            shortDesc: shortDesc?.trim() || '',
            desc: desc?.trim() || '',
            specifications: specifications?.trim() || '',
          }
        }),
      )
    } catch (slugErr: any) {
      console.error('Error processing parsedTranslations:', slugErr)
      return res.status(400).json({
        success: false,
        message: slugErr.message,
      })
    }
  }

  // 7. Đóng gói payload update
  const payloadUpdate: any = {
    code,
    categoryIds: newCategoryId,
    brandIds: newBrandId,
    price,
    cost,
    discount,
    tax,
    quantity,
    isFeatured,
    isNewArrival,
    translations: processedTranslations,
    thumbnailUrls: thumbnailPaths,
    imageUrls: imagePaths,
    stockStatus,
    ...rest,
  }

  // 8. Thực hiện cập nhật
  try {
    // Lưu lại hai giá trị cũ để xử lý quan hệ khi category/brand thay đổi
    const oldCategoryId = existingProduct.categoryIds?.toString() || null
    const oldBrandId = existingProduct.brandIds?.toString() || null

    const updated = await Product.findByIdAndUpdate(productId, payloadUpdate, {
      new: true,
      runValidators: true,
    })
    if (!updated) {
      return res.status(500).json({
        success: false,
        message: 'Cập nhật sản phẩm thất bại.',
      })
    }

    // 9. Nếu categoryIds thay đổi => update quan hệ ở ProductCategory
    if (oldCategoryId !== newCategoryId.toString()) {
      // Pull out khỏi category cũ
      if (oldCategoryId) {
        await ProductCategory.findByIdAndUpdate(oldCategoryId, {
          $pull: { products: updated._id },
        })
      }
      // Thêm vào category mới
      await ProductCategory.findByIdAndUpdate(newCategoryId, {
        $addToSet: { products: updated._id },
      })
    }

    // 10. Nếu brandIds thay đổi => update quan hệ ở ProductBrand
    if (oldBrandId !== newBrandId) {
      // Pull out khỏi brand cũ
      if (oldBrandId) {
        await ProductBrand.findByIdAndUpdate(oldBrandId, {
          $pull: { products: updated._id },
        })
      }
      // Thêm vào brand mới
      await ProductBrand.findByIdAndUpdate(newBrandId, {
        $addToSet: { products: updated._id },
      })
    }

    return res.status(200).json({
      success: true,
      productData: updated,
    })
  } catch (err: any) {
    console.error('Error in updateProduct:', err)
    // Bắt lỗi duplicate slug nếu xãy ra
    if (err.code === 11000 && err.keyPattern?.['translations.slug']) {
      return res.status(409).json({
        success: false,
        message:
          'Một trong các slug đã tồn tại. Vui lòng đổi productName khác.',
      })
    }
    return res.status(500).json({
      success: false,
      message: `Cập nhật sản phẩm thất bại. Chi tiết lỗi: ${err.message}`,
    })
  }
})

/*
 * Hàm xóa sản phẩm
 * - Xóa document Product
 * - Đồng thời pull productId khỏi mảng products trong ProductCategory và ProductBrand
 */
export const deleteProduct = expressAsyncHandler(async (req: any, res: any) => {
  // 1. Lấy productId từ params
  const { productId } = req.params

  // 2. Tìm Product cần xóa
  const existingProduct = await Product.findById(productId)
  if (!existingProduct) {
    return res.status(404).json({
      success: false,
      message: 'Product không tồn tại',
    })
  }

  // 3. Xóa ảnh (thumbnail + image) nếu có
  const thumbnailUrls: string[] = Array.isArray(existingProduct.thumbnailUrls)
    ? (existingProduct.thumbnailUrls as unknown[]).map(String)
    : []
  const imageUrls: string[] = Array.isArray(existingProduct.imageUrls)
    ? (existingProduct.imageUrls as unknown[]).map(String)
    : []
  const allProductImagePaths = [...thumbnailUrls, ...imageUrls]

  try {
    if (allProductImagePaths.length > 0) {
      // Giả sử deleteImages nhận mảng đường dẫn và xóa từ storage (local hoặc Cloudinary,...)
      await deleteImages(allProductImagePaths)
    }
  } catch (err) {
    console.error('Error deleting product images:', err)
    // Nếu xóa ảnh lỗi, không dừng quá trình xóa document, vẫn tiếp tục
  }

  // 4. Cập nhật ProductCategory: pull productId khỏi mảng products
  const categoryId = existingProduct.categoryIds?.toString()
  if (categoryId) {
    try {
      await ProductCategory.findByIdAndUpdate(categoryId, {
        $pull: { products: existingProduct._id },
      })
    } catch (err) {
      console.error(
        `Error pulling product from ProductCategory ${categoryId}:`,
        err,
      )
      // Không block lỗi, vẫn tiếp tục xóa product
    }
  }

  // 5. Cập nhật ProductBrand: pull productId khỏi mảng products
  const brandId = existingProduct.brandIds?.toString()
  if (brandId) {
    try {
      await ProductBrand.findByIdAndUpdate(brandId, {
        $pull: { products: existingProduct._id },
      })
    } catch (err) {
      console.error(`Error pulling product from ProductBrand ${brandId}:`, err)
      // Không block lỗi, vẫn tiếp tục xóa product
    }
  }

  // 6. Xóa document Product
  try {
    const removedProduct = await Product.findByIdAndDelete(productId)
    return res.status(200).json({
      success: true,
      data: removedProduct,
    })
  } catch (err: any) {
    console.error('Error deleting product from DB:', err)
    return res.status(500).json({
      success: false,
      message: `Xóa sản phẩm thất bại. Chi tiết lỗi: ${err.message}`,
    })
  }
})

/*
 * Hàm lấy sản phẩm theo slug
 * - Tìm product bất kỳ language nào có slug này
 * - Trả về bản dịch phù hợp với header Accept-Language hoặc bản đầu tiên nếu không tìm thấy
 */
export const getProductBySlug = expressAsyncHandler(
  async (req: any, res: any) => {
    const { slug } = req.params

    if (!slug) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing slug parameter' })
    }

    // Tìm product có bất kỳ translation.slug nào bằng slug này
    const product = await Product.findOne({ 'translations.slug': slug })
      .populate('translations.language')
      .populate('categoryIds')
      .populate('brandIds')
      .lean()

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' })
    }

    // Chọn bản dịch theo Accept-Language header (ví dụ: 'vi', 'en', 'cs')
    const acceptLang = req.headers['accept-language']?.split(',')[0] || ''
    let translation = product.translations.find(
      (t: any) => (t.language as any).code === acceptLang,
    )
    if (!translation) {
      translation = product.translations[0]
    }

    // Gửi về client cả product (bao gồm _id, price, v.v.) và luôn kèm translation đã chọn
    res.json({
      success: true,
      data: {
        ...product,
        translation,
      },
    })
  },
)

/**
 * GET /api/products/:slug/related
 * Trả về tối đa `limit` sản phẩm liên quan, ngẫu nhiên,
 * loại bỏ product đang xem dựa trên slug.
 */
export const getRelatedBySlug = expressAsyncHandler(
  async (req: any, res: any) => {
    const { slug } = req.params
    // parse limit, default = 10 nếu không hợp lệ
    const rawLimit = parseInt(req.query.limit as string, 10)
    const limit = rawLimit > 0 ? rawLimit : 10

    // 1) Lấy product hiện tại
    const current = await Product.findOne(
      { 'translations.slug': slug },
      { _id: 1, brandIds: 1 },
    ).lean()

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    // Nếu product không có brandIds thì trả về mảng rỗng
    if (!current.brandIds) {
      return res.json({
        success: true,
        count: 0,
        data: [],
      })
    }

    // 2) Build điều kiện match: cùng brandIds, khác chính nó
    const matchStage = {
      _id: { $ne: new mongoose.Types.ObjectId(current._id) },
      brandIds: new mongoose.Types.ObjectId(current.brandIds),
    }

    // 3) Aggregate: match → sample → project
    const relatedAgg = await Product.aggregate([
      { $match: matchStage },
      { $sample: { size: limit } },
      {
        $project: {
          cost: 0,
          quantity: 0,
          sold: 0,
        },
      },
    ])

    // 4) Populate sau khi aggregate
    const related = await Product.populate(relatedAgg, [
      {
        path: 'translations.language',
        model: Language,
        select: '_id name code',
      },
      {
        path: 'categoryIds',
        model: ProductCategory,
        select: '_id title slug',
      },
      {
        path: 'brandIds',
        model: ProductBrand,
        select: '_id name slug',
      },
    ])

    // 5) Trả về
    res.json({
      success: true,
      count: related.length,
      data: related,
    })
  },
)

export const getProductsByIds = expressAsyncHandler(
  async (req: any, res: any) => {
    const ids = (req.query.ids as string)
      .split(',')
      .filter(id => mongoose.Types.ObjectId.isValid(id))

    // Nếu không còn ID nào hợp lệ
    if (ids.length === 0) {
      return res
        .status(400)
        .json({ message: 'Invalid or missing product IDs.' })
    }

    const products = await Product.find({ _id: { $in: ids } }).select(
      '-cost -sold -quantity',
    )

    res.json({ data: products })
  },
)
