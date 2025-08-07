import mongoose, { Schema } from 'mongoose'

const Page = new Schema(
  {
    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },

        seoTitle: {
          type: String,
        },

        seoDescription: {
          type: String,
        },
      },
    ],

    articles: [
      {
        translations: [
          {
            language: {
              type: Schema.Types.ObjectId,
              ref: 'Language',
              required: true,
            },

            sectionLabel: {
              type: String,
            },

            heading: {
              type: String,
            },
            subtext: {
              type: String,
            },
            features: [
              {
                type: String,
              },
            ],
          },
        ],

        imageUrls: {
          type: [String],
        },

        videoUrl: {
          type: String,
        },
        titleButton: {
          type: String,
        },
        buttonUrl: {
          type: String,
        },
        position: {
          type: [String],
        },
      },
    ],

    page: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },

    heroSections: [
      {
        translations: [
          {
            language: {
              type: Schema.Types.ObjectId,
              ref: 'Language',
              required: true,
            },

            heroSectionLabel: {
              type: String,
            },

            heroHeading: {
              type: String,
            },
          },
        ],

        imageUrls: {
          type: [String],
        },
      },
    ],

    isActive: {
      type: Boolean,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

export default mongoose.model('Page', Page)
