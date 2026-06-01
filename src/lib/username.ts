export function normalizeUsername(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

export function isValidUsername(value: string | null | undefined) {
  const username = normalizeUsername(value);
  return /^[a-z0-9._]{3,32}$/.test(username);
}

export function usernameValidationMessage(value: string | null | undefined) {
  const username = normalizeUsername(value);

  if (!username) return "Choose a public @username.";
  if (username.length < 3) return "Use at least 3 characters.";
  if (username.length > 32) return "Use 32 characters or fewer.";
  if (!/^[a-z0-9._]+$/.test(username)) {
    return "Use only letters, numbers, dots, and underscores.";
  }
  return null;
}
