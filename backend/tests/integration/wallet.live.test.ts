import path from 'path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRun =
  process.env.RUN_LIVE_TESTS === '1' &&
  Boolean(process.env.WALLET_URL) &&
  Boolean(process.env.PASS_KEY) &&
  Boolean(process.env.TEST_TOKEN);

describe('wallet live integration', () => {
  it.runIf(shouldRun)('gets wallet profile', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app)
      .get('/api/wallet/profile')
      .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`);
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it.runIf(shouldRun)('debits and credits wallet', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const profileResponse = await request(app)
      .get('/api/wallet/profile')
      .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`);
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.ok).toBe(true);

    const userData = profileResponse.body.data?.userData || profileResponse.body.data;
    const userId = userData?.chatId || userData?.user_id || userData?.id;
    const username = userData?.username || userData?.userName || 'test_user';

    const roundId = `test_round_${Date.now()}`;
    const debitTx = `DEBIT_aviator_${Date.now()}`;

    const debitResponse = await request(app)
      .post('/api/wallet/debit')
      .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
      .send({
        chatId: userId,
        username,
        amount: 2,
        game: 'Aviator',
        round_id: roundId,
        transaction_id: debitTx,
      });
    expect(debitResponse.status).toBe(200);
    expect(debitResponse.body.ok).toBe(true);

    const creditResponse = await request(app)
      .post('/api/wallet/credit')
      .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
      .send({
        chatId: userId,
        username,
        amount: 2,
        game: 'Aviator',
        round_id: roundId,
        transaction_id: `CREDIT_aviator_${Date.now()}`,
        debit_transaction_id: debitTx,
      });
    expect(creditResponse.status).toBe(200);
    expect(creditResponse.body.ok).toBe(true);
  });
});
