import { Sequelize } from 'sequelize';
import 'dotenv/config';

// TiDB Cloud Serverless (and most managed MySQL providers) require TLS.
// Enable it whenever DB_SSL is truthy or when the host looks managed.
// Locally you can leave DB_SSL unset and point at a plain MySQL instance.
const needsSSL = process.env.DB_SSL === 'true'
  || process.env.NODE_ENV === 'production'
  || /\.(tidbcloud\.com|aivencloud\.com|aws|render\.com|railway\.app)$/.test(
    process.env.DB_HOST || ''
  );

const dialectOptions = needsSSL
  ? {
      ssl: {
        // minVersion + rejectUnauthorized cover TiDB Cloud Serverless out of
        // the box. The root CA is bundled in Node's defaults on both Render
        // and local dev — no cert file to manage.
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
    }
  : {};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

export { sequelize };
