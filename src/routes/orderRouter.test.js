const request = require('supertest');
const app = require('../service');

let testUser;
let testUserAuthToken;
let adminAuthToken;

beforeAll(async () => {
  // Wait for database to be ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const adminRes = await request(app).put('/api/auth').send({ email: 'a@jwt.com', password: 'admin' });
  adminAuthToken = adminRes.body.token;

  // Register a test user
  testUser = { name: 'pizza diner', email: Math.random().toString(36).substring(2, 12) + '@test.com', password: 'a' };
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;
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
