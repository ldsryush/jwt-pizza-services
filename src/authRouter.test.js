const request = require('supertest');
const app = require('./service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let adminUser = { email: 'a@jwt.com', password: 'admin' };
let adminAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  // Login as admin
  const adminRes = await request(app).put('/api/auth').send(adminUser);
  adminAuthToken = adminRes.body.token;
});

test('register', async () => {
  const newUser = { name: 'test user', email: Math.random().toString(36).substring(2, 12) + '@test.com', password: 'password123' };
  const registerRes = await request(app).post('/api/auth').send(newUser);
  
  expect(registerRes.status).toBe(200);
  expect(registerRes.body.token).toBeDefined();
  expect(registerRes.body.user).toBeDefined();
  expect(registerRes.body.user.name).toBe(newUser.name);
  expect(registerRes.body.user.email).toBe(newUser.email);
  expect(registerRes.body.user.password).toBeUndefined();
  expect(registerRes.body.user.roles).toEqual([{ role: 'diner' }]);
  expectValidJwt(registerRes.body.token);
});

test('register with missing fields', async () => {
  const res = await request(app).post('/api/auth').send({ name: 'test' });
  expect(res.status).toBe(400);
  expect(res.body.message).toBe('name, email, and password are required');
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('login with invalid credentials', async () => {
  const loginRes = await request(app).put('/api/auth').send({ email: testUser.email, password: 'wrongpassword' });
  expect(loginRes.status).toBe(404);
});

test('logout', async () => {
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');
  
  // Re-login after logout for other tests
  const loginRes = await request(app).put('/api/auth').send(testUser);
  testUserAuthToken = loginRes.body.token;
});

test('logout without token', async () => {
  const logoutRes = await request(app).delete('/api/auth');
  expect(logoutRes.status).toBe(401);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}