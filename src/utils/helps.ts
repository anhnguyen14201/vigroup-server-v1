import { v2 as cloudinary } from 'cloudinary'
import { Counter } from '~/models/counter.model'

export const deleteImages = async (
  imagePaths: (string | null | undefined)[],
) => {
  // 1. Lọc chỉ giữ chuỗi hợp lệ
  const validPaths = imagePaths.filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  )

  // 2. Tách publicId từ URL
  const publicIds = validPaths.map(path => {
    // Ví dụ URL: https://res.cloudinary.com/demo/image/upload/v1611111111/folder/sub/img.jpg
    const parts = path.split('/') // safe: parts là string[]
    const filename = parts.slice(7).join('/') // ['folder','sub','img.jpg'] → 'folder/sub/img.jpg'
    return filename.split('.')[0] // 'folder/sub/img'
  })

  // 3. Xoá tất cả song song
  const deletions = publicIds.map(async publicId => {
    try {
      const result = await cloudinary.uploader.destroy(publicId)
      console.log('Xóa ảnh thành công:', result)
    } catch (error) {
      console.error('Xóa ảnh thất bại:', error)
    }
  })

  await Promise.all(deletions)
}

export const deletePDF = async (
  imagePaths: string | (string | null | undefined)[] | null | undefined,
) => {
  // 1. Chuẩn hoá thành mảng
  const pathsArray = Array.isArray(imagePaths)
    ? imagePaths
    : imagePaths
      ? [imagePaths]
      : []

  // 2. Lọc chuỗi URL hợp lệ
  const validPaths = pathsArray.filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  )
  if (!validPaths.length) return

  // 3. Tách publicId chính xác
  const publicIds = validPaths.map(url => {
    const parts = url.split('/')
    // tìm vị trí "upload"
    const uploadIndex = parts.findIndex(p => p === 'upload')
    const after = parts.slice(uploadIndex + 1) // [transform..., version, ...path]
    // tìm version đầu tiên (ví dụ /^v\d+$/)
    const versionIdx = after.findIndex(seg => /^v\d+$/.test(seg))
    // phần sau version chính là đường dẫn gốc
    const publicPathSegments =
      versionIdx >= 0 ? after.slice(versionIdx + 1) : after
    // join lại và bỏ phần mở rộng
    const fullPath = publicPathSegments.join('/')
    // Không loại bỏ extension với raw!
    return fullPath
  })

  // 4. Xóa song song
  await Promise.all(
    publicIds.map(async publicId => {
      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'raw',
        })
        console.log(`Xóa ${publicId} thành công:`, result)
      } catch (err) {
        console.error(`Xóa ${publicId} thất bại:`, err)
      }
    }),
  )
}
// Xóa ảnh cũ trên Cloudinary nếu tồn tại và cập nhật ảnh mới
export const deleteAndUploadImages = async (
  currentImages: any,
  newImages: any,
) => {
  // Xóa ảnh cũ
  if (currentImages && currentImages.length > 0) {
    await deleteImages(currentImages)
  }
  // Cập nhật ảnh mới
  if (newImages && newImages.length > 0) {
    return newImages.map((file: any) => file.path)
  }
  return []
}

export const calculateTotalHours = (checkIn: any, checkOut: any) => {
  const checkInTime = new Date(checkIn)
  const checkOutTime = new Date(checkOut)
  const diffInMs = checkOutTime.getTime() - checkInTime.getTime() // Lấy chênh lệch thời gian tính bằng mili giây
  const diffInHours = diffInMs / (1000 * 60 * 60) // Chuyển đổi sang giờ
  return diffInHours
}

export const generateQuoteCode = async (
  type: 'quote' | 'invoice',
): Promise<string> => {
  const now = new Date()
  const year = now.getFullYear()

  // Chọn prefix
  const prefix = type === 'quote' ? 'BG' : type === 'invoice' ? 'VF' : ''

  // atomic find-and-update lên Counter với key = type, year
  const counter = await Counter.findOneAndUpdate(
    { name: type, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).exec()

  // Đệm 4 chữ số
  const seq = counter.seq.toString().padStart(4, '0')

  return `${prefix}${year}-${seq}`
}
