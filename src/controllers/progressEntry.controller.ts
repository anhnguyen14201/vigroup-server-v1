import expressAsyncHandler from 'express-async-handler'
import { ProgressEntry, Project } from '~/models/index.js'
import { deleteImages } from '~/utils/index.js'

// Tạo
export const createProgressEntry = expressAsyncHandler(async (req, res) => {
  const files = (req.files as { [fieldname: string]: Express.Multer.File[] })
    .image
  //! Lấy đường dẫn của từng file icon
  const iconPaths = files?.map(file => file.path)

  //! Gán đường dẫn icon vào trường iconUrl của req.body
  req.body.imageUrls = iconPaths

  const { projectId, description } = req.body

  // Kiểm tra dữ liệu bắt buộc: project và description
  if (!projectId || !description) {
    res.status(400).json({ error: "Yêu cầu 'project' và 'description'" })
    return
  }

  // Tạo mới bản ghi tiến độ
  const newEntry = await ProgressEntry.create(req.body)

  // Cập nhật lại mảng dailyProgress trong model Project bằng cách thêm id của progress entry vừa tạo
  await Project.findByIdAndUpdate(projectId, {
    $push: { dailyProgress: newEntry._id },
  })

  res.status(201).json({
    message: 'Tạo bản ghi tiến độ thành công',
    progressEntry: newEntry,
  })
})

// Hàm cập nhật thông tin của một bản ghi tiến độ theo id
export const updateProgressEntry = expressAsyncHandler(async (req, res) => {
  const { progressId } = req.params
  // parse imageUrls nếu client gửi, còn không thì mặc định dùng oldUrls
  let newUrls: string[] = []
  if (req.body.imageUrls) {
    try {
      newUrls = JSON.parse(req.body.imageUrls)
    } catch {
      res.status(400).json({ error: 'imageUrls phải là JSON hợp lệ' })
      return
    }
  }

  // 1) Tìm entry cũ
  const progressEntry = await ProgressEntry.findById(progressId)
  if (!progressEntry) {
    res.status(404).json({ error: 'Không tìm thấy bản ghi tiến độ' })
    return
  }

  const oldUrls: string[] = progressEntry.imageUrls || []
  // nếu client không truyền newUrls, mặc định giữ nguyên tất cả
  if (!newUrls) {
    newUrls = oldUrls
  }

  // 2) Xác định ảnh bị xóa
  const toDelete = oldUrls.filter(url => !newUrls.includes(url))
  if (toDelete.length > 0) {
    await deleteImages(toDelete)
  }

  // 3) Upload file mới
  const files =
    (req.files as { [key: string]: Express.Multer.File[] })?.image || []
  const uploadedUrls = files.map(f => f.path)

  // 4) Gán lại imageUrls: giữ newUrls (cũ) + uploadedUrls (mới)
  progressEntry.imageUrls = [...newUrls, ...uploadedUrls]

  // 5) Cập nhật mô tả & ngày
  if (req.body.description !== undefined)
    progressEntry.description = req.body.description
  if (req.body.date !== undefined) progressEntry.date = req.body.date

  await progressEntry.save()

  // 6) Cập nhật project (nếu cần)
  await Project.findByIdAndUpdate(progressEntry.projectId, {
    lastProgressDate: progressEntry.date,
  })

  res.json({
    message: 'Cập nhật bản ghi tiến độ thành công',
    progressEntry,
  })
})

// Hàm xóa một bản ghi tiến độ theo id
export const deleteProgressEntry = expressAsyncHandler(async (req, res) => {
  const { id } = req.params

  // Tìm bản ghi tiến độ theo id
  const progressEntry = await ProgressEntry.findById(id)
  if (!progressEntry) {
    res.status(404).json({ error: 'Không tìm thấy bản ghi tiến độ' })
    return
  }

  await progressEntry.deleteOne()

  res.json({
    message: 'Xóa bản ghi tiến độ thành công',
  })
})

// Hàm lấy thông tin một bản ghi tiến độ theo id
export const getProgressEntry = expressAsyncHandler(async (req, res) => {
  const { id } = req.params

  const progressEntry = await ProgressEntry.findById(id)
  if (!progressEntry) {
    res.status(404).json({ error: 'Không tìm thấy bản ghi tiến độ' })
    return
  }

  res.json(progressEntry)
})

// Hàm lấy danh sách tất cả các bản ghi tiến độ của một dự án cụ thể
export const getProgressEntriesByProject = expressAsyncHandler(
  async (req, res) => {
    const { projectId } = req.params

    // Lấy các bản ghi tiến độ của dự án, sắp xếp giảm dần theo ngày
    const progressEntries = await ProgressEntry.find({
      projectId: projectId,
    }).sort({ date: -1 })

    res.json(progressEntries)
  },
)
