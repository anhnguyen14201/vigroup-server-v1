import express from 'express'
import {
  createOrder,
  deleteOrder,
  getOrderById,
  getOrders,
  getOrderStatisticsByDay,
  getOrderStatisticsByMonth,
  getOrderStatisticsByWeek,
  getOrderStatisticsByYear,
  updateOrderPdf,
  updateOrderStatus,
} from '~/controllers'
import { authenticate, authorizeRole } from '~/middlewares'

const orderRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
orderRouter.post('/', createOrder)

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
orderRouter.get(
  '/private',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getOrders,
)
orderRouter.get(
  '/',
  /*   authenticate,
  authorizeRole([3515, 1413914, 1311417518]), */
  getOrders,
)

orderRouter.get(
  '/:id',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getOrderById,
)

orderRouter.put('/status', authenticate, updateOrderStatus)

orderRouter.put(
  '/:id',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  updateOrderPdf,
)

orderRouter.delete(
  '/:id',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteOrder,
)

orderRouter.get(
  '/statistics/day',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getOrderStatisticsByDay,
)
orderRouter.get(
  '/statistics/week',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getOrderStatisticsByWeek,
)
orderRouter.get(
  '/statistics/month',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getOrderStatisticsByMonth,
)
orderRouter.get(
  '/statistics/year',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getOrderStatisticsByYear,
)

export default orderRouter
