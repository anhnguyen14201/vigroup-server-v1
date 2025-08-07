import dotenv from 'dotenv'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { PassThrough } from 'stream'

//* Nạp biến môi trường từ tệp .env
dotenv.config()

//! Cấu hình Cloudinary với thông tin từ biến môi trường
export const cloud = cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME, //* Tên tài khoản Cloudinary
  api_key: process.env.CLOUDINARY_KEY, //* API Key của Cloudinary
  api_secret: process.env.CLOUDINARY_SECRET, //* API Secret của Cloudinary
})

//! Thiết lập bộ  nhớcho multer sử dụng Cloudinary
const storageIcons = new CloudinaryStorage({
  cloudinary, //* Đối tượng cloudinary đã cấu hình
  params: {
    folder: 'vigroup/icons', //! Thư mục lưu trữ trên Cloudinary
    allowed_formats: ['jpg', 'png'], //! Các định dạng tệp được phép tải lên
  },
} as any)

const storageImageSliders = new CloudinaryStorage({
  cloudinary, //* Đối tượng cloudinary đã cấu hình
  params: {
    folder: 'vigroup/sliders', //! Thư mục lưu trữ trên Cloudinary
    allowed_formats: ['jpg', 'png', 'webp'], //! Các định dạng tệp được phép tải lên
    transformation: [{ format: 'webp', quality: 'auto' }],
  },
} as any)

const storageImageProducts = new CloudinaryStorage({
  cloudinary, //* Đối tượng cloudinary đã cấu hình
  params: {
    folder: 'vigroup/products', //! Thư mục lưu trữ trên Cloudinary
    allowed_formats: ['jpg', 'png', 'webp'], //! Các định dạng tệp được phép tải lên
    transformation: [{ format: 'webp', quality: 'auto' }],
  },
} as any)

const storageImageProjects = new CloudinaryStorage({
  cloudinary, //* Đối tượng cloudinary đã cấu hình
  params: {
    folder: 'vigroup/projects', //! Thư mục lưu trữ trên Cloudinary
    allowed_formats: ['jpg', 'png', 'webp'], //! Các định dạng tệp được phép tải lên
    transformation: [{ format: 'webp', quality: 'auto' }],
  },
} as any)
const storageImagePages = new CloudinaryStorage({
  cloudinary, //* Đối tượng cloudinary đã cấu hình
  params: {
    folder: 'vigroup/pages', //! Thư mục lưu trữ trên Cloudinary
    allowed_formats: ['jpg', 'png', 'webp'], //! Các định dạng tệp được phép tải lên
    transformation: [{ format: 'webp', quality: 'auto' }],
  },
} as any)

//! Khởi tạo middleware upload với cấu hình bộ nhớ đã thiết lập
export const uploadCloudForIcons = multer({ storage: storageIcons })
export const uploadCloudForImageSliders = multer({
  storage: storageImageSliders,
})
export const uploadCloudForProductImages = multer({
  storage: storageImageProducts,
})
export const uploadCloudForProjectImages = multer({
  storage: storageImageProjects,
})
export const uploadCloudForPageImages = multer({
  storage: storageImagePages,
})

export async function uploadPdfBuffer(buffer: Buffer, publicId: string) {
  return new Promise<any>((resolve, reject) => {
    const passthrough = new PassThrough()
    passthrough.end(buffer)

    cloudinary.uploader
      .upload_stream(
        {
          resource_type: 'raw',
          public_id: publicId,
          format: 'pdf',
        },
        (error, result) => {
          if (error) return reject(error)
          resolve(result)
        },
      )
      .end(buffer)
  })
}

export function getSignedUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'upload',
    sign_url: true,
    format: 'pdf', // ← thêm dòng này
  })
}
