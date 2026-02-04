const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

let testUser;
let testUserAuthToken;
let adminAuthToken;
let franchiseeUser;
let franchiseeAuthToken;
let testFranchiseId;
let testStoreId;

const adminCredentials = {
  name: 'Franchise Admin',
  email: `franchise-admin-${Date.now()}@test.com`,
  password: 'admin',
};

beforeAll(async () => {
  // Directly create admin user in database
  await DB.addUser({ ...adminCredentials, roles: [{ role: Role.Admin }] });
  
  const adminRes = await request(app).put('/api/auth').send({ 
    email: adminCredentials.email, 
    password: adminCredentials.password 
  });
  expect(adminRes.status).toBe(200);
  adminAuthToken = adminRes.body.token;

  // Register a test user
  testUser = { name: 'pizza diner', email: `test${Date.now()}${Math.floor(Math.random() * 1000)}@test.com`, password: 'a' };
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;

  // Register a franchisee user
  franchiseeUser = { name: 'franchisee', email: `franchisee${Date.now()}${Math.floor(Math.random() * 1000)}@test.com`, password: 'franchisee' };
  const franchiseeRes = await request(app).post('/api/auth').send(franchiseeUser);
  franchiseeAuthToken = franchiseeRes.body.token;
  franchiseeUser.id = franchiseeRes.body.user.id;
});

describe('Franchise Router Tests', () => {
  test('get franchises', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(Array.isArray(res.body.franchises)).toBe(true);
    expect(res.body).toHaveProperty('more');
  });

  test('get franchises with pagination', async () => {
    const res = await request(app).get('/api/franchise?page=0&limit=5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
  });

  test('get franchises with name filter', async () => {
    const res = await request(app).get('/api/franchise?name=pizza*');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
  });

  test('create franchise as admin', async () => {
    const franchise = {
      name: 'Test Franchise ' + Math.random(),
      admins: [{ email: franchiseeUser.email }]
    };
    
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(franchise);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe(franchise.name);
    expect(res.body.admins).toBeDefined();
    expect(res.body.admins.length).toBe(1);
    expect(res.body.admins[0]).toMatchObject({ email: franchiseeUser.email });
    
    testFranchiseId = res.body.id;
  });

  test('create franchise without auth', async () => {
    const franchise = {
      name: 'Test Franchise',
      admins: [{ email: 'test@test.com' }]
    };
    
    const res = await request(app)
      .post('/api/franchise')
      .send(franchise);
    
    expect(res.status).toBe(401);
  });

  test('create franchise as non-admin', async () => {
    const franchise = {
      name: 'Test Franchise',
      admins: [{ email: 'test@test.com' }]
    };
    
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(franchise);
    
    expect(res.status).toBe(403);
  });

  test('create franchise with invalid admin email', async () => {
    const franchise = {
      name: 'Test Franchise',
      admins: [{ email: 'nonexistent@test.com' }]
    };
    
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(franchise);
    
    expect(res.status).toBe(404);
  });

  test('get user franchises', async () => {
    const res = await request(app)
      .get(`/api/franchise/${franchiseeUser.id}`)
      .set('Authorization', `Bearer ${franchiseeAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('get user franchises as admin', async () => {
    const res = await request(app)
      .get(`/api/franchise/${franchiseeUser.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('get user franchises without auth', async () => {
    const res = await request(app).get(`/api/franchise/${testUser.id}`);
    expect(res.status).toBe(401);
  });

  test('get user franchises as different user', async () => {
    const res = await request(app)
      .get(`/api/franchise/${franchiseeUser.id}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('create store as franchisee', async () => {
    const store = { name: 'Test Store ' + Math.random() };
    
    const res = await request(app)
      .post(`/api/franchise/${testFranchiseId}/store`)
      .set('Authorization', `Bearer ${franchiseeAuthToken}`)
      .send(store);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe(store.name);
    
    testStoreId = res.body.id;
  });

  test('create store as admin', async () => {
    const store = { name: 'Admin Store' };
    
    const res = await request(app)
      .post(`/api/franchise/${testFranchiseId}/store`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(store);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('create store without auth', async () => {
    const store = { name: 'Test Store' };
    
    const res = await request(app)
      .post(`/api/franchise/${testFranchiseId}/store`)
      .send(store);
    
    expect(res.status).toBe(401);
  });

  test('create store as non-franchisee', async () => {
    const store = { name: 'Test Store' };
    
    const res = await request(app)
      .post(`/api/franchise/${testFranchiseId}/store`)
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(store);
    
    expect(res.status).toBe(403);
  });

  test('delete store as franchisee', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${testFranchiseId}/store/${testStoreId}`)
      .set('Authorization', `Bearer ${franchiseeAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('store deleted');
  });

  test('delete store without auth', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${testFranchiseId}/store/1`);
    
    expect(res.status).toBe(401);
  });

  test('delete store as non-franchisee', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${testFranchiseId}/store/1`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    
    expect(res.status).toBe(403);
  });

  test('delete franchise', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${testFranchiseId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
  });
});
