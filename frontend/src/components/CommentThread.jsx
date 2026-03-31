import { useState } from "react";
import axiosClient from "../utils/axiosClient.js";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function CommentThread({
  orderId,
  title,
  scope,
  fieldKey,
  comments,
  loading,
  onRefresh,
}) {
  const [text, setText] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [filter, setFilter] = useState("ALL"); // ALL | asmara | factory

  async function handleSubmit(e) {
    e.preventDefault();
    if (!orderId) return;
    if (!text.trim()) return;

    setSubmitLoading(true);
    try {
      await axiosClient.post("/notification/comment", {
        orderId,
        text: text.trim(),
        scope,
        field: fieldKey,
      });
      setText("");
      await onRefresh?.();
    } finally {
      setSubmitLoading(false);
    }
  }

  const filteredComments =
    filter === "ALL"
      ? comments || []
      : (comments || []).filter(
          (c) => String(c?.sender?.role || "").toLowerCase() === filter
        );

  function getAvatarLetter(c) {
    const name =
      (c?.sender?.firstName && c?.sender?.lastName
        ? `${c.sender.firstName} ${c.sender.lastName}`
        : c?.sender?.firstName || c?.sender?.organisationName || "") + "";
    const trimmed = name.trim();
    return trimmed ? trimmed[0].toUpperCase() : "U";
  }

  return (
    <div className="bg-base-100 border border-base-300 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-base-content/70 uppercase tracking-wider">
            {title}
          </h4>
          <div className="text-xs text-base-content/50 mt-0.5">
            {loading
              ? "Loading…"
              : `${filteredComments?.length ?? 0} comment${
                  (filteredComments?.length ?? 0) === 1 ? "" : "s"
                }`}
          </div>
        </div>
        {loading && <span className="loading loading-spinner loading-xs" />}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <span className="loading loading-spinner loading-sm" />
        </div>
      ) : (
        <>
          <div className="tabs tabs-boxed tabs-sm w-fit mb-3">
            <button
              type="button"
              className={`tab tab-sm ${filter === "ALL" ? "tab-active" : ""}`}
              onClick={() => setFilter("ALL")}
            >
              All
            </button>
            <button
              type="button"
              className={`tab tab-sm ${filter === "asmara" ? "tab-active" : ""}`}
              onClick={() => setFilter("asmara")}
            >
              Asmara
            </button>
            <button
              type="button"
              className={`tab tab-sm ${
                filter === "factory" ? "tab-active" : ""
              }`}
              onClick={() => setFilter("factory")}
            >
              Factory
            </button>
          </div>

          {filteredComments?.length ? (
            <ul
              className="space-y-3 overflow-y-auto pr-1 mb-3"
              style={{ maxHeight: 420 }}
            >
              {filteredComments.map((c) => (
                <li
                  key={c._id}
                  className="rounded-2xl border border-base-300 bg-base-200/60 p-3 shadow-sm"
                >
                  <div className="flex gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary-content/80 font-semibold"
                      title="Sender"
                    >
                      {getAvatarLetter(c)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-base-content/90 truncate">
                            {c.sender?.firstName && c.sender?.lastName
                              ? `${c.sender.firstName} ${c.sender.lastName}`
                              : c.sender?.organisationName ||
                                c.sender?.emailId ||
                                "Someone"}
                          </p>
                          {c.sender?.role && (
                            <span className="badge badge-ghost badge-sm">
                              {c.sender.role}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-base-content/60 whitespace-nowrap">
                          {formatDateTime(c.createdAt)}
                        </p>
                      </div>
                      <p className="mt-2 text-base-content/90 whitespace-pre-wrap wrap-break-word leading-snug">
                        {c.text}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-base-content/60 mb-3">
              No comments for this filter.
            </div>
          )}
        </>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap items-end">
        <textarea
          className="textarea textarea-bordered textarea-sm flex-1 min-w-[200px] min-h-[60px]"
          placeholder="Add a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitLoading || loading}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm self-end"
          disabled={submitLoading || loading || !text.trim()}
        >
          {submitLoading ? "Sending…" : "Post"}
        </button>
      </form>
    </div>
  );
}

