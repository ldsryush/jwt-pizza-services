const request = require('supertest');
const app = require('../service');

let testUser;
let testUserAuthToken;
let adminAuthToken;

beforeAll(async () => {
  // Wait for database to be ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const adminRes = await request(app).put('/api/auth').send({ email: 'a@jwt.com', password: 'admin' });
  if (!adminRes.body.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminRes.body)}`);
  }
  adminAuthToken = adminRes.body.token;

  // Register a test user with timestamp for uniqueness
  testUser = { name: 'pizza diner', email: `test${Date.now()}${Math.floor(Math.random() * 1000)}@test.com`, password: 'a' };
  const registerRes = await request(app).post('/api/auth').send(testUser);
  if (!registerRes.body.token || !registerRes.body.user) {
    throw new Error(`User registration failed: ${JSON.stringify(registerRes.body)}`);
  }
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;
});

describe('User Router Tests', () => {
  test('get current user', async () => {
    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('email');
    expect(res.body.email).toBe(testUser.email);
  });

  test('get current user without auth', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  test('update user as self', async () => {
    const updates = {
      name: 'Updated Name',
      email: testUser.email,
      password: 'newpassword'
    };
    
    const res = await request(app)
      .put(`/api/user/${testUser.id}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(updates);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.name).toBe(updates.name);
    
    // Update token for subsequent tests
    testUserAuthToken = res.body.token;
    
    // Verify login with new password
    const loginRes = await request(app)
      .put('/api/auth')
      .send({ email: testUser.email, password: 'newpassword' });
    expect(loginRes.status).toBe(200);
    testUserAuthToken = loginRes.body.token;
  });

  test('update user as admin', async () => {
    const updates = {
      name: 'Admin Updated',
      email: testUser.email,
      password: 'a'
    };
    
    const res = await request(app)
      .put(`/api/user/${testUser.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updates);
    
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe(updates.name);
  });

  test('update user without auth', async () => {
    const updates = { name: 'No Auth' };
    
    const res = await request(app)
      .put(`/api/user/${testUser.id}`)
      .send(updates);
    
    expect(res.status).toBe(401);
  });

  test('update different user as non-admin', async () => {
    const otherUser = { name: 'other user', email: `other${Date.now()}${Math.floor(Math.random() * 1000)}@test.com`, password: 'pass' };
    const otherRes = await request(app).post('/api/auth').send(otherUser);
    const otherUserId = otherRes.body.user.id;
    
    const updates = { name: 'Unauthorized Update' };
    
    const res = await request(app)
      .put(`/api/user/${otherUserId}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(updates);
    
    expect(res.status).toBe(403);
  });

  test('list users', async () => {
    const res = await request(app)
      .get('/api/user')
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('not implemented');
  });

  test('delete user', async () => {
    const res = await request(app)
      .delete(`/api/user/${testUser.id}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('not implemented');
  });
});
