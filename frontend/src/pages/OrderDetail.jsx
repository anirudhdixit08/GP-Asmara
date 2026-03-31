import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { checkAuth } from "../store/features/authSlice.js";
import { fetchOrderDetail, clearOrderDetail } from "../store/features/orderDetailSlice.js";
import { AppNav } from "../components/AppNav.jsx";
import CommentThread from "../components/CommentThread.jsx";
import axiosClient from "../utils/axiosClient.js";

const TABS = ["TNA", "Fabric", "Tech Pack", "Costing", "Logs"];

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

const ORDER_STATUS_OPTIONS = ["pending", "in-production", "shipped", "delivered", "cancelled"];
const FACTORY_STATUS_OPTIONS = ["shipped", "delivered"];

function toValidHex(hex) {
  if (!hex || typeof hex !== "string") return "#808080";
  const m = hex.trim().match(/^#?([0-9A-Fa-f]{6})$/);
  return m ? `#${m[1]}` : "#808080";
}

function getInitialFabricColors(fabric) {
  if (Array.isArray(fabric?.colors) && fabric.colors.length > 0) {
    return fabric.colors.map((c) => ({
      colorName: c?.colorName || "",
      pantoneCode: c?.pantoneCode || "",
      pantoneColorHex: toValidHex(c?.pantoneColorHex),
    }));
  }
  return [
    {
      colorName: fabric?.colorName || "TBD",
      pantoneCode: fabric?.pantoneCode || "",
      pantoneColorHex: toValidHex(fabric?.pantoneColorHex),
    },
  ];
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { order, loading, error } = useSelector((s) => s.orderDetail);
  const [activeTab, setActiveTab] = useState("TNA");
  const [editingTab, setEditingTab] = useState(null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [fabricColors, setFabricColors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [logsModuleTab, setLogsModuleTab] = useState("COSTING");
  const [commentsByThread, setCommentsByThread] = useState({});
  const [commentsLoadingByThread, setCommentsLoadingByThread] = useState({});
  const prevOrderIdRef = useRef(null);

  const isAsmara = user?.role === "asmara";
  const isFactory = user?.role === "factory";
  const canEditTna = isAsmara;
  const canEditFabric = isAsmara;
  const canEditTechPack = isAsmara;
  const canEditCosting = true;
  const canEditStatus = isAsmara || isFactory;
  const statusOptions = isAsmara ? ORDER_STATUS_OPTIONS : FACTORY_STATUS_OPTIONS;

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!orderId) return;
    if (prevOrderIdRef.current !== orderId) {
      prevOrderIdRef.current = orderId;
      dispatch(clearOrderDetail());
    }
    dispatch(fetchOrderDetail(orderId));
  }, [dispatch, orderId]);

  useEffect(() => {
    if (error?.status === 401) navigate("/login", { replace: true });
  }, [error, navigate]);

  useEffect(() => {
    if (!orderId) return;
    setCommentsByThread({});
    setCommentsLoadingByThread({});
    const THREADS = [
      {
        key: "TNA_GENERAL",
        title: "TNA comments",
        scope: "TNA",
        fieldKey: "general",
      },
      {
        key: "TNA_GREIGE",
        title: "Greige commit comments",
        scope: "TNA",
        fieldKey: "greigeCommit",
      },
      {
        key: "TNA_COLOR",
        title: "Color commit comments",
        scope: "TNA",
        fieldKey: "colorCommit",
      },
      {
        key: "TNA_PP",
        title: "PP approval comments",
        scope: "TNA",
        fieldKey: "ppApproval",
      },
      {
        key: "TNA_CUT",
        title: "Cut date comments",
        scope: "TNA",
        fieldKey: "cutDate",
      },
      {
        key: "TNA_GAC",
        title: "GAC comments",
        scope: "TNA",
        fieldKey: "gacDate",
      },
      {
        key: "TNA_CLOSED",
        title: "TNA closed with buyer comments",
        scope: "TNA",
        fieldKey: "tnaClosedWithBuyer",
      },
      {
        key: "TECHPACK_GENERAL",
        title: "Tech pack comments",
        scope: "TECHPACK",
        fieldKey: "general",
      },
      {
        key: "TECHPACK_INITIAL",
        title: "Initial TP comments",
        scope: "TECHPACK",
        fieldKey: "initialTPDate",
      },
      {
        key: "TECHPACK_FIRST_FIT",
        title: "1st fit submission comments",
        scope: "TECHPACK",
        fieldKey: "firstFitSubmissionDate",
      },
      {
        key: "TECHPACK_SECOND_FIT",
        title: "2nd fit submission comments",
        scope: "TECHPACK",
        fieldKey: "secondFitSubmissionDate",
      },
      {
        key: "TECHPACK_PP",
        title: "PP approval date comments",
        scope: "TECHPACK",
        fieldKey: "ppApprovalDate",
      },
      {
        key: "FABRIC_COMMON",
        title: "Fabric comments",
        scope: "FABRIC",
        fieldKey: "general",
      },
      {
        key: "FABRIC_LAB_DIP",
        title: "Lab dip approval comments",
        scope: "FABRIC",
        fieldKey: "labDipApprovalDate",
      },
      {
        key: "FABRIC_IOB",
        title: "IOB approval comments",
        scope: "FABRIC",
        fieldKey: "iobApprovalDate",
      },
      {
        key: "FABRIC_BULK",
        title: "Bulk in-house comments",
        scope: "FABRIC",
        fieldKey: "bulkInhouseDate",
      },
      {
        key: "FABRIC_LOT",
        title: "Lot approval comments",
        scope: "FABRIC",
        fieldKey: "lotApprovalDate",
      },
      { key: "COSTING", title: "Costing comments", scope: "COSTING" },
    ];

    const threadKey = (t) => {
      if (t.fieldKey) return `${t.scope}:${t.fieldKey}`;
      return `${t.scope}:`;
    };

    async function refreshThread(t) {
      const k = threadKey(t);
      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
      try {
        const params = { scope: t.scope };
        if (t.fieldKey) params.field = t.fieldKey;
        const res = await axiosClient.get(
          `/notification/order/${orderId}/comments`,
          { params }
        );
        setCommentsByThread((prev) => ({
          ...prev,
          [k]: res.data?.data ?? [],
        }));
      } catch {
        setCommentsByThread((prev) => ({ ...prev, [k]: [] }));
      } finally {
        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
      }
    }

    Promise.all(THREADS.map((t) => refreshThread(t)));
  }, [orderId]);

  useEffect(() => {
    if (!orderId || activeTab !== "Logs") return;
    setLogsLoading(true);
    setLogsError("");
    axiosClient
      .get(`/order/logs/${orderId}`)
      .then((res) => setLogs(res.data?.data ?? []))
      .catch((err) => {
        setLogs([]);
        setLogsError(err.response?.data?.message || err.message || "Failed to load logs");
      })
      .finally(() => setLogsLoading(false));
  }, [orderId, activeTab]);

  useEffect(() => {
    if (activeTab !== "Logs") return;
    setLogsModuleTab("COSTING");
  }, [activeTab, orderId]);

  function valueToText(value) {
    if (value == null) return "—";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  const threadKey = (scope, fieldKey) => {
    if (fieldKey) return `${scope}:${fieldKey}`;
    return `${scope}:`;
  };

  async function handleSaveTna(e) {
    e.preventDefault();
    if (!order?.tna?._id) return;
    setEditError("");
    setSaveLoading(true);
    const form = e.target;
    const body = {
      greigeCommit: form.greigeCommit?.value || null,
      colorCommit: form.colorCommit?.value || null,
      ppApproval: form.ppApproval?.value || null,
      cutDate: form.cutDate?.value || null,
      gacDate: form.gacDate?.value || null,
      tnaClosedWithBuyer: form.tnaClosedWithBuyer?.value || null,
    };
    Object.keys(body).forEach((k) => { if (body[k] === "") body[k] = null; });
    try {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
      const file = form.fabricSketch?.files?.[0];
      if (file) fd.append("fabricSketch", file);
      await axiosClient.patch(`/order/update-tna/${order.tna._id}`, fd);
      setEditingTab(null);
      dispatch(fetchOrderDetail(orderId));
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || "Failed to save");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSaveFabric(e) {
    e.preventDefault();
    if (!order?.fabric?._id) return;
    setEditError("");
    setSaveLoading(true);
    const form = e.target;
    const normalizedColors = fabricColors
      .map((c) => ({
        colorName: String(c.colorName || "").trim(),
        pantoneCode: String(c.pantoneCode || "").trim(),
        pantoneColorHex: toValidHex(c.pantoneColorHex),
      }))
      .filter((c) => c.colorName);

    if (normalizedColors.length === 0) {
      setEditError("Please add at least one fabric color.");
      setSaveLoading(false);
      return;
    }

    const body = {
      labDipApprovalDate: form.labDipApprovalDate?.value || null,
      iobApprovalDate: form.iobApprovalDate?.value || null,
      bulkInhouseDate: form.bulkInhouseDate?.value || null,
      lotApprovalDate: form.lotApprovalDate?.value || null,
    };
    Object.keys(body).forEach((k) => { if (body[k] === "") body[k] = null; });
    try {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => { if (v != null && v !== undefined) fd.append(k, v); });
      fd.append("colors", JSON.stringify(normalizedColors));
      const file = form.fabricSketch?.files?.[0];
      if (file) fd.append("fabricSketch", file);
      await axiosClient.patch(`/order/update-fabric/${order.fabric._id}`, fd);
      setEditingTab(null);
      dispatch(fetchOrderDetail(orderId));
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || "Failed to save");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSaveTechPack(e) {
    e.preventDefault();
    if (!order?.techpackDetails?._id) return;
    setEditError("");
    setSaveLoading(true);
    const form = e.target;
    const body = {
      initialTPDate: form.initialTPDate?.value || null,
      firstFitSubmissionDate: form.firstFitSubmissionDate?.value || null,
      secondFitSubmissionDate: form.secondFitSubmissionDate?.value || null,
      ppApprovalDate: form.ppApprovalDate?.value || null,
    };
    Object.keys(body).forEach((k) => { if (body[k] === "") body[k] = null; });
    try {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
      const techpackFile = form.techpackFile?.files?.[0];
      const fabricSketch = form.fabricSketch?.files?.[0];
      if (techpackFile) fd.append("techpackFile", techpackFile);
      if (fabricSketch) fd.append("fabricSketch", fabricSketch);
      await axiosClient.patch(`/order/update-techpack/${order.techpackDetails._id}`, fd);
      setEditingTab(null);
      dispatch(fetchOrderDetail(orderId));
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || "Failed to save");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSaveCosting(e) {
    e.preventDefault();
    if (!order?.costing?._id) return;
    setEditError("");
    setSaveLoading(true);
    const form = e.target;
    const body = {
      fabricCost: form.fabricCost?.value ? Number(form.fabricCost.value) : 0,
      trim: form.trim?.value ? Number(form.trim.value) : 0,
      packagingWithYY: form.packagingWithYY?.value ? Number(form.packagingWithYY.value) : 0,
      washingCost: form.washingCost?.value ? Number(form.washingCost.value) : 0,
      testing: form.testing?.value ? Number(form.testing.value) : 0,
      cutMakingCost: form.cutMakingCost?.value ? Number(form.cutMakingCost.value) : 0,
      overheads: form.overheads?.value ? Number(form.overheads.value) : 0,
      isApproved: (form.isApproved?.checked ?? false) ? "true" : "false",
    };
    try {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => fd.append(k, String(v)));
      const costingSheet = form.costingSheet?.files?.[0];
      const fabricSketch = form.fabricSketch?.files?.[0];
      if (costingSheet) fd.append("costingSheet", costingSheet);
      if (fabricSketch) fd.append("fabricSketch", fabricSketch);
      await axiosClient.patch(`/order/update-costing/${order.costing._id}`, fd);
      setEditingTab(null);
      dispatch(fetchOrderDetail(orderId));
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || "Failed to save");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSaveStatus(e) {
    e.preventDefault();
    if (!orderId) return;
    const newStatus = e.target.status?.value;
    if (!newStatus) return;
    setEditError("");
    setSaveLoading(true);
    try {
      await axiosClient.patch(`/order/update-status/${orderId}`, { status: newStatus });
      setEditingStatus(false);
      dispatch(fetchOrderDetail(orderId));
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || "Failed to update status");
    } finally {
      setSaveLoading(false);
    }
  }

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-6">
        <p className="text-error mb-4">{error.message || "Order not found."}</p>
        <Link to="/orders" className="btn btn-primary">
          Back to orders
        </Link>
      </div>
    );
  }

  if (!order) return null;

  const styleLabel = order.styleNumber + (order.buyerName ? ` ${order.buyerName}` : "");
  const images = [
    order.previewPhoto?.url,
    order.fabricSketch?.url,
    order.techpackDetails?.techpackFile?.url,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <AppNav backTo="/orders" backLabel="Back to orders" />

      <main className={`flex-1 mx-auto w-full p-4 sm:p-6 ${activeTab === "Logs" ? "max-w-[95vw]" : "max-w-6xl"}`}>
        <div className="bg-base-100 rounded-lg border border-base-300 shadow-sm overflow-hidden text-base-content">
          {activeTab !== "Logs" && (
            <div className="px-5 py-4 border-b border-base-300 bg-base-200/50">
              <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Style number</span>
              <p className="text-lg font-semibold">{order.styleNumber}</p>
            </div>
          )}

          <div role="tablist" className="tabs tabs-boxed tabs-lg bg-base-100 border-b border-base-300 rounded-none overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                type="button"
                className={`tab whitespace-nowrap ${activeTab === tab ? "tab-active" : ""}`}
                onClick={() => { setActiveTab(tab); setEditingTab(null); setEditError(""); }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {editError && (
              <div className="alert alert-error text-sm mb-4" role="alert">
                {editError}
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className={activeTab === "Logs" ? "hidden" : "lg:col-span-4 space-y-4"}>
                <div>
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Style number</span>
                  <p className="font-medium">{order.styleNumber}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Style</span>
                  <p className="font-medium wrap-break-word">{styleLabel}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Season</span>
                  <p className="font-medium">{order.season}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Brand</span>
                  <p className="font-medium">{order.buyerName}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Quantity</span>
                  <p className="font-medium">{order.orderQuantity?.toLocaleString() ?? "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Shipment date</span>
                  <p className="font-medium">{formatDate(order.shipmentDate)}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Status</span>
                  {editingStatus && canEditStatus ? (
                    <form onSubmit={handleSaveStatus} className="flex flex-wrap items-center gap-2">
                      <select name="status" className="select select-bordered select-sm" defaultValue={order.status}>
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={saveLoading}>{saveLoading ? "…" : "Save"}</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingStatus(false)}>Cancel</button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge badge-sm ${
                        order.status === "delivered" ? "badge-success" :
                        order.status === "cancelled" ? "badge-error" :
                        order.status === "in-production" ? "badge-info" : "badge-warning"
                      }`}>
                        {order.status}
                      </span>
                      {canEditStatus && (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingStatus(true)}>Edit</button>
                      )}
                    </div>
                  )}
                </div>
                {order.factory && (
                  <div>
                    <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-1">Factory</span>
                    <p className="font-medium">{typeof order.factory === "string" ? order.factory : order.factory?.organisationName ?? "—"}</p>
                  </div>
                )}
              </div>

              <div className={activeTab === "Logs" ? "lg:col-span-12 space-y-6" : "lg:col-span-8 space-y-6"}>
                {activeTab === "TNA" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-base-content/70 uppercase tracking-wider">TNA</h3>
                      {canEditTna && !editingTab && (
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditingTab("TNA")}>
                          Edit
                        </button>
                      )}
                    </div>
                    {editingTab === "TNA" && order.tna ? (
                      <form onSubmit={handleSaveTna} className="space-y-3">
                        {["greigeCommit", "colorCommit", "ppApproval", "cutDate", "gacDate", "tnaClosedWithBuyer"].map((field) => (
                          <div key={field} className="form-control">
                            <label className="label py-0">
                              <span className="label-text text-sm capitalize">{field.replace(/([A-Z])/g, " $1").trim()}</span>
                            </label>
                            <input type="date" name={field} className="input input-bordered input-sm w-full" defaultValue={toInputDate(order.tna[field])} />
                          </div>
                        ))}
                        <div className="form-control">
                          <label className="label py-0"><span className="label-text text-sm">Fabric sketch (optional)</span></label>
                          <input type="file" name="fabricSketch" className="file-input file-input-bordered file-input-sm w-full" accept="image/*" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingTab(null)}>Cancel</button>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={saveLoading}>{saveLoading ? "Saving…" : "Save"}</button>
                        </div>
                      </form>
                    ) : order.tna ? (
                      <ul className="space-y-2 text-sm">
                        <li><span className="text-base-content/70">Greige commit:</span> {formatDate(order.tna.greigeCommit)}</li>
                        <li><span className="text-base-content/70">Color commit:</span> {formatDate(order.tna.colorCommit)}</li>
                        <li><span className="text-base-content/70">PP approval:</span> {formatDate(order.tna.ppApproval)}</li>
                        <li><span className="text-base-content/70">Cut date:</span> {formatDate(order.tna.cutDate)}</li>
                        <li><span className="text-base-content/70">GAC:</span> {formatDate(order.tna.gacDate)}</li>
                        <li><span className="text-base-content/70">TNA closed with buyer:</span> {formatDate(order.tna.tnaClosedWithBuyer)}</li>
                      </ul>
                    ) : (
                      <p className="text-base-content/70 text-sm">No TNA data yet.</p>
                    )}
                  </div>
                )}

                {activeTab === "Fabric" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-base-content/70 uppercase tracking-wider">Fabric</h3>
                      {canEditFabric && !editingTab && order.fabric && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setFabricColors(getInitialFabricColors(order.fabric));
                            setEditingTab("Fabric");
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingTab === "Fabric" && order.fabric ? (
                      <form onSubmit={handleSaveFabric} className="space-y-3">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="label-text text-sm font-medium">Fabric colors</span>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              onClick={() =>
                                setFabricColors((prev) => [
                                  ...prev,
                                  { colorName: "", pantoneCode: "", pantoneColorHex: "#808080" },
                                ])
                              }
                            >
                              Add color
                            </button>
                          </div>
                          {fabricColors.map((color, idx) => (
                            <div key={`color-${idx}`} className="rounded-lg border border-base-300 p-3 space-y-2 bg-base-200/40">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-base-content/70 uppercase">Color #{idx + 1}</span>
                                {fabricColors.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs text-error"
                                    onClick={() =>
                                      setFabricColors((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                              <input
                                className="input input-bordered input-sm w-full"
                                placeholder="Color name"
                                value={color.colorName}
                                onChange={(e) =>
                                  setFabricColors((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, colorName: e.target.value } : c))
                                  )
                                }
                              />
                              <input
                                className="input input-bordered input-sm w-full"
                                placeholder="Pantone code"
                                value={color.pantoneCode}
                                onChange={(e) =>
                                  setFabricColors((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, pantoneCode: e.target.value } : c))
                                  )
                                }
                              />
                              <div className="flex items-center gap-3 flex-wrap">
                                <input
                                  type="color"
                                  className="w-full h-10 rounded border-2 border-base-300 cursor-pointer"
                                  style={{ minWidth: "12rem" }}
                                  value={toValidHex(color.pantoneColorHex)}
                                  onChange={(e) =>
                                    setFabricColors((prev) =>
                                      prev.map((c, i) =>
                                        i === idx ? { ...c, pantoneColorHex: e.target.value } : c
                                      )
                                    )
                                  }
                                />
                                <input
                                  type="text"
                                  className="input input-bordered input-sm w-28"
                                  placeholder="#rrggbb"
                                  value={toValidHex(color.pantoneColorHex)}
                                  onChange={(e) =>
                                    setFabricColors((prev) =>
                                      prev.map((c, i) =>
                                        i === idx ? { ...c, pantoneColorHex: e.target.value } : c
                                      )
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ))}
                          <p className="text-xs text-base-content/60">Use Add color to keep multiple shades/fabric colors.</p>
                        </div>
                        {["labDipApprovalDate", "iobApprovalDate", "bulkInhouseDate", "lotApprovalDate"].map((field) => (
                          <div key={field} className="form-control">
                            <label className="label py-0"><span className="label-text text-sm">{field.replace(/([A-Z])/g, " $1").trim()}</span></label>
                            <input type="date" name={field} className="input input-bordered input-sm w-full" defaultValue={toInputDate(order.fabric[field])} />
                          </div>
                        ))}
                        <div className="form-control">
                          <label className="label py-0"><span className="label-text text-sm">Fabric sketch (optional)</span></label>
                          <input type="file" name="fabricSketch" className="file-input file-input-bordered file-input-sm w-full" accept="image/*" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingTab(null)}>Cancel</button>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={saveLoading}>{saveLoading ? "Saving…" : "Save"}</button>
                        </div>
                      </form>
                    ) : order.fabric ? (
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-2">Colors</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(Array.isArray(order.fabric.colors) && order.fabric.colors.length > 0
                              ? order.fabric.colors
                              : [{
                                  colorName: order.fabric.colorName,
                                  pantoneCode: order.fabric.pantoneCode,
                                  pantoneColorHex: order.fabric.pantoneColorHex,
                                }]
                            ).map((c, idx) => (
                              <div key={`fabric-view-${idx}`} className="rounded-lg border border-base-300 p-2 bg-base-200/40">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-6 h-6 rounded border border-base-300 shrink-0"
                                    style={{ backgroundColor: toValidHex(c?.pantoneColorHex) }}
                                  />
                                  <span className="font-medium">{c?.colorName || "—"}</span>
                                </div>
                                {c?.pantoneCode && (
                                  <p className="text-xs text-base-content/70 mt-1">{c.pantoneCode}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <p><span className="text-base-content/70">Lab dip approval:</span> {formatDate(order.fabric.labDipApprovalDate)}</p>
                          <p><span className="text-base-content/70">IOB approval:</span> {formatDate(order.fabric.iobApprovalDate)}</p>
                          <p><span className="text-base-content/70">Bulk in-house:</span> {formatDate(order.fabric.bulkInhouseDate)}</p>
                          <p><span className="text-base-content/70">Lot approval:</span> {formatDate(order.fabric.lotApprovalDate)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-base-content/70 text-sm">No fabric data yet.</p>
                    )}
                  </div>
                )}

                {activeTab === "Tech Pack" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-base-content/70 uppercase tracking-wider">Tech pack</h3>
                      {canEditTechPack && !editingTab && order.techpackDetails && (
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditingTab("Tech Pack")}>
                          Edit
                        </button>
                      )}
                    </div>
                    {editingTab === "Tech Pack" && order.techpackDetails ? (
                      <form onSubmit={handleSaveTechPack} className="space-y-3">
                        {["initialTPDate", "firstFitSubmissionDate", "secondFitSubmissionDate", "ppApprovalDate"].map((field) => (
                          <div key={field} className="form-control">
                            <label className="label py-0"><span className="label-text text-sm">{field.replace(/([A-Z])/g, " $1").trim()}</span></label>
                            <input type="date" name={field} className="input input-bordered input-sm w-full" defaultValue={toInputDate(order.techpackDetails[field])} />
                          </div>
                        ))}
                        <div className="form-control">
                          <label className="label py-0"><span className="label-text text-sm">Techpack file (optional)</span></label>
                          <input type="file" name="techpackFile" className="file-input file-input-bordered file-input-sm w-full" accept=".pdf,.zip" />
                        </div>
                        <div className="form-control">
                          <label className="label py-0"><span className="label-text text-sm">Fabric sketch (optional)</span></label>
                          <input type="file" name="fabricSketch" className="file-input file-input-bordered file-input-sm w-full" accept="image/*" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingTab(null)}>Cancel</button>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={saveLoading}>{saveLoading ? "Saving…" : "Save"}</button>
                        </div>
                      </form>
                    ) : order.techpackDetails ? (
                      <div className="space-y-2 text-sm">
                        <p><span className="text-base-content/70">Initial TP:</span> {formatDate(order.techpackDetails.initialTPDate)}</p>
                        <p><span className="text-base-content/70">1st fit submission:</span> {formatDate(order.techpackDetails.firstFitSubmissionDate)}</p>
                        <p><span className="text-base-content/70">2nd fit submission:</span> {formatDate(order.techpackDetails.secondFitSubmissionDate)}</p>
                        <p><span className="text-base-content/70">PP approval date:</span> {formatDate(order.techpackDetails.ppApprovalDate)}</p>
                        {order.techpackDetails.techpackFile?.url && (
                          <a href={order.techpackDetails.techpackFile.url} target="_blank" rel="noreferrer" className="link link-primary text-sm">Open techpack file</a>
                        )}
                      </div>
                    ) : (
                      <p className="text-base-content/70 text-sm">No tech pack data yet.</p>
                    )}
                  </div>
                )}

                {activeTab === "Costing" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-base-content/70 uppercase tracking-wider">Costing</h3>
                      {canEditCosting && !editingTab && order.costing && (
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditingTab("Costing")}>
                          Edit
                        </button>
                      )}
                    </div>
                    {editingTab === "Costing" && order.costing ? (
                      <form onSubmit={handleSaveCosting} className="space-y-3">
                        {["fabricCost", "trim", "packagingWithYY", "washingCost", "testing", "cutMakingCost", "overheads"].map((field) => (
                          <div key={field} className="form-control">
                            <label className="label py-0"><span className="label-text text-sm">{field.replace(/([A-Z])/g, " $1").trim()}</span></label>
                            <input type="number" step="0.01" name={field} className="input input-bordered input-sm w-full" defaultValue={order.costing[field] ?? ""} />
                          </div>
                        ))}
                        <div className="form-control">
                          <label className="label cursor-pointer gap-2 justify-start">
                            <input type="checkbox" name="isApproved" className="checkbox checkbox-sm" defaultChecked={order.costing.isApproved} />
                            <span className="label-text">Approved</span>
                          </label>
                        </div>
                        <div className="form-control">
                          <label className="label py-0"><span className="label-text text-sm">Costing sheet (optional)</span></label>
                          <input type="file" name="costingSheet" className="file-input file-input-bordered file-input-sm w-full" accept=".pdf,.zip" />
                        </div>
                        <div className="form-control">
                          <label className="label py-0"><span className="label-text text-sm">Fabric sketch (optional)</span></label>
                          <input type="file" name="fabricSketch" className="file-input file-input-bordered file-input-sm w-full" accept="image/*" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingTab(null)}>Cancel</button>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={saveLoading}>{saveLoading ? "Saving…" : "Save"}</button>
                        </div>
                      </form>
                    ) : order.costing ? (
                      <div className="space-y-2 text-sm">
                        <p><span className="text-base-content/70">Fabric cost:</span> {order.costing.fabricCost != null ? `$ ${order.costing.fabricCost.toFixed(2)}` : "—"}</p>
                        <p><span className="text-base-content/70">Trim:</span> {order.costing.trim != null ? `$ ${order.costing.trim.toFixed(2)}` : "—"}</p>
                        <p><span className="text-base-content/70">Packaging with Y/Y:</span> {order.costing.packagingWithYY != null ? `$ ${order.costing.packagingWithYY.toFixed(2)}` : "—"}</p>
                        <p><span className="text-base-content/70">Washing cost:</span> {order.costing.washingCost != null ? `$ ${order.costing.washingCost.toFixed(2)}` : "—"}</p>
                        <p><span className="text-base-content/70">Testing:</span> {order.costing.testing != null ? `$ ${order.costing.testing.toFixed(2)}` : "—"}</p>
                        <p><span className="text-base-content/70">Cut making cost:</span> {order.costing.cutMakingCost != null ? `$ ${order.costing.cutMakingCost.toFixed(2)}` : "—"}</p>
                        <p><span className="text-base-content/70">Overheads:</span> {order.costing.overheads != null ? `$ ${order.costing.overheads.toFixed(2)}` : "—"}</p>
                        <p className="font-semibold pt-2 border-t border-base-300 mt-2">Final cost: {order.costing.finalCost != null ? `$ ${order.costing.finalCost.toFixed(2)}` : "—"}</p>
                        <p><span className="text-base-content/70">Approved:</span> {order.costing.isApproved ? "Yes" : "No"}</p>
                        {order.costing.costingSheet?.url && (
                          <a href={order.costing.costingSheet.url} target="_blank" rel="noreferrer" className="link link-primary text-sm">Open costing sheet</a>
                        )}
                      </div>
                    ) : (
                      <p className="text-base-content/70 text-sm">No costing data yet.</p>
                    )}
                  </div>
                )}

                {activeTab === "Logs" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-base-content/70 uppercase tracking-wider">Order logbook</h3>
                    </div>
                    <div role="tablist" className="tabs tabs-boxed tabs-sm mb-4">
                      {[
                        { key: "COSTING", label: "Costing" },
                        { key: "FABRIC", label: "Fabric" },
                        { key: "TECHPACK", label: "Techpack" },
                        { key: "TNA", label: "TNA" },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          role="tab"
                          className={`tab ${logsModuleTab === t.key ? "tab-active" : ""}`}
                          onClick={() => setLogsModuleTab(t.key)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {logsLoading ? (
                      <div className="p-8 flex justify-center">
                        <span className="loading loading-spinner loading-md" />
                      </div>
                    ) : logsError ? (
                      <p className="text-error text-sm">{logsError}</p>
                    ) : logs.length === 0 ? (
                      <p className="text-base-content/70 text-sm">No logs yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const selectedLogs = [...logs]
                            .filter((l) => l.module === logsModuleTab)
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                          if (selectedLogs.length === 0) {
                            return (
                              <p className="text-sm text-base-content/60">
                                No {logsModuleTab.toLowerCase()} logs.
                              </p>
                            );
                          }
                          return (
                            <ul className="space-y-3">
                              {selectedLogs.map((l) => (
                                <li key={l._id} className="rounded-lg border border-base-300 bg-base-100 p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="badge badge-sm badge-ghost">{l.module}</span>
                                    <span className="text-xs text-base-content/60">{formatDateTime(l.createdAt)}</span>
                                  </div>
                                  <p className="text-sm font-medium mt-2">{l.message}</p>
                                  <p className="text-xs text-base-content/70 mt-1">
                                    <span className="font-semibold">Field:</span> {l.field}
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
                                    <div className="rounded border border-base-300 p-2 bg-base-100">
                                      <span className="font-semibold text-base-content/70">Old</span>
                                      <p className="mt-1 wrap-break-word whitespace-pre-wrap">{valueToText(l.oldValue)}</p>
                                    </div>
                                    <div className="rounded border border-base-300 p-2 bg-base-100">
                                      <span className="font-semibold text-base-content/70">New</span>
                                      <p className="mt-1 wrap-break-word whitespace-pre-wrap">{valueToText(l.newValue)}</p>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {activeTab !== "Logs" && (
                <div className="pt-4 border-t border-base-300">
                  <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-3">Visuals</span>
                  <div className="flex flex-wrap gap-3">
                    {images.length > 0 ? (
                      images.slice(0, 3).map((url, i) => (
                        <div key={i} className="w-28 h-28 sm:w-36 sm:h-36 rounded-lg overflow-hidden border-2 border-base-300 bg-base-200">
                          {url && (url.match(/\.(pdf|zip)$/i) ? (
                            <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-full text-xs font-medium link link-primary">View file</a>
                          ) : (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          ))}
                        </div>
                      ))
                    ) : (
                      [1, 2, 3].map((i) => (
                        <div key={i} className="w-28 h-28 sm:w-36 sm:h-36 rounded-lg border-2 border-dashed border-base-300 bg-base-200 flex items-center justify-center text-base-content/60 text-xs">No image</div>
                      ))
                    )}
                  </div>
                </div>
                )}

              </div>
            </div>

            {activeTab !== "Logs" && (
            <div className="pt-6 mt-6 border-t border-base-300 space-y-4">
              <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block">
                Comments
              </span>
              {activeTab === "TNA" && (
                <div className="space-y-4">
                  <CommentThread
                    orderId={orderId}
                    title="TNA comments (general)"
                    scope="TNA"
                    fieldKey="general"
                    comments={commentsByThread[threadKey("TNA", "general")] || []}
                    loading={commentsLoadingByThread[threadKey("TNA", "general")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TNA", "general");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TNA", field: "general" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="Greige commit comments"
                    scope="TNA"
                    fieldKey="greigeCommit"
                    comments={commentsByThread[threadKey("TNA", "greigeCommit")] || []}
                    loading={commentsLoadingByThread[threadKey("TNA", "greigeCommit")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TNA", "greigeCommit");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TNA", field: "greigeCommit" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="Color commit comments"
                    scope="TNA"
                    fieldKey="colorCommit"
                    comments={commentsByThread[threadKey("TNA", "colorCommit")] || []}
                    loading={commentsLoadingByThread[threadKey("TNA", "colorCommit")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TNA", "colorCommit");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TNA", field: "colorCommit" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="PP approval comments"
                    scope="TNA"
                    fieldKey="ppApproval"
                    comments={commentsByThread[threadKey("TNA", "ppApproval")] || []}
                    loading={commentsLoadingByThread[threadKey("TNA", "ppApproval")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TNA", "ppApproval");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TNA", field: "ppApproval" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="Cut date comments"
                    scope="TNA"
                    fieldKey="cutDate"
                    comments={commentsByThread[threadKey("TNA", "cutDate")] || []}
                    loading={commentsLoadingByThread[threadKey("TNA", "cutDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TNA", "cutDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TNA", field: "cutDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="GAC comments"
                    scope="TNA"
                    fieldKey="gacDate"
                    comments={commentsByThread[threadKey("TNA", "gacDate")] || []}
                    loading={commentsLoadingByThread[threadKey("TNA", "gacDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TNA", "gacDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TNA", field: "gacDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="TNA closed with buyer comments"
                    scope="TNA"
                    fieldKey="tnaClosedWithBuyer"
                    comments={commentsByThread[threadKey("TNA", "tnaClosedWithBuyer")] || []}
                    loading={commentsLoadingByThread[threadKey("TNA", "tnaClosedWithBuyer")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TNA", "tnaClosedWithBuyer");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TNA", field: "tnaClosedWithBuyer" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />
                </div>
              )}

              {activeTab === "Tech Pack" && (
                <div className="space-y-4">
                  <CommentThread
                    orderId={orderId}
                    title="Tech pack comments (general)"
                    scope="TECHPACK"
                    fieldKey="general"
                    comments={commentsByThread[threadKey("TECHPACK", "general")] || []}
                    loading={commentsLoadingByThread[threadKey("TECHPACK", "general")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TECHPACK", "general");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TECHPACK", field: "general" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="Initial TP comments"
                    scope="TECHPACK"
                    fieldKey="initialTPDate"
                    comments={commentsByThread[threadKey("TECHPACK", "initialTPDate")] || []}
                    loading={commentsLoadingByThread[threadKey("TECHPACK", "initialTPDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TECHPACK", "initialTPDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TECHPACK", field: "initialTPDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="1st fit submission comments"
                    scope="TECHPACK"
                    fieldKey="firstFitSubmissionDate"
                    comments={commentsByThread[threadKey("TECHPACK", "firstFitSubmissionDate")] || []}
                    loading={commentsLoadingByThread[threadKey("TECHPACK", "firstFitSubmissionDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TECHPACK", "firstFitSubmissionDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TECHPACK", field: "firstFitSubmissionDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="2nd fit submission comments"
                    scope="TECHPACK"
                    fieldKey="secondFitSubmissionDate"
                    comments={commentsByThread[threadKey("TECHPACK", "secondFitSubmissionDate")] || []}
                    loading={commentsLoadingByThread[threadKey("TECHPACK", "secondFitSubmissionDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TECHPACK", "secondFitSubmissionDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TECHPACK", field: "secondFitSubmissionDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="PP approval date comments"
                    scope="TECHPACK"
                    fieldKey="ppApprovalDate"
                    comments={commentsByThread[threadKey("TECHPACK", "ppApprovalDate")] || []}
                    loading={commentsLoadingByThread[threadKey("TECHPACK", "ppApprovalDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("TECHPACK", "ppApprovalDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "TECHPACK", field: "ppApprovalDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />
                </div>
              )}

              {activeTab === "Fabric" && (
                <div className="space-y-4">
                  <CommentThread
                    orderId={orderId}
                    title="Fabric comments (general)"
                    scope="FABRIC"
                    fieldKey="general"
                    comments={commentsByThread[threadKey("FABRIC", "general")] || []}
                    loading={commentsLoadingByThread[threadKey("FABRIC", "general")] || false}
                    onRefresh={async () => {
                      const k = threadKey("FABRIC", "general");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "FABRIC", field: "general" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="Lab dip approval comments"
                    scope="FABRIC"
                    fieldKey="labDipApprovalDate"
                    comments={commentsByThread[threadKey("FABRIC", "labDipApprovalDate")] || []}
                    loading={commentsLoadingByThread[threadKey("FABRIC", "labDipApprovalDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("FABRIC", "labDipApprovalDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "FABRIC", field: "labDipApprovalDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="IOB approval comments"
                    scope="FABRIC"
                    fieldKey="iobApprovalDate"
                    comments={commentsByThread[threadKey("FABRIC", "iobApprovalDate")] || []}
                    loading={commentsLoadingByThread[threadKey("FABRIC", "iobApprovalDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("FABRIC", "iobApprovalDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "FABRIC", field: "iobApprovalDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="Bulk in-house comments"
                    scope="FABRIC"
                    fieldKey="bulkInhouseDate"
                    comments={commentsByThread[threadKey("FABRIC", "bulkInhouseDate")] || []}
                    loading={commentsLoadingByThread[threadKey("FABRIC", "bulkInhouseDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("FABRIC", "bulkInhouseDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "FABRIC", field: "bulkInhouseDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />

                  <CommentThread
                    orderId={orderId}
                    title="Lot approval comments"
                    scope="FABRIC"
                    fieldKey="lotApprovalDate"
                    comments={commentsByThread[threadKey("FABRIC", "lotApprovalDate")] || []}
                    loading={commentsLoadingByThread[threadKey("FABRIC", "lotApprovalDate")] || false}
                    onRefresh={async () => {
                      const k = threadKey("FABRIC", "lotApprovalDate");
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                      try {
                        const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "FABRIC", field: "lotApprovalDate" }});
                        setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                      } finally {
                        setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                      }
                    }}
                  />
                </div>
              )}

              {activeTab === "Costing" && (
                <CommentThread
                  orderId={orderId}
                  title="Costing comments"
                  scope="COSTING"
                  comments={commentsByThread[threadKey("COSTING")] || []}
                  loading={commentsLoadingByThread[threadKey("COSTING")] || false}
                  onRefresh={async () => {
                    const k = threadKey("COSTING");
                    setCommentsLoadingByThread((prev) => ({ ...prev, [k]: true }));
                    try {
                      const res = await axiosClient.get(`/notification/order/${orderId}/comments`, { params: { scope: "COSTING" }});
                      setCommentsByThread((prev) => ({ ...prev, [k]: res.data?.data ?? [] }));
                    } finally {
                      setCommentsLoadingByThread((prev) => ({ ...prev, [k]: false }));
                    }
                  }}
                />
              )}
            </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
