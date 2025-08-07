import Joi from 'joi'

// 1. Tách schema cho username (email hoặc phone)
const usernameSchema = Joi.alternatives()
  .try(
    Joi.string()
      .email()
      .messages({ 'string.email': 'Username phải là email hợp lệ' }),
    Joi.string()
      .pattern(/^[0-9]{9,}$/)
      .messages({
        'string.pattern.base':
          'Username phải là số điện thoại (ít nhất 9 chữ số)',
      }),
  )
  .required()
  .messages({
    'any.required': 'Username (email hoặc số điện thoại) là bắt buộc',
  }) // nếu không nhập
  .label('Email hoặc Số điện thoại') // dùng để thay {#label} trong messages :contentReference[oaicite:0]{index=0}

export const signUpValidator = Joi.object({
  fullName: Joi.string().required().messages({
    'string.empty': 'fullName không được để trống',
    'any.required': 'fullName là bắt buộc',
  }),

  // 2. Dùng usernameSchema đã định nghĩa
  username: usernameSchema,

  password: Joi.string()
    .min(8)
    .max(15)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,15}$/)
    .required()
    .messages({
      'string.empty': 'Password không được để trống',
      'string.min': 'Password phải có ít nhất {#limit} ký tự',
      'string.max': 'Password phải có tối đa {#limit} ký tự',
      'string.pattern.base':
        'Password phải chứa ít nhất một chữ cái thường, một chữ cái in hoa và một số',
      'any.required': 'Password là bắt buộc',
    }),

  confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
    'any.only': 'confirmPassword không khớp với password',
    'any.required': 'confirmPassword là bắt buộc',
  }),

  role: Joi.number()
    .valid(3515, 1413914, 1311417518, 5131612152555, 32119201513518)
    .default(32119201513518)
    .messages({
      'number.base': 'Role phải là một số',
      'any.only': 'Role không hợp lệ',
    }),

  position: Joi.string().allow('', null),
  hourlyRate: Joi.string().allow('', null),
  companyName: Joi.string().allow('', null),
  ico: Joi.string().allow('', null),
  dic: Joi.string().allow('', null),
  address: Joi.string().allow('', null),
  isBlock: Joi.boolean().allow('', null),
})
