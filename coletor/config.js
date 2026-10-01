export const BASE_URL = 'https://usiminas.gaussfleet.com';

// vêm dos segredos do repositório (Settings > Secrets and variables > Actions)
export const CREDENTIALS = {
  username: process.env.GAUSSFLEET_USERNAME,
  password: process.env.GAUSSFLEET_PASSWORD,
};
