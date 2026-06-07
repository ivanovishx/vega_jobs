const { Pool } = require('pg');
const pool = new Pool({ connectionString: undefined });
pool.query('SELECT NOW()').then(res => console.log(res.rows)).catch(err => console.error(err));
