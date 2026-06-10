// Fast2SMS DLT transactional OTP delivery — shared between auth (login
// OTPs) and bookings (completion OTPs). The same DLT template covers
// both surfaces because the registered text reads "Your OTP for
// {businessName} is {OTP}" which carries no purpose-specific copy.
//
// Easy-to-get-wrong details that the spec calls out:
//   - GET request with all params in the query string (not a JSON body).
//   - `message` is the numeric DLT template ID, NOT literal text.
//   - `variables_values` is pipe-separated, in the exact order the DLT
//     template defines: {OTP}|{businessName}.
//   - `numbers` is a bare 10-digit number, no +91.
//   - Read response.text() first, then JSON.parse — Fast2SMS sometimes
//     returns non-JSON on errors.

const FAST2SMS_ENDPOINT = 'https://www.fast2sms.com/dev/bulkV2';

// Second variable in the DLT template — must match what was approved on
// the DLT portal.
const BUSINESS_NAME = 'FliponeX';

export const sendOtpSms = async ({ otpCode, phone }) => {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  const route = process.env.FAST2SMS_ROUTE?.trim() || 'dlt';
  const senderId = process.env.FAST2SMS_SENDER_ID?.trim();
  const templateId = process.env.FAST2SMS_TEMPLATE_ID?.trim();

  if (!apiKey) {
    return { success: false, error: 'FAST2SMS_API_KEY is not configured.' };
  }
  if (!senderId || !templateId) {
    return { success: false, error: 'FAST2SMS sender/template configuration is incomplete.' };
  }

  try {
    const url = new URL(FAST2SMS_ENDPOINT);
    url.searchParams.set('authorization', apiKey);
    url.searchParams.set('route', route);
    url.searchParams.set('sender_id', senderId);
    url.searchParams.set('message', templateId);
    url.searchParams.set('variables_values', `${otpCode}|${BUSINESS_NAME}`);
    url.searchParams.set('numbers', phone);
    url.searchParams.set('flash', '0');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const rawResponse = await response.text();
    let providerResponse = rawResponse;
    try {
      providerResponse = rawResponse ? JSON.parse(rawResponse) : null;
    } catch {
      /* Fast2SMS returns non-JSON on some errors — keep the raw string. */
    }

    if (!response.ok) {
      console.error('[FAST2SMS_OTP_SEND_FAILED]', {
        status: response.status,
        phone,
        response: providerResponse,
      });
      return {
        success: false,
        error: 'SMS provider rejected the OTP request.',
        providerResponse,
      };
    }

    return { success: true, providerResponse };
  } catch (error) {
    console.error('[FAST2SMS_OTP_SEND_ERROR]', {
      phone,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { success: false, error: 'Unable to reach the SMS provider right now.' };
  }
};
