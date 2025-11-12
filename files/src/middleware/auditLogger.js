const { Pool } = require('pg');
const db = new Pool({ /* config from .env */ });

module.exports = {
  log: async (event, details, egnOrId) => {
    await db.query(
      'INSERT INTO audit_log (user_id, event, details) VALUES ($1, $2, $3)',
      [egnOrId || null, event, details]
    );
    return true;
  }
};