export function validateRegistration(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Enter valid account details.');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const age = Number(body.age);
  const password = body.password;
  if (name.length < 2 || name.length > 80) throw new Error('Name must be 2 to 80 characters.');
  if (!location || location.length > 100) throw new Error('Enter a location of up to 100 characters.');
  if (!Number.isInteger(age) || age < 13 || age > 120) throw new Error('Age must be a whole number from 13 to 120.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Password must be at least 8 characters and at most 72 bytes.');
  if (password !== body.confirmPassword) throw new Error('Passwords do not match.');
  return { name, location, age, email, password };
}
