import { v2 as cloudinary } from "cloudinary";
import fs from "fs";


const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "raw",
      folder: "gp_asmara_portal", // Organizes files in your Cloudinary dashboard
      use_filename: true, // Helps browser recognize the file type
      unique_filename: true,
    });


    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return response;
  } catch (error) {
    console.error("Cloudinary Upload Error:", error.message);

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return null; // Return null so the controller can handle the failure
  }
};

export default uploadOnCloudinary;
