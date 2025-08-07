import { Document, Types } from 'mongoose'

export interface IUser extends Document {
  _id: Types.ObjectId
  fullName: string
  email?: string
  phone?: string
  password: string
  country?: string
  street?: string
  province?: string
  postalCode?: string
  role: 3515 | 1413914 | 1311417518 | 5131612152555 | 32119201513518
  position: string
  refreshTokens: {
    token: string
    createdAt: Date
  }[]
  isBlock?: boolean
  isSuperuser: boolean
  /* facebook?: IFacebook */
  facebookId?: string
  projects: Types.ObjectId[]
  carts: Types.ObjectId[]
  passwordResetToken?: string
  passwordResetExpires?: string
  passwordChangedAt?: string
  hourlyRate: number
  attendances: Types.ObjectId[]
  companyName?: string
  ico?: string
  dic?: string
  companyAddress?: string
}
