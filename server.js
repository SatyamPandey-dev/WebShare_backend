import express from "express";
import multer from "multer";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Multer for temporary storage
const upload = multer({ storage: multer.memoryStorage() }); // <-- add this

// Upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      console.log("No file received");
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log("Received file:", file.originalname);

    const expirySeconds = parseInt(req.body.expiry) || 3600;

    // sanitize file name
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = `${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw uploadError;
    }

    // Instead of sending signed URL directly, send sharable app link
    res.json({
      shareUrl: `https://web-share-client.vercel.app/${filePath}`, // React site route
      fileId: filePath,
      expiresIn: expirySeconds,
    });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/file/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const expirySeconds = parseInt(req.query.expiry) || 3600;

    const { data, error } = await supabase.storage
      .from("uploads")
      .createSignedUrl(id, expirySeconds);

    if (error) throw error;

    res.json({ url: data.signedUrl });
  } catch (err) {
    console.error("Error fetching file:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
