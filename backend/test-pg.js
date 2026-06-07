const { Pool } = require('pg');
const connectionString = "postgresql://vega_user:vega_password@localhost:5432/vega_db?schema=public";
const pool = new Pool({ connectionString });
pool.query('SELECT NOW()').then(res => console.log(res.rows)).catch(err => console.error(err));
