export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
export function validateRegistration({ name, email, password } = {}) {
  const errors = {};
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanEmail = normalizeEmail(email);
  if (cleanName.length < 2 || cleanName.length > 60) errors.name = "Name must be between 2 and 60 characters.";
  if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.email = "Enter a valid email address.";
  if (typeof password !== "string" || password.length < 8 || password.length > 72) errors.password = "Password must be between 8 and 72 characters.";
  return { valid: Object.keys(errors).length === 0, errors, cleanName, cleanEmail };
}
export function validateLogin({ email, password } = {}) {
  const errors = {};
  const cleanEmail = normalizeEmail(email);
  if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.email = "Enter a valid email address.";
  if (typeof password !== "string" || password.length === 0 || password.length > 72) errors.password = "Enter your password.";
  return { valid: Object.keys(errors).length === 0, errors, cleanEmail };
}
