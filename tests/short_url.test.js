import request from 'supertest';
import app from '../app.js';
import mongoose from 'mongoose';

describe('URL Shortener API', () => {
  beforeAll(async () => {
    // If you need to setup DB connection for tests, handle it here.
    // Assuming app.js connects to DB automatically or use mocked models.
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should return 400 if url is invalid', async () => {
    const res = await request(app)
      .post('/api/create')
      .send({ url: 'not-a-valid-url' });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('errors');
  });

  // Note: For integration testing, ensure Redis and MongoDB are mocked or connected to a test DB.
  // it('should create a short url', async () => {
  //   const res = await request(app)
  //     .post('/api/create')
  //     .send({ url: 'https://example.com' });
  //   expect(res.statusCode).toEqual(200);
  //   expect(res.body).toHaveProperty('shortUrl');
  // });
});
