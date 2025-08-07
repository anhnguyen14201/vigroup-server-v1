import mongoose, { Schema } from 'mongoose'

const LogoSchema = new Schema(
  {
    imageUrls: {
      type: [String],
    },
    logoType: {
      type: String,
    },
    logoTitle: {
      type: String,
    },
    activity: {
      type: Boolean,
      default: true,
    },
    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },
        desc: { type: String },
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

export default mongoose.model('Logo', LogoSchema)
