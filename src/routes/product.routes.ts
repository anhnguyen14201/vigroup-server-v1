import express from 'express'
import { uploadCloudForProductImages } from '~/configs/index.js'
import {
  createProduct,
  deleteProduct,
  getAllPrivateProducts,
  getAllProducts,
  getProductBySlug,
  getProductsByIds,
  getRelatedBySlug,
  updateProduct,
} from '~/controllers/index.js'

import { authenticate, authorizeRole } from '~/middlewares/index.js'

const productRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
productRouter.post(
  '/',
  /* validateLanguage, */
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForProductImages.fields([
    { name: 'thumbnail', maxCount: 100 },
    { name: 'images', maxCount: 100 },
  ]),
  createProduct,
)

/**
 * Route PUT /:productId
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller updateLanguage để cập nhật ngôn ngữ
 */

productRouter.put(
  '/:productId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForProductImages.fields([
    { name: 'thumbnail', maxCount: 100 },
    { name: 'images', maxCount: 100 },
  ]),
  updateProduct,
)

/**
 * Route DELETE /:productId
 * - gọi controller deleteLanguage để xóa ngôn ngữ
 */
productRouter.delete(
  '/:productId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteProduct,
)

/**
 * Route GET /
 * - gọi controller getAllProducts để lấy tất cả sản phẩm
 */
productRouter.get('/', getAllProducts)
productRouter.get('/products', getProductsByIds)
productRouter.get(
  '/private',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getAllPrivateProducts,
)
productRouter.get('/:slug', getProductBySlug)
productRouter.get('/:slug/related', getRelatedBySlug)

export default productRouter
