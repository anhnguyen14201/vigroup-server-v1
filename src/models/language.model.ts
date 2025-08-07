import mongoose, { Schema } from 'mongoose'
import { ILanguage } from '~/interface/language.interface.js'

const LanguageSchema = new Schema<ILanguage>(
  {
    // URL của icon (cờ) đại diện cho ngôn ngữ
    iconUrl: {
      type: [String],
      required: true,
    },
    // Mã ngôn ngữ, ví dụ: 'vi' cho tiếng Việt, 'en' cho tiếng Anh
    code: {
      type: String,
      required: true,
      unique: true,
      default: 'vi',
    },
    // Tên hiển thị của ngôn ngữ, ví dụ: 'Tiếng Việt'
    name: {
      type: String,
      required: true,
      unique: true,
      default: 'Tiếng Việt',
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

export default mongoose.model<ILanguage>('Language', LanguageSchema)
