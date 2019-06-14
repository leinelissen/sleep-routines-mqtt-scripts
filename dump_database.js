// USAGE: node dump_database.js > dump.json
require('dotenv').config();
const nano = require('nano')(process.env.COUCHDB_URL);
const db = nano.db.use(process.env.COUCHDB_DB);

db.list({ include_docs: true })
    .then(obj => JSON.stringify(obj, null, 4))
    .then(console.log);