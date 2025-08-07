import express from 'express'
import {
  createProductCategory,
  deleteProductCategory,
  getProductCategories,
  getProductCategoryById,
  updateProductCategory,
} from '~/controllers'

import { authenticate, authorizeRole } from '~/middlewares'

const productCategoryRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
productCategoryRouter.post(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  createProductCategory,
)
/**
 * Route GET /
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller getProjectTypes để lấy danh sách các loại dự án
 */
productCategoryRouter.get('/', getProductCategories)

/**
 * Route GET /:projectTypeId
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller getProjectTypeById để lấy loại dự án theo ID
 */
productCategoryRouter.get('/:productCategoryId', getProductCategoryById)

/**
 * Route PUT /:projectTypeId
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller updateProjectType để cập nhật loại dự án theo ID
 */
productCategoryRouter.put(
  '/:productCategoryId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  updateProductCategory,
)

/**
 * Route DELETE /:projectTypeId
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller deleteProjectType để xóa loại dự án theo ID
 */
productCategoryRouter.delete(
  '/:productCategoryId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteProductCategory,
)

export default productCategoryRouter
