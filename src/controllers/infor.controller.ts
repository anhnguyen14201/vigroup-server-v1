import expressAsyncHandler from 'express-async-handler'
import { IUser } from '~/interface'
import { Infor } from '~/models'

//* Tạo mới
export const createInfor = expressAsyncHandler(async (req, res) => {
  const newInfor = await Infor.create({
    ...req.body,
    activity: true,
  })

  res.status(201).json({
    success: !!newInfor,
    data: newInfor,
  })
})

//* Lấy thông tin
export const getInfor = expressAsyncHandler(async (req, res) => {
  const user = req.user as IUser | undefined
  const adminRoles = [3515, 1413914, 1311417518]
  const isAdmin = user ? adminRoles.includes(user.role) : false
  const filter = isAdmin ? {} : { activity: true }

  const infor = await Infor.find(filter)

  if (!infor) {
    res.status(404).json({ success: false, message: 'Không tìm thấy Logo' })
    return
  }
  res.status(200).json({
    success: true,
    data: infor ? infor : 'Không có logo nào',
  })
})

//* Sửa thông tin
export const updateInfor = expressAsyncHandler(async (req, res) => {
  const { inforId } = req.params
  const existing = await Infor.findById(inforId)
  if (!existing) {
    res.status(404).json({ success: false, message: 'Logo not found' })
    return
  }

  const updated = await Infor.findByIdAndUpdate(
    inforId,
    {
      ...req.body,
    },
    { new: true },
  )

  res.json({ success: true, data: updated })
})

//* Xóa thông tin
export const deleteInfor = expressAsyncHandler(async (req, res) => {
  const { inforId } = req.params

  if (!inforId) {
    res.status(400).json({ message: 'Thiếu id Infor' })
    return
  }

  const infor = await Infor.findByIdAndDelete(inforId)

  if (!infor) {
    res.status(404).json({ message: 'Không tìm thấy Infor' })
    return
  }

  res.status(200).json({
    success: true,
    message: 'Xóa Infor thành công',
    data: infor,
  })
})
