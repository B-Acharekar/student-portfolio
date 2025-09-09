import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_IP = process.env.PUBLIC_IP || "localhost";
// Configure S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;

// Multer: store file temporarily on disk
const upload = multer({ dest: "uploads/" });

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileContent = fs.readFileSync(req.file.path);

    const params = {
      Bucket: BUCKET,
      Key: Date.now() + "-" + req.file.originalname,
      Body: fileContent,
    };

    const command = new PutObjectCommand(params);
    await s3.send(command);

    const fileUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;

    // Save metadata
    const projectsFile = path.join(process.cwd(), "projects.json");
    const projects = fs.existsSync(projectsFile)
      ? JSON.parse(fs.readFileSync(projectsFile))
      : [];

    const project = {
      id: Date.now(),
      title: req.body.title,
      description: req.body.description,
      url: fileUrl,
    };

    projects.push(project);
    fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));

    res.send(`Project "${project.title}" uploaded successfully!`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed.");
  } finally {
    // Cleanup temp file
    fs.unlinkSync(req.file.path);
  }
});

// Fetch all projects
app.get("/projects", (req, res) => {
  const projectsFile = path.join(process.cwd(), "projects.json");

  if (!fs.existsSync(projectsFile)) {
    return res.json([]); // empty if no file yet
  }

  const projects = JSON.parse(fs.readFileSync(projectsFile));
  res.json(projects);
});

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "src")));

app.listen(PORT, () => {
  console.log(`Server running at http://${PUBLIC_IP}:${PORT}`);
});
