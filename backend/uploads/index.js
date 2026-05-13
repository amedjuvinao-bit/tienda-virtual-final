import multer from "multer";
import path from "path";
import express from "express";

const router = express.Router();

// Configuración de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // carpeta donde guardar imágenes
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Ruta para subir una sola imagen
router.post("/api/uploads", upload.single("image"), (req, res) => {
  res.json({ filename: req.file.filename });
});

// Ruta para subir múltiples imágenes
router.post("/api/uploads/many", upload.array("images", 5), (req, res) => {
  const filenames = req.files.map(file => file.filename);
  res.json({ filenames });
});

export default router;
