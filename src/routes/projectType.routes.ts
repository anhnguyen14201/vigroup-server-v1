import express from 'express'
import {
  createProjectType,
  deleteProjectType,
  getProjectTypes,
  updateProjectType,
} from '~/controllers/index.js'
import { authenticate, authorizeRole } from '~/middlewares/index.js'

const projectTypeRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
projectTypeRouter.post(
  '/',
  /* validateLanguage, */
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  createProjectType,
)
/**
 * Route GET /
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller getProjectTypes để lấy danh sách các loại dự án
 */
projectTypeRouter.get('/', getProjectTypes)

/**
 * Route PUT /:projectTypeId
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller updateProjectType để cập nhật loại dự án theo ID
 */
projectTypeRouter.put(
  '/:projectTypeId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  updateProjectType,
)

/**
 * Route DELETE /:projectTypeId
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller deleteProjectType để xóa loại dự án theo ID
 */
projectTypeRouter.delete(
  '/:projectTypeId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteProjectType,
)

export default projectTypeRouter
