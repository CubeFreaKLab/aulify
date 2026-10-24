export const PASSWORD_HINT =
  'Entre 8 y 128 caracteres, con mayúscula, minúscula, número y símbolo. Puedes pegar tu contraseña.';

// The same requirements apply to signup and password recovery, never to existing sign-ins.
export function passwordError(password: string): string | undefined {
  if (password.length < 8 || password.length > 128) return 'Usa entre 8 y 128 caracteres.';
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[!@#$%^&*()_+\-=\[\]{};'":\\|<>?,./`~]/.test(password)
  )
    return 'Añade al menos una mayúscula, una minúscula, un número y un símbolo (por ejemplo, !).';
}
