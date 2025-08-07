import express from 'express'
import { uploadCloudForPageImages } from '~/configs/cloudinary.config.js'
import { createPage, deletePage, getAllPages, getPageByIdentifier, updatePage } from '~/controllers/page.controller.js'



const pagesRouter = express.Router()

pagesRouter.post('/', uploadCloudForPageImages.any(), createPage)
pagesRouter.get('/', getAllPages)
pagesRouter.get('/:page', getPageByIdentifier)
pagesRouter.put('/:pageId', uploadCloudForPageImages.any(), updatePage)
pagesRouter.delete('/:pageId', deletePage)

export default pagesRouter
