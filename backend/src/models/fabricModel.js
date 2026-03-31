import mongoose from "mongoose";

const { Schema } = mongoose;

const fabricColorSchema = new Schema(
  {
    colorName: {
      type: String,
      required: [true, "Color Name is required"],
      trim: true,
    },
    pantoneCode: {
      type: String,
      trim: true,
    },
    pantoneColorHex: {
      type: String,
      default: "#FDFD96",
    },
  },
  { _id: false }
);

const fabricSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    colorName: {
      type: String,
      required: [true, "Color Name is required"],
      trim: true,
    },
    pantoneCode: {
      type: String,
      trim: true,
    },
    pantoneColorHex: {
      type: String,
      default: "#FDFD96", // Defaulting to your Pastel Yellow hex
    },
    colors: {
      type: [fabricColorSchema],
      default: [{ colorName: "TBD", pantoneColorHex: "#FDFD96" }],
    },
    labDipApprovalDate: {
      type: Date,
    },
    iobApprovalDate: {
      type: Date,
    },
    bulkInhouseDate: {
      type: Date,
    },
    lotApprovalDate: {
      type: Date,
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Fabric = mongoose.model("Fabric", fabricSchema);

export default Fabric;
