# Fileverse Storage

Fileverse Storage is a decentralized file storage service that handles secure file uploads through authorized UCANs (User Controlled Authorization Networks). It powers [dSheet](https://dsheets.new/), Fileverse Portal, and other Fileverse applications, enabling decentralized, secure, and privacy-preserving file storage on IPFS.

## 🚀 Features

- **Decentralized Storage**: Files are stored on IPFS using multiple providers (Pinata, Filebase, Web3.Storage)
- **UCAN Authentication**: Secure authentication using User Controlled Authorization Networks
- **Storage Quotas**: Built-in storage limit management and extension capabilities
- **Community Sharing**: Publish and discover files in the community marketplace
- **Background Processing**: Automatic cleanup of unpinned files and gate hashes
- **Multi-Provider Support**: Flexible IPFS storage with fallback providers
- **Real-time Monitoring**: Comprehensive logging and error reporting

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB database
- IPFS storage provider accounts (Pinata, Filebase, or Web3.Storage)
- Environment variables configured (see Configuration section)

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd fileverse-storage-v2
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the required configuration (see Configuration section)

4. **Build the project**
   ```bash
   npm run build
   ```

## ⚙️ Configuration

Create a `.env` file with the following variables:

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# IPFS Providers
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_key
FILEBASE_ACCESS_KEY=your_filebase_access_key
FILEBASE_SECRET_KEY=your_filebase_secret_key
WEB3_STORAGE_TOKEN=your_web3_storage_token

# Server
PORT=3000
NODE_ENV=development

# Blockchain
DEFAULT_CHAIN_ID=1
```

## 🚀 Usage

### Development

```bash
# Start development server with hot reload
npm run dev

# Start background job for unpinning gate hashes
npm run dev:unpin-gate-cron

# Start background job for unpinning deleted files
npm run dev:unpin-deleted-file-cron
```

### Production

```bash
# Build and start production server
npm run build
npm start

# Start background jobs
npm run start:unpin-gate-cron
npm run start:unpin-deleted-file-cron
```

### Health Check

```bash
curl http://localhost:3000/ping
# Response: {"reply":"pong"}
```

## 📚 API Documentation

### Authentication

All authenticated endpoints require UCAN tokens in headers:

- `authorization`: Bearer token
- `contract`: Contract address
- `invoker`: Invoker address
- `chain`: Chain ID

### File Upload

#### Authenticated Upload

```http
POST /upload/
Content-Type: multipart/form-data
Authorization: Bearer <ucan_token>
Contract: <contract_address>
Invoker: <invoker_address>
Chain: <chain_id>

file: <file_data>
appFileId: <optional_app_file_id>
sourceApp: <optional_source_app>
ipfsType: <optional_ipfs_type>
tags: <optional_tags_array>
```

#### Public Upload

```http
POST /upload/public
Content-Type: multipart/form-data

file: <file_data>
```

#### Comment Upload

```http
POST /upload/comment
Content-Type: multipart/form-data

file: <file_data>
```

### Storage Management

#### Check Storage Status

```http
GET /limit/check
Contract: <contract_address>
Invoker: <invoker_address>
Chain: <chain_id>
```

#### Get Storage Usage

```http
GET /limit/use
Contract: <contract_address>
Invoker: <invoker_address>
Chain: <chain_id>
```

#### Extend Storage

```http
PUT /limit/extend
Contract: <contract_address>
Invoker: <invoker_address>
Chain: <chain_id>
```

### Community Files

#### Publish File

```http
POST /community/publish
Content-Type: application/json

{
  "publishedBy": "address",
  "thumbnailIPFSHash": "hash",
  "title": "file_title",
  "category": "category",
  "fileLink": "ipfs_link",
  "dsheetId": "sheet_id",
  "userHash": "user_hash",
  "portalAddress": "portal_address"
}
```

#### List Community Files

```http
GET /community/list?page=1&limit=10&category=docs&search=keyword&onlyFavorites=false&publishedBy=address
```

#### Get Community File

```http
GET /community/:dsheetId
Contract: <contract_address>
```

#### Toggle Favorite

```http
POST /community/favourite
Content-Type: application/json

{
  "dsheetId": "sheet_id",
  "isFavourite": true
}
```

### File Management

#### Delete File

```http
DELETE /file/:appFileId
Contract: <contract_address>
```

### User Management

#### Get User Address

```http
POST /users/address
```

## 🏗️ Project Structure

```
src/
├── app.ts                 # Express app configuration
├── index.ts              # Application entry point
├── config/               # Configuration management
├── domain/               # Business logic
│   ├── communityFiles/   # Community file operations
│   ├── contract/         # Blockchain contract interactions
│   ├── file/             # File operations
│   ├── ipfs/             # IPFS storage providers
│   ├── limit/            # Storage quota management
│   └── upload.ts         # File upload logic
├── infra/                # Infrastructure layer
│   ├── database/         # Database models and connection
│   └── ucan.ts           # UCAN token verification
├── interface/            # API routes and middleware
│   ├── agenda/           # Background job scheduling
│   ├── middleware/       # Express middleware
│   └── [routes]/         # API endpoint handlers
└── types/                # TypeScript type definitions
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run clean` - Remove build directory
- `npm run dev:unpin-gate-cron` - Start gate unpinning job (dev)
- `npm run dev:unpin-deleted-file-cron` - Start deleted file unpinning job (dev)

### Code Style

The project uses TypeScript with strict type checking. Follow these guidelines:

- Use meaningful variable and function names
- Add proper type annotations
- Handle errors appropriately
- Write comprehensive tests for new features
- Follow the existing folder structure

### Database Models

- **File**: Stores file metadata and IPFS hashes
- **CommunityFiles**: Manages community-shared files
- **Limit**: Tracks storage quotas and usage

## 🔍 Monitoring & Logging

The application includes comprehensive logging using Bunyan and error reporting. Logs are structured and include:

- Request/response logging via Morgan
- Application-level logging via Bunyan
- Error tracking and reporting
- Performance monitoring

## 🚀 Deployment

The application is configured for deployment on platforms like Heroku:

1. **Procfile** is included for process management
2. **Build process** is automated via npm scripts
3. **Environment variables** should be configured in your deployment platform
4. **Background jobs** should be deployed as separate processes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -am 'Add some feature'`
5. Push to the branch: `git push origin feature/your-feature`
6. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions, please refer to the Fileverse documentation or create an issue in this repository.

---

**Made with ❤️ by the Fileverse team**
