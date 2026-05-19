"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function safeJson(res: Response): Promise<{ error?: string }> {
  try {
    return (await res.json()) as { error?: string };
  } catch {
    return {};
  }
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string; progress: number }
  | { status: "error"; message: string };

type UploadButtonProps = {
  deliverableId: string;
  label: string;
};

const ACCEPTED =
  ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
]);

export function UploadButton({
  deliverableId,
  label,
}: UploadButtonProps): JSX.Element {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  function handleClick(): void {
    inputRef.current?.click();
  }

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!inputRef.current) return;
    inputRef.current.value = "";
    if (!file) return;

    // Client-side validation
    if (file.size > MAX_BYTES) {
      setState({ status: "error", message: "File exceeds the 25 MB limit." });
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setState({
        status: "error",
        message: "File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, ZIP.",
      });
      return;
    }

    setState({ status: "uploading", fileName: file.name, progress: 0 });

    try {
      // Step 1: Get signed upload URL
      const urlRes = await fetch(
        `/api/deliverables/${deliverableId}/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        }
      );

      if (!urlRes.ok) {
        const data = await safeJson(urlRes);
        throw new Error(data.error ?? `Request failed (${urlRes.status})`);
      }

      const { uploadUrl, fileKey } = (await urlRes.json()) as {
        uploadUrl: string;
        fileKey: string;
      };

      // Step 2: Upload directly to R2 with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (ev: ProgressEvent) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 90); // cap at 90% until confirmed
            setState({ status: "uploading", fileName: file.name, progress: pct });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setState({ status: "uploading", fileName: file.name, progress: 95 });

      // Step 3: Confirm upload and mark submitted
      const submitRes = await fetch(
        `/api/deliverables/${deliverableId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileKey,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        }
      );

      if (!submitRes.ok) {
        const data = await safeJson(submitRes);
        throw new Error(data.error ?? `Submit failed (${submitRes.status})`);
      }

      setState({ status: "uploading", fileName: file.name, progress: 100 });

      // Refresh the server component to show updated status
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setState({ status: "error", message });
    }
  }

  if (state.status === "uploading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ color: "var(--fg-tertiary)", flexShrink: 0 }}
          >
            <path d="M4 2h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
            <path d="M9 2v3h3" />
          </svg>
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--fg)",
            }}
          >
            {state.fileName}
          </span>
          <span
            style={{
              fontSize: 11.5,
              color: "var(--fg-tertiary)",
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {state.progress}%
          </span>
        </div>
        <div
          style={{
            height: 4,
            background: "var(--border)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${state.progress}%`,
              background: "var(--status-progress-fg)",
              borderRadius: 2,
              transition: "width 120ms ease",
            }}
          />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            color: "var(--status-attention-fg)",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M8 1l7 13H1L8 1z" />
            <path d="M8 6v4M8 12v.01" strokeWidth="1.8" />
          </svg>
          {state.message}
        </div>
        <button
          onClick={() => setState({ status: "idle" })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            fontSize: 12.5,
            fontFamily: "inherit",
            cursor: "pointer",
            color: "var(--fg-secondary)",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius)",
            background: "transparent",
            width: "fit-content",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // idle state
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        style={{ display: "none" }}
        onChange={(e) => void handleFileChange(e)}
      />
      <button
        onClick={handleClick}
        className="evidence-upload"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 3v8M4 7l4-4 4 4" />
          <path d="M3 13h10" />
        </svg>
        {label}
      </button>
    </>
  );
}
