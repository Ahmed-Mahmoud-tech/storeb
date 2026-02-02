import { DataSource } from 'typeorm';
import { User } from './src/model/user.model';
import { Store } from './src/model/store.model';
import { Branch } from './src/model/branch.model';
import { Product } from './src/model/product.model';
import { ProductBranch } from './src/model/product_branch.model';
import { Rating } from './src/model/rating.model';
import { Employee } from './src/model/employee.model';
import { EmployeeBranch } from './src/model/employee_branch.model';
import { CustomerProduct } from './src/model/customer_product.model';
import { Favorite } from './src/model/favorite.model';
import { UserAction } from './src/model/user_action.model';
import { Payment } from './src/model/payment.model';
import { SubscriptionRequest } from './src/model/subscription_request.model';

require('dotenv').config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'store',
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
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  logging: true,
});