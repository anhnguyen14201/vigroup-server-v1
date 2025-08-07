import { Document } from 'mongoose'
import { ILanguage } from '~/interface/language.interface'

export interface ISlideTranslation extends Document {
  language: ILanguage // Tham chiếu đến model Language
  buttonText: string
  title?: string
  desc?: string
  createdAt: Date
  updatedAt: Date
}
