// OTP generator. 4 digits to match the DLT-approved Fast2SMS template
// used for both login AND booking completion (FAST2SMS_TEMPLATE_ID —
// registered with a 4-digit {OTP} variable). The length param is kept
// for future surfaces that might need a different size.
const generateOTP = (length = 4) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  const otp = Math.floor(min + Math.random() * (max - min));
  return otp.toString();
};

export { generateOTP };
