import express from 'express'
import attendanceRouter from '~/routes/attendance.routes'
import authRouter from '~/routes/auth.routes'
import productBrandRouter from '~/routes/brand.routes'
import productCategoryRouter from '~/routes/category.routes'
import inforRouter from '~/routes/infor.routes'
import inforCompanyRouter from '~/routes/inforCompany.routes'
import installationRouter from '~/routes/installation.routes'
import languageRouter from '~/routes/language.routes'
import logoRouter from '~/routes/logo.routes'
import orderRouter from '~/routes/order.routes'
import pagesRouter from '~/routes/page.routes'
import productRouter from '~/routes/product.routes'
import routerProgress from '~/routes/progressEntry.routes'
import projectRouter from '~/routes/project.routes'
import projectTypeRouter from '~/routes/projectType.routes'
import quotationRouter from '~/routes/quotation.routes'
import quoteRouter from '~/routes/quote.routes'
import slideRouter from '~/routes/slide.routes'
import userRouter from '~/routes/user.routes'

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
