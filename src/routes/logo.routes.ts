import express from 'express'
import { uploadCloudForIcons } from '~/configs/cloudinary.config.js'
import {
  createLogo,
  deleteLogo,
  getLogo,
  updateLogo,
} from '~/controllers/logo.controler.js'
import { authenticate, authorizeRole } from '~/middlewares/auth.middleware.js'

const logoRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
logoRouter.post(
  '/',
  /* validateLanguage, */
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForIcons.fields([{ name: 'icon', maxCount: 100 }]),
  createLogo,
)

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
logoRouter.get('/', getLogo)

logoRouter.get(
  '/privateLogo',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getLogo,
)

logoRouter.put(
  '/:logoId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForIcons.fields([{ name: 'icon', maxCount: 100 }]),
  updateLogo,
)

logoRouter.delete(
  '/:logoId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteLogo,
)

export default logoRouter
