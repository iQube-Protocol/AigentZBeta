function isValidKnytUsername(input: string): boolean {
 // Check if the input ends with @knyt
 if (!input.endsWith("@knyt"))
  throw new Error("Invalid Extension, it must be @knyt");

 const username = input.slice(0, -5);

 if (username.length === 0 || username.length > 20) {
  throw new Error("Invalid Handle, it must be less than 20 characters");
 }

 const validUsernameRegex = /^[a-zA-Z0-9_]+$/;

 let validation = validUsernameRegex.test(username);

 if (!validation) throw new Error("Invalid Handle, it must be alphanumeric");

 return validation;
}

export { isValidKnytUsername };
