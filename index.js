const express = require("express");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const fs = require("fs");
const pdftopic = require("pdftopic");
const sharp = require("sharp");

const app = express();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

app.post("/api/upload", upload.single("uploadedImage"), async (req, res) => {
  console.log(req.file);

  try {
    // Check if the uploaded file is a PDF
    const isPDF = req.file.mimetype === "application/pdf";

    if (isPDF) {
      // Read the PDF file
      const pdfFilePath = `uploads/${req.file.filename}`;
      const pdf = fs.readFileSync(pdfFilePath);

      // Convert PDF to image
      const convertedResult = await pdftopic.pdftobuffer(pdf, "all");
      const pageResults = {};
      // Use map to iterate over each page and await inside Promise.all
      await Promise.all(
        convertedResult.map(async (file, index) => {
          // Perform OCR on the grayscale image
          const grayscaleImageBuffer = await sharp(file).grayscale().negate().toBuffer();
          console.log("Processing Page: %d", index);
          const {
            data: { text },
          } = await Tesseract.recognize(grayscaleImageBuffer, "eng", {
            logger: (m) => console.log(m),
          });

          pageResults[`page ${index + 1}`] = text;
        })
      );
      // Delete the PDF file and the generated image after processing
      fs.unlink(pdfFilePath, (err) => {
        if (err) {
          console.error("Error deleting PDF file:", err);
        } else {
          console.log("PDF file deleted successfully");
        }
      });

      // Send response with the extracted text
      return res.json({
        pageResults,
      });
    } else {
      // If it's an image, directly process it using Tesseract
      Tesseract.recognize("uploads/" + req.file.filename, "eng", {
        logger: (m) => console.log(m),
      }).then(({ data: { text } }) => {
        // Delete the image file after processing
        fs.unlink("uploads/" + req.file.filename, (err) => {
          if (err) {
            console.error("Error deleting file:", err);
          } else {
            console.log("File deleted successfully");
          }
        });

        // Send response with the extracted text
        return res.json({
          message: text,
        });
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error processing file",
    });
  }
});

app.listen(4000, () => {
  console.log("Server is up and running on port 4000");
});
