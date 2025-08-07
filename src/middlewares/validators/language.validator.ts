import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'

//* Định nghĩa schema validation cho đối tượng ngôn ngữ
const languageSchema = Joi.object({
  code: Joi.string().required().messages({
    'string.empty': 'code không được để trống',
    'any.required': 'code là bắt buộc',
  }),
  name: Joi.string().required().messages({
    'string.empty': 'name không được để trống',
    'any.required': 'name là bắt buộc',
  }),
  //? Nếu cần validate thêm các trường khác, thêm vào đây
})

/**
 * Middleware kiểm tra dữ liệu đầu vào theo schema languageSchema.
 * Nếu có lỗi, trả về lỗi với status 400.
 */
export const validateLanguage = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { error } = languageSchema.validate(req.body, { abortEarly: false })

  if (error) {
    // Nối các thông báo lỗi nếu có nhiều lỗi
    const errorMessage = error.details.map(detail => detail.message).join(', ')
    res.status(400).json({
      success: false,
      message: errorMessage,
    })
    return
  }
  next()
}
