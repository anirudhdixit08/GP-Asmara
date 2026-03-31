




import mongoose from "mongoose";

const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    styleNumber: {
      type: String,
      required: [true, "Style Number is required"],
      unique: true,
      trim: true,
      index: true,
    },
    buyerName: {
      type: String,
      required: [true, "Buyer Name is required"],
      trim: true,
    },
    orderQuantity: {
      type: Number,
      required: [true, "Order Quantity is required"],
    },
    shipmentDate: {
      type: Date,
      required: [true, "Shipment Date is required"],
    },
    previewPhoto: {
      url: { type: String },
      cloudinaryPublicId: { type: String },
    },
    fabricSketch: {
      url: { type: String },
      cloudinaryPublicId: { type: String },
    },
    season: {
      type: String,
      required: [true, "Season is required"],
    },

    merchant: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    factory: {
      type: String,
      required: [true, "A factory (organisation name) must be assigned to the order"],
      trim: true,
      index: true,
    },

    tna: {
      type: Schema.Types.ObjectId,
      ref: "TNA",
    },
    fabric: {
      type: Schema.Types.ObjectId,
      ref: "Fabric",
    },
    techpackDetails: {
      type: Schema.Types.ObjectId,
      ref: "TechpackIteration",
    },
    costing: {
      type: Schema.Types.ObjectId,
      ref: "Costing",
    },

    status: {
      type: String,
      enum: ["pending", "in-production", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
