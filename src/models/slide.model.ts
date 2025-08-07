import mongoose, { Schema } from 'mongoose'
import { ISlide } from '~/interface'

const SlideSchema = new Schema<ISlide>(
  {
    imageUrls: {
      type: [String],
    },
    buttonUrl: {
      type: String,
    },
    activity: {
      type: Boolean,
      default: true,
    },
    order: { type: Number },
    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },
        title: { type: String },
        desc: { type: String },
        buttonText: { type: String },
      },
      {
        versionKey: false,
        timestamps: true,
      },
    ],
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

// Trước khi lưu tài liệu mới (this.isNew)
SlideSchema.pre('save', async function (next) {
  if (this.isNew) {
    // Tìm slide có order lớn nhất
    const last = await (this.constructor as mongoose.Model<ISlide>)
      .findOne({}, { order: 1 })
      .sort({ order: -1 })
      .lean()

    this.order = last && last.order ? last.order + 1 : 1
  }
  next()
})

export default mongoose.model<ISlide>('Slide', SlideSchema)
