import axios from 'axios';
import { getAuthToken } from './auth';

// Create an Axios instance with default configuration
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((request) => {
    const token = getAuthToken();
    if (token) {
        request.headers.Authorization = `Bearer ${token}`;
    }
    return request;
});

// Add a response interceptor to handle errors globally if needed
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);
