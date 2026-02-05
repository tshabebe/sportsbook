import axios from 'axios';

// Create an Axios instance with default configuration
export const api = axios.create({
    baseURL: 'http://localhost:3001/api', // Reverted to localhost for browser forwarding compatibility
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a response interceptor to handle errors globally if needed
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);
