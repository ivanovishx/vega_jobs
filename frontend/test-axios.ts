import axios from 'axios';
const api1 = axios.create({ baseURL: 'https://vega-jobs.onrender.com/api' });
console.log('baseURL: /api, get: /profile ->', api1.getUri({ url: '/profile' }));
console.log('baseURL: /api, get: profile ->', api1.getUri({ url: 'profile' }));

const api2 = axios.create({ baseURL: 'https://vega-jobs.onrender.com/api/' });
console.log('baseURL: /api/, get: /profile ->', api2.getUri({ url: '/profile' }));
console.log('baseURL: /api/, get: profile ->', api2.getUri({ url: 'profile' }));
