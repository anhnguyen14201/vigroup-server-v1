import expressAsyncHandler from 'express-async-handler'
import { Page } from '~/models/index.js'
import { deleteImages } from '~/utils/helps.js'
/**
 * Tạo Page mới
 * - Nếu gửi isActive: true, tất cả page khác sẽ bị set isActive = false
 */
export const createPage = expressAsyncHandler(async (req: any, res: any) => {
  const {
    translations: rawTranslations,
    page,
    articles: rawArticles,
    heroSections: rawHeroSections,
    ...rest
  } = req.body

  // 1) Parse translations
  let parsedTranslations: any[]
  try {
    parsedTranslations = Array.isArray(rawTranslations)
      ? rawTranslations
      : JSON.parse(rawTranslations)
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Field "translations" phải là JSON hoặc mảng.',
    })
  }
  if (!parsedTranslations.length) {
    return res.status(400).json({
      success: false,
      message: 'Field "translations" không được để trống.',
    })
  }

  // 2) Parse articles
  let parsedArticles: any[]
  try {
    parsedArticles = Array.isArray(rawArticles)
      ? rawArticles
      : JSON.parse(rawArticles)
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Field "articles" phải là JSON hoặc mảng.',
    })
  }
  let parsedHeroSections: any[]
  try {
    parsedHeroSections = Array.isArray(rawHeroSections)
      ? rawHeroSections
      : JSON.parse(rawHeroSections)
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Field "articles" phải là JSON hoặc mảng.',
    })
  }

  // 3) translations payload
  const translationsPayload = parsedTranslations.map(t => ({
    language: t.language,
    seoTitle: (t.seoTitle || '').trim(),
    seoDescription: (t.seoDescription || '').trim(),
  }))

  // 4) Handle file uploads
  const uploaded = Array.isArray(req.files) ? req.files : []

  const articleFilesByIdx: Record<number, string[]> = {}
  uploaded.forEach((f: any) => {
    const m = f.fieldname.match(/^articleImages\[(\d+)\]$/)
    if (m) {
      const idx = parseInt(m[1], 10)
      articleFilesByIdx[idx] = articleFilesByIdx[idx] || []
      articleFilesByIdx[idx].push(f.path)
    }
  })
  const heroSectionFilesByIdx: Record<number, string[]> = {}
  uploaded.forEach((f: any) => {
    const m = f.fieldname.match(/^heroSectionImages\[(\d+)\]$/)
    if (m) {
      const idx = parseInt(m[1], 10)
      heroSectionFilesByIdx[idx] = heroSectionFilesByIdx[idx] || []
      heroSectionFilesByIdx[idx].push(f.path)
    }
  })

  // 5) Map articles
  const processedArticles = parsedArticles.map((art, idx) => ({
    translations: Array.isArray(art.translations)
      ? art.translations.map((tr: any) => ({
          language: tr.language,
          sectionLabel: (tr.sectionLabel || '').trim(),
          heading: (tr.heading || '').trim(),
          subtext: (tr.subtext || '').trim(),
          features: Array.isArray(tr.features)
            ? tr.features
                .filter((f: any) => f != null)
                .map((f: any) => String(f).trim())
            : tr.features
              ? [String(tr.features).trim()]
              : [],
        }))
      : [],
    imageUrls: articleFilesByIdx[idx] || [],
    videoUrl: art.videoUrl,
    position: art.position,
  }))

  const processedHeroSections = parsedHeroSections.map((art, idx) => ({
    translations: Array.isArray(art.translations)
      ? art.translations.map((tr: any) => ({
          language: tr.language,
          heroSectionLabel: (tr.heroSectionLabel || '').trim(),
          heroHeading: (tr.heroHeading || '').trim(),
        }))
      : [],
    imageUrls: heroSectionFilesByIdx[idx] || [],
  }))

  // 6) Bật isActive cho page mới, block tất cả các page khác
  const payload = {
    page: (page || '').trim(),
    translations: translationsPayload,
    articles: processedArticles,
    heroSections: processedHeroSections,
    isActive: true,
    ...rest,
  }

  try {
    // Set tất cả page khác thành inactive
    await Page.updateMany({}, { isActive: false })
    // Tạo page mới active
    const newPage = await Page.create(payload)
    return res.status(201).json({ success: true, pageData: newPage })
  } catch (err: any) {
    console.error('Error in createPage:', err)
    if (err.code === 11000 && err.keyPattern?.page) {
      return res
        .status(409)
        .json({ success: false, message: 'Page này đã tồn tại.' })
    }
    return res
      .status(500)
      .json({ success: false, message: `Tạo trang thất bại: ${err.message}` })
  }
})

/**
 * Cập nhật Page
 * - Nếu gửi isActive = true, page này sẽ set active và các page khác bị block
 */
export const updatePage = expressAsyncHandler(async (req: any, res: any) => {
  const { pageId } = req.params
  const existingPage = await Page.findById(pageId)
  if (!existingPage) {
    return res
      .status(404)
      .json({ success: false, message: 'Trang không tồn tại' })
  }

  const {
    translations: rawTranslations,
    articles: rawArticles,
    heroSections: rawHeroSections,
    removedHeroUrls = [],
    removedArticleImageUrls = [],
    isActive: rawActive,
    ...rest
  } = req.body

  let parsedTranslations: any[] = []
  if (rawTranslations !== undefined) {
    try {
      parsedTranslations = Array.isArray(rawTranslations)
        ? rawTranslations
        : JSON.parse(rawTranslations)
    } catch {
      return res
        .status(400)
        .json({ success: false, message: 'Field "translations" phải là JSON' })
    }
  }

  let parsedArticles: any[] = []
  if (rawArticles !== undefined) {
    try {
      parsedArticles = Array.isArray(rawArticles)
        ? rawArticles
        : JSON.parse(rawArticles)
    } catch {
      return res
        .status(400)
        .json({ success: false, message: 'Field "articles" phải là JSON' })
    }
  }
  let parsedHeroSections: any[] = []
  if (rawHeroSections !== undefined) {
    try {
      parsedHeroSections = Array.isArray(rawHeroSections)
        ? rawHeroSections
        : JSON.parse(rawHeroSections)
    } catch {
      return res
        .status(400)
        .json({ success: false, message: 'Field "articles" phải là JSON' })
    }
  }

  const uploaded = Array.isArray(req.files) ? req.files : []

  const articleFilesByIdx: Record<number, string[]> = {}
  uploaded.forEach((f: any) => {
    const m = f.fieldname.match(/^articleImages\[(\d+)\]$/)
    if (m) {
      const idx = Number(m[1])
      articleFilesByIdx[idx] = articleFilesByIdx[idx] || []
      articleFilesByIdx[idx].push(f.path)
    }
  })

  const heroSectionFilesByIdx: Record<number, string[]> = {}
  uploaded.forEach((f: any) => {
    const m = f.fieldname.match(/^heroImages\[(\d+)\]$/)
    if (m) {
      const idx = Number(m[1])
      heroSectionFilesByIdx[idx] = heroSectionFilesByIdx[idx] || []
      heroSectionFilesByIdx[idx].push(f.path)
    }
  })

  const removedImgArr = Array.isArray(removedArticleImageUrls)
    ? removedArticleImageUrls
    : typeof removedArticleImageUrls === 'string'
      ? removedArticleImageUrls.split(',').map(s => s.trim())
      : []

  const removedHeroImgArr = Array.isArray(removedHeroUrls)
    ? removedHeroUrls
    : typeof removedHeroUrls === 'string'
      ? removedHeroUrls.split(',').map(s => s.trim())
      : []

  if (removedImgArr.length > 0) await deleteImages(removedImgArr)
  if (removedHeroImgArr.length > 0) await deleteImages(removedHeroImgArr)

  let updatedArticles = parsedArticles.map((art, idx) => {
    const oldUrls =
      art.imageUrls?.filter((u: string) => !removedImgArr.includes(u)) || []
    const newImg = articleFilesByIdx[idx] || []
    const translations = Array.isArray(art.translations)
      ? art.translations.map((tr: any) => ({
          language: tr.language,
          sectionLabel: (tr.sectionLabel || '').trim(),
          heading: (tr.heading || '').trim(),
          subtext: (tr.subtext || '').trim(),
          features: Array.isArray(tr.features)
            ? tr.features
                .filter((f: any) => f != null)
                .map((f: any) => String(f).trim())
            : tr.features
              ? [String(tr.features).trim()]
              : [],
        }))
      : []
    return {
      translations,
      position: art.position,
      videoUrl: art.videoUrl,
      imageUrls: [...oldUrls, ...newImg],
    }
  })
  let updatedHeroSections = parsedHeroSections.map((art, idx) => {
    const oldUrls =
      art.imageUrls?.filter((u: string) => !removedHeroImgArr.includes(u)) || []
    const newImg = heroSectionFilesByIdx[idx] || []
    const translations = Array.isArray(art.translations)
      ? art.translations.map((tr: any) => ({
          language: tr.language,
          heroSectionLabel: (tr.heroSectionLabel || '').trim(),
          heroHeading: (tr.heroHeading || '').trim(),
        }))
      : []
    return {
      translations,
      imageUrls: [...oldUrls, ...newImg],
    }
  })

  const isActive =
    rawActive !== undefined
      ? rawActive === true || rawActive === 'true'
      : existingPage.isActive

  const payloadUpdate = {
    translations: parsedTranslations.map(t => ({
      language: t.language,
      seoTitle: t.seoTitle?.trim() || '',
      seoDescription: t.seoDescription?.trim() || '',
    })),
    articles: updatedArticles,
    heroSections: updatedHeroSections,
    isActive,
    ...rest,
  }

  try {
    if (isActive) {
      await Page.updateMany({ _id: { $ne: pageId } }, { isActive: false })
    }
    const updated = await Page.findByIdAndUpdate(pageId, payloadUpdate, {
      new: true,
      runValidators: true,
    })
    return res.status(200).json({ success: true, pageData: updated })
  } catch (err: any) {
    console.error('Error updating page:', err)
    return res
      .status(500)
      .json({ success: false, message: `Cập nhật thất bại: ${err.message}` })
  }
})

/**
 * Xóa Page
 * - Nếu xóa page đang active, sẽ auto set page mới nhất còn lại thành active
 */
export const deletePage = expressAsyncHandler(async (req: any, res: any) => {
  const { pageId } = req.params
  const existingPage = await Page.findById(pageId)
  if (!existingPage) {
    return res
      .status(404)
      .json({ success: false, message: 'Trang không tồn tại' })
  }

  const wasActive = existingPage.isActive

  const heroImages = (existingPage as any).heroImageUrls || []
  const articleImages =
    existingPage.articles?.flatMap((a: any) =>
      Array.isArray(a.imageUrls) ? a.imageUrls : [],
    ) || []
  const allImgs = [...heroImages, ...articleImages]
  if (allImgs.length > 0)
    await deleteImages(allImgs).catch(err =>
      console.warn('Error deleting images:', err),
    )

  await Page.findByIdAndDelete(pageId)

  if (wasActive) {
    const lastOne = await Page.findOne().sort({ updatedAt: -1 })
    if (lastOne) {
      await Page.findByIdAndUpdate(lastOne._id, { isActive: true })
    }
  }

  return res.status(200).json({ success: true, message: 'Xoá thành công' })
})

export const getAllPages = expressAsyncHandler(async (req: any, res: any) => {
  try {
    const pages = await Page.find().lean()
    return res.status(200).json({ success: true, data: pages })
  } catch (err: any) {
    console.error('Error fetching all pages:', err)
    return res.status(500).json({
      success: false,
      message: `Lấy danh sách trang thất bại: ${err.message}`,
    })
  }
})

export const getPageByIdentifier = expressAsyncHandler(
  async (req: any, res: any) => {
    const { page } = req.params
    if (!page) {
      return res
        .status(400)
        .json({ success: false, message: 'Thiếu param page' })
    }
    try {
      const pageDoc = await Page.findOne({ page: page.trim() }).lean()
      return res.status(200).json({ success: true, data: pageDoc })
    } catch (err: any) {
      console.error('Error fetching page by identifier:', err)
      return res.status(500).json({
        success: false,
        message: `Lấy trang thất bại: ${err.message}`,
      })
    }
  },
)
