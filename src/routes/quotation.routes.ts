import express from 'express'
import {
  createQuotation,
  deleteQuotation,
  getAllQuotations,
  getQuotationById,
  updateQuotation,
} from '~/controllers'
import { authenticate, authorizeRole } from '~/middlewares'

const quotationRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
quotationRouter.post(
  '/',
  /* validateLanguage, */
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  createQuotation,
)

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
quotationRouter.get('/', authenticate, getAllQuotations)
quotationRouter.get('/:quotationId', authenticate, getQuotationById)

quotationRouter.put(
  '/:quotationId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  updateQuotation,
)

quotationRouter.delete(
  '/:quotationId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteQuotation,
)

export default quotationRouter
