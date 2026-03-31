import Notification, { NOTIFICATION_TYPES } from "../models/notificationModel.js";
import Comment from "../models/commentModel.js";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import OrderLog from "../models/orderLogModel.js";
import { mailSender } from "../utils/mailSender.js";
import { orderBelongsToFactoryUser } from "../utils/orderFactoryAccess.js";


export const addComment = async (req, res) => {
  try {
    const user = req.result;
    const { orderId, text, scope, field } = req.body;

    const normalizedScope = scope || "ORDER";
    const normalizedField = field || undefined;

    const FABRIC_FIELD_LABELS = {
      labDipApprovalDate: "Lab dip approval",
      iobApprovalDate: "IOB approval",
      bulkInhouseDate: "Bulk in-house",
      lotApprovalDate: "Lot approval",
    };

    const scopeLabel =
      normalizedScope === "FABRIC"
        ? FABRIC_FIELD_LABELS[normalizedField] || normalizedField || "Fabric"
        : normalizedScope === "TECHPACK"
          ? "Tech pack"
          : normalizedScope === "COSTING"
            ? "Costing"
            : normalizedScope === "TNA"
              ? "TNA"
              : "Order";

    if (!orderId || !text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "orderId and text are required.",
      });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const merchantId = order.merchant?.toString();
    const userId = user._id.toString();
    const isMerchant = userId === merchantId;
    const isFactory = orderBelongsToFactoryUser(order, user);

    if (!isMerchant && !isFactory) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this order.",
      });
    }

    const comment = await Comment.create({
      orderId,
      sender: user._id,
      text: text.trim(),
      scope: normalizedScope,
      fabricField: normalizedField,
    });

    const actorName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.emailId || "Unknown user";
    await OrderLog.create({
      orderId,
      module: "COMMENT",
      field: normalizedField ? `${normalizedScope}.${normalizedField}` : normalizedScope,
      oldValue: null,
      newValue: text.trim(),
      changedBy: user._id,
      changedByName: actorName,
      changedByOrganisation: user.organisationName || "",
      message: `${actorName} from ${user.organisationName || "Unknown organisation"} added a ${scopeLabel} comment.`,
    });

    try {
      const recipients = new Set();

      if (typeof order.factory === "string" && order.factory.trim()) {
        const factoryUsers = await User.find({
          role: "factory",
          organisationName: new RegExp(`^${String(order.factory).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          isActive: true,
        })
          .select("emailId")
          .lean();

        for (const u of factoryUsers) {
          const email = String(u.emailId || "").trim().toLowerCase();
          if (email) recipients.add(email);
        }
      }

      if (user?.emailId) {
        recipients.add(String(user.emailId).trim().toLowerCase());
      }

      if (recipients.size > 0) {
        const subject = `New comment on order ${order.styleNumber || orderId}`;
        const body = `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
            <h2 style="margin-bottom: 8px;">New comment added</h2>
            <p style="margin: 0 0 10px 0;">
              <strong>${actorName}</strong> added a <strong>${scopeLabel}</strong> comment.
            </p>
            <ul style="margin: 0 0 12px 18px; padding: 0;">
              <li><strong>Order:</strong> ${order.styleNumber || orderId}</li>
              <li><strong>Factory:</strong> ${order.factory || "—"}</li>
              <li><strong>Scope:</strong> ${scopeLabel}</li>
            </ul>
            <div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; background: #f9fafb;">
              ${text.trim()}
            </div>
          </div>
        `;

        const emailResults = await Promise.allSettled(
          [...recipients].map((email) => mailSender(email, subject, body))
        );
        const failed = emailResults.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          console.error(
            `Comment email partially failed (${failed.length}/${emailResults.length}).`,
            failed.map((f) => f.reason?.message || String(f.reason))
          );
        }
      }
    } catch (emailErr) {
      console.error("Comment email notification failed:", emailErr?.message || emailErr);
    }

    if (user.role === "asmara" && typeof order.factory === "string") {
      const f = order.factory;
      const message = `New ${scopeLabel} comment on order ${order.styleNumber || orderId}.`;
      const factoryUsers = await User.find({
        role: "factory",
        organisationName: new RegExp(`^${String(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        isActive: true,
      }).select("_id").lean();
      for (const u of factoryUsers) {
        await Notification.create({
          recipient: u._id,
          sender: user._id,
          orderId,
          type: NOTIFICATION_TYPES[1],
          message,
          isRead: false,
        });
      }
    } else if (user.role === "factory" && order.merchant) {
      await Notification.create({
        recipient: order.merchant,
        sender: user._id,
        orderId,
        type: NOTIFICATION_TYPES[1],
        message: `New ${scopeLabel} comment on order ${order.styleNumber || orderId}.`,
        isRead: false,
      });
    }

    const populated = await Comment.findById(comment._id)
      .populate("sender", "firstName lastName emailId organisationName role")
      .lean();

    res.status(201).json({
      success: true,
      message: "Comment added and partner notified.",
      data: populated,
    });
  } catch (error) {
    console.error("Add Comment Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};


export const getMyNotifications = async (req, res) => {
  try {
    const user = req.result;

    let query = {};
    if (user.role === "factory") {
      query.recipient = user._id;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("sender", "firstName lastName emailId organisationName")
      .populate("orderId", "styleNumber buyerName")
      .lean();

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};


export const getComments = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { scope, field } = req.query;
    const user = req.result;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const merchantId = order.merchant?.toString();
    const userId = user._id.toString();
    const isMerchant = userId === merchantId;
    const isFactory = orderBelongsToFactoryUser(order, user);

    if (!isMerchant && !isFactory) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this order.",
      });
    }

    const commentQuery = { orderId };
    const normalizedScope = scope || "ORDER";
    commentQuery.scope = normalizedScope;

    if (field) {
      commentQuery.fabricField = field;
    }

    const comments = await Comment.find(commentQuery)
      .sort({ createdAt: 1 })
      .limit(200)
      .populate("sender", "firstName lastName emailId organisationName role")
      .lean();

    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error("Get Comments Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
};
