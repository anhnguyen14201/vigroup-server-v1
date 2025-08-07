import mongoose, { Schema } from 'mongoose'

const InstallationSchema = new Schema(
  {
    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },

        desc: {
          type: String,
          trim: true,
        },
      },
      {
        versionKey: false,
        timestamps: true,
      },
    ],

    cost: {
      type: String,
    },

    tax: {
      type: Number,
    },

    imageUrls: {
      type: [String],
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

export default mongoose.model('Installation', InstallationSchema)
