interface ICodeRecord {
  number: number;
  code: string;
  message: string;
  toString(): string;
}

const createCodeRecord = (
  number: number,
  code: string,
  message: string
): ICodeRecord => ({
  number,
  code,
  message,
  toString: () => `${number}_${code}: ${message}`,
});

const registerCodeRecord = (record: ICodeRecord): void => {
  const records =
    record.number.toString().startsWith('4') ||
    record.code.toString().startsWith('ERROR_')
      ? CODE_RECORDS.ERROR
      : CODE_RECORDS.SUCCESS;
  // trim ERROR_ or SUCCESS_ from code
  const code = record.code.replace(/^(ERROR_|SUCCESS_)/, '');
  records[code] = record;
};

const CODE_RECORDS = {
  SUCCESS: {
    OPERATION_SUCCESS: createCodeRecord(
      20000,
      'SUCCESS_OPERATION',
      'Operation successful'
    ),
    USER_CREATED: createCodeRecord(
      20001,
      'SUCCESS_USER_CREATED',
      'User created'
    ),
    USER_UPDATED: createCodeRecord(
      20002,
      'SUCCESS_USER_UPDATED',
      'User updated'
    ),
    USER_DELETED: createCodeRecord(
      20003,
      'SUCCESS_USER_DELETED',
      'User deleted'
    ),
    ENTRY_CREATED: createCodeRecord(
      20004,
      'SUCCESS_ENTRY_CREATED',
      'Entry created'
    ),
    ENTRY_UPDATED: createCodeRecord(
      20005,
      'SUCCESS_ENTRY_UPDATED',
      'Entry updated'
    ),
    ENTRY_DELETED: createCodeRecord(
      20006,
      'SUCCESS_ENTRY_DELETED',
      'Entry deleted'
    ),
    PASSWORD_RESET: createCodeRecord(
      20007,
      'SUCCESS_PASSWORD_RESET',
      'Password reset'
    ),
    PASSWORD_CHANGED: createCodeRecord(
      20008,
      'SUCCESS_PASSWORD_CHANGED',
      'Password changed'
    ),
    TOKEN_VALID: createCodeRecord(20009, 'SUCCESS_TOKEN_VALID', 'Token valid'),
  },
  ERROR: {
    RESULT_NOT_FOUND: createCodeRecord(
      40000,
      'ERROR_RESULT_NOT_FOUND',
      'Result not found'
    ),
    CONNECTION_FAILED: createCodeRecord(
      40001,
      'ERROR_CONNECTION_FAILED',
      'Connection failed'
    ),
    AUTHENTICATION_FAILED: createCodeRecord(
      40002,
      'ERROR_AUTHENTICATION',
      'Authentication failed'
    ),
    AUTHORIZATION_FAILED: createCodeRecord(
      40003,
      'ERROR_AUTHORIZATION',
      'Authorization failed'
    ),
    USER_NOT_FOUND: createCodeRecord(
      40004,
      'ERROR_NOT_FOUND',
      'User not found'
    ),
    NOT_FOUND: createCodeRecord(40005, 'ERROR_NOT_FOUND', 'Not found'),
    INVALID_CREDENTIALS: createCodeRecord(
      40006,
      'ERROR_INVALID_CREDENTIALS',
      'Invalid credentials'
    ),
    SIGNUP_FAILED: createCodeRecord(40007, 'ERROR_SIGNUP', 'Signup failed'),
    PASSWORD_RESET_FAILED: createCodeRecord(
      40008,
      'ERROR_PASSWORD_RESET',
      'Password reset failed'
    ),
    PASSWORD_CHANGE_FAILED: createCodeRecord(
      40009,
      'ERROR_PASSWORD_CHANGE',
      'Password change failed'
    ),
    INVALID_REQUEST: createCodeRecord(
      40010,
      'ERROR_INVALID_REQUEST',
      'Invalid request'
    ),
    INVALID_TOKEN: createCodeRecord(
      40011,
      'ERROR_INVALID_TOKEN',
      'Invalid token'
    ),
    INVALID_PASSWORD: createCodeRecord(
      40012,
      'ERROR_INVALID_PASSWORD',
      'Invalid password'
    ),
    INVALID_EMAIL: createCodeRecord(
      40013,
      'ERROR_INVALID_EMAIL',
      'Invalid email'
    ),
    INVALID_ROLE: createCodeRecord(40014, 'ERROR_INVALID_ROLE', 'Invalid role'),
    INVALID_TENANT: createCodeRecord(
      40015,
      'ERROR_INVALID_TENANT',
      'Invalid tenant'
    ),
    INVALID_ID: createCodeRecord(40016, 'ERROR_INVALID_ID', 'Invalid ID'),
    EMAIL_DUPLICATE: createCodeRecord(
      40017,
      'ERROR_EMAIL_DUPLICATE',
      'Email already exists'
    ),
    EMAIL_NOT_FOUND: createCodeRecord(
      40018,
      'ERROR_EMAIL_NOT_FOUND',
      'Email not found'
    ),
  },
};

export default function getCodeRecord(
  codeOrNumber: string | number
): ICodeRecord {
  // if number and start with 4, then fail, other wise success
  // if string and start with 'ERROR_', then fail, other wise success
  const codeGroup =
    codeOrNumber.toString().startsWith('4') ||
    codeOrNumber.toString().startsWith('ERROR_')
      ? CODE_RECORDS.ERROR
      : CODE_RECORDS.SUCCESS;
  for (const key in codeGroup) {
    const record = codeGroup[key] as ICodeRecord | undefined;
    if (
      record &&
      typeof record === 'object' &&
      'number' in record &&
      'code' in record &&
      (record.number === codeOrNumber || record.code === codeOrNumber)
    ) {
      return record;
    }
  }
  throw new Error();
}

function extendRecord(
  codeOrName: string | number | ICodeRecord,
  data?: { [key: string]: any }
): ICodeRecord & { [key: string]: any } {
  const record =
    typeof codeOrName !== 'object' ? getCodeRecord(codeOrName) : codeOrName;
  return { ...record, data };
}

export {
  CODE_RECORDS,
  ICodeRecord,
  createCodeRecord,
  getCodeRecord,
  registerCodeRecord,
  extendRecord,
};
