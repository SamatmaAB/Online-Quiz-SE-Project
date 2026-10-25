import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export function hashResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRawResetToken() {
  return randomBytes(32).toString("base64url");
}

export function isPasswordResetMailConfigured(env = process.env) {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.MAIL_FROM);
}

export function createPasswordResetTransport(env = process.env) {
  if (!isPasswordResetMailConfigured(env)) return null;
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const auth = env.SMTP_USER && env.SMTP_PASS
    ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
    : undefined;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    ...(auth ? { auth } : {})
  });
}

export async function sendPasswordResetEmail({ transport, from, to, token, clientOrigin }) {
  const resetUrl = new URL("/", clientOrigin);
  resetUrl.searchParams.set("resetToken", token);
  await transport.sendMail({
    from,
    to,
    subject: "Reset your Quizly password",
    text: `Use this one-time link to reset your password within 15 minutes:\n\n${resetUrl.href}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use this one-time link to reset your password within 15 minutes:</p><p><a href="${resetUrl.href}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
  });
}

export async function issuePasswordResetToken({ email, User, PasswordResetToken, now = Date.now() }) {
  const user = await User.findOne({ email }).select("_id email name");
  if (!user) return null;

  await PasswordResetToken.deleteMany({ user: user._id });
  const token = createRawResetToken();
  await PasswordResetToken.create({
    user: user._id,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now + PASSWORD_RESET_TTL_MS)
  });
  return { user, token };
}

export async function completePasswordReset({ token, password, User, PasswordResetToken, hashPassword, now = Date.now() }) {
  if (typeof token !== "string" || token.length < 32 || token.length > 128) return false;
  const reset = await PasswordResetToken.findOneAndDelete({
    tokenHash: hashResetToken(token),
    expiresAt: { $gt: new Date(now) }
  });
  if (!reset) return false;

  const user = await User.findById(reset.user).select("+passwordHash tokenVersion");
  if (!user) return false;
  user.passwordHash = await hashPassword(password);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await PasswordResetToken.deleteMany({ user: user._id });
  return true;
}
