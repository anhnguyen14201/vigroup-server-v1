import express from 'express'
import { uploadCloudForIcons } from '~/configs/cloudinary.config.js'
import { createInstallation, deleteInstallation, getInstallation, updateInstallation } from '~/controllers/installation.controller.js'
import { authenticate, authorizeRole } from '~/middlewares/auth.middleware.js'

const installationRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
installationRouter.post(
  '/',
  /* validateLanguage, */
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForIcons.fields([{ name: 'icon', maxCount: 100 }]),
  createInstallation,
)

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
installationRouter.get(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getInstallation,
)
installationRouter.put(
  '/:installId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForIcons.fields([{ name: 'icon', maxCount: 100 }]),
  updateInstallation,
)

installationRouter.delete(
  '/:installId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteInstallation,
)

export default installationRouter
