import express from 'express'
import { uploadCloudForIcons } from '~/configs/index.js'
import { createLanguage, getLanguages } from '~/controllers/index.js'
import { validateLanguage } from '~/middlewares/index.js'

const languageRouter = express.Router()

/**
 * Route POST /
 * - validate dữ liệu đầu vào với validateLanguage
 * - xử lý upload file icon qua uploadCloudForIcons (tối đa 10 file)
 * - gọi controller createLanguage để tạo mới ngôn ngữ
 */
languageRouter.post(
  '/',
  /* validateLanguage, */
  uploadCloudForIcons.fields([{ name: 'icon', maxCount: 100 }]),
  createLanguage,
)

/**
 * Route GET /
 * - gọi controller getLanguages để lấy danh sách ngôn ngữ
 */
languageRouter.get('/', getLanguages)

export default languageRouter
