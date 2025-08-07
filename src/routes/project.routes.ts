import express from 'express'
import { uploadCloudForProjectImages } from '~/configs/cloudinary.config.js'
import {
  createProject,
  deleteProject,
  getAllProjects,
  getAllProjectsForEmployee,
  getProjectById,
  getProjectBySlug,
  getProjectsByUser,
  updateProject,
  updateProjectStatus,
  addCustomerUser,
  removeCustomerUser,
  createDeposit,
  deleteDeposit,
  createPayment,
  deletePaymentAtIndex,
} from '~/controllers/project.controller.js'

import { authenticate, authorizeRole } from '~/middlewares/auth.middleware.js'

const projectRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
projectRouter.post(
  '/',
  /* validateLanguage, */
  authenticate,
  authorizeRole([3515, 1413914]),
  uploadCloudForProjectImages.fields([
    { name: 'thumbnail', maxCount: 100 },
    { name: 'images', maxCount: 100 },
  ]),
  createProject,
)

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
projectRouter.get(
  '/private',
  authenticate,
  authorizeRole([3515, 1413914]),
  getAllProjects,
)
projectRouter.get('/projects', getAllProjects)
projectRouter.get('/projects-by-user', authenticate, getProjectsByUser)
projectRouter.get(
  '/projects-by-employee',
  authenticate,
  getAllProjectsForEmployee,
)

projectRouter.get('/:projectId', getProjectById)
projectRouter.get('/slug/:slug', getProjectBySlug)

projectRouter.put(
  '/:projectId',
  authenticate,
  authorizeRole([3515, 1413914]),
  uploadCloudForProjectImages.fields([
    { name: 'thumbnail', maxCount: 100 },
    { name: 'images', maxCount: 100 },
  ]),
  updateProject,
)

projectRouter.delete(
  '/:projectId',
  authenticate,
  authorizeRole([3515, 1413914]),
  deleteProject,
)
projectRouter.delete(
  '/:projectId/customers/:userId',
  authenticate,
  authorizeRole([3515, 1413914]),
  removeCustomerUser,
)

projectRouter.put(
  '/:id/status',
  authenticate,
  authorizeRole([3515, 1413914]),
  updateProjectStatus,
)

projectRouter.post(
  '/add-customer-user',
  authenticate,
  authorizeRole([3515, 1413914]),
  addCustomerUser,
)

projectRouter.post(
  '/:id/deposit',
  authenticate,
  authorizeRole([3515, 1413914]),
  createDeposit,
)

projectRouter.delete(
  '/:id/deposit',
  authenticate,
  authorizeRole([3515, 1413914]),
  deleteDeposit,
)

projectRouter.post(
  '/:id/payment',
  authenticate,
  authorizeRole([3515, 1413914]),
  createPayment,
)

projectRouter.delete(
  '/:id/payment',
  authenticate,
  authorizeRole([3515, 1413914]),
  deletePaymentAtIndex,
)

export default projectRouter
