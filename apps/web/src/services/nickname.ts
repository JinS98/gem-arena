export function normalizeNickname(value: string): string {
  return value.trim();
}

export function nicknameError(value: string): string | null {
  const length = Array.from(normalizeNickname(value)).length;
  if (length < 2 || length > 16) return '닉네임은 앞뒤 공백을 제외하고 2~16자로 입력해 주세요.';
  return null;
}
