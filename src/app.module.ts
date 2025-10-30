import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controller/auth.controller';
import { GoogleStrategy } from './auth/google.strategy';
import { JwtStrategy } from './auth/jwt.strategy';
import { User } from './model/users.model';
import { UserService } from './services/user.service';
import { Store } from './model/store.model';
import { Branch } from './model/branches.model';
import { Product } from './model/product.model';
import { ProductBranch } from './model/product_branches.model';
import { Rating } from './model/rating.model';
import { Employee } from './model/employees.model';
import { EmployeeBranch } from './model/employee_branches.model';
import { FileUploadService } from './services/file-upload.service';
import { EmailService } from './services/email.service';
import { StoreController } from './controller/store.controller';
import { UserController } from './controller/user.controller';
import { StoreService } from './services/store.service';
import { ProductController } from './controller/product.controller';
import { ProductService } from './services/product.service';
import { RatingService } from './services/rating.service';
import { RatingController } from './controller/rating.controller';
import { EmployeeController } from './controller/employee.controller';
import { EmployeeService } from './services/employee.service';
import { CustomerProduct } from './model/customer_products.model';
import { CustomerProductService } from './services/customer_product.service';
import { CustomerProductController } from './controller/customer_product.controller';
import { Favorite } from './model/favorite.model';
import { FavoriteService } from './services/favorite.service';
import { FavoriteController } from './controller/favorite.controller';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env`,
      // envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';

        return {
          type: 'postgres',
          host: configService.get('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get('DB_USERNAME', 'postgres'),
          password: configService.get('DB_PASSWORD', 'password'),
          database: configService.get('DB_DATABASE', 'store2'),
          entities: [
            User,
            Store,
            Branch,
            Product,
            ProductBranch,
            Rating,
            Employee,
            EmployeeBranch,
            CustomerProduct,
            Favorite,
          ],
          synchronize: !isProduction, // Auto-create tables only in development
          logging: false, // Disable SQL logging completely
          maxQueryExecutionTime: 1000, // Log only slow queries (above 1000ms)
          uuidExtension: 'pgcrypto', // Use PostgreSQL 13+ native UUID
          ssl: isProduction, // Enable SSL in production
          extra: {
            connectionLimit: 10, // Connection pool size
            application_name: 'nest_app',
          },
        };
      },
      dataSourceFactory: async (options) => {
        const dataSource = await new DataSource(options).initialize();

        // Ensure UUID extension exists (fallback for older PostgreSQL)
        try {
          await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        } catch {
          console.log('UUID extension already exists or not needed');
        }

        return dataSource;
      },
    }),
    TypeOrmModule.forFeature([
      User,
      Store,
      Branch,
      Product,
      ProductBranch,
      Rating,
      Employee,
      EmployeeBranch,
      CustomerProduct,
      Favorite,
    ]),
    PassportModule.register({ defaultStrategy: 'google' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf((info) => {
              const timestamp =
                typeof info.timestamp === 'string' ? info.timestamp : '';
              const level = typeof info.level === 'string' ? info.level : '';
              const context =
                typeof info.context === 'string' ? info.context : '';
              let message = '';
              if (typeof info.message === 'string') {
                message = info.message;
              } else if (info.message !== undefined) {
                try {
                  message = JSON.stringify(info.message);
                } catch {
                  message = Object.prototype.toString.call(info.message);
                }
              }
              return `${timestamp} [${level}]${context ? ' [' + context + ']' : ''}: ${message}`;
            })
          ),
        }),
        new winston.transports.DailyRotateFile({
          dirname: 'logs/combined',
          filename: '%DATE%-combined.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'info',
        }),
        new winston.transports.DailyRotateFile({
          dirname: 'logs/error',
          filename: '%DATE%-error.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
        }),
      ],
    }),
  ],
  controllers: [
    AppController,
    AuthController,
    StoreController,
    UserController,
    ProductController,
    RatingController,
    EmployeeController,
    CustomerProductController,
    FavoriteController,
  ],
  providers: [
    AppService,
    GoogleStrategy,
    JwtStrategy,
    UserService,
    StoreService,
    ProductService,
    FileUploadService,
    EmailService,
    RatingService,
    EmployeeService,
    CustomerProductService,
    FavoriteService,
  ],
})
export class AppModule {}
