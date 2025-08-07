import express from 'express'
import {
  authStatus,
  faceookLogin,
  forgotPassword,
  logOut,
  refreshAccessToken,
  resetPassword,
  signIn,
  signUp,
} from '~/controllers/index.js'

const authRouter = express.Router()

authRouter.post('/register', signUp)
authRouter.post('/login', signIn)
authRouter.post('/facebook-auth', faceookLogin)
authRouter.post('/refresh', refreshAccessToken)
authRouter.get('/status', authStatus)
authRouter.get('/logout', logOut)
authRouter.post('/forgotpassword', forgotPassword)
authRouter.put('/resetpassword', resetPassword)

export default authRouter
