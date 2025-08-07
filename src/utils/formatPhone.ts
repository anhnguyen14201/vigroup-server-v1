// src/utils/formatPhone.ts
export function formatPhoneCZ(raw: string): string {
  // Loại bỏ mọi ký tự không phải số
  const digits = raw.replace(/\D/g, '')

  // Nếu đã bao gồm mã nước 420 (12 chữ số)
  if (digits.length === 12 && digits.startsWith('420')) {
    const local = digits.slice(3) // lấy 9 chữ số sau mã
    return `+420 ${local.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`
  }

  // Nếu chỉ có 9 chữ số
  if (digits.length === 9) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
  }

  // Fall back: trả lại nguyên bản nếu không hợp lệ
  return raw
}
