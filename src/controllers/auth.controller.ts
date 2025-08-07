import expressAsyncHandler from 'express-async-handler'
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { createHash } from 'crypto'

import axios from 'axios'
import { User } from '~/models/index.js'
import { signUpValidator } from '~/utils/validators/signUp.validator.js'
import { signInValidator } from '~/utils/validators/signIn.validator.js'
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt.js'
import { sendEmail } from '~/utils/sendMailer.js'

dotenv.config()

const { SECRET_CODE } = process.env

//* Register - Đăng ký tài khoản
export const signUp = expressAsyncHandler(async (req, res) => {
  const { username, password, ...rest } = req.body

  //! Kiểm tra và xác thực dữ liệu người dùng nhập vào
  const { error } = signUpValidator.validate(req.body, { abortEarly: false })
  if (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    })
    return
  }

  //! Kiểm tra định dạng của username là email hay số điện thoại
  const emailRegex = /\S+@\S+\.\S+/
  const phoneRegex = /^\d{9,}$/

  let email: string | undefined
  let phone: string | undefined

  if (emailRegex.test(username)) {
    email = username
  } else if (phoneRegex.test(username)) {
    phone = username
  } else {
    res.status(400).json({
      success: false,
      message: 'Username phải là email hoặc số điện thoại hợp lệ',
    })
    return
  }

  //! Nếu người dùng nhập email, kiểm tra xem email đó đã tồn tại chưa
  if (email) {
    const emailExist = await User.findOne({ email })
    if (emailExist) {
      res.status(404).json({
        success: false,
        message: 'Email đã được đăng ký. Vui lòng thử email khác.',
      })
      return
    }
  }

  //! Nếu người dùng nhập số điện thoại, kiểm tra xem số điện thoại đó đã tồn tại chưa
  if (phone) {
    const phoneExist = await User.findOne({ phone })
    if (phoneExist) {
      res.status(404).json({
        success: false,
        message: 'Số điện thoại đã được đăng ký. Vui lòng thử số khác.',
      })
      return
    }
  }

  //! Mã hóa password trước khi lưu vào cơ sở dữ liệu
  const hashedPassword = await bcryptjs.hash(req.body.password, 10)

  //! Tạo tài khoản người dùng mới trong DB
  const newUser = await User.create({
    ...rest,
    email,
    phone,
    password: hashedPassword,
  })

  //! Loại bỏ trường password trước khi gửi response cho client
  const userObj = newUser.toObject()
  delete (userObj as { password?: string }).password

  //! Gửi phản hồi thành công về cho client
  res.status(201).json({
    success: true,
    user: userObj,
    message: 'Đăng ký tài khoản thành công',
  })
  return
})

//* Login - Đăng nhập
export const signIn = expressAsyncHandler(async (req, res) => {
  const { username, password } = req.body

  //! Xác thực dữ liệu đầu vào từ người dùng
  const { error } = signInValidator.validate(req.body, { abortEarly: false })
  if (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    })
    return
  }

  //! Kiểm tra định dạng của userName là email hay số điện thoại
  const isEmail = /\S+@\S+\.\S+/.test(username)
  const user = isEmail
    ? await User.findOne({ email: username }) // Tìm người dùng theo email
    : await User.findOne({ phone: username }) // Tìm người dùng theo số điện thoại

  //! Nếu không tìm thấy người dùng, trả về lỗi
  if (!user) {
    res.status(404).json({
      success: false,
      message: 'Vui lòng cung cấp email hoặc số điện thoại hợp lệ để đăng nhập',
    })
    return
  }

  //! Kiểm tra xem người dùng có bị khóa hay không
  if (user.isBlock) {
    res.status(403).json({
      success: false,
      message: 'Tài khoản của bạn đã bị khóa',
    })
    return
  }

  //! So sánh mật khẩu nhập vào với mật khẩu đã mã hóa trong cơ sở dữ liệu
  const isMatch = await bcryptjs.compare(password, user.password)
  if (!isMatch) {
    res.status(404).json({
      success: false,
      message: 'Mật khẩu không hợp lệ',
    })
    return
  }

  //! Tạo JWT tokens cho việc xác thực
  const accessToken = generateAccessToken({ _id: user._id, role: user.role }) // Token truy cập
  const refreshToken = generateRefreshToken({ _id: user._id, role: user.role }) // Token làm mới

  //! Lưu token làm mới vào cơ sở dữ liệu
  if (user._id.toString() !== 'superuser') {
    await User.findByIdAndUpdate(
      user._id,
      { $push: { refreshTokens: { token: refreshToken } } },
      { new: true },
    )
  }

  //! Lưu access token làm mới vào cookie
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 5 * 60 * 1000, // 15 phút
  })

  //! Lưu refresh token làm mới vào cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
  })
  //! Trả về phản hồi thành công cùng với tokens và thông tin người dùng
  res.status(200).json({
    success: true,
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      country: user.country,
      street: user.street,
      province: user.province,
      postalCode: user.postalCode,
      role: user.role,
      isBlock: user.isBlock,
      projects: user.projects,
      cart: user.carts,
      isSuperuser: user.isSuperuser,
    },
    accessToken,
    refreshToken,
  })
})

//* Cấp mới Access Token
export const refreshAccessToken = expressAsyncHandler(async (req, res) => {
  // Lấy refresh token từ cookie
  const { refreshToken } = req.cookies

  //! Kiểm tra sự tồn tại của refresh token
  if (!refreshToken) {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy refresh token',
    })
    return
  }

  //! Kiểm tra tính hợp lệ của refresh token
  let decoded
  try {
    decoded = jwt.verify(refreshToken, SECRET_CODE || 'vigroup')
    if (typeof decoded !== 'object' || !('_id' in decoded)) {
      throw new Error()
    }
  } catch (error) {
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')
    res.status(401).json({
      success: false,
      message: 'Refresh token không hợp lệ',
    })
    return
  }

  //! Tìm người dùng tương ứng với refresh token
  const user = await User.findOne({
    _id: decoded._id,
    'refreshTokens.token': refreshToken,
  })

  if (!user) {
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')
    res.status(404).json({
      success: false,
      message: 'Refresh token không khớp với người dùng',
    })
    return
  }

  //! Tạo mới access token
  const newAccessToken = generateAccessToken({ _id: user._id, role: user.role })

  res.cookie('accessToken', newAccessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 5 * 60 * 1000,
  })

  //! Trả về access token mới
  res.status(201).json({
    success: true,
    accessToken: newAccessToken,
  })
})

//* Logout Đăng xuất
export const logOut = expressAsyncHandler(async (req, res) => {
  //! Lấy refresh token từ cookie
  const { refreshToken } = req.cookies

  //! Kiểm tra sự tồn tại của refresh token
  if (!refreshToken) {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy refresh token',
    })
    return
  }

  //! Xóa refresh token trong cơ sở dữ liệu
  await User.findOneAndUpdate(
    { 'refreshTokens.token': refreshToken },
    { $pull: { refreshTokens: { token: refreshToken } } },
    { new: true },
  )

  //! Xóa access token trong cookie
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  })

  //! Xóa refresh token trong cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  })

  //! Phản hồi kết quả thành công
  res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công',
  })
})

//* Forgot password
export const forgotPassword = expressAsyncHandler(async (req, res) => {
  //! Lấy mail từ client gửi lên
  const { email } = req.body

  //! Kiểm tra xem email có tồn tại không
  if (!email) {
    res.status(404).json({
      success: false,
      message: 'Email not found',
    })
    return
  }

  //! Kiểm tra email có tồn tại trong DB
  const user = await User.findOne({ email })

  if (!user) {
    res.status(404).json({
      success: false,
      message: 'User not found',
    })
    return
  }

  //! Tạo token để đặt lại mật khẩu
  const resetToken = (user as any).createPasswordChangedToken()

  //! Lưu thông tin user sau khi tạo token
  await user.save()

  //! Tạo nội dung email
  const userNameOrEmail = user.fullName ? user.fullName : user.email

  const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8"/>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <title>Password Reset Request</title>
              <style>
                /* === Reset & Base Styles === */
                body, h1, h2, h3, p, a { margin:0; padding:0; }
                body { background: #f0f2f5; font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; }
                img { border:0; display: block; max-width: 100%; height: auto; text-decoration: none; }

                /* === Container === */
                .wrapper {
                  width:100%; padding: 20px 0;
                  background: #f0f2f5;
                }
                .container {
                  max-width: 800px; margin: 0 auto;
                  background: #fff; border-radius: 8px;
                  overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                /* === Header === */
                .header {
                  text-align: center; padding: 30px 20px;
                  background: #0052cc; color: #fff;
                }
                .header h1 {
                  font-size: 24px; font-weight: 300;
                }

                /* === Body === */
                .body { padding: 30px 20px; }
                .greeting { font-size: 16px; line-height: 1.5; margin-bottom: 24px; }
                .section {
                  margin-bottom: 24px;
                }
                .section p {
                  font-size: 14px; line-height: 1.5; color: #555;
                  margin-bottom: 16px;
                }

                /* === Button === */
                .btn {
                  display: inline-block; padding: 12px 24px;
                  background: #ff6347; color: #fff;
                  text-decoration: none; border-radius: 4px;
                  font-size: 14px; font-weight: 500;
                  
                }

                /* === Footer === */
                .footer {
                  background: #f7f9fc; padding: 20px;
                  text-align: center; font-size: 12px; color: #777;
                }
              </style>
            </head>
            <body>
              <div class="wrapper">
                <div class="container">
                  <!-- Header -->
                  <div class="header">
                    <h1>Reset Your Password</h1>
                  </div>

                  <!-- Body -->
                  <div class="body">
                    <p class="greeting">
                      Hi ${userNameOrEmail},
                    </p>

                    <div class="section">
                      <p>We have received a request to reset the password for your account at Vigroup. If you did not initiate this request, you can safely ignore this email.</p>
                      <p>To reset your password, please click the button below:</p>
                      <p style="text-align:center;">
                        <a href="${process.env.CLIENT_URL}/account/reset-password/${resetToken}" class="btn">Reset Password</a>
                      </p>
                      <p>If the button above does not work, copy and paste this URL into your browser:</p>
                      <p><a href="${process.env.CLIENT_URL}/account/reset-password/${resetToken}">${process.env.CLIENT_URL}/account/reset-password/${resetToken}</a></p>
                      <p>This link will expire in <strong>5 minutes</strong> for your security.</p>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div class="footer">
                    Should you have any questions, feel free to contact our support team at <a href="mailto:info@vigroup.cz">info@vigroup.cz</a>.<br>
                    &copy; ${new Date().getFullYear()} Vigroup. All rights reserved.
                  </div>
                </div>
              </div>
            </body>
            </html>
            `

  const data = {
    email,
    html,
    subject: 'Password Reset Request',
  }

  const rs = await sendEmail(data)

  if (!rs) {
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
    })
    return
  }

  res.status(200).json({
    success: rs ? true : false,
    rs,
  })
})

//* ( Reset password ) Đặt lại mật khẩu
export const resetPassword = expressAsyncHandler(async (req, res) => {
  const { password, token } = req.body

  //! Kiểm tra xem password có tồn tại không
  if (!password) {
    res.status(400).json({
      success: false,
      message: 'Password not found',
    })
    return
  }

  //! Kiểm tra xem token có tồn tại không
  if (!token) {
    res.status(400).json({
      success: false,
      message: 'Token not found',
    })
    return
  }
  const passwordResetToken = createHash('sha256').update(token).digest('hex')

  //! Tìm người dùng có token tương ứng trong DB
  const user = await User.findOne({
    passwordResetToken,
    passwordResetExpires: { $gt: Date.now() },
  })

  if (!user) {
    res.status(410).json({
      success: false,
      message: 'User not found or token expired',
    })
    return
  }

  //! Mã hóa mật khẩu mới và lưu vào DB
  const hashedPassword = await bcryptjs.hash(password, 10)
  user.password = hashedPassword
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  user.passwordChangedAt = Date.now().toString() // Cập nhật thời gian thay đổi mật khẩu

  await user.save()

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
  })
})

//* Login with Facebook
export const faceookLogin = expressAsyncHandler(async (req: any, res: any) => {
  const { access_token } = req.body

  if (!access_token) {
    res.status(404).json({
      success: false,
      message: 'Access token is required',
    })
    return
  }

  let response = await axios.get(
    `https://graph.facebook.com/me?access_token=${access_token}&fields=id,name,email`,
  )

  const { id, email, name } = response.data

  if (!id) {
    res.status(404).json({
      success: false,
      message: 'Login is false',
    })
    return
  }

  const emailUser = await User.findOne({ email })
  if (emailUser && !emailUser.facebookId) {
    return res.status(409).json({
      success: false,
      message: 'Email đã được đăng ký. Vui lòng đăng nhập bằng email.',
    })
  }

  let user = await User.findOne({ facebookId: id })
  if (!user) {
    user = await User.create({
      facebookId: id,
      fullName: name,
      email,
    })
  }

  //! Tạo JWT tokens cho việc xác thực
  const accessToken = generateAccessToken({ _id: user._id, role: user.role }) // Token truy cập
  const refreshToken = generateRefreshToken({ _id: user._id, role: user.role }) // Token làm mới

  //! Lưu token làm mới vào cơ sở dữ liệu
  await User.findByIdAndUpdate(user._id, { refreshToken }, { new: true })

  //! Lưu token làm mới vào cookie
  res.cookie('accessToken', accessToken, {
    httpOnly: true, // Chỉ cho phép máy chủ truy cập cookie
    maxAge: 15 * 60 * 1000, // Thời gian sống của cookie là 15 phut
    secure: true, // Chỉ gửi cookie qua HTTPS
    sameSite: 'none', // Cho phép cookie được gửi trong các yêu cầu cross-site
  })

  //! Lưu token làm mới vào cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true, // Chỉ cho phép máy chủ truy cập cookie
    maxAge: 24 * 60 * 60 * 1000, // Thời gian sống của cookie là 1 ngày
    secure: true, // Chỉ gửi cookie qua HTTPS
    sameSite: 'none', // Cho phép cookie được gửi trong các yêu cầu cross-site
  })

  res.status(201).json({
    success: true,
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      country: user.country,
      street: user.street,
      province: user.province,
      postalCode: user.postalCode,
      role: user.role,
      isBlock: user.isBlock,
      projects: user.projects,
      cart: user.carts,
    },
    accessToken,
    refreshToken,
    message: 'Đăng ký tài khoản thành công',
  })
  return
})

export const authStatus = expressAsyncHandler(async (req: any, res: any) => {
  const { accessToken } = req.cookies

  if (!accessToken) {
    return res.status(200).json({ isLoggedIn: false })
  }

  const payload = jwt.verify(accessToken, SECRET_CODE || 'vigroup')

  res.status(201).json({
    isLoggedIn: true,
    user: payload,
  })
})
