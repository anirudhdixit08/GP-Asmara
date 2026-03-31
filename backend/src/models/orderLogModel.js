import mongoose from "mongoose";

const { Schema } = mongoose;

const ORDER_LOG_MODULES = ["ORDER", "TNA", "FABRIC", "TECHPACK", "COSTING", "COMMENT"];

const orderLogSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: ORDER_LOG_MODULES,
      required: true,
      index: true,
    },
    field: {
      type: String,
      required: true,
      trim: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    changedByName: {
      type: String,
      trim: true,
    },
    changedByOrganisation: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      required: true,
    },
  },
  { timestamps: true }
);

orderLogSchema.index({ orderId: 1, createdAt: -1 });

const OrderLog = mongoose.model("OrderLog", orderLogSchema);
export default OrderLog;
export { ORDER_LOG_MODULES };

