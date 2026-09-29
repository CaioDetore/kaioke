export const errorCodes = [
  'INVALID_PAYLOAD',
  'UNAUTHORIZED',
  'INVALID_VIDEO',
  'DUPLICATE_VIDEO',
  'QUEUE_LIMIT',
  'SESSION_UNAVAILABLE',
] as const

export type ErrorCode = (typeof errorCodes)[number]

export interface AppError {
  code: ErrorCode
  message: string
}
