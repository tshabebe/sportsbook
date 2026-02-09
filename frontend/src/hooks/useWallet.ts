import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getAuthToken } from '../lib/auth';

type WalletProfileResponse = {
  ok: boolean;
  data?: {
    userData?: {
      username?: string;
      balance?: number;
      realBalance?: number;
    };
    username?: string;
    balance?: number;
  };
};

export const useWalletProfile = () =>
  useQuery({
    queryKey: ['wallet', 'profile'],
    enabled: Boolean(getAuthToken()),
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await api.get<WalletProfileResponse>('/wallet/profile');
      const userData = data?.data?.userData;
      const rootData = data?.data;
      return {
        username: userData?.username ?? rootData?.username ?? 'Guest',
        balance: Number(userData?.realBalance ?? userData?.balance ?? rootData?.balance ?? 0),
      };
    },
  });
