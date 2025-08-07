import { Router } from 'express'
import {
  deleteQuote,
  getAllInvoices,
  postInvoice,
  postQuote,
  upsertQuote,
} from '~/controllers/index.js'
import { authenticate, authorizeRole } from '~/middlewares/index.js'

const quoteRouter = Router()

// POST /api/invoice
quoteRouter.post(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  postQuote,
)
quoteRouter.post(
  '/invoice',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  postInvoice,
)

quoteRouter.get(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getAllInvoices,
)

quoteRouter.put(
  '/:id',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  upsertQuote,
)

quoteRouter.delete(
  '/:id',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteQuote,
)

export default quoteRouter
