# MERN Admin‑Only Team Attendance App

A minimal, secure attendance management web app accessible **only to Admin**, built with **MongoDB, Express, React, and Node**.

## Features
- Admin login (JWT in httpOnly cookie)
- Manage team (add/edit/delete employees)
- Mark attendance (Present/Absent/Leave/WFH) with optional check‑in/out & notes
- Filter & view attendance by date range and employee
- Simple summaries (present/absent counts)

## Local Setup

### 1) Backend
```bash
cd server
cp .env.example .env
npm i
npm run seed:admin     # creates admin@example.com / Admin@123
npm run dev            # http://localhost:4000
```

### 2) Frontend
```bash
cd ../client
npm i
npm run dev            # http://localhost:5173
```

### 3) Login
Open http://localhost:5173 and use the seeded admin credentials:
- Email: `admin@example.com`
- Password: `Admin@123`

## Notes
- Update `.env` values for production and set `CLIENT_URL` to your real frontend origin.
- Use HTTPS in production so cookies can be `secure: true`.
- Rotate `JWT_SECRET` periodically.
- Add CSV/PDF export or reports as needed.
