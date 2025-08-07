import express from 'express'
import { uploadCloudForImageSliders } from '~/configs'
import {
  createProgressEntry,
  deleteProgressEntry,
  getProgressEntriesByProject,
  getProgressEntry,
  updateProgressEntry,
} from '~/controllers'
import { authenticate, authorizeRole } from '~/middlewares'

const routerProgress = express.Router()

routerProgress.post(
  '/',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForImageSliders.fields([{ name: 'image', maxCount: 100 }]),
  createProgressEntry,
)
routerProgress.put(
  '/:progressId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  uploadCloudForImageSliders.fields([{ name: 'image', maxCount: 100 }]),
  updateProgressEntry,
)
routerProgress.delete(
  '/:progressId',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  deleteProgressEntry,
)
routerProgress.get('/:progressId', authenticate, getProgressEntry)
routerProgress.get(
  '/:projectId/progress',
  authenticate,
  getProgressEntriesByProject,
)

export default routerProgress
