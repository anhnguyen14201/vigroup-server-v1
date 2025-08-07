import express from 'express'
import { uploadCloudForIcons } from '~/configs/index.js'
import {
  createInforCompany,
  deleteInforCompany,
  getInforCompany,
  updateInforCompany,
} from '~/controllers/index.js'
import { authenticate, authorizeRole } from '~/middlewares/index.js'

const inforCompanyRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
inforCompanyRouter.post(
  '/',
  /* validateLanguage, */
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForIcons.fields([{ name: 'icon', maxCount: 100 }]),
  createInforCompany,
)

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
inforCompanyRouter.get(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getInforCompany,
)
inforCompanyRouter.put(
  '/:companyId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForIcons.fields([{ name: 'icon', maxCount: 100 }]),
  updateInforCompany,
)

inforCompanyRouter.delete(
  '/:companyId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteInforCompany,
)

export default inforCompanyRouter
