import express from 'express'
import {
  deleteUser,
  getCustomerById,
  getCustomers,
  getNonCustomers,
  getUser,
  updateByUser,
  updateUser,
} from '~/controllers/index.js'
import { authenticate, authorizeRole } from '~/middlewares/index.js'

const userRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
userRouter.get('/current', authenticate, getUser)
userRouter.get(
  '/customers',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getCustomers,
)

userRouter.get(
  '/:id',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getCustomerById,
)

userRouter.get(
  '/non-customers',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getNonCustomers,
)
userRouter.put(
  '/:_id',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  updateUser,
)
userRouter.put('/users/:_id', authenticate, updateByUser)
userRouter.delete(
  '/:_id',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteUser,
)

export default userRouter
