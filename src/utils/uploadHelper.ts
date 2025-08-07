// utils/uploadHelper.ts
import { Readable } from 'stream'
import { cloud } from '~/configs/cloudinary.config.js'

export function uploadStream(
  buffer: Buffer,
  folder: string,
): Promise<{ url: string; public_id: string }> {
  return new Promise((res, rej) => {
    const stream = cloud.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err: any, result: any) => {
        if (err || !result) return rej(err || new Error('No result'))
        res({ url: result.secure_url, public_id: result.public_id })
      },
    )
    Readable.from(buffer).pipe(stream)
  })
}

export function deleteCloudImage(public_id: string) {
  return cloud.uploader.destroy(public_id)
}
