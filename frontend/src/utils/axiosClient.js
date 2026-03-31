import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,   // send cookies for auth
  timeout: 20000,
});

axiosClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers && config.headers['Content-Type']) {
      delete config.headers['Content-Type'];
    }
    return config;
  }

  config.headers = config.headers || {};
  if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
}, (error) => Promise.reject(error));

axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    
    console.error('Axios response error:', err?.response?.status, err?.response?.data);
    
    return Promise.reject(err);
  }
);

export default axiosClient;
