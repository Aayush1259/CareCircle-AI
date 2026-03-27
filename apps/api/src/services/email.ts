import nodemailer from "nodemailer";
import { env, featureFlags } from "../env";

const transporter = featureFlags.smtpEnabled
  ? nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  })
  : nodemailer.createTransport({
    jsonTransport: true,
  });

export const emailService = {
  async send(
    to: string | string[],
    subject: string,
    html: string,
    options?: {
      attachments?: Array<{ filename: string; content: Buffer }>;
    },
  ) {
    const result = await transporter.sendMail({
      from: env.smtpFrom,
      to,
      subject,
      html,
      attachments: options?.attachments,
    });

    if (!featureFlags.smtpEnabled) {
      // Demo-safe fallback so judges can still see what would have been sent.
      console.info("CareCircle email fallback", result.messageId);
    }

    return result;
  },
};
