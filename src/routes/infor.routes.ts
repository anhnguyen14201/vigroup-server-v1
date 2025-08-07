import express from 'express'
import {
  createInfor,
  deleteInfor,
  getInfor,
  updateInfor,
} from '~/controllers/infor.controller.js'
import { authenticate, authorizeRole } from '~/middlewares/auth.middleware.js'

const inforRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
inforRouter.post(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  createInfor,
)

inforRouter.get('/', getInfor)
inforRouter.get(
  '/private-infor',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getInfor,
)
inforRouter.put(
  '/:inforId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  updateInfor,
)
inforRouter.delete(
  '/:inforId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteInfor,
)

export default inforRouter
