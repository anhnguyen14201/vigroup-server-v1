import mongoose, { Schema } from 'mongoose'
import { IInfor } from '~/interface/index.js'

const InforSchema = new Schema<IInfor>(
  {
    inforType: {
      type: String,
    },
    desc: {
      type: String,
    },
    url: {
      type: String,
    },
    title: {
      type: String,
    },

    activity: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

export default mongoose.model<IInfor>('Infor', InforSchema)
