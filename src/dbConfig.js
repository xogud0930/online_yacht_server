const mySql = require('mysql2/promise');

const dbConfig = {
    host: 'us-cdbr-east-04.cleardb.com',
    port: 3306,
    user: 'ba12ab2217c415',
    password: 'b0796cc830d68f5',
    database: 'heroku_0006198e6ca26bf',
    connectionLimit: 10,
};

const db = mySql.createPool(dbConfig);

module.exports = db