import { Router } from 'express'

import { authenticate, authorizeRole } from '~/middlewares/auth.middleware.js'
import {
  postQuote,
  postInvoice,
  getAllInvoices,
  upsertQuote,
  deleteQuote,
} from '~/controllers/quote.controller.js'

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
