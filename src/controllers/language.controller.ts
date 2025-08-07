import expressAsyncHandler from 'express-async-handler'
import { Language } from '~/models/index.js'

//* Tạo ngôn ngữ
export const createLanguage = expressAsyncHandler(async (req, res) => {
  //! Kiểm tra file upload và trường 'icon'
  if (
    !req.files ||
    !(req.files as { [fieldname: string]: Express.Multer.File[] }).icon
  ) {
    res.status(400).json({
      success: false,
      message: 'Không có file icon được tải lên',
    })
    return
  }

  //! Lấy danh sách file icon từ req.files
  const files = (req.files as { [fieldname: string]: Express.Multer.File[] })
    .icon
  //! Lấy đường dẫn của từng file icon
  const iconPaths = files.map(file => file.path)

  //! Gán đường dẫn icon vào trường iconUrl của req.body
  req.body.iconUrl = iconPaths

  //! Tạo document Language mới với dữ liệu từ req.body
  const newLanguage = await Language.create(req.body)

  res.status(201).json({
    success: !!newLanguage,
    data: newLanguage ? newLanguage : 'Tạo ngôn ngữ không thành công',
  })
})

//* Lấy danh sách ngôn ngữ
export const getLanguages = expressAsyncHandler(async (req, res) => {
  const languages = await Language.find()
  res.status(200).json({
    success: true,
    data: languages ? languages : 'Không có ngôn ngữ nào',
  })
})
