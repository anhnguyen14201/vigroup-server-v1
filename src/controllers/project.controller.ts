import expressAsyncHandler from 'express-async-handler'
import slugifyModule from 'slugify'
const slugify = slugifyModule.default || slugifyModule
import { IUser } from '~/interface/index.js'
import {
  Attendance,
  ProgressEntry,
  Project,
  ProjectType,
  Quotation,
  User,
} from '~/models/index.js'
import { deleteImages } from '~/utils/index.js'

//* Hàm sinh slug duy nhất cho projectName
async function generateUniqueSlug(
  projectName: string,
  excludeProjectId?: string,
): Promise<string> {
  const baseSlug = slugify(projectName.trim(), {
    lower: true,
    strict: true,
    locale: 'vi',
  })
  let newSlug = baseSlug
  let count = 1

  // Kiểm tra xem đã tồn tại slug newSlug chưa (và không phải chính project đang update)
  while (
    await Project.exists({
      'translations.slug': newSlug,
      ...(excludeProjectId ? { _id: { $ne: excludeProjectId } } : {}),
    })
  ) {
    newSlug = `${baseSlug}-${count}`
    count++
  }

  return newSlug
}

//* Tạo mới dự án
export const createProject = expressAsyncHandler(async (req: any, res: any) => {
  // 1. Destructure rawTranslations, rawCode, rawProjectType
  const {
    translations: rawTranslations,
    code: rawCode,
    projectType: rawProjectType,
    ...rest
  } = req.body

  // 2. Parse rawTranslations thành mảng JS
  let parsedTranslations: any[]
  try {
    if (Array.isArray(rawTranslations)) {
      parsedTranslations = rawTranslations
    } else {
      parsedTranslations = JSON.parse(rawTranslations)
    }
  } catch (e) {
    console.error('Error parsing rawTranslations:', e)
    return res.status(400).json({
      success: false,
      message: 'Field "translations" phải là JSON hợp lệ hoặc mảng.',
    })
  }

  // 3. Bắt buộc parsedTranslations phải là mảng không rỗng
  if (!Array.isArray(parsedTranslations) || parsedTranslations.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Field "translations" phải là mảng và không được để trống.',
    })
  }

  // 4. Lấy code, projectType (trim)
  const code = typeof rawCode === 'string' ? rawCode.trim() : undefined
  const projectType = rawProjectType
  if (!projectType) {
    return res.status(400).json({
      success: false,
      message: 'Field "projectType" là bắt buộc.',
    })
  }

  // 5. Lấy file từ req.files (Multer đã cấu hình upload.fields)
  const filesMap = (req.files as { [key: string]: Express.Multer.File[] }) || {}
  const thumbnailFiles: Express.Multer.File[] = Array.isArray(
    filesMap.thumbnail,
  )
    ? filesMap.thumbnail
    : []
  const imageFiles: Express.Multer.File[] = Array.isArray(filesMap.images)
    ? filesMap.images
    : []

  // 6. Map file.path → mảng URL/paths
  const thumbnailPaths = thumbnailFiles.map(file => file.path)
  const imagePaths = imageFiles.map(file => file.path)

  // 7. Xử lý parsedTranslations: validate và tạo slug duy nhất
  let processedTranslations: any[] = []
  try {
    // Duyệt từng object translation, generateUniqueSlug sẽ truy DB
    processedTranslations = await Promise.all(
      parsedTranslations.map(async (t: any) => {
        const {
          projectName,
          language,
          buildingType,
          description,
          metaTitle,
          metaDescription,
        } = t
        /*         if (!projectName || !language) {
          throw new Error('Mỗi translation phải có projectName và language.')
        } */
        // Sinh slug unique (hàm này tự thêm -1, -2 khi trùng)
        const slug = await generateUniqueSlug(projectName)
        return {
          language,
          projectName: projectName.trim(),
          description: (description || '').trim(),
          buildingType: (buildingType || '').trim(),
          slug,
          metaTitle: (metaTitle || '').trim(),
          metaDescription: (metaDescription || '').trim(),
        }
      }),
    )
  } catch (transErr: any) {
    console.error('Error processing parsedTranslations:', transErr)
    return res.status(400).json({
      success: false,
      message: transErr.message,
    })
  }

  // 8. Đóng gói payload
  const payload: any = {
    code,
    projectType,
    translations: processedTranslations, // mảng object với slug đã unique
    thumbnailUrls: thumbnailPaths,
    imageUrls: imagePaths,
    ...rest,
  }

  // 9. Lưu vào DB và cập nhật ProjectType
  try {
    const newProject = await Project.create(payload)

    const updatedProjectType = await ProjectType.findByIdAndUpdate(
      projectType,
      { $addToSet: { projectIds: newProject._id } },
    )
    if (!updatedProjectType) {
      // Nếu không tìm thấy projectType, xóa project mới tạo để tránh rác
      await Project.findByIdAndDelete(newProject._id)
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ProjectType để cập nhật.',
      })
    }

    return res.status(201).json({
      success: true,
      projectData: newProject,
    })
  } catch (err: any) {
    console.error('Error in createProject:', err)
    if (err.code === 11000 && err.keyPattern?.['translations.slug']) {
      return res.status(409).json({
        success: false,
        message:
          'Một trong các slug đã tồn tại. Vui lòng đổi projectName khác.',
      })
    }
    return res.status(500).json({
      success: false,
      message: `Tạo dự án thất bại. Chi tiết lỗi: ${err.message}`,
    })
  }
})

//* Lấy danh sách tất cả dự án với filter, pagination, sorting
//* @desc    Get all projects
//* @route   GET /api/project
export const getAllProjects = expressAsyncHandler(async (req, res) => {
  // 1. Xây dựng bộ lọc cơ bản từ req.query
  // Loại bỏ các trường không dùng cho filter: limit, sort, page, fields, value

  const user = req.user as IUser | undefined
  const adminRoles = [3515, 1413914, 1311417518]
  const isAdmin = user ? adminRoles.includes(user.role) : false
  const baseFilter = isAdmin ? {} : { showProject: true }

  const queries = { ...req.query }

  const excludeFields = [
    'limit',
    'sort',
    'page',
    'fields',
    'searchTerm',
    'kind',
    'userId',
    'projectType',
  ]
  excludeFields.forEach(field => delete queries[field])

  // 2. Nếu có các thông số lọc, chuyển các toán tử (gte, gt, lt, lte) sang dạng MongoDB
  let filters: Record<string, any> = {}
  if (Object.keys(queries).length > 0) {
    let queryStr = JSON.stringify(queries)
    queryStr = queryStr.replace(/\b(gte|gt|lt|lte)\b/g, match => `$${match}`)
    filters = JSON.parse(queryStr)
  }

  // 3. Thêm filter showProject chỉ cho người không phải admin
  /*   if (!req.user || ![3515, 1413914].includes(req.user.role)) {
    filters.showProject = true
  }
 */
  // 3. Nếu có tham số tìm kiếm (value), thêm điều kiện tìm kiếm theo $or

  if (req.query.searchTerm) {
    const searchValue = req.query.searchTerm
    filters = {
      ...filters,
      $or: [
        { code: { $regex: searchValue, $options: 'i' } },
        { projectName: { $regex: searchValue, $options: 'i' } },
      ],
    }
  }

  if (req.query.kind) {
    filters.kind = req.query.kind
  }

  if (req.query.userId) {
    filters.customer = req.query.userId
  }

  if (req.query.projectType) {
    filters.projectType = req.query.projectType
  }

  const finalFilter = { ...baseFilter, ...filters }

  // 4. Xây dựng câu lệnh query với filters, kèm theo populate trường customerUser
  let q = Project.find(finalFilter)

  // 5. Sắp xếp kết quả nếu có tham số sort
  // 6. Sắp xếp
  if (typeof req.query.sort === 'string') {
    q = q.sort(req.query.sort.split(',').join(' '))
  } else {
    // Mặc định lấy dự án mới tạo trước
    q = q.sort('-createdAt')
  }

  // 6. Giới hạn các trường được trả về, nếu có tham số fields
  if (typeof req.query.fields === 'string') {
    q = q.select(req.query.fields.split(',').join(' '))
  }

  // 7. Xử lý phân trang
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10)
  const skip = (page - 1) * limit
  q = q.skip(skip).limit(limit)

  if (isAdmin) {
    q = q.populate(
      'customerUser translations.language',
      '-password -refreshTokens',
    )
  } else {
    // 5. Chỉ admin mới populate các trường nhạy cảm
    q = q.select(
      '_id imageUrls thumbnailUrls location projectType translations',
    )
  }
  // 8. Thực thi query và đếm số bản ghi phù hợp với filters
  const projects = await q
  const counts = await Project.countDocuments(finalFilter)
  // 9. Tính lại & lưu xuống DB
  await Promise.all(
    projects.map(async project => {
      // Tính toán lại
      const deposit = project.depositAmount || 0
      const paymentsSum = (project.paymentAmounts || []).reduce(
        (a: any, v: any) => a + v,
        0,
      ) as any
      const totalRecvd = deposit + paymentsSum

      // Gán lại
      project.totalPaidAmount = paymentsSum
      project.totalReceived = totalRecvd

      if (
        project.totalAmount == null ||
        (typeof project.totalAmount === 'number' && project.totalAmount <= 0)
      ) {
        project.paymentStatus = 'processing'
      } else if (totalRecvd === 0) {
        project.paymentStatus = 'unpaid'
      } else if (
        typeof deposit === 'number' &&
        deposit > 0 &&
        paymentsSum === 0
      ) {
        project.paymentStatus = 'deposited'
      } else if (totalRecvd < project.totalAmount) {
        project.paymentStatus = 'partial'
      } else {
        project.paymentStatus = 'paid'
      }

      const empIds = await Attendance.distinct('employeeId', {
        projectId: project._id,
      })
      const participantCount = empIds.length

      // Lưu nếu có thay đổi
      await project.save()
      return { project, participantCount }
    }),
  )

  const responseData = projects.map((project, participantCount) => {
    const obj = project.toObject()
    if (!isAdmin) {
      delete obj.paymentStatus
      delete obj.totalPaidAmount
      delete obj.totalReceived
    }
    return { ...obj, participantCount }
  })

  // 9. Trả về kết quả dưới dạng JSON
  res.json({
    success: true,
    totalItems: counts,
    totalPages: Math.ceil(counts / limit),
    currentPage: page,
    data: responseData,
  })
})

export const getAllProjectsForEmployee = expressAsyncHandler(
  async (req, res) => {
    const user = req.user as IUser | undefined
    const adminRoles = [5131612152555]
    const isAdmin = user ? adminRoles.includes(user.role) : false

    // 1. Base filter (cho non-admin chỉ showProject, và luôn lọc status = 'started')
    const baseFilter: Record<string, any> = isAdmin
      ? { status: 'started' }
      : { showProject: true, status: 'started' }

    // 2. Xử lý filter từ req.query (ngoại trừ các trường không dùng để lọc)
    const queries = { ...req.query }
    ;[
      'limit',
      'sort',
      'page',
      'fields',
      'searchTerm',
      'kind',
      'userId',
      'projectType',
    ].forEach(f => delete queries[f])

    let filters: Record<string, any> = {}
    if (Object.keys(queries).length) {
      let qs = JSON.stringify(queries).replace(
        /\b(gte|gt|lt|lte)\b/g,
        match => `$${match}`,
      )
      filters = JSON.parse(qs)
    }

    // 3. Thêm tìm kiếm theo searchTerm nếu có
    if (req.query.searchTerm) {
      const q = req.query.searchTerm as string
      filters.$or = [
        { code: { $regex: q, $options: 'i' } },
        { projectName: { $regex: q, $options: 'i' } },
      ]
    }

    // 4. Nếu có kind, userId, projectType trong query thì thêm vào filters
    if (req.query.kind) filters.kind = req.query.kind
    if (req.query.userId) filters.customer = req.query.userId
    if (req.query.projectType) filters.projectType = req.query.projectType

    // 5. Gộp baseFilter + filters + bắt buộc status = 'started'
    const finalFilter = { ...baseFilter, ...filters, status: 'started' }

    // 6. Build query
    let q = Project.find(finalFilter)

    // 7. Sorting
    if (typeof req.query.sort === 'string') {
      q = q.sort(req.query.sort.split(',').join(' '))
    } else {
      q = q.sort('-createdAt')
    }

    // 8. Projection nếu có fields
    if (typeof req.query.fields === 'string') {
      q = q.select(req.query.fields.split(',').join(' '))
    }

    // 9. Pagination
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
    const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10)
    q = q.skip((page - 1) * limit).limit(limit)

    // 10. Populate (tuỳ admin)
    if (isAdmin) {
      q = q
        .select('_id translations')
        .populate('translations.language', 'code name')
    } else {
      q = q.select('_id imageUrls thumbnailUrls projectType translations')
    }

    // 11. Thực thi
    const projects = await q
    const total = await Project.countDocuments(finalFilter)

    // 12. Cập nhật lại paymentStatus … tương tự như trước
    await Promise.all(
      projects.map(async project => {
        // … (đoạn tính toán paymentStatus giống cũ)
        return project.save()
      }),
    )

    // 13. Chuẩn bị response
    const responseData = projects.map(p => {
      const o = p.toObject()
      if (!isAdmin) {
        delete o.paymentStatus
        delete o.totalPaidAmount
        delete o.totalReceived
      }
      return o
    })

    res.json({
      success: true,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: responseData,
    })
  },
)

//* Lấy tất cả dự án theo id của người dùng
export const getProjectsByUser = expressAsyncHandler(
  async (req: any, res: any) => {
    // 1. Bắt buộc phải auth
    const user = req.user as IUser | undefined
    if (!user) {
      res.status(401)
      throw new Error('Bạn phải đăng nhập để xem dự án của mình')
    }

    // 2. Filter theo customerUser (dạng array), dùng $in để cover cả khi user trong mảng
    const filters: Record<string, any> = {
      customerUser: { $in: [user._id] },
    }

    // 3. Search theo searchTerm nếu có
    if (
      typeof req.query.searchTerm === 'string' &&
      req.query.searchTerm.trim()
    ) {
      const term = (req.query.searchTerm as string).trim()
      filters.$or = [
        { code: { $regex: term, $options: 'i' } },
        { 'translations.projectName': { $regex: term, $options: 'i' } },
      ]
    }

    // 4. Build query, sort, select fields
    let q = Project.find(filters)

    if (typeof req.query.sort === 'string') {
      q = q.sort((req.query.sort as string).split(',').join(' '))
    } else {
      q = q.sort('-createdAt')
    }

    if (typeof req.query.fields === 'string') {
      q = q.select((req.query.fields as string).split(',').join(' '))
    }

    // 5. Phân trang
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
    const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10)
    const skip = (page - 1) * limit
    q = q.skip(skip).limit(limit)

    // 6. Populate customerUser và translations.language (nếu cần)
    q = q.populate([
      { path: 'customerUser', select: '-password -refreshTokens' },
      { path: 'translations.language', select: 'name code' },
    ])

    // 7. Execute và count
    const [projects, totalItems] = await Promise.all([
      q.exec(),
      Project.countDocuments(filters),
    ])

    // 8. Trả về kết quả
    res.json({
      success: true,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      data: projects,
    })
  },
)
//* Lấy thông tin dự án theo id
export const getProjectById = expressAsyncHandler(async (req, res) => {
  const { projectId } = req.params
  // 1. Lấy project và populate các quan hệ
  const project = await Project.findById(projectId).populate([
    'customerUser',
    'employees',
    'dailyProgress',
    'translations.language',
    {
      path: 'quotes',
      options: { sort: { createdAt: -1 } },
    },
  ])

  if (!project) {
    res.status(404).json({ success: false, message: 'Project not found.' })
    return
  }

  // 2. Tính lại các trường liên quan đến thanh toán
  const deposit = project.depositAmount || 0
  const paymentsSum = (project.paymentAmounts || []).reduce(
    (a: any, v: any) => a + v,
    0,
  ) as any
  const totalRecvd = deposit + paymentsSum

  // 3. Gán lại các giá trị
  project.totalPaidAmount = paymentsSum
  project.totalReceived = totalRecvd

  // 4. Xác định paymentStatus mới
  let newStatus: string
  if (
    project.totalAmount == null ||
    (typeof project.totalAmount === 'number' && project.totalAmount <= 0)
  ) {
    newStatus = 'processing'
  } else if (totalRecvd === 0) {
    newStatus = 'unpaid'
  } else if (typeof deposit === 'number' && deposit > 0 && paymentsSum === 0) {
    newStatus = 'deposited'
  } else if (
    typeof project.totalAmount === 'number' &&
    totalRecvd < project.totalAmount
  ) {
    newStatus = 'partial'
  } else {
    newStatus = 'paid'
  }

  // 5. Chỉ lưu nếu có sự thay đổi về status để tránh I/O không cần thiết
  if (project.paymentStatus !== newStatus) {
    project.paymentStatus = newStatus
    await project.save()
  }

  // 6. Trả về kết quả
  res.status(200).json({ success: true, data: project })
})

//* Lấy thông tin dự án theo slug
export const getProjectBySlug = expressAsyncHandler(
  async (req: any, res: any) => {
    const { slug } = req.params

    // 1. Tìm project chứa slug trong translations
    const project = await Project.findOne({
      'translations.slug': slug,
    }).populate([
      'customerUser',
      'dailyProgress',
      'translations.language',
      {
        path: 'quotes',
        options: { sort: { createdAt: -1 } },
      },
    ])

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: 'Project not found.' })
    }

    // 2. (Tùy chọn) Lấy riêng object translation tương ứng với slug
    //    để trả về name/description đúng ngôn ngữ.
    const translation = project.translations.find((t: any) => t.slug === slug)
    // Nếu cần, có thể gán vào 1 field riêng:
    const result = {
      ...project.toObject(),
      currentTranslation: translation || null,
    }

    // 3. Trả về project kèm translation
    res.status(200).json({ success: true, data: result })
  },
)

//* Chỉnh sửa thông tin dự án
//* @desc    Update project
//* @route   PUT /api/project/:projectId
export const updateProject = expressAsyncHandler(async (req: any, res: any) => {
  const { projectId } = req.params
  const currentUser = req.user
    ? { role: req.user.role, _id: req.user._id.toString() }
    : { role: 0, _id: '' }

  // 1. Phân quyền
  const allowedRoles = [3515, 1413914, 1311417518]
  if (!allowedRoles.includes(currentUser.role)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to update project',
    })
  }

  // 2. Tìm project hiện tại
  const existingProject = await Project.findById(projectId)
  if (!existingProject) {
    return res.status(404).json({
      success: false,
      message: 'Project not found',
    })
  }

  // 3. Nếu không có gì để cập nhật
  if (
    Object.keys(req.body).length === 0 &&
    Object.keys((req.files as object) || {}).length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'No project data to update',
    })
  }

  // 4. Destructure rawTranslations, rawCode, rawProjectType, phần còn lại
  const {
    translations: rawTranslations,
    code: rawCode,
    projectType: rawProjectType,
    removedImageUrls = [],
    ...restFields
  } = req.body

  // 5. Parse rawTranslations
  let parsedTranslations: any[] = []
  if (rawTranslations !== undefined) {
    try {
      if (Array.isArray(rawTranslations)) {
        parsedTranslations = rawTranslations
      } else {
        parsedTranslations = JSON.parse(rawTranslations)
      }
    } catch (e) {
      console.error('Error parsing rawTranslations:', e)
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

  // 6. Xử lý code và projectType (nếu client có gửi)
  const code =
    typeof rawCode === 'string' ? rawCode.trim() : existingProject.code
  const newProjectType = rawProjectType || existingProject.projectType

  // 7. Xử lý file upload (Multer config)
  const filesMap = (req.files as { [key: string]: Express.Multer.File[] }) || {}
  const thumbnailFiles: Express.Multer.File[] = Array.isArray(
    filesMap.thumbnail,
  )
    ? filesMap.thumbnail
    : []
  const imageFiles: Express.Multer.File[] = Array.isArray(filesMap.images)
    ? filesMap.images
    : []

  // 7.1. Lấy thumbnailPaths và imagePaths, giữ lại URL cũ nếu không có upload
  let thumbnailPaths: string[] = Array.isArray(existingProject.thumbnailUrls)
    ? existingProject.thumbnailUrls.map(String)
    : []
  let imagePaths: string[] = Array.isArray(existingProject.imageUrls)
    ? existingProject.imageUrls.map(String)
    : []

  if (thumbnailFiles.length > 0) {
    thumbnailPaths = thumbnailFiles.map(file => file.path)
  }
  if (imageFiles.length > 0) {
    const newImages = imageFiles.map(file => file.path)
    imagePaths = [...imagePaths, ...newImages]
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

  // 8. Xử lý parsedTranslations và generateUniqueSlug (nếu có gửi translations)
  let processedTranslations: any[] = existingProject.translations || []
  if (parsedTranslations.length > 0) {
    try {
      processedTranslations = await Promise.all(
        parsedTranslations.map(async (t: any) => {
          const {
            projectName,
            language,
            buildingType,
            description,
            metaTitle,
            metaDescription,
          } = t
          /*      if (!projectName || !language) {
            throw new Error('Mỗi translation phải có projectName và language.')
          } */
          // Tạo slug duy nhất, exclude chính projectId đang update
          const slug = await generateUniqueSlug(projectName.trim(), projectId)
          return {
            language,
            projectName: projectName.trim(),
            buildingType: (buildingType || '').trim(),
            description: (description || '').trim(),
            slug,
            metaTitle: (metaTitle || '').trim(),
            metaDescription: (metaDescription || '').trim(),
          }
        }),
      )
    } catch (transErr: any) {
      console.error('Error processing parsedTranslations:', transErr)
      return res.status(400).json({
        success: false,
        message: transErr.message,
      })
    }
  }

  // 9. Đóng gói payload để update
  const payloadUpdate: any = {
    ...restFields,
    code,
    projectType: newProjectType,
    translations: processedTranslations,
    thumbnailUrls: thumbnailPaths,
    imageUrls: imagePaths,
  }

  // 10. Thực hiện cập nhật
  try {
    const oldProjectType = existingProject.projectType?.toString() || null
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      payloadUpdate,
      { new: true, runValidators: true },
    )
    if (!updatedProject) {
      return res.status(500).json({
        success: false,
        message: 'Cập nhật dự án thất bại.',
      })
    }

    // 11. Cập nhật ProjectType nếu có thay đổi
    if (oldProjectType !== newProjectType) {
      if (oldProjectType) {
        await ProjectType.findByIdAndUpdate(oldProjectType, {
          $pull: { projectIds: updatedProject._id },
        })
      }
      await ProjectType.findByIdAndUpdate(newProjectType, {
        $addToSet: { projectIds: updatedProject._id },
      })
    }

    return res.status(200).json({
      success: true,
      projectData: updatedProject,
    })
  } catch (err: any) {
    console.error('Error in updateProject:', err)
    if (err.code === 11000 && err.keyPattern?.['translations.slug']) {
      return res.status(409).json({
        success: false,
        message:
          'Một trong các slug đã tồn tại. Vui lòng đổi projectName khác.',
      })
    }
    return res.status(500).json({
      success: false,
      message: `Cập nhật dự án thất bại. Chi tiết lỗi: ${err.message}`,
    })
  }
})

//* Xóa dự án
//* @desc    Delete project
//* @route   DELETE /api/project/:projectId
export const deleteProject = expressAsyncHandler(async (req: any, res: any) => {
  // 1. Lấy thông tin người dùng hiện tại (đã được middleware xác thực)
  const currentUser = req.user
    ? { _id: req.user._id.toString(), role: req.user.role }
    : { _id: '', role: 0 }
  const currentUserRole = currentUser.role

  // 2. Lấy projectId từ params
  const projectIdToRemove = req.params.projectId

  // 3. Kiểm tra phân quyền (chỉ những role được phép mới xóa)
  const allowedRoles = [3515, 1413914, 1311417518]
  if (!allowedRoles.includes(currentUserRole)) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xóa dự án này',
    })
  }

  // 4. Tìm dự án cần xóa
  const projectToRemove = await Project.findById(projectIdToRemove)
  if (!projectToRemove) {
    return res.status(404).json({
      success: false,
      message: 'Project not found',
    })
  }

  // 5. Xóa các Quotation nếu có
  if (
    Array.isArray(projectToRemove.quotes) &&
    projectToRemove.quotes.length > 0
  ) {
    await Quotation.deleteMany({ _id: { $in: projectToRemove.quotes } })
  }

  // 6. Xóa ảnh nằm trong các ProgressEntry
  if (
    Array.isArray(projectToRemove.dailyProgress) &&
    projectToRemove.dailyProgress.length > 0
  ) {
    // 6.1. Trước hết, tìm các ProgressEntry này để lấy ra imageUrls
    const progressEntries = await ProgressEntry.find({
      _id: { $in: projectToRemove.dailyProgress },
    })

    // 6.2. Gom tất cả imageUrls từ mỗi ProgressEntry vào một mảng duy nhất
    const allProgressImageUrls: string[] = progressEntries.flatMap(pe =>
      Array.isArray(pe.imageUrls) ? pe.imageUrls : [],
    )

    // 6.3. Gọi deleteImages để xóa tất cả các file này
    try {
      if (allProgressImageUrls.length > 0) {
        await deleteImages(allProgressImageUrls)
      }
    } catch (err) {
      console.error('Error deleting progress entry images:', err)
      // Nếu xóa ảnh lỗi, ta vẫn tiếp tục xóa document để tránh “dữ liệu treo”.
    }

    // 6.4. Sau khi đã xóa ảnh, xóa toàn bộ ProgressEntry
    await ProgressEntry.deleteMany({
      _id: { $in: projectToRemove.dailyProgress },
    })
  }

  // 7. Xóa file ảnh thumbnail + image của chính Project
  const thumbUrls: string[] = Array.isArray(projectToRemove.thumbnailUrls)
    ? (projectToRemove.thumbnailUrls as unknown[]).map(String)
    : []
  const imageUrls: string[] = Array.isArray(projectToRemove.imageUrls)
    ? (projectToRemove.imageUrls as unknown[]).map(String)
    : []
  const allProjectImagePaths = [...thumbUrls, ...imageUrls]

  try {
    if (allProjectImagePaths.length > 0) {
      await deleteImages(allProjectImagePaths)
    }
  } catch (err) {
    console.error('Error deleting project images:', err)
    // Nếu xóa ảnh lỗi, ta vẫn tiếp tục xóa project trong DB
  }

  // 8. Cập nhật quan hệ ProjectType:
  //    – Loại bỏ projectId khỏi projectIds của ProjectType cũ (nếu có)
  const oldProjectTypeId = projectToRemove.projectType?.toString()
  if (oldProjectTypeId) {
    await ProjectType.findByIdAndUpdate(oldProjectTypeId, {
      $pull: { projectIds: projectToRemove._id },
    })
  }

  // 9. Thực hiện xóa Project
  const removedProject = await Project.findByIdAndDelete(projectIdToRemove)

  // 10. Trả về kết quả
  return res.status(200).json({
    success: !!removedProject,
    data: removedProject,
  })
})

//* Cập nhật trạng thái dự án
export const updateProjectStatus = expressAsyncHandler(async (req, res) => {
  const { status } = req.body

  const { id } = req.params

  if (!id || !status) {
    res
      .status(400)
      .json({ success: false, message: 'Project ID và status là bắt buộc.' })
    return
  }

  const validStatuses = ['started', 'finished', 'cancelled']
  if (!validStatuses.includes(status)) {
    res.status(400).json({ success: false, message: 'Invalid status.' })
    return
  }

  const updateData: Partial<Record<string, any>> = { status }
  if (status === 'started') updateData.startDate = new Date()
  if (status === 'finished') updateData.endDate = new Date()

  // Tìm và cập nhật dự án theo projectId
  const updatedProject = await Project.findByIdAndUpdate(
    id,
    updateData,
    { new: true }, // Tùy chọn này để trả về tài liệu sau khi cập nhật
  )

  if (!updatedProject) {
    res.status(400).json({ success: false, message: 'Project not found' })
    return
  }

  res.status(200).json({
    success: true,
    projectData: updatedProject,
  })
})

/*
 * Hàm thêm customerUser (user _id) vào dự án.
 * @param projectId - _id của dự án
 * @param userId - _id của user cần thêm
 * @returns Dự án sau khi cập nhật
 */
export const addCustomerUser = expressAsyncHandler(async (req, res) => {
  const { projectId, userId } = req.body

  // Kiểm tra dữ liệu đầu vào
  if (!projectId || !userId) {
    res.status(400).json({
      success: false,
      message: 'Project ID và User ID là bắt buộc.',
    })
    return
  }

  // 0. Lấy thông tin user từ CSDL
  const userDoc = await User.findById(userId)
  if (!userDoc) {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy khách hàng với ID đã cung cấp.',
    })
    return
  }

  // 1. Kiểm tra trạng thái block của khách hàng
  if (userDoc.isBlock) {
    res.status(400).json({
      success: false,
      message: 'Khách hàng này đang bị block nên không thể thêm vào dự án.',
    })
    return
  }

  // 2. Lấy document dự án (không dùng .lean() để giữ khả năng populate)
  const projectDoc = await Project.findById(projectId)
  if (!projectDoc) {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy dự án với ID đã cung cấp.',
    })
    return
  }

  // 3. Kiểm tra xem user đã có trong customerUser chưa
  const exists = projectDoc.customerUser.some(id => id.toString() === userId)
  if (exists) {
    res.status(200).json({
      success: false,
      message: 'Khách hàng này đã được thêm vào dự án trước đó.',
    })
    return
  }

  // 4. Nếu chưa có, cập nhật dự án bằng $addToSet (đảm bảo không thêm trùng lặp)
  const updatedProject = await Project.findByIdAndUpdate(
    projectId,
    { $addToSet: { customerUser: userId } },
    { new: true },
  ).populate({
    path: 'customerUser',
    options: { sort: { createdAt: -1 } },
  })

  // 5. Cập nhật lại thông tin của user bằng cách thêm projectId vào trường projects
  const updateUser = await User.findByIdAndUpdate(userId, {
    $addToSet: {
      projects: projectId,
    },
  })
  if (!updateUser) throw new Error('Update user is unsuccessful')

  res.status(200).json({
    success: true,
    message: 'Đã thêm khách hàng vào dự án thành công.',
    projectData: updatedProject,
  })
})

/* Hàm xóa customerUser (user _id) khỏi dự án
 * @param projectId - _id của dự án
 * @param userId - _id của user cần xóa
 * @returns Dự án sau khi cập nhật
 */
export const removeCustomerUser = expressAsyncHandler(async (req, res) => {
  const { projectId, userId } = req.params

  if (!projectId || !userId) {
    res.status(400).json({
      success: false,
      message: 'Project ID và User ID là bắt buộc.',
    })
    return
  }

  // 1. Lấy project hiện tại
  const project = await Project.findById(projectId)
    .select('customerUser')
    .lean()

  if (!project) {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy dự án với ID đã cung cấp.',
    })
    return
  }

  // 2. Kiểm tra xem userId có tồn tại trong customerUser không
  const exists = project.customerUser.map(id => id.toString()).includes(userId)
  if (!exists) {
    res.status(200).json({
      success: false,
      message: 'Khách hàng này không tồn tại trong dự án.',
    })
    return
  }

  // 3. Thực hiện xóa bằng $pull
  const updatedProject = await Project.findByIdAndUpdate(
    projectId,
    { $pull: { customerUser: userId } },
    { new: true },
  )

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $pull: { projects: projectId } },
    { new: true },
  )

  if (!updatedUser) throw new Error('Update category is unsuccessful')

  res.status(200).json({
    success: true,
    message: 'Đã xóa khách hàng khỏi dự án thành công.',
    projectData: updatedProject,
  })
})

//* Add deposit
export const createDeposit = expressAsyncHandler(async (req, res) => {
  const { id } = req.params
  const { amount } = req.body
  if (amount == null || amount < 0) {
    res.status(400).json({ error: 'Invalid deposit amount' })
    return
  }

  const project = await Project.findById(id)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  // Cộng thêm deposit và lưu
  project.depositAmount += amount
  await project.save()

  res.json({
    message: 'Deposit added',
    depositAmount: project.depositAmount,
    paymentStatus: project.paymentStatus,
  })
})

//* Delete deposit
export const deleteDeposit = expressAsyncHandler(async (req, res) => {
  const { id } = req.params

  // Tìm dự án theo id
  const project = await Project.findById(id)
  if (!project) {
    res.status(404).json({ error: 'Không tìm thấy dự án' })
    return
  }

  // Kiểm tra xem có tiền đặt cọc để xóa không
  const depositAmount =
    typeof project.depositAmount === 'number' ? project.depositAmount : 0
  if (depositAmount <= 0) {
    res.status(400).json({ error: 'Không có tiền đặt cọc để xóa' })
    return
  }

  // Xóa tiền đặt cọc (đặt về 0)
  project.depositAmount = 0
  await project.save()

  res.json({
    message: 'Đã xóa tiền đặt cọc vừa thêm',
    depositAmount: project.depositAmount,
    paymentStatus: project.paymentStatus,
  })
})

//* Add payment
export const createPayment = expressAsyncHandler(async (req, res) => {
  const { id } = req.params
  const { amount } = req.body
  if (amount == null || amount <= 0) {
    res.status(400).json({ error: 'Invalid payment amount' })
    return
  }

  const project = await Project.findById(id)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  // Đẩy vào mảng paymentAmounts và lưu
  project.paymentAmounts.push(amount)
  await project.save()

  res.json({
    message: 'Payment recorded',
    totalPaid:
      (project.depositAmount as number) +
      (project.paymentAmounts as number[]).reduce((s, v) => s + v, 0),
    paymentStatus: project.paymentStatus,
  })
})

//* Delete payment
//* Delete arbitrary payment by index
export const deletePaymentAtIndex = expressAsyncHandler(async (req, res) => {
  const { id } = req.params
  const { index } = req.body // Chỉ số của khoản thanh toán cần xoá
  // Kiểm tra tính hợp lệ của index
  if (index === undefined || index < 0) {
    res.status(400).json({ error: 'Chỉ số khoản thanh toán không hợp lệ' })
    return
  }

  // Tìm dự án theo id
  const project = await Project.findById(id)
  if (!project) {
    res.status(404).json({ error: 'Dự án không tồn tại' })
    return
  }

  // Kiểm tra xem mảng paymentAmounts có tồn tại và index có nằm trong phạm vi mảng không
  if (!project.paymentAmounts || index >= project.paymentAmounts.length) {
    res.status(400).json({ error: 'Chỉ số khoản thanh toán không đúng' })
    return
  }

  // Loại bỏ khoản thanh toán tại vị trí index
  const removedPayment = project.paymentAmounts.splice(index, 1)[0]
  await project.save()

  res.json({
    message: 'Khoản thanh toán đã được xoá thành công',
    removedPayment: removedPayment,
    totalPaid:
      (project.depositAmount as number) +
      (project.paymentAmounts as number[]).reduce((sum, amt) => sum + amt, 0),
    paymentStatus: project.paymentStatus,
  })
})
