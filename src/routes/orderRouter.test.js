const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

let testUser;
let testUserAuthToken;
let adminAuthToken;

const adminCredentials = {
  name: 'Order Admin',
  email: `order-admin-${Date.now()}@test.com`,
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
}, 30000);

afterAll(async () => {
  // Allow time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

describe('Order Router Tests', () => {
  test('get menu', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('add menu item as admin', async () => {
    const newItem = {
      title: 'Test Pizza',
      description: 'A test pizza',
      image: 'test.png',
      price: 0.005
    };
    
    const res = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(newItem);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('add menu item without auth', async () => {
    const newItem = {
      title: 'Test Pizza',
      description: 'A test pizza',
      image: 'test.png',
      price: 0.005
    };
    
    const res = await request(app)
      .put('/api/order/menu')
      .send(newItem);
    
    expect(res.status).toBe(401);
  });

  test('add menu item as non-admin', async () => {
    const newItem = {
      title: 'Test Pizza',
      description: 'A test pizza',
      image: 'test.png',
      price: 0.005
    };
    
    const res = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(newItem);
    
    expect(res.status).toBe(403);
  });

  test('get orders', async () => {
    const res = await request(app)
      .get('/api/order')
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dinerId');
    expect(res.body).toHaveProperty('orders');
    expect(res.body).toHaveProperty('page');
  });

  test('get orders without auth', async () => {
    const res = await request(app).get('/api/order');
    expect(res.status).toBe(401);
  });

  test('create order', async () => {
    // First create a franchise and store as admin
    const franchise = {
      name: 'Test Franchise ' + Math.random(),
      admins: [{ email: 'a@jwt.com' }]
    };
    
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(franchise);
    
    const store = { name: 'Test Store' };
    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseRes.body.id}/store`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(store);

    const order = {
      franchiseId: franchiseRes.body.id,
      storeId: storeRes.body.id,
      items: [{ menuId: 1, description: 'Veggie', price: 0.05 }]
    };
    
    const res = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(order);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
    expect(res.body.order).toHaveProperty('id');
  });

  test('create order without auth', async () => {
    const order = {
      franchiseId: 1,
      storeId: 1,
      items: [{ menuId: 1, description: 'Veggie', price: 0.05 }]
    };
    
    const res = await request(app)
      .post('/api/order')
      .send(order);
    
    expect(res.status).toBe(401);
  });
});
