import express from 'express'
import attendanceRouter from '~/routes/attendance.routes.js'
import authRouter from '~/routes/auth.routes.js'
import productBrandRouter from '~/routes/brand.routes.js'
import productCategoryRouter from '~/routes/category.routes.js'
import inforRouter from '~/routes/infor.routes.js'
import inforCompanyRouter from '~/routes/inforCompany.routes.js'
import installationRouter from '~/routes/installation.routes.js'
import languageRouter from '~/routes/language.routes.js'
import logoRouter from '~/routes/logo.routes.js'
import orderRouter from '~/routes/order.routes.js'
import pagesRouter from '~/routes/page.routes.js'
import productRouter from '~/routes/product.routes.js'
import routerProgress from '~/routes/progressEntry.routes.js'
import projectRouter from '~/routes/project.routes.js'
import projectTypeRouter from '~/routes/projectType.routes.js'
import quotationRouter from '~/routes/quotation.routes.js'
import quoteRouter from '~/routes/quote.routes.js'
import slideRouter from '~/routes/slide.routes.js'
import userRouter from '~/routes/user.routes.js'

const router = express.Router()
router.use('/language', languageRouter)
router.use('/auth', authRouter)
router.use('/user', userRouter)
router.use('/slide', slideRouter)
router.use('/logo', logoRouter)
router.use('/infor', inforRouter)
router.use('/project', projectRouter)
router.use('/quotation', quotationRouter)
router.use('/progress', routerProgress)
router.use('/project-type', projectTypeRouter)
router.use('/brand', productBrandRouter)
router.use('/category', productCategoryRouter)
router.use('/product', productRouter)
router.use('/company', inforCompanyRouter)
router.use('/quote', quoteRouter)
router.use('/installation', installationRouter)
router.use('/page', pagesRouter)
router.use('/order', orderRouter)
router.use('/attendance', attendanceRouter)

export default router
