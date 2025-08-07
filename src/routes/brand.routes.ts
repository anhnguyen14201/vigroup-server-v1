import express from 'express'
import {
  createProductBrand,
  deleteProductBrand,
  getProductBrandById,
  getProductBrands,
  updateProductBrand,
} from '~/controllers/productBrand.controller.js'

import { authenticate, authorizeRole } from '~/middlewares/auth.middleware.js'

const productBrandRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
productBrandRouter.post(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  createProductBrand,
)
/**
 * Route GET /
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller getProjectTypes để lấy danh sách các loại dự án
 */
productBrandRouter.get('/', getProductBrands)

/**
 * Route GET /:projectTypeId
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller getProjectTypeById để lấy loại dự án theo ID
 */
productBrandRouter.get('/:productBrandId', getProductBrandById)

/**
 * Route PUT /:projectTypeId
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller updateProjectType để cập nhật loại dự án theo ID
 */
productBrandRouter.put(
  '/:productBrandId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  updateProductBrand,
)

/**
 * Route DELETE /:projectTypeId
 * - authenticate: xác thực người dùng
 * - authorizeRole: kiểm tra quyền truy cập của người dùng
 * - gọi controller deleteProjectType để xóa loại dự án theo ID
 */
productBrandRouter.delete(
  '/:productBrandId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteProductBrand,
)

export default productBrandRouter
