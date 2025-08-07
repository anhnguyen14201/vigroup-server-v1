import { Document } from 'mongoose'

export interface ILanguage extends Document {
  iconUrl: string[]
  code: string
  name: string
  createdAt: Date
  updatedAt: Date
}
