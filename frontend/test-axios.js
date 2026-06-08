const axios = require('axios');
const api1 = axios.create({ baseURL: 'https://vega-jobs.onrender.com/api' });
console.log(api1.getUri({ url: '/profile' }));
console.log(api1.getUri({ url: 'profile' }));
