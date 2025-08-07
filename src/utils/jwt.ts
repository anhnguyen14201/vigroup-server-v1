import jwt from 'jsonwebtoken'

const SECRET_CODE = process.env.SECRET_CODE || 'secretKey'

// Cập nhật hàm generateAccessToken để nhận payload là một object
export const generateAccessToken = (payload: object) => {
  return jwt.sign(payload, SECRET_CODE, { expiresIn: '5m' })
}

// Tương tự cho generateRefreshToken
export const generateRefreshToken = (payload: object) => {
  return jwt.sign(payload, SECRET_CODE, { expiresIn: '7d' })
}

// utils/jwt.ts

/**
 * Base64‑URL decode (browser + Node.js)
 */
function base64UrlDecode(str: string): string {
  // Thay ký tự URL‑safe và thêm padding nếu cần
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = str.length % 4
  if (pad === 2) str += '=='
  else if (pad === 3) str += '='
  else if (pad !== 0) throw new Error('Invalid base64 string')

  // Tại browser: atob(); tại Node.js: Buffer
  if (typeof window !== 'undefined' && window.atob) {
    return decodeURIComponent(
      Array.prototype.map
        .call(
          window.atob(str),
          (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
        )
        .join(''),
    )
  } else {
    // Node.js
    return Buffer.from(str, 'base64').toString('utf8')
  }
}

export interface JwtPayload {
  exp?: number
  iat?: number
  sub?: string
  role?: number
  [key: string]: any
}

/**
 * Giải mã payload của JWT mà không verify signature.
 * @param token JWT string
 * @returns payload object hoặc null nếu không parse được
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }
    const payloadBase64 = parts[1]
    const json = base64UrlDecode(payloadBase64)
    const payload = JSON.parse(json) as JwtPayload
    return payload
  } catch (err) {
    console.error('decodeJwtPayload error:', err)
    return null
  }
}
