// OTP generator. Default 4 digits to match the DLT-approved Fast2SMS
// template used for login (FAST2SMS_TEMPLATE_ID — registered with a
// 4-digit {OTP} variable). Pass a length explicitly for other surfaces
// that need a different size — booking completion OTPs stay at 6 digits
// because the customer reads them off a screen and tells the rep, no
// SMS template length constraint applies.
const generateOTP = (length = 4) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  const otp = Math.floor(min + Math.random() * (max - min));
  return otp.toString();
};

export { generateOTP };
