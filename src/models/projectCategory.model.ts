import mongoose, { Schema } from 'mongoose'

const projectTypeSchema = new Schema(
  {
    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },

        name: {
          type: String,
          unique: true,
          trim: true,
        },

        slug: {
          type: String,
          unique: true,
          trim: true,
        },

        metaDescription: {
          type: String,
          default: '',
          trim: true,
        },
      },
    ],

    projectIds: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
  },
  { timestamps: true },
)

export default mongoose.model('ProjectType', projectTypeSchema)
