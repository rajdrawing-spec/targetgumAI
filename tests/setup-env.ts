import { config } from 'dotenv'
import path from 'path'

// Loads .env.local for local test runs against a local Postgres instance.
// No-ops harmlessly in CI, where DATABASE_URL etc. are already set as real
// environment variables (.github/workflows/ci.yml) and no .env.local exists.
config({ path: path.resolve(__dirname, '../.env.local') })
