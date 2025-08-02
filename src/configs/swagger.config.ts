import path from 'path';
import swaggerJsdoc, { Options } from 'swagger-jsdoc';
import dotenv from 'dotenv';

dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';

console.log({ isDevelopment });

const options: Options = {
  definition: {
    openapi: '3.1.1',
    info: {
      title: 'Blog App',
      description: 'Blog App API endpoints documented with Swagger',
      contact: {
        name: 'Sourav Mandal',
        email: 'sourav.mandal5282@gmail.com',
      },
      version: '1.0.0',
    },
    servers: [
      {
        url: 'https://ums-be.onrender.com/',
        description: 'Dev',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: [path.join(__dirname, `../routes/*.${isDevelopment ? 'ts' : 'js'}`)],
};

export const swaggerSpec = swaggerJsdoc(options);
