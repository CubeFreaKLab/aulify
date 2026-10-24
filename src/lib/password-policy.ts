// The same requirements apply to signup and password recovery, never to existing sign-ins.
export function passwordError(password: string): string | undefined {
  if (password.length > 128) return 'Usa una contraseña más corta.';
  if (
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[!@#$%^&*()_+\-=\[\]{};'":\\|<>?,./`~]/.test(password)
  )
    return 'Usa al menos 8 caracteres, con mayúscula, minúscula, número y símbolo (por ejemplo, !).';
}
