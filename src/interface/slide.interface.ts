import { Document } from 'mongoose'
import { ISlideTranslation } from '~/interface/slideTranslation.interface.js'

export interface ISlide extends Document {
  imageUrls: string[] // Mảng URL của hình ảnh cho slide
  buttonUrl: string
  activity: boolean
  order: number
  translations: ISlideTranslation[]
  createdAt: Date
  updatedAt: Date
}

export interface OrderUpdate {
  _id: string
  order: number
}
