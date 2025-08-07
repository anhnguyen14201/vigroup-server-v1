import jwt, { TokenExpiredError, JwtPayload } from 'jsonwebtoken'
import asyncHandler from 'express-async-handler'
import { NextFunction, Request, Response } from 'express'

const SECRET = process.env.SECRET_CODE
if (!SECRET) {
  throw new Error('SECRET_CODE is not defined')
}

// Helpers
function extractBearerToken(header?: string): string | undefined {
  if (header?.startsWith('Bearer ')) {
    return header.slice(7)
  }
}

/* function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken')
  res.clearCookie('refreshToken')
} */

/* async function handleExpiredAccessToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.path === '/api/auth/refresh') {
    return next()
  }

  const refreshToken = req.cookies.refreshToken
  if (!refreshToken) {
    clearAuthCookies(res)
    return res
      .status(401)
      .json({ message: 'Session expired. Please login again.' })
  }

  try {
    if (!SECRET) {
      throw new Error('SECRET_CODE is not defined')
    }
    const refreshPayload = jwt.verify(refreshToken, SECRET) as JwtPayload
    const newAccessToken = generateAccessToken({
      _id: refreshPayload._id,
      role: refreshPayload.role,
    })
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    })
    req.user = refreshPayload
    return next()
  } catch (err) {
    clearAuthCookies(res)
    if (err instanceof TokenExpiredError) {
      return res
        .status(401)
        .json({ message: 'Refresh token expired. Please login again.' })
    }
    return res
      .status(401)
      .json({ message: 'Invalid refresh token. Please login again.' })
  }
} */

// Middleware chính
export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || req.headers.Authorization
    const token = extractBearerToken(header as string | undefined)

    if (!token) {
      res.status(401).json({ message: 'Unauthorized: token missing' })
      return
    }

    try {
      const payload = jwt.verify(token, SECRET) as JwtPayload
      req.user = payload as any
      return next()
    } catch (err) {
      res.status(401).json({ message: 'Invalid token' })
      return
    }
  },
)

// Middleware phân quyền
export const authorizeRole =
  (allowedRoles: number[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JwtPayload
    if (!user || !allowedRoles.includes(user.role)) {
      res.status(403).json({ message: 'Forbidden: insufficient rights' })
      return
    }
    next()
  }

// Predefined role checks
export const isCEO = authorizeRole([3515])
export const isAdmin = authorizeRole([1413914])
export const isManager = authorizeRole([1311417518])
export const isEmployee = authorizeRole([5131612152555])
export const isCustomer = authorizeRole([32119201513518])
