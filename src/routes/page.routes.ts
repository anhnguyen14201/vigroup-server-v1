import express from 'express'

import {
  createPage,
  deletePage,
  getAllPages,
  getPageByIdentifier,
  updatePage,
} from '~/controllers'
import { uploadCloudForPageImages } from '~/configs'

const pagesRouter = express.Router()

pagesRouter.post('/', uploadCloudForPageImages.any(), createPage)
pagesRouter.get('/', getAllPages)
pagesRouter.get('/:page', getPageByIdentifier)
pagesRouter.put('/:pageId', uploadCloudForPageImages.any(), updatePage)
pagesRouter.delete('/:pageId', deletePage)

export default pagesRouter
