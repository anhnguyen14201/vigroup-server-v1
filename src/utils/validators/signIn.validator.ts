import Joi from 'joi'

export const signInValidator = Joi.object({
  username: Joi.string()
    .custom((value, helper) => {
      // Kiểm tra nếu value là email
      const isEmail = /\S+@\S+\.\S+/.test(value)
      if (isEmail) {
        // Xác thực email
        return Joi.string().email().validate(value, { abortEarly: false })
      } else {
        // Xác thực số điện thoại (giả sử số điện thoại phải có ít nhất 9 chữ số)
        return Joi.string()
          .pattern(/^[0-9]{9,}$/)
          .validate(value, { abortEarly: false })
      }
    }, 'Username validation')
    .required()
    .label('Email hoặc Số điện thoại'),

  password: Joi.string()
    .min(8)
    .max(15)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,15}$/)
    .messages({
      'string.empty': 'Password không được để trống',
      'any.required': 'Password là bắt buộc',
      'string.min': 'Password phải có ít nhất {#limit} ký tự',
      'string.max': 'Password phải có tối đa {#limit} ký tự',
      'string.pattern.base':
        'Password phải chứa ít nhất một chữ cái thường, một chữ cái in hoa và một số',
    }),
})
