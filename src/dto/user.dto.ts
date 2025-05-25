export class CreateUserDto {
  user_id?: string; // UUID, optional if generated on backend
  name!: string;
  phone?: string;
  type!: 'owner' | 'employee' | 'client' | 'sales';
  email!: string;
  created_by?: string; // UUID of the user creating this record
}

export class UpdateUserDto {
  name?: string;
  phone?: string;
  type?: 'owner' | 'employee' | 'client' | 'sales';
  email?: string;
  updated_by?: string; // UUID of the user updating this record
}
