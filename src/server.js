import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db/db.js';
import routes from './routes/index.js';
import path from 'path';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// const HARDCODED_EMAIL = "misha1@gmail.com";
// const HARDCODED_PASSWORD = "Mish@123";
// app.post("/login", (req, res) => {
//   console.log("Body received:", req.body);

//   const { email, password } = req.body || {}; // safe destructure

//   if (!email || !password) {
//     return res.status(400).json({ message: "Request body missing!" });
//   }

//   if (email === HARDCODED_EMAIL && password === HARDCODED_PASSWORD) {
//     return res.json({ success: true, message: "Login successful!" });
//   } else {
//     return res.status(401).json({ success: false, message: "Invalid credentials" });
//   }
// });


app.use(morgan('dev'));

// Serve static files from src/uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// Routes
app.use('/api', routes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: 'File upload error', error: err.message });
  }
  console.error('Server error:', err, err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));