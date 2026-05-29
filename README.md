# Shaadi Invitation App

A simple wedding invitation RSVP tracker with Express, MongoDB, and admin management UI.

## Setup

### 1. Install MongoDB

**Option A: Local MongoDB (Windows)**
- Download from https://www.mongodb.com/try/download/community
- Run installer and follow setup (default: `mongodb://localhost:27017`)
- Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas

**Option B: MongoDB Atlas (Cloud)**
- Create free account at https://www.mongodb.com/cloud/atlas
- Create a cluster and get connection string
- Copy connection string in `.env`

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and set your values:

```bash
cp .env.example .env
```

Edit `.env`:
```
MONGODB_URI=mongodb://localhost:27017/shaadi-app
ADMIN_PASSWORD=your-secure-password
PORT=3000
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Server

**Windows PowerShell:**
```powershell
$env:MONGODB_URI='mongodb://localhost:27017/shaadi-app'
$env:ADMIN_PASSWORD='your-password'
npm start
```

**Or use .env file:**
```bash
# Install dotenv first
npm install dotenv

# Then modify server.js to load .env
# Add at top: require('dotenv').config();
```

**Linux/Mac:**
```bash
MONGODB_URI=mongodb://localhost:27017/shaadi-app ADMIN_PASSWORD=your-password npm start
```

## Usage

### Frontend (Guest RSVP)
- Visit: http://localhost:3000
- Fill RSVP form and submit

### Admin Panel
- Visit: http://localhost:3000/admin.html
- Enter admin password (from `.env`)
- Manage all RSVPs:
  - View all responses
  - Edit entries (name, attending, guests, message)
  - Delete entries
  - Clear all RSVPs

## API Endpoints

### Public
- `POST /rsvp` - Submit RSVP
  ```json
  {
    "name": "John Doe",
    "attending": true,
    "guests": 2,
    "message": "Looking forward!"
  }
  ```

### Admin Only (require `x-admin-password` header)
- `GET /rsvps` - List all RSVPs
- `PUT /rsvp/:id` - Update RSVP fields
- `DELETE /rsvp/:id` - Delete RSVP
- `POST /rsvps/clear` - Clear all RSVPs

## Database

RSVPs are saved in MongoDB with schema:
```javascript
{
  name: String (required),
  attending: Boolean (required),
  guests: Number (default: 0),
  message: String (default: ''),
  receivedAt: Date (default: now)
}
```

## Project Structure

```
shaadi-app/
├── server.js              # Express server + MongoDB setup
├── package.json           # Dependencies
├── .env.example          # Example env variables
├── .env                  # Your config (create from .env.example)
└── public/
    ├── index.html        # Guest invitation page
    ├── style.css         # Styling
    ├── script.js         # Frontend logic
    ├── admin.html        # Admin dashboard
    └── admin.js          # Admin client logic
```

## Troubleshooting

### MongoDB connection error
- Check MONGODB_URI is correct
- Ensure MongoDB is running locally or Atlas is accessible
- Check firewall/network access

### Admin auth fails
- Verify ADMIN_PASSWORD matches in server and .env
- Clear sessionStorage in browser (F12 → Application → Session Storage)

### RSVP not saving
- Check server logs for MongoDB errors
- Verify required fields: `name` and `attending`
