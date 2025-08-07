import { Document } from 'mongoose'

export interface ILogo extends Document {
  imageUrls: string[] // Mảng URL của hình ảnh cho slide
  logoType: string
  logoTitle: string
  activity: boolean
  createdAt: Date
  updatedAt: Date
}
