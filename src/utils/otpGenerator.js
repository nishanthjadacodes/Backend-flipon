// 4-digit OTP per the DLT-approved Fast2SMS template (FAST2SMS_TEMPLATE_ID).
// The template's {OTP} variable is registered as 4 digits, so changing the
// length here without re-registering the template would cause Fast2SMS to
// reject the SMS at the gateway.
const generateOTP = () => {
  const otp = Math.floor(1000 + Math.random() * 9000);
  return otp.toString();
};

export { generateOTP };
