import express from 'express'
import { uploadCloudForImageSliders } from '~/configs/index.js'
import {
  createSlide,
  deleteSlide,
  getSlides,
  updateSlide,
  updateSlideOrder,
} from '~/controllers/index.js'
import { authenticate, authorizeRole } from '~/middlewares/index.js'

const slideRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
slideRouter.post(
  '/',
  /* validateLanguage, */
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForImageSliders.fields([{ name: 'image', maxCount: 10 }]),
  createSlide,
)

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
slideRouter.get(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getSlides,
)
slideRouter.get('/slides', getSlides)
slideRouter.put('/order', updateSlideOrder)
slideRouter.put(
  '/:slideId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForImageSliders.fields([{ name: 'image', maxCount: 100 }]),
  updateSlide,
)

slideRouter.delete(
  '/:slideId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteSlide,
)

export default slideRouter
