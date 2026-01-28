import { DataSource } from 'typeorm';
import { User } from './src/model/users.model';
import { Store } from './src/model/store.model';
import { Branch } from './src/model/branches.model';
import { Product } from './src/model/product.model';
import { ProductBranch } from './src/model/product_branches.model';
import { Rating } from './src/model/rating.model';
import { Employee } from './src/model/employees.model';
import { EmployeeBranch } from './src/model/employee_branches.model';
import { CustomerProduct } from './src/model/customer_products.model';
import { Favorite } from './src/model/favorite.model';
import { UserAction } from './src/model/user-actions.model';
import { Payment } from './src/model/payment.model';
import { SubscriptionRequest } from './src/model/subscription_request.model';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'store2',
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
    UserAction,
    Payment,
    SubscriptionRequest,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
  uuidExtension: 'pgcrypto',
});