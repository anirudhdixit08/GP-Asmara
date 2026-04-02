import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import TNA from "../models/tnaModel.js";
import Fabric from "../models/fabricModel.js";
import TechpackIteration from "../models/techpackModel.js";
import Costing from "../models/costingModel.js";
import Notification, { NOTIFICATION_TYPES } from "../models/notificationModel.js";
import OrderLog from "../models/orderLogModel.js";
import uploadOnCloudinary from "../utils/cloudinaryUploader.js";
import { mailSender } from "../utils/mailSender.js";
import { orderBelongsToFactoryUser } from "../utils/orderFactoryAccess.js";

function normalizeLogValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value ?? null;
}

function isSameLogValue(a, b) {
  return JSON.stringify(normalizeLogValue(a)) === JSON.stringify(normalizeLogValue(b));
}

function userDisplayName(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || user?.emailId || "Unknown user";
}

async function createFieldChangeLogs({
  orderId,
  module,
  fields,
  beforeDoc,
  afterDoc,
  user,
}) {
  const before = beforeDoc?.toObject ? beforeDoc.toObject() : beforeDoc || {};
  const after = afterDoc?.toObject ? afterDoc.toObject() : afterDoc || {};

  const logs = [];
  for (const field of fields) {
    const oldValue = normalizeLogValue(before[field]);
    const newValue = normalizeLogValue(after[field]);
    if (isSameLogValue(oldValue, newValue)) continue;

    logs.push({
      orderId,
      module,
      field,
      oldValue,
      newValue,
      changedBy: user._id,
      changedByName: userDisplayName(user),
      changedByOrganisation: user.organisationName || "",
      message: `${userDisplayName(user)} from ${user.organisationName || "Unknown organisation"} edited ${module}.${field}.`,
    });
  }

  if (logs.length > 0) {
    await OrderLog.insertMany(logs);
  }
}

function buildOrderCreatedEmail(order, creatorName) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">New order created</h2>
      <p style="margin: 0 0 12px 0;">
        ${creatorName} created a new order in Factrix.
      </p>
      <ul style="margin: 0 0 12px 18px; padding: 0;">
        <li><strong>Style Number:</strong> ${order.styleNumber}</li>
        <li><strong>Buyer:</strong> ${order.buyerName}</li>
        <li><strong>Quantity:</strong> ${order.orderQuantity}</li>
        <li><strong>Season:</strong> ${order.season || "—"}</li>
        <li><strong>Shipment Date:</strong> ${order.shipmentDate ? new Date(order.shipmentDate).toLocaleDateString() : "—"}</li>
        <li><strong>Factory:</strong> ${order.factory}</li>
      </ul>
      <p style="margin: 0;">Please check the portal for details and next actions.</p>
    </div>
  `;
}

export const createOrder = async (req, res) => {
  try {
    const {
      styleNumber,
      buyerName,
      orderQuantity,
      shipmentDate,
      season,
      factoryOrganisationName,
    } = req.body;

    if (
      !styleNumber ||
      !buyerName ||
      !orderQuantity ||
      !shipmentDate ||
      !factoryOrganisationName
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields to start the workflow.",
      });
    }

    const name = factoryOrganisationName.trim();
    const factoryUser = await User.findOne({
      role: "factory",
      organisationName: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      isActive: true,
    });
    if (!factoryUser) {
      return res.status(400).json({
        success: false,
        message: "No active factory found with this organisation name.",
      });
    }
    const factoryName = factoryUser.organisationName || name;

    if (!req.files || !req.files.techpack) {
      return res.status(400).json({
        success: false,
        message: "A Techpack (PDF/ZIP) is mandatory for new orders.",
      });
    }

    const techpackUpload = await uploadOnCloudinary(req.files.techpack[0].path);
    if (!techpackUpload) {
      return res
        .status(500)
        .json({ success: false, message: "Techpack upload failed." });
    }

    let previewPhotoData = {};
    if (req.files.previewPhoto) {
      const photoUpload = await uploadOnCloudinary(
        req.files.previewPhoto[0].path
      );
      if (photoUpload) {
        previewPhotoData = {
          url: photoUpload.secure_url,
          cloudinaryPublicId: photoUpload.public_id,
        };
      }
    }

    const newOrder = new Order({
      styleNumber,
      buyerName,
      orderQuantity,
      shipmentDate,
      season,
      previewPhoto: previewPhotoData, // Assigned to the main Order model
      merchant: req.result._id,
      factory: factoryName,
    });

    const [tna, fabric, techpackDoc, costing] = await Promise.all([
      TNA.create({ orderId: newOrder._id }),
      Fabric.create({
        orderId: newOrder._id,
        colorName: "TBD",
        pantoneColorHex: "#FDFD96",
        colors: [{ colorName: "TBD", pantoneColorHex: "#FDFD96" }],
      }),
      TechpackIteration.create({
        orderId: newOrder._id,
        techpackFile: {
          url: techpackUpload.secure_url,
          cloudinaryPublicId: techpackUpload.public_id,
        },
      }),
      Costing.create({ orderId: newOrder._id }),
    ]);

    newOrder.tna = tna._id;
    newOrder.fabric = fabric._id;
    newOrder.techpackDetails = techpackDoc._id;
    newOrder.costing = costing._id;

    await newOrder.save();

    await OrderLog.create({
      orderId: newOrder._id,
      module: "ORDER",
      field: "create",
      oldValue: null,
      newValue: {
        styleNumber: newOrder.styleNumber,
        buyerName: newOrder.buyerName,
        season: newOrder.season,
        factory: newOrder.factory,
      },
      changedBy: req.result._id,
      changedByName: userDisplayName(req.result),
      changedByOrganisation: req.result.organisationName || "",
      message: `${userDisplayName(req.result)} from ${req.result.organisationName || "Unknown organisation"} created order ${newOrder.styleNumber}.`,
    });

    try {
      const factoryMembers = await User.find({
        role: "factory",
        organisationName: new RegExp(`^${String(factoryName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        isActive: true,
      })
        .select("emailId")
        .lean();

      const recipients = new Set(
        factoryMembers
          .map((u) => String(u.emailId || "").trim().toLowerCase())
          .filter(Boolean)
      );
      if (req.result?.emailId) {
        recipients.add(String(req.result.emailId).trim().toLowerCase());
      }

      const subject = `New order created: ${newOrder.styleNumber}`;
      const emailBody = buildOrderCreatedEmail(newOrder, userDisplayName(req.result));
      const emailResults = await Promise.allSettled(
        [...recipients].map((email) => mailSender(email, subject, emailBody))
      );
      const failed = emailResults.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        console.error(
          `Order created email partially failed (${failed.length}/${emailResults.length}).`,
          failed.map((f) => f.reason?.message || String(f.reason))
        );
      }
    } catch (emailErr) {
      console.error("Order created email notification failed:", emailErr?.message || emailErr);
    }

    res.status(201).json({
      success: true,
      message: "Style Order created successfully!",
      order: newOrder,
    });
  } catch (error) {
    console.error("Order Creation Error:", error);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Style Number already exists." });
    }
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};

export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required." });
    }

    const order = await Order.findById(orderId)
      .populate("tna")
      .populate("fabric")
      .populate("techpackDetails")
      .populate("costing")
      .populate("merchant", "firstName lastName emailId organisationName");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const user = req.result;
    if (user.role === "factory" && !orderBelongsToFactoryUser(order, user)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this order.",
      });
    }

    const data = order.toObject ? order.toObject() : { ...order };

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Fetch Order Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};

export const updateTna = async (req, res) => {
  try {
    if (req.result.role !== "asmara") {
      return res.status(403).json({ success: false, message: "Only Asmara can edit TNA." });
    }
    const { tnaId } = req.params;
    let tnaUpdateData = { ...req.body };

    const existingTna = await TNA.findById(tnaId);
    if (!existingTna) {
      return res
        .status(404)
        .json({ success: false, message: "TNA not found." });
    }

    if (req.file) {
      const sketchUpload = await uploadOnCloudinary(req.file.path);
      if (sketchUpload) {
        await Order.findByIdAndUpdate(existingTna.orderId, {
          $set: {
            fabricSketch: {
              url: sketchUpload.secure_url,
              cloudinaryPublicId: sketchUpload.public_id,
            },
          },
        });
      }
    }

    const updatedTna = await TNA.findByIdAndUpdate(
      tnaId,
      {
        $set: tnaUpdateData,
        lastUpdatedBy: req.result._id,
      },
      { new: true, runValidators: true }
    );

    await createFieldChangeLogs({
      orderId: existingTna.orderId,
      module: "TNA",
      fields: [
        "greigeCommit",
        "colorCommit",
        "ppApproval",
        "cutDate",
        "gacDate",
        "tnaClosedWithBuyer",
      ],
      beforeDoc: existingTna,
      afterDoc: updatedTna,
      user: req.result,
    });

    res.status(200).json({
      success: true,
      message: "TNA milestones and Order sketch updated successfully!",
      data: updatedTna,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFabric = async (req, res) => {
  try {
    if (req.result.role !== "asmara") {
      return res.status(403).json({ success: false, message: "Only Asmara can edit Fabric." });
    }
    const { fabricId } = req.params;
    let fabricUpdateData = { ...req.body };

    if (typeof req.body.colors === "string") {
      try {
        const parsed = JSON.parse(req.body.colors);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((c) => ({
              colorName: String(c?.colorName || "").trim(),
              pantoneCode: c?.pantoneCode ? String(c.pantoneCode).trim() : undefined,
              pantoneColorHex: c?.pantoneColorHex ? String(c.pantoneColorHex).trim() : undefined,
            }))
            .filter((c) => c.colorName);

          if (normalized.length > 0) {
            fabricUpdateData.colors = normalized;
            fabricUpdateData.colorName = normalized[0].colorName;
            fabricUpdateData.pantoneCode = normalized[0].pantoneCode;
            fabricUpdateData.pantoneColorHex = normalized[0].pantoneColorHex;
          }
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid colors payload.",
        });
      }
    }

    const existingFabric = await Fabric.findById(fabricId);
    if (!existingFabric) {
      return res
        .status(404)
        .json({ success: false, message: "Fabric not found." });
    }

    if (req.file) {
      const sketchUpload = await uploadOnCloudinary(req.file.path);
      if (sketchUpload) {
        await Order.findByIdAndUpdate(existingFabric.orderId, {
          $set: {
            fabricSketch: {
              url: sketchUpload.secure_url,
              cloudinaryPublicId: sketchUpload.public_id,
            },
          },
        });
      }
    }

    const updatedFabric = await Fabric.findByIdAndUpdate(
      fabricId,
      {
        $set: fabricUpdateData,
        lastUpdatedBy: req.result._id,
      },
      { new: true, runValidators: true }
    );

    await createFieldChangeLogs({
      orderId: existingFabric.orderId,
      module: "FABRIC",
      fields: [
        "colors",
        "colorName",
        "pantoneCode",
        "pantoneColorHex",
        "fabricComposition",
        "labDipApprovalDate",
        "iobApprovalDate",
        "bulkInhouseDate",
        "lotApprovalDate",
      ],
      beforeDoc: existingFabric,
      afterDoc: updatedFabric,
      user: req.result,
    });

    res.status(200).json({
      success: true,
      message: "Fabric details and Order sketch updated successfully!",
      data: updatedFabric,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTechpack = async (req, res) => {
  try {
    if (req.result.role !== "asmara") {
      return res.status(403).json({ success: false, message: "Only Asmara can edit Tech Pack." });
    }
    const { techpackId } = req.params;
    let techpackUpdateData = { ...req.body };

    const existingTechpack = await TechpackIteration.findById(techpackId);
    if (!existingTechpack) {
      return res
        .status(404)
        .json({ success: false, message: "Techpack not found." });
    }

    if (req.files) {
      if (req.files.techpackFile) {
        const fileUpload = await uploadOnCloudinary(
          req.files.techpackFile[0].path
        );
        techpackUpdateData.techpackFile = {
          url: fileUpload.secure_url,
          cloudinaryPublicId: fileUpload.public_id,
        };
      }

      if (req.files.fabricSketch) {
        const sketchUpload = await uploadOnCloudinary(
          req.files.fabricSketch[0].path
        );
        await Order.findByIdAndUpdate(existingTechpack.orderId, {
          $set: {
            fabricSketch: {
              url: sketchUpload.secure_url,
              cloudinaryPublicId: sketchUpload.public_id,
            },
          },
        });
      }
    }

    const updatedTechpack = await TechpackIteration.findByIdAndUpdate(
      techpackId,
      {
        $set: techpackUpdateData,
        lastUpdatedBy: req.result._id,
      },
      { new: true, runValidators: true }
    );

    await createFieldChangeLogs({
      orderId: existingTechpack.orderId,
      module: "TECHPACK",
      fields: [
        "initialTPDate",
        "firstFitSubmissionDate",
        "secondFitSubmissionDate",
        "ppApprovalDate",
        "techpackFile",
      ],
      beforeDoc: existingTechpack,
      afterDoc: updatedTechpack,
      user: req.result,
    });

    res.status(200).json({
      success: true,
      message: "Techpack milestones and visual sketch updated successfully!",
      data: updatedTechpack,
    });
  } catch (error) {
    console.error("Techpack Update Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};

export const updateCosting = async (req, res) => {
  try {
    const { costingId } = req.params;

    const costing = await Costing.findById(costingId);
    if (!costing) {
      return res
        .status(404)
        .json({ success: false, message: "Costing document not found." });
    }
    const beforeCosting = costing.toObject ? costing.toObject() : { ...costing };

    if (req.files) {
      if (req.files.costingSheet) {
        const fileUpload = await uploadOnCloudinary(
          req.files.costingSheet[0].path
        );
        costing.costingSheet = {
          url: fileUpload.secure_url,
          cloudinaryPublicId: fileUpload.public_id,
        };
      }

      if (req.files.fabricSketch) {
        const sketchUpload = await uploadOnCloudinary(
          req.files.fabricSketch[0].path
        );
        await Order.findByIdAndUpdate(costing.orderId, {
          $set: {
            fabricSketch: {
              url: sketchUpload.secure_url,
              cloudinaryPublicId: sketchUpload.public_id,
            },
          },
        });
      }
    }

    const numFields = ["fabricCost", "trim", "packagingWithYY", "washingCost", "testing", "cutMakingCost", "overheads"];
    numFields.forEach((key) => {
      if (req.body[key] !== undefined && req.body[key] !== "") {
        costing[key] = Number(req.body[key]) || 0;
      }
    });
    if (req.body.isApproved !== undefined) {
      costing.isApproved = req.body.isApproved === "true" || req.body.isApproved === true;
    }
    costing.lastUpdatedBy = req.result._id;

    await costing.save();

    await createFieldChangeLogs({
      orderId: costing.orderId,
      module: "COSTING",
      fields: [
        "fabricCost",
        "trim",
        "packagingWithYY",
        "washingCost",
        "testing",
        "cutMakingCost",
        "overheads",
        "isApproved",
        "finalCost",
        "costingSheet",
      ],
      beforeDoc: beforeCosting,
      afterDoc: costing,
      user: req.result,
    });

    if (costing.isApproved === true) {
      const order = await Order.findById(costing.orderId).select("factory merchant styleNumber").lean();
      if (order) {
        if (req.result.role === "asmara" && typeof order.factory === "string") {
          const f = order.factory;
          const message = `Costing approved for order ${order.styleNumber || costing.orderId}.`;
          const factoryUsers = await User.find({
            role: "factory",
            organisationName: new RegExp(`^${String(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
            isActive: true,
          }).select("_id").lean();
          for (const u of factoryUsers) {
            await Notification.create({
              recipient: u._id,
              sender: req.result._id,
              orderId: costing.orderId,
              type: NOTIFICATION_TYPES[0],
              message,
              isRead: false,
            });
          }
        }
        if (req.result.role === "factory" && order.merchant) {
          await Notification.create({
            recipient: order.merchant,
            sender: req.result._id,
            orderId: costing.orderId,
            type: NOTIFICATION_TYPES[0],
            message: `Factory approved costing for order ${order.styleNumber || costing.orderId}.`,
            isRead: false,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Costing updated and Final Cost recalculated!",
      data: costing,
    });
  } catch (error) {
    console.error("Costing Update Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};

const ORDER_STATUS_VALUES = ["pending", "in-production", "shipped", "delivered", "cancelled"];
const FACTORY_ALLOWED_STATUSES = ["shipped", "delivered"];

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const user = req.result;

    if (!status || typeof status !== "string") {
      return res.status(400).json({ success: false, message: "Status is required." });
    }
    if (!ORDER_STATUS_VALUES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (user.role === "factory") {
      if (!orderBelongsToFactoryUser(order, user)) {
        return res.status(403).json({ success: false, message: "You do not have access to this order." });
      }
      if (!FACTORY_ALLOWED_STATUSES.includes(status)) {
        return res.status(403).json({
          success: false,
          message: "Factory can only set status to Shipped or Delivered.",
        });
      }
    }

    const previousStatus = order.status;
    order.status = status;
    await order.save();

    if (previousStatus !== status) {
      await OrderLog.create({
        orderId: order._id,
        module: "ORDER",
        field: "status",
        oldValue: previousStatus,
        newValue: status,
        changedBy: user._id,
        changedByName: userDisplayName(user),
        changedByOrganisation: user.organisationName || "",
        message: `${userDisplayName(user)} from ${user.organisationName || "Unknown organisation"} changed order status.`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Order status updated.",
      data: order,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { search } = req.query;
    const user = req.result;

    const query = { isActive: true };
    const andParts = [];

    if (user.role === "factory") {
      const orgName = (user.organisationName ?? "").trim();
      if (orgName) {
        const escaped = orgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        andParts.push({ factory: { $regex: `^\\s*${escaped}\\s*$`, $options: "i" } });
      } else {
        andParts.push({ _id: null });
      }
    }

    if (search) {
      andParts.push({
        $or: [
          { styleNumber: { $regex: search, $options: "i" } },
          { buyerName: { $regex: search, $options: "i" } },
          { factory: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (andParts.length) query.$and = andParts;

    const orders = await Order.find(query)
      .select(
        "styleNumber buyerName orderQuantity shipmentDate season status previewPhoto factory createdAt"
      )
      .populate("merchant", "firstName lastName emailId organisationName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Get All Orders Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};

export const getOrderLogs = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = req.result;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required." });
    }

    const order = await Order.findById(orderId).select("merchant factory");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const isMerchant = String(order.merchant) === String(user._id);
    const isFactory = orderBelongsToFactoryUser(order, user);
    const isAsmara = user.role === "asmara";

    if (!isMerchant && !isFactory && !isAsmara) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this order logs.",
      });
    }

    const logs = await OrderLog.find({ orderId })
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("Get Order Logs Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};

export const searchOrderByStyle = async (req, res) => {
  try {
    const { q } = req.query; // 'q' is the search string from the frontend

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Please provide a style number to search.",
      });
    }

    const orders = await Order.find({
      styleNumber: { $regex: q, $options: "i" },
    })
      .select("styleNumber buyerName previewPhoto season status shipmentDate")
      .limit(10); // Limit results for performance during "live typing"

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Style Search Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};
