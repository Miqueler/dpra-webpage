// Keep in sync with supabase/migrations/0003_choose_username.sql.
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,20}$/;

export function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(username);
}
