import { config } from './config';
import { HttpError } from '../lib/http';

type WalletTransactionType = 'debit' | 'credit';

type WalletTransactionPayload = {
  user_id?: number;
  chatId?: number;
  username?: string;
  amount: number;
  game?: string;
  round_id: string;
  transaction_id: string;
  debit_transaction_id?: string;
  transaction_type?: WalletTransactionType;
};

export class WalletClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.walletUrl;
    this.apiKey = config.walletPassKey;
    if (!this.baseUrl || !this.apiKey) {
      console.warn('⚠️ Wallet configuration missing (WALLET_URL/PASS_KEY)');
    }
  }

  private getHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Pass-Key': this.apiKey,
    };
  }

  private assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new HttpError(
        503,
        'WALLET_UNAVAILABLE',
        'Wallet integration is not configured',
      );
    }
  }

  async getProfile(token: string) {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/wallet/profile`, {
      headers: this.getHeaders(token),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch profile: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  private async processTransaction(
    token: string,
    transactionType: WalletTransactionType,
    data: WalletTransactionPayload,
  ) {
    this.assertConfigured();
    const payload: WalletTransactionPayload = {
      user_id: data.user_id || data.chatId,
      username: data.username,
      transaction_type: transactionType,
      amount: data.amount,
      game: data.game || config.walletGameName,
      round_id: data.round_id,
      transaction_id: data.transaction_id,
    };

    if (transactionType === 'credit' && data.debit_transaction_id) {
      payload.debit_transaction_id = data.debit_transaction_id;
    }

    const response = await fetch(`${this.baseUrl}/api/wallet/crash`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} failed: ${errorText}`,
      );
    }

    return response.json();
  }

  async debit(token: string, data: WalletTransactionPayload) {
    return this.processTransaction(token, 'debit', data);
  }

  async credit(token: string, data: WalletTransactionPayload) {
    return this.processTransaction(token, 'credit', data);
  }
}

export const walletClient = new WalletClient();
export type { WalletTransactionPayload };
