export type CaptchaProvider = 'turnstile' | 'hcaptcha';

export async function verifyCaptcha(token: string): Promise<boolean> {
  const provider = (process.env.CAPTCHA_PROVIDER || 'turnstile').toLowerCase() as CaptchaProvider;
  const secret = process.env.CAPTCHA_SECRET_KEY || '';
  if (!token || !secret) return false;
  try {
    if (provider === 'turnstile') {
      const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }),
      });
      const data: any = await resp.json();
      return !!data.success;
    }
    // hCaptcha
    const resp = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data: any = await resp.json();
    return !!data.success;
  } catch {
    return false;
  }
}
