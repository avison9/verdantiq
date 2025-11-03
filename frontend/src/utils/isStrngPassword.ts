export const isStrongPassword = (password: string): boolean => {
  const minLength = /.{8,}/; // At least 8 characters
  const uppercase = /[A-Z]/; // At least one uppercase letter
  const lowercase = /[a-z]/; // At least one lowercase letter
  const number = /[0-9]/; // At least one digit
  const specialChar = /[!@#$%^&*(),.?":{}|<>]/; // At least one special character

  return (
    minLength.test(password) &&
    uppercase.test(password) &&
    lowercase.test(password) &&
    number.test(password) &&
    specialChar.test(password)
  );
};
