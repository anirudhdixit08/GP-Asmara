import mongoose from "mongoose";

const { Schema } = mongoose;

const techpackIterationSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    initialTPDate: {
      type: Date,
    },
    firstFitSubmissionDate: {
      type: Date,
    },
    secondFitSubmissionDate: {
      type: Date,
    },
    ppApprovalDate: {
      type: Date,
    },
    techpackFile: {
      url: { type: String },
      cloudinaryPublicId: { type: String },
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const TechpackIteration = mongoose.model(
  "TechpackIteration",
  techpackIterationSchema
);

export default TechpackIteration;
