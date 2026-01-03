# IpaidUpay Server

IpaidUpay Server is the backend REST API for the group buying application. It handles user authentication, group management, menu creation, order processing, and friend connections.

## Features

- **Authentication**: User registration and login with JWT.
- **Group Management**: Create, update, delete groups. Toggle group status (OPEN/CLOSED).
- **Menu System**: Define products and prices for each group.
- **Order System**: Real-time order aggregation, personal order tracking ("My Order"), and payment status tracking.
- **Friend System**: Search users and manage friend lists for easy invitations.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Containerization**: Docker

## Environment Setup (.env)

Create a `.env` file in the root directory with the following variables:

```env
# Server Port (Default: 3001)
PORT=3001

# Database Connection URL (PostgreSQL)
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgresql://postgres:password@localhost:5432/ipaidupay"

# JWT Secret for signing tokens
JWT_SECRET="your_super_secret_key"
```

## Running the Application

### Using Docker (Recommended)

Run the entire stack (Server + Database) using Docker Compose:

```bash
docker compose up -d
```

### Manual Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Setup**:
   Ensure you have a PostgreSQL database running. Update `DATABASE_URL` in `.env`.
   
   Run Prisma migrations:
   ```bash
   npx prisma migrate dev
   ```

3. **Start Server**:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## Development Commands

- `npx prisma generate`: Generate Prisma client.
- `npx prisma studio`: Open database GUI.
- `npx prisma migrate dev --name update_product_id`: Generate Prisma client with specific generator.
- `docker compose exec postgres psql -U postgres -d IpaidUpay`: Enter the PostgreSQL database.