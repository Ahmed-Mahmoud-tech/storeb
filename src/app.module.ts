import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controller/auth.controller';
import { GoogleStrategy } from './auth/google.strategy';
import { User } from './model/users.model';
import { UserService } from './services/user.service';
import { Store } from './model/store.model';
import { Branch } from './model/branches.model';
import { Product } from './model/product.model';
import { ProductBranch } from './model/product_branches.model';
import { FileUploadService } from './services/file-upload.service';
import { StoreController } from './controller/store.controller';
import { StoreService } from './services/store.service';
import { ProductController } from './controller/product.controller';
import { ProductService } from './services/product.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
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
          password: configService.get('DB_PASSWORD', 'postgres'),
          database: configService.get('DB_DATABASE', 'nest_app'),
          entities: [User, Store, Branch, Product, ProductBranch],
          synchronize: !isProduction, // Auto-create tables in dev only
          logging: false, // Disable SQL logging completely
          maxQueryExecutionTime: 1000, // Log only slow queries (above 1000ms)
          uuidExtension: 'pgcrypto', // Use PostgreSQL 13+ native UUID
          ssl: isProduction ? { rejectUnauthorized: false } : false,
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
    TypeOrmModule.forFeature([User, Store, Branch, Product, ProductBranch]),
    PassportModule.register({ defaultStrategy: 'google' }),
  ],
  controllers: [
    AppController,
    AuthController,
    StoreController,
    ProductController,
  ],
  providers: [
    AppService,
    GoogleStrategy,
    UserService,
    StoreService,
    ProductService,
    FileUploadService,
  ],
})
export class AppModule {}
